# dialog

Dialog/modal system with open/close triggers.

## Files needed to copy
- `dialog.html` – markup
- `dialog.scss` – styles (source; compiled to `dist/css/dialog.min.css`)
- `dialogs.js` – behavior

## Usage
The dialog system is global and is initialized automatically by `boot.js` – no `data-js-module` is required. Wiring is done via attributes: the open trigger carries `data-open-dialog="<id>"` as well as `data-target="<id>"`, the dialog element is a `<dialog>` with a matching `id`, the `data-dialog` attribute, and optionally `data-type="modal"` for modal mode. Closing happens via a button with `data-close-dialog`, by clicking the backdrop, or with Escape.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
