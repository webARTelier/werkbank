# inputCharCount

A live character counter for a text field, built as a progressive enhancement
on a plain `<input>` / `<textarea>`. When the field declares a native
`maxlength` it shows how much of the budget is used (or, in countdown mode, how
much is left) and flags the at-limit state — without ever adding a length rule
of its own.

## Files needed to copy
- `inputCharCount.html` – markup
- `inputCharCount.scss` – styles (source; compiled to `dist/css/inputCharCount.min.css` — ships only the visually-hidden status-region rule, see *Styling*)
- `inputCharCount.js` – behavior
- `src/_shared/js/debounce.js` – bundled utility (imported by the module; the build already bundles it into the component's chunk, only relevant if you paste the source into a plain project)
- `src/_shared/js/resolveLocale.js` – bundled utility (same note as above)

There is **no vendor dependency**.

## Usage
Put `data-js-module="inputCharCount"` on **each** `<input>` / `<textarea>` that
should show a counter (one counter per field — it goes on the field itself, not
a wrapper). The module injects two siblings right after the field: a visible
counter (`.icc-counter`, `aria-hidden`) and a visually-hidden status region for
assistive tech.

The current length is always read from the live field (`field.value.length`),
so the counter never drifts on paste, undo, cut or autofill. Length is measured
in UTF-16 code units — the same way `maxlength` and the native `tooLong`
constraint count — so the counter stays consistent with the platform.

### Options (all optional; on the field)

| Attribute | Effect |
|---|---|
| `maxlength="N"` (native) | switches the plain count to **"used / max"**, enables the `is-atLimit` state, and (browser-native) actually enforces the limit — with or without JS |
| `data-icc-countdown` | show the **remaining** budget instead of the used count (needs `maxlength`; without one it is ignored with a reporter warning) |
| `data-icc-text="…"` | override the **visible** template for this field. Tokens `{count}`, `{max}`, `{remaining}` are filled from the live field. The spoken text keeps its natural-language locale wording. |

```html
<label for="tweet">Message</label>
<textarea id="tweet" maxlength="280" data-icc-countdown
          data-js-module="inputCharCount"></textarea>
```

## Accessibility
- **Progressive enhancement:** without JavaScript the field still works; a
  `maxlength` is still enforced by the browser, so nothing depends on the
  script.
- **One quiet announcement channel:** the visible number is `aria-hidden`, and
  the count is announced through a single **polite** status region
  (`role="status"`, never `assertive`). Updates to it are **debounced** (~0.5s
  after typing pauses), so a screen reader is not made to recite the count on
  every keystroke.
- **Described on focus (3.3.2):** the status region is linked to the field via
  `aria-describedby` (any author-set ids are preserved), so the current count
  is read together with the field's label when it takes focus.
- **At the limit is a state, not an error:** reaching `maxlength` toggles the
  presentational `is-atLimit` class and speaks a "limit reached" note. No
  `aria-invalid` is set — being full is a valid state.

## Localization
Text ships in **German and English**, picked from `<html lang>` (e.g.
`lang="de-CH"` → `de`), falling back to English. Visible templates are compact
(`3 / 200`) while the spoken templates are natural language (`3 of 200
characters`) so a screen reader does not read punctuation like "slash". The
full set lives in the `LABELS` map in `inputCharCount.js`.

## Styling
The component ships **only** the visually-hidden rule for its injected status
region — an accessibility necessity, not a design choice. Everything visible is
a hook the JS writes and you style (it never reads them back):

- `.icc-counter` (also `[data-icc-counter]`) — the visible counter, a plain
  sibling right after the field.
- `.is-atLimit` — set on the field once the `maxlength` budget is spent.

Because the counter follows the field in the DOM, you can style it from the
field's state, e.g.:

```css
.icc-counter               { color: var(--color-text-muted); }
.is-atLimit + .icc-counter { color: var(--color-error); }
```

Style the field's own `:focus-visible` ring in your project too (focus-ring
convention in the project `CLAUDE.md`). `demo.html` shows one complete example
design.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every `<input>` / `<textarea>` carrying
`data-js-module="inputCharCount"` — one controller instance per field. It sets
no inline styles.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is
only used to warn about author mistakes (module on a non-field element,
`data-icc-countdown` without a `maxlength`). Without it the module degrades
silently.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
