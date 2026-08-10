# tooltip

A short hint about a control, on hover and on keyboard focus — shown by CSS alone, described, dismissible and kept on screen by the module.

## Files needed to copy
- `tooltip.html` – markup
- `tooltip.scss` – styles (source; compiled to `dist/css/tooltip.min.css`)
- `tooltip.js` – behavior
- `_shared/js/rafThrottle.js`, `_shared/js/getCssCustomProperty.js`, `_shared/js/focusableSelector.js`, `_shared/js/uniqueId.js` and `_shared/js/describedBy.js` – bundled into the module by the build; copy them alongside `tooltip.js` when pasting into a plain project.

## Usage
The root is a wrapper (`class="c-tooltip"`, `data-js-behavior="tooltip"`) holding two marked parts: the control being described (`data-tooltip-trigger`) and the hint (`data-tooltip-bubble`). The hint has to be *inside* the wrapper — that is both the positioning context and the element the show rules key on.

Showing and hiding is pure CSS. `tooltip.scss` reveals the hint on `:hover` and on `:has([data-tooltip-trigger]:focus-visible)`, places it on one of four sides with an arrow, and fades it in — all of that works before the module arrives and without it.

- **Placement:** `data-tooltip-position="top | right | bottom | left"` (default `top`). The one attribute is read by the CSS **and** by the module's measurement, so it is the single source of truth. The values are physical on purpose — a hint points at a spot on the screen, not at a spot in the reading order.
- **The trigger must be a real control** (`<button>`, a link, a form field). A hint hung on a `<span>` is a hint no keyboard reaches; the module reports it rather than patching it with a `tabindex`, because an element made focusable without being operable is a worse tab stop than none.
- **No `title` attribute on the trigger** — the browser would show its own tooltip next to this one. Reported as well.
- **Nothing focusable inside the hint.** A tooltip is never focused and is gone the moment the trigger loses focus, so a control in there is unreachable. That is what the `popover` component is for; the module reports this case too.
- **Theming:** the wrapper is `inline-flex`; set `--tooltip-display: block` for a hint on a full-width field. Colours, spacing, radius, max width, arrow size, fade and the hover delay are the other `--tooltip-*` custom properties in `tooltip.scss`. The gap to the trigger is `--tooltip-offset` (default `var(--space-2xs)`, registered via `@property` as a `<length>` so the module can read it reliably).
- **The trigger keeps its own styling**, focus ring included — it is the project's control, and the component does not touch it.

### What the module adds
1. **The description wiring.** The hint gets `role="tooltip"` and an id (generated only where the author wrote none), and the trigger gets an `aria-describedby` pointing at it — *added* to whatever was in there already, never assigned over it.
2. **Dismissal (WCAG 1.4.13).** `Escape` sets `data-tooltip-dismissed` on the root, which the show rules are guarded against, so the hint goes without the reader having to move the pointer off the control first. The next hover or focus clears it. A tap outside does the same, as the backstop for touch: most engines drop the hover state of the last element tapped as soon as something else is, but where one does not, a tap has no "leave" to offer and nothing else would take the hint away. `Escape` is deliberately **not** swallowed: a tooltip is a passive hint, not a layer that owns the key, so a dialog underneath it still closes.

   Whether a hint is up is read back off the DOM — `:hover` on the root, `:focus-visible` on the trigger, the same two conditions the stylesheet shows it on — rather than tracked in a flag, and the key is watched for as long as the component lives rather than only while the module thinks something is showing. Both matter, because the stylesheet can start showing a hint from a state change no event reports: `:focus-visible` turning on when a reader who clicked a control then touches the keyboard, or a pointer already resting on the trigger when the chunk arrives. A module that mirrors the state instead of reading it believes nothing is up in either case, and `Escape` then does nothing while the reader is looking at a hint — or, on the first of the two, *opens* it, because the keystroke meant to dismiss it is the very thing that turns `:focus-visible` on.
