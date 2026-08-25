# comboBox

Turns a native `<input list>` + `<datalist>` into the ARIA 1.2 combobox with
list autocomplete: type, and a filtered list of suggestions appears that can be
styled, walked with the arrow keys and announced properly.

## Files needed to copy
- `comboBox.html` – markup
- `comboBox.scss` – styles (source; compiled to `dist/css/comboBox.min.css`)
- `comboBox.js` – behavior
- `_shared/js/uniqueId.js`, `_shared/js/resolveLocale.js` and
  `_shared/js/formatTemplate.js` – the three utilities it imports; the build
  bundles them, but a paste into a plain project needs them alongside.

## Usage
Put `data-js-behavior="comboBox"` on the **container** around the field, and
give the `<input>` a `list` attribute pointing at a `<datalist>`. That pair is
the whole wiring — there is no attribute to add to the field itself, and none
to the datalist.

```html
<div class="c-comboBox" data-js-behavior="comboBox">
  <label class="c-comboBox__label" for="city">City</label>
  <div class="c-comboBox__field">
    <input class="c-comboBox__control" id="city" name="city" type="text" list="city-options">
  </div>
  <datalist id="city-options">
    <option value="Berlin"></option>
    <option value="Zürich"></option>
  </datalist>
</div>
```

One container holds **one** field: the popup is positioned against the element
that holds the input, so a container with two fields would have two popups
fighting over one box. The `<datalist>` itself is a data source, not a part of
the widget — it may sit anywhere in the document and may be shared by several
fields.

### Options (all optional, all on the container)

| Attribute | Effect |
| --- | --- |
| `data-combobox-match="contains"` | where the query has to appear in an option. `"contains"` (default) or `"start"` |
| `data-combobox-strict` | the value has to be one of the options, reported through `setCustomValidity()` |
| `data-combobox-message="…"` | your own text for that report |
| `data-combobox-toggle` | on a `<button type="button">` in the field row: opens the **full** list |

### Options in the `<datalist>`

- `<option value="Berlin">` — the value is what goes into the field.
- `<option value="DE" label="Deutschland">` — the label is shown as a secondary
  text beside the value, exactly the way the native popup shows it, and it is
  searched along with the value.
- `<option disabled>` is dropped: a suggestion nobody may take is not a
  suggestion. An empty value is dropped too.

