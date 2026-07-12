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
- Treat page elements as **reusable modules**. A module must look consistent
  regardless of where it sits in the layout.
- When an element needs to look different in some context, build it as a
  **modified version** of the same module (a modifier), not a new element.

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
  and for passing data (e.g. `data-js-module="accordion"`, `data-inputcharcount`).
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
- **One partial per UI component.**

### ITCSS architecture
Group partials in this order (increasing specificity / decreasing reach):

1. `a_tools` — mixins, functions
2. `b_settings` — variables, config
3. `c_generic` — resets, normalize
4. `d_base` — bare element styles
5. `e_objects` — layout objects
6. `f_components` — UI components
7. `g_utilities` — helpers, overrides

### BEM namespacing
Prefix every class by its role:

| Prefix    | Role       | Notes                                   |
| --------- | ---------- | --------------------------------------- |
| `o-`      | object     | abstract, reusable layout               |
| `m-`      | module     | self-contained UI unit (teaser, facts block) |
| `c-`      | component  | module-independent reusable building block (button, tag) |
| `u-`      | utility    | one very specific style                 |
| `v-`      | vendor     | third-party code                        |
| `is-`/`has-` | state   | conditional styling                     |

- BEM structure: `block__element--modifier`.
- **`m-` vs `c-`.** `m-` is a **module** — a self-contained UI unit that
  stands on its own (`m-teaser`, `m-factsBlock`, `m-hero`). `c-` is a
  **component** — a module-independent building block that can appear inside
  *any* module (`c-button`, `c-tag`, `c-copyright`). Modules **compose**
  components; a component never depends on a specific module. Decision rule:
  self-contained unit → `m-`; reusable building block used within modules →
  `c-`.
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

### Vendor prefixes
- ❌ Don't write them. Autoprefixer adds them at build time, driven by the
  project's `browserslist` targets.

### Nesting
- ❌ Don't nest — **except**:
  - pseudo-classes / pseudo-elements
  - styles that react to an `is-`/`has-` state class
  - viewport-dependent styles (media-query mixins)

### `@extend`
- ❌ Don't use `@extend`.

### Magic numbers
- ❌ Avoid. If unavoidable, **comment extensively** explaining the value.

### Quotes
- Use **single quotes** in SCSS.
- **No quotes** inside `url()`.

### Comments
- In SCSS use **single-line comments only** (`//`).

### Formatting rules
- One selector per line.
- One property per line.
- End every declaration with a semicolon.
- One space before the opening brace.
- One space after the colon in a declaration.
- One space around operators in arithmetic.
- **Omit units on `0` values** (`margin: 0;` not `0px`).
- Separate pseudo-class / viewport selector blocks with **one** blank line.
- Separate top-level declarations / rules with **three** blank lines.
- **Compact selectors:** when a selector holds no more than three
  `property: value` declarations, drop all blank lines inside it so the
  declarations sit directly one after another.

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

**Output split (bundle strategy).** The build emits two kinds of stylesheet:

- **One core stylesheet** bundling everything shared across the whole site —
  the base styles (ITCSS `c_generic` → `e_objects`), all `c-` **components**
  and `g_utilities`. It is loaded on every page. (`a_tools` / `b_settings` are
  `@use`d for their tools/variables, not emitted as CSS.)
- **One stylesheet per module** (`m-*`): each module compiles to its own CSS
  file that the CMS includes **only on the pages that actually use that
  module**, on demand.

Because modules load individually, a module's partial must be
**self-contained**: it may `@use` the shared tools/settings but must not
depend on another module's styles. Anything reused across modules belongs in a
`c-` component (in the core bundle), not in one module.


## File & folder names

File and folder names are **camelCase**:

- Single words stay lowercase: `accordion`, `countdown`, `dialog`, `tabs`.
- Multi-word names: first letter lowercase, every subsequent word capitalized
  — `dateInputFormat`, `stickyObserver`.
- **Abbreviations are fully uppercased**: `inlineSVG`, `scaleSVG` (not `Svg`).
- **Prefixes are preserved**, only the part after them is camelCased:
  `dev_pageInfo.js`, `dev_qrCode.js`; `_shared/` keeps its leading underscore.
