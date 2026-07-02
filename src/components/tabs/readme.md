# tabs

Tab-Navigation mit umschaltbaren Inhalten.

## Zum Kopieren benötigt
- `tabs.html` – Markup
- `tabs.scss` – Styles (Quelle; wird zu `dist/css/tabs.min.css` kompiliert)
- `tabs.js` – Verhalten

## Einbindung
Das umschließende Element erhält `data-js-module="tabs"`. Darin bekommt jeder Tab-Titel das Attribut `data-tab-title` samt `data-content="<id>"`, das auf ein Inhaltselement mit passender `id` und dem Attribut `data-tab-content` verweist. Der erste Tab wird automatisch geöffnet; per URL-Hash (`#<id>`) lässt sich ein bestimmter Tab direkt aktivieren.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
