/**
 * dropdownNav.js
 * ----------------------------------------------------------------------------
 * Progressive-enhancement script that upgrades a plain nested navigation
 * list into a multi-level dropdown / mega-menu navigation following the ARIA
 * APG "Disclosure Navigation" pattern.
 *
 * What works without this script
 * ------------------------------
 * The markup is a <nav> holding an ordinary nested list of links. Without
 * JavaScript every link is reachable and every submenu is simply visible —
 * a sitemap-like navigation that is fully usable and completely honest: no
 * ARIA promises behaviour that is not there, and no control exists that
 * would do nothing when clicked. The stylesheet keeps that flat rendering
 * until this script sets data-js-enhanced on the nav, so the dropdown
 * layout and the collapsed panels only ever appear together with the code
 * that can open them again.
 *
 * Why disclosure and not a menubar
 * --------------------------------
 * role="menubar"/"menuitem" describes an application menu (like a desktop
 * app's File/Edit bar) where the arrow keys replace Tab. Site navigation is
 * a list of links, so the APG recommends the disclosure pattern instead:
 * plain links in the natural tab order, each submenu owned by a
 * <button aria-expanded aria-controls>. That is what this script builds.
 *
 * What the script adds
 * --------------------
 * 1. A disclosure button per item that owns a submenu, in one of two
 *    shapes. When the item's label is a link (it has its own landing
 *    page), the link stays a link and a separate "split" toggle is
 *    inserted next to it — its accessible name is built from the item's
 *    label so several toggles on one page stay distinguishable. When the
 *    label is inert (a pure grouping label), the button is wrapped around
 *    that label instead, so the whole label is the control and its own
 *    text is the accessible name.
 * 2. Disclosure state: aria-expanded on the toggle is the single source of
 *    truth and doubles as the styling hook — the stylesheet keys the
 *    closed panel off it via the adjacent-sibling combinator, so no state
 *    class and no inline style is written. Opening an item closes its
 *    siblings on the same level; closing an item closes its descendants.
 * 3. Dismissal: Esc closes the innermost open submenu and returns focus to
 *    its toggle, a pointerdown outside the nav closes everything, and so
 *    does focus leaving the nav (tabbing past the last link). Esc only
 *    swallows the key press while the focus is actually inside the nav —
 *    a menu the pointer left open must not take Esc away from a dialog
 *    elsewhere on the page.
 * 4. Keyboard: the tab order stays native (that is the point of the
 *    disclosure pattern). On top of it, ArrowDown on a toggle opens the
 *    submenu and moves focus to its first link.
 * 5. Optional hover opening (data-dropdownnav-hover) wherever the flyout
 *    layout is actually active, with a short grace period before closing
 *    so a diagonal mouse path across the gap does not shut the panel.
 *    Hover only ever drives the same aria-expanded state, so assistive
 *    tech never sees a submenu the keyboard cannot reach — and it never
 *    closes a branch the focus is inside, so a passing pointer cannot
 *    pull a panel out from under a keyboard user.
 * 6. Collision handling: a panel that would leave the viewport is marked
 *    with data-dropdownnav-flip="start|end" — the value names the edge the
 *    panel is anchored to, so it grows the other way. Both directions
 *    exist because the default anchoring is not the same everywhere: an
 *    item carrying data-dropdownnav-align="end" already grows towards the
 *    start and can only overflow at that edge. Only the direction is
 *    decided here — the geometry stays in the stylesheet, so there are
 *    still no inline styles. Because collapsed panels are hidden with
 *    visibility: hidden they are still laid out, so the decision can be
 *    made up front, for every panel, before anything is opened: no jump
 *    while opening, and a closed flyout positioned past the viewport edge
 *    can no longer add a horizontal scrollbar to the page.
 * 7. A panel that itself owns a flyout is marked with
 *    data-dropdownnav-parent. That is what lets the stylesheet give the
 *    remaining (leaf) panels a maximum height and their own scrollbar:
 *    a scroll container would clip the child panel that has to escape it,
 *    so the levels that own children keep their natural height.
 *
 * Accessibility
 * -------------
 * Follows the APG disclosure navigation pattern: real links in the natural
 * tab order, one aria-expanded/aria-controls button per submenu, Esc to
 * close with focus returned to the toggle. Collapsed panels are hidden by
 * the stylesheet with visibility: hidden, which takes their links out of
 * the tab order and the accessibility tree. The <nav> landmark needs an
 * accessible name (aria-label / aria-labelledby); a missing one is
 * reported rather than silently shipped. Marking the current page with
 * aria-current="page" stays the markup's job — the script never guesses it.
 *
 * Configuration
 * -------------
 * On the nav element (data-js-module="dropdownNav"), all optional:
 * - data-dropdownnav-hover           open submenus on hover as well
 *                                    (fine pointers, flyout layout only)
 * - data-dropdownnav-submenu-label   accessible-name template for the
 *                                    split toggle; "{label}" is replaced
 *                                    by the item's label text.
 *                                    Default: "Show submenu for {label}"
 *
 * On the items (markup contract):
 * - data-dropdownnav-item            an item that owns a submenu
 * - data-dropdownnav-label           that item's label element
 * - data-dropdownnav-panel           the collapsible region; must be the
 *                                    label's next element sibling
 * - data-dropdownnav-mega            style-only: panel spans the nav width
 * - data-dropdownnav-align="end"     style-only: panel aligned to the
 *                                    item's inline-end edge. Optional —
 *                                    the flip above finds this case by
 *                                    itself; the attribute is the hint
 *                                    that already works without JS.
 * ----------------------------------------------------------------------------
 */



