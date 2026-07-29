# backToTop

A control that jumps back to the top of a long page and only shows itself once
the reader has scrolled far enough for it to be useful. The control is an
ordinary in-page anchor link and stays the module element: while the page is
scrolled less than the threshold it carries the attribute
`data-backtotop-hidden`, which the stylesheet hides it by. Detection uses a
zero-size sentinel the script prepends to `<body>`, watched by one
`IntersectionObserver`.

This solves what CSS cannot: the jump is native anchor behaviour and needs no
script at all, but "appear once the reader has left the first screen" has no
widely supported CSS form — scroll-driven animations come close, support is
still uneven — and the usual answer is a scroll listener measuring the scroll
offset on every frame. That single bit of information is the whole
enhancement.

## Files needed to copy
- `backToTop.html` – markup
- `backToTop.scss` – styles (source; compiled to `dist/css/backToTop.min.css`)
- `backToTop.js` – behavior
- `_shared/js/debounce.js` – bundled into the component's chunk by the build;
  copy it along when pasting the JS into a plain project

## Usage
Put `data-js-module="backToTop"` on the control and place it at the **end** of
the page. It is fixed-positioned, so its position in the markup only decides
the reading and tab order — and "back to top" belongs last. The end of your
`<footer>` is a good spot: it keeps the control inside a landmark, which a
direct child of `<body>` is not (axe's best-practice `region` rule reports
content outside landmarks; wrapping it in the footer or a labelled `<nav>`
answers that).

One hard constraint on the placement: no ancestor may establish a containing
block for fixed positioning. `transform`, `filter`, `backdrop-filter`,
`will-change`, `contain: paint` and friends all do, and the control would then
be anchored to *that* element's box and scroll away with the page instead of
staying in the viewport corner. When in doubt, keep it a direct child of
`<body>`.

The control must be an `<a>` with an in-page `href`:

- `href="#top"` scrolls to the top of the document without needing any target
  element — the HTML spec resolves the fragments `top` and `` (empty) to the
  document top itself.
- `href="#<id>"` pointing at an element at the top of the page is the better
  choice for keyboard users: a fragment that *resolves* also becomes the
  sequential focus navigation starting point, so the next <kbd>Tab</kbd>
  continues at the top of the page instead of at the control. Point it at
  whatever the top of your page is — the skip-link target, the site header,
  the `<h1>`'s wrapper. No `tabindex` needed. Note that the browser scrolls
  that *element* to the top of the viewport, so put the id on something at
  the very start of the page — or give the target a
  `scroll-margin-block-start` matching whatever sits above it, if the jump
  should land at scroll position `0` exactly.

Anything else is reported and left unenhanced: a `<button>` or a
cross-document link could not work without JavaScript, and a fragment that
resolves to nothing scrolls nowhere.

The label carries the accessible name; the icon is decorative
(`aria-hidden="true"` + `focusable="false"`). Add `m-backToTop--iconOnly` to
hide the label *visually* while keeping that name.

