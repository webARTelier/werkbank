/**
 * stickyObserver.js
 * ----------------------------------------------------------------------------
 * `position: sticky` pins an element natively — no script needed for the
 * pinning itself. What CSS cannot do is *style* the pinned state: there is
 * no `:stuck` selector, so "add a shadow / a solid background / a hairline
 * once the header actually sticks" is impossible to express in pure CSS.
 *
 * This module closes that gap with the sentinel pattern. The module element
 * is the sticky element itself (the "target"). A sentinel sits in the
 * normal flow above it — by default a zero-size <div> this script injects
 * directly before the target, or any element the author points at via
 * data-sticky-sentinel. An IntersectionObserver watches the sentinel: the
 * moment it is completely above the (offset) top edge of the viewport — or
 * of the scroll container given via data-sticky-root — the target must be
 * pinned, so ONE state class is toggled on the target:
 *   - is-stuck -> the target is currently pinned by position: sticky
 * CSS keys off that class. The script sets no inline styles and runs no
 * animations — the transition between the two states lives in the SCSS
 * (which also honours prefers-reduced-motion). Without JavaScript no
 * sentinel is injected and the class is never added: the element still
 * sticks natively and simply keeps its unstuck look — the styling hook is
 * a pure progressive enhancement.
 *
 * The observer is passive: no scroll listener, no per-frame measuring. The
 * browser reports the sentinel's edge crossings; everything between two
 * flips costs nothing. The observer also fires once right after observing,
 * so a page restored mid-scroll starts with the correct state.
 *
 * Every instance owns its sentinel and its observer, so any number of
 * stickyObserver elements can live on one page. Several targets may also
 * share one author-placed sentinel by pointing data-sticky-sentinel at the
 * same element — each instance then simply observes it independently.
 *
 * Accessibility
 * -------------
 * "Currently pinned" is a purely visual, viewport-dependent layout fact, so
 * the module adds no ARIA, no roles and no focus behaviour (the injected
 * sentinel is empty and aria-hidden), and the styling keyed on the class
 * must stay decorative (surface, shadow, spacing): nothing that carries
 * meaning to assistive technology may depend on it.
 *
 * Configuration (all optional, read from the module element)
 * ----------------------------------------------------------
 *   - data-sticky-sentinel="..."
 *       CSS selector (first match in the document) for an author-placed
 *       sentinel. Use it when the trigger should sit somewhere else in the
 *       layout than directly before the target, when an injected sibling
 *       would disturb the layout (flex/grid `gap` slots, :first-child or
 *       sibling selectors, list/table markup), or when several targets
 *       share one sentinel. Any element works — the class flips once it is
 *       COMPLETELY above the trigger edge. Without the attribute a
 *       zero-size, aria-hidden <div> is injected directly before the
 *       target.
 *   - data-sticky-root="..."
 *       CSS selector (first match in the document) for the scroll
 *       container the target sticks in. Without the attribute the
 *       observer watches the viewport — correct for the common page-level
 *       sticky bar. Set it when the target lives inside an
 *       overflow: auto/scroll ancestor: position: sticky then pins
 *       against that container's edge, so the class must flip against
 *       the same edge, not the viewport's. Target and sentinel must both
 *       sit inside the root element.
 *   - data-sticky-class="..."
 *       override the state class (default "is-stuck"). The SCSS keys off
 *       the default, so restyle to match if you change it.
 *   - data-sticky-offset="..."
 *       px pin distance from the top of the viewport/root — the target's
 *       `inset-block-start` / `top` value. Normally NOT needed: the
 *       script reads the target's computed `top` by itself, so the CSS
 *       pin position is the single source of truth. Set the attribute
 *       only when that value is unusable (`auto`, or not resolvable to
 *       px). Either way the observer shrinks its root by the offset so
 *       the class flips exactly when the target reaches its pin
 *       position, not a moment late.
 * ----------------------------------------------------------------------------
 */



const defaults = {
  stateClass: 'is-stuck', // toggled on the target while it is pinned
  offset: 0, // px pin distance from the viewport top (data-sticky-offset)
};



class StickyObserver {

  // Parse a non-negative numeric option, falling back for
  // missing/invalid values.
  static parseOffset(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }



  constructor(target, reporter) {
    this.target = target;
    this.reporter = reporter;

    // Very old engines without IntersectionObserver stay unenhanced —
    // the element still sticks natively, only the class is never
    // toggled. Bail before touching the DOM so no orphaned sentinel
    // is injected.
    if (!('IntersectionObserver' in window)) return;

    this.stateClass = target.dataset.stickyClass?.trim() || defaults.stateClass;
    this.offset = this.resolveOffset();

    // null = viewport, an element = scroll-container root, undefined =
    // misconfigured (already reported) — leave the target unenhanced.
    this.root = this.resolveRoot();
    if (this.root === undefined) return;

    this.sentinel = this.resolveSentinel();
    if (!this.sentinel) return;

    this.observe();
  }



