# Changelog

All notable changes to werkbank are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
uses [Semantic Versioning](https://semver.org/): the markup, `data-`
attributes, custom properties and events a component documents only change
in a breaking way with a new major version.

## [1.0.0] — 2026-10-12

First public release: 37 framework-free UI components, each with a live
demo, a copy-paste snippet and its own readme.
See them all in the [online gallery](https://webartelier.codeberg.page/werkbank/).

### Navigation

- `backToTop` — Scroll-triggered jump back to top
- `dropdownNav` — Multi-level menus, ARIA disclosure
- `offCanvasNav` — Burger menu on the native dialog
- `scrollSpy` — Marks the section being read
- `siteSearch` — Search expanding out of a toggle
- `tabs` — ARIA tabs over an anchor-link TOC

### Overlays

- `dialog` — Modal and non-modal, native
- `lightbox` — Image and gallery viewer
- `popover` — Anchored, native Popover API
- `toast` — Transient live-region messages
- `tooltip` — Hoverable, dismissible hint

### Content

- `accordion` — Panels on details/summary
- `copyToClipboard` — One press, plus the announcement
- `countdown` — Live countdown to a target date
- `dataTable` — Responsive, sortable columns
- `filterList` — Client-side search over a list
- `loadFragment` — Loads a page region into a box
- `marquee` — Infinitely scrolling strip
- `readMore` — Clamped text with an expander

### Forms

- `autoGrowTextarea` — Grows with its content
- `comboBox` — Typeahead on input list + datalist
- `conditionalFields` — Field groups that follow another field
- `dateInputFormat` — Grouped date mask while typing
- `fileUpload` — Drop zone, file list, optional upload bars
- `formValidation` — Inline constraint messages
- `inputCharCount` — Character count for fields
- `numberInputFormat` — Grouped number while typing
- `passwordToggle` — Show/hide for password fields

### Media

- `embedConsent` — Third-party embeds behind consent
- `inlineSVG` — Swaps img refs for inline SVG
- `scaleSVG` — Sizes an SVG from its viewBox
- `video` — Responsive self-hosted video
- `slider` — Preset slider types, Swiper inside

### Scroll & layout

- `adaptiveScrollFade` — Fades only overflowing edges
- `flexNeighborMarker` — Marks items sharing a row
- `stickyObserver` — Marks a sticky element while pinned
- `revealOnScroll` — Reveals on entering the viewport

### Also in this release

- A loader (`boot.min.js`) that lazy-loads each component's chunk on
  demand, driven by `data-js-behavior`.
- A Gulp + Rollup + Lightning CSS build; `dist/` is committed, so the
  components work without building.
- The dev dashboard (`src/tools/dev_dashboard/`): page info, an a11y
  inspector, an overflow check, a QR code of the page, a srcset
  measurement and a form filler, loaded with one script line.
- Authoring docs: [`docs/componentStandards.md`](docs/componentStandards.md),
  [`docs/preEnhancement.md`](docs/preEnhancement.md) and
  [`docs/toolStandards.md`](docs/toolStandards.md).

[1.0.0]: https://codeberg.org/webARTelier/werkbank/releases/tag/v1.0.0
