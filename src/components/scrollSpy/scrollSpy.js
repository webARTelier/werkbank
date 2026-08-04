/**
 * scrollSpy.js
 * ----------------------------------------------------------------------------
 * An in-page anchor-link table of contents already works without any
 * script: the links jump to their sections, natively honouring the
 * targets' scroll-margin. What the platform cannot do is answer "which
 * section is the reader in right now?" while the page scrolls — there is
 * no CSS selector for it and no native TOC highlight.
 *
 * This module closes that gap. It boots on the TOC element itself, pairs
 * every in-page anchor link inside it with its target element (the href
 * fragment IS the wiring, exactly as in the tabs component) and marks the
 * link of the section the reader is currently in:
 *   - aria-current="location" -> the link whose section is being read
 * That attribute doubles as the styling hook — the script writes no state
 * class and no inline styles. Without JavaScript the markup stays a fully
 * usable jump-link TOC, free of a highlight that could not update.
 *
 * "Currently in" is decided at a spy line — a horizontal line a fixed
 * distance below the top edge of the viewport (or of the scroll container
 * given via data-spy-root): current is the LAST target in document order
 * whose top edge has passed that line; above the first section no link is
 * current. Two refinements make the naive line model behave at the edges:
 *   1. The line's distance is read from the first target's computed
 *      scroll-margin-top (unless data-spy-offset overrides it). That
 *      margin is where the browser lands anchor jumps, so an anchor jump
 *      always highlights the very link that was clicked — the CSS is the
 *      single source of truth, as with stickyObserver's `top`.
 *   2. A short final section may never reach the line when the content
 *      ends right below it — the line simply cannot get there. A second
 *      observer therefore watches a zero-size sentinel this script
 *      appends at the very end of the scroll content (stickyObserver's
 *      injection pattern): once the root is scrolled to its end, the
 *      last link is current — reaching the end of the page highlights
 *      the end of the TOC, and only then. The signal counts only while
 *      the root has vertical scroll room at all: content that fits the
 *      root entirely has no end to reach, and the line rule stays in
 *      charge.
 *
 * The tail blind spot every line-based spy shares remains for the
 * sections in between: a section becomes current only once its top edge
 * reaches the line, which takes about one root-height of content below
 * that top edge — on tall viewports, late sections followed by too
 * little content are skipped (the end rule rescues the last one). The
 * author's levers are tail room below the content and the line offset:
 * a larger data-spy-offset moves the line down and shrinks the blind
 * zone; anchor-jump consistency survives any offset that is at least
 * the targets' scroll margin, as long as sections are taller than the
 * difference between the two.
 *
 * Everything is IntersectionObserver-driven: no scroll listener, nothing
 * measured per frame. The observed regions extend far beyond the root
 * (the stickyObserver rationale), so even instant jumps (anchor links,
 * "back to top", the Home key) always cross a region edge and report a
 * status change. Only the regions' px geometry depends on the root's
 * height, so the observers are rebuilt once per (debounced) resize — the
 * only non-observer listener the module owns.
 *
 * Accessibility
 * -------------
 * The highlight is real navigation information — "you are here" within
 * the page — which is exactly what aria-current="location" expresses, so
 * the marker is exposed to AT instead of hidden in a styling class.
 * aria-current is no live region: scrolling never causes announcements.
 * The module adds no roles and no focus behaviour; the links stay plain
 * links, and the native anchor navigation is never intercepted (smooth
 * scrolling belongs to the project's CSS, honouring reduced motion).
 * The injected end sentinel is empty and aria-hidden.
 *
 * Configuration (all optional, read from the module element)
 * ----------------------------------------------------------
 *   - data-spy-offset="..."
 *       px distance of the spy line from the root's top edge. Normally
 *       NOT needed: the script reads the first target's computed
 *       scroll-margin-top, so the value that positions anchor jumps
 *       (e.g. under a sticky header) also positions the spy line. Set
 *       the attribute only when that value is unusable — e.g. targets
 *       with differing scroll margins (one line spans the page, so one
 *       offset must fit all).
 *   - data-spy-root="..."
 *       CSS selector (first match in the document) for the scroll
 *       container the target sections scroll in. Without the attribute
 *       the observers watch the viewport — correct for a normal page
 *       TOC. Set it when the sections live inside an overflow:
 *       auto/scroll ancestor; every target must sit inside that element
 *       (the TOC itself may live anywhere).
 * ----------------------------------------------------------------------------
 */

import { debounceThenExecute } from './debounce.js';
import { decodeFragment } from './decodeFragment.js';
import { parseNonNegative } from './parseNonNegative.js';



