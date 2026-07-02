# responsiveVideo

Wechselt Video-/Audioquellen je nach Viewport.

## Zum Kopieren benötigt
- `responsiveVideo.html` – Markup
- `responsiveVideo.scss` – Styles (Quelle; wird zu `dist/css/responsiveVideo.min.css` kompiliert)
- `responsiveVideo.js` – Verhalten
- geteilt: `_shared/js/debounce.js` (im Zielprojekt mitkopieren)
- geteilt: `_shared/js/getCssCustomProperty.js` (im Zielprojekt mitkopieren)

## Einbindung
Das Fragment aus `responsiveVideo.html` einfügen; `data-js-module="responsiveVideo"` gehört auf das `<video>`-Element. Die Quellen pro Viewport werden als JSON in `data-srcs` hinterlegt (Schlüssel `mobile`/`tablet`/`desktop`, optional mit `Retina`-Suffix); beim Boot wählt das Modul anhand der CSS-Custom-Properties `--viewportName` und `--density` die passende Quelle.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
