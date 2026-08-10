# readMore

Cuts a long text down to a preview of a few lines and gives the reader one
control that opens it again — with the preview in place from the first paint,
and without ever showing a "Read more" under a text that is already complete.

## Files needed to copy
- `readMore.html` – markup
- `readMore.scss` – styles (source; compiled to `dist/css/readMore.min.css`)
- `readMore.js` – behavior
- `_shared/js/rafThrottle.js` – utility imported by the behavior (copy alongside it)
- `_shared/js/uniqueId.js` – utility imported by the behavior
- `_shared/js/resolveLocale.js` – utility imported by the behavior

## Usage

The **root** carries `class="c-readMore"` and `data-js-behavior="readMore"`. It
holds two things: the region that gets cut, and the control that opens it.

```html
<div class="c-readMore" data-js-behavior="readMore">

  <div class="c-readMore__body" data-readmore-body id="readMore-story">
    <p>…</p>
    <p>…</p>
  </div>

  <a class="c-readMore__toggle" href="#readMore-story" data-readmore-toggle>
    Read more
  </a>
</div>
```

The text inside the region stays ordinary markup — the component never looks
into it.

### How much is shown

A stylesheet setting, not a script one:

| Property | Default | Meaning |
| --- | --- | --- |
| `--readMore-lines` | `6` | how many lines the preview shows |
| `--readMore-collapsed-size` | `calc(var(--readMore-lines) * 1lh)` | the preview height, for a measure of another kind (`12rem`) |
| `--readMore-fade-size` | `var(--space-xl)` | how deep the preview fades out at the cut; `0px` for a clean edge (with the unit — it is read inside a `min()`) |
| `--readMore-duration` | `var(--an-duration)` | how long opening and closing take; `0s` for no movement at all |
| `--readMore-easing` | `var(--an-ease)` | the movement's easing |

`lh` is the height of one line box of *this* text, so the cut lands on a line
boundary whatever the project's type scale does, and it follows a font-size
change without a second decision. Set either property on the root —
`style="--readMore-lines: 3"` is enough for a single instance.

### The toggle

Write it as `<a href="#<the region's id>">`. That is a control with a job
before the module exists: it takes the reader to the region, and `:target` in
the stylesheet hands the full text back. Once the module has loaded, the link
is upgraded the same way `offCanvasNav` upgrades its burger — the jump is
prevented, `role="button"` is set and Space is handled, because a control that
opens and closes a region is a button.

A `<button type="button">` works too, but it does nothing until the chunk
arrives, so the stylesheet then leaves the text uncut until then (see below) —
you trade the preview on the first paint for markup with no fragment in it. The
`type` is not optional: inside a form a `<button>` without it submits.

The control's own text is the **closed** label; the module swaps it for the open
one and back — a text swap, so the control holds *text*, not markup: an icon
element inside it would be replaced by the label. (That is why the chevron is a
pseudo-element in the stylesheet.) Both labels can be set explicitly:

| Attribute | Where | Meaning |
| --- | --- | --- |
| `data-readmore-expand` | root | the closed label; defaults to whatever the markup already says |
| `data-readmore-collapse` | root | the open label; ships in German and English, picked from `<html lang>` |
| `id` | region | required for `aria-controls` **and** for the no-script fallback; a missing one is generated and reported |

### Progressive enhancement

The preview is cut **from the first paint**, before any script has run: the
stylesheet states it, so nothing collapses under the reader a round trip later
— which for this component would mean whole screens of content moving. The
block is keyed off `data-readmore-ready`, which the module sets as its *first*
statement, so even a bail-out on unusable markup lifts the cut instead of
leaving a shortened text behind.

Shipping that pre-enhancement state at all is only safe because of the
fragment escape (see [`docs/preEnhancement.md`](../../../docs/preEnhancement.md)):
if the chunk 404s, the toggle is still a working in-page link and `:target`
lifts the cut. Both halves are required — the `id` on the region and the
matching `href` on the toggle — and the stylesheet checks the first of them
(`[id]`), so a region nothing can address is never cut before the module has
looked at it.

That fragment keeps working **after** the enhancement, which is the point that
is easy to lose: `:target` answers only for as long as the module has not run,
because running it is what lifts the pre-enhancement block. So the module
watches the fragment itself — on load and on every `hashchange` — and opens the
region when it points at it, or at an anchor *inside* the text (the browser
scrolls there either way, so a target below the cut would otherwise be one the
reader is taken to and then not shown). Without that, an in-page link to a long
text would work before the chunk arrived and do nothing afterwards.

Three more things follow from where the work is split:

- **The control appears only where it does something.** The module measures,
  with the cut in force, whether anything is below it; a text that fits loses
  the control (`hidden`), and a narrower viewport, a larger font or new content
  brings it back. This is the part CSS cannot do, and the reason the component
  exists as a script at all.
- **An engine that cannot resolve the preview height shows the whole text.**
  The fade is drawn from the same length as the cut, so both fail together —
  there is no state in which the text is complete but the last lines fade out.
- **The same direction for the selector.** The pre-enhancement rule carries a
  `:not(:has(:target))` for the anchor-inside-the-text case; an engine that does
  not know `:has()` throws the whole selector out, which drops the pre-cut and
  shows the full text. Every way this block can fail ends with more text on
  screen, never less.

`prefers-reduced-motion` makes opening and closing instant, printing shows the
whole text and drops the control, and a `forced-colors` context drops the fade
(a mask is not touched by the forced palette, and thinning out text is the
opposite of what that context is for).

### The movement

Opening and closing animate the region's height, in every engine — and that
last part is the whole design of it. A transition interpolates two **lengths**;
it cannot travel towards an intrinsic keyword like `max-content`. Only Chromium
can, through `interpolate-size`, which is why an implementation that leans on
that keyword animates there and snaps in Firefox and Safari.

