# UI Components

A collection of small, self-contained, framework-free UI components built on
modern web platform features. Each component is plain JavaScript (ES modules)
plus SCSS, wired to the page through a tiny loader — no framework, no runtime
dependencies.

The collection is both a **component library to copy from** and a **workbench**:
every component ships with a live demo, a copy-paste snippet and its own
readme, and `index.html` at the project root is a gallery linking to all demos.

## Who it's for

- **Agencies and freelancers in client work.** If you ship many different
  sites — often on a CMS like WordPress, TYPO3 or Shopware — and don't want to
  reinvent the accordion, dialog or tabs each time (nor pull a full framework
  into every project), these are ready-made blocks that drop into any stack,
  because they sit on plain HTML/CSS/vanilla JS.
- **Teams betting on the web platform.** For everyone who deliberately builds
  progressive-enhancement-first — HTML works without JS, CSS carries as much
  as it can (native Popover API, anchor positioning, `IntersectionObserver`,
  container queries) — and would rather stay on standards than on the
  framework upgrade treadmill.
- **The performance- and accessibility-conscious.** Per-component lazy loading
  keeps the eager payload tiny, and ARIA, keyboard operation and a visible
  focus ring are built in, not bolted on — a real time saver under a strict
  performance budget or WCAG requirements.
- **Learners and architecture-minded developers.** The clear conventions
  (camelCase, the component-standards checklist), the DI-vs-direct-import split
  and the modern build make this a readable, MIT-licensed reference for
  structuring maintainable vanilla-JS components.

Where it fits less well: teams deep in React, Vue or Angular that want a
state-driven design system with component props — there, the HTML-attribute
approach (`data-js-module="…"`) is more friction than help.

## Philosophy

### Progressive enhancement

The native platform is the source of truth; JavaScript only fills the gaps.
Components build on `<details>`/`<summary>`, `<dialog>`, the Popover API, the
Constraint Validation API, `IntersectionObserver`, `ResizeObserver`,
`@starting-style` transitions, and so on — instead of reimplementing them.

- **Without JavaScript the markup stays usable.** An accordion still opens and
  closes, a form still validates, anchor links still navigate.
- **JS never writes inline styles for state.** It toggles state classes or
  data attributes (`is-invalid`, `has-neighbor`, `aria-expanded`) and the CSS
  reacts. This keeps behaviour and presentation cleanly separated.
- **Animations are pure CSS enhancements** — older engines simply snap, and
  every animated component respects `prefers-reduced-motion`.

### Accessibility

Accessibility is non-negotiable, not a feature flag:

- State is reflected into ARIA following the ARIA APG pattern for each widget
  (`aria-expanded`, `aria-controls`, `aria-invalid`, `aria-current`, roles).
- Keyboard focus is visible via a shared, per-element `focus-ring()` mixin
  with tones for dark and light surfaces.
- Decorative generated output is hidden from assistive technology
  (`aria-hidden="true"`, `focusable="false"`); focusable regions always get an
  accessible name.

### Lean loading

One tiny script, `boot.min.js`, is the only eagerly loaded JS. It scans the
page for `data-js-module="…"` attributes and lazy-loads each component's
chunk only when the markup actually asks for it. A page that uses two
components downloads two chunks — nothing else.

## Components

| Component            | What it does                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `accordion`          | Expand/collapse panels on native `<details>`/`<summary>`.           |
| `adaptiveScrollFade` | Fade-out edges on scrollable containers, only where overflow is.    |
| `countdown`          | Live countdown to a target date/time.                               |
| `dateInputFormat`    | Auto-formats a text field into a grouped date mask (`DD.MM.YYYY`).  |
| `dialog`             | Modal dialogs on the native `<dialog>` element.                     |
| `flexNeighborMarker` | Marks flex items that have a neighbour on the same row.             |
| `formValidation`     | Inline validation messages on the Constraint Validation API.        |
| `inlineSVG`          | Replaces `<img>` SVG references with inline SVG.                    |
| `inputCharCount`     | Character-count display for inputs and textareas.                   |
| `marquee`            | Infinitely scrolling content strip (news ticker).                   |
| `popover`            | Anchor-positioned popover on the native Popover API.                |
| `scaleSVG`           | Scales SVGs from their `viewBox`.                                   |
| `scrollSpy`          | IntersectionObserver-driven TOC highlight via `aria-current`.       |
| `stickyObserver`     | Sentinel-driven "is stuck" class toggle for `position: sticky`.     |
| `tabs`               | ARIA tabs enhancement of an anchor-link table of contents.          |
| `video`              | CMS-maintainable video embeds with responsive sources.              |

