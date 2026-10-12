# conditionalFields

Shows a group of form fields only while another field asks for it — the
delivery address once "deliver somewhere else" is ticked, the phone number once
"call me" is picked. The module element is the `<form>`; each dependent group
is a `<fieldset>` carrying `data-conditional-when`, which names the field it
depends on and, optionally, the values it waits for.

It is the snippet every CMS form ends up with, and the hand-written version is
nearly always `display: none` — which looks right and is not. A group that is
only hidden is still part of the form: a `required` field in it blocks the
submit with an error nobody can see, and its values are still sent. This
component closes a group with **`hidden` and `disabled`** on the fieldset, so
its fields are neither shown, nor reached, nor validated, nor submitted — and
keep their values for when the group opens again.

It owns no vocabulary at all: the fieldsets and the form design are yours.

## Files needed to copy
- `conditionalFields.html` – markup
- `conditionalFields.scss` – styles (source; compiled to `dist/css/conditionalFields.min.css`)
- `conditionalFields.js` – behavior

One utility from `_shared/js/` rides along: `rafThrottle.js` (one re-read per
frame when a later render changes the form).

The stylesheet is **one rule**, and it is not a look: the
`display: none !important` that keeps `hidden` hiding. It is small, and it is
not optional — see *Keep the stylesheet* below.

## Usage

```html
<form action="/order" method="post" data-js-behavior="conditionalFields">

  <label>
    <input name="deliverElsewhere" type="checkbox">
    Deliver to a different address
  </label>

  <fieldset data-conditional-when="deliverElsewhere">
    <legend>Delivery address — only if different</legend>
    <label for="deliveryStreet">Street and number</label>
    <input id="deliveryStreet" name="deliveryStreet" type="text" data-conditional-required>
  </fieldset>

  <fieldset>
    <legend>How should we contact you?</legend>
    <label><input name="contactBy" value="email" type="radio" checked> Email</label>
    <label><input name="contactBy" value="phone" type="radio"> Phone</label>
    <label><input name="contactBy" value="sms" type="radio"> Text message</label>
  </fieldset>

  <fieldset data-conditional-when="contactBy=phone|sms">
    <legend>Phone — only for a call or a text message</legend>
    <label for="contactPhone">Phone number</label>
    <input id="contactPhone" name="contactPhone" type="tel" data-conditional-required>
  </fieldset>
</form>
```

### Mandatory fields in a group: `data-conditional-required`

Mark a mandatory field inside a group with `data-conditional-required`, **not**
`required`. The module writes `required` onto it when it runs, and from then
on `disabled` keeps it out of the validation whenever its group is closed.

An authored `required` would be wrong in the one case the script cannot help
with: without the script every group is open, nothing can tell that the
delivery address does not apply, and the browser would refuse to send the form
until the reader typed an address they never wanted. With the marker the field
is optional until the script runs, and the server — which has to validate
anyway — decides what an order needs.

The marker outside a dependent group is reported and ignored; write `required`
there. A field carrying both keeps its authored `required`, on destroy too.

### Why a `<fieldset>`, and only a fieldset

`disabled` on a `<fieldset>` disables every control inside it, nested
fieldsets included — and a disabled control is what the platform already
treats as "not part of this form right now":

- it is **not submitted**, so the server receives only what was on screen;
- its `willValidate` is `false`, so **neither the browser nor
  [`formValidation`](../formValidation/readme.md) checks it** — the required
  field in a closed group stops counting;
- it **keeps its value**, so ticking, typing, unticking and ticking again
  brings the input back;
- it leaves the tab order.

No other element passes `disabled` on to its contents, so the attribute on a
`<div>` would leave exactly the fault this component exists to remove. It is
reported in the console and ignored. A group of one field is a fieldset too —
give it `border: 0; padding: 0; margin: 0` and either a `<legend>` or a label
on the field itself.

### The condition

| `data-conditional-when` | open while …                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `name`                  | the field is filled: a ticked box or radio, an option with a non-empty value, non-empty text |
| `!name`                 | the field is empty — the opposite                              |
| `name=a`                | its value is `a`                                               |
| `name=a\|b`             | its value is `a` **or** `b`                                    |
| `name!=a\|b`            | its value is neither `a` nor `b`                               |

