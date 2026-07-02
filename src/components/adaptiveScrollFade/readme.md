# adaptiveScrollFade

Blendet Inhalte adaptiv beim Scrollen ein und aus.

## Zum Kopieren benötigt
- `adaptiveScrollFade.html` – Markup
- `adaptiveScrollFade.scss` – Styles (Quelle; wird zu `dist/css/adaptiveScrollFade.min.css` kompiliert)
- `adaptiveScrollFade.js` – Verhalten

## Einbindung
Der scrollbare Container erhält `data-js-module="adaptiveScrollFade"`. Er muss eine begrenzte Höhe und `overflow-y: auto` besitzen, damit sein Inhalt überläuft. Das Modul setzt beim Scrollen automatisch eine `mask-image`-Ausblendung an oberem und unterem Rand – jeweils nur dort, wo noch verdeckter Inhalt folgt.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
