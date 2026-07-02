# marquee

Infinitely scrolling text (marquee).

## Files needed to copy
- `marquee.html` – markup
- `marquee.scss` – styles (source; compiled to `dist/css/marquee.min.css`)
- `marquee.js` – behavior
- shared: `_shared/js/debounce.js` (copy it along into the target project)

## Usage
Copy the fragment from `marquee.html` to the desired location. The outer container carries `data-js-module="marquee"` and contains a `[data-marquee-container]` with the scrolling `[data-marquee-animated]` element; the animation is initialized automatically on boot.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
