# marquee

Endlos laufender Lauftext (Marquee).

## Zum Kopieren benötigt
- `marquee.html` – Markup
- `marquee.scss` – Styles (Quelle; wird zu `dist/css/marquee.min.css` kompiliert)
- `marquee.js` – Verhalten
- geteilt: `_shared/js/debounce.js` (im Zielprojekt mitkopieren)

## Einbindung
Das Fragment aus `marquee.html` an die gewünschte Stelle kopieren. Der äußere Container trägt `data-js-module="marquee"` und enthält ein `[data-marquee-container]` mit dem laufenden `[data-marquee-animated]`-Element; die Animation wird beim Boot automatisch initialisiert.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
