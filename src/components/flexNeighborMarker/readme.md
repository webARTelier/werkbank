# flexNeighborMarker

Markiert benachbarte Elemente in einem Flex-Container.

## Zum Kopieren benötigt
- `flexNeighborMarker.html` – Markup
- `flexNeighborMarker.scss` – Styles (Quelle; wird zu `dist/css/flexNeighborMarker.min.css` kompiliert)
- `flexNeighborMarker.js` – Verhalten
- geteilt: `_shared/js/debounce.js` (im Zielprojekt mitkopieren)

## Einbindung
Das Root-Element trägt `data-js-module="flexNeighborMarker"`; der Flex-Container (kann dasselbe Element sein) trägt `data-markflex-container`. Elemente, die in derselben visuellen Reihe einen nachfolgenden Nachbarn haben, erhalten automatisch die Klasse `has-neighbor`. Die Toleranz lässt sich optional über `data-markflex-tolerance` steuern.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