import { getCssCustomProperty } from './getCssCustomProperty.js';
import { rafThrottle } from './rafThrottle.js';



const defaults = {

  // An item that owns a submenu (usually an <li>). Every other element in
  // the nav is left completely untouched.
  itemSelector: '[data-dropdownnav-item]',

  // The item's own label: the link to its landing page, or an inert
  // element when the item is only a grouping label.
  labelSelector: '[data-dropdownnav-label]',

  // The collapsible region. It must be the label's next element sibling:
  // the stylesheet keys the closed state off the adjacent-sibling
  // combinator (toggle + panel), which — unlike :has() — is supported
  // everywhere, so a browser can never end up showing every submenu at
  // once next to toggles that claim to be collapsed.
  panelSelector: '[data-dropdownnav-panel]',

  // Marker and styling hook on the button this script injects. Its value
  // names the shape: 'label' (the button wraps an inert label) or 'split'
  // (the button sits next to a link that stays a link).
  toggleAttr: 'data-dropdownnav-toggle',

  // Marks the visually hidden text inside a split toggle. A real text node
  // rather than aria-label, so the control is still readable if the
  // stylesheet fails to load.
  toggleTextAttr: 'data-dropdownnav-toggle-text',

  // Set on a panel that would leave the viewport. Its value ('start' or
  // 'end') names the edge the stylesheet anchors the panel to, so it
  // grows away from the edge it was overflowing.
  flipAttr: 'data-dropdownnav-flip',

  // Set on a panel that itself contains another panel. The stylesheet
  // gives only the panels *without* this attribute a maximum height and
  // a scrollbar — see the note in enhanceItem/markParentPanels.
  parentPanelAttr: 'data-dropdownnav-parent',

  // Marks an item whose panel spans the nav. Read here only to skip it
  // when flipping: a panel that is as wide as the nav has no other side
  // to be moved to.
  megaAttr: 'data-dropdownnav-mega',

  // Presence on the nav opts into hover opening (fine pointers only).
  hoverAttr: 'data-dropdownnav-hover',

  // Overrides the accessible-name template of the split toggles.
  submenuLabelAttr: 'data-dropdownnav-submenu-label',

  // Set on the nav once the markup has been upgraded. The stylesheet only
  // switches to the dropdown layout when it is present, so the plain
  // nested list stays visible for everyone without this script.
  enhancedAttr: 'data-js-enhanced',

  // Default accessible name of a split toggle; '{label}' is replaced by
  // the item's label text.
  submenuLabelTemplate: 'Show submenu for {label}',

  // Prefix for generated panel ids (aria-controls needs one).
  panelIdPrefix: 'dropdownnav-panel',

  // Shared token holding the navigation breakpoint, so hover opening, the
  // collision flip and the flyout layout itself cannot drift apart (see
  // navExpandedMediaQuery).
  navBreakpointProp: '--bp-navigation',

  // Grace period (ms) before a hover-opened submenu closes again.
  hoverCloseDelay: 200,

  // Distance (px) a flyout keeps from the viewport edge before it counts
  // as overflowing and is turned around. Room for the focus ring, and it
  // keeps a panel that ends exactly at the edge from flipping back and
  // forth on a resize. It applies to that decision only — whether the
  // flip actually helped is judged against the bare viewport edge.
  viewportMargin: 8,
};



