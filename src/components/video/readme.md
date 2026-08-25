# video

CMS-maintainable **self-hosted** video: a `<video>` with responsive sources
(resolution ladders and art direction via `<source media>`), in two
behavioural modes the markup picks.

> **Third-party video moved out.** The YouTube click-to-load facade that used
> to ship here as variant C is now [`embedConsent`](../embedConsent/readme.md),
> which generalises it to Vimeo, maps and any other iframe — and adds the two
> halves this facade did not have: the notice that makes the click an informed
> one, and the seam that lets a visitor's existing consent skip the click.
> Nothing in this component knows a third-party host any more.

## Files needed to copy
- `video.html` – markup (two variants; the play/pause SVGs are
  inlined there)
- `video.scss` – styles (source; compiled to
  `dist/css/video.min.css`)
- `video.js` – behavior
- `src/_shared/js/resolveLocale.js` – bundled utility (imported by the module;
  the build already bundles it into the component's chunk, only relevant if
  you paste the source into a plain project)
- shared: `_shared/media/img/system/play.svg` / `pause.svg` – source files of
  the inlined button icons (the build does not copy `media` into `dist`,
  which is why the snippet inlines them)

## Usage

Wrap every instance in your own **media container** — the project layout owns
size and aspect ratio (e.g. `aspect-ratio: 16 / 9` on the wrapper). The module
root fills that container and the media covers it with `object-fit: cover`.
This is the project-wide media-sizing rule, not a quirk of this component.

Two variants, both with `data-js-behavior="video"` on the module
element (see `video.html` for ready-to-paste markup):

### A) Self-hosted, click-to-play (default)

The `<video>` ships native `controls` (the no-JS baseline) plus a hidden
overlay button. The script takes the controls over and shows one centered
play button instead; a click swaps button for native controls and plays;
pause/end swaps back.

### B) Self-hosted, ambient loop

`autoplay muted loop playsinline` on the `<video>` — it runs natively. The
script adds a persistent play/pause toggle (WCAG 2.2.2) and prevents the
autostart under `prefers-reduced-motion: reduce` (play is the explicit
opt-in). The corner placement of the toggle is the author-set
`m-video--ambient` modifier class; the behaviour follows the native
`autoplay` attribute.

### Responsive sources

Declare one `<source media="…">` per rendition — first match wins, exactly
like the native rule; keep one attribute-less source as the fallback, last in
the list. This one mechanism covers both:

- **Resolution ladder** — same footage, e.g.
  `media="(min-width: 990px) and (min-resolution: 2dppx)"` for the 4K file.
- **Art direction** — different footage/ratio per viewport, e.g.
  `media="(max-width: 767px)"` for a portrait crop.

The browser applies the list once at load (native behaviour, works without
JS); the script re-runs the selection on every media-query change (resize,
rotation) and carries playback position and play state over to the newly
chosen source.

## Accessibility

- The overlay buttons ship `hidden` and are revealed by the script — no dead
  controls without JS. Labels are localized (de/en from `<html lang>`) and
  switch between play and pause; the inline SVGs are `aria-hidden`.
- Autoplaying loops get a persistent pause control (WCAG 2.2.2) and do not
  start under `prefers-reduced-motion: reduce`.
- Click-to-play hands keyboard focus over in both directions: play moves it
  from the hiding button to the `<video>` (whose native controls just
  appeared), pause moves it from the `<video>` back to the reappearing
  button.

## Integration

The JS exports `init(el, services)` and is loaded lazily by `boot.js` when it
finds `data-js-behavior="video"`. It sets no inline styles: it toggles
`hidden` on the overlay button and writes `is-playing` on the module element —
the hooks the stylesheet keys on. `services.reporter` is optional (used only
for warnings, e.g. a missing toggle or a `<source media>` typo).

## Demo

Open `demo.html` in the browser (requires a prior `gulp build`).
