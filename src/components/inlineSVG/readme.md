# inlineSVG

Ersetzt img-Referenzen durch inline eingebettetes SVG.

## Zum Kopieren benötigt
- `inlineSVG.html` – Markup
- `inlineSVG.scss` – Styles (Quelle; wird zu `dist/css/inlineSVG.min.css` kompiliert)
- `inlineSVG.js` – Verhalten

## Einbindung
`data-js-module="inlineSVG"` wird entweder direkt auf ein `<img>`-Element gesetzt oder auf einen Container, der ein oder mehrere `<img>`-Elemente enthält. Nur Bilder mit einer `.svg`-Quelle (`src`) werden per `fetch` geladen und durch ein echtes inline `<svg>` ersetzt. Vorhandene Attribute wie `id`, `class`, `aria-label`, `width`, `height` und `data-scale` werden übernommen; interne SVG-IDs werden automatisch mit einem eindeutigen Präfix versehen, um Kollisionen zu vermeiden. Der SVG-Abruf unterliegt der Same-Origin-Policy.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