**A label is not a machine value.** What the form posts is always the field's
text. A display value and a submitted code that differ are what `<select>` is
for — see [Deliberately out of scope](#deliberately-out-of-scope).

## Why this exists, when `<input list>` already works
It works, and it is the base layer this component keeps. What it cannot do:

- **It takes no CSS at all.** The popup is drawn by the engine, outside the
  page's styling, in whatever the platform decides — including a light popup
  under a dark design.
- **Its filtering rule is the browser's.** A substring in one engine, a prefix
  in another, and neither is stated anywhere the author can read.
- **Its coverage is uneven.** Long lists in mobile Safari and several assistive
  technologies get little or nothing out of it.

So the module keeps the `<datalist>` as the data source, builds a real
`role="listbox"` out of the very same options, and takes the `list` attribute
**off** the input while it runs so the native popup cannot open on top of its
replacement. The attribute goes back on teardown.

## Matching
One stated rule, applied to the option's value **and** its label:

- `contains` (default) — the query anywhere in the text.
- `start` — the text has to begin with it.

Matching folds **case and combining marks**: `zurich` finds *Zürich*, `cafe`
finds *Café*. A reader looking for a value should not have to know how it is
accented, and on a German keyboard the accented key is often not even there.

The matched fragment is marked in the popup with a plain `<span>` — never a
`<mark>`, whose "relevant to the current context" meaning several screen
readers announce, which would have every suggestion read out with its matched
fragment called out. The accent-folded hit is **not** marked: stripping a
combining mark changes a string's length, and an index into the folded text is
then not an index into the text on screen. Unmarked is the harmless half of
that trade.

## Selection is manual
Nothing is ever written into the field until the reader asks for it. There is
no inline autocomplete that fills the rest of the word and selects it, and no
"first option wins on blur". Two reasons: a value that changes on its own can
change under a screen reader that is still reading it out, and a field that
completes what it thinks you meant is the field everyone has fought with at
least once.

Taking an option writes exactly that option's value and dispatches `input` and
`change`, so a character count, a validation module or a dependent field bound
to the same input all learn about it.

## `data-combobox-strict`
Where the value has to be one of the options, the verdict goes through the
platform: `setCustomValidity()` on the field itself. So `checkValidity()`,
`:invalid`, the browser's own bubble and `formValidation` all learn about it at
once, and **this module draws nothing and blocks nothing** — no message node,
no red border, no refused keystroke.

- An **empty** field is never reported. "This field is required" is what
  `required` says.
- On blur, a value that differs from an option only in **case or accents** is
  snapped to the option's own spelling (`schweiz` → `Schweiz`), so what you
  receive is what your list says. That is the only rewrite the component ever
  does, and it never clears or shortens anything.
- A **reset of the surrounding form** lifts the report. That is the one value
  change no `input` event announces — the form simply puts its values back — so
  the module listens for `reset` on the field's own form and re-takes the
  verdict once the new value is in place. Without it an emptied field would
  keep a message about a list it is no longer being measured against, and
  `checkValidity()` would refuse a form nobody can fix by pressing submit.
- The module is the **only** writer of the custom message on that field. Do not
  call `setCustomValidity()` on it from your own code, and do not combine it
  with `formValidation`'s `data-fv-equals` (which sets its own) — two writers of
  one message overwrite each other.

The message text comes from the page's language (`de` / `en`, via `<html lang>`
and the shared `resolveLocale`), or from `data-combobox-message`.

## The toggle
An optional `<button type="button" data-combobox-toggle>` in the field row
opens the **full** list, ignoring what is in the field. That is deliberately
not the filtered list: the button is the way back when what was typed matches
nothing, and one that opened an empty list would be useless at exactly the
moment it is needed.

It is put **out of the tab order** (`tabindex="-1"`, unless the author set one),
following the APG: the arrow keys are the keyboard's way into the list, and a
second tab stop for the same list is noise in a form. Its chevron is a
pseudo-element in the stylesheet, so the button needs a text node (or an
`aria-label`) of its own — a missing one is reported.

**Nothing the button does is pointer-only**, which is what keeps that
`tabindex="-1"` defensible: where the query matches nothing, `↓` / `↑` /
`Alt`+`↓` open the same full list it opens. The button is the discoverable way
in, not the only one.

## Keyboard
| Key | What it does |
| --- | --- |
| `↓` / `↑` | open the list and walk it, wrapping at both ends |
| `Alt`+`↓` | open without choosing anything yet |
| — | where the query matches nothing, all three open the **full** list |
| `Alt`+`↑` | close |
| `Enter` | take the highlighted option |
| `Esc` | close the list |
| `Tab` | leave, keeping what was typed |
| `Home` / `End` | left to the caret, where a text field needs them |

`Enter` is consumed **only** where it took an option; with nothing highlighted
the key belongs to the form, so the field can still be submitted from.

`Esc` closes and stops there — **it never clears the field.** A value someone
typed is not thrown away by a key press meant to dismiss a popup; that is the
rule `siteSearch` follows for the same reason. With the list already closed the
key is not consumed at all, so it still reaches the dialog or the menu the
field may be sitting in. An `Esc` belonging to an IME composition is left alone
as well.

An **empty result never opens an empty box** — a listbox with no options is not
a state the pattern has. Opening from the keyboard therefore falls back to the
full list, exactly as the toggle does, so a typo is recoverable without the
pointer (WCAG 2.1.1). Where the `<datalist>` itself is empty there is nothing
to fall back to, and nothing opens.

By pointer: a click **in the field** opens the list, while the focus merely
arriving there does not — tabbing through a form should not leave a trail of
open popups.

