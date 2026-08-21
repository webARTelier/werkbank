# numberInputFormat

Groups a plain text field into a readable number while the user types, pastes
or edits — `1.234,56` on a German page, `1,234.56` on an English one.

## Files needed to copy
- `numberInputFormat.html` – markup
- `numberInputFormat.scss` – styles (source; compiled to `dist/css/numberInputFormat.min.css`)
- `numberInputFormat.js` – behavior
- `_shared/js/pageLocale.js` and `_shared/js/numberSeparators.js` – the two
  utilities it imports (also used by `dataTable`); the build bundles them, but
  a paste into a plain project needs them alongside.

## Usage
Put `data-js-behavior="numberInputFormat"` on the field itself or on a wrapper,
and `data-numberinputformat` on each `<input>` to format. When the attribute
sits on a wrapper, every `[data-numberinputformat]` inside it is formatted.

Use `type="text"` (or `type="tel"` / `type="search"`). `type="number"` is
skipped and reported, and that is the gap this component exists for: it cannot
group at all, engines disagree about whether a comma is a decimal point, it
brings a spinner nobody asked for, and — decisively — it does not support
`setSelectionRange`, so the caret cannot be preserved. Without caret
preservation every keystroke throws the reader back to the end of the value.

While typing, the value is rebuilt from its sign, its integer digits and its
fraction digits, so it can never end up half-grouped. The caret is tracked as
*which section it is in* plus *how many digits of that section precede it*, and
restored after each edit, so editing in the middle works. A `Backspace` /
`Delete` that lands on a **group** separator removes the adjacent digit instead
of just re-inserting the separator (which would trap the caret); the **decimal**
separator is exempt, because deleting it is a real edit (`12,5` → `125`).

Those integer digits are the number's, not the string's: a **leading zero is
dropped as the value is read** (`0007` is 7, `0012.50` is 12,50), because a
grouped number never carries one — left in, `0007` would render as `0.007` on a
German page, a thousandth of what was typed, and a value arriving in fixed width
from a server is exactly where that happens. A lone `0` stays; it is a number,
and it is where a value on its way to `0,5` starts.

This component **formats only — it does not validate and does not calculate**.
A range, a step, a minimum or a maximum is `formValidation`'s business; rounding
is nobody's. Currency symbols, units and percent signs are out of scope too: a
number is made readable, nothing more.

### Options (all optional, all per field)

| Attribute | Effect |
| --- | --- |
| `data-numberinputformat` | marks the field to format |
| `data-numberinputformat-decimals="2"` | max fraction digits, and the number blur pads to. `"0"` means integers only. Default: unlimited, no padding. **Name the limit in the hint** — see Accessibility |
| `data-numberinputformat-submit` | move the field's `name` onto a hidden input carrying `1234.56` |

## The submitted value
**Read this before shipping a form.** By default the field posts exactly what
it shows — `1.234,56` — and the project parses it. That is deliberate: silently
rewriting a number a server reads differently is the one way this component
could do damage, so it is never done without being asked.

Where a machine-readable value is wanted, `data-numberinputformat-submit`
switches it on. The field's own `name` then **moves** to an injected
`<input type="hidden">` that carries `1234.56` — a `.` decimal, no grouping, a
leading `-` where negative, and an empty string for an empty field. The name
moves rather than being copied, because two inputs sharing one name would post
two values.

It degrades the right way: until the module runs, the visible field still
carries its name and still posts, so a chunk that never arrives costs the
grouping, not the field. A field without a `name` cannot have one moved — that
is reported, and the field is still formatted. `form.reset()` is followed back
into a re-read, so the hidden input can never be left holding the number the
reader had typed before the reset.

The precedent is `fileUpload`, which carries a server-side handle into the form
the same way.

### Two duties this lane hands to the author

Both are accessibility, and both come out of the same fact: the server never
sees the visible field.

1. **An error message has to point at the visible field.** A message rendered
   from the posted `name` must be wired to the input the reader can focus —
   `aria-describedby` on the visible field, never on the hidden one. A message
   describing a field nobody can reach fails **WCAG 3.3.1 Error
   Identification**, and it is this lane, not the component, that makes the
   mistake easy to walk into.
2. **A redisplayed value goes back into the visible field.** After a failed
   submit the server holds `1234.56` and has to put it back where the reader
   sees it; the module reads it as a wholesale value and re-groups it.
   Machine values round-trip safely, because a grouping's first group is one to
   three digits with no leading zero — `1234.560` comes back as `1.234,560` (as
   `1.234,56` where `decimals="2"` caps it), not as one and a bit million, and
   `0.999` comes back as `0,999`, not as 999. What cannot round-trip is one to
   three leading digits with exactly three decimals (`1.500`, `10.500`,
   `123.456`): those are genuinely ambiguous and read as the page's grouping.
   Post two decimals, or send the value back already grouped.

