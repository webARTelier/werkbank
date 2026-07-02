# accordion

Accordion-Komponente mit auf-/zuklappbaren Panels.

## Zum Kopieren benötigt
- `accordion.html` – Markup
- `accordion.scss` – Styles (Quelle; wird zu `dist/css/accordion.min.css` kompiliert)
- `accordion.js` – Verhalten
- geteilt: `_shared/js/getCssCustomProperty.js` (im Zielprojekt mitkopieren)

## Einbindung
Das Root-Element erhält `data-js-module="accordion"`. Jeder Titel bekommt `data-nav-widget-title` und ein `data-content`, das per gleichem Wert auf die `id` des zugehörigen `data-nav-widget-content`-Panels verweist. Optional: `data-type="openSingle"` (nur ein Panel gleichzeitig offen) und `data-scroll-into-view`.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
