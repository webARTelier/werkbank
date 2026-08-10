---
name: code-style-guide
description: >-
  Björn Müller's personal Code Style Guide (from webartelier.de/csg). Apply
  these conventions when writing, reviewing or reworking HTML, SCSS/CSS and
  JavaScript. Covers naming, BEM namespacing, ITCSS structure, formatting,
  whitespace, attribute/property ordering, separation of concerns, progressive
  enhancement, accessibility and asset/performance defaults. Load before
  authoring or editing front-end code.
---

# Code Style Guide

Personal front-end code style guide (source: <https://webartelier.de/csg/>).
These rules are the **default baseline** for any project this skill is copied
into: follow them whenever you write or modify HTML, SCSS/CSS or JavaScript.

**Precedence.** A project's own conventions (its `CLAUDE.md`, or an existing
house style already visible in the surrounding code) **override** this guide
wherever they conflict; this guide governs everything they leave unspecified.
When in doubt, match the code you are editing.

Rules are grouped **General**, **HTML**, **JavaScript**, **Accessibility**,
**Assets & Performance**, **SASS/CSS** and **File & folder names**. Each rule
is stated as an actionable instruction; ✅ / ❌ mark do / don't.


## General

### Language
- Write **all** code in English: class names, id names, comments, variable
  names, file names. No German identifiers.

### Progressive enhancement
- Build so the markup is **usable without CSS or JavaScript**. Treat the
  native platform as the source of truth (native elements, native form
  validation, real links) and let script and styles **fill gaps**, not
  replace the base layer.
- State driven by JS is expressed by toggling a **state class or `data-`
  attribute** (see the `is-`/`has-` namespace), never by writing inline
  styles — so appearance stays owned by CSS.

### Modules & reuse
- A **module** is *placed*: it brings its own markup, which would have no
  reason to exist without it, and it occupies a region of the page (the
  masthead, the main navigation, the footer, an on-page table of contents).
  A **component** is *attached*: it wraps, annotates or reinforces a host that
  is complete and usable without it, and it is the shared vocabulary reused
  across unrelated modules (a button, a link, a dialog, a tooltip). A
  **function** is neither — it only enhances existing markup with state
  classes/attributes and owns no vocabulary at all, so it gets no prefix
  (a sticky-state observer, an input mask, a validation behaviour).
  Modules **compose** components; the precise decision rule and prefixes live
  in SASS/CSS › *BEM namespacing*.
- A module (and a component) must look **consistent regardless of where it
  sits** in the layout. It therefore owns only its *intrinsic* look, never its
  *position* in a parent. Where it sits — `order`, `flex-basis`, the margins
  that space it against its neighbours — is the **host's** concern.
- **Module-in-module (slot rule).** When a module hosts another module, the
  parent does **not** reach into the child to position it. Instead the parent
  provides a dedicated **slot element** (a BEM element of the parent, e.g.
  `m-topbar__nav`) that carries all the positioning, and the child module lives
  *inside* that slot untouched. So the child stays layout-agnostic and looks
  the same wherever it is placed.
- When an element needs to look different in some context, build it as a
  **modified version** of the same block (a modifier), not a new element.

### Separation of concerns
- Keep **structure (HTML)**, **appearance (CSS)** and **behaviour (JS)**
  strictly separated. No inline styles, no inline event handlers, no
  presentational markup driven from JS.

### Semantics
- Use semantic tags and semantic class names.
- Prefer **full words over abbreviations** (`button` not `btn`,
  `navigation` not `nav` in identifiers).

### Naming scheme
- Every class name carries a **namespace prefix** (see SASS/CSS › *BEM
  namespacing*) and follows the BEM shape
  `prefix-blockName__elementName--modifierName` (element and modifier are
  optional).
- Each name **part** is written in **camelCase** for compound words
  (`m-userCard__avatarImage--large`). This rule fixes only the casing of the
  parts; the full BEM structure is defined in SASS/CSS › *BEM namespacing*.

