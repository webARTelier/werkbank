# formValidation

Form validation with error messages.

## Files needed to copy
- `formValidation.html` – markup
- `formValidation.scss` – styles (source; compiled to `dist/css/formValidation.min.css`)
- `formValidation.js` – behavior
- External dependency: `pristine.js` (vendor file) must sit next to `formValidation.js` – the component loads it via `import("./pristine.js")` and then expects `window.Pristine`.

## Usage
The `<form>` element itself receives `data-js-module="formValidation"`. Each field is wrapped in a container with the class `c-form__item` (serves as `classTo`/`errorTextParent` for error messages). Validation rules and messages are set via native attributes (`required`, `type="email"`, `minlength`) as well as `data-pristine-*-message` attributes. On a failed submit, `is-submitted` is set, and invalid fields receive `.is-invalid` together with an `aria-describedby` link.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
