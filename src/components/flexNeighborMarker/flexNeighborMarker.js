/**
 * flexNeighborMarker.js
 * ----------------------------------------------------------------------------
 * In a wrapping flex container the number of items per row is not known ahead
 * of time — it depends on the viewport, the font, the item widths, everything.
 * That makes "style the relationship between items in the same row" (e.g. draw
 * a divider *between* neighbours but never a trailing one at a row's end) hard
 * to express in pure CSS: `:not(:last-child)` marks the last item of the whole
 * list, not the last of each visual row.
 *
 * This module closes that gap. It measures the laid-out rows and toggles a
 * single marker class on every item that is followed by a sibling *in the same
 * visual row*. CSS then keys off that class — the layout logic stays in JS
 * where the measurements live, the presentation stays in CSS.
 *
 * Strategy (mirrors the accordion / adaptiveScrollFade CSS-state approach)
 * -----------------------------------------------------------------------
 * This script deliberately sets no inline styles. It only toggles one state
 * class on the flex items:
 *   - has-neighbor -> this item has a following sibling in the same visual row
 * Everything visual (dividers, borders, spacing) lives in the SCSS, which
 * reacts to that class. Without JavaScript the class is never added, the CSS
 * falls back to its unmarked state, and the layout is completely intact — the
 * marking is a pure progressive enhancement, never a dependency.
 *
 * Recompute triggers
 * ------------------
 * Row membership changes whenever the container reflows: window resize, the
 * container's own box changing (ResizeObserver), a late web-font swap, or
 * images finishing on load. All of these are collapsed into at most one
 * measurement per animation frame (rafThrottle), and every write is idempotent
 * (a class is only touched when it actually changes), so a mark that alters an
 * item's box cannot drive an infinite ResizeObserver loop.
 *
 * Accessibility
 * -------------
 * The marker is purely presentational — it conveys "same-row neighbour", a
 * layout fact that does not exist without JS and changes on every resize. It
 * therefore adds no ARIA, no roles and no focus behaviour, and the styling it
 * drives (see the SCSS) must stay decorative (dividers, spacing): nothing that
 * carries meaning to assistive technology may depend on it.
 *
 * Configuration (all optional, read from the module element)
 * ----------------------------------------------------------
 *   - data-neighbor-tolerance="1"
 *       px tolerance when grouping items into a row by their top edge
 *       (sub-pixel layout).
 *   - data-neighbor-class="..."
 *       override the marker class (default "has-neighbor"). The SCSS keys off
 *       the default, so restyle to match if you change it.
 *   - data-neighbor-container
 *       mark one or more descendant flex containers to scan; without it the
 *       module element itself is treated as the container.
 * ----------------------------------------------------------------------------
 */



import { rafThrottle } from "./rafThrottle.js"



const defaults = {
  containerSelector: "[data-neighbor-container]",
  markerClass: "has-neighbor",
  tolerance: 1, // px tolerance before two items count as sharing a row
}



class FlexNeighborMarker {

  // Parse a non-negative numeric option, falling back for
  // missing/invalid values.
  static parseTolerance(value, fallback) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
  }



  constructor(module, reporter) {
    this.module = module
    this.reporter = reporter

    this.markerClass = module.dataset.neighborClass?.trim() || defaults.markerClass
    this.tolerance = FlexNeighborMarker.parseTolerance(
      module.dataset.neighborTolerance,
      defaults.tolerance
    )

    this.containers = this.resolveContainers()

    // Collapse bursts of resize / observer events into one
    // measurement per frame.
    this.requestUpdate = rafThrottle(this.update)

    this.bindEvents()
    this.update()
  }



  // Which elements are the flex containers to scan? If the author
  // marked one or more descendants with data-neighbor-container,
  // those are the containers (the module element is then a wrapper
  // around several). Otherwise — the common single-container case —
  // the module element itself is the container, so no extra
  // attribute is needed beyond data-js-module.
  resolveContainers = () => {
    const marked = []
    if (this.module.matches(defaults.containerSelector)) marked.push(this.module)
    marked.push(...this.module.querySelectorAll(defaults.containerSelector))
    return marked.length ? marked : [this.module]
  }



  bindEvents = () => {
    window.addEventListener("resize", this.requestUpdate, { passive: true })

    // The container's own box can change without a window
    // resize (layout shifts, sibling content, flex-basis tweaks);
    // ResizeObserver catches those too and fires an initial
    // measurement as soon as each container is observed.
    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(this.requestUpdate)
      this.containers.forEach((container) => this.resizeObserver.observe(container))
    }

    // A late web-font swap or images finishing can change
    // item sizes and thus how they wrap, after the first
    // measurement — re-measure once each settles.
    if (document.fonts?.ready) {
      document.fonts.ready.then(this.requestUpdate).catch(() => {})
    }
    window.addEventListener("load", this.requestUpdate, { once: true })
  }



  // Re-mark every managed container. Reads all geometry, then
  // writes classes.
  update = () => this.containers.forEach(this.markContainer)



  // Group one container's direct children into visual rows by
  // their top edge, then mark every item that is not the last
  // of its row.
  markContainer = (container) => {
    const items = Array.from(container.children)
    if (!items.length) return

    const rows = []

    for (const item of items) {
      const top = item.getBoundingClientRect().top
      const row = rows.find((candidate) => Math.abs(candidate.top - top) <= this.tolerance)

      if (row) {
        // Keep a running average of the row's top so accumulated
        // sub-pixel drift across a wide row cannot push a later
        // item past the tolerance window.
        row.items.push(item)
        row.top = (row.top * (row.items.length - 1) + top) / row.items.length
        continue
      }

      rows.push({ top, items: [item] })
    }

    for (const row of rows) {
      row.items.forEach((item, index) => this.mark(item, index < row.items.length - 1))
    }
  }



  // Idempotent write: classList.toggle with an explicit force
  // flag only mutates the attribute when the state actually
  // differs, so a mark that changes an item's box cannot feed
  // back into the ResizeObserver as an endless loop.
  mark = (item, hasNeighbor) => item.classList.toggle(this.markerClass, hasNeighbor)
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      "flexNeighborMarker",
      "module was initialized on a non-element node.", el
    )
    return
  }

  // Double-init is prevented by the loader (boot.js sets a
  // per-element, per-module flag before calling init), so no
  // extra guard is needed here.
  new FlexNeighborMarker(el, reporter)
}