  // The pin distance from the trigger edge. An explicit
  // data-sticky-offset wins; without it the offset is read from the
  // target's own computed `top` (the resolved value of
  // `inset-block-start`), so the CSS pin position is the single source
  // of truth and needs no double bookkeeping in the markup. Only px
  // values are usable — `auto` (or anything else non-px) falls back to
  // 0; set data-sticky-offset explicitly in those cases.
  resolveOffset = () => {
    const computedTop = getComputedStyle(this.target).top;
    const fallback = computedTop.endsWith('px')
      ? StickyObserver.parseOffset(computedTop, defaults.offset)
      : defaults.offset;

    const attribute = this.target.dataset.stickyOffset;
    if (attribute === undefined) return fallback;

    return StickyObserver.parseOffset(attribute, fallback);
  };



  // Which box does the target stick in? Without data-sticky-root the
  // observer watches the viewport (root: null). With the attribute the
  // first match in the document becomes the observer root — required
  // inside an overflow: auto/scroll container, where position: sticky
  // pins against that container's edge, not the viewport's. Returns
  // undefined on a bad config so the constructor bails instead of
  // silently watching the wrong box; the target must sit inside the
  // root, otherwise its sentinel could never intersect it.
  resolveRoot = () => {
    const selector = this.target.dataset.stickyRoot?.trim();
    if (!selector) return null;

    try {
      const root = document.querySelector(selector);

      if (!(root instanceof HTMLElement)) {
        this.reporter?.report(
          'stickyObserver',
          `found no root element for selector "${selector}".`
        );
        return undefined;
      }

      if (root === this.target || !root.contains(this.target)) {
        this.reporter?.report(
          'stickyObserver',
          `the data-sticky-root element ("${selector}") must contain the target.`
        );
        return undefined;
      }

      return root;
    } catch {
      this.reporter?.report(
        'stickyObserver',
        `invalid data-sticky-root selector ("${selector}").`
      );
      return undefined;
    }
  };



  // Which element is the sentinel? An explicit data-sticky-sentinel
  // selector wins (author-placed trigger, resolved against the
  // document — use unique selectors per instance); without it a
  // sentinel is injected directly before the target.
  resolveSentinel = () => {
    const selector = this.target.dataset.stickySentinel?.trim();
    if (!selector) return this.injectSentinel();

    try {
      const sentinel = document.querySelector(selector);

      if (!(sentinel instanceof HTMLElement)) {
        this.reporter?.report(
          'stickyObserver',
          `found no sentinel element for selector "${selector}".`
        );
        return null;
      }

      // An author-placed sentinel outside the scroll-container root
      // could never intersect it — the class would sit frozen on
      // whatever the first callback decided. (The injected sentinel
      // cannot end up outside: it is a sibling of the target, and the
      // target is verified to sit inside the root.)
      if (this.root && !this.root.contains(sentinel)) {
        this.reporter?.report(
          'stickyObserver',
          `the sentinel ("${selector}") sits outside the data-sticky-root element.`
        );
        return null;
      }

      return sentinel;
    } catch {
      this.reporter?.report(
        'stickyObserver',
        `invalid data-sticky-sentinel selector ("${selector}").`
      );
      return null;
    }
  };



  // Inject the default sentinel: an empty, zero-size <div> right
  // before the target — invisible, aria-hidden and without any layout
  // footprint in normal block flow. Inside a flex/grid container with
  // `gap` (or next to :first-child / sibling selectors) an extra
  // sibling is NOT free — point data-sticky-sentinel at an
  // author-placed element there instead. The marker attribute only
  // makes the injected node identifiable in the inspector.
  injectSentinel = () => {
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.setAttribute('data-sticky-sentinel', '');
    this.target.before(sentinel);
    return sentinel;
  };



  // Watch the sentinel from the configured root — the viewport by
  // default, a scroll container via data-sticky-root. The negative top
  // rootMargin shrinks that root by the pin offset so "sentinel gone"
  // and "target pinned" coincide even when the target sticks below the
  // root's top edge. The huge bottom expansion keeps the sentinel
  // "intersecting" while it is anywhere BELOW that edge, even far
  // under the fold: crossing the edge is then always a status change
  // the observer reports — including instant scroll jumps (anchor
  // links, "back to top", the Home key), during which the sentinel
  // never appears inside the bare root box and which would otherwise
  // produce no notification at all, leaving a stale class behind.
  observe = () => {
    this.observer = new IntersectionObserver(this.handleIntersection, {
      root: this.root,
      rootMargin: `-${this.offset}px 0px 100000px 0px`,
    });

    this.observer.observe(this.sentinel);
  };



  // With the expanded root the sentinel only stops intersecting when
  // it is completely above the (offset) top edge — exactly while the
  // target is pinned. The rect check is belt and braces for pages
  // deeper than the bottom expansion; rootBounds is only null for a
  // root detached from the document — fall back to the configured
  // offset (the same top edge) in that case. The write is idempotent:
  // classList.toggle with an explicit force flag only mutates the
  // attribute when the state actually changes.
  handleIntersection = (entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) return;

    const topEdge = entry.rootBounds?.top ?? this.offset;
    const isStuck = !entry.isIntersecting && entry.boundingClientRect.top < topEdge;

    this.target.classList.toggle(this.stateClass, isStuck);
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'stickyObserver',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a
  // per-element, per-module flag before calling init), so no
  // extra guard is needed here.
  new StickyObserver(el, reporter);
}