const defaults = {

  // the in-page anchor links inside the module element that become spy
  // links; the href fragment resolves the target (href="#id")
  linkSelector: 'a[href^="#"]',

  // px distance of the spy line from the root's top edge when neither
  // data-spy-offset nor a scroll-margin-top on the first target is set
  offset: 0,

  // the value written to aria-current on the current link
  currentValue: 'location',

  // px the observed regions extend beyond the root, so that even far
  // instant jumps keep every edge crossing a reportable status change
  expansion: 100000,

  // px of tolerance for "scrolled to the end" — sub-pixel scroll
  // positions must not keep the end sentinel from registering
  endSlack: 2,

  // ms of resize silence before the observers are rebuilt
  rebuildDelay: 150,
};



class ScrollSpy {

  // Set by destroy(), read by the debounced rebuild: the resize watcher
  // can already be queued when the host unmounts, and a debounced call
  // cannot be cancelled from the outside.
  destroyed = false;



  constructor(container, reporter) {
    this.container = container;
    this.reporter = reporter;
    this.items = [];
    this.lineStates = new Map();
    this.isEndReached = false;
    this.currentItem = null;

    // Very old engines without IntersectionObserver stay unenhanced —
    // the TOC keeps working as plain jump links, only the highlight
    // never appears.
    if (!('IntersectionObserver' in window)) return;

    // null = viewport, an element = scroll-container root, undefined =
    // misconfigured (already reported) — leave the TOC unenhanced.
    this.root = this.resolveRoot();
    if (this.root === undefined) return;

    this.collectItems();
    if (!this.items.length) {
      this.reporter?.report(
        'scrollSpy',
        'no in-page anchor links with resolvable targets found.',
        { el: container }
      );
      return;
    }

    this.sentinel = this.injectSentinel();
    this.observe();
    this.watchResize();
  }



  // Which box do the target sections scroll in? Without data-spy-root
  // the observers watch the viewport (root: null). With the attribute
  // the first match in the document becomes the observer root —
  // required inside an overflow: auto/scroll container, where the spy
  // line must sit relative to that container's edges, not the
  // viewport's. Returns undefined on a bad config so the constructor
  // bails instead of silently watching the wrong box.
  resolveRoot = () => {
    const selector = this.container.dataset.spyRoot?.trim();
    if (!selector) return null;

    try {
      const root = document.querySelector(selector);

      if (!(root instanceof HTMLElement)) {
        this.reporter?.report(
          'scrollSpy',
          `found no root element for selector "${selector}".`
        );
        return undefined;
      }

      return root;
    } catch {
      this.reporter?.report(
        'scrollSpy',
        `invalid data-spy-root selector ("${selector}").`
      );
      return undefined;
    }
  };



  // Pairs every in-page anchor link with its target element. The
  // pairing key is the native anchor mechanism itself: the href
  // fragment is the target id — no extra wiring attribute, and the
  // no-JS jump link stays intact. A link whose target cannot be
  // resolved is reported and left as a plain link.
  collectItems = () => {
    this.container.querySelectorAll(defaults.linkSelector).forEach((link) => {
      const href = link.getAttribute('href') || '';

      if (href.length < 2) {
        this.reporter?.report(
          'scrollSpy',
          `link needs an in-page href ('#…'), got '${href}'.`, { el: link }
        );
        return;
      }

      const id = decodeFragment(href.slice(1));
      if (id === null) {
        this.reporter?.report(
          'scrollSpy',
          `link href fragment is not decodable: '${href}'.`, { el: link }
        );
        return;
      }

      const target = document.getElementById(id);
      if (!target) {
        this.reporter?.report(
          'scrollSpy',
          `missing spy target: no element with id '${id}'.`, { el: link }
        );
        return;
      }

      // A target outside the scroll-container root could never
      // intersect the observed regions — its state would sit frozen on
      // whatever the first callback decided.
      if (this.root && !this.root.contains(target)) {
        this.reporter?.report(
          'scrollSpy',
          `target '${id}' sits outside the data-spy-root element — ` +
          'link is ignored.', { el: link }
        );
        return;
      }

      // Two links claiming the same target would fight over
      // aria-current — keep the first pairing, drop and report the
      // duplicate.
      if (this.items.some((item) => item.target === target)) {
        this.reporter?.report(
          'scrollSpy',
          `duplicate link for target '${id}' — link is ignored.`, { el: link }
        );
        return;
      }

      this.items.push({ link, target, id });
    });

    // "Last top edge above the line" is a statement about the content
    // flow, so the items are ordered by their targets' document order —
    // robust even when the TOC lists its links differently (e.g. a
    // nested sublist rendered apart from its parent entry).
    this.items.sort((a, b) => (
      a.target.compareDocumentPosition(b.target)
        & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1
    ));
  };



