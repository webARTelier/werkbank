# slider

A slider (carousel) an editor places by naming its **type**: the markup is a
container and a list of slides, one attribute says which kind of slider it is,
and everything else — how many slides are on screen, whether it fades, whether
it rotates on its own — comes from a named preset. [Swiper](https://swiperjs.com)
does the sliding; without it the same markup is a horizontal, scroll-snapping
strip that needs no script at all.

This is the **one component in the collection with a vendor dependency**, and
it is self-hosted: Swiper is an npm package, bundled into this component's own
lazy chunk and its core stylesheet inlined into `slider.min.css`. There is no
CDN tag, no second `<script>` and no third-party request at runtime — the
version that ships is the version `package.json` pins.

## Files needed to copy
- `slider.html` – markup
- `slider.scss` – styles (source; compiled to `dist/css/slider.min.css`)
- `slider.js` – behavior
- `src/_shared/js/formatTemplate.js` – bundled utility (interpolates the label templates)
- `src/_shared/js/getCssCustomProperty.js` – bundled utility (reads `--slider-gap` and the breakpoint tokens)
- `src/_shared/js/parseNonNegative.js` – bundled utility (turns those values into numbers)
- `src/_shared/js/resolveLocale.js` – bundled utility (picks the built-in de/en wording from `<html lang>`)
- **`swiper`** from npm (`npm install swiper`) – the vendor library

The four utilities are bundled into the component's chunk by the build; they
only matter if you paste the source into a plain project. Swiper does not: it
is a real dependency, and a project pasting these files needs it installed (or
must reach for a `<script>` of its own).

## Usage

A root, a track, and slides — nothing else:

```html
<div class="m-slider" data-slider-type="gallery"
     data-slider-label="Latest articles" data-js-behavior="slider">
  <ul class="m-slider__track" role="list" data-slider-track>
    <li class="m-slider__slide">…</li>
    <li class="m-slider__slide">…</li>
    <li class="m-slider__slide">…</li>
  </ul>
</div>
```

`data-slider-track` marks the track, and **every element child of it is a
slide** — there is no per-slide attribute to remember, so adding a slide in a
CMS is adding a list item. The controls (previous/next, the bullets, and a
stop/start control where the type rotates) are **injected**; you never write
one.

A `<ul>`/`<li>` is the recommended track, and not only out of habit: the list
is what tells a reader without this script how many slides there are, and the
module keeps it intact (see [Accessibility](#accessibility)).

Media inside a slide takes its box from a container **you** style — the
component never sizes an image (see the media-sizing section in
[`CLAUDE.md`](../../../CLAUDE.md)):

```css
.mySlide__media { inline-size: 100%; aspect-ratio: 16 / 9; }
.mySlide__image { display: block; inline-size: 100%; block-size: 100%;
                  object-fit: cover; }
```

A slider is as tall as its tallest slide, because the track is a flex row.
Where that is wrong, the preset can ask Swiper for `autoHeight: true`.

## The slider types — the part your project owns

`data-slider-type` names one entry of the `presets` object at the top of
`slider.js`. **Rewriting that object is the expected way to use this
component**: which kinds of slider a site has is a design decision, and it
belongs in one place a CMS dropdown can mirror. Four ship as examples:

| Type | What it is |
|---|---|
| *(none)* / `default` | one slide at a time, previous/next + bullets |
| `hero` | one slide, cross-faded, rotating every 6 s |
| `gallery` | 1 slide per view, 2 from the `small` breakpoint, 3 from `large` |
| `showcase` | slides at their own width (`--slider-slide-size`), the next one peeking in at the trailing edge |

An entry is a plain [Swiper options
object](https://swiperjs.com/swiper-api#parameters) with three conveniences:

| In a preset | Effect |
|---|---|
| `navigation: true` | inject a previous/next pair and wire it |
| `pagination: true` | inject one bullet per slide and wire it |
| `breakpoints: { small: … }` | breakpoint **names** (`small`, `medium`, `large`, `xxl`) instead of pixel values, resolved from the `--bp-*` tokens — so a preset cannot drift away from `_shared/scss/_breakpoints.scss` |

A missing `data-slider-type` takes the `default` entry; an **unknown** one is
reported and then also takes it, because an editor's typo must not cost the
slider.

What deliberately does *not* belong in a preset is `keyboard`, `a11y`, `rewind`
and the autoplay guards: those sit in `baseOptions` next to it, because they
are decisions about the component rather than about a kind of slider. A preset
can still override them — `keyboard: { enabled: false }` is how a type opts out
of the arrow keys.

### Options on the root

| Attribute / class | Effect |
|---|---|
| `data-slider-type="…"` | which entry of `presets` to use. Default: `default` |
| `data-slider-label="…"` | the slider's accessible name, e.g. `Reference projects`. **Strongly recommended** — a missing one is reported and a generic name stands in, because a named region is what lets a screen reader user find and skip the thing |
| `class="m-slider--overlay"` | lays the controls bar over the slides' block-end edge instead of below them. For a hero whose slides are images; where there is text under the controls, leave them in the flow |

### Styling

Everything else is CSS — how wide a slide is, how big the controls are, where
they sit and what they look like are questions about a box:

| Custom property | Default | Effect |
|---|---|---|
| `--slider-gap` | `var(--space-s)` | between two slides, in **both** renderings (see below) |
| `--slider-slide-size` | `100%` | how wide one slide is; the answer `slidesPerView: "auto"` is asking for |
| `--slider-button-size` | `2.75rem` | the previous/next/rotation hit area (44px, WCAG 2.5.5) |
| `--slider-icon-size` | `1.25rem` | the glyph inside it |
| `--slider-bullet-size` | `0.625rem` | the visible dot |
| `--slider-bullet-target` | `1.5rem` | the invisible hit area around it |
| `--slider-radius` | `var(--borderRadius)` | the buttons' corner |
| `--slider-border-width` | `1px` | the buttons' edge |
| `--slider-controls-gap` | `var(--space-2xs)` | control to control |
| `--slider-controls-spacing` | `var(--space-s)` | track to the controls bar |
| `--slider-controls-justify` | `center` | how the bar is aligned |
| `--slider-overlay-inset` | `var(--space-s)` | `--overlay` only: bar to the track's edge |
| `--slider-color` / `-color-hover` | muted / text | the controls' resting and hover tones |
| `--slider-bg-color` / `-bg-color-hover` / `-border-color` / `-border-color-hover` | transparent / overlay / control / control-strong | the buttons' surfaces and edges |
| `--slider-bullet-color` / `-bullet-color-current` | control border / secondary accent | the dots |
| `--slider-overlay-bg-color` | 75% of `--color-bg` | `--overlay` only: the plate behind the controls |
| `--slider-icon-prev` / `-next` / `-stop` / `-start` | chevrons, pause, play | the four glyphs, as mask URLs |
| `--slider-duration` / `-easing` | half `--an-duration` / `--an-ease` | the controls' hover transition |

They belong on the **root**, not on an ancestor: the component declares every
one of them on its own root, and a declaration on an element beats an inherited
value no matter what the ancestor's specificity is.

How long a **slide** takes is not CSS: it is Swiper's `speed`, a preset option.

Replacing the glyphs with your own icon set is expected. Keep the two rotation
states two distinct **shapes** rather than two colours of one shape — the shape
is what carries the state in greyscale, in print and in a forced-colors theme
(WCAG 1.4.1).

### `--slider-gap` is read from both sides

The distance between two slides is stated **once**. This stylesheet uses it as
the pre-enhancement strip's `gap`, and the module reads the same value and
hands it to Swiper as `spaceBetween`, re-reading it whenever the viewport
changes — so a responsive gap is one declaration and not two numbers to keep in
step. A preset that states `spaceBetween` itself takes over, and the reading
stops.

## Progressive enhancement

Before the module arrives — and forever if the chunk never does — the track is
a horizontal, scroll-snapping strip of slides. That is CSS on its own: every
slide is in the document, in reading order, and reachable by dragging, by a
trackpad and by a scrollbar. Nothing is hidden and no control is promised that
does not exist, so the cost of a chunk that never arrives is the transitions
and the buttons, not the content.

Which is why `data-slider-ready` is read **positively** — the same inversion
`dataTable`, `fileUpload` and `passwordToggle` use — and
why this is the one component in the collection whose conditional rules are
**not** wrapped in `@media (scripting: enabled)`. The mixin's condition is
right when the stylesheet can deliver the enhanced state on its own, because
then the unenhanced markup is a transitional state a reader with scripting off
should never see. Here it is the opposite: the strip is that reader's design,
so hiding it from them is exactly what must not happen. See
[`docs/preEnhancement.md`](../../../docs/preEnhancement.md).

The flag also has a job at a precise moment. It hands the box over to Swiper —
the scroll container and the CSS `gap` hang off its absence — so `init()` sets
it **before** the instance is built, and Swiper then measures a clean box. A
scroll offset the reader left behind goes with it, because an element that
stops scrolling is at 0 by definition.

Two bail-outs withhold it, and both leave the authored markup exactly as it is:
a root with no `[data-slider-track]` (reported), and a track with fewer than
two children (not reported — a slider an editor filled with one thing is not an
error, and the markup is already what it should look like).

## Accessibility
- **The ARIA APG carousel pattern**, most of it written by Swiper's A11y
  module: `role="group"` plus `aria-roledescription` and an accessible name on
  the root, a label per slide (“3 of 7”), `aria-live` on the track while
  nothing rotates — and `off` while something does, because a live region plus
  a timer is an announcement nobody asked for — `aria-current` on the bullet of
  the current slide, and a slide scrolled into view when something inside it
  takes focus.
- **The slides stay a list.** Swiper's `slideRole` is deliberately turned off:
  the authored markup is a `<ul>`, which is what tells a reader without the
  script how many slides there are, and overwriting each `<li>` with
  `role="group"` would leave an empty list behind. The carousel semantics
  arrive as `aria-roledescription="slide"` instead, which adds the word without
  taking the role away.
- **Keyboard control is on by default and scoped to focus.** Swiper's Keyboard
  module is what runs, but it is enabled while focus is inside *this* slider
  and disabled again when focus leaves, instead of the library's own default of
  listening on `document` for anything in the viewport. Two sliders on one page
  would otherwise both step on one press. `PageUp`/`PageDown` — which Swiper
  hijacks by default too — are never taken: they are scrolling keys and they
  belong to the page.
- **Real buttons named by real text.** Every control is a
  `<button type="button">` whose name is a text node, hidden visually and only
  visually, so it still names the control if this stylesheet never loads. The
  glyphs are CSS masks on pseudo-elements — nothing for a screen reader to
  announce or skip. Swiper's own `aria-label` for the two navigation buttons is
  fed the *same* strings, so what is seen and what is announced cannot differ
  (WCAG 2.5.3).
- **No control ever leaves the tab order.** Every preset `rewind`s instead of
  stopping at its ends, which is what keeps Swiper from setting `disabled` and
  `tabindex="-1"` on a navigation button at the last slide: a control that
  becomes disabled under the focus drops it to `<body>`, and the next Tab
  starts over at the top of the page.
- **A rotating slider can be stopped, four ways** (WCAG 2.2.2): the control,
  the pointer resting on it, focus entering it, and `prefers-reduced-motion`,
  which starts it stopped and holds if the preference is switched on later — the
  same opt-in `marquee` uses. A rotation the reader stopped with the control
  never comes back on its own.
- **The rotation control's name changes** (“Stop”/“Start”) rather than carrying
  `aria-pressed`: for a transport control the useful announcement is what
  pressing does next, which is the reading `video`'s play/pause control follows
  and the opposite of `passwordToggle`'s. Its glyph follows from a state class
  written in the same method, so the two cannot drift.
- **Reduced motion is honoured three times**: the rotation does not start, the
  slide change is instant (Swiper's `speed`, set from the module because the
  library animates the track with an inline `transition-duration` no rule can
  outrank), and the controls' hover transitions are off (the stylesheet).
- **Bullets are rendered by the module, not by Swiper.** Two reasons: a
  `<button>` Swiper writes itself carries no `type` attribute and would
  therefore *submit* a form the slider happens to sit in, and a bullet named by
  a real text node keeps its name where this stylesheet never arrived.

## Styling notes
`slider.min.css` ships the strip, the handover, the controls and the four
glyphs. What a **slide** looks like is yours, and so is the container that gives
a picture its size and `aspect-ratio` — that container is part of the wiring,
not an optional nicety. `demo.html` shows one complete example design.

The stylesheet neutralises exactly one vendor declaration, and it has to:
`.swiper` centres itself with auto inline margins, and an auto margin in the
cross axis of a flex container does more than centre — it stops the item from
being stretched. A slider inside a column flex layout would then shrink to its
content, and its content is a row of slides that are each 100% of it: a circle
the engine resolves at its maximum layout unit (33 554 432px, measured in both
Chromium and WebKit, taking the whole page with it). `margin-inline: 0` is the
fix; centring the slider inside a `max-width` stays your call.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying `data-js-behavior="slider"`,
and that element must contain a `[data-slider-track]` — the reporter warns and
it bails otherwise. It writes no inline styles of its own: the state hooks are
`data-slider-ready`, `aria-current` (Swiper's) and one `is-paused` class. The
inline styles on the track and the slides are Swiper's own transforms and
widths, which is what the vendor is for.

`init()` returns a cleanup function, so a host that mounts and unmounts the
same markup (an SPA route change, a framework re-render — see
`destroyModulesInScope()` in `boot.js`) gets the authored markup handed back:
the two focus listeners and the media-query listener removed, the Swiper
instance destroyed with its inline styles and classes, the injected controls
gone, the vendor classes swept off the root, the ARIA Swiper wrote onto markup
the module does not own restored to whatever the author had, and the ready
attribute last of all — leaving the scroll-snap strip.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it
is only used to warn about author mistakes (a missing track, an unknown slider
type, a missing label, an unknown breakpoint name in a preset). Without it the
module degrades silently.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
