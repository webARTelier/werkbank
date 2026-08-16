# passwordToggle

A show/hide control for a password field: the one input on a form whose value
nobody can proof-read. The component wraps a plain
`<input type="password">`, injects a toggle button into it and switches the
field's `type` — nothing else about the field changes, so its name, its value,
its `autocomplete` token and the browser's password manager all carry on
exactly as before.

## Files needed to copy
- `passwordToggle.html` – markup
- `passwordToggle.scss` – styles (source; compiled to `dist/css/passwordToggle.min.css`)
- `passwordToggle.js` – behavior
- `src/_shared/js/resolveLocale.js` – bundled utility (picks the built-in de/en wording from `<html lang>`)
- `src/_shared/js/uniqueId.js` – bundled utility (names a field that has no `id`, for `aria-controls`)

The two utilities are bundled into the component's chunk by the build; they
only matter if you paste the source into a plain project. There is **no vendor
dependency**.

## Usage

Wrap the field, mark the field, and write no button — the module injects it:

```html
<label for="password">Password</label>
<div class="c-passwordToggle" data-js-behavior="passwordToggle">
  <input class="c-passwordToggle__field" id="password" name="password"
         type="password" autocomplete="current-password">
</div>
```

The wrapper holds the field and nothing else; the `<label>` stays outside it,
because the wrapper is a flex row and a label inside would become a second
item in that row.

Everything the browser's password manager needs stays untouched and stays your
job: the `autocomplete` token (`current-password` on a login, `new-password` on
a sign-up or change-password form), a surrounding `<form>`, and a username
field with `autocomplete="username"` next to it. The form is also what the
re-masking below listens to.

### Options

| Attribute / class | Where | Effect |
|---|---|---|
| `data-passwordtoggle-label="…"` | wrapper | the button's accessible name; defaults to the built-in wording for `<html lang>` (`Show password` / `Passwort anzeigen`), English elsewhere — and there marked `lang="en"`. On a page in a third language, give the button your own wording |
| `class="c-passwordToggle--beside"` | wrapper | puts the button next to the field instead of over its inline-end edge |

Everything else is CSS — how big the control is, where it sits and what it
looks like are questions about a box:

| Custom property | Default | Effect |
|---|---|---|
| `--passwordToggle-button-size` | `2.25rem` | the hit area (36px, past the 24px of WCAG 2.5.8) |
| `--passwordToggle-icon-size` | `1.25rem` | the glyph inside it |
| `--passwordToggle-radius` | `var(--borderRadius)` | the button's corner |
| `--passwordToggle-inset` | `var(--space-3xs)` | between the button and the field's edge |
| `--passwordToggle-gap` | `var(--space-2xs)` | `--beside` only: between field and button |
| `--passwordToggle-gutter` | `calc(button-size + 2 × inset)` | the padding reserved in the field for the button |
| `--passwordToggle-color` / `-color-hover` / `-bg-color-hover` | muted / text / overlay | the button's resting and hover tones |
| `--passwordToggle-icon-show` / `-icon-hide` | eye / struck-through eye | the two glyphs, as mask URLs |
| `--passwordToggle-duration` / `-easing` | half `--an-duration` / `--an-ease` | the hover transition |

They belong on the **wrapper**, not on an ancestor: the component declares
every one of them on its own root, and a declaration on an element beats an
inherited value no matter what the ancestor's specificity is.

Replacing the two icons with your own set is expected. Keep them two distinct
**shapes** rather than two colours of one shape — the shape is what carries
the state in greyscale, in print and in a forced-colors theme (WCAG 1.4.1).

## Two placements

**Over the field's inline-end edge** (the default) is the placement readers
expect, and it costs one declaration: the field gets a `padding-inline-end`
wide enough for the button, written specifically enough (`0,3,0`) to win
against your own `padding` shorthand whatever the order of the stylesheets. A
component that puts a control over a value and then lets the value run
underneath it would be worse than no component.

**`--beside`** puts the button after the field in the same flex row and
touches nothing of the field's box at all. It is the way out where the field's
padding is not yours to give up, and the honest placement for a field too
short to spare a gutter (a PIN, an inline login).

Nothing else about the layout is stated: a flex container in normal flow is as
wide as it is allowed to be, so how wide the field ends up is still your
stylesheet's business.

## Progressive enhancement

Before the module arrives, the wrapper is an empty flex row around an ordinary
password field. If the chunk never arrives, that is what stays — field, label,
`autocomplete`, password manager, all untouched. Nothing flashes and nothing is
hidden, so the component ships no pre-enhancement block.

