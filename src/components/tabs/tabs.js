/**
 * tabs.js
 * ----------------------------------------------------------------------------
 * Progressive-enhancement script that upgrades an anchor-link table of
 * contents plus plain, stacked content sections into an accessible tabs
 * widget following the ARIA APG "Tabs" pattern.
 *
 * What works without this script
 * ------------------------------
 * The markup is a list of in-page anchor links (the future tabs) followed by
 * normal content sections (the future panels). Without JavaScript this is
 * fully usable: the links jump to their sections, nothing is hidden, and no
 * ARIA promises behaviour that does not exist. Fragment URLs stay shareable
 * in both worlds.
 *
 * Where scripting IS enabled, tabs.scss collapses the panels to one before
 * this script has loaded (the pre-enhancement state — see the stylesheet and
 * docs/preEnhancement.md), so the page never paints the full stack and then
 * snaps. That state lifts on data-tabs-ready, which the constructor sets
 * before anything else — so markup this script bails on falls back to the
 * plain stacked document rather than staying collapsed. A panel named by
 * the URL fragment is exempt from it either way.
 *
 * What the script adds
 * --------------------
 * 1. Roles and ARIA at runtime: role="tablist" / "tab" / "tabpanel",
 *    aria-selected, aria-controls and aria-labelledby — the markup is a
 *    correct document without JS and a correct tabs widget with it.
 * 2. Panel switching: exactly one panel is shown, the others get `hidden`.
 *    ARIA is the styling hook — no extra state class is written.
 * 3. Keyboard support with a roving tabindex: Arrow keys move between tabs
 *    with wrap-around, Home/End jump to the first/last tab. Activation is
 *    automatic on focus by default (APG recommendation for instantly
 *    displayable panels), or explicit via Enter/Space with data-tabs-manual.
 * 4. Deep linking: a URL fragment matching a panel id selects that tab on
 *    load and on hashchange (foreign hashes are ignored). With
 *    data-tabs-deeplink the selected tab is also written back to the URL
 *    via history.replaceState — path and query stay untouched, no history
 *    entries pile up.
 *
 * Accessibility
 * -------------
 * Follows the APG tabs pattern: roving tabindex on the tabs, aria-selected
 * on the active tab, each panel labelled by its tab. A panel without
 * focusable content gets tabindex="0" so keyboard users can reach and
 * scroll it. The tablist needs an accessible name (aria-label or
 * aria-labelledby on the list element); a missing name is reported rather
 * than silently shipped.
 *
 * Configuration (all optional, on the data-js-behavior element)
 * -----------------------------------------------------------
 * - data-tabs-manual                  select on Enter/Space instead of on
 *                                     focus ("manual activation")
 * - data-tabs-orientation="vertical"  sets aria-orientation="vertical" and
 *                                     switches the arrow keys to Up/Down
 * - data-tabs-deeplink                mirror the selected tab into the URL
 *                                     fragment (history.replaceState)
 * ----------------------------------------------------------------------------
 */



const defaults = {

  // the element that becomes the tablist (one per module instance)
  listSelector: '[data-tabs-list]',

  // the in-page anchor links inside the list that become the tabs
  tabSelector: '[data-tabs-tab]',

  // the content sections that become the panels; each is resolved via
  // its tab's href fragment (href="#id" -> element with that id)
  panelSelector: '[data-tabs-panel]',

  // presence switches from automatic (select on focus) to manual
  // (select on Enter/Space) activation
  manualAttr: 'data-tabs-manual',

  // 'vertical' switches the arrow-key axis and sets aria-orientation
  orientationAttr: 'data-tabs-orientation',

  // presence mirrors the selected tab into the URL fragment
  deeplinkAttr: 'data-tabs-deeplink',

  // "This container is no longer waiting for a script." Set on the
  // container by the constructor, which is what lifts the pre-enhancement
  // state in tabs.scss — including when the constructor then bails on
  // unusable markup. Only ever WRITTEN, never read back; see the
  // constructor for why it goes first.
  readyAttr: 'data-tabs-ready',
};



// Rough probe for "contains something keyboard-reachable". Only used to
// decide whether a panel itself needs tabindex="0" (APG recommendation),
// so a false positive is harmless.
const focusableSelector =
  'a[href], button, input, select, textarea, [tabindex], [contenteditable]';



// Decodes a URL-fragment id to compare it against panel ids. A fragment
// can carry malformed percent-encoding (e.g. '#%zz' typed or mangled in
// a shared link), where decodeURIComponent throws — mapped to null here
// so a broken fragment can never abort init or the hashchange handler.
function decodeFragment(fragment) {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return null;
  }
}



class Tabs {

