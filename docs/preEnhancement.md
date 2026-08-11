# Pre-enhancement: covering the gap before `init()`

Every component here is progressive enhancement: the markup is a working
document, and the script upgrades it. That is the right order, and it has one
unavoidable consequence — for a short while the page shows the document, and
then it becomes the widget. A stacked list of sections turns into tabs, a full
navigation folds into a burger, a back-to-top control appears and immediately
goes away again. This is the flash (FOUC) that a progressive-enhancement
library has to answer for, and this document is the answer.

Read it together with [`componentStandards.md`](componentStandards.md) (§3 for
the `init` contract, §6 for the SCSS side) and the top-level `CLAUDE.md`.


## 1. Why the gap exists

Three delays sit between the first paint and `init()`, and only the last of
them is negotiable:

1. **`boot.min.js` is a module script**, so it is deferred by definition. It
   cannot run before the document has been parsed — which is after the first
   paint. Making it blocking would be worse than the flash it prevents.
2. **The component's chunk is a second round trip.** `boot.js` only imports
   `<name>.min.js` once it has seen `data-js-behavior="<name>"` in the DOM, so no
   preload scanner ever predicted that request.
3. **How the loader spends those round trips.** This one was fixable and has
   been fixed — see §5.

The first paint is therefore always the unenhanced markup, in every browser,
on every load, cache or no cache. No amount of loader tuning changes that. The
strategy is built around it rather than against it.


## 2. The strategy in four layers

### Layer 1 — state the enhanced resting position in CSS

The one thing that actually removes the flash rather than shortening it: if
CSS declares up front what the component will look like once enhanced, the
first paint is already correct and `init()` has nothing left to change.

Two conditions guard every such rule, and both are load-bearing:

```scss
@media (scripting: enabled) {
  .m-thing:not([data-thing-ready]) { /* … */ }
}
```

- **`@media (scripting: enabled)`** — the pre-enhancement state may only apply
  where a script is going to run. For a reader with scripting off, the
  unenhanced markup is not a transitional state but the final one. Like every
  media query in the collection it is written as a mixin, not by hand:
  `scripting-enabled` from `_shared/scss/_mediaqueries.scss`.
- **`:not([data-thing-ready])`** — the component's own ready attribute, so the
  rule lifts the moment the module takes over.

Both come from one mixin, `_shared/scss/_progressiveEnhancement.scss`:

```scss
@use "progressiveEnhancement" as *;

.m-thing {

  @include pre-enhancement("data-thing-ready") {
    &:not(:target) { display: none; }
  }
}
```