- `name` is the control's `name` (an `id` matches as well). It is looked up
  in `form.elements`, so a radio group and a checkbox group are read as the
  set of their checked values, a `<select multiple>` as its selected options,
  and a field outside the form that joins it through `form="…"` is found
  like any other. Not through `namedItem()`, which WebKit does not keep up
  to date for such a field when it arrives as parsed markup.
- Values are compared **exactly**, case included. A checkbox's value is its
  `value` attribute — `on` where it has none, which is why the plain `name`
  form is the usual one for a single checkbox.
- `name=` (nothing after the `=`) asks for the empty value on purpose: a
  select resting on its "please choose" option.
- The attribute is read once, when the module first sees the fieldset.

### AND, OR, and chains

- **OR** is `|` inside one condition.
- **AND** is nesting. A fieldset inside a closed fieldset is closed too,
  whatever its own condition says — that is the platform, not this module —
  so there is no `&&` and no bracket to learn.
- **Chains settle.** A group may hold the field another group depends on. A
  field in a closed group counts as empty, exactly as it counts as empty for
  the submit, so closing the outer group closes everything hanging off its
  fields — in any document order. Two groups that open and close each other
  are reported instead of looped on.

### When a condition cannot be answered

A name that matches no field (a typo, or a field not rendered yet) and a field
that sits inside its own group (which would close over its own switch) both
leave the group **visible**, with a warning in the console. A group shown by
mistake costs a reader a glance; a group hidden by mistake costs them the
fields in it.

### What the module owns

`hidden` and `disabled` on the dependent fieldsets, and `required` on the
fields marked `data-conditional-required` — do not author them for state. A
fieldset you ship `disabled` is honoured: it is shown and hidden by its
condition, but never enabled.

### When the script arrives

The closed groups go when the chunk arrives — but not from under a reader. A
group that holds the focus at that moment (somebody started typing before the
script came) is **held open**, and closes once the focus has left it, its
switch is changed or the form is reset. Taking a group away while somebody
types in it is the unrequested change WCAG 3.2.2 is about. A hold also ends
when its switch closes with a group further up, so a held group can never
outlive the field that controls it.

### When it re-evaluates

- On `input` and `change` of a field some condition names. Typing anywhere
  else in the form costs one lookup per keystroke.
- After a **form reset**, which restores the defaults without firing `input`.
- On **`pageshow`**: a page restored from the back/forward cache keeps its
  values, and a reload may have them restored by the browser — both silently.
- When a later render **adds fieldsets or fields** to the form, or adds or
  removes a field elsewhere in the page that joins it through `form="…"` (a
  `MutationObserver`, `childList` only, that ignores everything else).

The `input`/`change` listeners sit on the **document**, not on the form, and
keep only the events of fields whose `form` is this one. An event travels
through the ancestors of its field, and a field joining through `form="…"`
from a sidebar or a page header has the form as its owner but not as an
ancestor — a listener on the form would never hear it.

A script that sets a value itself should fire an `input` or `change` event on
the field, as the platform would for a reader.

### The event

`conditionalfields:changed` bubbles off a fieldset whenever its state flips
after load — not for the first pass, which only reads the form.

```js
document.addEventListener('conditionalfields:changed', (event) => {
  console.log(event.target, event.detail.active);
});
```

### Progressive enhancement

