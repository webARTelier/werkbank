# flexNeighborMarker

Marks neighboring elements in a flex container.

## Files needed to copy
- `flexNeighborMarker.html` – markup
- `flexNeighborMarker.scss` – styles (source; compiled to `dist/css/flexNeighborMarker.min.css`)
- `flexNeighborMarker.js` – behavior
- shared: `_shared/js/debounce.js` (copy along into the target project)

## Usage
The root element carries `data-js-module="flexNeighborMarker"`; the flex container (can be the same element) carries `data-markflex-container`. Elements that have a following neighbor in the same visual row automatically receive the class `has-neighbor`. The tolerance can optionally be controlled via `data-markflex-tolerance`.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