The mixin assumes the flag and the rule share a subject: the component has a
root of its own, the attribute goes there, and descendants nest inside the
block as usual. `tabs` is the one case where that does not hold — it is
behaviour-only, has no root class to nest its panel rules under, and matching
`data-js-behavior` with `*=` would be guesswork about a comma-separated
list. It therefore writes the same two conditions out itself — the shared
`scripting-enabled` query plus a `:not([data-tabs-ready] *)` guard ("not
inside a container the module has reached"), which needs no container
selector at all. One exception did not
warrant a second mixin; see `tabs.scss` for the note that says so in place.

Why `@media (scripting: enabled)` and not a `.js` class set by an inline
script: it needs no blocking script in the `<head>`, it is in force for the
very first paint, and it is declarative. Both approaches share the same blind
spot — scripting being *enabled* is not the same as this component's chunk
*arriving* — which is what Layer 2 is about.

### Layer 2 — make the pre-state survivable, or do not ship it

This is the rule that decides whether a pre-enhancement state is allowed at
all:

> Whatever the block declares is what the reader is left with **for good** if
> the chunk 404s, throws, or the browser is too old for the module. It may
> hide something only when that something stays reachable without the script.

Three ways a component can satisfy it:

- **Nothing is lost.** `backToTop` hides a shortcut to a place the reader can
  still scroll to. Purely additive controls are always safe.
- **A fragment escape hatch.** `tabs`, `offCanvasNav` and `readMore` are all
  built on in-page links, so `:target` reveals the hidden content without any
  script. The hiding rules exempt `:target`, which turns "hidden" into "one
  click away".

  Two things follow for any component built on it, and both are easy to miss.

  **It owes the reader the same answer once the module has arrived**, because
  setting the ready attribute is what stops `:target` from answering. `tabs`
  and `readMore` both watch `hashchange` for that reason; without it, an
  in-page link worked before the chunk loaded and did nothing afterwards — the
  one shape of regression this whole layer exists to rule out. So check it
  whenever the escape is a fragment: the question is whether anything *other
  than the component's own control* can set that fragment. `offCanvasNav`
  needs none of it — the only link to its drawer is the burger, and the module
  handles that click itself.

  **A fragment pointing *into* the hidden part counts as naming it.** The
  browser scrolls to the target whether or not the component reacted, so
  exempting only the element that carries the id leaves the reader on
  something still out of the flow. Both halves need it, the CSS rule and the
  module: `readMore` also opens when the target sits inside its text region
  (`:has(:target)` / `querySelector(':target')`), and `tabs` also selects the
  panel that *contains* the target (`:has(:target)` / `panel.contains`). This
  is what lets the two nest in either order — a `readMore` inside a tab panel
  is only reachable by deep link because `tabs` answers the second case, and
  a tabs widget inside a cut text only because `readMore` does.

  One CSS note from doing that in `tabs`: "a later sibling panel that
  contains the target" cannot be written as `:has(~ [data-tabs-panel]:has(:target))`,
  because `:has()` may not be nested inside `:has()`. The descendant form
  `:has(~ [data-tabs-panel] :target)` says the same thing and is valid.
- **The module lifts the state on its own bail-outs.** A component that gives
  up on unusable markup must set its ready attribute anyway — otherwise a
  reported author error turns into permanently missing content. `tabs` sets it
  as the *first* statement of its constructor for exactly this reason (safe,
  because the constructor runs in one synchronous task, so no frame can paint
  in between), and `backToTop` has a `releasePreEnhancement()` on its two
  bail-outs.

Where none of the three applies — the control that would bring the content
back is injected by the script, or dead without it — the component **does not
ship the block**. It documents the rule in its snippet and leaves the trade to
the project. That is the case for `siteSearch` (the toggle is a `<button>`
that does nothing unenhanced) and `dropdownNav` (the disclosure buttons do not
exist until the script injects them).

### Layer 3 — shorten the window

For everything CSS cannot predict, the remaining lever is time.

- **The loader initialises elements concurrently** (see §5).
- **`<link rel="modulepreload">`** for `boot.min.js`, and for the chunks of
  components above the fold, removes the fetch cost of round trip 2. This is a
  project-side decision — it depends on which components a given page uses —
  so nothing here emits it. Add it next to the `<script type="module">` in the
  snippet's `<head>` block:

  ```html
  <link rel="modulepreload" href="/dist/js/boot.min.js" />
  <link rel="modulepreload" href="/dist/js/modules/offCanvasNav.min.js" />
  ```

### Layer 4 — reserve the space CSS cannot predict

Some components change the layout in a way no stylesheet can state in advance,
because the result depends on runtime measurement or on content the script
fetches. There the goal is not to hide the change but to keep it from
*shifting* anything (CLS):

| Component        | What moves                        | What the project does about it                              |
| ---------------- | --------------------------------- | ----------------------------------------------------------- |
| `inlineSVG`      | `<img>` is replaced by `<svg>`    | `width`/`height` (or `aspect-ratio`) on the `<img>`          |
| `scaleSVG`       | the SVG gets its computed size    | reserve the box; `is-scaled` is there to reveal it once sized |
| `countdown`      | `0` becomes `365`                 | `font-variant-numeric: tabular-nums`, a `min-inline-size` in `ch` |
| `inputCharCount` | a counter element is injected     | reserve a line under the field                               |

This layer is advice, not shipped CSS: the sizes belong to the project's
design, and a component that guessed them would be wrong more often than
right.


## 3. The convention: the ready attribute

Every component that needs a pre-enhancement state owns one attribute:

```
data-<name>-ready
```

lowercase, on the component root, set by `init()` (via `defaults.readyAttr`),
removed again by the cleanup function if the component has one. It is **only
ever written, never read back** by the JS.

**Why per component and not one shared flag.** Both spellings existed here
before this was written down: `data-js-enhanced` (accordion, dropdownNav) and
`data-<name>-ready` (backToTop, offCanvasNav, siteSearch). The generic one
loses, and the codebase had already proved it — an element may carry several
modules (`data-js-behavior="accordion,dropdownNav"`) and components nest
inside each other, so a generic flag cannot say who set it. `dropdownNav.scss`
had to carry a `[data-js-behavior*="dropdownNav"]` qualifier on three blocks
to work around exactly that collision. With a per-component name the
qualifier is unnecessary, and it went.

**Why not the loader's flag.** `boot.js` already writes
`data-js-init_<name>`, but it writes it *before* importing the chunk, as a
double-init guard. It means "someone will handle this", not "it is handled",
so CSS cannot use it.

**Why not have the loader set a ready flag generically after `init()`.**
Because the component is the only one that knows *when* it is ready:
`offCanvasNav` only once a trigger is wired, `marquee` only once its clones
are measured, `siteSearch` only after the collapsed state has been flushed so
the first fold does not animate, `tabs` deliberately at the very start so its
bail-outs are covered. A loader-level flag would be one fixed moment for all
of them, and the wrong one for most.


## 4. Per-component decision table

| Component | Flash without a pre-state | Pre-state | Why |
| --- | --- | --- | --- |
| `tabs` | all panels stacked, then one — several screens of jump | **ships it** | `:target` keeps every panel reachable, plus a `:has(:target)` for a fragment naming something *inside* a panel; the module lifts the state even when it bails |
| `offCanvasNav` | full menu expanded on a narrow viewport, then a burger | **ships it** | burger is a link to the drawer, so `:target` reveals it; scoped to `[id]`, which is both the fragment's precondition and the module's only bail-out |
| `backToTop` | control visible, then gone | **ships it** | purely additive — a failure costs a shortcut, nothing more |
| `readMore` | the whole text, then a preview of it — screens of content moving up | **ships it** | the toggle is a link into the region, so `:target` hands the full text back — plus a `:has(:target)` for a fragment addressing an anchor *inside* the text; scoped to `[id]`, which is the fragment's precondition, and the module sets its attribute first so a bail-out lifts the cut |
| `siteSearch` | search form visible, then folded shut | documented opt-in | the toggle is a `<button>`, dead without the script, and there is no fragment fallback |
| `dropdownNav` | full nested list, then a bar with flyouts | documented opt-in | the disclosure buttons are injected by the script; nothing reopens a collapsed submenu without it |
| `accordion` | none | not needed | `<details>` renders closed either way; its ready attribute only picks the animation |
| `dataTable` | none | not needed | the table is complete and readable in its scrolling box either way, and the sort controls do not exist until the script builds them out of the header labels — its ready attribute switches the stacked layout *on* (see below) |
| `autoGrowTextarea` | none | not needed | where the engine has `field-sizing` the growing is CSS from the first paint, so there is no gap at all; where it has not, the field is a plain textarea at its `rows` height with a scrollbar until the module has measured — additive, nothing hidden. Its ready attribute gates the resize handle *off* instead of lifting a pre-state (see below) |
| `dialog`, `popover` | none | not needed | closed at rest, and the behaviour is native |
| `lightbox` | none | not needed | the gallery is a list of links to the images either way; the viewer is closed at rest and does not exist in the markup at all — the script injects it |
| `toast` | none | not needed | the stack is empty at rest, and a message authored into it is a static notice that simply keeps standing; the one control the component owns is injected, so it cannot exist before it works |
| `tooltip` | none | not needed | the hint is out of the way at rest and the stylesheet does the showing on its own, so the first paint already is the enhanced rendering |
| `marquee` | none | not needed | the clipping row is plain CSS from the first paint; the strip is just static until it runs |
| `video` | none | not needed | the JS-only toggle ships with `hidden` in the markup and the script reveals it — the same idea, expressed in HTML |
| `stickyObserver`, `scrollSpy`, `flexNeighborMarker`, `adaptiveScrollFade` | additive marker/fade appears | not needed | nothing is hidden, and the result depends on measurement CSS cannot anticipate |
| `dateInputFormat`, `formValidation` | none | not needed | behaviour on interaction only |
| `inlineSVG`, `scaleSVG`, `countdown`, `inputCharCount` | layout shift | Layer 4 | the change cannot be predicted, only kept from shifting — see the table above |

`video`'s approach is worth a note: a control that is useless without the
script can simply ship with the `hidden` attribute and be revealed by `init()`.
Where that works it is better than any CSS, because it needs no ready
attribute and no media query. It only works for *adding* a control, not for
changing an existing rendering.

`dataTable` is the case that runs the other way, and it is worth knowing that
the attribute can. Its stacked layout (rows as cards, below the `small`
breakpoint) is gated **on** `[data-datatable-ready]` rather than lifted by its
absence, because that layout needs two things only the script can write: the
column label on each cell, and the explicit table roles that keep the cells
cells once they stop being table boxes. So the flag says "these are in place"
— which means the bail-out rule inverts with it: `tabs` sets its attribute
*first* so a bail lifts the pre-state, `dataTable` sets its own *last* and
withholds it on a bail, leaving the scrolling table that needs no script. Same
attribute, same "only ever written" rule; what differs is which side of the
condition the enhanced state sits on.

`autoGrowTextarea` is the same inversion on a smaller subject, and it shows
that the attribute is worth owning even where there is no pre-state to lift.
Nothing about that component is hidden before `init()`, so it ships no block —
but its stylesheet takes the field's **resize handle** away only where growth
is actually being delivered: unconditionally in the lane where CSS does the
growing (`field-sizing`), and on `[data-autogrowtextarea-ready]` in the lane
where the module does. Otherwise a chunk that never arrived would leave a
field that can neither grow nor be dragged open. Like `dataTable` it therefore
sets the flag where it delivers and withholds it where it does not — its one
bail-out (the module on something that is not a `<textarea>`) returns before
the attribute is written.


## 5. What changed in the loader

`initModulesInScope()` used to await each element before starting the next, so
a page with eight components paid eight round trips end to end and the last
component was enhanced long after the first. Modules **on one element** still
run in source order — `data-js-behavior="a,b"` may well mean that `b` expects
what `a` produced — but elements no longer wait for each other:

```js
await Promise.all(Array.from(nodes, (el) => initElement(el)));
```

`initElement` never rejects (each module is caught and reported individually),
so one broken module still cannot abort the rest of the page.

The ordering `boot()` documents is unchanged: global modules are still awaited
before page modules, because a global may set up something the page modules
depend on.


## 6. What was deliberately not done

- **`body { visibility: hidden }` until ready.** Trades a short flash for a
  long blank page, destroys LCP, and leaves a broken script with nothing on
  screen at all. It also breaks the no-JS case outright.
- **A `.no-js` class with a `<noscript>` stylesheet.** Inverted logic, two
  places to keep in step, and `@media (scripting: enabled)` expresses the same
  condition natively.
- **A JS-driven fade-in of the whole page.** Moves the flash rather than
  removing it, and adds the fade's duration to the time before the content is
  readable.
- **A generic loader-set ready flag.** See §3.


## 7. Checklist for a new component

1. Ask what the markup looks like at first paint and what it looks like after
   `init()`. If they differ visibly, there is a flash.
2. Can CSS state the enhanced resting position without knowing any runtime
   measurement? If not, it is a Layer 4 case — reserve space, do not hide.
3. If it can: is the state survivable (§2)? Nothing lost, a `:target` escape,
   or a bail-out that lifts the state?
   - Yes → ship the block via `pre-enhancement()`, and say so in the snippet
     and the readme.
   - No → do not ship it. Document the opt-in rule in the snippet, and say
     what the project is signing up for.
4. Add `readyAttr: 'data-<name>-ready'` to `defaults`, set it in `init()` at
   the moment the component can actually operate the state, and remove it in
   the cleanup function if there is one.
5. Note in the SCSS header which attribute the JS writes and what the
   pre-enhancement block does — the contract-with-the-JS comment every
   stylesheet here carries.
