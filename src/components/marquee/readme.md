# marquee

An infinitely scrolling content strip (news ticker), built as a progressive
enhancement on a static row. The script measures the content, clones the
track just often enough for a seamless loop and drives it with the Web
Animations API — without JavaScript the strip is simply a static, fully
readable row.

## Files needed to copy
- `marquee.html` – markup
- `marquee.scss` – styles (source; compiled to `dist/css/marquee.min.css` — ships only the structural rules the animation needs, see *Styling*)
- `marquee.js` – behavior
- `src/_shared/js/debounce.js` – bundled utility (imported by the module; the build already bundles it into the component's chunk, only relevant if you paste the source into a plain project)

There is **no vendor dependency**.

## Usage
Put `data-js-module="marquee"` on the module element. Inside it:

- `[data-marquee-container]` — the clipping viewport (a flex row),
- exactly **one** `[data-marquee-animated]` — the track that scrolls and gets
  cloned,
- optionally (strongly recommended) a `<button data-marquee-toggle hidden>` —
  **outside** the container so it is not cloned. The script reveals it and
  wires it as a pause/play toggle.

```html
<div class="m-marquee" data-js-module="marquee">
  <button class="m-marquee__toggle" type="button" data-marquee-toggle hidden>
    Pause
  </button>
  <div class="m-marquee__strip" data-marquee-container>
    <p class="m-marquee__track" data-marquee-animated>+++ News +++</p>
  </div>
</div>
```

The clone count is re-evaluated (debounced) on resize, via `ResizeObserver`,
after web fonts load and on window `load`, so the loop never shows a gap on
wide viewports and cleans itself up when it is not needed.

### Options (all optional; on the module element)

| Attribute | Effect |
|---|---|
| `data-marquee-direction="left\|right"` | visual scroll direction (default `left`). In an RTL context (`dir="rtl"`) the translate range is mirrored automatically, so both directions stay seamless. |
| `data-marquee-start="always\|overflow"` | `overflow` animates only while the content is wider than the visible track; once everything fits, the animation stops and the clones are removed (default `always`) |
| `data-marquee-duration="8"` | seconds one track needs for a full cycle (positive number) |
| `data-marquee-speed="80"` | pixels per second — a constant-velocity alternative to `duration`, so tickers with differently long content scroll at the same speed. When set it takes precedence over `duration` (positive number). |
| `data-marquee-clones="3"` | minimum number of generated clone tracks (positive integer); raised automatically when a wide viewport needs more |

Invalid values fall back to the defaults with a reporter warning.

## Accessibility
- **Progressive enhancement:** without JavaScript nothing moves, nothing is
  duplicated and the pause button stays `hidden` — the content is a plain
  static row.
- **Clones are invisible to AT:** every generated track copy gets
  `aria-hidden="true"` and `inert`, and cloned `id`s are stripped, so screen
  readers and the tab order only ever meet the original content once.
- **Pause, Stop, Hide (WCAG 2.2.2):** hovering the track pauses it, keyboard
  focus inside it pauses it, and the `data-marquee-toggle` button pauses it
  durably. Keep the button's label constant ("Pause") — the script reflects
  the state via `aria-pressed` (APG toggle-button pattern). A marquee without
  a toggle triggers a reporter warning.
- **`prefers-reduced-motion: reduce`** starts the marquee paused; pressing
  the toggle is an explicit opt-in to motion. A runtime switch to `reduce`
  pauses it again. This is handled in the JS because the animation is WAAPI,
  which a CSS media query cannot stop.
- **No live region:** the moving text is the original, readable content;
  announcing every loop would be noise.

## Styling
`marquee.min.css` ships **only** the structure the animation cannot work
without, keyed on the behavioural data attributes: the container is a
clipping flex row, the track keeps its intrinsic width (`flex: 0 0 auto`,
`white-space: nowrap`, `max-inline-size: none` — so a generic prose rule
like `p { max-width: 65ch }` cannot clamp it) and carries the repetition gap
as `padding-inline-end`.

- `--marquee-gap` — space between repetitions (defaults to the shared
  `--space-l`); override per instance, e.g. `style="--marquee-gap: 96px"`.
  It must stay padding-based: the loop travels exactly 100% of the track's
  border box, so outside spacing (margin, flex `gap`) would break it.

Everything visible is yours to style via your own classes (the `m-marquee*`
classes in the snippet are suggestions) and the state hooks the JS writes
(it never reads them back):

- `is-running` on the module element — animations are built (e.g. reveal the
  pause button: `.m-marquee:not(.is-running) .m-marquee__toggle { display: none; }`)
- `is-paused` on the module element — the user chose pause (toggle or
  reduced motion); transient hover/focus pauses do not set it

Style the toggle's own `:focus-visible` ring in your project too (focus-ring
convention in the project `CLAUDE.md`). `demo.html` shows one complete
example design.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is
loaded on demand by `boot.js` for every element carrying
`data-js-module="marquee"` — one controller instance per element. It sets no
inline styles; motion runs on Web Animations API `Animation` objects, state
is expressed through the `is-running` / `is-paused` classes.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it
is only used to warn about author mistakes (missing container/track, invalid
option values, missing pause toggle). Without it the module degrades
silently.

The `countdown` component detects a surrounding marquee (via
`data-js-module`) and mirrors its live values into the cloned tracks — see
`countdown/readme.md`. The seamless loop relies on every track being an
exact, equal-width copy, so the marquee re-clones whenever the source
track's width changes (e.g. once, after a nested countdown injects its pause
control, or after web fonts load). Content that changes width *frequently*
(such as a per-second seconds unit) is therefore best avoided inside a
ticker — mirror only the slow units (days / hours / minutes).

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
