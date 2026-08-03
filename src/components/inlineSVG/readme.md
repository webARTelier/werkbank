# inlineSVG

Replaces an `<img>` that points at an `.svg` file with a real, inline `<svg>`
node, so the graphic becomes a first-class part of the document: it can inherit
`currentColor`, be styled by the page's CSS and have its inner shapes reached
from the DOM — none of which is possible while the SVG is sealed inside an
`<img>`.

## Files needed to copy
- `inlineSVG.html` – markup
- `inlineSVG.scss` – styles (source; compiled to `dist/css/inlineSVG.min.css`).
  The component is behaviour-only, so this is an empty stub — copy it only to
  keep the build's file set complete.
- `inlineSVG.js` – behavior

## Usage
Put `data-js-behavior="inlineSVG"` directly on an `<img>` whose `src` is an `.svg`
file, or on any container that holds one or more such images — every matching
`<img>` inside the boot scope is converted. Non-`.svg` and cross-origin sources
are ignored and left as plain images.

The SVG is retrieved with `fetch`, so it is subject to the **same-origin
policy**: serve the file from the same origin as the page. Several `<img>`
elements pointing at the **same** file share a single fetch and parse — each
instance then clones and prefixes its own copy — so a repeated icon costs one
network round-trip, not one per occurrence.

These `<img>` attributes are carried onto the resulting `<svg>`:
- `id`
- `class` (merged with any classes the file itself declares)
- `width` / `height` (only if the file sets none, so the file's own sizing wins)
- `data-scale` (so the [`scaleSVG`](../scaleSVG/readme.md) companion can size
  it) — including a bare `data-scale` without a value, which means "natural
  viewBox size" to scaleSVG

## Scoping (multiple SVGs on one page)
Two inlined `<svg>` share one document, so anything global to that document can
collide when the same file (or two files using the same names) is inlined more
than once. The module neutralises both cases with a unique per-instance prefix:

- **Ids and every reference to them** — `url(#…)` in presentation attributes,
  inline `style` and embedded `<style>`, plus `<use href="#…">`/`xlink:href` —
  are always prefixed, so gradients, clip-paths, masks, filters and `<use>`
  targets never resolve to the wrong SVG.
- **Class names** that the SVG's **own `<style>` styles** (the generic
  `.cls-1`, `.cls-2` … that Figma/Illustrator exports embed) are prefixed too,
  on both the element `class` attributes and the `<style>` selectors — an inline
  `<svg>`'s `<style>` is document-global, so without this one icon's rules would
  bleed onto another's shapes. Classes the file does **not** style itself are
  left intact, so they remain usable as hooks for your project's CSS.

Element-local features (`transform`, presentation attributes, inline `style`)
are never global and are left untouched. Note that because the prefix differs
per instance, project CSS cannot target an inlined SVG's inner shapes by their
original `id` or styled class — recolour via `currentColor` or structural
selectors, which is the intended styling surface anyway.

You can chain it with `scaleSVG` in one attribute
(`data-js-behavior="inlineSVG,scaleSVG"` + `data-scale`) to inline the file
and then size it from its `viewBox`.

See `inlineSVG.html` for a ready-to-copy snippet.

## Accessibility
An `<img>` names itself with `alt`, but a bare inline `<svg>` has neither an
implicit role nor a name — so the swap would silently drop the accessible name.
The module maps it across:
- a non-empty `alt` (or an `aria-label`) becomes the SVG's `aria-label` and the
  SVG is given `role="img"`; if the source file was authored decorative
  (`aria-hidden`/`focusable="false"`, as the shared icons are), that suppression
  is cleared so the now-meaningful graphic is exposed;
- an explicit `alt=""` marks the image decorative, so the inlined SVG is hidden
  from assistive technology (`aria-hidden="true"`, `focusable="false"`);
- an `<svg>` that the file already names (`aria-label`/`aria-labelledby`) is
  left untouched;
- an `<img>` with **no `alt` at all** leaves the intent undefined: the inlined
  SVG is hidden from assistive technology as a safe default and a warning is
  issued via `reporter`, so the missing `alt` is caught rather than silently
  shipping an unnamed graphic.

Always give each `<img>` an `alt` (meaningful or empty) so the outcome is
intentional.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on
demand by `boot.js` for every element carrying `data-js-behavior="inlineSVG"`.

It is a stateless DOM transform (plain functions, no instance) and sets no inline
styles — the visual result is a normal `<svg>` for your project to style.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is
used only for warnings (a fetch that fails with an HTTP error, a fetched file
with no `<svg>` root, a failed conversion, an `<img>` missing its `alt`
attribute, or the module placed on a non-element node). Without it the module
degrades silently and the original `<img>` simply stays in place.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`). Serve it over
HTTP — the SVG `fetch` is blocked on a `file://` origin.