## A list that arrives later
The `<datalist>` is watched with a `MutationObserver`, so options rendered in
after `init()` — a fragment loaded into the page, a server-filled list, a
dependent field's options being swapped — are searchable immediately, with no
re-initialisation. The module never writes into the datalist itself, so the
observer cannot feed back on its own writes.

## Accessibility (BITV / WCAG)
The ARIA APG **editable combobox with list autocomplete**, manual selection:

- `role="combobox"` with `aria-expanded`, `aria-controls` and
  `aria-autocomplete="list"` on the input; `role="listbox"` on the popup; one
  `role="option"` per row.
- **The focus never leaves the field.** The current option is pointed at with
  `aria-activedescendant` and carries `aria-selected="true"`, which is also the
  styling hook — so what the eye follows and what a screen reader reads cannot
  drift apart, and the caret, the text selection and every other module bound
  to the field keep working.
- **The listbox is named after the field** — its `<label>` where there is one,
  otherwise the input's `aria-labelledby` / `aria-label`. Renaming the field
  renames the list. A field with no name at all is **reported**, because the
  list would then be announced as an unnamed list box.
- **4.1.3 Status Messages (AA):** the suggestion count is announced through a
  polite, visually hidden `role="status"` — once per change of that sentence,
  never twice in a row. `aria-expanded` says the list is open and
  `aria-activedescendant` says which option is current, but nothing says
  "three left" as the reader types. A field the reader has just **emptied**
  reports nothing at all: the list is closed there, so "19 suggestions
  available" would be announcing a popup that is not on the screen.
