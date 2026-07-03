# accordion

Accordion component with expandable/collapsible panels.

## Files needed to copy
- `accordion.html` – markup
- `accordion.scss` – styles (source; compiled to `dist/css/accordion.min.css`)
- `accordion.js` – behavior

## Usage
The root element gets `data-js-module="accordion"`. It is built on native `<details>`/`<summary>`, so the base functionality works without JavaScript — the JS only adds the smooth height animation in older browsers.

- Each panel is a `<details class="m-accordion__item" data-accordion-item>` containing a `<summary class="m-accordion__trigger">` and a `<div class="m-accordion__panel" data-accordion-panel>`.
- **Single-open mode** (only one panel open at a time): give every `<details>` in a group the same `name` attribute — this groups them natively like radio buttons.
- **Multi-open mode** (several panels open at once): omit the `name` attribute.

See `accordion.html` for a ready-to-copy snippet of both modes.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on demand by `boot.js` for every element carrying `data-js-module="accordion"`.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is only used for warnings (e.g. empty container). Without it the module degrades silently and the animation still works.

## Demo
Open `demo.html` in the browser.
