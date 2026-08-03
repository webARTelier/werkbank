# dropdownNav

Multi-level dropdown and mega-menu navigation built on the ARIA disclosure pattern — a plain nested list of links without JavaScript.

## Files needed to copy
- `dropdownNav.html` – markup
- `dropdownNav.scss` – styles (source; compiled to `dist/css/dropdownNav.min.css`)
- `dropdownNav.js` – behavior
- `_shared/js/getCssCustomProperty.js`, `_shared/js/rafThrottle.js` – bundled into the module by the build; copy them alongside `dropdownNav.js` when pasting into a plain project.

## Usage
Author the navigation as what it is without JavaScript: a `<nav>` with a nested list of links. Every submenu is simply visible, so the nav reads like a sitemap — usable, and honest: nothing is hidden, and no control exists that would do nothing when clicked. The module upgrades that markup in place.

```html
<nav class="m-dropdownNav" aria-label="Main" data-js-behavior="dropdownNav">
  <ul class="m-dropdownNav__list">
    <li class="m-dropdownNav__item" data-dropdownnav-item>
      <a class="m-dropdownNav__link" href="/products" data-dropdownnav-label>Products</a>
      <div class="m-dropdownNav__panel" data-dropdownnav-panel>…</div>
    </li>
  </ul>
</nav>
```

- **`data-dropdownnav-item`** marks an `<li>` that owns a submenu; items without one are left untouched.
- **`data-dropdownnav-label`** marks that item's label element, and decides the shape of the inserted toggle:
  - **label is a link** (the item has its own landing page) → the link stays a link and a separate chevron button ("split" toggle) is inserted next to it. Its accessible name comes from the item's label, so several toggles on one page stay distinguishable.
  - **label is inert** (a plain grouping label, e.g. a `<span>`) → the button is wrapped *around* that label, so the whole label is the control and its own text is the accessible name.
- **`data-dropdownnav-panel`** marks the submenu. It **must** be the label's next element sibling — the stylesheet keys the collapsed state off `toggle + panel`, which (unlike `:has()`) is supported everywhere. A violation is reported and the item is left unenhanced rather than shipped in a broken state.
- **Nesting is unlimited:** an item inside a panel is marked up exactly the same way.

### Options
All optional. On the nav element:

| Attribute | Effect |
| --------- | ------ |
| `data-dropdownnav-hover` | Additionally open submenus on hover, with a short grace period before closing so a diagonal mouse path across a gap does not shut the panel. Only where there is something to hover over: fine pointers, and only in the flyout layout. The breakpoint is not duplicated in the script — it reads the shared `--bp-navigation` token, so the hover condition and the CSS layout can never drift apart. |
| `data-dropdownnav-stacked` | Keep the stacked layout at **every** viewport width. The bar layout is a function of the room the *nav* has, and the viewport is only a stand-in for that — one that stops working as soon as the nav sits in a narrow box on a wide page. An `offCanvasNav` drawer is the case this exists for: it stays 26rem wide however wide the window is, so a nav inside it must not turn into a horizontal bar. Hover opening and the collision flip are switched off with it; both only exist in the flyout layout. |
| `data-dropdownnav-submenu-label` | Accessible-name template for the split toggles; `{label}` is replaced by the item's label text. Default: `Show submenu for {label}`. |

On an item (style only — the JS is not involved):

| Attribute | Effect |
| --------- | ------ |
| `data-dropdownnav-mega` | The panel spans the full nav width instead of being anchored to the item — the mega-menu variant. Combine with `.m-dropdownNav__columns` and `.m-dropdownNav__panelTitle` inside the panel. |
| `data-dropdownnav-align="end"` | The panel is aligned to the item's inline-end edge, for items close to the edge of the page. **Optional** — the collision flip below finds this case by itself; the attribute is the hint that already applies without JavaScript and before the module has loaded. |

### Layout
Below the navigation breakpoint (`--bp-navigation`, 1250px) the nav stays a stacked list and the submenus collapse like an accordion; from there up it becomes a horizontal bar with floating panels. That switch is pure CSS — the same disclosure markup and the same JS drive both.

**Collision flip.** In the flyout layout a panel that would leave the viewport is marked with `data-dropdownnav-flip="start"` or `="end"`, and the stylesheet anchors it to that edge so it grows the other way: a second-level panel to the item's opposite edge, a third-level one to the opposite side of its parent panel. The script decides only the *direction* — the geometry stays in the stylesheet, so there are still no inline styles anywhere.

Both directions exist because the default anchoring is not the same for every panel. A plain item's panel grows towards the inline-end and can only overflow there; an item carrying `data-dropdownnav-align="end"` already grows towards the start, so the *only* edge it can ever cross is the one an "always flip to the end" rule would never look at. The script therefore measures which edge a panel actually crosses instead of assuming one.

Two details make this cheap and jump-free. Collapsed panels are hidden with `visibility: hidden`, so they are **still laid out**: the direction can be settled for every panel up front, before anything is opened. That also removes a subtler problem — a closed flyout hanging past the viewport edge used to extend the page's scroll width and produce a horizontal scrollbar while the menu was shut (relevant for WCAG 1.4.10 / 1.4.4). And the flipped position is *measured*, not recalculated in JS, so the anchoring cannot drift away from the stylesheet.

