# dialog

Accessible dialog/modal built on the native `<dialog>` element.

## Files needed to copy
- `dialog.html` – markup
- `dialog.scss` – styles (source; compiled to `dist/css/dialog.min.css`)
- `dialog.js` – behavior
- `_shared/js/rafThrottle.js` – utility imported by the behavior (copy alongside it)

## Usage
The dialog is a native `<dialog class="m-dialog" data-js-module="dialog">` with a unique `id`. It relies on the platform for the heavy lifting — the top layer, focus trap, `::backdrop`, `Esc` and focus restoration all come from the browser — so the module is a thin progressive enhancement that wires the outside trigger, adds backdrop-click dismissal, locks body scroll and stops media on close.

- **Open trigger:** any element carrying `data-open-dialog="<dialog id>"` — it can live anywhere on the page, including markup inserted after the dialog itself was initialized (clicks are handled through a single delegated listener on `document`, not one direct listener per trigger found at init). The JS reflects state into `aria-haspopup` and `aria-controls`. `aria-expanded` is added **only for a non-modal dialog** (a disclosure-like popup); a modal trigger follows the ARIA APG pattern and carries no `aria-expanded`.
- **Close control:** any element inside the dialog carrying `data-close-dialog` (a `<form method="dialog">` submit closes it natively too).
- **Modal (default):** opened with `showModal()`. Add `data-dialog-nonmodal` for a non-modal dialog opened with `show()` that leaves the rest of the page interactive and scrollable. Note that `Esc` only closes a **modal** dialog — the platform fires no `cancel`/`close` for a non-modal one — so a non-modal dialog must always keep a visible close control (the × button or a footer action).
- **Static:** add `data-dialog-static` to disable backdrop-click and `Esc` dismissal, so the dialog can only be closed by an explicit action.
- **Media cleanup:** on close every `<video>`/`<audio>` is paused. An embedded media `<iframe>` (e.g. a video) is only reloaded — the reliable way to stop it playing — when you mark it with `data-dialog-media`; unmarked frames are left untouched so a map, an embedded form or an app keeps its state instead of reloading on every close.
- Point `aria-labelledby` at the title's `id` so screen readers announce the dialog.
- **Scrollable body:** mark the scroll region with `data-dialog-scroll`. A plain overflowing box scrolls with the mouse but is invisible to the keyboard, so whenever that region actually overflows **and** contains nothing else focusable, the JS makes it a tab stop (`tabindex="0"`) — the browser then wires up the arrow/paging keys — and exposes it as a named `role="region"`, borrowing the dialog's own label. It is removed again once the box fits, so a short dialog is never a dead tab stop. Overflow is tracked live while the dialog is open (a `ResizeObserver` on the region and its children plus a `MutationObserver` on its child list), so content that loads or reflows after opening flips the tab stop too — not just a viewport resize. This mirrors `adaptiveScrollFade` and satisfies WCAG 2.1.1 / 4.1.2.

The visible surface is styled on an inner `.m-dialog__panel`, while the `<dialog>` itself is kept padding-free — this is what lets the JS treat a click whose target is the `<dialog>` as a backdrop click, without any coordinate math. Keep the panel wrapper if you want backdrop-click to close.

The open/close animation is a pure CSS enhancement (`@starting-style` + `allow-discrete`); browsers without support simply show/hide instantly. `prefers-reduced-motion` is respected.

Opening and closing are timed **separately**, because one shared curve cannot serve both: the shared `--an-ease` is an ease-*out* (fast start, slow settle), which is what an entrance wants, but reused for the exit it puts ~80 % of the fade into the first quarter of the duration, so the close reads as an instant snap. The closing animation therefore has its own accelerating curve over a shorter duration — `--dialog-duration-exit` / `--dialog-easing-exit`, alongside `--dialog-duration` / `--dialog-easing` for the entrance (and `--dialog-exit-offset` / `--dialog-enter-offset` for the distance the panel travels). Mechanically this needs two rules: a transition always runs with the timing declared in the state it animates *to*, so the entrance timing sits on `.m-dialog[open]` and the exit timing on the base `.m-dialog` rule.

The closing animation depends on the `overlay` property to keep the dialog in the top layer while it fades. That is currently Chromium-only — WebKit/Safari and Firefox drop the dialog out of the top layer the moment it closes, so there the close is instant while the open still animates. This is the intended progressive-enhancement fallback, not a bug to work around: driving the exit from JavaScript (delaying `close()` until `transitionend`) would trade a cosmetic gain for a dialog that stays open when a transition never fires.

**Focus restoration needs a target, and a mouse click does not always leave one.** WebKit follows the macOS convention of not focusing a clicked control, so there a dialog opened with the mouse has `<body>` as "the element that had the focus" — and both restorations then have nothing to go back to: the platform's own (modal) and this module's (non-modal). The trigger is therefore focused before the dialog opens, **but only when the click left the focus nowhere**: an engine that focuses its clicked controls (Chromium) is not touched, and a project that moves the focus itself during the same click keeps it. A dialog opened with the keyboard never needed any of it — there the trigger has the focus anyway.

In WebKit the trigger then shows its focus ring after closing, because WebKit reads a programmatic focus as a keyboard focus, even for a dialog opened and closed entirely with the mouse (Chromium shows no ring there). That is the deliberate end of the trade: the focus really is on the trigger afterwards, so an indicator that says so is honest — hiding it would mean suppressing a ring for a focus position the module just placed. `offCanvasNav` carries the same one-liner for the same reason; unlike here it needs no fallback of its own, because it is always modal.

This module's own fallback covers what the platform genuinely never does: a **non-modal** dialog (`show()`) gets no restoration at all, so if the focus was left on a node that is now hidden and fell to `<body>`, the module puts it back on the opener.

Keyboard focus uses the shared `focus-ring()` mixin (`light` tone) on the close button **and** the footer action buttons, so those keep a consistent ring instead of the browser default (see the focus-ring convention in the project `CLAUDE.md`).

The close button's × is an inline SVG copied from `src/_shared/media/img/icons/close.svg` (the canonical source). It is embedded rather than `<img>`-referenced so `stroke="currentColor"` inherits the button colour and its hover state; to reuse the icon elsewhere, point an `<img>` at that file (optionally via the `inlineSVG` component to keep the `currentColor` behaviour).

See `dialog.html` for a ready-to-copy snippet.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on demand by `boot.js` for every `<dialog>` carrying `data-js-module="dialog"` — one controller instance per dialog. (Unlike a global system, nothing runs on pages that have no dialog.)

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is only used for warnings (e.g. a dialog without an `id`, or the module placed on a non-`<dialog>` element). Without it the module degrades silently.

`init()` returns a cleanup function that force-closes the dialog (running the existing close teardown: unlocks scroll, stops media, removes listeners/observers) and removes the delegated trigger listener. The loader only needs this for a host that mounts/unmounts the same markup repeatedly instead of a full page (re)load — see `destroyModulesInScope()` in `boot.js`.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
