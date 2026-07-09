# formValidation

Accessible, inline form validation built on the browser's native **Constraint
Validation API**. It validates on submit, blocks the submit while anything is
wrong, injects a focusable error summary at the top of the form and moves focus
there, and — after that first attempt — keeps each field's message in sync live
as it is fixed.

## Files needed to copy
- `formValidation.html` – markup
- `formValidation.scss` – styles (source; compiled to `dist/css/formValidation.min.css` — validation-state styles only, see *Styling* below)
- `formValidation.js` – behavior
- `src/_shared/media/img/system/chevronDown.svg` – source glyph for the select chevron (embedded as a mask, see *Styling*)
- `src/_shared/media/img/system/warning.svg` – source glyph for the invalid-field icon (embedded as a mask, see *Styling*)

There is **no vendor dependency**: validation is done entirely by the platform.

## Usage
Put `data-js-module="formValidation"` on the `<form>`. Declare the rules with the
native validation attributes you already know — the module never invents rules,
it only presents the browser's verdict:

- `required`, `type="email"` / `type="url"`, `minlength` / `maxlength`,
  `pattern` (+ `title` as the format hint), `min` / `max` / `step`.

That covers every input kind: text, email, url, number (plain, with min/max, or
with a unit badge drawn around it), integers (`inputmode="numeric"
pattern="[0-9]+"` — replaces the old `data-pristine-type="integer"`), selects,
radio groups, checkboxes and textareas. *(Input character counters are
intentionally not part of this component — they will become their own UI
component first and be integrated later.)*

One rule the platform has no constraint for is added by the module:
**`data-fv-equals="#otherField"`** on a confirmation field (e.g. repeat email /
password) marks it invalid until it matches the referenced field. The rule is
fed through the native API via `setCustomValidity()`, so messages, aria and
focus handling work exactly like for native constraints, and editing either
field re-validates the pair. Do not combine it with your own
`setCustomValidity()` on the same field.

Wrap each control (or each radio/checkbox group) in an element carrying
`data-fv-item`. That container receives `is-invalid` while the field is invalid
and is where the `.fv-error` message is inserted. Without an item container the
field still validates, but the message falls back to the field's parent element.

Do **not** add `novalidate` yourself — the module sets it from JavaScript, so the
no-JS path keeps native validation (see *Accessibility*).

### Custom messages
All optional. When you set nothing, a localized default (see *Localization*) or
the browser's own message is used. Most specific wins:

1. `setCustomValidity()` set by your own code (respected as-is).
2. Per-constraint override attribute — the most specific author option:

   | Attribute | Applies to constraint |
   |---|---|
   | `data-fv-required` | `required` not satisfied |
   | `data-fv-type` | `type="email"` / `type="url"` mismatch |
   | `data-fv-minlength` / `data-fv-maxlength` | `minlength` / `maxlength` |
   | `data-fv-pattern` | `pattern` mismatch |
   | `data-fv-min` / `data-fv-max` / `data-fv-step` | `min` / `max` / `step` |
   | `data-fv-equals-message` | the `data-fv-equals` rule |

3. `data-fv-message` — one generic message for whichever constraint the field
   fails.
4. Localized default (CMS-overridable, see *Localization*), then the native
   `validationMessage`.

```html
<input type="email" required
       data-fv-type="We need a valid email address to reply to you." />
```

## Accessibility (BITV / WCAG)
- **Progressive enhancement:** without JavaScript the browser validates the form
  and shows its own bubbles, so the form is never unguarded. The module sets
  `novalidate` only from JS, then replaces the transient bubbles with persistent
  inline messages.
- **4.1.3 Status Messages (AA) / 2.4.3 Focus Order (A):** on a failed submit an
  **error summary** is injected at the top of the form — a focusable, labelled
  region listing every invalid field as a link that jumps to it — and focus is
  moved there. Focusing it announces the problem count and lets a keyboard or
  screen-reader user step through all errors from one place. This is the single
  announcement channel, so the per-field messages are **not** live regions (no
  competing burst of alerts on submit, no re-announcing on every keystroke). The
  summary stays in sync as fields are fixed and disappears once the form is valid.
- **3.3.1 Error Identification (A):** an invalid field gets `aria-invalid="true"`
  and an `aria-describedby` link to its inline message (read when the field takes
  focus, e.g. via a summary link). Everything is removed again the moment the
  field becomes valid.
- **3.3.2 Labels or Instructions (A) — author responsibility:** give every
  control a `<label for>` (or `aria-label`) and a stable `id`/`name`; the message
  is tied back to the control by these. For a `pattern`, a `title` doubles as the
  format instruction shown to everyone.
- **No nagging:** fields are only flagged after the first submit attempt; before
  that a user is never warned about a field they have not reached yet.
