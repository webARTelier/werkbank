# UI Components

## Component authoring standards

When building or reworking a component, follow `docs/componentStandards.md` — the
distilled checklist for the file set, the `init` contract, JS/SCSS style,
progressive enhancement, accessibility and the demo/readme/snippet structure
(derived from the already-reworked components). Note in particular: code comment
text is wrapped at **78 characters**.

## Naming convention: files & folders

Folder and file names are written in **camelCase**.

- Single words stay lowercase: `accordion`, `countdown`, `dialog`, `marquee`, `tabs`
- Multi-word names: first letter lowercase, every subsequent word capitalized
  - Example: `dateinputformat` → `dateInputFormat`, `stickyobserver` → `stickyObserver`
- **Abbreviations are fully uppercased**: `SVG`, not `Svg`
  - Example: `inlineSVG`, `scaleSVG`
- The main component's file name matches the folder name
  - Example: `stickyObserver/stickyObserver.js`
- **Prefixes are preserved**, only the part after them becomes camelCase:
  - `dev_` prefix (developer tools): `dev_dashboard.js`
  - `_shared/` (leading underscore = shared/internal folder)

## Module, component, function: what the BEM prefix says

The `m-` / `c-` / `o-` prefix states a **role**, and the role is settled by
one question: **is there a host that is already complete without this
thing?** Decided 2026-08-10; it replaces the older "standalone, once-per-page
entity" reading of `m-`, which nothing in this collection matches (every
component here is reusable and most can appear several times).

- **Module (`m-`) — it is *placed*.** It brings its own DOM, which would have
  no reason to exist without it, and it occupies a region of the page. It may
  contain other modules and components; it is the purpose, not the means.
  `accordion`, `backToTop`, `countdown`, `dropdownNav`, `lightbox`,
  `marquee`, `offCanvasNav`, `siteSearch`, `slider`, `tabs`, `toast`,
  `video`.
- **Component (`c-`) — it is *attached*.** It wraps, annotates or reinforces
  a host that is complete and usable without it: a full text (`readMore`), a
  plain table (`dataTable`), a native field (`dateInputFormat`), a file field
  that will not say what is attached to it (`fileUpload`), a field that
  should follow its own value (`autoGrowTextarea`), a password field nobody
  can proof-read (`passwordToggle`), a scrolling box
  (`adaptiveScrollFade`), a control that needs explaining (`tooltip`,
  `popover`). It always presupposes something else, and it is the shared
  vocabulary of the design system — styled once, reused in unrelated
  features. A component never depends on one specific module.

  `fileUpload` is the instructive one, and it used to be two things: the
  progress-bar variant shipped as a module of its own (`m-uploadQueue`) on
  the grounds that nothing hosted it. Folded back in on 2026-08-14 as a lane
  of the same component — one attribute, `data-fileupload-url`, picks whether
  the form or the module carries the bytes — it settles what the question is
  and is not about. In that lane the component takes the transfer off the
  form, manages a queue, needs an endpoint and a server-side sweep, and
  writes hidden inputs into the form: **none of that is the question**. The
  question is whether a host is complete without it, and the native file
  field is, in both lanes — it keeps the picker, the keyboard, `accept`,
  `multiple` and its `name` until the module is actually running. So the
  prefix stays `c-`. **How much machinery a thing carries is not a fourth
  axis** (see below): it says how hard the component is to write, not what it
  is attached to.
- **Function (no prefix of its own) — it *enhances*.** It brings no
  vocabulary at all: it writes state classes/attributes onto markup that is
  already there, and the look belongs to the consuming project.
  `formValidation`, `inlineSVG`, `inputCharCount`, `scaleSVG`, `scrollSpy`,
  `stickyObserver`, and the scripts behind `adaptiveScrollFade`,
  `dateInputFormat`, `flexNeighborMarker`.

Two supporting signals where the question feels balanced: a module usually
manages a **collection or a region** (n panels, n images, n messages) while a
component treats **one** host; and a component is what an unrelated feature
would reuse verbatim.

Read the collection signal as "whose collection". **n rows about one host's
value is still one host**: `fileUpload` renders a row per file and, with an
endpoint, runs a queue of transfers — and every one of them arrived through
the single field it is attached to, so it stays a component. A module's
collection is its own (the lightbox's images, toast's messages); it did not
come out of anything the module is wrapped around.