Without the script every group is visible and enabled: the form is complete
and posts everything. Say in the `<legend>` when a group applies ("Delivery
address — only if different"). It can also be sent: the group fields are
optional until the script makes them mandatory (see
`data-conditional-required` above).

The first paint is that same full form, and the closed groups go when the
chunk arrives — the form gets shorter once. **No pre-enhancement rule ships**:
a group hidden before the script exists would stay hidden for good if the
chunk never arrives, which is the one outcome
[`docs/preEnhancement.md`](../../../docs/preEnhancement.md) exists to prevent.
Where a group starts closed on every load and the jump matters more than that
risk, the snippet documents an opt-in rule keyed on
`data-conditionalfields-ready`, which the module writes after its first pass
and on every bail-out. CSS cannot disable a field, so a plain `required` in a
group hidden that way would block the submit for good if the chunk failed —
`data-conditional-required` does not.

### Keep the stylesheet

`hidden` is a UA rule at specificity (0,0,0), so the first
`.formGroup { display: grid }` you write puts every closed group back on
screen — still disabled, so nothing wrong is submitted, but as a block of
greyed-out fields nobody can fill in. The component therefore ships

```scss
[data-conditional-when][hidden] { display: none !important; }
```

It is **permanent machinery**, like `filterList`'s version of the same rule:
the module writes and removes `hidden` for as long as it runs, so commenting
the rule out stops the component hiding anything.

## Accessibility
- **Place a group directly after the field it depends on.** In reading order
  the new fields are then simply what comes next. A group that opens somewhere
  else is a change of context nobody is told about (WCAG 3.2.2), and one that
  opens above its field is met only by going back (1.3.2). The module cannot
  move a group, but it reports one that comes before its switch, or one with
  other fields between the switch and itself, once in the console. Fields in
  other dependent groups do not count as "in between": groups hanging off the
  same switch belong to what it opens.
- **Prefer radios to a `<select>`** where a choice opens a group. On Windows
  the arrow keys change a closed select's value — and fire `change` — with
  every press, so the groups behind it open and close while a reader only
  browses the options. Nothing is lost by it; radios are simply calmer.
- **The script's arrival never closes a group under the reader** — see *When
  the script arrives*.
- **Nothing is announced.** A polite "three new fields" on every tick would be
  noise, and the fields are where the reader is about to go anyway.
- **No `aria-expanded`, no `aria-controls`.** `aria-expanded` is not allowed
  on a checkbox or a radio, and `aria-controls` is ignored by most screen
  readers. The native semantics of the field plus the reading order carry it.
- **The three channels agree.** `hidden` takes a closed group out of the
  accessibility tree, `disabled` out of the tab order and the validation, so
  what is seen, what is reached and what is checked never disagree.
- **The focus is never moved — with one exception.** Where the focus is
  inside a group a pass closes (a chain, or a value changed by script),
  `hidden` would hand it to `<body>` and put the reader at the top of the
  document (WCAG 2.4.3). It goes to the field the group depends on instead —
  and where that field has just closed too, up the chain to the first switch
  that can take it.
- **Name every group** with a `<legend>`, which is also where a no-script
  reader learns when the group applies.

## Working with other components

- **[`formValidation`](../formValidation/readme.md)** — put both on the form,
  in any order: `data-js-behavior="conditionalFields,formValidation"`. A closed
  group's fields are skipped by the native filter formValidation already uses
  (`willValidate`), so a required field in it never makes the summary.
  conditionalFields listens on the document in the **capture** phase, so its
  pass has settled before formValidation re-validates on the same event.
  After a failed submit, formValidation also re-syncs which fields count on
  every change: a field in a group that closes loses its message and
  `aria-invalid`, and a field in a group that opens is checked at once, so
  the summary never lists a field that shows no error.
- **[`loadFragment`](../loadFragment/readme.md)** — fieldsets and fields that
  arrive in the form after `init()` are picked up by the observer, with
  nothing to re-initialise.

## Integration
The JS exports `init(el, services)` and is boot-loaded per
`data-js-behavior="conditionalFields"` — you never import
`conditionalFields.js` yourself. It sets **no inline styles**: what it writes
is `hidden`, `disabled` and `required`, which are the platform's, plus
`data-conditionalfields-ready` on the form. The one thing it does beyond
writing is move the focus, where the group holding it has just closed.
`services.reporter` is optional and used only for warnings (not a form, the
attribute on something other than a fieldset, a condition naming no field or
a field inside its own group, a group placed above or away from its switch,
`data-conditional-required` outside a group, groups opening and closing each
other). `init` returns a cleanup function, so a host that mounts and unmounts
the same subtree can call `destroyModulesInScope()` — it disconnects the
observer, removes the listeners (including those on `document` and
`window`), drops the ready attribute, hands every fieldset back as authored
and every field it made `required` back as optional.

The listeners and the observer sit on the `document`, so they do not go away
with a removed form: a host that unmounts forms should call
`destroyModulesInScope()`, or they stay behind and keep the form alive.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
