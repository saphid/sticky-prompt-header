# Sticky Prompt Header for Pi

A tiny [Pi](https://github.com/badlogic/pi-mono/) extension that keeps your latest submitted prompt visible in a sticky banner at the top of the terminal.

![Mock screenshot of the Sticky Prompt Header extension](assets/sticky-prompt-header-screenshot.png)

## What it does

- Pins the latest user prompt in a non-capturing overlay.
- Keeps focus in Pi's normal editor and terminal UI.
- Truncates long prompts to a compact two-line header.
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

Submit any prompt in Pi. The latest prompt appears at the top of the terminal.

Commands:

```text
/sticky-prompt-header              # toggle on/off
/sticky-prompt-header repaint      # force a redraw
/sticky-prompt-header images       # toggle extra redraws after image tool output
```

## Notes

This is a sticky overlay implementation. Pi extensions do not currently expose viewport or message-position events, so the header stays pinned immediately rather than waiting for the original prompt to scroll away.
