# accordion

Accordion component with expandable/collapsible panels.

## Files needed to copy
- `accordion.html` – markup
- `accordion.scss` – styles (source; compiled to `dist/css/accordion.min.css`)
- `accordion.js` – behavior
- shared: `_shared/js/getCssCustomProperty.js` (copy it into the target project as well)

## Usage
The root element gets `data-js-module="accordion"`. Each title gets `data-nav-widget-title` and a `data-content` that references the `id` of the corresponding `data-nav-widget-content` panel via the same value. Optional: `data-type="openSingle"` (only one panel open at a time) and `data-scroll-into-view`.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