- **1.4.1 Use of Color (A) — example design:** the component's own CSS marks an
  invalid field by border color only; the error text below it already makes the
  problem non-color-dependent. On top of that, `demo.html` shows how a project
  adds a **warning icon inside the field** (`src/_shared/media/img/system/warning.svg`,
  masked and tinted with the error token like the select chevron), so the field
  itself carries a second, non-color cue.
- **2.4.7 Focus Visible (AA) — example design:** when a summary link moves focus
  to a **visually hidden** radio/checkbox, browsers do not reliably treat that
  programmatic focus (after a pointer click) as `:focus-visible`. `demo.html`
  therefore rings those drawn boxes on plain `:focus` too, so the jumped-to
  control always shows a visible indicator (as the summary container itself
  already does — see *Styling*).

## Localization & CMS-maintained messages
Messages ship in **German and English**, picked from `<html lang>` (e.g.
`lang="de-CH"` → `de`); anything else falls back to English, and any single
message not covered falls back to the browser's native `validationMessage`.

All default texts are maintainable **in one place, without touching JS**: a
single JSON block per page (rendered by your CMS) is merged over the built-in
defaults — per locale and per message id, so it may change one message, all of
them, or add further locales:

```html
<script type="application/json" data-fv-messages>
  {
    "de": {
      "valueMissing": "Bitte füllen Sie dieses Feld aus.",
      "tooShort": "Bitte verwenden Sie mindestens {minLength} Zeichen (aktuell {valueLength})."
    },
    "en": {
      "valueMissing": "Please fill out this field.",
      "tooShort": "Please use at least {minLength} characters (currently {valueLength})."
    }
  }
</script>
```

The message ids are the `ValidityState` flags plus the control-type variants
(`valueMissingCheckbox`, `valueMissingRadio`, `valueMissingSelect`,
`typeMismatchEmail`, `typeMismatchUrl`) and `equals` — the complete de/en set is
in `demo.html` and in the `MESSAGES` map in `formValidation.js`. Templates may
interpolate live field limits via `{minLength}`, `{maxLength}`, `{valueLength}`,
`{min}` and `{max}`. A malformed block is reported (via `services.reporter`) and
ignored, so the built-in texts keep working.

## Styling
The component ships **only the validation state**; your form's design stays
entirely yours. `formValidation.min.css` colors, via `--fv-error-color` (mapped
to the shared semantic token `--color-error`, see
`_shared/scss/_colors_semantic.scss`), exactly:

- the border of `input`/`select`/`textarea` inside `[data-fv-item].is-invalid`,
- the injected `.fv-error` message,
- the injected error summary's title and links (`.fv-summary__title`,
  `.fv-summary a`).

The summary **box** (border, padding, spacing) and its focusable container's
`:focus` outline are yours to style — `demo.html` shows one example. Note it
must style plain `:focus` (not only `:focus-visible`): focus is moved to the
summary programmatically on a failed submit, which does not always trigger
`:focus-visible`.

Everything else is toggled as hooks your project styles (the JS never reads
them back): `form.is-submitted`, `[data-fv-item].is-invalid`, `.fv-error`,
`.fv-summary`.
Also style the field's own `:focus-visible` ring in your project (focus-ring
convention in the project `CLAUDE.md`).

`demo.html` contains a complete, clearly-marked example design, including two
patterns worth copying:

- **Freely designable radios & checkboxes:** the native input stays in the DOM
  (visually hidden but focusable), the `<label>` carries the text, and two
  spans (`__box` / `__checkmark`) are drawn entirely in CSS — any shape, size or
  animation, with the focus ring on the drawn box
  (`.c-radio:focus-visible + .c-radio__label .c-radio__box`). Radio and checkbox
  are separate BEM blocks (`c-radio` / `c-checkbox`, `c-` = component prefix),
  matching the example form's naming.
- **Select chevron:** `src/_shared/media/img/system/chevronDown.svg` is the
  source glyph, applied as a `mask-image` on a wrapper's `::after` with
  `background-color: currentColor` — it follows the text color automatically
  (hover, invalid state) and needs no runtime path into the media folder.
- **Invalid-field warning icon:** `src/_shared/media/img/system/warning.svg`,
  wired up the exact same way — masked on a pseudo-element and tinted (here with
  the error token) — shown inside the field on `[data-fv-item].is-invalid`. It
  sits on a `.c-field` wrapper for plain inputs/textareas, or just left of the
  glyph already parked on the right for `.c-select` / `.c-unit`. This gives the
  field itself a non-color cue alongside the red border (see *Accessibility*).

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on
demand by `boot.js` for every `<form>` carrying `data-js-module="formValidation"` —
one controller instance per form.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is
only used to warn about author mistakes (module on a non-`<form>` element, a
malformed `data-fv-messages` JSON block, a `data-fv-equals` selector that
matches nothing). Without it the module degrades silently.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
