# inputCharCount

Displays the character count of an input field.

## Files needed to copy
- `inputCharCount.html` – markup
- `inputCharCount.scss` – styles (source; compiled to `dist/css/inputCharCount.min.css`)
- `inputCharCount.js` – behavior

## Usage
`data-js-module="inputCharCount"` is set on a container (or directly on the input field). Each `<input>`/`<textarea>` to be counted gets the `data-inputcharcount` attribute; a `<div class="c-charCounter">` with the current count is inserted directly after the field. Optional: `maxlength` enables the "x / n" display, `data-countdown="true"` switches to remaining characters, and `data-inputcharcount-selector` on the container overrides the default selector.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
