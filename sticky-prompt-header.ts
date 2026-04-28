import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import type { OverlayHandle } from "@mariozechner/pi-tui";

/**
 * Sticky Prompt Header
 *
 * Shows the most recent submitted user prompt in a non-capturing overlay pinned
 * to the top of the terminal. This behaves like a sticky header: it stays
 * visible while the conversation scrolls underneath and does not take focus
 * from the editor.
 */
type DisplayMode = "float" | "ansi" | "widget" | "title" | "overlay";

type WritableTerminal = {
	columns?: number;
	write(data: string): void;
};

export default function (pi: ExtensionAPI) {
	let lastPrompt = "";
	let enabled = true;
	// Default to Pi's normal floating-window overlay path, like pi-btw.
	let displayMode: DisplayMode = "float";
	let overlayStarted = false;
	let overlayHandle: OverlayHandle | undefined;
	let closeOverlay: (() => void) | undefined;
	let requestRender: (() => void) | undefined;
	let repaintNonce = 0;
	let repaintAfterImages = false;
	let repaintTimers: ReturnType<typeof setTimeout>[] = [];
	let terminalHookStarted = false;
	let terminalPatched = false;
	let unpatchTerminal: (() => void) | undefined;

	const hasImageContent = (value: unknown): boolean => {
		if (!Array.isArray(value)) return false;
		return value.some((item) => typeof item === "object" && item !== null && (item as { type?: unknown }).type === "image");
	};

	const forceRepaintBurst = () => {
		if (!enabled || !repaintAfterImages || !lastPrompt.trim()) return;
		for (const timer of repaintTimers) clearTimeout(timer);
		repaintTimers = [];

		// Optional workaround: terminal image protocols can paint pixel graphics
		// after Pi's overlay compositor has drawn the banner, temporarily covering
		// it. This is OFF by default because unsolicited redraws can disturb manual
		// terminal scrollback while the user is reading older output.
		for (let i = 0; i < 3; i++) {
			repaintTimers.push(
				setTimeout(() => {
					repaintNonce++;
					requestRender?.();
				}, 120 + i * 220),
			);
		}
	};

	const promptBanner = (theme: Theme, width: number) => {
		if (!enabled || !lastPrompt.trim()) return [];

		const normalized = lastPrompt.replace(/\s+/g, " ").trim();
		const repaintNoop = repaintNonce % 2 === 0 ? "\x1b[0m" : "\x1b[0m\x1b[0m";
		const paintLine = (line: string) => theme.bg("userMessageBg", truncateToWidth(line, width, "", true));

		// Tiny terminals get a single compact line rather than a broken box.
		if (width < 24) {
			const prefix = theme.bold(theme.fg("accent", "Prompt: "));
			return [paintLine(prefix + theme.fg("text", normalized)) + repaintNoop];
		}

		const border = (text: string) => theme.fg("borderAccent", text);
		const muted = (text: string) => theme.fg("muted", text);
		const contentWidth = Math.max(1, width - 4);
		const title = ` ${theme.bold(theme.fg("accent", "Latest prompt"))} ${muted("↟")} `;
		const topRuleWidth = Math.max(0, width - 2 - visibleWidth(title));
		const top = `${border("╭")}${title}${border("─".repeat(topRuleWidth))}${border("╮")}`;
		const bottom = `${border("╰")}${border("─".repeat(width - 2))}${border("╯")}`;

		// Keep the header small: two prompt lines max, with an ellipsis if needed.
		const twoLineBudget = contentWidth * 2;
		const clippedPrompt = truncateToWidth(normalized, twoLineBudget, "…");
		const promptLines = wrapTextWithAnsi(theme.fg("userMessageText", clippedPrompt), contentWidth).slice(0, 2);
		const body = promptLines.map((line) => {
			const padded = truncateToWidth(line, contentWidth, "…", true);
			return `${border("│")} ${padded} ${border("│")}`;
		});

		const lines = [top, ...body, bottom].map(paintLine);
		lines[0] += repaintNoop;
		return lines;
	};

	const widgetKey = "sticky-prompt-header";
	const terminalHookKey = "sticky-prompt-header-terminal-hook";

	const renderAnsiHeader = (theme: Theme, width: number) => {
		if (!enabled || displayMode !== "ansi" || !lastPrompt.trim()) return "";
		const lines = promptBanner(theme, width);
		if (lines.length === 0) return "";

		// Save cursor, paint absolute top rows, then restore cursor. This is a
		// separate drawing path from Pi's overlay system, and is appended to Pi's
		// own writes so it does not introduce background repaint timers.
		return `\x1b7\x1b[1;1H${lines.map((line) => `\x1b[2K${line}`).join("\r\n")}\x1b8`;
	};

	const installTerminalHook = (ctx: ExtensionContext | ExtensionCommandContext) => {
		if (terminalHookStarted || !ctx.hasUI) return;
		terminalHookStarted = true;

		ctx.ui.setWidget(
			terminalHookKey,
			(tui, theme) => {
				if (!terminalPatched) {
					const terminal = (tui as unknown as { terminal?: WritableTerminal }).terminal;
					if (terminal) {
						const originalWrite = terminal.write.bind(terminal);
						terminal.write = (data: string) => {
							const width = Math.max(1, terminal.columns ?? 80);
							originalWrite(data + renderAnsiHeader(theme, width));
						};
						terminalPatched = true;
						unpatchTerminal = () => {
							terminal.write = originalWrite;
							terminalPatched = false;
						};
					}
				}

				return {
					render(): string[] {
						return [];
					},
					invalidate() {},
					dispose() {},
				};
			},
			{ placement: "aboveEditor" },
		);
	};

	const clearOverlay = () => {
		if (overlayStarted) closeOverlay?.();
		overlayStarted = false;
		overlayHandle = undefined;
		closeOverlay = undefined;
		requestRender = undefined;
	};

	const clearWidget = (ctx: ExtensionContext | ExtensionCommandContext) => {
		if (!ctx.hasUI) return;
		ctx.ui.setWidget(widgetKey, undefined, { placement: "aboveEditor" });
	};

	const updateTitle = (ctx: ExtensionContext | ExtensionCommandContext) => {
		if (!ctx.hasUI) return;
		if (!enabled || !lastPrompt.trim() || displayMode === "overlay" || displayMode === "ansi") return;
		const normalized = lastPrompt.replace(/\s+/g, " ").trim();
		ctx.ui.setTitle(`Pi — ${truncateToWidth(normalized, 80, "…")}`);
	};

	const updateWidget = (ctx: ExtensionContext | ExtensionCommandContext) => {
		if (!ctx.hasUI) return;
		if (!enabled || !lastPrompt.trim() || displayMode !== "widget") {
			clearWidget(ctx);
			return;
		}

		ctx.ui.setWidget(
			widgetKey,
			(_tui, theme) => ({
				render(width: number): string[] {
					return promptBanner(theme, width);
				},
				invalidate() {},
			}),
			{ placement: "aboveEditor" },
		);
	};

	const updateStableDisplay = (ctx: ExtensionContext | ExtensionCommandContext) => {
		if (displayMode === "ansi") installTerminalHook(ctx);
		clearOverlay();
		updateTitle(ctx);
		updateWidget(ctx);
	};

	const startOverlay = (ctx: ExtensionContext | ExtensionCommandContext) => {
		if ((displayMode !== "float" && displayMode !== "overlay") || overlayStarted || !ctx.hasUI) return;
		clearWidget(ctx);
		overlayStarted = true;

		void ctx.ui.custom<void>(
			(tui, theme, _keybindings, done) => {
				requestRender = () => tui.requestRender();
				closeOverlay = () => done();

				return {
					render(width: number): string[] {
						return promptBanner(theme, width);
					},
					invalidate() {},
					dispose() {
						requestRender = undefined;
						closeOverlay = undefined;
						overlayHandle = undefined;
						overlayStarted = false;
					},
				};
			},
			{
				overlay: true,
				overlayOptions:
					displayMode === "float"
						? {
								// pi-btw-style floating window: anchored and margin-based,
								// not absolute row/col full-screen chrome.
								width: "78%",
								minWidth: 40,
								maxHeight: 4,
								anchor: "top-center",
								margin: { top: 1, left: 2, right: 2 },
								nonCapturing: true,
							}
						: {
								// Legacy full-width sticky overlay.
								row: 0,
								col: 0,
								width: "100%",
								maxHeight: 4,
								nonCapturing: true,
							},
				onHandle: (handle) => {
					overlayHandle = handle;
				},
			},
		);
	};

	pi.on("session_start", async (_event, ctx) => {
		if (displayMode === "float" || displayMode === "overlay") startOverlay(ctx);
		else updateStableDisplay(ctx);
	});

	pi.on("before_agent_start", async (event, ctx) => {
		lastPrompt = event.prompt;
		if (displayMode === "float" || displayMode === "overlay") {
			startOverlay(ctx);
			requestRender?.();
		} else {
			updateStableDisplay(ctx);
		}
	});

	pi.on("tool_execution_end", async (event) => {
		if (hasImageContent((event as { result?: { content?: unknown } }).result?.content)) {
			forceRepaintBurst();
		}
	});

	pi.on("message_end", async (event) => {
		const message = (event as { message?: { role?: unknown; content?: unknown } }).message;
		if (message?.role === "toolResult" && hasImageContent(message.content)) {
			forceRepaintBurst();
		}
	});

	pi.on("session_shutdown", async () => {
		for (const timer of repaintTimers) clearTimeout(timer);
		repaintTimers = [];
		closeOverlay?.();
		unpatchTerminal?.();
		unpatchTerminal = undefined;
	});

	pi.registerCommand("sticky-prompt-header", {
		description: "Toggle/show latest prompt. Args: mode float|ansi|widget|title|overlay, repaint, image-repaint",
		handler: async (args, ctx) => {
			const arg = args.trim().toLowerCase();
			if (arg === "repaint" || arg === "redraw") {
				repaintNonce++;
				if (displayMode === "overlay") requestRender?.();
				else updateStableDisplay(ctx);
				ctx.ui.notify("Sticky prompt header repainted", "info");
				return;
			}

			if (arg === "image-repaint" || arg === "images") {
				repaintAfterImages = !repaintAfterImages;
				ctx.ui.notify(`Sticky prompt image repaint ${repaintAfterImages ? "enabled" : "disabled"}`, "info");
				return;
			}

			const modeMatch = arg.match(/^mode\s+(float|ansi|widget|title|overlay)$/);
			if (modeMatch) {
				const previousMode = displayMode;
				displayMode = modeMatch[1] as DisplayMode;
				enabled = true;
				if (previousMode === "float" || previousMode === "overlay") clearOverlay();
				if (displayMode === "float" || displayMode === "overlay") {
					clearWidget(ctx);
					startOverlay(ctx);
					requestRender?.();
				} else {
					updateStableDisplay(ctx);
					requestRender?.();
				}
				ctx.ui.notify(`Sticky prompt header mode: ${displayMode}`, "info");
				return;
			}

			enabled = !enabled;
			if (enabled) {
				if (displayMode === "float" || displayMode === "overlay") {
					startOverlay(ctx);
					overlayHandle?.setHidden(false);
					requestRender?.();
				} else {
					updateStableDisplay(ctx);
				}
				ctx.ui.notify("Sticky prompt header enabled", "info");
			} else {
				overlayHandle?.setHidden(true);
				clearWidget(ctx);
				ctx.ui.notify("Sticky prompt header disabled", "info");
			}
		},
	});
}
