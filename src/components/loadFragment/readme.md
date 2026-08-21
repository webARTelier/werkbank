# loadFragment

Loads one region of another page into a box in this one, from a link that
still works as a link. The module element is the **trigger** — a real
`<a href>` — `data-fragment-target` names the box the answer goes into, and
`data-fragment-select` names what is taken out of the answer. While a load
runs the box carries `data-fragment-state="loading"`; a failed one leaves
`data-fragment-state="error"` behind. Both states are also *said*, through a
polite `role="status"` region the module puts into the box.

This is the gap between a link and an `<iframe>`. A link replaces the whole
page; an iframe is a second document with its own stylesheet, its own
scrollbar and its own accessibility tree, in a box this page cannot lay out
from the inside. Putting *part* of another page into a box that is already
here is the thing HTML has no element for.

The link is the point, not a fallback bolted on afterwards: before the chunk
arrives, with JavaScript off, on a cross-origin href, on a middle click and
when the target is not in the document, the click does exactly what the markup
says — it opens that page. Which is why the default lane fetches a **real
page** and picks a region out of it, instead of asking the server for a
partial that would be broken to navigate to.

## Files needed to copy
- `loadFragment.html` – markup
- `loadFragment.scss` – styles (source; compiled to `dist/css/loadFragment.min.css`)
- `loadFragment.js` – behavior

One utility from `_shared/js/` rides along — `resolveLocale.js`, which picks
the built-in wording from `<html lang>`. The other collaborator besides the
reporter is the loader itself, and that arrives through `services` (see
*Integration*).

## Usage
Put `data-js-behavior="loadFragment"` on a link and name the box:

```html
<a href="/teasers/42"
   data-js-behavior="loadFragment"
   data-fragment-target="#detailPanel"
   data-fragment-select="main > *">Show the details</a>

<div id="detailPanel" class="c-fragment" aria-live="polite"></div>
```

On a plain left click the module fetches the href, resolves
`data-fragment-select` against the **answer** and inserts every match, in
document order — so the selector can name the wrapper to keep (`"#teaser-42"`)
or the children to unwrap (`"main > *"`). Left out, the whole body of the
answer is taken: the lane for an endpoint that already returns exactly the
fragment, and there you own the fallback, because that URL is not a page
anyone can land on.

**Into an overlay it is two attributes on one link**, and neither module knows
about the other:

```html
<a href="/teasers/42"
   data-js-behavior="loadFragment"
   data-open-dialog="detailDialog"
   data-fragment-target="#detailDialogBody"
   data-fragment-select="main > *">Open the details</a>
```

`dialog` opens the overlay from its own delegated listener, `loadFragment`
fills its body, both read the same anchor — and without JavaScript the link
still opens the page. The same pairing works for anything else that reveals a
box: a tab panel, a drawer, a detail row.

**Several links may fill one box** — a list of rows and one detail panel, two
tabs and one region. Which load owns a box is kept **with the box**, so the
last click wins: the running request is aborted and only the newest answer is
ever written. A box already showing this exact URL is not fetched again, which
makes reopening a dialog free; `data-fragment-refresh` on the link opts into
the round trip for content that can change between two clicks.

**The URL has to be same-origin.** A cross-origin href is not fetched at all —
the click is left to the browser, which navigates, and the foreign page stays
a foreign page. Markup adopted into this document would run under this
document's origin, and no selector makes that safe.

**Mind what the fragment brings with it.** Headings and landmarks come along
as they were written — a `<main>` or a second `<h1>` lifted into a dialog is a
document outline nobody can read. An **id** that this page already has is
reported: a duplicate one quietly breaks every label and `aria-*` reference
pointing at it, and it is what a selector chosen around a wrapper walks into
first. Relative URLs inside it resolve against
*this* page, not the page they came from; that is HTML and not this module, so
serve root-relative paths or give the source page a `<base>`. The **language**
is the one thing that does *not* stay behind: a page states it once on
`<html>`, so the elements taken out of a document in another language get that
`lang` written onto them — otherwise an English fragment is read out in German
by a German page. A bare text node cannot carry the attribute, which is one
more reason to select elements rather than the naked body of a
foreign-language answer. And the classes
it carries were written for the surface it came from: the demo lifts a
paragraph styled for the page background onto a dialog panel, where the same
muted colour measures 3.6:1 — the fix belongs to the surface it lands on, not
to the fragment.