Re-evaluated on `resize` (rAF-throttled), once web fonts have loaded, and before each open — the last one catches layout changes that fire no resize event, such as a sticky header collapsing. The nav's resolved writing direction is read at each evaluation too, so a language switch that flips the document to RTL at runtime flips the collision handling with it. Mega panels are skipped: they span the nav, so there is no other side to move them to. If neither side fits (a deeply nested submenu in a narrow window), the default side is kept, where the overflow at least stays reachable by scrolling.

**Vertical overflow.** The flip only ever solves the horizontal case; a long submenu on a short viewport runs off the *bottom*, where an absolutely positioned panel cannot be scrolled to at all. Panels are therefore clamped to `--dropdownNav-panel-viewport-offset` below the viewport height and scroll internally (`overscroll-behavior: contain`, so reaching the end does not start scrolling the page behind them).

This applies to the **leaf** panels only. A panel that itself owns a flyout is marked `data-dropdownnav-parent` by the script and keeps its natural height: a scroll container clips what leaves it, and a child panel leaving its parent is the entire point of the third level. Those intermediate levels are meant to stay short — the long link lists live at the bottom of the tree. CSS cannot know where in the viewport the nav ends up, so `--dropdownNav-panel-viewport-offset` (default `8rem`) is the one number to retune when the nav sits below a tall header.

Colors, spacing, sizing and animation are `--dropdownNav-*` custom properties, declared on the `.m-dropdownNav` root (see `dropdownNav.scss`) — override them there, in your own CSS or inline on the nav element.

**The flash before the module loads.** The nav is a nested list with every submenu open until the script collapses it, so a page load paints the full list and then snaps to the bar. **This component ships no pre-enhancement state to cover that**, unlike `tabs`, `offCanvasNav` and `backToTop`. The reason is the disclosure buttons: the script *injects* them, so before it runs there is no control that could reopen a collapsed submenu, and — unlike the two navigation components built on in-page links — no fragment to fall back on either. Hiding the submenus up front would mean a chunk that never arrives loses most of the navigation. See [`docs/preEnhancement.md`](../../../docs/preEnhancement.md) §2 for the rule that decides this.

A project willing to take that trade can opt in:

```scss
@use "progressiveEnhancement" as *;

.m-dropdownNav {

  @include pre-enhancement("data-dropdownnav-ready") {
    [data-dropdownnav-panel] { display: none; }
  }
}
```

## Accessibility
Follows the ARIA APG **disclosure navigation** pattern, not `role="menubar"`: site navigation is a list of links, so the links stay real links in the natural tab order and each submenu is owned by a `<button aria-expanded aria-controls>`. A menubar would replace `Tab` with arrow keys and promise application-menu behaviour the component does not have.

- **Keyboard:** `Tab` / `Shift+Tab` walk the nav as usual. `Esc` closes the innermost open submenu and returns focus to its toggle. `ArrowDown` on a toggle opens the submenu and moves focus to its first link — skipping anything that is disabled, `tabindex="-1"`, or sitting in a submenu that is still collapsed.
- **Dismissal:** a pointer press outside the nav closes everything, and so does focus leaving the nav. `Esc` is only *consumed* while the focus is inside the nav: a menu the pointer left open still closes, but the key press stays available to whatever the user is actually in (a dialog, a popover, a combobox).
- **Collapsed panels** are hidden with `visibility: hidden`, so their links leave both the tab order and the accessibility tree — the stacked (mobile) layout removes them from the flow entirely.
- **Hover** opening drives the same `aria-expanded` state as clicking, so assistive tech never sees a submenu the keyboard cannot reach. It also never *closes* a branch the focus is inside: a pointer merely passing over the nav must not hide the panel a keyboard user is working in, which would drop the focus to `<body>`. Pointer and focus can therefore hold two branches open at once — the honest outcome, since both are genuinely in use.
- The `<nav>` landmark needs an accessible name (`aria-label` / `aria-labelledby`); a missing one is reported rather than silently shipped.
- The current page is marked in the markup with `aria-current="page"` — the script never guesses it. The stylesheet keys the "current" styling off that ARIA state.
- Links and toggles use the shared `focus-ring()` mixin (`light` tone). The open/close animation is a pure CSS enhancement and respects `prefers-reduced-motion` (duration **and** delay, since the delay is what holds the panel visible during the fade-out).

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded on demand by `boot.js` for every element carrying `data-js-behavior="dropdownNav"` — one instance per nav. It sets no inline styles. The state it writes is `aria-expanded` on the toggles it injected (both the ARIA contract and the stylesheet's hook), `data-dropdownnav-ready` on the nav once the upgrade succeeded, and two purely descriptive attributes the stylesheet keys its geometry off: `data-dropdownnav-flip` and `data-dropdownnav-parent`.

`init` returns a cleanup function (see `destroyModulesInScope()` in `boot.js`) for hosts that mount/unmount the same subtree repeatedly. It removes the three document-level dismissal listeners and the `resize` listener, clears a pending hover timer and takes the injected buttons and the script-set attributes back out, so the markup is handed back exactly as it was authored.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is only used for warnings (nav landmark without an accessible name, item without a label or panel, panel not adjacent to its label, nothing to enhance). Without it the module degrades silently.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`). It shows the click and hover variants, a right-to-left nav (the flyouts and the collision flip mirror themselves), the stacked layout in a narrow iframe — the layout is chosen by a viewport media query, so a narrow box on the page cannot trigger it — and the unenhanced base layer that everyone gets before the module has loaded.