### Upper / lower case
- HTML tags: **lower case**.
- Compound identifiers: **camelCase**.

### Charset
- Use **UTF-8** everywhere. Declare it with the corresponding meta tag in HTML.

### Indentation
- **Two spaces** per indentation level. Never tabs.

### Comments
- Strive for self-explanatory code. Write a comment **only** when the code
  itself cannot express the intent.
- **Wrap comment *text* at 78 characters** per line so it never wraps awkwardly
  in a narrow editor pane. Applies to JS block/line comments, SCSS comments and
  HTML comment banners. The code itself is **not** hard-wrapped.
- **One blank line before a leading comment inside a block** — the same rule in
  both languages: see JavaScript › *Comments* and SASS/CSS › *Comments*.

### Whitespace
- **One** blank line to separate block elements where it improves readability.
- **Three** blank lines to separate larger, logically distinct blocks. The
  wide gap is deliberate: it makes top-level section boundaries obvious at a
  glance when scrolling a long file, in a way a single blank line does not.


## HTML

### Document type
- Use valid **HTML5**. First line of every page:

```html
<!DOCTYPE html>
```

### Data & JS hooks
- **Use `data-` attributes as JavaScript hooks** — both for selecting elements
  and for passing data (e.g. `data-js-behavior="accordion"`,
  `data-inputcharcount`). `data-js-behavior` names one or more lazily-loaded
  behaviours to attach; the word "behaviour" is deliberate so the JS hook never
  clashes with the semantic meaning of *module* (see SASS/CSS › *BEM
  namespacing*).
- **Do not use `js-` prefixed classes as hooks.** Classes are for styling only;
  keep the JS binding out of the class list.
- Never bind behaviour to a styling class either — a `data-` attribute and its
  matching style/state class stay independent, so restyling never breaks the
  hook and vice versa.

### Entities
- Prefer **UTF-8 unicode characters** over HTML entities wherever possible.

### Attribute order
List attributes in this sequence:

1. `id`
2. `class`
3. `name`
4. `src` / `for` / `href` / `value`
5. `title` / `alt`
6. `type`
7. `placeholder`
8. `role` / `aria-*`
9. `data-*`
10. `tabindex`

- When present, put `target` **directly after `href`**.

### Type attribute
- **Omit** `type` on `<style>`/`<script>` — `text/css` and `text/javascript`
  are the HTML5 defaults.

### Link targets
- ✅ `javascript:;` may be used as a **placeholder `href` in development
  templates**. It **must** be replaced by a concrete link **before
  production** (or the anchor turned into a `<button type="button">` when it
  really triggers an action) — a `javascript:` URI is also blocked under a
  strict Content-Security-Policy.
- ❌ Never use `#` as an `href` — it causes the page to scroll.

### Quotes & spaces
- Always use **double quotes** for HTML attributes.
- **No spaces** around `=` in attributes.

```html
<a class="c-link" href="javascript:;">Label</a>
```

### Self-closing tags
- **Omit** the optional trailing slash on self-closing tags:

```html
<img class="m-media__image" src="photo.jpg" alt="Description">
```


## JavaScript

### Language level & modules
- Author in modern **ES modules** — one module per file. No code on the global
  scope and no implicit globals.
- Load behaviour as `<script type="module">` or with `defer`; never
  render-blocking, never inline (see General › *Separation of concerns*).

### Declarations
- Use `const` by default, `let` only when a binding is genuinely reassigned.
  **Never `var`.**
- Use strict equality (`===` / `!==`); never the coercing `==` / `!=`.

### Naming
- `camelCase` for variables and functions; `PascalCase` for classes and
  component constructors.
- **Constants use the same `camelCase`** as any other binding — do **not**
  use `UPPER_SNAKE_CASE`.
- Prefer full words over abbreviations (see General › *Semantics*).

### Quotes & semicolons
- Prefer **single quotes** wherever possible; switch quote style only to avoid
  escaping (e.g. a string that itself contains an apostrophe). Use **template
  literals** for interpolation, not string concatenation.