  // The spy line's distance from the root's top edge. An explicit
  // data-spy-offset wins; without it the offset is read from the first
  // target's computed scroll-margin-top: that margin is where the
  // browser lands anchor jumps (e.g. below a sticky header), so reusing
  // it guarantees a clicked link highlights its own section — the CSS
  // is the single source of truth and needs no double bookkeeping.
  // Re-resolved on every (re)build, so a margin that changes with a
  // media query is picked up with the resize that triggered it.
  resolveOffset = () => {
    const computed = getComputedStyle(this.items[0].target).scrollMarginTop;
    const fallback = parseNonNegative(computed, defaults.offset);

    const attribute = this.container.dataset.spyOffset;
    if (attribute === undefined) return fallback;

    return parseNonNegative(attribute, fallback);
  };



  // Inject the end sentinel: an empty, zero-size <div> appended at the
  // very end of the scroll content — the root element for a container
  // spy, the body for a page spy. It is invisible, aria-hidden and has
  // no layout footprint in normal block flow (inside a flex/grid
  // container with `gap` an extra child is NOT free — a page spy is
  // unaffected, since the sentinel lands at the body's end). The marker
  // attribute only makes the injected node identifiable in the
  // inspector. Only this sentinel can detect "scrolled to the very
  // end": it is the one thing whose crossing of the root's bottom edge
  // coincides exactly with the end of the scroll range.
  injectSentinel = () => {
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.setAttribute('data-spy-sentinel', '');
    (this.root ?? document.body).append(sentinel);
    return sentinel;
  };



  // The px height of the box the observers intersect against — the
  // layout viewport for a null root (documentElement.clientHeight, so a
  // horizontal scrollbar is excluded like in the observer's own
  // rootBounds), the padding box for an element root (clientHeight).
  // This is the one px value the rootMargins bake in; see watchResize.
  measureRootHeight = () => (
    this.root ? this.root.clientHeight : document.documentElement.clientHeight
  );



  // Whether the root can scroll vertically at all — the page scroller
  // for a null root, the element itself for a container root. Measured
  // on demand (one read per end-edge crossing), with the same slack
  // that forgives sub-pixel scroll ranges.
  hasScrollRoom = () => {
    const scroller = this.root ?? document.documentElement;
    return scroller.scrollHeight - scroller.clientHeight > defaults.endSlack;
  };



  // Build both observers. Each rootMargin reshapes the observed region
  // so that isIntersecting IS the state to track and every flip is an
  // edge crossing the observer reports by itself:
  //
  //   line observer — region [far above the root ... spy line]:
  //     a target intersects exactly while its top edge is above the spy
  //     line, so the observer fires precisely when a top edge crosses
  //     it. The +1px puts the line just below where anchor jumps land
  //     the targets (their scroll margin), so a sub-pixel landing
  //     position still counts as "passed".
  //
  //   end observer — region [far above the root ... root's bottom
  //     edge]: the end sentinel sits at the very end of the scroll
  //     content, so it intersects exactly while the root is scrolled to
  //     its end (the slack forgives sub-pixel scroll positions).
  //
  // The huge expansions keep a target inside a region even far outside
  // the root, so crossing the meaningful edge is always a status change
  // — including instant scroll jumps, during which a bare root box
  // would produce no notification at all (stickyObserver rationale).
  observe = () => {
    this.rootHeight = this.measureRootHeight();
    this.offset = this.resolveOffset();

    this.lineObserver = new IntersectionObserver(this.handleLineIntersection, {
      root: this.root,
      rootMargin:
        `${defaults.expansion}px 0px ` +
        `${this.offset + 1 - this.rootHeight}px 0px`,
    });
    this.items.forEach((item) => this.lineObserver.observe(item.target));

    this.endObserver = new IntersectionObserver(this.handleEndIntersection, {
      root: this.root,
      rootMargin: `${defaults.expansion}px 0px ${defaults.endSlack}px 0px`,
    });
    this.endObserver.observe(this.sentinel);
  };