**The button is injected rather than authored**, and this is the one component
where there is no alternative: a "show password" button in the markup would be
a control that does nothing until a script arrives, and no fallback could make
it work. The `type` attribute is the only switch a password field has, and no
element, attribute or CSS state can flip it — which is where the rule of least
power runs out and this script begins.

Two rules wait for `data-passwordtoggle-ready`, and both hand something over to
a control that has to exist first:

1. **the gutter** — padding reserved for the button, which without the button
   is an empty notch in the field;
2. **`::-ms-reveal`** — the reveal control Edge on Windows draws into a
   password field itself. Where ours is running it would be a second eye in the
   same field; where ours never arrived, removing it would leave the reader
   with *less* than the platform gave them. Edge is the only current engine
   that offers one.

That is the same positive keying `dataTable`, `autoGrowTextarea` and
`fileUpload` use — the flag switches the enhanced state **on** rather than
lifting a pre-state, so `init()` sets it last and a bail-out simply never
writes it. See [`docs/preEnhancement.md`](../../../docs/preEnhancement.md).

## Accessibility
- **A toggle button with a constant name**, its state in `aria-pressed`
  (ARIA APG *Button (toggle)*). Whether this password is legible on screen
  right now is the fact a reader needs; a name changing under them would
  announce it as an action instead. `video` does the opposite with its
  play/pause control, and for the opposite reason — for a transport control
  the useful announcement is what pressing does *next*.
- **The name is a real text node**, hidden visually and only visually, so it
  still names the control if the stylesheet never loads. `aria-controls`
  points at the field, with a generated `id` where the author gave it none.
- **The name says what language it is in** when that is not the page's. The
  built-in wording exists in `de` and `en`; a page in a third language gets
  the English fallback, and the text node is then marked `lang="en"` — a
  passage in an undeclared language is what WCAG 3.1.2 is about, and "Show
  password" read out by a French voice is what it sounds like. Where the
  wording and the page agree, nothing is written: the base language is
  compared, so `de` wording on a `de-CH` page is not a language change. An
  authored `data-passwordtoggle-label` is never marked — it was written for
  this page.
- **The glyph is a CSS mask on a pseudo-element**, drawn from `aria-pressed`
  the way `readMore` draws its chevron from `aria-expanded`. There is no node
  to announce, nothing is read twice, and what the eye sees cannot drift out
  of step with what a screen reader is told.
- **Two shapes, not two colours.** The state survives greyscale, print and a
  forced-colors theme (WCAG 1.4.1); in the latter the mask is repainted in
  `ButtonText`, because a mask painted with `currentColor` would otherwise be
  forced to the colour it sits on.
- **Focus never moves.** Pressing the button leaves focus on the button, and
  the caret's position in the field is read before the switch and written back
  after it — some engines re-create the field's inner editor on a `type`
  change and drop the selection with it.
- **Nothing moves.** No size, position or layout changes on press, so the
  target does not travel under a pointer already on its way to it. The hit
  area is 36px by default.
- **The reveal is a moment, not a setting.** It starts off, it is never
  remembered between fields or page loads, and submitting the form masks the
  field again — so a page restored from the back/forward cache, or re-rendered
  after a failed validation, never comes back with the password on screen.
- **The field is made safe to be text**: the module sets `spellcheck="false"`,
  `autocapitalize="none"` and `autocorrect="off"`. All three are inert while
  the value is masked and load-bearing the moment it is not — a spell checker
  would treat a password as a word (and some send what they check to a
  server), and a phone keyboard would capitalize and autocorrect it.

## Styling
`passwordToggle.min.css` ships the row, the button and the two glyphs. The
field's own border, radius, padding, colours and `:focus-visible` ring are
yours — style it the way you style your other fields (focus-ring convention in
the project `CLAUDE.md`). The button's ring, hit area and glyph shapes are not
decoration but the control's accessibility, which is why the component owns
those. `demo.html` shows one complete example design.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying
`data-js-behavior="passwordToggle"`, and that element must contain an
`<input type="password">` — the reporter warns and it bails otherwise, and
warns again (using the first field) if there is more than one. It writes no
inline styles: the state is `aria-pressed`, and the stylesheet does the rest.

`init()` returns a cleanup function, so a host that mounts and unmounts the
same markup (an SPA route change, a framework re-render — see
`destroyModulesInScope()` in `boot.js`) gets the field handed back as it was
authored: masked first of all, then the injected button removed, the `submit`
listener taken off the form, the three text-safety attributes restored to
whatever the author had, a generated `id` dropped and the ready attribute with
it.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it
is only used to warn about author mistakes (a root with no password field, or
with several). Without it the module degrades silently.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
