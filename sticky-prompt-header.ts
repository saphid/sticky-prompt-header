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
export default function (pi: ExtensionAPI) {
	let lastPrompt = "";
	let enabled = true;
	let overlayStarted = false;
	let overlayHandle: OverlayHandle | undefined;
	let closeOverlay: (() => void) | undefined;
	let requestRender: (() => void) | undefined;
	let repaintNonce = 0;
	let repaintTimers: ReturnType<typeof setTimeout>[] = [];

	const hasImageContent = (value: unknown): boolean => {
		if (!Array.isArray(value)) return false;
		return value.some((item) => typeof item === "object" && item !== null && (item as { type?: unknown }).type === "image");
	};

	const forceRepaintBurst = () => {
		if (!enabled || !lastPrompt.trim()) return;
		for (const timer of repaintTimers) clearTimeout(timer);
		repaintTimers = [];

		// Terminal image protocols paint pixel graphics after their placeholder rows
		// have been written. Pi's overlay compositor runs before that image escape
		// sequence, so image output can temporarily cover the sticky banner. Trigger
		// a few no-op-different repaints after image tools finish so the banner is
		// drawn last again.
		for (let i = 0; i < 8; i++) {
			repaintTimers.push(
				setTimeout(() => {
					repaintNonce++;
					requestRender?.();
				}, 120 + i * 180),
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

	const startOverlay = (ctx: ExtensionContext | ExtensionCommandContext) => {
		if (overlayStarted || !ctx.hasUI) return;
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
				overlayOptions: {
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
		startOverlay(ctx);
	});

	pi.on("before_agent_start", async (event, ctx) => {
		lastPrompt = event.prompt;
		startOverlay(ctx);
		requestRender?.();
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
	});

	pi.registerCommand("sticky-prompt-header", {
		description: "Toggle the sticky last-prompt header overlay",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled) {
				startOverlay(ctx);
				overlayHandle?.setHidden(false);
				ctx.ui.notify("Sticky prompt header enabled", "info");
			} else {
				overlayHandle?.setHidden(true);
				ctx.ui.notify("Sticky prompt header disabled", "info");
			}
			requestRender?.();
		},
	});
}
