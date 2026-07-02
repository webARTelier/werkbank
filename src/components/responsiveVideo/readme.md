# responsiveVideo

Switches video/audio sources depending on the viewport.

## Files needed to copy
- `responsiveVideo.html` – markup
- `responsiveVideo.scss` – styles (source; compiled to `dist/css/responsiveVideo.min.css`)
- `responsiveVideo.js` – behavior
- shared: `_shared/js/debounce.js` (copy it along into the target project)
- shared: `_shared/js/getCssCustomProperty.js` (copy it along into the target project)

## Usage
Insert the fragment from `responsiveVideo.html`; `data-js-module="responsiveVideo"` goes on the `<video>` element. The sources per viewport are stored as JSON in `data-srcs` (keys `mobile`/`tablet`/`desktop`, optionally with a `Retina` suffix); on boot the module selects the matching source based on the CSS custom properties `--viewportName` and `--density`.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
