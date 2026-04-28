# Sticky Prompt Header for Pi

A tiny [Pi](https://github.com/badlogic/pi-mono/) extension that keeps your latest submitted prompt visible while you work.

![Mock screenshot of the Sticky Prompt Header extension](assets/sticky-prompt-header-screenshot.png)

## What it does

- Shows the latest user prompt in a compact Pi-styled banner.
- Defaults to a stable widget above the editor and mirrors the prompt into the terminal title.
- Keeps focus in Pi's normal editor and terminal UI.
- Provides an experimental sticky top overlay mode for terminals where overlays behave well.
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

Submit a prompt in Pi. By default, the latest prompt appears as a stable Pi widget above the editor and is mirrored into the terminal title. This avoids the scrollback glitches caused by overlay redraws.

Commands:

```text
/sticky-prompt-header              # toggle on/off
/sticky-prompt-header repaint      # force a redraw
/sticky-prompt-header images       # toggle extra redraws after image tool output
```

Switch display modes:

```text
/sticky-prompt-header mode widget   # default, stable
/sticky-prompt-header mode title    # titlebar only
/sticky-prompt-header mode overlay  # experimental sticky top overlay
```

## Notes

The original overlay-only version could disturb terminal scrollback when Pi or the footer/status area repainted. Widget mode avoids overlay compositing and is the safer default. Overlay mode remains available, but Pi extensions do not currently expose viewport or message-position events, so a perfectly scrollback-aware sticky top header likely needs Pi core support.
