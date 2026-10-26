# Inv UI

A reading-first UI layer for SillyTavern, built on top of **Moonlit Echoes** and
**ProbablyTooManyTabs**. One panel controls color palettes, story typography, message cards, the
character image layout, and a tablet mode, with separate values per device.

## What it does

- **Palettes**: dark, low-strain color sets (including a colorblind-tuned one) that recolor
  SillyTavern, Moonlit Echoes, ProbablyTooManyTabs and ST-Copilot together. "My ST theme" turns them
  off and leaves your ST theme untouched.
- **Reading**: story font, size, weight, line height, letter spacing, paragraph gap and a reading
  width measured in characters per line.
- **Messages**: frosted-glass cards with adjustable solidity, an inner story text box, styles for
  your own messages, and a spotlight on the latest reply.
- **Character image**: Moonlit's Ripple portrait stays on screen while you read a long reply (Echo
  keeps Moonlit's own look and also stays on screen). One set of controls (size, focus, fade,
  padding) works across every layout.
- **Tablet mode**: on phones and tablets, a visual-novel **Split** layout (fixed image on top, chat
  scrolling below), plus Backdrop, Band, Side and Off. Blur is switched off on mobile for speed.
- **Per-device profiles**: text and image settings are saved separately for desktop and tablet.
  Colors and fonts are shared.
- **Panel**: collapsible sections, docked as a ProbablyTooManyTabs tab. Presets, export and import,
  per-section reset, and a master on/off switch for comparing against vanilla.

## Requirements

| | |
|---|---|
| SillyTavern | **staging** branch (developed and tested on 1.19.0 staging) |
| Moonlit Echoes | required for the look and the Ripple and Echo chat styles |
| ProbablyTooManyTabs | required for the panel tab, the layout and mobile mode |
| Optional | Inline Assistant, Input History, Quick Replies, TopInfoBar: the tablet input and layout fixes target them; without them those fixes simply don't apply |

Without ProbablyTooManyTabs the panel falls back to the Extensions settings drawer. A toast says
which requirement is missing.

## Install

Through SillyTavern: **Extensions → Install extension**, paste the repository URL.

Or clone it into `data/<user>/extensions/` yourself. Any folder name works: the extension finds its
own path at runtime.

## Moving to another install

Settings live in ST's `settings.json` (`extension_settings.invUI`), so a fresh install starts at
the defaults. To carry yours over:

1. On the old install: **Inv UI → Presets & backup → Export**.
2. On the new one: **Import** the file.

Two related things are **not** part of Inv UI and need carrying separately: your Moonlit Echoes
preset, and your ProbablyTooManyTabs layout. Both also live in `settings.json`.

## Device mode

Each device decides for itself whether it's mobile (Android, iOS or a narrow touch screen) before
ProbablyTooManyTabs loads, so a desktop and a tablet sharing one account don't overwrite each
other's layout mode. To override it on one browser, type in the chat box:

```
/inv-layout mobile
/inv-layout desktop
/inv-layout auto
```

`/inv-layout` on its own shows the current mode.

## Known limits

- ProbablyTooManyTabs development is frozen. If a future ST update breaks it, the layout and panel
  docking go with it.
- Every open ST tab saves the whole `settings.json`, so the last tab to save wins. Keep one ST tab
  open per account while changing settings.
- Reloading with **F5** makes ProbablyTooManyTabs replay a saved snapshot of the theme and layout.
  Reload by pressing Enter in the address bar instead.
