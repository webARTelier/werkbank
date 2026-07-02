# dateInputFormat

Formatiert Datumseingaben während der Eingabe.

## Zum Kopieren benötigt
- `dateInputFormat.html` – Markup
- `dateInputFormat.scss` – Styles (Quelle; wird zu `dist/css/dateInputFormat.min.css` kompiliert)
- `dateInputFormat.js` – Verhalten

## Einbindung
Das Markup-Fragment in die Seite kopieren. Das Root-Element trägt `data-js-module="dateInputFormat"`, das zu formatierende `<input>` das Attribut `data-dateinputformat`. Beim Tippen wird der Wert automatisch zu `TT.MM.JJJJ` formatiert.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
