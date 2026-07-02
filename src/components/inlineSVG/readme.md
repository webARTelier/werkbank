# inlineSVG

Replaces img references with inline-embedded SVG.

## Files needed to copy
- `inlineSVG.html` – markup
- `inlineSVG.scss` – styles (source; compiled to `dist/css/inlineSVG.min.css`)
- `inlineSVG.js` – behavior

## Usage
`data-js-module="inlineSVG"` is set either directly on an `<img>` element or on a container that holds one or more `<img>` elements. Only images with an `.svg` source (`src`) are loaded via `fetch` and replaced with a real inline `<svg>`. Existing attributes such as `id`, `class`, `aria-label`, `width`, `height`, and `data-scale` are carried over; internal SVG IDs are automatically given a unique prefix to avoid collisions. The SVG fetch is subject to the same-origin policy.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
