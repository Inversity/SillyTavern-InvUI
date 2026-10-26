# Inv UI: notes for Claude

SillyTavern UI extension. Read README.md for what it does; this file is how it's built and how to
change it safely.

## Architecture

- **`style.css`** is the entry stylesheet ST loads (manifest `css`). It only `@import`s the layers in
  `css/`, in order. **`panel.css`** styles the control panel and is loaded separately by `index.js`,
  so the master switch can disable `style.css` without unstyling the panel.
- **`css/` layers**, all driven by `--inv-*` CSS variables:
  | File | Job |
  |---|---|
  | `00-palettes.css` | `:root` defaults for every `--inv-*` variable; palette token sets; mapping tokens onto ST SmartTheme, Moonlit and ProbablyTooManyTabs variables |
  | `10-reading.css` | typography, reading column, frosted message cards, wallpaper, your-message styles |
  | `20-unify.css` | shared shapes, focus rings, scrollbars, buttons, input bar padding, QR bar |
  | `25-ui-color.css` | palette roles on menus, toggles, tabs, headers, input bar |
  | `30-toggles.css` | spotlight, dim older, drop cap, vignette, focus mode, performance mode |
  | `40-edge-panels.css` | container-query fixes for wide panels squeezed into side edges |
  | `50-portrait.css` | sticky Ripple portrait (all its sizing), sticky Echo window |
  | `60-mobile.css` | everything for `html[data-inv-device="mobile"]`: input, `100dvh`, no blur, tablet layouts (split, backdrop, band, side, off) |
- **`index.js`** owns state and writes the variables:
  1. Device detection at module load, before ProbablyTooManyTabs (manifest `loading_order` 50,
     PTMT is 101; ST loads extensions one at a time in that order). Sets PTMT's shared
     `isMobile` flag and `html[data-inv-device]`.
  2. Settings in `extension_settings.invUI`: `shared` + `devices.desktop|tablet` (+ per-layout
     `image` params). `computeVars()` turns them into `--inv-*` values on `<html>`.
  3. The panel: `SECTIONS` (declarative fields with `scope` shared / device / image and optional
     `show()`), rendered into `#invui-panel`, docked as a PTMT tab (`sourceId` `invui-panel`).
  4. `--inv-stage-url`: the latest character reply's full-size image, for the tablet Split stage.
  5. `/inv-layout` and health checks (missing requirements, conflicting theme extensions).

## The variable contract

CSS reads only `--inv-*` variables plus ST/Moonlit/PTMT's own. Adding a setting means: a default in
`00-palettes.css :root`, a field in `SECTIONS` (or `imageFields()`), and a line in `computeVars()`.
Toggles are style queries: `@container style(--inv-x: true) { ... }`. Selects too:
`@container style(--inv-palette: nord)`.

## Traps already paid for

- **Style queries on `<html>` can't target `:root` itself.** Variable-dependent rules sit on `body`
  or deeper.
- **PTMT resolves its color aliases at `:root`.** Overriding SmartTheme variables on `body` means
  re-declaring PTMT's aliases on `body` too (see `00-palettes.css`).
- **Specificity fights with Moonlit:** prefer feeding Moonlit's own variables (for example
  `--messageTextFontSize`) over out-ranking its rules.
- **`backdrop-filter` silently fails under a mask or filter ancestor** (the "backdrop root"). That's
  why `#chat`'s mask is removed in `10-reading.css`.
- **`overflow: hidden` on any ancestor kills `position: sticky`.** Use `overflow: clip`.
- **A flex item with clipped overflow gets `min-height: 0`**, and `#chat` squashes it. Stacked
  layouts need `flex: 0 0 auto` on `.mes_block`.
- **`#sheld::before` is taken** (a background tint layer). The tablet stage is `#sheld::after`.
- **Inline Assistant wraps `#send_textarea`**, which breaks Moonlit's mobile input grid unless the
  wrapper gets `grid-area: textarea`.
- **Never use `scrollIntoView()` while testing**: it scrolls PTMT's overflow-hidden frames and hides
  the top tab strip until reload.

## Testing

- Desktop: keep a single ST tab open per account (every tab saves the whole `settings.json`).
  Reload by navigating (address bar + Enter), never F5.
- Tablet or phone: test on a real device when possible, for example Chrome remote debugging over
  ADB. On a slow device, navigate once and wait for the app to finish loading: a second navigation
  mid-load can leave ST's DOM duplicated.
- Change one behavior at a time. Before changing the look of something that already works, take a
  screenshot of the current state and compare afterwards.

## Conventions

- No em dashes in code comments or docs.
- Stage files by name.
