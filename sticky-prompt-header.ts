import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import type { OverlayHandle } from "@mariozechner/pi-tui";

/**
 * Sticky Prompt Header
 *
 * Shows the most recent submitted user prompt in a pi-btw-style floating
 * window anchored at the top of the terminal. The window is non-capturing, so
 * it does not steal focus from Pi's editor.
 */
export default function (pi: ExtensionAPI) {
	let lastPrompt = "";
	let enabled = true;
	let overlayStarted = false;
	let overlayHandle: OverlayHandle | undefined;
	let closeOverlay: (() => void) | undefined;
	let requestRender: (() => void) | undefined;
	let repaintNonce = 0;

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

		// Keep the floating window small: two prompt lines max, with an ellipsis if needed.
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

	const startFloatingWindow = (ctx: ExtensionContext | ExtensionCommandContext): boolean => {
		if (overlayStarted || !ctx.hasUI) return false;
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
					// pi-btw-style floating window, but flush with the terminal's
					// top edge and full width.
					width: "100%",
					maxHeight: 4,
					anchor: "top-center",
					margin: { top: 0, left: 0, right: 0 },
					nonCapturing: true,
				},
				onHandle: (handle) => {
					overlayHandle = handle;
				},
			},
		).catch((error) => {
			overlayStarted = false;
			overlayHandle = undefined;
			closeOverlay = undefined;
			requestRender = undefined;
			ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
		});

		return true;
	};

	pi.on("before_agent_start", async (event, ctx) => {
		lastPrompt = event.prompt;
		if (enabled) {
			const created = startFloatingWindow(ctx);
			overlayHandle?.setHidden(false);
			if (!created) requestRender?.();
		}
	});

	pi.on("session_shutdown", async () => {
		closeOverlay?.();
	});

	pi.registerCommand("sticky-prompt-header", {
		description: "Toggle the top floating latest-prompt window. Args: repaint",
		handler: async (args, ctx) => {
			const arg = args.trim().toLowerCase();

			if (arg === "repaint" || arg === "redraw") {
				repaintNonce++;
				const created = startFloatingWindow(ctx);
				if (!created) requestRender?.();
				ctx.ui.notify("Sticky prompt header repainted", "info");
				return;
			}

			if (arg.length > 0) {
				ctx.ui.notify("Usage: /sticky-prompt-header [repaint]", "warn");
				return;
			}

			enabled = !enabled;
			if (enabled) {
				const created = startFloatingWindow(ctx);
				overlayHandle?.setHidden(false);
				if (!created) requestRender?.();
				ctx.ui.notify("Sticky prompt header enabled", "info");
			} else {
				overlayHandle?.setHidden(true);
				ctx.ui.notify("Sticky prompt header disabled", "info");
			}
		},
	});
}
