/**
 * flexNeighborMarker.js
 * ----------------------------------------------------------------------------
 * In a wrapping flex container the number of items per row is not known ahead
 * of time — it depends on the viewport, the font, the item widths,
 * everything. That makes "style the relationship between items in the same
 * row" (e.g. a divider *between* neighbours but never a trailing one at a
 * row's end) hard to express in pure CSS: `:not(:last-child)` marks the last
 * item of the whole list, not the last of each visual row.
 *
 * This module closes that gap: it measures the laid-out rows and toggles a
 * single marker class on every item followed by a sibling *in the same visual
 * row*. CSS keys off that class — the layout logic stays in JS where the
 * measurements live, the presentation stays in CSS.
 *
 * Strategy (mirrors the accordion / adaptiveScrollFade CSS-state approach)
 * -----------------------------------------------------------------------
 * No inline styles — only one state class on the flex items:
 *   - has-neighbor -> this item has a following sibling in the same visual
 * row Everything visual (dividers, borders, spacing) lives in the SCSS, which
 * reacts to that class. Without JavaScript the class is never added, the CSS
 * falls back to its unmarked state and the layout is intact — the marking is
 * a pure progressive enhancement, never a dependency.
 *
 * Recompute triggers
 * ------------------
 * Row membership changes whenever the container reflows: window resize, the
 * container's own box changing (ResizeObserver), a late web-font swap, images
 * finishing on load. All of them collapse into at most one measurement per
 * animation frame (rafThrottle), and every write is idempotent (a class is
 * touched only when it changes), so a mark that alters an item's box cannot
 * drive an infinite ResizeObserver loop.
 *
 * Accessibility
 * -------------
 * The marker is purely presentational — it conveys "same-row neighbour", a
 * layout fact that does not exist without JS and changes on every resize. So
 * no ARIA, no roles, no focus behaviour, and the styling it drives (see the
 * SCSS) must stay decorative (dividers, spacing): nothing carrying meaning to
 * assistive technology may depend on it.
 *
 * Configuration (optional, read from the module element)
 * ------------------------------------------------------
 *   - data-neighbor-container
 *       mark one or more descendant flex containers to scan; without it the
 *       module element itself is treated as the container.
 * ----------------------------------------------------------------------------
 */



import { rafThrottle } from './rafThrottle.js';



const defaults = {
  containerSelector: '[data-neighbor-container]',

  // Set on every item with a following sibling in the same visual row. Not
  // overridable from the markup: the shipped SCSS keys its divider off this
  // exact name, so a renamed class would only take the styling away.
  markerClass: 'has-neighbor',

  // px tolerance before two items count as sharing a row. An internal
  // constant, not an option: it absorbs sub-pixel layout, and one device
  // pixel is what that takes on every layout there is.
  tolerance: 1,
};



class FlexNeighborMarker {

  constructor(module, reporter) {
    this.module = module;
    this.reporter = reporter;

    this.containers = this.resolveContainers();

    // Collapse bursts of resize / observer events into one measurement per
    // frame.
    this.requestUpdate = rafThrottle(this.update);

    this.bindEvents();
    this.update();
  }



  // Which elements are the flex containers to scan? Descendants marked with
  // data-neighbor-container, if the author marked any (the module element is
  // then a wrapper around several). Otherwise — the common single-container
  // case — the module element itself, so nothing beyond data-js-behavior is
  // needed.
  resolveContainers = () => {
    const marked = [];
    if (this.module.matches(defaults.containerSelector)) marked.push(this.module);
    marked.push(...this.module.querySelectorAll(defaults.containerSelector));
    return marked.length ? marked : [this.module];
  };



  bindEvents = () => {
    window.addEventListener('resize', this.requestUpdate, { passive: true });

    // The container's own box can change without a window resize (layout
    // shifts, sibling content, flex-basis tweaks); ResizeObserver catches
    // those too and fires an initial measurement as soon as each container is
    // observed.
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.requestUpdate);
      this.containers.forEach((container) => this.resizeObserver.observe(container));
    }

    // A late web-font swap or images finishing can change item sizes, and so
    // how they wrap, after the first measurement — re-measure once each
    // settles.
    if (document.fonts?.ready) {
      document.fonts.ready.then(this.requestUpdate).catch(() => {});
    }
    window.addEventListener('load', this.requestUpdate, { once: true });
  };



  // Re-mark every managed container. Reads all geometry, then writes classes.
  update = () => this.containers.forEach(this.markContainer);



  // Group one container's direct children into visual rows by their top edge,
  // then mark every item that is not the last of its row.
  markContainer = (container) => {
    const items = Array.from(container.children);
    if (!items.length) return;

    const rows = [];

    for (const item of items) {
      const top = item.getBoundingClientRect().top;
      const row = rows.find(
        (candidate) => Math.abs(candidate.top - top) <= defaults.tolerance
      );

      if (row) {

        // A running average of the row's top, so accumulated sub-pixel drift
        // across a wide row cannot push a later item past the tolerance
        // window.
        row.items.push(item);
        row.top = (row.top * (row.items.length - 1) + top) / row.items.length;
        continue;
      }

      rows.push({ top, items: [item] });
    }

    for (const row of rows) {
      row.items.forEach((item, index) => this.mark(item, index < row.items.length - 1));
    }
  };



  // Idempotent write: classList.toggle with an explicit force flag mutates
  // the attribute only when the state differs, so a mark that changes an
  // item's box cannot feed back into the ResizeObserver as an endless loop.
  mark = (item, hasNeighbor) =>
    item.classList.toggle(defaults.markerClass, hasNeighbor);



  // Optional teardown for hosts that mount/unmount this subtree repeatedly —
  // see destroyModulesInScope() in boot.js. The window resize/load listeners
  // and the ResizeObserver outlive the module unless explicitly stopped.
  destroy = () => {
    window.removeEventListener('resize', this.requestUpdate);
    window.removeEventListener('load', this.requestUpdate);
    this.resizeObserver?.disconnect();
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'flexNeighborMarker',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new FlexNeighborMarker(el, reporter);
  return instance.destroy;
}
