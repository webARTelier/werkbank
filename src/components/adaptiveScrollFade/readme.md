# adaptiveScrollFade

Adds an adaptive fade mask to a scrollable container: whenever content is hidden
beyond an edge, that edge fades out to signal "there is more to scroll".

## Files needed to copy
- `adaptiveScrollFade.html` – markup
- `adaptiveScrollFade.scss` – styles (source; compiled to `dist/css/adaptiveScrollFade.min.css`)
- `adaptiveScrollFade.js` – behavior
- `_shared/js/rafThrottle.js` – utility imported by the behavior (copy alongside it)

## Usage
The scrollable container itself gets `class="m-scrollFade"` and
`data-js-behavior="adaptiveScrollFade"`. `overflow-y: auto` is applied by the
class; you only have to give the element a **constrained height** (e.g.
`max-block-size`/`height`) so its content can overflow.

While scrolling, the module fades the top and/or bottom edge — each only where
hidden content still follows. Scroll to an extreme edge and that fade
disappears.

### Configuration (optional)
- `--scrollFade-size` (CSS custom property) – fade depth in fixed px. Default:
  `--space-xl`. Set it in your CSS or inline: `style="--scrollFade-size: 24px"`.
- `data-fade-threshold` – px tolerance before an edge counts as "reached"
  (default `1`).
- `aria-label` / `aria-labelledby` – names the scroll region for screen readers
  (see Accessibility). **Required** once the box can overflow; a missing name is
  reported via the reporter.

See `adaptiveScrollFade.html` for a ready-to-copy snippet.

## Accessibility

A bare scrollable `<div>` cannot receive keyboard focus, so it can't be scrolled
without a pointer. While the box actually overflows, the module makes it
focusable (`tabindex="0"`); the browser then handles the arrow keys, `PageUp` /
`PageDown`, `Home` / `End` and `Space` natively. When the content fits (no
overflow) the `tabindex` is removed again so the box is not a dead tab stop. If
you set your own `tabindex`, the module leaves focus management to you.

A visible focus ring (`:focus-visible`, via the shared `focus-ring()` mixin with
the `light` tone, drawn inset so the mask does not clip it) shows keyboard users
where they are.

Give the container an `aria-label` (or `aria-labelledby`) so screen-reader users
know what the focusable scroll area holds. This is **required**: a focusable
scroll region without an accessible name fails WCAG 4.1.2. When a name is present
the module promotes the box to `role="region"`; when it is missing, the module
reports the omission (once, via the reporter) as soon as the box actually becomes
focusable, and stays role-less to avoid an unlabelled landmark.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on
demand by `boot.js` for every element carrying
`data-js-behavior="adaptiveScrollFade"`.

The script sets **no inline styles**. It only toggles the `data-fade-top` /
`data-fade-bottom` state attributes; the mask gradient itself lives in the SCSS
(mirrors the accordion's CSS-state approach). Without JavaScript the mask stays
fully opaque, so the content remains completely readable — the fade is a pure
progressive enhancement.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is
used to warn when the module is initialized on a non-element node, and when a
focusable (overflowing) box is missing its required accessible name.

`init()` returns a cleanup function that removes the window resize listener and
disconnects the `ResizeObserver`/`MutationObserver` it created. The loader only
needs this for a host that mounts/unmounts the same markup repeatedly instead of
a full page (re)load — see `destroyModulesInScope()` in `boot.js`.

## Demo
Open `demo.html` in the browser.
