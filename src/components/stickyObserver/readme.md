# stickyObserver

Observes sticky elements and marks their state.

## Files needed to copy
- `stickyObserver.html` – markup
- `stickyObserver.scss` – styles (source; compiled to `dist/css/stickyObserver.min.css`)
- `stickyObserver.js` – behavior

## Usage
The observed element (the "sentinel") gets `data-js-module="stickyObserver"`. As soon as it scrolls out of the viewport, the `is-fixed` class is set on the separate target element carrying the `data-sticky-oberserver-target` attribute (and removed again when scrolling back).

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
