# scaleSVG

Skaliert inline-SVG auf seinen Container.

## Zum Kopieren benötigt
- `scaleSVG.html` – Markup
- `scaleSVG.scss` – Styles (Quelle; wird zu `dist/css/scaleSVG.min.css` kompiliert)
- `scaleSVG.js` – Verhalten

## Einbindung
Das Fragment aus `scaleSVG.html` einfügen; `data-js-module="scaleSVG"` auf ein Element setzen, das ein inline-`<svg data-scale="…" viewBox="…">` enthält (oder selbst ein solches SVG ist). Beim Boot berechnet das Modul aus `viewBox` und `data-scale` die Zielgröße und setzt Breite/Höhe des SVG.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
