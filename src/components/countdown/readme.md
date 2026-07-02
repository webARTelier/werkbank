# countdown

Live countdown to a target date.

## Files needed to copy
- `countdown.html` – markup
- `countdown.scss` – styles (source; compiled to `dist/css/countdown.min.css`)
- `countdown.js` – behavior

## Usage
The root element gets `data-js-module="countdown"` as well as `data-countdown-date` with the target date (e.g. `2026-12-31T23:59:59`, optionally on a child element too). Inside it are the output elements with `data-countdown-days`, `data-countdown-hours`, `data-countdown-minutes` and optionally `data-countdown-seconds`, which are updated every second.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