## Behaviour on blur
Blur is where the value is tidied, never while it is being typed:

- a dangling decimal separator goes (`12,` → `12`),
- a fraction with no integer gains its zero (`,5` → `0,5`),
- with `data-numberinputformat-decimals` set, the fraction is padded to that
  many digits (`1,5` → `1,50`).

Blur itself never shortens anything, and nothing here rounds. An empty field
stays empty — padding it would invent a value the reader never gave.

The cap does cut, though, and it is worth being precise about where:

- **While typing** a digit beyond the cap cannot be entered in the first place,
  so there is nothing to lose.
- **A wholesale value** (a paste, an authored value, a value redisplayed after a
  failed submit) has no keystroke to refuse, so the cap applies to what arrived:
  `1234.567` enters a `decimals="2"` field as `1.234,56`. That is truncation —
  `1.234,57` would be a calculated value, and this component does not calculate
  — so a server that sends back more decimals than the field accepts loses the
  ones beyond it. Nothing is reported: the cap is what the author asked for.

### `maxlength` is not a digit limit here
The separators the module writes count towards `maxlength` like any other
character, so `maxlength="5"` stops the reader after `1.234` — four digits, not
five — and the effective limit moves every time a group separator appears. The
module's own writes are not subject to it at all (`maxlength` constrains typing,
not an assignment), so an authored value may well exceed what the reader is then
allowed to type. Cap the fraction with `data-numberinputformat-decimals` and the
magnitude with `min` / `max` plus `formValidation`, and leave `maxlength` off a
formatted field.

## Typing, pasting and other locales
Two different things arrive in a field, and they are read differently on
purpose:

- **Typing** speaks the page's language. The decimal separator is the page's
  decimal character and nothing else, because the module itself writes the
  group character every three digits — that same character cannot also mean
  "decimal point" without the two readings colliding on the module's own
  output. Real keyboards agree: a German numpad sends `,`, an English one `.`,
  and `inputmode="decimal"` gives a touch keyboard the right key.
- **A wholesale value** — a paste, a drop, an autofill, a server-rendered
  initial value, a programmatic set followed by `change` — is read as a value,
  and locale-independently where it can be. With two distinct separators
  present the **last** one is the decimal point, so `1,234.56` and `1.234,56`
  both arrive as 1234.56 whatever the page's language is.

Only a lone separator is genuinely ambiguous, and there the page's language
decides — and even then it counts as a grouping only where it *actually*
groups: exactly three digits after it, and a first group of one to three
digits with no leading zero before it. On a German page:

| Pasted | Read as | Why |
| --- | --- | --- |
| `1,234.56` | 1234.56 | two separators — the last one is the decimal point |
| `1.234` | 1234 | a lone page-group character that groups on both sides |
| `1,234` | 1.234 | a lone page-decimal character is a decimal point |
| `12.5` | 12,5 | one digit after the separator is not a grouping |
| `1234.560` | 1234,560 | four digits *before* it is not a grouping either — grouped, that number reads `1.234.560` |
| `0.999` | 0,999 | a first group of `0` is not a grouping — nobody writes 999 as `0.999` |
| `0012.50` | 12,50 | the leading zeros are dropped as the value is read |
| `123.456` | 123456 | genuinely ambiguous, and the page decides: a grouping |

The `1234.560` and `0.999` rows are what let the machine value posted by
`data-numberinputformat-submit` survive a round trip through the server (see
above). The `123.456` row is the ambiguous case nothing can settle from the
string alone — as are `1.500` and `10.500`, any one to three leading digits with
exactly three after the separator.

Negative numbers are always allowed and never behind an attribute: a sign is
part of how a number is written, while "may not go below zero" is a constraint
(`min="0"` plus `formValidation`). A `-` anywhere in the value makes it
negative and is rendered leading; typing it again takes it off, so the key
toggles the sign.

A pasted string that is not a number at all keeps its digits and drops the
rest. Nothing is reported for that — the reporter is for authoring mistakes,
and a paste is the reader's.

## Localization
Nothing to configure and nothing to translate. The group and decimal characters
come from `Intl.NumberFormat().formatToParts()` for the page's `<html lang>`
(via the shared `pageLocale` / `numberSeparators` utilities), which is the same
source the browser uses itself. Locales whose separators are not `.` and `,`
work without a special case: `fr-FR` groups with a narrow no-break space,
`de-CH` with an apostrophe.

