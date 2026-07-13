# scaleSVG

Sizes an inline `<svg>` from its own `viewBox`: the module multiplies the
viewBox size by a `data-scale` factor and writes the result as the SVG's
`width`/`height` presentation attributes — so a graphic gets its natural pixel
size (or a multiple of it) instead of blowing up to the full container width,
and nobody hand-computes pixel values in markup or CSS.

## Files needed to copy
- `scaleSVG.html` – markup
- `scaleSVG.scss` – styles (source; compiled to `dist/css/scaleSVG.min.css`).
  The component is behaviour-only, so this is an empty stub — copy it only to
  keep the build's file set complete.
- `scaleSVG.js` – behavior

## Usage
Put `data-js-module="scaleSVG"` on an inline `<svg data-scale="…">`, or on any
container that holds one or more of them — every `svg[data-scale]` inside the
boot scope is sized. `data-scale` doubles as the opt-in marker: an SVG without
it is never touched.

- `data-scale="<factor>"` — multiplier for the viewBox size: `0.5` halves it,
  `3` triples it. A bare `data-scale` (no value) sizes the SVG to its natural
  viewBox size (factor `1`); a value that is not a positive number is reported
  and falls back to `1` as well.
- A `viewBox` is required — it is the size the factor multiplies. An SVG
  without a usable viewBox is left untouched and reported.
- The module writes only the `width`/`height` **presentation attributes** —
  never inline styles. Presentation attributes rank below every CSS rule, so
  your stylesheet keeps full override power.
- A sized SVG is marked with the `is-scaled` state class; use it as a styling
  hook, e.g. to reveal a graphic only once it has its final size.

See `scaleSVG.html` for a ready-to-copy snippet.

### Combining with inlineSVG
`data-js-module="inlineSVG,scaleSVG"` together with `data-scale` on an
`<img src="….svg">` (a bare `data-scale` — natural size — works here too)
first inlines the file
([`inlineSVG`](../inlineSVG/readme.md) carries `data-scale` over onto the
`<svg>`) and then sizes the result from its viewBox. The order of operations
is handled for you: conversions that finished before scaleSVG ran are picked
up, and pending ones are watched with a `MutationObserver` — for up to 5
seconds, since a source whose fetch fails never converts and the observer must
not run forever.

### Without JavaScript
Nothing breaks — the SVG renders exactly as the markup says. Note that an
inline SVG carrying only a `viewBox` spans its container by default, so give
it explicit `width`/`height` attributes (or CSS) when the unscaled fallback
size matters; the module overwrites the attributes once it runs.

## Accessibility
Sizing only — the module never touches roles, names or `aria-*` attributes.
Whether an SVG is meaningful (`role="img"` + `aria-label`) or decorative
(`aria-hidden="true"`, `focusable="false"`) is owned by the markup author — or
by `inlineSVG` when the SVG comes out of an `<img>`.

**Reflow (WCAG 1.4.10 / BITV 9.1.4.10):** the module writes *fixed pixel
sizes*, so a large factor can exceed a narrow viewport — e.g. a 48×48 viewBox
× `10` yields a 480 px wide SVG that forces horizontal scrolling at the 320
CSS px reflow breakpoint. Since presentation attributes rank below every CSS
rule, cap large graphics in the consuming stylesheet, e.g.:

```css
svg[data-scale] { max-width: 100%; height: auto; }
```

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying `data-js-module="scaleSVG"`.

It is a stateless DOM transform (plain functions, no instance) and sets no
inline styles — the size goes into the SVG's `width`/`height` presentation
attributes, the state into the `is-scaled` class.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it
is used only for warnings (an SVG without a usable `viewBox`, a `data-scale`
value that is not a positive number, or the module placed on a non-element
node). Without it the module degrades silently.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`). Serve it over
HTTP — the chained inlineSVG example fetches the icon file, which is blocked
on a `file://` origin.
