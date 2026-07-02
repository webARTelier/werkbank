# tabs

Tab navigation with switchable content.

## Files needed to copy
- `tabs.html` – markup
- `tabs.scss` – styles (source; compiled to `dist/css/tabs.min.css`)
- `tabs.js` – behavior

## Usage
The wrapping element gets `data-js-module="tabs"`. Inside it, each tab title gets the `data-tab-title` attribute along with `data-content="<id>"`, which points to a content element with a matching `id` and the `data-tab-content` attribute. The first tab opens automatically; a specific tab can be activated directly via the URL hash (`#<id>`).

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