The shipped stylesheet provides `c-fragment` as a convenience look on the
target: the content that is there dims, a ring turns over it, and a failed
load leaves an outline. It also carries a focus ring, for the one occasion the
script focuses the box itself (see *Accessibility*) — a box styled by hand
needs that one too. The script does not read the class — put your own on the
box and key it off `[data-fragment-state]` instead. The **link** carries
the same attribute while its own request runs, so a busy trigger is one rule
of yours: `a[data-fragment-state="loading"] { … }`.

### Configuration (attributes on the link)
- `data-fragment-target` – **required.** CSS selector for the box the answer
  goes into, resolved against the whole document and re-resolved on every
  click. A target that is not there is reported and the click navigates.
- `data-fragment-select` – CSS selector resolved against the answer; every
  match is inserted, in document order. Default: the whole body of the answer.
- `data-fragment-refresh` – presence only: fetch again on every click.
  Default: a box already showing this URL is left alone.
- `data-fragment-loading-text`, `data-fragment-error-text` – what the status
  region says. Default: the built-in sentence in the page's language (`de`,
  `en`, falling back to `en`). An **empty** value opts the announcement out,
  for a host that writes its own.
- `--fragment-busy-opacity`, `--fragment-spinner-size`,
  `--fragment-spinner-width`, `--fragment-spinner-color`,
  `--fragment-min-block-size`, `--fragment-error-color`,
  `--fragment-error-width`, `--fragment-error-offset`,
  `--fragment-status-gap`, `--fragment-duration`,
  `--fragment-ease`, `--fragment-spin-duration` (CSS custom properties) – tune
  the shipped look, in your CSS or inline on the box. `--fragment-busy-opacity`
  is a measured value, not a taste one: at `0.75` all three text tones of this
  theme clear 4.5:1 on the lightest surface here (10.71 / 7.63 / 4.53), and
  lowering it puts the muted tone under AA while the load runs. The numbers
  and the method are in the stylesheet.

**What it deliberately is not:** no history entry, no routing, no form
submission, no polling, no swap strategies. Those are a different component,
and mostly a different library. The request is a GET, so there is no CSRF
token to send either.

See `loadFragment.html` for a ready-to-copy snippet.

## Accessibility
**Both states are said, not only drawn.** The module puts one polite
`role="status"` region into the target — its only piece of own DOM, marked
`[data-fragment-status]` — and writes two sentences into it: that the content
is loading, and that it could not be loaded. A turning ring and an outline are
invisible to a screen reader, so without this a request that takes three
seconds is three seconds of silence after activating a link that normally
navigates, and a failed load is indistinguishable from a click that did
nothing.

The wording is built in for `de` and `en`, picked from `<html lang>` the way
every announcing component here picks it, and overridable per link
(`data-fragment-loading-text`, `data-fragment-error-text`); an empty value says
nothing at all. What failed — status code, network, an empty selection — stays
with the reporter: that is a sentence for a developer, not for a reader.

While the load runs the sentence is **spoken only** (the ring says the same
thing to whoever can see it, and a line of text appearing under the content
would move the page while it waits). When the load failed it is **shown as
well**, in the error colour: an outline is a state, not a message, and colour
is never what carries it.

**`aria-busy` is written around the exchange, not around the request** — from
the moment the box starts coming apart to the moment the new content has been
enhanced (`initModulesInScope()` imports the chunks of whatever arrived, so
that is the long part). Two things follow. A box with `aria-live="polite"`
announces the *result* once instead of narrating a half-filled region; and the
loading sentence, which is written before the request goes out, is not
swallowed by a region whose updates are being held back — which is what it
would be if `aria-busy` spanned the whole load. Give a box that is not an
overlay `aria-live="polite"`: the status region says that the load is running
and whether it failed, the live region is what announces the arrived
**content**. A box that is neither a live region nor inside an overlay is
reported.

A second click on a link whose content is already standing in the box fetches
nothing and announces nothing — there is no change to report, for anyone. It
does take back an error state that a *different* load left on the box in the
meantime, along with its sentence: what stands there is what was just asked
for, and it must not go on being dressed as a failure.

**The focus stays where it is, with one exception.** Where the fragment lands
in an overlay, the host has already placed it — a dialog moves focus in on
open, and a second jump would fight it. Where it lands in the page, a reader
who clicked *details* asked for content, not to be moved somewhere else.

