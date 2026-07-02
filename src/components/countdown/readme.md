# countdown

Live-Countdown auf ein Zieldatum.

## Zum Kopieren benötigt
- `countdown.html` – Markup
- `countdown.scss` – Styles (Quelle; wird zu `dist/css/countdown.min.css` kompiliert)
- `countdown.js` – Verhalten

## Einbindung
Das Root-Element erhält `data-js-module="countdown"` sowie `data-countdown-date` mit dem Zieldatum (z. B. `2026-12-31T23:59:59`, wahlweise auch an einem Kindelement). Darin liegen die Ausgabe-Elemente mit `data-countdown-days`, `data-countdown-hours`, `data-countdown-minutes` und optional `data-countdown-seconds`, die sekündlich aktualisiert werden.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