- Terminate statements with a **semicolon**.

### Comments
- **One blank line before a leading comment inside a block.** When a block opens
  with a comment, separate it from the opening line with a blank line, so the
  comment reads as its own unit instead of sticking to the `function` / `if` /
  `catch` line. Mirrors SASS/CSS › *Comments*.

```js
// ❌ comment glued to the opening line
handleInput = (event) => {
  // Let IME composition finish before we rewrite the value.
  if (event.isComposing) return;
};

// ✅ blank line between the opening line and the leading comment
handleInput = (event) => {

  // Let IME composition finish before we rewrite the value.
  if (event.isComposing) return;
};
```

- Applies to **every** block that opens with a comment: function, method and
  class bodies, `if` / `else if` branches, loops, `switch` cases, `try` /
  `catch` / `finally`, callback bodies and object / array literals.
- **No exception for a comment-only block.** A block whose entire content is
  the comment — an intentionally empty `catch`, a deliberate no-op branch —
  keeps the blank line as well, so the shape stays uniform and adding code
  later changes nothing.

```js
try {
  id = decodeURIComponent(raw);
} catch {

  // Not decodable, so the raw fragment is the best guess there is.
}
```

- A comment that sits *between* statements needs no extra line: it belongs to
  the group it introduces and rides on that group's blank line.
- The file-level block header (`/** … */`) is not inside a block and is
  unaffected.

### Control flow
- **Do not use `else`.** Return early with guard clauses and let the happy
  path fall through at the top level of the function. This keeps nesting flat
  and every precondition visible up front.

```js
// ✅ guard clauses, no else
function priceFor(user) {
  if (!user) return 0;
  if (user.isMember) return memberPrice;
  return listPrice;
}
```

- Prefer `async` / `await` over long `.then()` chains; handle failure with
  `try` / `catch`.

### Events & the DOM
- Bind behaviour with `addEventListener`; never inline `on*` handlers in
  markup, and never drive presentational markup from JS (see General ›
  *Separation of concerns*).
- Select elements and read data through **`data-` attributes**, not styling
  classes (see HTML › *Data & JS hooks*). Express state changes by toggling a
  state class / `data-` attribute, not by writing inline styles.


## Accessibility

Accessibility is a baseline requirement, not a per-component afterthought.

- **Semantic HTML first.** Reach for the native element that already carries
  the role and behaviour (`<button>`, `<a>`, `<nav>`, `<label>`, `<dialog>`)
  before adding ARIA — native semantics bring keyboard and focus behaviour for
  free.
- **ARIA only to fill gaps.** Add `role` / `aria-*` only when no native
  element expresses the semantics, and never duplicate a role the element
  already has (no `<button role="button">`). Follow the ARIA Authoring
  Practices for the widget.
- **Keyboard operable.** Every interactive control works with the keyboard
  alone, in a logical tab order. Do not remove the focus indicator without
  replacing it with a clearly visible one.
- **Names & text alternatives.** Every control has an accessible name; every
  informative image has a meaningful `alt`; decorative images use `alt=""`.
- **Contrast.** Meet WCAG AA contrast for text and meaningful UI.
- **Respect user preferences.** Honour `prefers-reduced-motion` (make motion
  optional or instant) and never block or override zoom.
- **State is announced.** When JS changes state, reflect it into ARIA
  (`aria-expanded`, `aria-invalid`, `aria-describedby`, …) rather than only
  styling it.


## Assets & Performance

- **Images.** Serve responsive images (`srcset` / `sizes`) and modern formats
  (AVIF / WebP with a fallback). Lazy-load below-the-fold images with
  `loading="lazy"`, and give every `<img>` intrinsic `width` / `height` (or an
  `aspect-ratio`) so layout space is reserved and nothing shifts.
- **Scripts.** Load JavaScript as `<script type="module">` or with `defer` —
  never render-blocking. Prefer one lazily-loaded bundle per feature over a
  single monolith where the build allows it.