// A label that is already interactive cannot be wrapped in a button
// (nested interactive content), so it gets a separate split toggle.
const interactiveLabelSelector = 'a[href], button, [role="button"]';

// "The first thing a keyboard user should land on" when a submenu is
// opened with ArrowDown. Disabled controls and tabindex="-1" are excluded
// because focusing them would silently do nothing (or, worse, park the
// focus somewhere Tab cannot leave in the expected direction), which would
// look like the key press was ignored.
const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

// The flyout layout — the one with floating panels that can overflow the
// viewport, and the only one where hover opening makes sense. The
// breakpoint stays single-sourced in the SCSS (--bp-navigation, see
// _shared/scss/_breakpoint_tokens.scss) and is read back from there.
// A project that does not ship the token gets a query that always
// matches: the flip rules are scoped to the flyout layout in the
// stylesheet anyway, and in the stacked layout a panel sits in the flow
// where it cannot overflow to begin with.
const lengthPattern = /^[\d.]+(px|em|rem)$/;

function navExpandedMediaQuery(prop) {
  const breakpoint = getCssCustomProperty(document.documentElement, prop);
  if (!lengthPattern.test(breakpoint)) return '(min-width: 0px)';
  return `(min-width: ${breakpoint})`;
}

// Hover opening only makes sense where there is something to hover over:
// a coarse pointer has no hover at all (a tap would open a menu the user
// cannot leave again), and in the stacked layout submenus springing open
// under a passing pointer would be noise rather than a shortcut.
function hoverMediaQuery(prop) {
  const pointer = '(hover: hover) and (pointer: fine)';
  return `${pointer} and ${navExpandedMediaQuery(prop)}`;
}



// Panel ids are generated only when the author did not provide one. The
// counter is module-wide (several navs can coexist on a page) and the
// result is checked against the document, so a hand-written id of the
// same shape elsewhere cannot be shadowed.
let panelIdCounter = 0;

function uniquePanelId(prefix) {
  let id = `${prefix}-${++panelIdCounter}`;
  while (document.getElementById(id)) {
    id = `${prefix}-${++panelIdCounter}`;
  }
  return id;
}



class DropdownNav {

  constructor(root, params, reporter) {
    this.root = root;
    this.params = params;
    this.reporter = reporter;
    this.records = [];

    this.useHover = root.hasAttribute(params.hoverAttr);
    this.hoverQuery =
      window.matchMedia(hoverMediaQuery(params.navBreakpointProp));
    this.expandedQuery =
      window.matchMedia(navExpandedMediaQuery(params.navBreakpointProp));
    this.submenuLabel =
      root.getAttribute(params.submenuLabelAttr) || params.submenuLabelTemplate;

    this.onViewportChange = rafThrottle(this.evaluateFlips);

    this.reportMissingName();
    this.collectItems();
    this.markParentPanels();

    if (!this.records.length) {
      this.reporter?.report(
        'dropdownNav',
        'no usable [data-dropdownnav-item] elements found — nothing to ' +
        'enhance.', { el: root }
      );
      return;
    }

    this.startListening();

    // Set before the first measurement, and only for a nav that actually
    // has working toggles: the stylesheet keys the whole flyout layout off
    // this attribute, so the panels have no flyout geometry to measure
    // until it is there. Had the enhancement bailed above, the markup
    // stays the plain nested list it is without this script.
    this.root.setAttribute(params.enhancedAttr, '');

    this.evaluateFlips();
  }