3. **Putting the hint where the stylesheet cannot.** Without a measurement a hint can only be centred on the element it is positioned in and left there, and that is wrong twice: against the edge of the viewport it hangs off the screen, and on a root wider than its control (a hint on a full-width field) it is centred on the wrong thing. The module writes `data-tooltip-flipped` (the preferred side had no room, render on the opposite one), `--tooltip-shift` (how far the bubble moves), `--tooltip-arrow-shift` (how far the arrow moves back, so it keeps pointing at the control) and `--tooltip-available` (how much horizontal room the hint's side has, which bounds the bubble's width); `tooltip.scss` turns all four into the actual box. The script never writes a coordinate itself.

   The width bound is what a hint placed *left* or *right* needs: the shift slides a hint along its cross axis, and for a sideways hint that axis is the vertical one, so nothing else can stop a bubble wider than the gap between its control and the edge of the window. Bounded, it wraps to more lines instead.

   **Every** hint is measured, not only the one on screen. The bubble is hidden with `visibility` rather than `display`, so it is a real, absolutely positioned box at all times, and one left at its unmeasured resting position can reach past the right edge of a narrow window and put a horizontal scrollbar under the whole page before anything has been hovered (WCAG 1.4.10). So the first measurement happens at `init()`, every hint is re-measured on resize, and once more when a webfont swaps in — a different face gives every hint a different width, and nothing reports the swap as an event, so `document.fonts.ready` is the trigger. Following the page as it scrolls is reserved for the hint that is actually up. All of it is collapsed into one pass per frame by `rafThrottle`, and that pass relaxes, then reads, then writes every hint in turn, so a page full of tooltips costs one layout rather than one each.

   A hint the width bound actually narrows is read a **second** time. The bound is itself a measured value, so such a hint wraps into more lines *after* it has been written, and the height taken before that describes a box that no longer exists. The centring survives it (the height cancels out of that sum), the clamp against the viewport edge does not — without the correction a long hint placed `left` or `right` is left hanging past the bottom of the window, and its arrow points at the wrong spot. Only the hints that need it pay for the second pass, and applying a shift cannot change a height, so one correction is always enough.
4. **Warnings** about the three quiet authoring mistakes listed above.

### tooltip or popover?
Both anchor a small surface to a control, and the split is what the surface is *for*:

| | `tooltip` | `popover` |
| --- | --- | --- |
| Opened by | hover and keyboard focus | a click on the trigger |
| Contains | a sentence of description | anything, including controls |
| Focus | never receives it | the reader can tab into it |
| Rendered in | the normal flow (clipped by an `overflow: hidden` ancestor) | the top layer (never clipped) |
| Placement | absolute, relative to the wrapper; the module flips and slides it | CSS anchor positioning, with a JS fallback |

The clipping row is the practical one: a tooltip inside a scroll container or a card with `overflow: hidden` will be cut off. That is the price of a hint that needs no script to appear at all — the top layer can only be entered by `showPopover()`, which no CSS-only component can call. Where a hint has to escape its container, use `popover`.

## Accessibility
The hint is hidden with `visibility`, not `display`, and that is an accessibility choice as much as a layout one: a node that `aria-describedby` points at **directly** contributes its text whether it is visible or not, so the description reaches a screen reader on focus even before the bubble has faded in — and it reaches one that never renders the bubble at all.

WCAG 1.4.13 (*Content on Hover or Focus*) asks three things of a hint like this, and the component answers all three: it is **hoverable** (the bubble extends invisibly across the gap to the trigger, so the pointer can travel to it without the hint disappearing mid-transit), **dismissible** (`Escape`, see above), and **persistent** (nothing takes it away on a timer).

Both of those depend on the module. Without the chunk the hint still appears on hover and on focus, but there is no `aria-describedby`, no `Escape`, and no measurement — and the last one is not only the hint's problem: a hidden bubble is still a box, so a hint on a control near the right edge of a narrow window puts a horizontal scrollbar under the page (WCAG 1.4.10). That is not fixable in the stylesheet — taking an absolutely positioned box out of the scroll region needs either `display: none`, which would cost the measurement and the fade, or `overflow: clip` on an ancestor, which would clip both the hint and the trigger's focus ring. A page that has to survive the chunk failing and carries hints near its right edge wants `overflow-x: clip` on its own scroll container.

The hover delay (`--tooltip-delay`, default `0.35s`) is not applied to keyboard focus — crossing a row of controls with the pointer should not set off a chain of hints, but a `Tab` is never accidental. A `prefers-reduced-motion: reduce` block makes the fade instant, and a `forced-colors: active` block gives the bubble a border and drops the arrow, which the system palette would otherwise render invisible.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on demand by `boot.js` for every element carrying `data-js-behavior="tooltip"` — one instance per tooltip. It sets no inline styles; the only style writes are the three `--tooltip-shift` / `--tooltip-arrow-shift` / `--tooltip-available` measurement custom properties, consumed by the stylesheet. `init()` returns a cleanup function, so `destroyModulesInScope()` gives the markup back exactly as it was authored (listeners, the `aria-describedby` entry, the generated id and role, and the state attributes and properties all go).

Three listeners are shared by all tooltips on the page rather than held per instance — `keydown` and a capturing `pointerdown` on the document, `resize` on the window. They are registered with the first instance and removed with the last. They have to outlive any single showing (see *Dismissal* above), they concern every hint rather than the one on screen, and a page can carry dozens of tooltips that would otherwise all ask the same question of the same event.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is only used for warnings (missing trigger or hint, unknown placement value, a trigger the keyboard cannot reach, a `title` attribute doubling the hint, a focusable element inside the hint). Without it the module degrades silently.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