- **Fonts.** Self-host and subset fonts; set `font-display: swap` (or
  `optional`) so text is never invisible while a font loads, and preload the
  critical font.
- **CSS.** Keep the critical path small; defer non-critical CSS.


## SASS / CSS

### Syntax: SCSS
- Use **SCSS syntax** (with braces). Indent correctly regardless.

### Partials & structure
- Use **partials** to structure SCSS. Partial names start with an underscore
  (`_buttons.scss`).
- **One partial per UI component or module.**
- The **underscore encodes load strategy**, independently of the `m-`/`c-`
  role: a `_name.scss` **partial** is `@use`d into a bundle (it rides along
  with whatever includes it — normally the core stylesheet), whereas a
  non-partial `name.scss` **entry** compiles to its own file for on-demand
  loading. Both a module and a component may be either.

### ITCSS architecture
Group partials in this order (increasing specificity / decreasing reach):

1. `a_tools` — mixins, functions
2. `b_settings` — variables, config
3. `c_generic` — resets, normalize
4. `d_base` — bare element styles
5. `e_objects` — layout objects
6. `f_components` — reusable UI components (`c-`)
7. `g_modules` — standalone, once-per-page modules (`m-`)
8. `h_utilities` — helpers, overrides

The folder a class lives in mirrors its semantic role (component vs module),
**not** how it is bundled — bundling is a separate axis, see *Build / compile
pipeline* below.

### BEM namespacing
Prefix every class by its role:

| Prefix    | Role       | Notes                                   |
| --------- | ---------- | --------------------------------------- |
| `o-`      | object     | abstract, reusable layout               |
| `m-`      | module     | a *placed* entity that occupies a region and brings its own markup (topbar, navigation, footer, table of contents) |
| `c-`      | component  | an *attached*, module-independent building block (button, link, dialog, tooltip) |
| `u-`      | utility    | one very specific style                 |
| `v-`      | vendor     | third-party code                        |
| `is-`/`has-` | state   | conditional styling                     |

- BEM structure: `block__element--modifier`.
- **`m-` vs `c-` is purely semantic**, and one question settles it: **is there
  a host that is already complete without this thing?**
  - **No → `m-` (module).** It is *placed*. Its markup exists only because it
    does, and it occupies a region of the page (`m-topbar`, `m-nav`,
    `m-footer`, `m-toc`, an accordion, a lightbox).
  - **Yes → `c-` (component).** It is *attached* to that host — a full text it
    cuts down, a plain table it makes sortable, a native field it dresses, a
    control it explains (`c-button`, `c-link`, `c-dialog`, `c-tooltip`).
  - **Neither, and it owns no vocabulary → no prefix (function).** It writes
    only state classes/attributes onto existing markup and leaves the look to
    the project. Where such a behaviour ships a ready-made look anyway, that
    look is a `c-` component or an `o-` object in its own right — the
    behaviour neither needs nor reads it.

  Supporting signals: a module usually manages a **collection or a region**
  (n panels, n images, n messages) while a component treats **one** host; and
  a component is what an unrelated feature reuses verbatim. Modules
  **compose** components; a component never depends on a specific module.
  A trigger-invoked overlay with no footprint in the page flow (dialog,
  popover, tooltip) is a **component**, not a module — it occupies no region.
- **The prefix does not decide bundling, nor how much CSS ships.** Both are
  **independent** axes. A `m-` module can live in the core bundle (a site-wide
  one like `m-topbar`) and a `c-` component can compile to its own on-demand
  file (a page-specific one like `c-dialog`) — see *Build / compile pipeline*.
  And a module may ship almost no CSS (a widget that leaves every visual to
  the project) while a component ships hundreds of lines: a component that
  *leaves* the design to the project is still a component, whereas a function
  is one that has **no** vocabulary to leave.
- **The block, not the folder, carries the prefix.** One delivery unit may
  ship several blocks with different roles.