## Accessibility (BITV / WCAG)
- **Progressive enhancement:** the field is a normal text input, so without
  JavaScript a number can still be typed — just without the grouping.
- **Keyboard / assistive tech:** the caret is preserved rather than forced to
  the end, so mid-value editing stays possible for everyone.
- **Touch keypad:** the module adds `inputmode="decimal"` only when the author
  has not set `inputmode`. `decimal` rather than `numeric` on purpose — the
  latter offers digits only and leaves an iOS reader unable to type the decimal
  separator.
- **IME composition** is left alone until it finishes; the value is never
  rewritten mid-composition.
- **2.4.7 Focus Visible (AA):** the field shows the shared keyboard focus ring
  via the `focus-ring()` mixin (`light` tone; see the focus-ring convention in
  the project `CLAUDE.md`).
- **3.3.2 Labels or Instructions (A) — author responsibility:** give the field
  a `<label>` (or `aria-label`) and a format hint — a `placeholder` plus a
  visible hint wired via `aria-describedby` (see `numberInputFormat.html`).
- **3.3.5 Identify Input Purpose (AA) — author responsibility:** when the field
  collects the user's own data, set the matching `autocomplete` token. Omit it
  for arbitrary numbers such as a quantity. The `-submit` lane moves `name`,
  not `autocomplete`, so the token stays where the requirement wants it.
- **3.3.2 again, where `data-numberinputformat-decimals` is set — author
  responsibility:** the hint **must** name the limit ("at most two decimals").
  The cap behaves like `maxlength`: the key beyond it does nothing and says
  nothing, and an instruction given up front is the only thing that keeps that
  from reading as a broken field.
- **3.3.1 Error Identification (A) — author responsibility in the `-submit`
  lane:** an error message wired to the hidden input reaches nobody. See
  [the two duties](#two-duties-this-lane-hands-to-the-author) above.
- **Layout stability:** the stylesheet sets `font-variant-numeric: tabular-nums`
  on the control, so the value does not jitter sideways as group separators are
  inserted while typing.
- **Colour and contrast:** the shipped `c-numberField` look is a convenience so
  the demo and the snippet work out of the box. Contrast — in particular the
  3:1 of **1.4.11 Non-text Contrast** for the field's border, which is what
  identifies the box as a control — is the consuming project's, along with the
  rest of the field's design.

### What a screen reader says, and where it differs from what happened

Two places, both falling out of decisions taken above, both worth knowing
before a BITV or WCAG review — and neither has a fix inside the component: a
screen reader echoes the **key**, and the key is not what the module did. In
both cases the value stays correct and stays readable at any time; what is
briefly wrong is the echo.

- `Backspace` / `Delete` on a **group** separator removes the adjacent digit
  instead, because re-inserting the separator would trap the caret. NVDA and
  JAWS announce the character that sat before the caret — the separator —
  while a digit is what actually goes.
- Typing `-` a second time takes the sign off rather than inserting anything,
  and is announced as "minus" either way.

There is deliberately **no live region**. It would add a second, competing
announcement on every keystroke; a field is not a status, and the value can be
read back at any moment.

## Pre-enhancement
There is **no** pre-enhancement block and **no** `data-numberinputformat-ready`
attribute, and that is a decision, not an omission: the field looks like a field
before and after, nothing is hidden, and no control is promised that the script
has to deliver. The one visible change is that a pre-filled value re-groups on
`init()`, which can widen it — a Layer 4 case in
[`docs/preEnhancement.md`](../../../docs/preEnhancement.md), answered by
`tabular-nums` rather than by a ready attribute. A flag nothing keys off would
only be noise.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying
`data-js-behavior="numberInputFormat"`. It writes no class, no state attribute
and no inline style.

`init()` returns a cleanup function, so a host that mounts and unmounts the same
markup (Astro islands, a framework re-render — see `destroyModulesInScope()` in
`boot.js`) can hand the field back as it was authored: the `input` / `change` /
`blur` listeners go, the `reset` listener on the surrounding form goes, the
hidden input is removed and its `name` returns to the visible field, and the
`inputmode` hint goes if this module was the one that added it. Because one
module element may hold several fields, the cleanup tears down every instance it
created. The visible value itself is left alone — it is what the visitor typed,
and the formatting is idempotent.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is
used to warn when the module is initialized on a non-element node, when no
`[data-numberinputformat]` field is found in scope, when a field has an
unsupported `type`, when `data-numberinputformat-decimals` is not a whole
number, and when `data-numberinputformat-submit` is asked for on a field with no
`name`.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