**`dialog` is a component**, and it is the one case the question does not
decide — nothing hosts it, and it hosts arbitrary content itself. Three
things settle it: it has **no footprint in the page flow** (invisible until a
trigger opens it, so it occupies no region); it is the **same species as
`popover` and `tooltip`** — trigger-invoked overlay surfaces — and splitting
those three would be arbitrary; and it is pure system vocabulary, styled once
and identical in every feature. `lightbox` and `toast` stay modules despite
also being overlays: the lightbox owns a thumbnail gallery that really is in
the page and manages a collection, and toast owns a once-per-page stack
region plus its queue.

### The folder is not the unit that carries the prefix

A component folder is a **delivery unit**, not a role. `offCanvasNav` ships
two blocks, and four folders are a function that happens to ship a ready-made
look alongside it:

| Folder               | Role     | What it ships                       |
| -------------------- | -------- | ----------------------------------- |
| `adaptiveScrollFade` | function | `c-scrollFade` — carries the mask   |
| `dateInputFormat`    | function | `c-dateField*` — dresses the field  |
| `flexNeighborMarker` | function | `o-flexNeighbor` — a layout object  |
| `stickyObserver`     | function | `c-stickyBar` — the pinned look     |

Each of those stylesheets said as much before the classification existed
("styling only — a convenience look so the demo/snippet works out of the
box"). The class is an offer; the function neither needs nor reads it.
`m-offCanvasNavToggle` stays a module although it is a single control: it
works only with `offCanvasNav` (it reads `data-offcanvasnav-open`), so it
cannot be a `c-`.

### Three independent axes

Never read one of these off another:

1. **Role** — module / component / function, decided by the question above.
   This and only this is what the prefix states.
2. **How much CSS ships** — a full vocabulary, state hooks only, or nothing.
   `tabs` is unambiguously a module and ships only its pre-enhancement block;
   `dataTable` is a component with ~690 lines. A component that leaves the
   design to the project does not thereby become a function — a function is
   one that has *no* vocabulary to leave.
3. **Bundling** — core stylesheet vs. its own on-demand file (every component
   here is on-demand).

And **how much machinery ships is not a fourth axis.** A network layer, a
queue, an endpoint, hidden inputs written into a form — `fileUpload`'s upload
lane has all four and is still a `c-`, because the field it wraps is complete
without it. Machinery says how hard the thing was to write; the prefix says
what it is attached to. Neither is **who wrote the machinery**: `slider` is a
module because it is *placed* and manages its own collection of slides, and
the fact that a vendor library does the sliding inside it changes nothing about
that (see the vendor section below).

### "module" in the JS sense is a different word

The loader and the snippets keep calling every chunk a *module*
(`boot.min.js lazily loads the tooltip module`) — there it means the lazily
imported ES module, not the `m-` role, which is exactly why the markup hook
is called `data-js-behavior`. Where the CSS role is meant, say
module / component / function; where the chunk is meant, "module" is right.

## Tools: a second area, pointed at a page

`src/tools/dev_dashboard/` holds the **development tools**, indexed by
`tools.html`. They are not components and the component checklist does not
apply — see `docs/toolStandards.md`, which is deliberately a fraction of the
length. Established 2026-08-18 with `dev_srcset` and `dev_a11yInspector`, and
folded into **one dashboard** on the same day: a bar along the bottom edge of
the page, one icon per tool, a panel where a tool needs room. It carries the
page information, the a11y inspector, the horizontal-overflow check, a QR
code of the current URL, the srcset measurement and the form filler. **A new
tool is a section in that file, not a folder of its own.**

The dividing line: a component is **authored into** a page (markup, a class
vocabulary, `data-js-behavior`, `init(el, services)`, a stylesheet in the
build, an entry in `build/config.js`); a tool is **pointed at** one. It
brings no vocabulary and nothing to author beyond one `<script>` line, it is
never part of what a visitor is served, and it never appears in `dist/`. So
the `m-`/`c-`/`o-` question never arises for a tool: there is no cascade to
place a class into, because every class it has lives in its own shadow root.

What that buys, and what it costs:

- **Three files, for the whole area**: `dev_dashboard.js`, `demo.html`,
  `readme.md`. No `.scss`, no snippet file, **no entry in
  `build/config.js`** — `gulp build` does not know tools exist, and the
  `src` file *is* the artefact.
- **One classic script, zero imports.** Not an ES module and nothing out of
  `_shared/js`: it has to survive a copy into a foreign project, a console
  paste and a bookmarklet, and a classic script also runs from `file://`.
  Duplicating a helper inside it is therefore **correct** — tools sit
  outside the DI-vs-direct-import rule above, because self-sufficiency is
  the point. Load time is not an argument here either: one local file during
  development weighs nothing against wiring up four.
- **One handle, `window.__devTools.dashboard`**, with `open()` / `close()` /
  `destroy()` plus one object per tool (`…dashboard.a11y.scan()`); a second
  load re-opens instead of stacking a second copy.
- **The JS carries no comments** — the readme is the documentation. Six
  tools in one file would otherwise read as six documented tools, with
  comments drifting from the readme the moment either changes.
- **A tool is pointed at an element by clicking it.** Since 2026-08-18 the
  srcset measurement takes its images by click — panel folds away, page takes
  the clicks in the capture phase, every click toggles one element in or out,
  several at a time — and `data-dev-srcset` is only a **pre-selection** for a
  page you measure repeatedly, not the way in. Asking an author to edit the
  markup before a tool will look at something is the friction a tool exists to
  remove. A selection that has to survive into the probe frame is stored as a
  CSS path, and an element the probe does not have is reported, not dropped.
  Where clicking the page would mean something else, the panel's own list is
  the pointing device instead: the form filler finds forms by tag and puts a
  **fill** button beside each, and its `data-dev-form` **steers** what is
  written rather than selecting what is looked at.
- **The page under test is changed as little as possible, and never
  invisibly.** The srcset sweep still measures a copy in a probe frame.
  What is written into the page is one spacer holding the bar's height, one
  style element, and the marker attributes a tool sets while you ask for
  them — all named `data-dev-dashboard-…`, so `grep data-dev-` finds every
  leftover, and all taken back by `destroy()`.
- **A tool that changes the page for real owes three things.** The form
  filler (2026-08-18) writes values a submit would send — not a marker, and
  nothing `destroy()` can sweep up. So it acts **only on an explicit press**,
  never on load and never inside a scan; it **ships the way back**, snapshotting
  value, checked state, selected options and file list before the first
  character and restoring them on **reset**; and it **stops at the edge of the
  irreversible** — nothing is submitted, no request leaves, the submit button
  stays the developer's to press. A tool that cannot offer the way back marks
  instead of writing.
- **Accessibility at a developer's bar, and stated as such**: real buttons,
  Esc, `aria-pressed`/`aria-expanded`, a focus ring — but no ARIA patterns,
  no live regions, no reduced-motion audit. Holding a tool to the product
  bar would only stop tools from being written.

**The two demo aids are gone into it.** `_shared/js/dev_pageInfo.js` and
`dev_qrCode.js` used to be a different species — one depended on this
project's tokens, the other on `api.qrserver.com` — and the component demos
loaded them as modules. Both objections were answered rather than kept:
the dashboard reads `--viewportName` / `--navstate` / `--density` /
`--input` off `<body>` and shows an amber `?` per token a page does not
declare, and the QR code is now **encoded in the page**, so no request goes
anywhere. Every component demo loads the one dashboard line instead.

## Structure / Build

- `_shared/js/registry.js` is **auto-generated by Gulp** — do not treat it as a manual source;
  changes derive from the module file names at build time.
- The relative imports in the components (e.g. `import ... from './debounce.js'`)
  are relative to the **build output** (`_shared/js/modules/`), not to the physical
  folder structure. Renaming the component folders therefore does not break these imports.
- Module IDs in `data-js-behavior="…"` in the markup correspond to the registry keys
  (= the camelCase module names).
- `node_modules` is the third Sass load path (after the entry's own folder and
  `_shared/scss`), so a component can `@use` a vendor stylesheet straight out
  of its installed package. Added 2026-08-17 for `slider`; see below.

## Vendor code: installed, bundled, never fetched

Almost everything here is written from scratch on top of the platform, and that
is the default. **`slider` is the one component with a vendor dependency**
(Swiper, MIT), and the rules it establishes are the rules for the next one:

- **Installed, not copied.** The library is an npm `dependencies` entry — not a
  file checked into `src/`, and not a CDN tag. So the version is pinned in one
  place, `npm audit` sees it, and a bump is a lockfile change rather than a
  hand-merge of somebody else's minified file.
- **Bundled into the component's own lazy chunk.** `import Swiper from 'swiper'`
  is a bare specifier, which Rollup's node-resolve turns into code inside
  `dist/js/modules/slider.min.js`. A page that has no slider downloads none of
  it, exactly like every other component. Name the individual modules
  (`swiper/modules`) rather than importing the bundle, so the chunk carries the
  features the presets actually use.
- **Its CSS is inlined into the component's own stylesheet.** `@use
  "swiper/swiper";` at the top of `slider.scss` — Sass loads a plain `.css`
  file verbatim, and `node_modules` is a load path. The component still ships as
  **one** file, so nothing about the snippet or the demo is special. Load the
  vendor CSS **first**, so the component's own rules win a tie on source order.
  Take only the parts you use: `slider` takes the core, `effect-fade` and
  `a11y`, and styles its own controls instead of taking the vendor's navigation
  and pagination stylesheets with their icon font and theme colour.
- **No third-party request at runtime, ever.** No CDN, no `<script>` the author
  has to add, no `@import url(…)`. That is not a performance preference: an
  external request is a dependency on somebody else's uptime, cache policy and
  privacy posture, and it breaks under a strict CSP.
- **The vendor's class names stay the vendor's.** The component writes them
  onto its own nodes (`swiper`, `swiper-wrapper`, `swiper-slide`) from the JS,
  which is also what keeps the vendor stylesheet from taking hold of markup its
  script is not driving yet. **No rule in the component's own stylesheet
  selects by a vendor class**, and no vendor class appears in authored markup.
  Where the vendor writes a state, prefer the ARIA it writes over the class it
  writes (`aria-current` on a pagination bullet), for the same reason
  `passwordToggle` draws its glyph from `aria-pressed`.
- **The `v-` prefix in the code-style guide is for a third party's own
  *vocabulary*** — markup and classes a project has to live with. It does not
  apply here: `m-slider` is this collection's block, and Swiper contributes
  behaviour and internal hooks, not a block.
- **A vendor declaration that fights the house layout is neutralised in one
  place, with the measurement in the comment.** `slider.scss` has exactly one
  (`margin-inline: 0`, undoing `.swiper`'s auto margins, which stop the root
  being stretched in a flex column). Undoing more than a handful is the signal
  that the library is the wrong fit, not that the file needs more overrides.
- **Progressive enhancement is not suspended for a vendor.** The component must
  still be usable before and without the chunk, out of its own CSS: `slider`'s
  no-script rendering is a `scroll-snap` strip, and the ready attribute is what
  hands the box over. A library that cannot be adopted that way — one that
  needs its classes in the authored markup — should not be adopted.

## Dependencies: DI vs. direct import

Components receive dependencies through **two channels**, chosen by the *kind*
of dependency — not by preference. Keep this split consistent:

- **Configured singletons / collaborators with state or lifecycle → DI via
  `services`.** Built once in `boot.js` and passed to `init(el, services)`.
  Example: `reporter` (has a configured `level`, is optional/mockable). Use DI
  when the thing must be shared, configured at the composition root, or swapped
  (e.g. a no-op in tests).
- **Pure, stateless utilities → direct import from `_shared/js/`.** Imported as
  flat siblings (e.g. `import { rafThrottle } from './rafThrottle.js';`), which
  the build resolves from `_shared/js/`. A utility only one component imports
  is inlined into that component's lazy chunk; from the second consumer on,
  Rollup splits it into its own chunk in `dist/js/modules/` that is loaded
  alongside and cached — which is why **a helper's second consumer is the
  signal to hoist it here** instead of copying it. Examples: `debounce`,
  `rafThrottle`, `getCssCustomProperty`, `formatTemplate`, `decodeFragment`,
  `parseNonNegative`, `uniqueId`, `focusableSelector`,
  `navExpandedMediaQuery`, `otherModalOpen`, `parseByteSize`,
  `formatByteSize`, `matchesAccept`, `fileKey` (see
  `docs/componentStandards.md` §10 for what each one does). The last four were
  born in `fileUpload` and hoisted the day `uploadQueue` needed them, which is
  exactly the signal described above. That second consumer is gone again since
  the queue became a lane of `fileUpload` itself (2026-08-14), so all four have
  one consumer once more and Rollup inlines them into its chunk. They stay
  here regardless, for two reasons: a flat-sibling import resolves from
  `_shared/js/` and nowhere else, so this is the only place such a utility can
  live at all; and **hoisting is not undone when a consumer disappears** —
  moving a general helper back into one component would only have to be
  reverted the next time something needs it.

Do **not** route pure utilities through `services`: `boot.js` loads eagerly on
every page, so anything it imports for the `services` object lands in the
always-loaded `boot.min.js` — defeating the per-component lazy loading. Utilities
also have no config/shared state, so DI would add indirection without benefit.

## Pre-enhancement state (the gap before `init()`)

`boot.min.js` is a deferred module script and each component is a second,
lazily imported chunk, so the **first paint is always the unenhanced markup**.
Where that differs visibly from the enhanced rendering, the component states
the enhanced resting position in CSS up front instead of letting the reader
watch it change. See `docs/preEnhancement.md` for the full strategy; the parts
to know before touching a component:

- **One attribute per component: `data-<name>-ready`** (lowercase), held in
  `defaults` as `readyAttr`, set on the root by `init()`, removed by the
  cleanup function. Only ever written, never read back. There is deliberately
  **no** generic flag — an element can carry several modules and components
  nest, so a shared name cannot say who set it (`data-js-enhanced` used to,
  and `dropdownNav` needed a `[data-js-behavior*=…]` qualifier to work around
  it). The loader's `data-js-init_<name>` is not a substitute: it is written
  *before* the chunk is imported.
- **One mixin: `_shared/scss/_progressiveEnhancement.scss`.**

  ```scss
  @use "progressiveEnhancement" as *;
  .m-thing { @include pre-enhancement("data-thing-ready") { … } }
  ```

  It wraps the rules in `@media (scripting: enabled)` — a reader with
  scripting off must never see a transitional state — and in
  `:not([data-thing-ready])`. It assumes the flag and the rule share a
  subject; `tabs` is the one component where they cannot, and writes the same
  two conditions out with a `:not([data-tabs-ready] *)` guard instead.
- **The block only ships when it is survivable.** Whatever it declares is
  permanent if the chunk 404s. It may hide something only when nothing is
  lost (`backToTop`), a `:target` escape keeps it reachable (`tabs`,
  `offCanvasNav`, `readMore`), or the module lifts the state on its own
  bail-outs.
  Otherwise it stays a documented opt-in in the component's snippet
  (`siteSearch`, `dropdownNav`) — hiding content behind a control the script
  never delivered is the one outcome the convention exists to prevent.

## Focus ring (keyboard focus indicator)

The keyboard `:focus-visible` ring is **opt-in per element**, not a global rule.
`_shared/scss/_focus.scss` defines a single `focus-ring()` mixin; each element
that should show a ring `@use`s it and applies it, choosing the tone that
contrasts with its own surface:

```scss
@use "focus" as *;
.my-control { @include focus-ring(light); }   // element on a dark surface
.on-white   { @include focus-ring(dark); }     // element on a light surface
```

- **Two tones, one mixin.** `light` / `dark` map to `--color-focus-ring-light`
  / `--color-focus-ring-dark` (see `_shared/scss/_colors_semantic.scss`). Pick by
  the element's *background*, not by preference — a bright ring for dark surfaces,
  a deep ring for light ones. The whole current theme is dark, so every component
  uses `light`; `dark` exists for elements placed on a light surface.
- **Optional `$offset`.** `focus-ring($tone, $offset)` overrides `outline-offset`
  for cases where the default outset ring would be clipped — e.g. `adaptiveScrollFade`
  passes a negative (inset) offset because its `mask-image` would otherwise cut the
  ring away.
- **Two mixins.** `focus-ring($tone, $offset)` is the common case — it wraps the
  ring in the element's own `&:focus-visible`. `focus-ring-outline($tone, $offset)`
  emits *only* the `outline` declarations for a bespoke selector that is **not**
  the focused element's own `:focus-visible` — e.g. `accordion` draws the ring on
  the parent `<details>` via `:has(> .trigger:focus-visible)` (the trigger's own
  outline is clipped by `overflow: hidden`) and sets `outline: 0` on the trigger.
- **Why opt-in, not a global `:focus-visible`.** Per-element application lets each
  element choose its tone (and offset) and keeps the ring out of places that style
  focus differently (see `accordion` above). Behaviour-only components ship a stub
  stylesheet (`tabs`, `inputCharCount`, `formValidation`, …) — they carry
  no CSS by design (`marquee` ships only structural rules), so the consuming
  project styles their focus.
- `_focus.scss` emits **no CSS on its own** (mixin only), so it is *not* `@use`d by
  `shared.scss`; only the components that apply a ring pull it in. The tone tokens,
  however, live in `shared.min.css` so they resolve at runtime.

## Media queries: all of them live in `_mediaqueries.scss`

A component stylesheet never writes a raw `@media`. It `@use`s the partial and
includes the mixin that **names the condition**:

```scss
@use "mediaqueries" as *;
.m-thing { @include reduced-motion { transition: none; } }
```

- **Viewport / input / display:** `vp-only`, `vp-up`, `vp-between`,
  `vp-nav-collapsed`, `vp-nav-expanded` (all named through
  `_breakpoints.scss`), `input-touch`, `input-mouse`, `highdpi`.
- **User preferences and context:** `darkmode`, `reduced-motion`,
  `forced-colors`, `scripting-enabled`, `print-only`. These were the ones
  written out by hand in the components until 2026-08-07; they are exactly as
  much a project-wide decision as a breakpoint is. `pre-enhancement()` in
  `_progressiveEnhancement.scss` wraps its rules in `scripting-enabled` from
  here, and `tabs` — the one component that cannot use that mixin (see the
  pre-enhancement section) — still takes the query from here.
- **A condition the partial does not have yet is a mixin missing there**, not
  a query to write out locally. Same failure mode the nesting section
  describes for knobs: the moment a component states the raw condition
  itself, the project has two answers to "what does reduced motion mean here".
- The partial emits **no CSS on its own** (mixins only), so a component pays
  nothing for `@use`ing it. `_demo.scss` is the one file that still carries a
  raw query — a one-off 680px breakpoint for the demo page chrome, which is
  not part of the project's scale and not a component.

## Media sizing: the container owns the box

Images and videos never carry their own dimensions in a component stylesheet.
The **surrounding container has the size and the aspect ratio** — supplied by
the consuming project — and the media fills that box and is cropped to it:

```scss
// component: the media fills whatever box it is placed in
.m-thing__media {
  display: block;
  inline-size: 100%;
  block-size: 100%;

  object-fit: cover;
}
```

```css
/* project: the container dictates size and shape */
.thing-media {
  inline-size: 100%;
  aspect-ratio: 16 / 9;
}
```

- **The ratio sits on the parent, never on the media.** A container that owns
  the box can be retuned per instance (a wide hero, a 1:1 tile, a 9:16 story)
  without the component knowing, and it reserves the layout space *before* the
  image arrives, so nothing shifts. `video` is the reference implementation —
  its SCSS header states the contract and `demo.html` plays the project side;
  `lightbox`'s authored gallery carries `--lightbox-thumb-ratio` on the tile
  link, and its `<img>` only fills it.
- **`cover`, not `contain`, is the default.** The container's shape wins; the
  media is cropped to it rather than letterboxed inside it.
- **`width`/`height` in the markup are not what reserves the space here.** The
  stylesheets are render-blocking `<link>`s in the `<head>`, so there is no
  paint before them: by the time anything is drawn, the container's
  `aspect-ratio` already holds the box. Measured on `lightbox`'s demo with the
  CSS held back 1.2 s — first contentful paint at 1468 ms, stylesheets done at
  1266 ms, nothing painted in between. This is exactly the difference to the
  gap [`preEnhancement.md`](docs/preEnhancement.md) covers: a deferred module
  arrives *after* the first paint, a stylesheet in the head cannot.
  Keep the attributes anyway — they cost nothing and they are load-bearing in
  the two cases where the *media* decides the box: a container left at
  `aspect-ratio: auto` (`lightbox`'s documented ratio-`auto` gallery) and the
  `contain` surfaces below. Where the container imposes a ratio they are
  documentation of the source's shape, not layout insurance; do not cite them
  as CLS protection there.
- **A component that renders media says so in its snippet** (`<name>.html`
  Notes) and its readme: the container styles are a required part of the
  wiring, not an optional nicety.
- **Exceptions are named in the component, not decided ad hoc:**
  - A surface whose job is to show the *whole* frame uses `object-fit:
    contain` and takes its box from the media instead. `lightbox`'s viewer
    image is the only one in this collection — cropping a photograph the
    reader opened in order to look at it defeats the component.
  - **`object-fit` cannot reach into an `<iframe>`.** A third-party embed
    letterboxes inside the box it is given (`video`'s YouTube facade); real
    cover-cropping of an iframe is a project-level decision (oversize + clip),
    not something a component ships.
  - **SVG is out of scope.** `inlineSVG` / `scaleSVG` scale through the
    `viewBox`, and an icon takes its box from the control it sits in.


## Nesting: the outer module provides the container

Modules nest — a `dropdownNav` in an `offCanvasNav` drawer, a `countdown`
riding inside a `marquee`. Where they do, the **outer module provides the
element the inner one sits in**, named after both:
`m-<outerModule>__<innerModule>` (camelCase on both sides, like the folders).

```html
<div class="m-marquee__track" data-marquee-animated>
  <div class="m-marquee__countdown">
    <div class="m-countdown" data-js-behavior="countdown"> … </div>
  </div>
</div>
```

- **That container is the only place the outer module talks about the inner
  one.** Placement, size and spacing of the nested module go there, and the
  inner module is retuned through **its own knobs, set on its root from
  inside that container**:

  ```scss
  .m-marquee__countdown > .m-countdown {
    --countdown-direction: row;
    --countdown-root-gap: var(--space-2xs);
  }
  ```

  It has to be the root, not the container: every component declares its
  knobs *on its own root* (see the standards §6), and a declaration on an
  element beats any inherited value no matter what the specificity is — so
  `.m-marquee__countdown { --countdown-direction: row }` inherits down and
  loses to the root's own `column`. Verified the hard way; the knobs simply
  did not apply.
- **The inner module's root class is the whole of the outer's vocabulary.**
  Never its internals: no `.m-countdown__value`, no `.m-countdown__toggle`.
  The internals are what the component is free to rearrange between versions;
  the root class and the documented knobs are what it promises. In the other
  direction there is nothing at all — the inner module never mentions a host.
- **A real element, not a second class on the inner root.** The inner root
  carries its own token block and its own `display`; two blocks sharing one
  element fight over the same box. A wrapper also keeps swapping one nested
  module for another a pure markup change.
- **If something cannot be said through a knob, the inner module is missing
  one.** Add it to that component's token block instead of reaching in from
  outside — that is the failure mode this convention exists to prevent.
  `countdown` grew `--countdown-direction`, `--countdown-align`,
  `--countdown-root-gap` and `--countdown-value-min-size` for exactly this
  reason: they are what a host needs in order to lay a countdown out inline,
  and with them the marquee demo went from styling `.m-countdown__value` and
  `.m-countdown__toggle` from outside to setting four knobs.
- **A slot that takes arbitrary content keeps its role name.**
  `.m-offCanvasNav__body` and `.m-marquee__track` hold *whatever* the author
  puts there ("any `<nav>` works"), so naming them after one module would be
  a lie and the outer has nothing specific to say about the occupant. The
  `m-<outer>__<inner>` element appears where the outer actually places, sizes
  or tunes a named companion — inside such a slot, as in the example above.


## Out of scope: right-to-left

**This project does not support RTL layouts.** Decided 2026-08-04 after 25
years without a single project needing it, and the JS that had grown for it
(marquee's mirrored translate range, dropdownNav's direction-aware collision
flip, lightbox's swapped arrow keys) has been removed.

- **Logical properties stay** (`inset-inline`, `inline-size`, …). They are the
  house style because they keep one rule where physical sides need two — not
  because anything mirrors. Comments must not promise otherwise.
- **Never read `direction` / `dir` in JS**, and never pair a logical property
  with a script that measures which physical edge it resolved to.
- The build is a second reason: it lowers `:dir(rtl)` into a `:lang()` list for
  older engines, which does not see `dir="rtl"` at all — so the CSS could not
  express the mirroring reliably even if the JS did.

## Still open / intentionally not changed

These do not (yet) follow the camelCase convention, since they are not file/folder names
and changing them would require an API/markup adjustment:

- Console prefixes in warnings, e.g. `[stickyobserver]`
- HTML `data` attributes, e.g. `data-inputcharcount`
