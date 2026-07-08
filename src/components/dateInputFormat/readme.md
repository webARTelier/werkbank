# dateInputFormat

Auto-formats a plain text field into a grouped date mask (`DD.MM.YYYY` by
default) while the user types, pastes or edits.

## Files needed to copy
- `dateInputFormat.html` – markup
- `dateInputFormat.scss` – styles (source; compiled to `dist/css/dateInputFormat.min.css`)
- `dateInputFormat.js` – behavior

## Usage
Put `data-js-module="dateInputFormat"` on the field itself or on a wrapper, and
`data-dateinputformat` on each `<input>` to format. When the attribute sits on a
wrapper, every `[data-dateinputformat]` inside it is formatted. Use
`type="text"` (or `type="tel"` / `type="search"`) — `type="date"` / `number`
are skipped and reported, since a `DD.MM.YYYY` mask makes no sense there.

While typing, the value is rebuilt from its digits and re-grouped, so it can
never end up half-formatted. The caret is tracked in *digit space* and restored
after each edit, so editing in the middle of the value works; a `Backspace` /
`Delete` that lands on a separator removes the adjacent digit instead of just
re-inserting the separator (which would trap the caret).

This component **formats only — it does not validate**. Impossible values such
as `99.99.9999` are left untouched; pair it with the `formValidation` component
for range/plausibility checks.

## Accessibility (BITV / WCAG)
- **Progressive enhancement:** the field is a normal text input, so without
  JavaScript a date can still be typed — just without the auto-inserted dots.
- **Keyboard / assistive tech:** the caret is preserved rather than forced to
  the end, so mid-value editing stays possible for everyone.
- **Touch keypad:** the module adds `inputmode="numeric"` only when the author
  has not set `inputmode`, so the numeric keypad appears on touch devices.
- **2.4.7 Focus Visible (AA):** the field shows the shared keyboard focus ring
  via the `focus-ring()` mixin (`light` tone; see the focus-ring convention in the
  project `CLAUDE.md`).
- **3.3.2 Labels or Instructions (A) — author responsibility:** give the field
  a `<label>` (or `aria-label`) and a format hint — a `placeholder="DD.MM.YYYY"`
  plus a visible hint wired via `aria-describedby` (see `dateInputFormat.html`).
  The module handles formatting; it does not invent labels or hints.
- **3.3.5 Identify Input Purpose (AA) — author responsibility:** when the field
  collects the user's own data, set the matching `autocomplete` token so it can
  be filled automatically — e.g. `autocomplete="bday"` for a date of birth (see
  `dateInputFormat.html`). Omit it for arbitrary dates such as a From/To range,
  where no autocomplete token applies. The module is generic and never guesses
  this, so it belongs in your markup. When such a token is present, browsers
  autofill the field in ISO order (`YYYY-MM-DD`); the module detects that
  wholesale value and reorders it into the mask (`order` config) before grouping,
  so the autofilled date is not garbled.

## Localization
The mask defaults to `DD.MM.YYYY`. **Per field**, override it inline by giving
the data attribute a pattern value:

```html
<input data-dateinputformat="MM/DD/YYYY">
<input data-dateinputformat="YYYY-MM-DD">
```

The pattern is parsed into the group sizes, the separator and the segment order,
so different locales can coexist on one page. Each segment must be a run of a
single `D`/`M`/`Y` letter (`DD`, `MM`, `YYYY`); the character between segments
becomes the separator. An empty attribute keeps the default mask; an invalid
pattern is reported and also falls back to the default.

To change the **project-wide default**, edit the `defaults` config in
`dateInputFormat.js`: the mask is built from `groups: [2, 2, 4]` joined by
`separator: "."`, and the sum of the groups is the maximum number of digits
kept. The `order` config (`["D", "M", "Y"]` by default) names the mask's
segments so a wholesale ISO date (from autofill) can be reordered into it — set
it to match your mask, or to `null` to disable ISO reordering. (A per-field
pattern derives `groups`, `separator` and `order` from the pattern itself.)

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on
demand by `boot.js` for every element carrying `data-js-module="dateInputFormat"`.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is
used to warn when the module is initialized on a non-element node, when no
`[data-dateinputformat]` field is found in scope, and when a field has an
unsupported `type`.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
