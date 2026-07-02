# formValidation

Formularvalidierung mit Fehlermeldungen.

## Zum Kopieren benötigt
- `formValidation.html` – Markup
- `formValidation.scss` – Styles (Quelle; wird zu `dist/css/formValidation.min.css` kompiliert)
- `formValidation.js` – Verhalten
- Externe Abhängigkeit: `pristine.js` (Vendor-Datei) muss neben `formValidation.js` liegen – die Komponente lädt sie via `import("./pristine.js")` und erwartet danach `window.Pristine`.

## Einbindung
Das `<form>`-Element selbst erhält `data-js-module="formValidation"`. Jedes Feld wird in einen Container mit der Klasse `c-form__item` gepackt (dient als `classTo`/`errorTextParent` für Fehlermeldungen). Validierungsregeln und Meldungen werden über native Attribute (`required`, `type="email"`, `minlength`) sowie `data-pristine-*-message`-Attribute gesetzt. Bei fehlgeschlagenem Submit wird `is-submitted` gesetzt, fehlerhafte Felder erhalten `.is-invalid` samt `aria-describedby`-Verknüpfung.

## Demo
`demo.html` im Browser öffnen (setzt einen vorherigen `gulp build` voraus).
