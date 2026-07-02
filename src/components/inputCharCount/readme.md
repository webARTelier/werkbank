# inputCharCount

Zeigt die Zeichenanzahl eines Eingabefeldes an.

## Zum Kopieren benötigt
- `inputCharCount.html` – Markup
- `inputCharCount.scss` – Styles (Quelle; wird zu `dist/css/inputCharCount.min.css` kompiliert)
- `inputCharCount.js` – Verhalten

## Einbindung
`data-js-module="inputCharCount"` wird auf einen Container (oder direkt auf das Eingabefeld) gesetzt. Jedes zu zählende `<input>`/`<textarea>` bekommt das Attribut `data-inputcharcount`; ein `<div class="c-charCounter">` mit dem Zählerstand wird direkt nach dem Feld eingefügt. Optional: `maxlength` aktiviert die „x / n"-Anzeige, `data-countdown="true"` schaltet auf verbleibende Zeichen um, und `data-inputcharcount-selector` am Container überschreibt den Standard-Selektor.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