  // A navigation landmark without a name is indistinguishable from the
  // other <nav>s of the page in a screen reader's landmark list.
  reportMissingName = () => {
    const isLandmark =
      this.root.tagName === 'NAV' ||
      this.root.getAttribute('role') === 'navigation';
    if (!isLandmark) return;

    const hasName =
      this.root.hasAttribute('aria-label') ||
      this.root.hasAttribute('aria-labelledby');
    if (hasName) return;

    this.reporter?.report(
      'dropdownNav',
      'navigation landmark has no accessible name — add aria-label or ' +
      'aria-labelledby to the nav element.', { el: this.root }
    );
  };



  // querySelectorAll returns document order, so an item is always visited
  // after its ancestors — which is what parentItemOf() below relies on.
  collectItems = () => {
    this.root.querySelectorAll(this.params.itemSelector)
      .forEach((item) => this.enhanceItem(item));
  };



  // Marks every panel that owns another panel, so the stylesheet can give
  // a maximum height and a scrollbar to the leaf panels only. A scroll
  // container clips what overflows it, and a nested flyout has to escape
  // its parent by design — so the two cannot be combined, and the level
  // that owns children is the one that has to keep its natural height.
  //
  // Decided here rather than with :has() in the stylesheet: the nesting is
  // a fixed fact of the markup, read once, and this keeps the rule working
  // in engines without :has() — the same reason the collapsed state uses
  // the adjacent-sibling combinator.
  markParentPanels = () => {
    this.records.forEach((record) => {
      const parentPanel = record.item.closest(this.params.panelSelector);
      if (!parentPanel || !this.root.contains(parentPanel)) return;
      parentPanel.setAttribute(this.params.parentPanelAttr, '');
    });
  };



  // Upgrades one item: validates the markup contract, then inserts the
  // disclosure button in whichever of the two shapes fits the label.
  enhanceItem = (item) => {
    const label = item.querySelector(`:scope > ${this.params.labelSelector}`);
    if (!label) {
      this.reporter?.report(
        'dropdownNav',
        'item has no direct [data-dropdownnav-label] child — item is left ' +
        'unenhanced.', { el: item }
      );
      return;
    }

    const panel = item.querySelector(`:scope > ${this.params.panelSelector}`);
    if (!panel) {
      this.reporter?.report(
        'dropdownNav',
        'item has no direct [data-dropdownnav-panel] child — item is left ' +
        'unenhanced.', { el: item }
      );
      return;
    }

    // The stylesheet hides the closed panel via "toggle + panel", so an
    // out-of-order panel would stay permanently open next to a toggle
    // claiming it is collapsed. Leaving the item unenhanced is the safe
    // outcome: a visible submenu with no misleading ARIA.
    if (label.nextElementSibling !== panel) {
      this.reporter?.report(
        'dropdownNav',
        'the [data-dropdownnav-panel] must be the next element sibling of ' +
        'the [data-dropdownnav-label] — item is left unenhanced.', { el: item }
      );
      return;
    }

    const generatedId = !panel.id;
    if (generatedId) panel.id = uniquePanelId(this.params.panelIdPrefix);

    const isSplit = label.matches(interactiveLabelSelector);
    const toggle = this.createToggle(panel.id, isSplit);

    if (isSplit) {
      // The link keeps its own job (go to the landing page); the toggle is
      // an extra control right after it, so it ends up between label and
      // panel — exactly where the stylesheet expects it.
      toggle.append(this.createToggleText(label));
      label.after(toggle);
    }

    if (!isSplit) {
      // An inert label becomes the button's content instead of being
      // replaced by it: the author's element (with its classes, ids and
      // any other markup) survives, and its text is the button's
      // accessible name.
      label.replaceWith(toggle);
      toggle.append(label);
    }

    this.records.push({
      item,
      label,
      panel,
      toggle,
      isSplit,
      generatedId,
      parentItem: this.parentItemOf(item),
      hoverTimer: 0,
    });
  };



  createToggle = (panelId, isSplit) => {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.setAttribute(this.params.toggleAttr, isSplit ? 'split' : 'label');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', panelId);
    return toggle;
  };



