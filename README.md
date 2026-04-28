# Sticky Prompt Header for Pi

A tiny [Pi](https://github.com/badlogic/pi-mono/) extension that keeps your latest submitted prompt visible while you work.

![Screenshot of the Sticky Prompt Header extension](assets/sticky-prompt-header-screenshot.png)

## What it does

- Shows the latest user prompt in a compact Pi-styled banner.
- Uses a pi-btw-style floating window anchored at the top of the terminal.
- Keeps focus in Pi's normal editor and terminal UI with `nonCapturing: true`.
- Provides a toggle command plus a manual repaint command.

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

Submit a prompt in Pi. The latest prompt appears in a floating window anchored at the top center of the terminal, using Pi's normal overlay API.

Commands:

```text
/sticky-prompt-header              # toggle on/off
/sticky-prompt-header repaint      # force a redraw
```

## Notes

This follows the same general floating-window path as pi-btw: `ctx.ui.custom()` with `overlay: true`, `anchor: "top-center"`, margins, and `nonCapturing: true`.