The exception is that same argument read the other way round: if the focus
stood **inside** the box, replacing that box's content destroys the element
holding it, the focus drops to `<body>` and the tab order restarts at the top
of the page — the reader's place is taken away by doing nothing. That is not
exotic; it happens as soon as a loaded fragment contains a link that fills the
same box (a paginated list in a detail panel). So the focus goes to the target
instead, on a `tabindex="-1"` the module adds only if the project has not put
one there and gives back on the way out — the reader's `blur`, or `destroy()`
where a teardown finds nobody standing on the box. A teardown that *does* find
somebody leaves it: pulling a `tabindex` off a focused element would drop the
focus to `<body>`, which is the very loss this recovery is here to prevent. Such a box should
carry an accessible name — `role="region"` with `aria-label`, or
`aria-labelledby` pointing at its own heading — and the module reports it when
it does not. It should also **show** that focus: `c-fragment` rings itself on
`:focus-visible`, and a box you style yourself needs the same, because the
engines read this programmatic focus as a keyboard one.

**Nothing is hidden to make room.** The box keeps whatever it holds until the
replacement is in hand, and the shipped busy look dims that content rather
than removing it: a load can fail, and then that is what the reader is left
with — plus a link that still points at the page and can be clicked again. The
dim itself is measured rather than chosen, because dimmed text is still text
somebody is asked to read (see `--fragment-busy-opacity` above).

The turning ring is decorative and says nothing to assistive technology — the
status region states the condition. Under `prefers-reduced-motion` the ring
stands still (its gap still reads as *working*), and in forced-colors mode the
ring, the error outline and the error sentence are restated in system colours.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying
`data-js-behavior="loadFragment"`.

It takes **two** collaborators out of `services`: the optional `reporter`, and
the loader — `initModulesInScope()` / `destroyModulesInScope()`, which
`boot.js` now puts into the services object alongside it. That is deliberately
DI and not an import: a component chunk that imported `boot.js` would inherit
its `./registry.js` import, whose path is relative to `dist/js` and resolves
to nothing from `dist/js/modules`. It costs nothing — every page loads
`boot.min.js` anyway, and both functions are already in it. A host that builds
its own services object without them gets a fragment that is placed but not
enhanced, rather than an error.

Those two calls are what makes a fragment more than markup: every load calls
`destroyModulesInScope()` on the box before its content goes and
`initModulesInScope()` on it after the new content is in. So a fragment can
bring its own `data-js-behavior` markup — the demo loads a live countdown and
then swaps it for two accordions — and the one it replaced is torn down
properly instead of leaving its timers running.

`<script>` elements **inside the selection** are removed and reported: a
parser-created script inserted this way never runs, so leaving it would only
look like behaviour that is there. What the answer carries outside the
selection is never touched — the whole page is parsed, only what was selected
is adopted. The answer is parsed with `DOMParser` rather than assigned to
`innerHTML`, which is also why nothing in it loads before it has been decided
what is taken: an inert document makes no requests for its images, frames or
stylesheets.

The script sets **no inline styles**. It writes `data-fragment-state` on the
target and, around the exchange, `aria-busy`; `data-fragment-state` on the
link while its own request runs; `lang` on the elements of a fragment whose
source document declared a different one; `tabindex="-1"` on the target in the
one case it has to recover the focus; and
`data-loadfragment-ready` on the link once it is wired — that last one at the
*end* of construction, unlike most ready attributes here: nothing is hidden
before `init()`, so there is no state a bail-out would have to lift, and a
link the module bailed on stays a plain link rather than claiming to load in
place.

The **one element it creates** is the status region, appended to the target as
soon as the target can be found — at boot where it is already in the document,
on the first click where it is not. That order is the point: a live region has
to be in the document *before* text lands in it, or the platform has nothing to
notice a change against. It belongs to the box and not to either link, so two
links filling one box share it, and it survives every exchange: the swap puts
it back after the fragment, where a project's `:first-child` rules do not trip
over it.

`init()` returns a cleanup function: it aborts a request still in flight, drops
the click listener, clears a sentence about a load that will now never finish,
removes the status region if this instance is the one that built it (a link
sharing the box builds its own again on its next click) and takes its
attributes back (including the box's, unless another load has taken the box
over in the meantime) — so a host that unmounts and remounts the subtree
(`destroyModulesInScope()`) hands the markup back as it arrived. What the link
loaded stays where it is: that is the target's content now, and the target is
somebody else's element.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it
is used only to warn: a trigger that is not a link, a missing
`data-fragment-target`, a target no selector matches, a cross-origin href, an
HTTP or network failure, an answer nothing was selected from, the `<script>`
elements dropped from a fragment, a target that is neither a live region nor
inside an overlay, an id the fragment brought that this page already has, and a
box that had to take the focus without having an accessible name.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`). It fetches
other demo pages of this collection, so it needs to be **served over HTTP** —
`fetch` does not work from `file://`.
