# scaleSVG

Scales an inline SVG to its container.

## Files needed to copy
- `scaleSVG.html` – markup
- `scaleSVG.scss` – styles (source; compiled to `dist/css/scaleSVG.min.css`)
- `scaleSVG.js` – behavior

## Usage
Insert the fragment from `scaleSVG.html`; set `data-js-module="scaleSVG"` on an element that contains an inline `<svg data-scale="…" viewBox="…">` (or is such an SVG itself). On boot, the module computes the target size from `viewBox` and `data-scale` and sets the SVG's width/height.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
