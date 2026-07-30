# siteSearch

Site search that expands out of a toggle — and an ordinary, working search form in the page without JavaScript.

## Files needed to copy
- `siteSearch.html` – markup
- `siteSearch.scss` – styles (source; compiled to `dist/css/siteSearch.min.css`)
- `siteSearch.js` – behavior

No shared JS utility is bundled into this module; `siteSearch.js` stands on its own.

## Usage
Author the complete search where it belongs in the page — inside the site header — as a `<search>` landmark holding a toggle and the form it expands:

```html
<search class="m-siteSearch" data-js-module="siteSearch">

  <button class="m-siteSearch__toggle" type="button" data-sitesearch-toggle>
    …magnifier…<span class="m-siteSearch__toggleLabel">Search</span>
  </button>

  <form class="m-siteSearch__form" action="/search" method="get" data-sitesearch-form>
    <div class="m-siteSearch__field">
      <label class="m-siteSearch__label" for="siteSearch-input">Search this site</label>
      <input class="m-siteSearch__input" type="search" id="siteSearch-input"
             name="q" placeholder="Search…" data-sitesearch-input>
      <button class="m-siteSearch__submit" type="submit">Search</button>
    </div>
  </form>

</search>
```

- **`data-sitesearch-toggle`** marks the control that expands the field. A real `<button type="button">`; it needs no `id` and no ARIA of its own — the module adds `aria-expanded` and `aria-controls`.
- **`data-sitesearch-form`** marks the search form, and **it must be the toggle's next element sibling.** The stylesheet reaches the collapsed field from the toggle's `aria-expanded` through the adjacent-sibling combinator, so nothing may come between the two. Markup that breaks the contract is reported and left completely alone — which leaves a working search form in the page.
- **`data-sitesearch-input`** marks the field: what the module focuses on open, and what it reads to tell an empty search from a typed one. Without it the field still expands, just without taking the focus; the module reports that.
- **The `<label for>`** names the field. A placeholder is not a name — it is gone as soon as anything is typed — so a field without one is reported.
- **`m-siteSearch__field`** is not decoration. It keeps the control at full width while the form around it grows, so the search bar is revealed in one piece instead of being squeezed into shape. Keep it if you restyle.

### The `<search>` element
The root is the native search landmark, because that is what the platform already has for exactly this. An engine from before autumn 2023 does not know the element and exposes it as generic; if you need the landmark there, add `role="search"` — it is allowed on `<search>`, being the role the element already implies. The alternative (a `<div>` root plus `<form role="search">`) works everywhere, at the price of leaving the toggle outside the landmark it belongs to.

### Options
All optional. On the root:

| Attribute | Effect |
| --------- | ------ |
| `data-sitesearch-side="start"` | The field unrolls towards the inline-**start** of the toggle instead of the inline-end — the layout a header wants when the toggle sits at its far end. Style only; the script never reads it, and it mirrors on its own in a right-to-left writing direction. |

Colors, spacing, sizing and animation are `--siteSearch-*` custom properties on the `.m-siteSearch` root, declared together at the top of `siteSearch.scss` — override them there, in your own CSS or inline on the element.

**The expanded field takes real space in the header.** That is the point of an inline expander rather than a popover: the search bar is part of the bar, not a surface floating over it. Anchor the component where you want that space to come from — `margin-inline-start: auto` in a flex header puts it at the end, and the field then grows into the header rather than pushing the header along.

**Let that header wrap.** `flex-wrap: wrap` on it is the second line a consuming project has to write, and it is not cosmetic. The component keeps the room the expanded field needs — nothing squeezes the field away while it is out — so where the header line has less room than that, the search has to be able to drop onto its own line. Without the wrap the header is pushed wider for as long as the field is out, and where an ancestor is free to grow with it, that reaches the page and leaves it scrollable sideways (253px at a 320px viewport, measured on the demo header before the wrap was added). The other half of the guarantee is the size cap: `--siteSearch-inline-size` is a `min(18rem, 60vw)`, so the component never asks for more than the viewport has, and on its own line the field always fits.

**Why the component no longer gives way instead.** It used to: a floor of `min-inline-size: var(--siteSearch-toggle-size)` on the root let a tight header squeeze the whole component down to the toggle, and the rigid field inside the clipping form was clipped a little further. That kept the page from scrolling, but it paid for it with the field: measured on the demo header, below about 520px viewport the search bar was a few pixels wide, and below 400px pressing the toggle did **nothing visible at all** — while `aria-expanded` said `true` and the focus sat in a zero-width input. A control with no perceivable effect and an invisible focus is the worse failure of the two (WCAG 1.4.10 *Reflow*, 2.4.7 *Focus Visible*), so the floor is gone. It is not replaced by a second declaration: the `min-inline-size: auto` every flex item starts with is already state-dependent here, because the automatic minimum is derived from the form's own inline size — collapsed that size is `0`, so the minimum is the toggle alone and a tight header may still squeeze the collapsed component down to it; expanded it is the whole field. Measured: 36px closed, 332px open, at every viewport.