  // One entry per target whose top edge crossed the spy line (plus the
  // initial state right after observing). isIntersecting IS "top edge
  // above the line" thanks to the region shape; the rect comparison is
  // belt and braces for content deeper than the region's expansion,
  // where a target scrolled very far past would fall out at the far
  // edge. A display:none target reports an all-zero rect and neither
  // condition — it simply stays "not above the line".
  handleLineIntersection = (entries) => {
    entries.forEach((entry) => {
      const farEdge = entry.rootBounds?.top ?? -defaults.expansion;
      const isAboveLine =
        entry.isIntersecting || entry.boundingClientRect.bottom < farEdge;
      this.lineStates.set(entry.target, isAboveLine);
    });

    this.update();
  };



  // The end sentinel enters the end region the moment the root is
  // scrolled to its very end — while any scroll room is left, it sits
  // below the root's bottom edge and does not intersect. When the
  // content fits the root entirely, the sentinel intersects from the
  // start although nothing was scrolled — so the signal only counts
  // while the root has scroll room at all; without it the line rule
  // stays in charge instead of marking the last link unprompted.
  handleEndIntersection = (entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) return;

    this.isEndReached = entry.isIntersecting && this.hasScrollRoom();
    this.update();
  };



  // The line rule's pick: the last item in document order whose
  // target's top edge has passed the spy line. A plain reverse loop
  // instead of Array#findLast — the constructor's support gate is
  // IntersectionObserver (~2019), and engines older than findLast
  // (~2022) must stay cleanly unenhanced instead of throwing on every
  // observer callback.
  findLastAboveLine = () => {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      if (this.lineStates.get(this.items[i].target)) return this.items[i];
    }
    return null;
  };



  // Derives the current item and writes it — the module's only DOM
  // write beside the sentinel. The scrolled-to-the-end signal wins (a
  // short final section at the end of the content never reaches the
  // line), then the last target in document order whose top edge has
  // passed the line; above the first section nothing is current. The
  // write is idempotent: the DOM is only touched when the current item
  // actually changed.
  update = () => {
    const current = this.isEndReached
      ? this.items[this.items.length - 1]
      : this.findLastAboveLine();

    if (current === this.currentItem) return;

    this.currentItem?.link.removeAttribute('aria-current');
    current?.link.setAttribute('aria-current', defaults.currentValue);
    this.currentItem = current;
  };



  // The rootMargins bake the root's px height (and the resolved offset)
  // in, so a resize moves the spy line and the end edge. Rebuild both
  // observers once the resize settles; re-observing fires the initial
  // entries again, so the state is recomputed from scratch. A viewport
  // root listens to window resize; an element root gets a
  // ResizeObserver, which also covers container size changes the window
  // never sees (and fires for window-driven ones too). Engines with
  // IntersectionObserver but without ResizeObserver fall back to the
  // window listener.
  watchResize = () => {
    this.handleResize =
      debounceThenExecute(this.rebuild, defaults.rebuildDelay);

    if (this.root && 'ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.root);
      return;
    }

    window.addEventListener('resize', this.handleResize);
  };



  // Tear down and re-create the observers with fresh geometry. Skipped
  // when neither the root's height nor the resolved offset actually
  // changed (e.g. a width-only resize, or the initial ResizeObserver
  // callback right after observing).
  //
  // The destroyed check is what keeps a teardown final: dropping the
  // watcher cannot un-queue a debounce that is already waiting, so a
  // resize shortly before the unmount would otherwise land here
  // afterwards and observe() fresh observers onto the removed sentinel —
  // ones nothing would ever disconnect again.
  rebuild = () => {
    if (this.destroyed) return;

    const height = this.measureRootHeight();
    const offset = this.resolveOffset();
    if (height === this.rootHeight && offset === this.offset) return;

    this.lineObserver.disconnect();
    this.endObserver.disconnect();
    this.observe();
  };



  // Optional teardown for hosts that mount/unmount this subtree
  // repeatedly instead of doing a full page (re)load — see
  // destroyModulesInScope() in boot.js. Disconnects both observers and
  // the resize watcher, and removes the end sentinel — for a page spy
  // (no data-spy-root) that sentinel was appended to document.body,
  // outside this module's own subtree, so it would otherwise never be
  // cleaned up on unmount. Guarded throughout because construction can
  // bail out early (no IntersectionObserver, bad root, no resolvable
  // links) before any of these exist.
  destroy = () => {
    this.destroyed = true;
    this.lineObserver?.disconnect();
    this.endObserver?.disconnect();
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.handleResize);
    this.sentinel?.remove();
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'scrollSpy',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a
  // per-element, per-module flag before calling init), so no
  // extra guard is needed here.
  const instance = new ScrollSpy(el, reporter);
  return instance.destroy;
}