Below 575px the stylesheet does that collapse on its own, for a reflow reason
rather than a stylistic one: the control cannot be dismissed, so whatever width
it takes is width the reader never gets back. The labelled pill is roughly
139px wide in English and 235px with a longer translation ("Zurück zum
Seitenanfang") — in the 320px viewport a 400% zoom produces on a 1280px screen
that is 43% to 73% of every line it covers, permanently. The glyph carries the
meaning and the accessible name survives, so re-show the label below that
breakpoint only if yours is short enough to afford the room.

Smooth scrolling is the consuming project's CSS, not the module's — and it
belongs behind a reduced-motion check:

```css
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
```

One more page-level property belongs with it, and this one is not optional:

```css
html {
  /* control height + its inset; grow it if you restyle either */
  scroll-padding-block-end: calc(var(--backToTop-inset, 24px) + 3.5rem);
}
```

The control is fixed, and a browser scrolls a focused element into view with the
*minimum* amount needed — which parks it flush against the bottom edge of the
viewport, overlapping the band the control occupies. Measured in an 800px
viewport at the default inset: the focused element ends at y 800 while the
control spans y 740–776, so its upper strip sits behind the control. With the
reservation it lands at y 688–720 instead, clear of the control entirely.

Worth being exact about what that buys, because the two focus criteria behave
differently here:

- It removes the **partial** coverage — a **WCAG 2.4.12 (Focus Not Obscured,
  Enhanced, AAA)** matter, and plainly better for anyone tracking the focus
  ring.
- It is *not* what keeps you on the right side of **2.4.11 (Minimum, AA)**,
  which fails only when the focused element is covered *entirely*. An element
  the browser parks flush against the bottom edge always pokes into the gap the
  inset leaves below the control, so the scrolled case is safe either way.
- 2.4.11 fails in the case the padding cannot reach: an element that is
  **already** visible inside the band when it receives focus. No scrolling
  happens, so no scroll padding applies. Nothing in CSS fixes that one — keep
  interactive content out of the corner the control occupies, or move the
  control (`--backToTop-inset`, or a different corner).

The component does not write the padding for you, for the same reason it does
not write `scroll-behavior`: it would silently overwrite whatever your sticky
header already put there.

One instance per page is the norm. Several can coexist — each owns its
sentinel and its observer — but they would all be fixed to the same corner
unless you move them.

The module is **page-level by design**: the sentinel lives in the page content
and the anchor jump scrolls the document, so a "back to top" for an inner
`overflow: auto` container is out of scope (it could not work unenhanced
either, which is where this component starts). A page too short to scroll past
the threshold never shows the control at all — there is nothing to come back
from.

### Configuration (optional, attribute on the control)
- `data-backtotop-threshold` – px the page must be scrolled before the control
  appears. Default: **one viewport height** ("the reader has left the first
  screen"), re-measured on resize. `0` shows the control as soon as the page
  is scrolled at all.
- `--backToTop-inset`, `--backToTop-padding`, `--backToTop-gap`,
  `--backToTop-radius`, `--backToTop-icon-size`, `--backToTop-text-color`,
  `--backToTop-bg-color`, `--backToTop-bg-color-hover`,
  `--backToTop-border-color`, `--backToTop-border-color-hover`,
  `--backToTop-shadow`, `--backToTop-duration`, `--backToTop-ease`,
  `--backToTop-enter-shift` (CSS custom properties) – tune
  the default look. Set them in your CSS or inline:
  `style="--backToTop-inset: var(--space-l)"`.

See `backToTop.html` for a ready-to-copy snippet.

### Starting hidden (opt-in)
Progressive enhancement cuts both ways here: because the hidden state is
something the *script* adds, the control is visible for the moment between
first paint and the lazily loaded module taking over. If you prefer no flash
over a control that survives a broken script, start it hidden wherever
scripting is on:

```css
@media (scripting: enabled) {
  .m-backToTop:not([data-backtotop-ready]) {
    opacity: 0;
    visibility: hidden;
  }
}
```

`data-backtotop-ready` is the second attribute the module writes, and unlike
`data-backtotop-hidden` it is not a state: it is set once, together with the
first state write, and only says *the module has taken over*. That indirection
is necessary — the absence of `data-backtotop-hidden` means **both** "scrolled
far enough, show it" and "not initialised yet", so a rule keyed off it would
hide the control exactly when it should appear.

With this in place a script that never runs (a JS error, `boot.min.js` not
loaded) leaves the control invisible — which is the trade-off you are making.

## Accessibility
The control is a real link with a real accessible name, so it is reachable and
operable without any ARIA — and none is added. "Scrolled far enough" is a
purely visual fact: no ARIA state, no live region, no announcement while
scrolling. The injected sentinel is empty and `aria-hidden`.

Two details in the stylesheet carry the accessibility of the hidden state, so
keep them if you restyle:

- Hiding uses **`visibility: hidden`**, not `opacity` alone, so the hidden
  control leaves the tab order and the accessibility tree. Hiding it with
  opacity would leave an invisible tab stop at the top of every page.
  (`visibility` is transitionable and stays `visible` for the whole duration
  when either end of the transition is, so the fade still plays out.)
- The hidden state excludes **`:focus-visible`**, so a control that still
  holds keyboard focus is never hidden away under the user. Which `href`
  form you pick decides when that matters: with `href="#top"` activated *by
  keyboard* the focus stays on the control (the document top is no element
  that could take it), so the exception keeps it on screen until
  <kbd>Tab</kbd> moves on; with a resolving fragment the browser takes focus
  off the link and hands the sequential focus navigation starting point to
  the target, so the next <kbd>Tab</kbd> continues at the top of the page and
  the control simply fades out. Scrolling up by other means while the control
  has focus (the <kbd>Home</kbd> key, for instance) is covered too.

After a **mouse** click the exception does not apply, because `:focus-visible`
never became true: the control is hidden while it still holds DOM focus, and
the browser drops that focus to the document. That is deliberate rather than
overlooked. Nothing visible loses its focus ring, so no success criterion is
touched — and both fixes are worse than the behaviour. Keying the exception off
`:focus` would park the control on screen after every click, which is the one
thing the component exists to avoid; blurring it from a click handler would add
behaviour to a module whose entire premise is that it adds none, to reach the
state the browser arrives at by itself. The recommended resolving-fragment
`href` avoids the situation altogether by moving focus off the link.

The default look is a pill with icon and label, comfortably above the 24 × 24
px minimum of WCAG 2.5.8 (Target Size) at 36 × ~139 px, and 43 × 43 px in the
icon-only form. If you shrink it, keep that floor.

The border defaults are mixed to clear the 3:1 of **WCAG 1.4.11 (Non-text
Contrast)** against *both* neighbours — 4.23:1 against the page background and
3.10:1 against the control's own fill, hover 6.53:1 / 4.79:1. This is the one
component that does not map its border to the shared `--color-border` (12%
white, 1.99:1 against the page background): everything else sits on a known
surface, while this one floats over whatever the page scrolls past, so its
outline is all that separates it from that content. Keep the ratios if you
retune `--backToTop-border-color`.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying
`data-js-module="backToTop"`, and it returns a cleanup function that
`destroyModulesInScope()` calls: the observer and the resize listener are
dropped, the sentinel — which lives in `document.body`, outside the module's
own subtree — is removed, and both attributes are cleared so a later `init()`
starts from the no-JS baseline again. A resize that was still waiting out its
debounce when the teardown ran is discarded rather than rebuilding an observer
onto the removed sentinel.

The script sets **no inline styles** and runs no animations. It only toggles
two attributes on the control — `data-backtotop-hidden`, the state (a
namespaced data attribute rather than a generic `is-hidden` class, which
projects often ship as a `display: none` utility that would win over the
transition), and `data-backtotop-ready`, written with the first state write to
mark that the module is live (see *Starting hidden* above; the shipped
stylesheet ignores it). The visuals — including the transition, which honours
`prefers-reduced-motion` — live in the SCSS. Without JavaScript neither
attribute is added and the control stays what the markup already is: a plain,
always visible jump link.

The stylesheet drops the control in `@media print`. It is `position: fixed` and
permanently on screen, so on paper it would otherwise be printed over the
content — on the first sheet in Chromium, on every sheet in engines that repeat
fixed elements — and a jump link means nothing there.

There is no scroll listener and no per-frame measuring. One
`IntersectionObserver` watches a zero-size sentinel inside a region as tall as
the threshold: while the sentinel is inside it, the page is scrolled less than
the threshold. The browser reports only the two moments the sentinel crosses
that edge, every write is idempotent, and the observer fires once right after
observing so a page restored mid-scroll starts in the correct state. Instant
jumps (the <kbd>Home</kbd> key, another anchor link) are edge crossings too,
so nothing goes stale. The threshold is baked into the observed region, so the
observer is rebuilt once per debounced `resize` — but only when the resolved
threshold actually changed. On engines without `IntersectionObserver` no
sentinel is injected and the attribute is never written.

The sentinel is `<body>`'s **first child**, and the shipped rule
(`[data-backtotop-sentinel]`) takes it out of the flow so it cannot occupy a
flex/grid slot or shift a centred layout. Unlike the rest of the stylesheet
that rule is not decoration — keep it. A `body > *:first-child` rule of your
own will hit the sentinel.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it
is used only to warn on a non-element node, a control that is not an in-page
anchor link, or an `href` fragment that cannot resolve.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
