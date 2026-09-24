# autoGrowTextarea

A `<textarea>` that is as tall as what is written in it: no box of empty rows
kept open for a value nobody has typed yet, and no inner scrollbar until the
value really is longer than the field may be. It is the platform's
`field-sizing: content` plus the two clamps that make it a policy — and it is
**CSS only**: no script, no `data-js-behavior`, nothing to boot.

## Files needed to copy
- `autoGrowTextarea.html` – markup
- `autoGrowTextarea.scss` – styles (source; compiled to `dist/css/autoGrowTextarea.min.css` — this is the component, see *Styling*)

There is **no JavaScript** and **no vendor dependency**.

## Usage

Put the class on the `<textarea>` itself. There is no wrapper and nothing is
injected:

```html
<label for="message">Your message</label>
<textarea class="c-autoGrowTextarea" id="message" name="message" rows="3"></textarea>
```

Keep a `rows` attribute matching `--autoGrowTextarea-min-rows`: an engine
without `field-sizing` keeps the field at that height (see *Browser support*).

### Options (all of them are CSS)

How few lines the field may be, how many it may grow to and what happens past
that are questions about a box, so they are set in CSS.

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
what stops that, and it is stated outside the `@supports` block, so an engine
without `field-sizing` shows the same width rather than the `cols` one. It is
a default, not a claim on the axis — give it a length of your own, or let your
own field styles carry the width (same cascade rule as above). Two things it
inherits from being a percentage: it needs a container that has a width of
its own (inside a box that is sized by its content — a flex or grid item, a
float — state a length instead), and under `box-sizing: content-box` a field
at `100%` overflows its container by its padding and border, exactly as
`--autoGrowTextarea-box-extra` describes for the block axis.

`rows` is not the minimum where the field grows: an engine that sizes a field
to its content ignores the attribute (a `rows="3"` field is one row tall while
empty), which is why the minimum is stated in `lh`.

The component combines with any module on the same field — the class does not
care what `data-js-behavior` the field carries. The demo pairs it with
`inputCharCount`.

If the field holds an address, give it `autocomplete="street-address"` — the
one `autocomplete` token that expects a multi-line control, and therefore the
one case in which WCAG 1.3.5 has something to ask of a `<textarea>`. Every
other token names a single-line value and does not belong on one.

## Browser support

`field-sizing: content` is in all three current engines: Chromium since 123,
Safari since 26, Firefox since 137 — verified here in Chromium 151, WebKit
26.5 and Firefox 153, with pixel-identical results. There the field grows at
the first paint, with scripting on or off, and every value change the field
can see is covered by the engine itself: typing, pasting, autofill, a script
setting `value`, a form reset, a width change, web fonts arriving, a reader's
own stylesheet or text zoom.

An engine **without** it keeps the field at its `rows` height, with the
minimum and the cap still applied, an inner scrollbar and its resize handle —
a working field that simply does not grow, with nothing hidden. That is the
whole fallback, and it is deliberate.

Until 2026-09-24 the component shipped a module for those engines, which
measured the value and handed the height to the stylesheet. It went because
the difference it bought was cosmetic, while its cost was a lazy chunk, a
`ResizeObserver` and a handful of listeners on every page with a textarea on
it — and a second lane whose every rule had to be kept identical to the first.
A project that still has to make older Safari or Firefox grow the field can do
it in a few lines of its own (on `input`, reset the inline height and set it to
`scrollHeight`); the component no longer carries it.

## Accessibility
- **Nothing to enhance.** The field is a native `<textarea>` from the first
  paint, and the growing is layout, not behaviour.
- **The resize handle is only dropped where growth is delivered** — inside the
  same `@supports` block as `field-sizing`. An engine that cannot grow the
  field keeps the handle, because dragging it open is then the reader's only
  way out of a value that does not fit. Where growth *is* delivered, keeping
  the handle would offer a way out that does not exist: dragging a field
  writes an inline `height`, and `max-block-size` beats a height whatever the
  specificity — measured in Chromium, `height: 347px` written to the field
  while its box stayed at 144px; in WebKit the drag does not take at all. Past
  the cap it is the field's own scrolling that keeps the value reachable, not
  the handle.
- **Nothing is announced and nothing is claimed.** The value is in the field
  either way and the only thing that changes is the size of the field's own
  box, so no ARIA is set and no state class is written.
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
`autoGrowTextarea.min.css` is the component — the two clamps, the scrolling
past the cap, `field-sizing`, the resize handle and the width (see
`--autoGrowTextarea-inline-size` above). It ships no colours, no border, no
radius and no focus ring: style the field the way you style your other
fields, its `:focus-visible` ring included (focus-ring convention in the
project `CLAUDE.md`). `demo.html` shows one complete example design.

Because the clamps are counted in `lh` — the line box of this very field —
they follow your type scale without a second decision, which is also why the
field needs a `line-height` and a `font` you control (a textarea does not
inherit the page font on its own; `font: inherit` is the usual line).

## Integration
There is nothing to integrate: no `init()`, no entry in the loader's registry,
no ready attribute and no cleanup. A host that mounts and unmounts markup (an
SPA route change, a framework re-render) gets the component with the class and
loses it with the node.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