- **No `js-` hook classes.** JavaScript binds to `data-` attributes, not to
  classes (see HTML › *Data & JS hooks*).

### Paths
- Always reference the **path variables defined in `_settings.scss`**; never
  hard-code paths.

### Colours
- Two-step process: (1) name the colours, (2) define variables **by function**
  (semantic) that reference the named colours.

### Media queries
- Write **mobile first**.
- Use the predefined **media-query mixins**.
- Place viewport-dependent styles **directly after** the initial definition of
  the property they override.
- **Query the capability you actually mean, not a proxy for it.** A
  viewport-size query must not stand in for a device's interaction ability —
  e.g. don't gate hover styles behind a width breakpoint; ask whether the
  device can actually hover (`@media (hover: hover)`, and where relevant
  `pointer: fine`) instead. Match the query feature to the property you are
  styling.

```scss
// ❌ width is a poor proxy — a large touch screen still gets a
//    hover style it cannot trigger cleanly
@media (min-width: 60rem) {
  .c-card:hover { scale: 1.02; }
}

// ✅ ask the device whether it can actually hover
@media (hover: hover) {
  .c-card:hover { scale: 1.02; }
}
```

### Vendor prefixes
- ❌ Don't write them. The build takes care of prefixing, driven by the
  project's `browserslist` targets.

### Nesting
- ❌ Don't nest — **except**:
  - pseudo-classes / pseudo-elements
  - styles that react to an `is-`/`has-` state class
  - viewport-dependent styles (media-query mixins)
- ✅ **BEM elements and modifiers are written inside their block** as
  `&__element` / `&--modifier`. That is selector *concatenation*, not
  descendant nesting: it compiles to `.m-block__element`, identical selector
  and identical specificity to the flat form — which is what BEM is for. The
  block therefore holds its own token declarations and all of its parts:

  ```scss
  .m-block {
    --block-gap: var(--space-s);



    &__element { … }



    &--modifier &__element { … }
  }
  ```

  Every block on this level sits three blank lines below whatever precedes it —
  see *Formatting rules*.

  A selector that is *not* relative to the block (a foreign class, an
  attribute hook on a script-injected node) stays outside it — nested, it
  would become a descendant selector and change what it matches.

### `@extend`
- ❌ Don't use `@extend`.

### Magic numbers
- ❌ Avoid. If unavoidable, **comment extensively** explaining the value.

### Quotes
- Use **single quotes** in SCSS.
- **No quotes** inside `url()`.

### Comments
- In SCSS use **single-line comments only** (`//`).
- **One blank line before a leading comment inside a block.** When a
  declaration block opens with a comment, separate it from the opening brace
  with a blank line, so the comment reads as its own unit instead of sticking
  to the selector line. The same rule holds in JS (see JavaScript ›
  *Comments*).

```scss
// ❌ comment glued to the selector line
.m-dropdownNav {
  // Animation maps to the shared animation tokens.
  --dropdownNav-duration: calc(var(--an-duration) / 2);
}

// ✅ blank line between brace and leading comment
.m-dropdownNav {

  // Animation maps to the shared animation tokens.
  --dropdownNav-duration: calc(var(--an-duration) / 2);
}
```

- Applies to **every** block that opens with a comment — nested pseudo-class,
  state and media-query blocks and `& { … }` wrappers included — and it is the
  one blank line a **compact selector** keeps (see *Formatting rules*).
- A comment that sits *between* declarations needs no extra line: it belongs to
  the concern group it introduces and rides on that group's blank line.

### Formatting rules
- One selector per line.
- One property per line.
- End every declaration with a semicolon.
- One space before the opening brace.
- One space after the colon in a declaration.
- One space around operators in arithmetic.
- **Omit units on `0` values** (`margin: 0;` not `0px`).
- Separate top-level declarations / rules with **three** blank lines.
- **Every selector block on the first level inside a top-level selector gets
  three blank lines** before it. Not just BEM elements — `&__element`,
  `&--modifier`, `&:hover`, `&::backdrop`, `&[data-x]`, `&[data-x] &__element`,
  `> :first-child`, a foreign descendant: they are all parts of the block in
  their own right, the same kind of boundary a top-level rule marks, so they
  read at the wide gap (see General › *Whitespace*). That is what makes a long
  stylesheet's outline scannable. Where the block carries a leading comment the
  gap goes **above the comment**: it introduces the block and belongs to it.
