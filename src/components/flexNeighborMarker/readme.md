# flexNeighborMarker

Marks the items of a wrapping flex container that share a visual row, so CSS can
style the relationship between row-neighbours without hardcoding how many items
fit per row. Every item that is followed by a sibling **in the same visual row**
receives the class `has-neighbor`; a row's last item stays unmarked.

This solves what pure CSS cannot: `:not(:last-child)` marks the last item of the
whole list, not the last of each wrapped row, so drawing a divider *between*
items but never a trailing one at a row's end needs the laid-out geometry — which
this module measures.

## Files needed to copy
- `flexNeighborMarker.html` – markup
- `flexNeighborMarker.scss` – styles (source; compiled to `dist/css/flexNeighborMarker.min.css`)
- `flexNeighborMarker.js` – behavior
- shared: `_shared/js/rafThrottle.js` (bundled by the build into this component's
  lazy chunk; copy it along when copy-pasting into a plain project)

## Usage
Put `data-js-behavior="flexNeighborMarker"` on the flex container. Its
**direct children** are the items; each item that has a following sibling in
the same visual row gets the class `has-neighbor`.

For several containers at once, put `data-js-behavior` on a shared wrapper and
mark each container with `data-neighbor-container`; the module then scans all
of them. Without any `data-neighbor-container`, the module element itself is
the container.

The shipped stylesheet uses the class to draw a hairline divider between
row-neighbours — a sensible default and a starting point. `has-neighbor` is a
styling hook: override or replace the rules to style a same-row relationship
however your project needs. The optional `m-flexNeighbor` class is a convenience
flex container (wrap + gap + the default divider); the script does not read it,
so you can lay the container out any way you like.

### Configuration (optional, attributes on the container)
- `data-neighbor-tolerance` – px tolerance when grouping items into a row by
  their top edge (absorbs sub-pixel layout). Default: `1`.
- `data-neighbor-class` – override the marker class. Default: `has-neighbor`. The
  SCSS keys off the default, so restyle to match if you change it.
- `--flexNeighbor-gap`, `--flexNeighbor-divider-width`, `--flexNeighbor-divider-color`
  (CSS custom properties) – tune the default divider. Set them in your CSS or
  inline: `style="--flexNeighbor-gap: 24px"`.

See `flexNeighborMarker.html` for a ready-to-copy snippet.

## Accessibility
The marker is **purely presentational**. It describes a same-row neighbour — a
layout fact that does not exist without JavaScript and changes on every resize —
so the module adds no ARIA, no roles and no focus behaviour. Keep the styling it
drives decorative (dividers, spacing): nothing that conveys meaning to assistive
technology may depend on the class.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on
demand by `boot.js` for every element carrying
`data-js-behavior="flexNeighborMarker"`.

The script sets **no inline styles**. It only toggles the `has-neighbor` state
class (mirrors the accordion's CSS-state approach); the visuals live in the SCSS.
Without JavaScript the class is never added, so the layout stays fully intact —
the marking is a pure progressive enhancement.

Row membership is recomputed on window resize, on container size changes
(`ResizeObserver`), after a web-font swap (`document.fonts.ready`) and on `load`,
collapsed to at most one measurement per animation frame (`rafThrottle`). Every
class write is idempotent, so a divider that changes an item's box cannot drive
an infinite `ResizeObserver` loop.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is
used only to warn when the module is initialized on a non-element node.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
