# dialog

Dialog-/Modalsystem mit Öffnen/Schließen-Triggern.

## Zum Kopieren benötigt
- `dialog.html` – Markup
- `dialog.scss` – Styles (Quelle; wird zu `dist/css/dialog.min.css` kompiliert)
- `dialogs.js` – Verhalten

## Einbindung
Das Dialog-System ist global und wird von `boot.js` automatisch initialisiert – es ist kein `data-js-module` nötig. Verknüpft wird über Attribute: Der Öffnen-Trigger trägt `data-open-dialog="<id>"` sowie `data-target="<id>"`, das Dialog-Element ist ein `<dialog>` mit passender `id`, dem Attribut `data-dialog` und optional `data-type="modal"` für den modalen Modus. Schließen erfolgt über einen Button mit `data-close-dialog`, per Klick auf den Hintergrund oder mit Escape.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