- **Deeper than the first level, everything keeps one blank line** — concern
  groups, and the pseudo-class / pseudo-element / state / media-query blocks
  nested inside a first-level block. The wide gap marks where a part of the
  block starts, never anything within it.
- Three things on the first level stay at **one** blank line:
  - **A block that is the first thing in its parent**, right after the opening
    brace — there is nothing to separate it from, and a wide gap would only push
    it away from the selector it belongs to. (It is the same single line a
    leading comment gets anyway, see *Comments*.)
  - **The `& { … }` wrapper** that holds the parent's own declarations after an
    `@include` (see *`@include` followed by declarations*). It is the block's
    body, not a part of it.
  - **At-rule blocks** — `@media`, the media-query mixins, `@starting-style`.
    They are conditions wrapped around the block, not parts of it.

```scss
.m-offCanvasNavToggle {

  // First in the block — one blank line, no wide gap.
  @include focus-ring(light);

  // The block's own declarations — the wrapper stays close too.
  & {
    cursor: pointer;
    display: inline-flex;
  }



  // Every part that follows opens on three, its comment included.
  &__burger {
    inline-size: var(--offCanvasNavToggle-bar-inline);

    // Nested one level deeper: back to a single blank line.
    &::before {
      translate: 0 calc(var(--offCanvasNavToggle-bar-gap) * -1);
    }

    &::after {
      translate: 0 var(--offCanvasNavToggle-bar-gap);
    }
  }



  &[data-offcanvasnav-open] &__burger {
    background-color: transparent;
  }



  &:hover {
    background-color: var(--offCanvasNavToggle-bg-color-hover);
  }
}
```

- **Compact selectors:** when a selector holds no more than three
  `property: value` declarations, drop all blank lines inside it so the
  declarations sit directly one after another. The single exception is the
  blank line before a leading comment (see *Comments*). This governs the space
  *inside* a selector — the three lines before a `&__elementName` are unaffected
  by how short that element's block is.

```scss
.c-badge {
  position: relative;
  display: inline-block;
  color: $color-text;
}
```

### Element order within a selector
1. `@include`s
2. layout position
3. general styles (the detailed sequence is in *Property order within a rule*)
4. viewport (media-query) styles
5. pseudo-classes / pseudo-elements

