# Sticky Prompt Header for Pi

A tiny [Pi](https://github.com/badlogic/pi-mono/) extension that keeps your latest submitted prompt visible while you work.

![Mock screenshot of the Sticky Prompt Header extension](assets/sticky-prompt-header-screenshot.png)

## What it does

- Shows the latest user prompt in a compact Pi-styled banner.
- Defaults to a pi-btw-style floating window anchored at the top of the terminal.
- Keeps focus in Pi's normal editor and terminal UI.
- Uses Pi's official `ctx.ui.custom(..., { overlay: true })` floating-window API by default.
- Provides a toggle command plus a manual repaint command for awkward terminal redraws.

## Install

Copy the extension into Pi's global extensions directory:

```bash
mkdir -p ~/.pi/agent/extensions
cp sticky-prompt-header.ts ~/.pi/agent/extensions/
```

Then restart Pi or run:

```text
/reload
```

## Usage

Submit a prompt in Pi. By default, the latest prompt appears in a pi-btw-style floating window anchored at the top center of the terminal. It uses Pi's normal overlay API rather than raw terminal drawing.

Commands:

```text
/sticky-prompt-header              # toggle on/off
/sticky-prompt-header repaint      # force a redraw
/sticky-prompt-header images       # toggle extra redraws after image tool output
```

Switch display modes:

```text
/sticky-prompt-header mode float    # default, pi-btw-style top floating window
/sticky-prompt-header mode ansi     # experimental raw ANSI paint
/sticky-prompt-header mode widget   # stable widget above editor
/sticky-prompt-header mode title    # titlebar only
/sticky-prompt-header mode overlay  # legacy full-width top overlay
```

## Notes

The default `float` mode follows the same general overlay path as pi-btw: `ctx.ui.custom()` with `overlay: true`, `anchor: "top-center"`, margins, and `nonCapturing: true`. The legacy `overlay` mode is the old absolute row/col full-width header. ANSI/widget/title modes remain as fallbacks.
