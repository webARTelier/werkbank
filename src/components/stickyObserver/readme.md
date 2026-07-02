# stickyObserver

Beobachtet sticky-Elemente und markiert deren Zustand.

## Zum Kopieren benötigt
- `stickyObserver.html` – Markup
- `stickyObserver.scss` – Styles (Quelle; wird zu `dist/css/stickyObserver.min.css` kompiliert)
- `stickyObserver.js` – Verhalten

## Einbindung
Das beobachtete Element (der „Wächter“) erhält `data-js-module="stickyObserver"`. Sobald es aus dem Viewport scrollt, wird auf dem separaten Ziel-Element mit dem Attribut `data-sticky-oberserver-target` die Klasse `is-fixed` gesetzt (und beim Zurückscrollen wieder entfernt).

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
