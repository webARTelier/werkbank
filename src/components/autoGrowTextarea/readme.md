# autoGrowTextarea

A `<textarea>` that is as tall as what is written in it: no box of empty rows
kept open for a value nobody has typed yet, and no inner scrollbar until the
value really is longer than the field may be. It is the platform's
`field-sizing: content` plus the two clamps that make it a policy — and, for
the engines that do not have it yet, a module that measures the value and
hands the height to the stylesheet.

## Files needed to copy
- `autoGrowTextarea.html` – markup
- `autoGrowTextarea.scss` – styles (source; compiled to `dist/css/autoGrowTextarea.min.css` — this is the component, see *Styling*)
- `autoGrowTextarea.js` – behavior (the fallback lane only, see *Two lanes*)
- `src/_shared/js/rafThrottle.js` – bundled utility (imported by the module; the build already bundles it into the component's chunk, only relevant if you paste the source into a plain project)

There is **no vendor dependency**.

## Usage

Put both hooks on the `<textarea>` itself — the class carries the component,
the data attribute boots the module. There is no wrapper and nothing is
injected:

```html
<label for="message">Your message</label>
<textarea class="c-autoGrowTextarea" id="message" name="message" rows="3"
          data-js-behavior="autoGrowTextarea"></textarea>
```

Keep a `rows` attribute matching `--autoGrowTextarea-min-rows`: it is the
field until the module has measured, and with scripting off it is the field
for good.

### Options (all of them are CSS)

How few lines the field may be, how many it may grow to and what happens past
that are questions about a box, so they are set in CSS rather than passed to
JavaScript.

| Custom property | Default | Effect |
|---|---|---|
| `--autoGrowTextarea-min-rows` | `3` | how few lines the field may be |
| `--autoGrowTextarea-max-rows` | `12` | how many it may grow to; past that the field scrolls |
| `--autoGrowTextarea-box-extra` | `0px` | the part of the field's box that is not text — its block-axis padding plus borders, both sides together (see below) |
| `--autoGrowTextarea-inline-size` | `100%` | the field's width, stated because `field-sizing` sizes the inline axis too (see below) |
| `--autoGrowTextarea-min-size` | `calc(min-rows * 1lh + box-extra)` | the same minimum as a length, if lines are not the unit you think in |
| `--autoGrowTextarea-max-size` | `calc(max-rows * 1lh + box-extra)` | likewise; `none` lets the field grow as far as its value goes |

**They belong on the field itself, not on an ancestor.** The component
declares every one of them on its own root, and a declaration on an element
beats an inherited value no matter what the ancestor's specificity is — a
`--autoGrowTextarea-max-rows: 4` two levels up simply does not arrive. Set
them inline to retune a single instance
(`style="--autoGrowTextarea-max-rows: 4"`), or in a rule that hits the field
itself:

```css
.myField { --autoGrowTextarea-max-rows: 4; }
```

A rule of yours carries the same weight as the component's, so it also has to
come **after** `autoGrowTextarea.min.css` in the cascade. Load your own
stylesheet last, or use the inline form.

`--autoGrowTextarea-box-extra` exists because CSS cannot ask an element about
its own padding, and the two clamps are lengths on the field's whole box. Left
at zero, `min-rows: 3` means *a box three lines tall*, of which a padded
field's padding takes its share. State it once next to your own field styles
and a row count means exactly that many rows of text:

```css
.myField {
  padding: 8px 12px;
  border: 1px solid;
  --autoGrowTextarea-box-extra: calc(2 * 8px + 2px);
}
```

`--autoGrowTextarea-inline-size` is there because `field-sizing: content`
cannot be told which axis it may act on: it sizes the field to its value in
the inline direction too. Left to itself, a field in normal flow is as wide as
its longest line and, while it is empty, as wide as the caret — measured at
19px against the 180px the same field has without the component, in Chromium
151 and WebKit 26.5 alike; `cols` is ignored along with it. Stating a width is
what stops that, and stating it in **both** lanes is what keeps them the same
field: without it an engine that has no `field-sizing` would show the `cols`
width where the others show this one. It is a default, not a claim on the axis
— give it a length of your own, or let your own field styles carry the width
(same cascade rule as above). Two things it inherits from being a percentage:
it needs a container that has a width of its own (inside a box that is sized
by its content — a flex or grid item, a float — state a length instead), and
under `box-sizing: content-box` a field at `100%` overflows its container by
its padding and border, exactly as `--autoGrowTextarea-box-extra` describes
for the block axis.

Code that sets `textarea.value` programmatically should dispatch an `input`
event afterwards (`field.dispatchEvent(new Event('input'))`) — that is the
signal the module listens for. Everything a user does (typing, pasting,
cutting, undoing, autofill) fires it by itself, and a form reset is handled
without it.

If the field holds an address, give it `autocomplete="street-address"` — the
one `autocomplete` token that expects a multi-line control, and therefore the
one case in which WCAG 1.3.5 has something to ask of a `<textarea>`. Every
other token names a single-line value and does not belong on one.

## Two lanes, one condition

`@supports (field-sizing: content)` in the stylesheet and
`CSS.supports('field-sizing', 'content')` in the module are the same question
asked in both languages; keep the two in sync when touching either file.

1. **The engine sizes the field.** All three current engines do — verified
   here in Chromium 151, WebKit 26.5 and Firefox 153, with pixel-identical
   results. Then this component is CSS only: the field grows at the first
   paint, with scripting on or off, and `autoGrowTextarea.js` sets its ready
   attribute and returns without registering a single listener. This is the
   component's main path, not its edge case.
2. **The engine does not** (older releases of all three). Then the module
   measures the value and writes its height to the field as
   `--autoGrowTextarea-content-size`, which the stylesheet applies as a
   `block-size`. The clamps stay in CSS, so the minimum, the cap and the
   scrolling past the cap are the same rules in both lanes. It re-measures on
   `input`, on a width change (`ResizeObserver` on the field, not on the
   window), once the web fonts have arrived, once the page has loaded, on a
   form `reset` — the one value change that fires no `input` event — and on
   `focus`.

   `focus` is in that list because the written length **pins** the box, and a
   pinned box reports no resize: a reader's own stylesheet or text-only zoom
   changes how tall the lines are without changing the width, and the
   observer sees that only while the field rests at its minimum. Focusing the
   field is the occasion that catches the rest, and `input` keeps it right
   from the first keystroke. A field whose typography changed and that is
   then never touched keeps a box measured for the old type and scrolls the
   difference — a scrollbar too early, not a loss. Lane 1 has none of this:
   the engine re-sizes on its own.

**When lane 2 can go.** It exists for released engines that have no
`field-sizing`: Safari before 26 and Firefox before 137 (Chromium has had it
since 123). Once those are outside a project's support window, the whole lane
can be deleted in one go — `autoGrowTextarea.js`, its entry in
`build/config.js`, the `@supports not (…)` block in the stylesheet and the
`data-js-behavior="autoGrowTextarea"` hook in the markup — and the component is
the class alone, four declarations plus the token block. Nothing else in the
collection reads any of it. The two lanes are verified to be the same field, so
the deletion changes no rendering: measured over the demo's six fields in four
states (empty, 8 lines, 40 lines past the cap, and the column narrowed to
420px) with the lane forced by stubbing `CSS.supports`, every height came out
pixel-identical.

## Accessibility
- **Progressive enhancement.** In lane 1 there is nothing to enhance. In lane
  2 the field before (or without) the module is a plain textarea at its `rows`
  height with a scrollbar: usable, with nothing hidden and nothing lost.
- **The resize handle is only dropped where growth is delivered.** In lane 1
  unconditionally; in lane 2 only once the module is running
  (`data-autogrowtextarea-ready`), because until then dragging the field open
  is the reader's only way out of a value that does not fit — a chunk that
  never arrives must not take that away. Where growth *is* delivered, keeping
  the handle would offer a way out that does not exist: dragging a field
  writes an inline `height`, and `max-block-size` beats a height whatever the
  specificity — measured in Chromium, `height: 347px` written to the field
  while its box stayed at 144px; in WebKit the drag does not take at all. Past
  the cap it is the field's own scrolling that keeps the value reachable, not
  the handle.
- **Nothing is announced and nothing is claimed.** The value is in the field
  either way and the only thing that changes is the size of the field's own
  box, so no ARIA is set and no state class is written. Every state the
  component can be in is one the platform already describes.
- **The cap is a maximum, not a lid.** Past it the field scrolls, so no part
  of a value is ever unreachable — and a field that grew without limit would
  push its own submit button off the screen.
- **Growth goes downwards, so weigh the cap against a sticky bottom bar.** A
  field at 12 rows in a short viewport reaches past the fold (measured: a
  lower edge at 411px in a 400px viewport); behind something the page pins to
  the bottom, that is WCAG 2.4.11, which asks that the focused control not be
  obscured. The cap keeps it bounded — lower it on pages with a sticky footer.
- **The growth is not animated**, on purpose: the box has to be there when the
  caret arrives, and a transition would put the caret behind an edge that is
  still moving. On paper the cap is lifted, because nobody can scroll a sheet
  of paper.

## Styling
`autoGrowTextarea.min.css` is the component in lane 1 and the mechanism in
lane 2 — the two clamps, the scrolling past the cap, `field-sizing` where the
engine has it, the resize handle and the width (see
`--autoGrowTextarea-inline-size` above). It ships no colours, no border, no
radius and no focus ring: style the field the way you style your other
fields, its `:focus-visible` ring included (focus-ring convention in the
project `CLAUDE.md`). `demo.html` shows one complete example design.

Because the clamps are counted in `lh` — the line box of this very field —
they follow your type scale without a second decision, which is also why the
field needs a `line-height` and a `font` you control (a textarea does not
inherit the page font on its own; `font: inherit` is the usual line).

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every `<textarea>` carrying
`data-js-behavior="autoGrowTextarea"`, and it must be a `<textarea>` — the
reporter warns and it bails on anything else. It writes no inline styles for
state: the one length it does write is a measurement (plus two scaffolding
declarations that live only for the duration of that measurement), for the
reason `readMore` and `dataTable` write theirs — only a measurement can
answer how tall a text is at this width in the font that arrived.

In lane 2 `init()` returns a cleanup function, so a host that mounts and
unmounts the same markup (an SPA route change, a framework re-render — see
`destroyModulesInScope()` in `boot.js`) gets the field handed back as it was
authored: the `load` listener, the `reset` listener on the form and the
observer are taken down, the measured length is dropped because it describes a
value at a width the next render may not have, and the ready attribute goes
too — which puts the resize handle back and is exactly the state a second
`init()` expects to find. In lane 1 there is nothing to clean up and nothing is
returned — which leaves the ready attribute standing on the field, harmlessly:
the only rule that reads it is in lane 2's half of the stylesheet, and a second
`init()` writes it again.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it
is only used to warn about author mistakes (the module on something that is
not a `<textarea>`). Without it the module degrades silently.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