### `@include` followed by declarations
When a selector starts with one or more `@include`s **and** also holds its own
declarations, wrap those declarations in a nested `& { … }` block right after
the includes. Modern Dart Sass follows the CSS nesting spec, where a bare
declaration that comes *after* a nested rule (which a mixin's output can be) is
reordered and triggers the `mixed-decls` deprecation. The `& { … }` wrapper
pins the declarations back into source order and silences the warning.

```scss
// ❌ bare declarations after an @include — reordered, deprecation warning
.m-card {
  @include shadow-soft;
  padding: 1rem;
  color: $color-text;
}

// ✅ declarations wrapped in `& { }` — source order preserved
.m-card {
  @include shadow-soft;

  & {
    padding: 1rem;
    color: $color-text;
  }
}
```

- Only the declarations that follow the `@include`(s) go inside `& { }`;
  pseudo-class, state and viewport blocks stay as their own nested rules after
  it, exactly as before.
- A selector that is **only** `@include`s (no own declarations) needs no
  wrapper.


### Property order within a rule
Order declarations by concern, and within the box model from the **outside
in**. Separate each concern group below from the next with **one blank line**
(subject to the compact-selector exception above):

1. **Layout position** — `position`, `inset` / `top`·`right`·`bottom`·`left`,
   `z-index`, `display`. **Exception:** `display: flex` / `display: grid`
   moves down into group 4 (see there).
2. **Cursor & pointer events** — `cursor`, `pointer-events`. They sit
   **between layout position and the box model**.
3. **Box model, outside → inside** — `margin`, then `border`, then `padding`,
   then `width`/`height` (`inline-size`/`block-size`). Place `overflow: hidden`
   **here**, right next to the box property whose purpose makes the clipping
   obviously needed — not in a group of its own — so the *reason* for clipping
   is readable at a glance.
4. **Flexbox / grid** — when the element is a flex or grid container, its
   `display: flex` / `display: grid` moves out of group 1 and becomes the
   **first line of this group**, followed by the child layout
   (`flex-direction`, `gap`, `justify-*`, `align-*`, `grid-template-*`).
5. **Typography** — `font-*`, `line-height`, `letter-spacing`, `white-space`
   and other text styling.
6. **Colours** — `color` first, then `background-color`. **Never use the
   `background` shorthand for a plain colour** — always `background-color`, so
   a colour change can never silently reset an image / gradient / position set
   elsewhere.
7. **Transforms** — prefer the **modern individual longhands** (`scale: 1.5`,
   `rotate: 45deg`, `translate: 0 1rem`) over the legacy
   `transform: scale(…)` shorthand.
8. **Transition** — `transition` (and any `animation`) last.

```scss
.m-card {
  @include shadow-soft;

  & {
    position: relative;
    z-index: 1;

    cursor: pointer;

    margin-block-end: 1rem;
    border: 1px solid $color-border;
    padding: 1rem;
    inline-size: 100%;
    overflow: hidden;

    display: flex;
    gap: 0.5rem;

    font-family: $font-body;
    line-height: 1.4;

    color: $color-text;
    background-color: $color-surface;

    scale: 1;
    transition: scale $an-duration $an-ease;
  }

  &:hover {
    scale: 1.02;
  }
}
```

### Build / compile pipeline
The build tool should: compile SCSS with **Dart Sass** → autoprefix (targets
from `browserslist`) → generate a source map → minify. Transfer compression
(Brotli / gzip) is the server's or CDN's job, not the build's.

**Output split (bundle strategy).** Bundling follows *how often a style is
needed*, which is **independent** of the `m-`/`c-` role. The build emits:

- **One core stylesheet** bundling everything needed on (almost) every page —
  the base styles (ITCSS `c_generic` → `e_objects`), all reusable `c-`
  components, the **site-wide** `m-` modules (masthead, navigation, footer) and
  `h_utilities`. It is loaded on every page. (`a_tools` / `b_settings` are
  `@use`d for their tools/variables, not emitted as CSS.)
- **One on-demand stylesheet per page-specific piece**: anything needed only on
  some pages compiles to its own CSS file that the CMS includes **only on the
  pages that use it** — whether that piece is a module (`m-toc`) or a component
  (`c-dialog`).

Which side a piece lands on is expressed by the partial-vs-entry convention
(see *Partials & structure*): a `_partial.scss` is `@use`d into the core
bundle; a non-partial `entry.scss` is registered as its own build entry.

Because an on-demand file loads individually, its partial must be
**self-contained**: it may `@use` the shared tools/settings but must not depend
on another module's or component's emitted styles. Anything shared across the
site belongs in the core bundle (a `c-` component, or a site-wide `m-`
module), not duplicated into a page-specific file.


## File & folder names

File and folder names are **camelCase**:

- Single words stay lowercase: `accordion`, `countdown`, `dialog`, `tabs`.
- Multi-word names: first letter lowercase, every subsequent word capitalized
  — `dateInputFormat`, `stickyObserver`.
- **Abbreviations are fully uppercased**: `inlineSVG`, `scaleSVG` (not `Svg`).
- **Prefixes are preserved**, only the part after them is camelCased:
  `dev_pageInfo.js`, `dev_qrCode.js`; `_shared/` keeps its leading underscore.