  // The split toggle carries no visible text of its own (the chevron is a
  // CSS pseudo-element), so it needs a name that says which submenu it
  // opens — "Show submenu" alone would repeat identically all over the bar.
  createToggleText = (label) => {
    const text = document.createElement('span');
    text.setAttribute(this.params.toggleTextAttr, '');
    text.textContent =
      this.submenuLabel.replace('{label}', label.textContent.trim());
    return text;
  };



  // The item one level up, used to group siblings. Guarded against
  // escaping this nav when one dropdownNav is nested inside another.
  parentItemOf = (item) => {
    const parent = item.parentElement?.closest(this.params.itemSelector);
    if (!parent || !this.root.contains(parent)) return null;
    return parent;
  };



  startListening = () => {
    this.root.addEventListener('click', this.handleClick);

    // Dismissal listens on the document on purpose: the interaction that
    // should close a menu (a click elsewhere, focus moving away, Esc) by
    // definition happens outside the nav.
    document.addEventListener('keydown', this.handleKeydown);
    document.addEventListener('pointerdown', this.handlePointerDown);
    document.addEventListener('focusin', this.handleFocusIn);

    // Everything the flip depends on — viewport width, zoom level, the
    // width of the labels in the bar — changes with a resize. A web font
    // arriving later moves the items too, hence the second hook; both are
    // no-ops once destroy() has emptied the records.
    window.addEventListener('resize', this.onViewportChange);
    document.fonts?.ready.then(this.onViewportChange);

    if (!this.useHover) return;

    // pointerenter/-leave do not bubble, so they are bound per item. The
    // handlers re-check the media query at event time instead of watching
    // it, so a resize across the breakpoint or a device that gains a mouse
    // needs no extra wiring — and nothing to tear down either.
    this.records.forEach((record) => {
      record.item.addEventListener('pointerenter', this.handlePointerEnter);
      record.item.addEventListener('pointerleave', this.handlePointerLeave);
    });
  };



  handleClick = (event) => {
    const toggle = event.target.closest(`[${this.params.toggleAttr}]`);
    if (!toggle) return;

    const record = this.records.find((entry) => entry.toggle === toggle);
    if (!record) return;

    this.setExpanded(record, !this.isOpen(record));
  };



  handleKeydown = (event) => {
    if (event.key === 'Escape') {
      this.handleEscape(event);
      return;
    }

    if (event.key !== 'ArrowDown') return;

    const toggle = event.target.closest?.(`[${this.params.toggleAttr}]`);
    const record = this.records.find((entry) => entry.toggle === toggle);
    if (!record) return;

    // Opens the submenu and steps into it — the APG's optional shortcut
    // for the disclosure pattern. Tab still walks the same links.
    event.preventDefault();
    this.setExpanded(record, true);
    this.firstFocusableIn(record.panel)?.focus();
  };



  // The first focusable element of this panel, ignoring the ones that sit
  // in a submenu of its own: those are still collapsed (and therefore
  // unfocusable) at this point, so focusing one would silently fail.
  firstFocusableIn = (panel) => {
    const candidates = panel.querySelectorAll(focusableSelector);
    return [...candidates].find(
      (candidate) =>
        candidate.closest(this.params.panelSelector) === panel
    ) || null;
  };



  // Closes the innermost open submenu around the focus and hands focus
  // back to its toggle (APG). With the focus elsewhere — a menu opened by
  // hover, say — everything closes and focus is left alone.
  handleEscape = (event) => {
    const open = this.records.filter((record) => this.isOpen(record));
    if (!open.length) return;

    const active = document.activeElement;
    const branch = open.filter((record) => record.item.contains(active));

    // Only the nav's own Esc is consumed. A menu the pointer left open
    // while the focus sits somewhere else entirely still closes, but the
    // key press stays available to whatever the user is actually in — a
    // dialog, a popover, a combobox.
    if (!branch.length) {
      this.closeAll();
      return;
    }

    event.preventDefault();

    // Records are in document order, so the deepest match is the last one.
    const innermost = branch[branch.length - 1];
    this.setExpanded(innermost, false);
    innermost.toggle.focus();
  };



  handlePointerDown = (event) => {
    if (this.root.contains(event.target)) return;
    this.closeAll();
  };



  handleFocusIn = (event) => {
    if (this.root.contains(event.target)) return;
    this.closeAll();
  };