  constructor(container, params, reporter) {
    this.container = container;
    this.params = params;
    this.reporter = reporter;
    this.items = [];
    this.selectedItem = null;

    // First, not last, and the difference matters in both directions.
    //
    // The pre-enhancement rules in tabs.scss keep all but one panel out of
    // the flow until this attribute appears; the panels only get their real
    // `hidden` state further down. Setting it up front is safe because
    // everything in this constructor runs in one synchronous task — the
    // browser cannot paint the moment in between, so there is no frame in
    // which the panels are all visible.
    //
    // What it buys is the bail-outs below. If the markup has no list or no
    // usable tabs, this widget never happens, and leaving the pre-state in
    // force would hide panels behind a widget that does not exist — with
    // not even a table of contents to reach them by. Lifting it here means
    // a bail always lands on the plain stacked document instead.
    container.setAttribute(params.readyAttr, '');

    this.list = container.querySelector(params.listSelector);
    if (!this.list) {
      this.reporter?.report(
        'tabs',
        'no [data-tabs-list] element found in container.', { el: container }
      );
      return;
    }

    this.isManual = container.hasAttribute(params.manualAttr);
    this.isVertical =
      container.getAttribute(params.orientationAttr) === 'vertical';
    this.useDeeplink = container.hasAttribute(params.deeplinkAttr);

    this.collectItems();
    if (!this.items.length) {
      this.reporter?.report(
        'tabs',
        'no usable tabs found in list.', { el: this.list }
      );
      return;
    }

    this.reportOrphanedPanels();
    this.applySemantics();
    this.selectInitialItem();
    this.startListening();
  }



  // Pairs every tab link with its panel. The pairing key is the native
  // anchor mechanism itself: the href fragment is the panel id — no extra
  // wiring attribute needed, and the no-JS jump link stays intact.
  collectItems = () => {
    this.list.querySelectorAll(this.params.tabSelector).forEach((tab) => {
      const href = tab.getAttribute('href') || '';

      if (!href.startsWith('#') || href.length < 2) {
        this.reporter?.report(
          'tabs',
          `tab needs an in-page href ('#…'), got '${href}'.`, { el: tab }
        );
        return;
      }

      const id = decodeFragment(href.slice(1));
      if (id === null) {
        this.reporter?.report(
          'tabs',
          `tab href fragment is not decodable: '${href}'.`, { el: tab }
        );
        return;
      }

      const panel = document.getElementById(id);

      if (!panel) {
        this.reporter?.report(
          'tabs',
          `missing tab panel: no element with id '${id}'.`, { el: tab }
        );
        return;
      }

      // Two tabs claiming the same panel would fight over `hidden` in
      // select() (the last write wins) — keep the first pairing, drop
      // and report the duplicate.
      if (this.items.some((item) => item.panel === panel)) {
        this.reporter?.report(
          'tabs',
          `duplicate tab for panel '${id}' — tab is ignored.`, { el: tab }
        );
        return;
      }

      this.items.push({ tab, panel, id });
    });
  };



  // Warns about panels in the container no tab points to — they would be
  // hidden forever once the widget is active.
  reportOrphanedPanels = () => {
    const panels = this.container.querySelectorAll(this.params.panelSelector);

    panels.forEach((panel) => {
      if (this.items.some((item) => item.panel === panel)) return;
      this.reporter?.report(
        'tabs',
        `orphaned tab panel: '${panel.id || '(no id)'}'.`, { el: panel }
      );
    });
  };



