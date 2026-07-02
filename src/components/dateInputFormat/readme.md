# dateInputFormat

Formats date input while typing.

## Files needed to copy
- `dateInputFormat.html` – markup
- `dateInputFormat.scss` – styles (source; compiled to `dist/css/dateInputFormat.min.css`)
- `dateInputFormat.js` – behavior

## Usage
Copy the markup fragment into the page. The root element carries `data-js-module="dateInputFormat"`, and the `<input>` to be formatted carries the `data-dateinputformat` attribute. While typing, the value is automatically formatted to `DD.MM.YYYY`.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
