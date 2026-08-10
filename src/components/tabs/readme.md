# tabs

An accessible tabs widget (ARIA APG pattern), built as a progressive
enhancement on an anchor-link table of contents. Without JavaScript the markup
is a jump-link list above normal, stacked content sections; the script assigns
all roles and ARIA at runtime, hides the inactive panels and adds
roving-tabindex keyboard support.

## Files needed to copy
- `tabs.html` – markup
- `tabs.scss` – styles (source; compiled to `dist/css/tabs.min.css` — no design
  by design, but not empty: it carries the pre-enhancement state, see *Styling*)
- `tabs.js` – behavior

- `_shared/js/focusableSelector.js`, `_shared/js/decodeFragment.js` – utilities
  imported by the behavior (copy them alongside `tabs.js`)

There is **no vendor dependency**.

## Usage
Put `data-js-behavior="tabs"` on a wrapper containing:

- a list with `data-tabs-list` (give it an `aria-label`) of in-page anchor
  links with `data-tabs-tab` and `href="#<panel id>"`, and
- one content section per link with `data-tabs-panel` and the matching `id`.

The `href` fragment **is** the wiring — no extra pairing attribute. A tab
whose target id does not exist is left as a plain link and reported; a panel
no tab points to is reported as orphaned; a second tab pointing to an
already-paired panel is ignored and reported as a duplicate.

```html
<div data-js-behavior="tabs">
  <ul aria-label="Example tabs" data-tabs-list>
    <li><a href="#panel-a" data-tabs-tab>First</a></li>
    <li><a href="#panel-b" data-tabs-tab>Second</a></li>
  </ul>
  <section id="panel-a" data-tabs-panel>…</section>
  <section id="panel-b" data-tabs-panel>…</section>
</div>
```

### Options (all optional; on the `data-js-behavior` element)

| Attribute | Effect |
|---|---|
| `data-tabs-manual` | **manual activation**: arrow keys only move focus, selection happens on <kbd>Enter</kbd>/<kbd>Space</kbd> (default is automatic — focus selects) |
| `data-tabs-orientation="vertical"` | sets `aria-orientation="vertical"` and switches the arrow keys to <kbd>↑</kbd>/<kbd>↓</kbd> |
| `data-tabs-deeplink` | mirror the selected tab into the URL fragment via `history.replaceState` (no history entries pile up) |

### Deep linking
A URL fragment matching a panel id selects that tab on load and on
`hashchange`; any other hash is ignored, so skip links and other anchors on
the page cannot clash.

A fragment naming something **inside** a panel selects that panel as well — a
heading, or another component's region. The browser scrolls to the target
either way, so the panel holding it has to come along; otherwise the reader is
taken to an element that is still out of the flow, with nothing on screen to
say so. That is what makes a panel safe to fill with anchored content: a
`readMore` gives its text region an `id` precisely so a link can point at it,
and a page can carry both without the two fragments fighting. The
pre-enhancement rule below exempts the same two cases, so it holds before the
module has loaded too.

The fragment the reader arrived with is never rewritten — `data-tabs-deeplink`
writes one only when the *reader* switches tabs — so a component further in
still sees its own `:target`.

Fragments are independent of path and query string, so
deep links work with any URL scheme (query parameters, rewritten/pretty
URLs) and are never sent to the server. Leave `data-tabs-deeplink` off on
pages whose hash is owned by something else (e.g. a hash-based SPA router) —
*reading* the hash stays harmless there, since a router hash never matches a
panel id.

## Accessibility
- **Progressive enhancement:** without JavaScript the links jump to their
  visible sections, and no ARIA promises tab behaviour that does not exist —
  every role is assigned at runtime.
- **APG tabs pattern:** `role="tablist"` / `"tab"` / `"tabpanel"`,
  `aria-selected` on the active tab, `aria-controls` on each tab, each panel
  labelled by its tab via `aria-labelledby`; wrapping `<li>`s become
  presentational.
- **Keyboard:** roving tabindex; arrow keys move between tabs with
  wrap-around (axis follows the orientation), <kbd>Home</kbd>/<kbd>End</kbd>
  jump to the ends. Automatic activation by default (APG recommendation for
  instantly displayable panels), manual with `data-tabs-manual`.
- **Reachable panels:** a panel without focusable content gets
  `tabindex="0"` so keyboard users can reach and scroll it.
- **Named tablist:** a list without `aria-label`/`aria-labelledby` is
  reported rather than silently shipped unnamed.

## Styling
The component ships **no design** — it is behaviour-only, and every visual
(including the focus ring) belongs to the consuming project. The styling hooks
are the ARIA attributes the JS maintains; no state class is written:

```css
[data-tabs-tab][aria-selected='true'] { /* active tab */ }
/* inactive panels get `hidden` — display:none comes free */
```

`demo.html` shows one complete example design (horizontal and vertical).

The stylesheet is not empty, though. It ships the **pre-enhancement state**:
where scripting is enabled, the panels are collapsed to one before the module
has loaded, so the page does not paint every panel stacked and then snap to a
single one a round trip later. The rule lifts the moment the module sets
`data-tabs-ready` on the wrapper. It cannot be left to the project, because it
has to be in force before any script runs — and it is safe to ship because a
panel the URL fragment names, or contains the target of, is exempt
(`:target` / `:has(:target)`), so the jump-link list above still reaches every
panel if the chunk never arrives. An engine that does not know `:has()` drops
those selectors whole and lands on the plain stacked document, which is the
same place a missing chunk lands the reader — nothing becomes unreachable
either way. See
[`docs/preEnhancement.md`](../../../docs/preEnhancement.md).

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying `data-js-behavior="tabs"` —
one widget instance per wrapper; multiple instances per page work
independently (panel ids are document-unique). It sets no inline styles.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it
is only used to warn about author mistakes (missing list, missing/orphaned
panels, a tab without a decodable in-page `href`, a duplicate tab for an
already-paired panel, an unnamed tablist). Without it the module degrades
silently.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