`min-inline-size: 0` on the form stays, as a safety valve rather than the normal path: where a project *hard*-limits the component (a `max-inline-size` on the root, a fixed grid track), it lets the form give way and clip instead of overflowing its box. If that is your header, cap `--siteSearch-inline-size` for it rather than shipping a field that is clipped at every width.

## Two renderings
The same markup is rendered two ways, and the boundary between them is the point of the component:

- **In the flow.** The search form is simply in the page: visible, focusable, submittable, a plain GET to your search page. That is what everyone gets **without JavaScript** and for the moment before the lazily loaded chunk arrives — and it is the layout a wide header with room for a search bar would want anyway. The toggle is hidden here, because a control that folds a field away does nothing until the script that operates it exists (and would fold it away for good if that script never arrived).
- **Collapsed.** Once the module has written `aria-expanded` on the toggle, the form is a zero-width clipped box and the toggle is revealed. Pressing it unrolls the field back out.

Both halves of the second rendering hang off `data-sitesearch-ready`, which the module sets only once the field can actually be expanded again — so "the field is collapsed" and "there is a control that brings it back" always arrive together.

**The fold on load does not animate, and that is deliberate.** The field is in the page until the module collapses it, so writing the collapsed state and the ready flag in one go would leave the browser a single style change to look at — wide, no transition → narrow, with a transition — and every page load would open with the search bar folding itself away. The module writes the collapsed state, forces a style flush, and only then flags itself ready: the first fold is instant, and only the ones a reader actually causes animate.

**The flash before the module loads.** Because the form is in the page until then, the expanded search bar is briefly visible — measured on the demo page, the field folds away about 110 ms after navigation starts on a local server and about 790 ms on a throttled *Fast 3G* connection. It is most obvious right after a search is submitted, since the form is a plain GET and the result page starts over with the same flash. `offCanvasNav` makes the identical trade for the same reason. A project that prefers no flash — at the price of no search at all if the script fails to load — can hide it while scripting is available:

```css
@media (scripting: enabled) {
  .m-siteSearch:not([data-sitesearch-ready]) .m-siteSearch__form { display: none; }
}
```

## What the platform does, and what the module adds
`<search>` is the landmark, `<form>` builds the query string and does the navigating, `<input type="search">` brings the search key on a mobile keyboard and a clear button in Chromium and WebKit, `<label for>` names the field. The expansion itself is a **pure CSS transition in both directions** — the element is rendered the whole time, only its inline size changes, so there is no top layer, no `@starting-style` and nothing to time from script. None of that is reimplemented. The module adds five things:

1. **The disclosure.** `aria-expanded` on the toggle is the single source of truth *and* the styling hook — no state class, no second source of truth, no inline style. It is also why the form has to be the toggle's next element sibling: the stylesheet pairs them with the adjacent-sibling combinator, which — unlike `:has()` — is supported everywhere, so a field can never be left standing open next to a toggle claiming it is collapsed. (`dropdownNav` pairs its panels the same way, for the same reason.)
2. **The focus into the field on open.** Expanding a search field and leaving the caret behind would make every visitor click twice. It needs a style flush to happen at all: the collapsed field is `visibility: hidden`, an element that is not visible cannot take the focus, and `focus()` on one quietly does nothing — so the browser is made to act on the state change before the caret is placed.
3. **Explicit dismissal:** pressing the toggle again, and <kbd>Esc</kbd> while the focus is inside the component. Both close the field and hand the focus back to the toggle. <kbd>Esc</kbd> is only consumed where it belongs — with the focus elsewhere the field stays as it is and the key press stays available to whatever the reader is actually in, a dialog or a menu (the rule `dropdownNav` follows).
4. **Incidental dismissal:** a press outside the component, or the focus leaving it, closes the field — **but only while it is empty**. Nobody asked for it to close there; it is just no longer where the reader is. So a half-typed query is left standing rather than hidden behind a toggle that gives no hint it is still holding one. Nothing is lost either way: the value survives the collapse and comes back with the field.
5. **Where the focus goes.** A collapsed form is `visibility: hidden`, so a focus still inside it would be dropped on `<body>` and the next <kbd>Tab</kbd> would start over at the top of the page. It is moved to the toggle first, in every path that closes.