- **2.1.1 Keyboard (A):** every function has a keyboard path, including the
  toggle's. The button is out of the tab order, so where the query matches
  nothing the arrow keys open the **full** list rather than nothing — see
  [The toggle](#the-toggle). Without that, "show me everything" would have
  been reachable with the pointer only.
- **2.1.2 No Keyboard Trap (A):** `Tab` always leaves, and `Esc` is only
  consumed where the component actually used it.
- **2.4.7 Focus Visible (AA):** the field and the toggle both show the shared
  keyboard focus ring via the `focus-ring()` mixin (`light` tone).
- **1.4.11 Non-text Contrast (AA):** the field's border uses
  `--color-border-control`, the tone measured for the 3:1 a control's boundary
  needs on these surfaces. The **current option's highlight** is the consuming
  project's call: it is drawn from `--comboBox-option-bg-color-active` against
  `--comboBox-list-bg-color`, and whether that pair clears 3:1 depends on the
  palette a project puts in. Retune those two knobs, or add a second
  distinction (an inset `outline` on `[aria-selected="true"]`), if yours does
  not.
- **1.4.4 Resize Text (AA):** the popup's height is capped at
  `min(16rem, 60svh)` — 16rem is 16rem of the *reader's* root font, so an
  uncapped list would be taller than the viewport at 200% zoom, with its last
  options below the fold. Walking with the arrow keys scrolls the current
  option into view either way.
- **3.3.1 Error Identification / 3.3.3 Error Suggestion (A/AA) — needs a
  partner:** `data-combobox-strict` reports through `setCustomValidity()`, and
  on its own that is the browser's *transient* bubble on submit: no
  `aria-invalid`, no message in the DOM, nothing tied to the field with
  `aria-describedby`. That is deliberate — this module draws nothing — but it
  is **not enough on its own**. Put `formValidation` (or your project's
  equivalent) on the form: it reads `validity.customError` and takes the
  message straight from `validationMessage`, so the text authored here is the
  text it renders inline, links with `aria-describedby`, lists in its error
  summary and sets `aria-invalid="true"` for. Point its `data-fv-item` at the
  component **root**, not the field row — the row is the popup's positioning
  context.
- **1.4.12 / forced colors:** in a forced-colors palette the current option
  falls back to the system's own `Highlight` / `HighlightText` pair, because
  every background this stylesheet declares is dropped there — and that
  background is the only thing telling the current option from the rest.
- **3.3.2 Labels or Instructions (A) — author responsibility:** give the field
  a `<label>` and a hint wired via `aria-describedby`. "Type to search" is worth
  stating: a text field that also suggests does not look different from one
  that does not.
- **1.3.5 Identify Input Purpose (AA) — author responsibility, and the one
  place this module can make an omission look deliberate:** set the matching
  `autocomplete` token wherever the field collects the user's **own** data
  (`country-name`, `address-level2`, `postal-code`, …). The module writes
  `autocomplete="off"` **only** where you have set nothing, to keep the
  browser's own autofill popup from rendering over the list — but on a field
  that *should* carry a token, a forgotten one then reads as an explicit
  opt-out, which is a 1.3.5 failure. The module cannot tell the two apart, so
  this one is on you. A city, a country, a street: set the token.

## Pre-enhancement
Nothing is hidden and nothing is lost. Without the chunk the field is the
native combobox it was authored as: the `<datalist>` is still wired to the
input, so the browser still suggests those values.

The **toggle** is the one part that waits, and it is read **positively** off
`data-combobox-ready` rather than through the `pre-enhancement()` mixin — the
same choice `fileUpload` and `passwordToggle` make, for the reason in
[`docs/preEnhancement.md`](../../../docs/preEnhancement.md): the mixin wraps its
rules in `@media (scripting: enabled)`, and scripting being *enabled* is not the
same as the chunk *arriving*. Keyed that way, a reader with scripting off would
be the one reader shown a button that can never work. So the button is off by
default and switched on by the ready attribute — as is the gutter it stands in,
which would otherwise be an empty notch in the field.

The same applies to every bail-out: a container without an `<input>`, or an
input without a `list`, is reported and the markup is left completely
untouched. The ready attribute is not set, so the toggle stays hidden and the
reader keeps the field plus the browser's own popup.

## Deliberately out of scope
- **A machine value separate from the display value.** A field that shows
  *Deutschland* and posts `DE` is a `<select>`, or a `<select>` plus a hidden
  input — not a text field. `<datalist>`'s own `label` is a second *display*
  text, and this component treats it as one.
- **Multiple selection / chips.** That is a different pattern with a different
  keyboard model (see `tagInput` in the backlog).
- **Remote suggestions.** The data source is the `<datalist>` in the page; a
  project that fetches keeps writing into it, and the observer above picks it
  up. Putting a request inside the component would mean a debounce policy, an
  abort policy and an error state that only the project can decide.
- **Grouped options.** `<datalist>` has no meaningful grouping to read.
- **Repositioning the popup.** It opens below the field, always, and is capped
  at `min(16rem, 60svh)` so it stays a hop under the field rather than a
  curtain over the page. A field sitting low in the viewport can still put its
  last options below the fold: the keyboard scrolls the current one into view,
  a pointer has to scroll the page. Flipping it upwards would mean measuring
  the field against the viewport on every scroll and resize and writing the
  answer back as an inline style — and writing no inline style is precisely
  what this component promises its stylesheet. A project that needs the flip
  has the whole override surface to do it with.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying
`data-js-behavior="comboBox"`. It writes no class and no inline style; the
state it exposes to the stylesheet is `aria-expanded` on the field,
`aria-selected` on the current option, the `hidden` attribute on the popup, and
`data-combobox-ready` on the root.

`init()` returns a cleanup function, so a host that mounts and unmounts the same
markup (Astro islands, a framework re-render — see `destroyModulesInScope()` in
`boot.js`) gets the field back exactly as authored: the observer on the
`<datalist>` is disconnected, the `reset` listener on the surrounding form goes
(those two are the only state living outside the component's own subtree), the
popup and the status region are removed, the
`role` / `aria-*` attributes go, any custom validity is cleared, the injected
`autocomplete="off"` goes if this module was the one that added it, and the
`list` attribute is put back — so the browser's own popup answers again.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is
used to warn when the module is initialized on a non-element node, when the
container holds no `<input>`, when the input has no `list` pointing at a
`<datalist>`, when the field or the toggle has no accessible name, when the
`<datalist>` holds no usable option, and when `data-combobox-match` carries an
unknown value.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
