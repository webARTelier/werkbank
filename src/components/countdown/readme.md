# countdown

Live countdown to a target date.

## Files needed to copy
- `countdown.html` – markup
- `countdown.scss` – styles (source; compiled to `dist/css/countdown.min.css`)
- `countdown.js` – behavior

## Usage
The root element gets `data-js-module="countdown"` as well as `data-countdown-date` with the target date (e.g. `2026-12-31T23:59:59+01:00`, optionally on a child element too). Inside it are the output elements with `data-countdown-days`, `data-countdown-hours`, `data-countdown-minutes` and optionally `data-countdown-seconds`, which are updated every second.

Optional attributes:
- `data-countdown-label` — names what the countdown counts to (e.g. `the New Year`). It is woven into the screen-reader sentence and the "finished" announcement.

Recommended structure (see `countdown.html`): wrap the unit columns in `[data-countdown-display]` › `[data-countdown-units]`, mark each unit column with `[data-countdown-unit]`, and add an empty `[data-countdown-summary]` node. This is what powers the accessibility behavior below. (The `[data-countdown-unit]` hook lets the script hide the whole seconds column under `prefers-reduced-motion` without depending on the `m-countdown__unit` style class.)

## Accessibility (BITV / WCAG)
- **2.2.2 Pause, Stop, Hide (A):** the auto-updating display is paused/resumed by a `<button>` that `countdown.js` injects — no author markup needed.
- **prefers-reduced-motion:** the tick slows to once per minute and the fast-churning seconds unit is hidden, so reduced-motion users get no per-second flicker.
- **4.1.3 / 1.3.1 (screen readers):** the visual columns are `aria-hidden`; a single natural-language sentence in `[data-countdown-summary]` carries the value inside a `role="timer"` region (`aria-live="off"`, so it is read on demand, never announced per second). Reaching the target emits one polite `role="status"` message.

For the fullest experience, place a visible heading or intro next to the countdown (or set `data-countdown-label`) so it is clear what is being counted down to.

## Localization
The screen-reader announcements default to English. They are built by the `formatUnit`, `formatSummary` and `formatFinished` functions in the `defaults` config in `countdown.js`, each receiving raw values so word order and pluralization stay under your control — override them (together with `toggleLabelPause` / `toggleLabelResume`) to translate the countdown.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