## Accessibility
- **The ARIA APG disclosure pattern**: a real `<button>` carrying `aria-expanded` and `aria-controls`, and a region that is genuinely hidden when collapsed. `visibility: hidden` takes the field out of the tab order *and* out of the accessibility tree, and unlike `display: none` it transitions — going to hidden it flips at the *end* of the collapse, so the field animates shut instead of vanishing halfway through.
- **The toggle keeps the same accessible name in both states.** `aria-expanded` is what tells the state; renaming the control to "Close search" when it opens would take away the name a voice-control user just spoke, and the APG asks for the state, not a second label. For the same reason the glyph stays a magnifier rather than morphing into a cross: the visible affordance and the name would otherwise say different things.
- **The field is named by a real `<label>`**, hidden visually only — never by the placeholder, which disappears as soon as anything is typed and is not exposed as a name by every engine. A field without a name is reported rather than silently shipped. The toggle's own name is a visually hidden text node for the same reason a `<label>` is: it still reads if the stylesheet never arrives, which an `aria-label` would not.
- **A nameless toggle is reported too**, and it is the more fragile of the two names: the magnifier inside the button is `aria-hidden`, so that text node is the button's *whole* accessible name, and it names the only control the reader is left with once the field is folded away. Dropping the `<span>` while restyling is the easiest mistake in this component, and a button with nothing left is announced as nothing at all.
- **<kbd>Esc</kbd> is consumed while the field is open**, so the native clear-on-<kbd>Esc</kbd> of an `<input type="search">` does not fire there. That is the deliberate end of the trade: <kbd>Esc</kbd>'s job in a disclosure is to close it, the query survives the collapse instead of being thrown away, and the type's own clear button (Chromium, WebKit) still clears the field.
- **An <kbd>Esc</kbd> that belongs to an IME composition is not taken.** For CJK input <kbd>Esc</kbd> is how a candidate list is cancelled, so consuming it would fold the field away mid-word and drop the focus back onto the toggle. `event.isComposing` is what tells the two apart (`dateInputFormat` guards its own input the same way); during a composition the field stays open and keeps what is being typed.
- **The controls inside the form draw their focus ring inset** (`--siteSearch-ring-offset`, derived from `--outlineOffset`). The form is a clipping box by necessity — that is how the field is revealed — so an outset ring would be cut away at its edges. `adaptiveScrollFade` makes the same trade for its mask. The toggle sits outside the clip and keeps the normal outset ring.
- **The field is never squeezed down to nothing.** A toggle whose `aria-expanded` says `true` always has a field to show, at every viewport down to 320px, and the focus it places lands somewhere visible — which is why the component keeps its room and asks the header to wrap rather than clipping itself away (see *Let that header wrap* above). The size cap `min(18rem, 60vw)` is what makes that promise keepable: the field follows the viewport down instead of demanding a fixed 18rem — 209px of visible input at 1280px, 113px at 320px.
- **The expansion respects `prefers-reduced-motion`**, in both directions.
- Two names in one component ("Search" on the toggle, "Search" on the submit) are deliberate: they are two controls that genuinely do the same thing at two stages, and each is unambiguous where it stands — the toggle is announced as a collapsed disclosure, the submit as a button inside a named search field.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on demand by `boot.js` for every element carrying `data-js-module="siteSearch"` — one instance per search — and reports (without enhancing) if it is put on a non-element node. It sets no inline styles. What it writes is `data-sitesearch-ready` on the root, `aria-expanded` and `aria-controls` on the toggle, and an `id` on the form if it had none.

`init` returns a cleanup function (see `destroyModulesInScope()` in `boot.js`) for hosts that mount/unmount the same subtree repeatedly. It removes the document listeners and takes every attribute above back off — which hands the markup back exactly as it was authored, including the expanded search form: without `aria-expanded` the collapse rule stops matching, so the field is in the page again, in precisely the state a visitor without this module gets.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is only used for warnings (initialized on a non-element node, missing toggle or form, form not the toggle's next sibling, toggle without an accessible name, no input, field id used more than once, field without an accessible name). Without it the module degrades silently.

**Page-wide id uniqueness.** The `<label for>` ties the label to the field by id, and that id is resolved document-wide with the first match winning — so a second copy of the snippet leaves its own field nameless while its label points at the first one. On a page built from repeatable CMS content, give every instance's ids a unique suffix (see the note in the project readme). The module reports the duplicate, and reports it as such rather than as a missing label; the pairing itself has to hold without JavaScript, so the markup is where it is fixed. The name check behind it reads `input.labels` — the association the browser actually resolved — so a label pointing at a different field of the same id cannot be mistaken for a name.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`). It shows the default (the field unrolling towards the inline-end), the `data-sitesearch-side="start"` variant in a header bar anchored the way a real site header is, and the unenhanced base layer that everyone gets before the module has loaded.
