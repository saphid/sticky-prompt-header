# Sticky Prompt Header for Pi

A tiny Pi extension that keeps your latest submitted prompt visible in a sticky banner at the top of the terminal.

## Preview

![Mock screenshot of the Sticky Prompt Header extension](assets/sticky-prompt-header-screenshot.png)

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

Submit a prompt in Pi. The latest prompt appears in a non-capturing overlay pinned to the top of the terminal, so it does not steal focus from the editor.

Toggle it on/off with:

```text
/sticky-prompt-header
```

## Notes

This is a sticky overlay implementation. It does not currently wait until the original prompt scrolls to the top, because Pi extensions do not expose viewport/message-position events yet.
