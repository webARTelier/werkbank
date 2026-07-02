# adaptiveScrollFade

Adaptively fades content in and out while scrolling.

## Files needed to copy
- `adaptiveScrollFade.html` – markup
- `adaptiveScrollFade.scss` – styles (source; compiled to `dist/css/adaptiveScrollFade.min.css`)
- `adaptiveScrollFade.js` – behavior

## Usage
The scrollable container gets `data-js-module="adaptiveScrollFade"`. It must have a limited height and `overflow-y: auto` so that its content overflows. While scrolling, the module automatically applies a `mask-image` fade at the top and bottom edge – each only where hidden content still follows.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