Each folder under `src/components/<name>/` contains exactly:

| File          | Purpose                                                    |
| ------------- | ---------------------------------------------------------- |
| `<name>.js`   | Behaviour. Exports `init(el, services)`; never self-runs.  |
| `<name>.scss` | Styles (stub for behaviour-only components).               |
| `<name>.html` | Copy-paste snippet with wiring notes.                      |
| `demo.html`   | Standalone live demo using the built `/dist` assets.       |
| `readme.md`   | Usage, options, accessibility and integration notes.       |

## Building

```sh
npm install
npm run build   # compile SCSS + bundle JS into dist/
npm run dev     # build + watch
npm run clean   # remove dist/
```

The Gulp + Rollup + Lightning CSS build produces:

- `dist/js/boot.min.js` — the eager loader (composition root).
- `dist/js/modules/<name>.min.js` — one lazy chunk per component, with any
  pure `_shared/js/` utilities bundled in.
- `dist/css/shared.min.css` — design tokens (colors, spacing, animation) and
  base styles; required on every page.
- `dist/css/<name>.min.css` — per-component styles.

`_shared/js/registry.js` is auto-generated from the module file names at
build time — never edit it by hand.

## Using a component in your own project

### 1. Full setup (recommended)

Include the shared CSS, the CSS of the components you use, and the boot
loader — then tag your markup:

```html
<link rel="stylesheet" href="/dist/css/shared.min.css" />
<link rel="stylesheet" href="/dist/css/accordion.min.css" />
<script type="module" src="/dist/js/boot.min.js"></script>

<div data-js-module="accordion">
  <!-- markup from src/components/accordion/accordion.html -->
</div>
```

That's all the wiring there is:

- `boot.min.js` finds every `[data-js-module]` element and lazy-loads the
  matching chunk. Never import a component's JS yourself.
- Multiple modules on one element are comma-separated:
  `data-js-module="accordion,scrollSpy"`.
- Behaviour is configured through `data-*` attributes documented in each
  component's `readme.md` and snippet — all optional where possible.
- For markup inserted after page load (AJAX, template render), import
  `initModulesInScope` from the boot module and call it with the new
  container; a per-element double-init guard makes repeated calls safe.

Per-component theming happens through CSS custom properties: every stylesheet
declares a `:root` block of `--<name>-*` variables mapped to the shared
tokens — override those instead of the rules themselves.

### 2. Cherry-picking single files

Components are deliberately self-contained, so you can also copy them into a
project that has its own asset pipeline. Each `readme.md` lists the files
under **"Files needed to copy"** — typically the `.js`, the `.scss` and any
pure utility from `src/_shared/js/` the component imports (e.g.
`rafThrottle.js`). The JS exports a single `init(el, services)` and never
self-initializes, so it slots into any loader; `services.reporter` is
optional and only used for warnings — without it the module degrades
silently.

Note for behaviour-only components (`tabs`, `formValidation`,
`inputCharCount`, …): they ship a stub stylesheet by design and leave all
visuals — including the focus style — to the consuming project.

## Demos

Run `npm run build` once, then open `index.html` (the gallery) or any
component's `demo.html` in the browser.

## Further reading

- [`docs/componentStandards.md`](docs/componentStandards.md) — the authoring
  checklist every component follows (file set, `init` contract, JS/SCSS
  style, accessibility, demo/readme structure).
- [`CLAUDE.md`](CLAUDE.md) — naming conventions, DI vs. direct import, and
  the focus-ring convention.

## License

[MIT](LICENSE) — use, copy and adapt freely; just keep the copyright notice.

<br><br>
