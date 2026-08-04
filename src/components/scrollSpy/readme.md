# scrollSpy

Highlights the link of the section currently being read in an in-page
anchor-link table of contents. Without JavaScript the markup is a plain
jump-link TOC; the script marks exactly one link with
`aria-current="location"` while the page (or a scroll container) scrolls —
IntersectionObserver-driven, with no scroll listener and nothing measured
per frame.

## Files needed to copy
- `scrollSpy.html` – markup
- `scrollSpy.scss` – styles (source; compiled to `dist/css/scrollSpy.min.css`
  — an empty stub by design, see *Styling*)
- `scrollSpy.js` – behavior
- `_shared/js/debounce.js`, `_shared/js/decodeFragment.js`,
  `_shared/js/parseNonNegative.js` – utilities (direct imports; copy them next
  to the module when pasting into a plain project)

There is **no vendor dependency**.

## Usage
Put `data-js-behavior="scrollSpy"` on the table of contents (a `<nav>` with an
`aria-label` is the natural fit). Every in-page anchor link inside it
(`href="#<target id>"`) becomes a spy link; the sections it points to need
nothing but their `id` (the `tabindex="-1"` in the snippet is a focus
nicety, not wiring — see *Accessibility*). The `href` fragment **is** the
wiring — no extra pairing attribute, and the TOC may live anywhere on the
page (sticky sidebar, header, …).

```html
<nav aria-label="On this page" data-js-behavior="scrollSpy">
  <ul>
    <li><a href="#introduction">Introduction</a></li>
    <li><a href="#usage">Usage</a></li>
  </ul>
</nav>

<section id="introduction" tabindex="-1">…</section>
<section id="usage" tabindex="-1">…</section>
```

A link whose target id does not exist (or whose fragment is not decodable)
is left as a plain link and reported; a second link pointing to an
already-paired target is ignored and reported as a duplicate.

### How "current" is decided
Current is the **last target in document order whose top edge has passed the
spy line** — a horizontal line a fixed distance below the top edge of the
viewport (or of the `data-spy-root` container). Above the first section no
link is current. Two refinements handle the edges:

- **The line follows your CSS.** Its distance is read from the first
  target's computed `scroll-margin-top` — the same value the browser uses to
  land anchor jumps (e.g. below a sticky header) — so a clicked link always
  highlights its own section. Keep the targets' scroll margins uniform;
  `data-spy-offset` overrides the value where the CSS is unusable.
- **The end rule.** A short final section at the very end of the content can
  never reach the line, so the module appends a zero-size, `aria-hidden`
  sentinel at the end of the scroll content (the `<body>`, or the
  `data-spy-root` element) and observes it: once the page (or container) is
  scrolled to its very end, the last link is current. The signal only counts
  while the root actually has vertical scroll room — content that fits the
  root entirely has no end to reach, so the line rule stays in charge
  instead of marking the last link unprompted. Note that the sentinel is
  appended **once, at init**: content appended to the page later (lazy
  lists, AJAX) lands after it, and the end signal then fires before the true
  end — the end rule assumes the content below the last section is complete
  when the module boots.

### The tail blind spot
One property is shared by every line-based spy and worth planning for: a
section becomes current only once its top edge reaches the line, and that
takes roughly one root-height of content **below** that top edge. On tall
viewports, late sections followed by too little content are therefore
skipped — the scroll range ends before their turn — and the end rule rescues
only the very last one. Two levers control this:

- **Tail room.** Enough content (or padding) below the last sections keeps
  every entry reachable.
- **A larger `data-spy-offset`.** Moving the line down shrinks the blind
  zone. Anchor-jump consistency survives any offset that is at least the
  targets' scroll margin — as long as the sections are taller than the
  difference between the two values.

Anchor navigation stays native — the module never intercepts clicks. Smooth
scrolling belongs to the consuming project
(`scroll-behavior: smooth` behind a `prefers-reduced-motion` check).

### Options (all optional; on the `data-js-behavior` element)

| Attribute | Effect |
|---|---|
| `data-spy-offset="96"` | px distance of the spy line from the root's top edge (default: the first target's computed `scroll-margin-top`, else `0`) |
| `data-spy-root="#box"` | CSS selector for the `overflow: auto/scroll` container the target sections scroll in (default: the viewport). Every target must sit inside it; the TOC itself may live anywhere |

## Accessibility
- **Progressive enhancement:** without JavaScript the links jump to their
  sections and no highlight exists — honestly so, since a marker that could
  not update would mislead.
- **`aria-current="location"`** is real "you are here" information, so the
  marker is exposed to assistive technology instead of hidden in a styling
  class. It is not a live region: scrolling never causes announcements; the
  state is simply there when a link is examined.
- The module adds **no roles and no focus behaviour**; the links stay plain
  links. Give the TOC an accessible name in the markup (`aria-label` on the
  `<nav>`).
- **Give the target sections `tabindex="-1"`** (as in the usage snippet).
  Activating an anchor link makes the browser move focus to the target —
  but a plain `<section>` is not focusable, so focus is dropped on `<body>`
  and the next Tab continues invisibly *behind* the section. With
  `tabindex="-1"` the activated section itself receives focus: predictable,
  announced by assistive technology, and Tab continues from the content the
  reader just navigated to.
- Motion is never produced by the script; smooth anchor scrolling is project
  CSS and must honour `prefers-reduced-motion`.

## Styling
The component ships an **empty stub stylesheet** — it is behaviour-only, and
every visual (including the focus ring) belongs to the consuming project.
The styling hook is the ARIA attribute the JS maintains; no state class is
written:

```css
a[aria-current='location'] { /* the current link */ }
li:has(> a[aria-current='location']) { /* its list item — e.g. for a
                                          parent trail in a nested TOC */ }
```

`demo.html` shows one complete example design (sticky sidebar TOC with a
nested list, plus a scroll-container instance).

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is
loaded on demand by `boot.js` for every element carrying
`data-js-behavior="scrollSpy"` — one instance per TOC; multiple instances per
page work independently (target ids are document-unique). It sets no inline
styles; beside the injected end sentinel its only DOM write is the
`aria-current` attribute.

Everything is IntersectionObserver-driven; the only other listener is a
debounced resize rebuild (the spy line's px geometry depends on the root's
height). Engines without IntersectionObserver stay unenhanced — the TOC
keeps working as plain jump links.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it
is only used to warn about author mistakes (no usable links, a link without a
decodable in-page `href`, a missing or duplicate target, a target outside the
`data-spy-root` element, a bad root selector). Without it the module degrades
silently.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