So the module measures the height of the whole text and hands it to the
stylesheet as `--readMore-content-size` — but only **for the duration of the
movement**, and it takes it back afterwards:

- **At rest the region is uncapped again** (`max-content`), so anything that
  grows inside an open region later — a nested disclosure, an image that
  arrives — is never clipped. A box that cannot grow triggers no
  `ResizeObserver`, so nothing would report such a clip either; the cap is
  temporary for exactly that reason.
- **Closing starts from the height the box actually has**, committed with one
  forced layout read before the state flips — including mid-movement, when the
  reader changed their mind halfway through opening.
- **The module reads the duration back from the stylesheet** to know when to
  give the height back, the way `offCanvasNav` times its exit. So
  `--readMore-duration` (and a `prefers-reduced-motion` preference, which
  flattens it) is followed without a second source of truth. `transitionend`
  cannot do that job here: an engine with nothing to animate stays silent, and
  Chromium reports the *physical* `max-height` for the logical property the
  stylesheet transitions.

The fade travels with the closing edge rather than sitting where the cut is, so
the text is rolled up behind it instead of the lower half going transparent
where it stands.

## Accessibility

- **The cut text stays in the accessibility tree.** That is the difference
  between this and a disclosure widget: nothing is hidden, a few lines are
  simply not painted. A screen reader reads the text in full in both states, so
  `aria-expanded` on the control describes a *visual* truncation. The
  alternative would be cutting a sentence in half for the readers who cannot
  see that it continues — and a text is one node either way, so there is no
  "rest" that could be hidden from anyone.
- **Focus landing below the cut opens the region.** Because the text is clipped
  rather than hidden, a link four lines below the cut keeps its place in the tab
  order; the browser would scroll it into a box that shows nothing (WCAG
  2.4.11). *Below* the cut only: the module compares the focused element's
  position with the region's bottom edge, because the preview is painted — a
  link in its first line is one the reader can see and a pointer can press, and
  opening the whole text underneath them would be a state change with nothing
  behind it. The pre-enhancement cut carries the same escape as CSS
  (`:not(:focus-within)`, which cannot make that distinction and does not need
  to — it is one load without a module, not a running widget), so the load where
  the chunk never arrives is covered too.
- **The control is a real control in both states**: a link before the module
  runs (Enter), a button afterwards (Enter and Space, `role="button"`,
  `aria-expanded`, `aria-controls`). The chevron is a pseudo-element drawn from
  `aria-expanded`, so what the eye sees and what a screen reader reads cannot
  drift apart, and the arrow is never announced twice.
- **Closing brings the start of the text back into view** when the reader has
  scrolled past it: the region's top edge does not move, only its bottom does,
  so everything below travels up by the lines that went away. How that scroll
  looks stays the page's decision (`scroll-behavior`).
- The focus ring comes from the shared `focus-ring()` mixin (`light` tone).
- **The control's hit area is the project's call.** It is laid out with no
  padding of its own, so the target is the line box of its label — a size the
  project's font size and line height decide, not this component. It stands
  alone under the text, which is normally enough for the spacing exception to
  WCAG 2.5.8; where another control sits close to it, give it a
  `min-block-size` of 24 px.

## Integration

The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying
`data-js-behavior="readMore"`.

The script writes attributes: `data-readmore-ready` and
`data-readmore-collapsed` on the root, `aria-expanded`, `aria-controls`,
`role="button"` and `hidden` on the toggle, plus the toggle's label text and an
`id` on the region where the markup carries none. It runs **no animation of its
own** — it hands over one length and flips a state attribute; the movement, its
duration and its reduced-motion escape live in `readMore.scss`.

The one thing it puts in a `style` attribute is that length,
`--readMore-content-size` (the same reason `dataTable` puts its two measured
edges there: only a measurement can answer how tall a text is). It is written
when a movement starts and removed when it ends, so a region at rest carries no
inline style at all. Do not set it yourself — it is a measurement, not a
setting.

It re-measures on a `ResizeObserver` (the region's own width), a
`MutationObserver` (a cut box cannot report that its content grew — its height
*is* the cut), `document.fonts.ready` and `window.load`, all collapsed into one
measurement per frame by `rafThrottle`, plus once more when a movement has
played out. It never measures **while the region is travelling**: a height that
has just been told to move still reports where it is coming from, which would
take the control away at the very moment the reader pressed it. The
`ResizeObserver` watches the region's box and therefore fires on every frame of
that movement, so the block is a flag the movement holds, not just an ordering
of statements. That last measurement is timed off `--readMore-duration` (plus
`transition-delay`, if a project sets one) rather than waited for with
`transitionend` — see *The movement* above for why that event cannot do the job
here.

The other listener on `window` is `hashchange`, for the in-page link described
under *Progressive enhancement*.

`data-readmore-collapsed` means "the region is closed", not "something is cut
off": it stays in place on a text that turned out to fit, because a
`max-block-size` above the content height paints nothing and the fade's stops
then lie past the end of the box. That is what makes the measurement possible at
all — `scrollHeight` and `clientHeight` only differ while the cut is in force.
Whether there is anything below the cut is answered by whether the control is
there.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is
used to report a missing text region, a missing toggle, and a region without an
`id` (which costs the no-script fallback).

`init()` returns a cleanup function that disconnects both observers, removes both
`window` listeners and hands the markup back as it was authored — including the
ready attribute, whose removal re-arms the pre-enhancement cut and puts the
markup in exactly the state a second `init()` expects. The loader only needs
this for a host that mounts/unmounts the same markup repeatedly instead of a
full page (re)load — see `destroyModulesInScope()` in `boot.js`.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