  handlePointerEnter = (event) => {
    if (!this.hoverQuery.matches) return;

    const record = this.recordForItem(event.currentTarget);
    if (!record) return;

    this.clearHoverTimer(record);
    this.setExpanded(record, true, { fromPointer: true });
  };



  // Not closed immediately: the pointer often leaves the item for a few
  // pixels of gap on its way into the panel, and a hard close would make
  // the menu impossible to reach with a diagonal mouse path.
  handlePointerLeave = (event) => {
    if (!this.hoverQuery.matches) return;

    const record = this.recordForItem(event.currentTarget);
    if (!record) return;

    this.clearHoverTimer(record);

    // A branch the keyboard is inside belongs to the focus, not to the
    // pointer. Closing it would hide the focused link (the panel becomes
    // visibility: hidden) and drop the focus to <body> — so a mouse
    // merely passing over the nav must not do it.
    if (this.holdsFocus(record)) return;

    record.hoverTimer = window.setTimeout(
      () => {
        if (this.holdsFocus(record)) return;
        this.setExpanded(record, false);
      },
      this.params.hoverCloseDelay
    );
  };



  recordForItem = (item) =>
    this.records.find((record) => record.item === item);



  holdsFocus = (record) => record.item.contains(document.activeElement);



  // Decides for every panel which side it opens to. Collapsed panels are
  // hidden with visibility: hidden, so they are still laid out and their
  // geometry is known before anything is opened — which is why this runs
  // over all of them up front instead of on open: there is no jump while
  // opening, and a closed flyout hanging past the viewport edge cannot add
  // a horizontal scrollbar to the page either.
  //
  // Records are in document order, so a parent panel is always settled
  // before the child that is positioned against it gets measured.
  evaluateFlips = () => {
    const { flipAttr, megaAttr, viewportMargin } = this.params;

    // In the stacked layout the panels sit in the flow and the flip rules
    // do not apply — so any attribute left from a wider viewport goes.
    if (!this.expandedQuery.matches) {
      this.records.forEach(({ panel }) => panel.removeAttribute(flipAttr));
      return;
    }

    // Which physical edge is the inline-end one. Read per pass rather than
    // once in the constructor, so a language switch that flips the
    // document's direction at runtime flips the collision handling with it.
    const isRtl = window.getComputedStyle(this.root).direction === 'rtl';

    this.records.forEach(({ item, panel }) => {
      // A mega panel spans the nav, so there is no other side to move it
      // to — flipping it would only break its layout.
      if (item.hasAttribute(megaAttr)) return;

      panel.removeAttribute(flipAttr);

      // Which edge the panel overflows is measured instead of derived from
      // its default anchoring, because that anchoring is not the same for
      // every panel: an item carrying data-dropdownnav-align="end" already
      // grows towards the start, so the only edge it can ever cross is the
      // one the "always flip to the end" assumption never looked at.
      const side = this.overflowingSide(panel, isRtl, viewportMargin);
      if (!side) return;

      // Anchoring the panel at the edge it just overflowed turns it
      // around: it now grows away from that edge. The flipped position is
      // measured rather than calculated — the anchoring lives in the
      // stylesheet, and recomputing it here would be a second source of
      // truth that can drift away from it. The cost is one extra layout
      // pass for the panels that do overflow.
      panel.setAttribute(flipAttr, side);

      // Neither side fits (a deep submenu in a narrow window). Keeping the
      // default side makes the loss predictable and leaves the panel
      // reachable by scrolling, which a panel hanging past the start edge
      // would not be.
      //
      // Checked without the comfort margin, unlike the decision above: the
      // margin says when a panel *should* move, but one that now sits
      // flush against the other edge did get rescued — sending it back
      // over a few pixels of breathing room would undo a working flip.
      if (this.overflowingSide(panel, isRtl, 0)) {
        panel.removeAttribute(flipAttr);
      }
    });
  };



