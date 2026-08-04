# video

CMS-maintainable video embeds: self-hosted `<video>` with responsive sources
(resolution ladders and art direction via `<source media>`), or YouTube behind
a GDPR-friendly click-to-load facade (youtube-nocookie, nothing loads from
Google before the click).

## Files needed to copy
- `video.html` – markup (three variants; the play/pause SVGs are
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
Caveat: `object-fit` cannot reach *into* the YouTube iframe — footage whose
ratio differs from the container letterboxes there.

Three variants, all with `data-js-behavior="video"` on the module
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

### C) YouTube, click-to-load facade

```html
<div class="m-video" data-js-behavior="video"
  data-video-youtube="https://www.youtube.com/watch?v=…"
  data-video-title="What the video shows">
```

The CMS supplies a **locally hosted poster** (`[data-video-poster]`),
a no-JS fallback link (`[data-video-fallback]`) and the video as a
**full URL or bare 11-character id** — editors can simply paste the browser
URL (`watch`, `youtu.be`, `shorts`, `embed` and `live` shapes are recognized).
Only the user's click creates the `youtube-nocookie.com` iframe (with
autoplay, so nobody presses play twice).

### Responsive sources (self-hosted)

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
- The injected iframe gets a `title` (from `data-video-title` —
  set it, the fallback is generic) and receives focus after the facade button
  disappears.
- Click-to-play hands keyboard focus over in both directions: play moves it
  from the hiding button to the `<video>` (whose native controls just
  appeared), pause moves it from the `<video>` back to the reappearing
  button.

## Integration

The JS exports `init(el, services)` and is loaded lazily by `boot.js` when it
finds `data-js-behavior="video"`. It sets no inline styles: it toggles
`hidden` on its elements, writes `is-playing` on the module element and stamps
the injected iframe with `[data-video-embed]` — the hooks the
stylesheet keys on. `services.reporter` is optional (used only for warnings,
e.g. an unparseable YouTube URL, a missing toggle or a `<source media>` typo).

## Demo

Open `demo.html` in the browser (requires a prior `gulp build`).
