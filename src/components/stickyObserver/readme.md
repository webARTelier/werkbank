# stickyObserver

Marks a `position: sticky` element while it is actually pinned, so CSS can
style the stuck state. The sticky element itself is the module element: while
it is pinned it carries the class `is-stuck`. Detection uses a sentinel in the
flow above the element — auto-injected by the script, or author-placed for
full control — watched by an `IntersectionObserver`.

This solves what pure CSS cannot: `position: sticky` pins natively, but there
is no `:stuck` selector — "give the header a shadow and a solid background
once it sticks" needs to know *when* the element is pinned, which is exactly
the one bit of information this module adds.

## Files needed to copy
- `stickyObserver.html` – markup
- `stickyObserver.scss` – styles (source; compiled to `dist/css/stickyObserver.min.css`)
- `stickyObserver.js` – behavior
- `_shared/js/parseNonNegative.js` – utility imported by the behavior (copy
  alongside it)

## Usage
Put `data-js-behavior="stickyObserver"` on the sticky element. That is all:
the script injects a zero-size, `aria-hidden` sentinel `<div>` directly before
the element and toggles `is-stuck` on the element while it is pinned. That
class name is fixed: the shipped SCSS keys its pinned-state rules off it, so
there is nothing to gain from renaming it — restyle the rules instead.

When the injected sibling is not welcome — inside a flex/grid container with
`gap` it occupies a slot, it shifts `:first-child` / sibling selectors, and it
is invalid inside list or table markup — or when the trigger should sit
somewhere else in the layout entirely, place the sentinel yourself and point
`data-sticky-sentinel` at it. Any element works: the class flips once the
sentinel is completely above the trigger edge, so e.g. a whole hero section
can be the trigger ("mark the header once the hero is scrolled past").

Any number of instances can live on one page — every element owns its
sentinel and its observer. Several elements may also share one author-placed
sentinel by pointing at the same selector.

By default the observer watches the **viewport** — correct for the common
page-level sticky bar. When the element sticks inside an
`overflow: auto`/`scroll` container instead, `position: sticky` pins it
against that container's edge, so the class must flip against the same edge:
point `data-sticky-root` at the container. Element and sentinel must sit
inside it.

The shipped stylesheet provides `m-stickyBar` as a convenience look: a bar
that sticks to the top of the viewport and, while pinned, lifts off the page
with an elevated background, a hairline and a soft shadow. `is-stuck` is a
styling hook — override or replace those rules to make the pinned state look
however your project needs. The script does not read `m-stickyBar`.

### Configuration (optional, attributes on the sticky element)
- `data-sticky-sentinel` – CSS selector for an author-placed sentinel (first
  match in the document; use unique selectors per instance). Default: an
  injected sibling `<div>` directly before the element.
- `data-sticky-root` – CSS selector for the scroll container the element
  sticks in (first match in the document). Only needed inside an
  `overflow: auto`/`scroll` container; element and sentinel must sit inside
  it. Default: the viewport.
- `data-sticky-offset` – px pin distance from the viewport/root top (the
  element's `inset-block-start` / `top` value). Normally **not needed**: the
  script reads the element's computed `top` by itself, so the CSS pin
  position (e.g. `--stickyBar-offset`) is the single source of truth. Set it
  explicitly only when that value is `auto` or not resolvable to px. Either
  way the observer shifts its trigger edge by the offset so the class flips
  exactly when the element pins. Default: read from CSS, else `0`.
- `--stickyBar-offset`, `--stickyBar-padding`, `--stickyBar-bg`,
  `--stickyBar-border-color`, `--stickyBar-shadow`, `--stickyBar-duration`,
  `--stickyBar-ease` (CSS custom properties) – tune the default bar. Set them
  in your CSS or inline: `style="--stickyBar-offset: 16px"` — the script
  picks the resulting pin distance up automatically.

See `stickyObserver.html` for a ready-to-copy snippet.

## Accessibility
The state class is **purely presentational**. "Currently pinned" is a visual,
viewport-dependent layout fact, so the module adds no ARIA, no roles and no
focus behaviour; the injected sentinel is empty and `aria-hidden`. Keep the
styling keyed on the class decorative (surface, shadow, spacing): nothing that
conveys meaning to assistive technology may depend on it.

A pinned bar overlays the top of the viewport, so keyboard scrolling can land
a focused element *underneath* it (WCAG 2.2, 2.4.11 "Focus Not Obscured").
Reserve the bar's height in the consuming project so the browser scrolls
focused elements (and anchor targets) clear of it:

```css
html {
  /* height of the sticky bar (+ its data-sticky-offset, if any) */
  scroll-padding-block-start: 4rem;
}
```

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying
`data-js-behavior="stickyObserver"`.

The script sets **no inline styles** and runs no animations. It only toggles
the `is-stuck` state class (mirrors the accordion's CSS-state approach); the
visuals — including the transition between the two states, which honours
`prefers-reduced-motion` — live in the SCSS. Without JavaScript no sentinel is
injected and the class is never added, while the element still sticks
natively: the pinning is pure CSS, only the stuck *styling* is the
enhancement.

There is no scroll listener and no per-frame measuring: an
`IntersectionObserver` reports the sentinel's edge crossings, every class
write is idempotent, and the observer fires once right after observing so a
page restored mid-scroll starts in the correct state. On engines without
`IntersectionObserver` the class is simply never toggled (and no sentinel is
injected).

Note that the class means "the sentinel is scrolled past", which coincides
with pinning for the default sentinel placement. An element that *unpins* at
the end of its containing block (pushed away by the scroll) keeps the class
until its sentinel scrolls back in — by then it is off-screen anyway.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it
is used only to warn on a non-element node, a missing/misplaced sentinel or
root, or an invalid `data-sticky-sentinel` / `data-sticky-root` selector.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