  // Which viewport edge the panel currently crosses, as a logical edge
  // ('start' / 'end') so the caller never has to think in physical sides.
  // The end edge is checked first: it is the one the default anchoring
  // grows towards, so it is the common case. clientWidth, not innerWidth:
  // a classic scrollbar is not space a panel may use.
  overflowingSide = (panel, isRtl, margin) => {
    const rect = panel.getBoundingClientRect();
    const limit = document.documentElement.clientWidth - margin;

    const overStart = isRtl ? rect.right > limit : rect.left < margin;
    const overEnd = isRtl ? rect.left < margin : rect.right > limit;

    if (overEnd) return 'end';
    if (overStart) return 'start';
    return null;
  };



  isOpen = (record) => record.toggle.getAttribute('aria-expanded') === 'true';



  // The one place that writes state. aria-expanded is both the ARIA
  // contract and the styling hook, so there is no second source of truth
  // and no inline style anywhere.
  setExpanded = (record, shouldOpen, options = {}) => {
    if (!shouldOpen) {
      this.closeBranch(record);
      return;
    }

    this.closeSiblings(record, options.fromPointer === true);

    // Re-checked here, not only on resize: anything that moves the nav
    // horizontally (a sticky header collapsing, a sidebar opening, injected
    // markup) changes the geometry without a resize event. Still done
    // before the panel becomes visible, so a correction can never be seen
    // as a jump.
    this.evaluateFlips();

    record.toggle.setAttribute('aria-expanded', 'true');
  };



  // Closing an item closes everything inside it too — otherwise a nested
  // submenu would still claim to be expanded the next time its parent
  // opens.
  closeBranch = (record) => {
    this.clearHoverTimer(record);
    record.toggle.setAttribute('aria-expanded', 'false');

    this.records.forEach((other) => {
      if (other === record || !record.item.contains(other.item)) return;
      this.clearHoverTimer(other);
      other.toggle.setAttribute('aria-expanded', 'false');
    });
  };



  // Opening an item closes the other items on its level — except, when the
  // pointer is what opened it, a sibling the focus is inside: a mouse
  // wandering across the bar must not close the menu a keyboard user is
  // working in. The two stay open together until the focus moves on, which
  // is the honest outcome — both are genuinely in use.
  closeSiblings = (record, keepFocusedSibling = false) => {
    this.records.forEach((other) => {
      if (other === record || other.parentItem !== record.parentItem) return;
      if (keepFocusedSibling && this.holdsFocus(other)) return;
      this.closeBranch(other);
    });
  };



  closeAll = () => {
    this.records.forEach((record) => {
      this.clearHoverTimer(record);
      record.toggle.setAttribute('aria-expanded', 'false');
    });
  };



  clearHoverTimer = (record) => {
    if (!record.hoverTimer) return;
    window.clearTimeout(record.hoverTimer);
    record.hoverTimer = 0;
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly
  // instead of doing a full page (re)load — see destroyModulesInScope() in
  // boot.js. Two kinds of state outlive the nav's own subtree here: the
  // document and window listeners and any pending hover timer. The injected
  // buttons are removed as well, so the markup is handed back exactly as
  // it was authored and a later re-init cannot stack a second toggle onto
  // every item.
  destroy = () => {
    this.root.removeEventListener('click', this.handleClick);
    document.removeEventListener('keydown', this.handleKeydown);
    document.removeEventListener('pointerdown', this.handlePointerDown);
    document.removeEventListener('focusin', this.handleFocusIn);
    window.removeEventListener('resize', this.onViewportChange);

    this.records.forEach((record) => {
      this.clearHoverTimer(record);
      record.item.removeEventListener('pointerenter', this.handlePointerEnter);
      record.item.removeEventListener('pointerleave', this.handlePointerLeave);

      if (record.isSplit) record.toggle.remove();
      if (!record.isSplit) record.toggle.replaceWith(record.label);

      if (record.generatedId) record.panel.removeAttribute('id');
      record.panel.removeAttribute(this.params.flipAttr);

      // Mirrors markParentPanels(): the enclosing panel was marked because
      // this record exists, so this record takes the mark back off.
      record.item.closest(this.params.panelSelector)
        ?.removeAttribute(this.params.parentPanelAttr);
    });

    this.records = [];
    this.root.removeAttribute(this.params.enhancedAttr);
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'dropdownNav',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new DropdownNav(el, defaults, reporter);
  return instance.destroy;
}