  // Assigns the APG roles and relationships at runtime, so the no-JS
  // document never carries ARIA that promises behaviour it cannot deliver.
  applySemantics = () => {
    this.list.setAttribute('role', 'tablist');
    if (this.isVertical) {
      this.list.setAttribute('aria-orientation', 'vertical');
    }

    const hasName =
      this.list.hasAttribute('aria-label') ||
      this.list.hasAttribute('aria-labelledby');
    if (!hasName) {
      this.reporter?.report(
        'tabs',
        'tablist has no accessible name — add aria-label or ' +
        'aria-labelledby to the list element.', { el: this.list }
      );
    }

    this.items.forEach(({ tab, panel, id }) => {

      // An <li> wrapping a tab is presentational inside a tablist.
      const listItem = tab.closest('li');
      if (listItem && this.list.contains(listItem)) {
        listItem.setAttribute('role', 'presentation');
      }

      if (!tab.id) tab.id = `${id}-tab`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', id);

      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);

      // A panel without focusable content becomes focusable itself so
      // keyboard users can reach and scroll it (APG).
      if (!panel.querySelector(focusableSelector)) {
        panel.setAttribute('tabindex', '0');
      }
    });
  };



  // Selects the tab the URL fragment points to, if any; otherwise the
  // first tab. When the fragment matches, the browser has already jumped
  // to the section natively — nothing to re-scroll.
  selectInitialItem = () => {
    const linkedItem = this.itemForHash(location.hash);
    this.select(linkedItem || this.items[0]);
  };



  startListening = () => {
    this.list.addEventListener('click', this.handleClick);
    this.list.addEventListener('keydown', this.handleKeydown);
    window.addEventListener('hashchange', this.handleHashChange);
  };



  // Activates a clicked tab. preventDefault stops the native anchor jump —
  // the panel is shown in place; when deep-linking is enabled the fragment
  // is written explicitly (without scrolling) in select(). Enter on a
  // focused link fires a click natively, so manual activation via Enter
  // lands here too.
  handleClick = (e) => {
    const tab = e.target.closest(this.params.tabSelector);
    if (!tab) return;

    const item = this.items.find((candidate) => candidate.tab === tab);
    if (!item) return;

    e.preventDefault();
    if (item === this.selectedItem) return;

    this.select(item, { updateHash: true });
  };



  // Roving-tabindex keyboard support: arrows move between tabs with
  // wrap-around (axis follows the orientation), Home/End jump to the
  // ends. Automatic mode selects the tab the focus lands on; manual mode
  // only moves focus and selects on Enter (native click) / Space (here).
  handleKeydown = (e) => {
    const tab = e.target.closest(this.params.tabSelector);
    const currentItem = this.items.find((item) => item.tab === tab);
    if (!currentItem) return;

    if (e.key === ' ') {

      // A link has no native Space activation (Space scrolls the page),
      // so select explicitly.
      e.preventDefault();
      if (currentItem !== this.selectedItem) {
        this.select(currentItem, { updateHash: true });
      }
      return;
    }

    const previousKey = this.isVertical ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = this.isVertical ? 'ArrowDown' : 'ArrowRight';

    let targetItem = null;
    if (e.key === previousKey) targetItem = this.siblingItem(currentItem, -1);
    if (e.key === nextKey) targetItem = this.siblingItem(currentItem, 1);
    if (e.key === 'Home') targetItem = this.items[0];
    if (e.key === 'End') targetItem = this.items[this.items.length - 1];
    if (!targetItem) return;

    // A handled key must not also scroll the page.
    e.preventDefault();

    if (this.isManual) {
      targetItem.tab.focus();
      return;
    }

    this.select(targetItem, { setFocus: true, updateHash: true });
  };



  // Reacts to fragment navigation (back/forward, in-page links elsewhere
  // on the page). Foreign hashes never match a panel id and are ignored,
  // so hash-using neighbours (skip links, other anchors) cannot clash.
  handleHashChange = () => {
    const item = this.itemForHash(location.hash);
    if (!item || item === this.selectedItem) return;
    this.select(item);
  };



  // Selects one tab: aria-selected + roving tabindex on the tabs, hidden
  // on the panels. These ARIA attributes are also the styling hooks — the
  // script writes no state class and no inline styles.
  select = (selected, { setFocus = false, updateHash = false } = {}) => {
    this.items.forEach((item) => {
      const isSelected = item === selected;
      item.tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      item.tab.setAttribute('tabindex', isSelected ? '0' : '-1');
      item.panel.hidden = !isSelected;
    });

    this.selectedItem = selected;

    if (setFocus) selected.tab.focus();
    if (!updateHash || !this.useDeeplink) return;

    // replaceState keeps path and query untouched, adds no history entry,
    // does not scroll, and does not fire hashchange (no feedback loop).
    history.replaceState(null, '', `#${encodeURIComponent(selected.id)}`);
  };



  // Maps a URL fragment to a tab item, or null when it points elsewhere
  // or is not decodable.
  itemForHash = (hash) => {
    if (!hash || hash.length < 2) return null;
    const id = decodeFragment(hash.slice(1));
    if (id === null) return null;
    return this.items.find((item) => item.id === id) || null;
  };



  // Returns the neighbouring item with wrap-around.
  siblingItem = (item, direction) => {
    const index = this.items.indexOf(item);
    const length = this.items.length;
    return this.items[(index + direction + length) % length];
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly
  // instead of doing a full page (re)load — see destroyModulesInScope() in
  // boot.js. The click/keydown listeners are bound to the tablist itself and
  // would die naturally with it; only the window hashchange listener
  // outlives this subtree unless explicitly removed.
  destroy = () => {
    this.list?.removeEventListener('click', this.handleClick);
    this.list?.removeEventListener('keydown', this.handleKeydown);
    window.removeEventListener('hashchange', this.handleHashChange);

    this.container.removeAttribute(this.params.readyAttr);
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'tabs',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new Tabs(el, defaults, reporter);
  return instance.destroy;
}
