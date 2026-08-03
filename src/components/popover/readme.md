# popover

Anchor-positioned popover built on the native Popover API — behaviour **and** placement work without JavaScript.

## Files needed to copy
- `popover.html` – markup
- `popover.scss` – styles (source; compiled to `dist/css/popover.min.css`)
- `popover.js` – behavior
- `_shared/js/rafThrottle.js` and `_shared/js/getCssCustomProperty.js` – bundled into the module by the build; copy them alongside `popover.js` when pasting into a plain project.

## Usage
The popover is an element with the `popover` attribute, a unique `id` and `data-js-behavior="popover"`. A trigger anywhere on the page carries `popovertarget="<that id>"` — that native attribute wires everything: the browser toggles the popover on click, renders it in the top layer, light-dismisses it (outside click / `Esc`) and exposes the trigger's expanded state to assistive tech.

Placement is pure CSS: the trigger that opened the popover is its **implicit anchor element**, so CSS anchor positioning (`position-area`) places the popover next to it — no `anchor-name` wiring needed. The browser keeps the popover glued to the trigger on scroll/resize and flips it to the opposite side when the viewport runs out of room (`position-try-fallbacks`).

- **Placement:** `data-popover-position="top | right | bottom | left"` (default `bottom`). The one attribute is read by the CSS (`position-area`) **and** by the JS fallback, so it is the single source of truth. The values are physical on purpose — an anchored overlay points at a spot on the screen, not at a spot in the reading direction.
- **Light dismiss:** the bare `popover` attribute (= `popover="auto"`) closes on outside click and `Esc`. Use `popover="manual"` for a popover that only closes explicitly — then keep a visible close control: a `<button popovertarget="<id>" popovertargetaction="hide">` closes it natively (styled as `.m-popover__close`, see `demo.html`).
- **Multiple triggers** may point at the same popover; in supporting engines each one anchors the popover to itself when used.
- **Offset / theming:** the gap to the trigger is the `--popover-offset` custom property (default `var(--space-2xs)`; registered via `@property` as a `<length>` so the JS fallback can read it reliably). Colors, spacing, radius, max width and animation are the other `--popover-*` custom properties in `popover.scss`.

### Positioning support ladder
Feature-detected with the same condition in CSS and JS (`(anchor-name: --a) and (position-area: bottom)`):

1. **CSS anchor positioning supported** (Chrome/Edge 125+, Safari 26+): the stylesheet places the popover; the JS only validates the wiring.
2. **Not supported (e.g. current Firefox), JS available:** `popover.js` measures the trigger and mirrors the CSS placement — same side, same flip at the viewport edge, repositioned per frame on scroll/resize (`rafThrottle`). The measurements are written as `--popover-fallback-top/left` custom properties plus the `is-jsAnchored` state class, which an `@supports not` block in the stylesheet turns into actual coordinates — the script never writes `top`/`left` inline, appearance stays owned by the CSS.
3. **Neither:** the UA default shows the popover centered in the viewport — detached, but fully usable. In engines without the Popover API altogether the attribute is inert and the content renders in the normal page flow (the stylesheet guards its closed-state `opacity: 0` with `@supports selector(:popover-open)` so that content is never invisibly stuck).

The demo page walks through the anchor-positioning concepts (`anchor-name` / `position-anchor`, implicit anchors, the `position-area` grid, `anchor()`, `position-try-fallbacks`) for developers new to the feature.

## Accessibility
The browser maps `popovertarget` to the trigger's expanded/collapsed state for AT natively — the JS adds no ARIA. A popover is plain content in the top layer and needs no role or accessible name of its own; widget-like popovers (menus, listboxes, …) should carry their ARIA pattern's roles in the markup. A `popover="manual"` popover must keep a visible close control since light dismiss is disabled. The open/close animation is a pure CSS enhancement (`@starting-style` + `allow-discrete`) and respects `prefers-reduced-motion`. The close button uses the shared `focus-ring()` mixin (`light` tone).

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on demand by `boot.js` for every element carrying `data-js-behavior="popover"` — one instance per popover. It sets no inline styles; the only style writes are the two `--popover-fallback-*` measurement custom properties (fallback engines only), consumed by the stylesheet.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is only used for warnings (missing `popover` attribute, missing `id`, no trigger pointing at the popover, unknown placement value). Without it the module degrades silently.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
