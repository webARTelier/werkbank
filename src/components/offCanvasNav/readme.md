# offCanvasNav

Burger menu that slides the site navigation in over the page — built on the native `<dialog>`, and a plain block in the page without JavaScript.

## Files needed to copy
- `offCanvasNav.html` – markup
- `offCanvasNav.scss` – styles (source; compiled to `dist/css/offCanvasNav.min.css`)
- `offCanvasNav.js` – behavior
- `_shared/js/getCssCustomProperty.js` – bundled into the module by the build; copy it alongside `offCanvasNav.js` when pasting into a plain project.

Optional but intended: `dropdownNav` for the navigation *inside* the drawer (see [Composition](#composition)).

## Usage
Author the navigation where it belongs in the page — inside the site header — wrapped in a `<dialog>`, plus a link pointing at that dialog:

```html
<a class="m-offCanvasNavToggle" href="#siteNav" data-offcanvasnav-toggle="siteNav">
  <span class="m-offCanvasNavToggle__burger" aria-hidden="true"></span>
  <span class="m-offCanvasNavToggle__label">Menu</span>
</a>

<dialog id="siteNav" class="m-offCanvasNav" data-js-module="offCanvasNav"
        aria-labelledby="siteNav-title">
  <div class="m-offCanvasNav__panel" data-offcanvasnav-panel>
    <header class="m-offCanvasNav__header">
      <h2 class="m-offCanvasNav__title" id="siteNav-title">Menu</h2>
      <button type="button" class="m-offCanvasNav__close" data-offcanvasnav-close
              aria-label="Close menu" autofocus>…×…</button>
    </header>
    <div class="m-offCanvasNav__body">
      <nav aria-label="Main" data-js-module="dropdownNav" data-dropdownnav-stacked>…the site navigation…</nav>
    </div>
  </div>
</dialog>
```

- **The `<dialog>` needs an `id`** — the triggers address the drawer by it, and it is the one requirement: without an id nothing could open the drawer, so the module reports it and leaves the markup completely alone rather than hiding a navigation nobody can reach.
- **`data-offcanvasnav-toggle="<that id>"`** marks the burger. It can live anywhere on the page; clicks are caught by one delegated listener, so a burger rendered into the page later works too. The burger is a **block of its own** (`m-offCanvasNavToggle`), not an element of `m-offCanvasNav`: it sits outside the `<dialog>`, and a page may carry several burgers for the same drawer.
- **`data-offcanvasnav-panel`** marks the visible panel — the dialog's single child, holding everything else. It is what the exit animation moves and what a light dismiss lands *outside* of. Without it the drawer still opens and closes, just without playing its exit; the module reports that.
- **`data-offcanvasnav-close`** on any element inside the drawer closes it (a `<form method="dialog">` submit closes it natively as well).
- **`autofocus`** on the close control decides where the focus lands on open. Without it the browser focuses the first focusable element — which is that same button, so the attribute only makes the choice explicit.
- **`aria-labelledby`** points at the drawer title, so a screen reader announces what the dialog is.

### Options
All optional. On the `<dialog>`:

| Attribute | Effect |
| --------- | ------ |
| `data-offcanvasnav-always` | The drawer is the navigation at **every** viewport width: the burger never hides and the module does not close the drawer at the navigation breakpoint. Without it the drawer is scoped to viewports below `--bp-navigation` (see [Two renderings](#two-renderings)). |
| `data-offcanvasnav-side="end"` | The panel comes in from the inline-**end** edge instead of the inline-start one. Style only — the script never reads it. |

On the burger:

| Class | Effect |
| ----- | ------ |
| `m-offCanvasNavToggle--iconOnly` | Hides the label visually while keeping it as the control's accessible name. |

**One declaration is load-bearing, not cosmetic:** the `<dialog>` and the panel clip with `overflow: clip`, not `overflow: hidden`. With `data-offcanvasnav-side="end"` the closed panel rests beyond the dialog's inline-end edge, which is *reachable* overflow — `hidden` would make the dialog a scroll container holding it, `showModal()` would focus the `autofocus` control inside that panel, and the browser scrolling it into view would cancel the slide-in pixel for pixel. `clip` clips the same way without creating a scroll container. If you restyle the drawer, keep it.

Colors, spacing, sizing and animation are custom properties: `--offCanvasNav-*` on the `.m-offCanvasNav` root and `--offCanvasNavToggle-*` on `.m-offCanvasNavToggle`. Both sets are declared together at the top of `offCanvasNav.scss` — override them there, in your own CSS or inline on the element. The burger has a set of its own because it is a separate block outside the dialog and inherits nothing from it.

## Two renderings
The same markup is rendered two ways, and the boundary between them is the point of the component:

- **In the flow.** The stylesheet renders the `<dialog>` as what it is — an ordinary block holding the navigation. That is what everyone gets **without JavaScript** (and for the moment before the lazily loaded chunk arrives), and it is what the page shows **above the navigation breakpoint** (`--bp-navigation`, 1250px), where there is room for the full navigation and the burger is hidden. The drawer's own header (title and close control) is left out here: a close control with nothing to close would be a dead control.
- **As a drawer.** Below the breakpoint — or at every width with `data-offcanvasnav-always` — the dialog becomes a chrome-free box over the whole viewport with the panel anchored to one edge, and `showModal()` puts it in the top layer.

So one piece of markup serves both layouts: the navigation is never authored, or maintained, twice. Every rule that collapses the navigation is scoped to `data-offcanvasnav-ready`, which the module sets only once the drawer can actually be opened — "collapsed into a drawer" and "there is a control that opens it" always arrive together.

**The flash before the module loads.** The navigation is in the page until then, so a narrow viewport would open every page with the whole menu expanded down the screen and then fold it into the burger. The stylesheet ships a **pre-enhancement state** that covers exactly that gap:

```css
@media (scripting: enabled) and (width < 1250px) {
  .m-offCanvasNav[id]:not([data-offcanvasnav-ready]):not(:target) { display: none; }
}
```

Three qualifiers, all load-bearing:

- **Below the navigation breakpoint only** (and at every width for a drawer with `data-offcanvasnav-always`, which is the second block). Above it, the flow rendering is not a transitional state but the final one — hiding the navigation there would blank the site header on every load.
- **`:not(:target)`** is what makes hiding the navigation survivable. The burger is authored as a link to the drawer's id, so if this component's chunk never arrives, following it still makes the `<dialog>` the fragment's target — and a target is exempt, so the navigation appears as the plain block of the page it is without any script. It can never end up both hidden and unreachable.
- **`[id]`** because a fragment can only target an element that has one. It is also the module's only bail-out (`offCanvasNav.js` gives up on a `<dialog>` with no id, since no trigger can address it either), so the rule applies in exactly the cases where the module can succeed *and* a failure stays recoverable.

See [`docs/preEnhancement.md`](../../../docs/preEnhancement.md) for the strategy this is part of.

## Composition
Submenus are not this component's business. Put a **`dropdownNav`** in the drawer body and it brings its own disclosure buttons; its stacked layout is exactly the one a drawer wants, so the submenus behave like an accordion inside it. Any other `<nav>` works as well — offCanvasNav owns the drawer, its trigger and its dismissal, nothing else. Above the breakpoint both components hand the same markup back to the page: offCanvasNav renders it in the flow, dropdownNav turns it into its horizontal bar with flyouts.

**With `data-offcanvasnav-always`, give that nav `data-dropdownnav-stacked`.** dropdownNav picks its layout by viewport width, and the viewport is only a stand-in for the room the nav actually has — a stand-in that stops working inside a drawer, which stays 26rem wide however wide the window is. Above the navigation breakpoint an unpinned nav in a drawer that is still open turns into a horizontal menu bar several hundred pixels wider than the panel, clipped at its edge. Without `always` the attribute would be wrong: there the navigation is back in the page above the breakpoint, and the bar is the layout it should have. Either way the attribute is dropdownNav's, not this component's — offCanvasNav never styles the navigation inside it.

## What the platform does, and what the module adds
Opened with `showModal()`, the native `<dialog>` renders in the top layer, keeps the focus inside itself, makes the rest of the page inert, paints a `::backdrop`, closes on <kbd>Esc</kbd> and restores the focus to the burger. The slide-**in** and the backdrop fade are pure CSS. None of that is reimplemented. The module adds the seven things the platform does not give:

1. **The burger.** Delegated on `document`, so a control inserted later still opens the drawer; ARIA is seeded per trigger and re-checked on every open/close.
2. **The link-to-button upgrade.** See [Accessibility](#accessibility).
3. **Light dismiss.** A press beside the panel closes the drawer — not native. It needs no coordinate math: the `<dialog>` is a padding-free box over the whole viewport and everything visible is the inner panel, so a click whose target *is* the dialog can only have landed next to it (the same trick as `dialog`).
4. **Body scroll lock.** A modal dialog makes the page behind it inert but does not stop it from scrolling, so a body class does (`is-scrollLocked`, shared with `dialog`). It is released only once no other modal dialog is open, which is read from the DOM (`dialog[open]:modal`) rather than counted per instance — a counter inside this module could only ever see this module's own drawers.
5. **Closing on an in-page link, and at the breakpoint.** A link that stays on this document would leave the drawer covering the very target the reader just jumped to, so the drawer closes and lets the browser do the navigating; links to another document are left alone, since there the page is replaced anyway. So is every press that does not take *this* page anywhere: a modified click (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>/<kbd>Shift</kbd>, which opens a tab or a window), a `target` or `download` attribute, and a click another script has already handled with `preventDefault()` — a project's own control authored as a link inside the drawer, say, which would otherwise shut the drawer every time it is used. In all of those the reader stays where they were, so the drawer does too. And when the viewport grows past the navigation breakpoint the drawer is closed, because from there up the page shows its full navigation regardless — a drawer left open would cover it with the focus trapped inside. CSS cannot take an element out of the top layer, so that one is genuinely the script's job. Both of these are also the two paths that need the focus somewhere other than the burger — see [Accessibility](#accessibility).

6. **The role of the flow rendering.** A `<dialog>` is exposed as `role="dialog"` whether it is open or not, and no stylesheet can change that: rendered in the flow it would put the whole navigation inside a "dialog" that is in fact an ordinary block in the page, and a screen reader announces it as one. So the module corrects the role for exactly that state (see [Accessibility](#accessibility)).

7. **The exit.** The entrance is pure CSS (`@starting-style`); the exit cannot be. A dialog that has been closed leaves the top layer immediately in every engine without the CSS `overlay` property — Chromium is still the only one that has it — so `allow-discrete` on `display`/`overlay` animates the exit there and nowhere else: in Firefox and Safari the drawer simply vanishes. So the drawer is not closed on the way out. Every route out marks it with `data-offcanvasnav-closing` while it is **still open**, which is the state the stylesheet animates, and the native `close()` follows once that has played. <kbd>Esc</kbd> is routed through the same path by catching the dialog's `cancel` event.

Neither the breakpoint nor the exit timing is duplicated in the script. The breakpoint is read from the shared `--bp-navigation` token, so the auto-close and the layout switch in the stylesheet cannot drift apart; the exit length is read back from the panel's own computed `transition-duration` **and `transition-delay`**, so retuning `--offCanvasNav-duration-exit`, staggering the exit with a delay, or a `prefers-reduced-motion` preference flattening it are all followed by themselves.

**The drawer only opens where the drawer rendering applies.** Above the navigation breakpoint the stylesheet renders the `<dialog>` as a plain block, and `showModal()` would lift *that* into the top layer: a chrome-free strip in the corner, no panel, no backdrop, the whole page inert behind it and the focus trapped inside. So the module refuses to open it there and hands the click back to the browser instead — where the burger is still the link it was authored as, pointing at the navigation that is now in the page. The stylesheet's own half of this is keyed on `[data-offcanvasnav-toggle]` rather than on `m-offCanvasNavToggle`: hiding a control that has nothing to open is not decoration, so it has to reach a trigger a project styled entirely by itself too.

## Accessibility
- **Focus** is the platform's: `showModal()` traps it in the drawer, <kbd>Tab</kbd> cannot leave, and closing hands it back to the burger. Which element receives it on open stays the markup's decision (`autofocus`).
- **That restoration needs a target, and a mouse click does not always leave one.** The platform returns the focus to whatever had it when the drawer opened — but WebKit follows the macOS convention of not focusing a clicked control, so there a drawer opened with the mouse has `<body>` as that element and the focus ends up on `<body>` again when it closes. The module therefore puts the focus on the trigger before opening, **but only when the click left it nowhere**: an engine that focuses its clicked controls (Chromium) needs no help and is not touched, and a project that moves the focus itself during the same click keeps it. Keyboard activation never needed any of this — there the trigger has the focus by definition. The alternative, rebuilding the restoration in the close path, would have to sort itself out against the two overrides below and check whether the burger is focusable at all (above the breakpoint it is `display: none`). `dialog` carries the same one-liner; it additionally keeps a close-path fallback, which this component does not need because it is always modal.
- **In WebKit the burger then shows its focus ring after closing,** because WebKit reads a programmatic focus as a keyboard focus — even when the drawer was opened and closed entirely with the mouse (Chromium shows no ring there). That is the deliberate end of the trade: the focus really is on the burger afterwards, so an indicator that says so is honest, and the only way to hide it would be to suppress a ring for a focus position the module just placed. After <kbd>Esc</kbd> both engines show it, since that press is keyboard input.
- **Two paths out need the focus elsewhere,** and the platform always returns it to the opener, so the module overrides it — from the `close` event, i.e. *after* the platform's own restoration, which anything earlier would only get overwritten by. Crossing the **navigation breakpoint** hides the burger (`display: none`), so the restoration would leave the focus on `<body>`: it goes to the panel instead, which is where the navigation now sits in the page. Following an **in-page link** leaves the reader at the jump target, and the burger is not it, so the focus goes to the target — otherwise the next <kbd>Tab</kbd> would continue from the site header rather than from where the reader just landed. A container that is not focusable gets a `tabindex="-1"` for the moment, taken back off once the focus leaves.
- **The `<dialog>` is not a dialog in the flow rendering,** and the module says so: while the navigation is an ordinary block in the page — above the navigation breakpoint — the dialog carries `role="generic"`, which is removed again as soon as the drawer rendering applies. `role="none"` would be the obvious choice and does not work here on two counts: a presentational role is dropped again as soon as the element carries any global ARIA attribute (the drawer's own `aria-labelledby` is one), and on a `<dialog>` engines refuse it even without one — in Chromium both `role="none"` and `role="presentation"` still resolve to `role="dialog"`. `generic` is a real role, so it wins, and an engine that does not know it falls back to the implicit role, i.e. to the behaviour there was before. **Without JavaScript the wrapper stays a `dialog`:** the role is not in the authored markup, because `role="generic"` on a `<dialog>` is not a role ARIA-in-HTML allows there and would make the copy-paste snippet fail validation. The navigation is fully usable in that state, only its wrapper is misnamed.

  **This costs an axe finding, and it is expected.** axe-core (verified with 4.12) does not accept `generic` as an author-set role at all — not on a `<dialog>`, not on a `<div>` either — and reports `aria-roles`, impact *critical*: "Role must be one of the valid ARIA roles: generic". So a project with an axe, Lighthouse or pa11y gate gets that finding on every page carrying this component **above** the navigation breakpoint, where the role is applied (below it the module removes the role again and the scan is clean). It is a false positive as far as this component is concerned — the role is exactly what makes the flow rendering announce correctly, and both Chromium and WebKit honour it — so the right answer is to exclude this element from that rule, e.g. `axe.run(context, { rules: { 'aria-roles': { enabled: false } } })` for a targeted run, or an exclusion for `dialog.m-offCanvasNav` in the project's axe configuration. What you cannot do is swap the role for a spec-clean one: `none`/`presentation` on a `<dialog>` still resolves to `dialog` in Chromium (verified, with and without a global ARIA attribute), and `group` announces a group that isn't there.
- **The burger is a link that becomes a button.** An `<a href="#<dialogId>">` is a control with a job before the module exists: it navigates to the navigation, which is then a plain block in the page — so there is no dead control and nothing hidden. Once the drawer exists that job is taken over, and a control that opens a dialog *is* a button: the module prevents the jump, sets `role="button"` and adds <kbd>Space</kbd>, which a link does not have (<kbd>Enter</kbd> works on both). A `<button>` also works as a trigger, at the price of the fallback.
- **`aria-expanded` is deliberately not set** on the trigger. The ARIA APG modal-dialog pattern uses `aria-haspopup="dialog"` (plus `aria-controls`) alone, because a modal dialog takes over the page rather than expanding a region that belongs to the trigger — the same choice `dialog` makes. `data-offcanvasnav-open`, which the module does set while the drawer is open, is purely presentational: it exists so the stylesheet can morph the burger into a cross.
- **The `<dialog>` needs an accessible name** (`aria-label` / `aria-labelledby`); a missing one is reported rather than silently shipped. So is a drawer without any trigger — a navigation nobody can reach on a narrow viewport.
- **A closed drawer is `display: none`,** so its links are out of the flow, out of the tab order and out of the accessibility tree.
- The burger and the close control use the shared `focus-ring()` mixin (`light` tone). The three burger bars are decorative (`aria-hidden`); the control is named by its label.
- **The drawer body leaves room for the focus ring of the navigation inside it.** `overflow-y: auto` makes it a scroll container, and a scroll container clips on *both* axes at its padding box — so the ring of a link filling its full inline size would be cut away on the left and the right, and on the first item at the top as well. The box is inset by exactly the ring's outset (`--offCanvasNav-ringSpace`, derived from `--outlineOffset`) and that inset is handed straight back as a negative margin, so the content does not move by a pixel. `scroll-padding` covers the same for a ring scrolled to the container's edge.
- **In a forced-colors context** (the Windows contrast themes) the panel gets a `CanvasText` border, because shadows are dropped there and the panel would otherwise be the same colour as the page behind it, and the three burger bars are repainted in `CanvasText` — they are background fills, which forced colors replaces with `Canvas`, so the glyph disappeared into the button. In the icon-only variant, whose label is only visually hidden, that left a control with nothing visible in it at all.
- The drawer body is **not** made a keyboard-scrollable region the way `dialog`'s is: it holds links, so a keyboard user reaches its content anyway and an extra tab stop on the container would be redundant noise.
- Both the slide-in and the slide-out respect `prefers-reduced-motion`; flattening the transition in CSS is enough, because the script reads the exit length back from it. The entrance is a pure CSS enhancement (`@starting-style` provides the frame the panel comes in from); the exit needs the script for one thing only — keeping the dialog open while it plays.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on demand by `boot.js` for every `<dialog>` carrying `data-js-module="offCanvasNav"` — one instance per drawer — and reports (without enhancing) if it is put on anything else. It sets no inline styles. What it writes is `data-offcanvasnav-ready` on the dialog, `data-offcanvasnav-closing` on it while the exit plays, `role="generic"` on it while the flow rendering applies (left alone if the dialog was authored with a role of its own), a temporary `tabindex="-1"` on an element it has to move the focus to, and on each trigger `aria-haspopup`, `aria-controls`, `role="button"` (links only), `data-offcanvasnav-ready`, the mirrored `data-offcanvasnav-always` and, while the drawer is open, `data-offcanvasnav-open`. The open state itself is the native `[open]` attribute.

Every path out of the drawer funnels through the native `close` event — the close control, a press beside the panel, <kbd>Esc</kbd>, an in-page link, the breakpoint, a programmatic `close()` — so there is exactly one place that unlocks the page and resets the triggers, and no path can bypass it. Everything except a direct `close()` from outside takes the animated route to it (see point 7 above).

`init` returns a cleanup function (see `destroyModulesInScope()` in `boot.js`) for hosts that mount/unmount the same subtree repeatedly. It closes the drawer, removes the document and media-query listeners and takes every attribute above back off, so the markup is handed back exactly as it was authored. It is the one caller that runs the close funnel by hand: `close()` does not dispatch its `close` event then and there but queues a task, which a teardown removing the listener in the same breath would never see — and a drawer torn down while it was open would leave the page scroll-locked with nothing left on it to unlock.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is only used for warnings (initialized on a non-`<dialog>`, dialog without an id, dialog without an accessible name, no panel, no trigger found). Without it the module degrades silently.

**Page-wide id uniqueness.** The triggers are resolved by an id-based selector evaluated against the whole document, so on a page built from repeatable CMS content elements give every instance's ids a unique suffix — see the note in the project readme.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`). It shows the drawer with a `dropdownNav` inside it (kept a drawer at every width so it is operable on a wide screen), the breakpoint-scoped default that hands its navigation back to the page above 1250px, the same variant coming in from the other edge in a frame with a narrow viewport of its own, and the unenhanced base layer that everyone gets before the module has loaded.
