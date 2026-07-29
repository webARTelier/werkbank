/**
 * backToTop.js
 * ----------------------------------------------------------------------------
 * A control that jumps back to the top of a long page. The jump itself
 * needs no script: an in-page anchor link IS the platform feature — the
 * browser scrolls to the top, honours `scroll-behavior` (and the
 * reduced-motion query the project guards it with) and, for a link that
 * points at a real element, hands the sequential focus navigation
 * starting point to that element, so the next Tab continues at the top of
 * the page instead of at the control.
 *
 * What the platform cannot express is WHEN that control should be on
 * screen. "Appear once the reader has left the first screen" has no
 * widely supported CSS form — scroll-driven animations come close, but
 * their support is still uneven — and the usual answer is a scroll
 * listener that measures the scroll offset on every frame.
 *
 * This module closes exactly that gap, with the sentinel pattern of
 * stickyObserver and scrollSpy:
 *   1. A zero-size, aria-hidden <div> is injected at the very top of the
 *      page content, and ONE IntersectionObserver watches it inside a
 *      region as tall as the threshold. There is no scroll listener and
 *      nothing is measured per frame: the browser reports the two moments
 *      the sentinel crosses that region's edge. The observer also fires
 *      once right after observing, so a page restored mid-scroll starts
 *      in the correct state.
 *   2. While the sentinel is inside the region — the page is scrolled
 *      less than the threshold — ONE attribute marks the control:
 *        data-backtotop-hidden -> the control must not be on screen
 *      The SCSS keys the hiding and its transition off that attribute;
 *      this script sets no inline styles and runs no animations. A
 *      second attribute, data-backtotop-ready, comes with the first
 *      state write and says nothing about the state: it only marks that
 *      the lazily loaded module has taken over, which is the one thing
 *      the hidden attribute cannot express (its absence means "visible"
 *      AND "not initialised yet"). The optional "start hidden" CSS in
 *      the readme keys off it.
 *   3. The threshold defaults to one viewport height ("the reader has
 *      left the first screen") and follows the viewport. It is baked into
 *      the observed region, so the observer is rebuilt once per
 *      (debounced) resize — the only non-observer listener this module
 *      owns. A page too short to scroll that far never shows the control
 *      at all, which is the point: there is nothing to come back from.
 *   4. Markup that cannot work is reported instead of silently enhanced:
 *      the control must be an <a> with an in-page href, and a fragment
 *      other than the document top must resolve to an element.
 *
 * The module is page-level by design. The sentinel sits in the page
 * content and the anchor jump scrolls the document, so a "back to top"
 * for an inner overflow: auto container is out of scope — it could not
 * work unenhanced either, which is where this component starts.
 *
 * Progressive enhancement: without JavaScript neither attribute is ever
 * added and the control stays what the markup already is — a plain,
 * always visible jump link, never a dead control. It is therefore also
 * visible for the moment between first paint and the lazy module taking
 * over; see the readme for the `@media (scripting: enabled)` opt-out
 * (keyed off data-backtotop-ready) for projects that prefer no flash
 * over a control that survives a broken script.
 *
 * Accessibility
 * -------------
 * The control is a real link with a real accessible name, so it is
 * reachable and operable without any ARIA — none is added. The hiding
 * happens in CSS through `visibility: hidden` (not opacity alone), which
 * takes the hidden control out of the tab order and out of the
 * accessibility tree: no invisible tab stop at the top of the page. The
 * SCSS excludes `:focus-visible` from the hidden state, so a control
 * that still holds keyboard focus is never hidden away under the user.
 * Which href form is used decides when that matters: after activating an
 * `href="#top"` by keyboard the focus stays on the control (the document
 * top is no element that could take it), and the exception keeps the
 * control on screen until Tab moves on. A fragment that resolves to an
 * element instead makes the browser take focus off the link and set the
 * sequential focus navigation starting point to that element, so the
 * next Tab continues at the top of the page and the control just fades
 * out. Scrolling up by other means is covered as well — the Home key
 * while the control has focus, for instance.
 *
 * After a MOUSE click the exception does not apply, because
 * `:focus-visible` never became true: the control is hidden while it
 * still holds DOM focus, and the browser drops that focus to the
 * document. Left as it is on purpose — nothing visible loses its focus
 * ring, and the alternatives are worse. Keying the exception off `:focus`
 * would leave the control parked on screen after every click, and
 * blurring it from a click handler would add behaviour to a module whose
 * whole point is that it adds none, to reach the state the browser
 * arrives at anyway. The recommended resolving-fragment href sidesteps
 * the case altogether.
 *
 * What this component cannot solve from the inside is being in the way of
 * the focus: fixed to a corner, it overlaps a focusable element the
 * browser parked flush against the bottom viewport edge. The readme
 * documents the `scroll-padding-block-end` that removes that partial
 * coverage (WCAG 2.4.12, AAA). Entire coverage (2.4.11, AA) needs the
 * element to sit in the band without any scroll happening, which no
 * padding can reach — that one is the page's layout.
 *
 * "Scrolled less than the threshold" is a purely visual fact: no ARIA
 * state, no live region and no announcement while scrolling. The injected
 * sentinel is empty and aria-hidden.
 *
 * Configuration (optional, read from the control)
 * -----------------------------------------------
 *   - data-backtotop-threshold="..."
 *       px the page must be scrolled before the control appears.
 *       Default: one viewport height, re-measured on resize. A `0`
 *       reveals the control as soon as the page is scrolled at all.
 * ----------------------------------------------------------------------------
 */

import { debounceThenExecute } from './debounce.js';



const defaults = {

  // attribute set on the control while the page is scrolled less than
  // the threshold; its PRESENCE is the state, and its absence is the
  // no-JS default the stylesheet starts from
  hiddenAttribute: 'data-backtotop-hidden',

  // set on the control together with the first state write: the module
  // is live. NOT a state — it is the "the script has taken over" marker
  // the optional start-hidden CSS needs, because the absence of
  // hiddenAttribute means both "visible" and "not initialised yet"
  readyAttribute: 'data-backtotop-ready',

  // marker attribute on the injected sentinel: it makes the node
  // identifiable in the inspector and is the selector the shipped SCSS
  // uses to take it out of the flow
  sentinelAttribute: 'data-backtotop-sentinel',

  // ms of resize silence before the observer is rebuilt with the
  // re-measured threshold
  rebuildDelay: 150,
};



// Decodes a URL fragment to the id it addresses. A fragment can carry
// malformed percent-encoding (e.g. '#%zz' typed into the markup), where
// decodeURIComponent throws — mapped to null here, so a broken href is
// reported instead of aborting init.
function decodeFragment(fragment) {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return null;
  }
}



class BackToTop {

  // Parse a non-negative numeric option, falling back for
  // missing/invalid values.
  static parseThreshold(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }



  // Set by destroy(), read by the debounced rebuild: the resize handler
  // can already be queued when the host unmounts, and a debounced call
  // cannot be cancelled from the outside.
  destroyed = false;



  constructor(control, reporter) {
    this.control = control;
    this.reporter = reporter;

    // Markup that could not work unenhanced is reported and left alone:
    // hiding a control that leads nowhere would only make the broken
    // wiring harder to notice.
    if (!this.checkControl()) return;

    // Very old engines without IntersectionObserver stay unenhanced —
    // the control keeps its base look and works as the jump link it
    // already is. Bail before touching the DOM so no orphaned sentinel
    // is injected.
    if (!('IntersectionObserver' in window)) return;

    this.sentinel = this.injectSentinel();
    this.observe();
    this.watchResize();
  }



  // The control must be an in-page anchor link, because the jump is the
  // native anchor behaviour: a <button> or a cross-document link would
  // leave a control that does nothing without JavaScript, and this
  // module adds no click handling that could rescue it.
  checkControl = () => {
    if (!(this.control instanceof HTMLAnchorElement)) {
      this.reporter?.report(
        'backToTop',
        'the control must be an <a> element linking to the top of the page.',
        { el: this.control }
      );
      return false;
    }

    const href = this.control.getAttribute('href') || '';
    if (!href.startsWith('#')) {
      this.reporter?.report(
        'backToTop',
        `the control needs an in-page href ('#top'), got '${href}'.`,
        { el: this.control }
      );
      return false;
    }

    return this.checkTarget(href.slice(1));
  };



  // Where the link goes stays the platform's business — only a fragment
  // that can never resolve is worth a warning. '#top' and a bare '#' are
  // the two fragments the HTML spec resolves to the top of the document
  // itself, so they need no element to point at; any other one must
  // exist, otherwise the link scrolls nowhere.
  checkTarget = (fragment) => {
    const id = decodeFragment(fragment);

    if (id === null) {
      this.reporter?.report(
        'backToTop',
        `the href fragment is not decodable: '#${fragment}'.`,
        { el: this.control }
      );
      return false;
    }

    if (id === '' || id.toLowerCase() === 'top') return true;
    if (document.getElementById(id)) return true;

    this.reporter?.report(
      'backToTop',
      `missing link target: no element with id '${id}'.`,
      { el: this.control }
    );
    return false;
  };



  // Inject the sentinel: an empty, zero-size <div> at the very top of the
  // page content. It is the one thing whose crossing of a fixed line in
  // the page can report "the reader has scrolled this far" — the control
  // itself cannot, being position: fixed and therefore motionless
  // relative to the viewport. The shipped SCSS takes the node out of the
  // flow, so it can neither occupy a flex/grid slot nor shift a layout;
  // that rule is part of the component, not decoration.
  injectSentinel = () => {
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.setAttribute(defaults.sentinelAttribute, '');
    document.body.prepend(sentinel);
    return sentinel;
  };



  // Watch the sentinel from the viewport. The positive top rootMargin
  // grows the observed region upwards by the threshold, so the sentinel
  // — which sits at scroll position 0 and travels up with the scroll —
  // leaves that region exactly when the page has been scrolled that far.
  // isIntersecting IS therefore "not scrolled far enough yet", and every
  // flip is an edge crossing the observer reports by itself, instant
  // jumps (the Home key, another anchor link) included. The sentinel can
  // never leave the region downwards: it stops at the top of the page.
  observe = () => {
    this.threshold = this.resolveThreshold();

    this.observer = new IntersectionObserver(this.handleIntersection, {
      rootMargin: `${this.threshold}px 0px 0px 0px`,
    });

    this.observer.observe(this.sentinel);
  };



  // The module's only DOM writes beside the sentinel, and idempotent
  // ones: toggleAttribute with an explicit force flag touches the
  // attribute only when the state actually changes.
  //
  // The ready marker is written HERE rather than in the constructor, and
  // after the state, so both land in the same task: a project using the
  // start-hidden CSS would otherwise get one frame in which the module
  // is "ready" but the state is not written yet — exactly the flash that
  // CSS exists to prevent.
  handleIntersection = (entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) return;

    this.control.toggleAttribute(
      defaults.hiddenAttribute, entry.isIntersecting
    );

    this.control.toggleAttribute(defaults.readyAttribute, true);
  };



  // How far the page must be scrolled before the control appears. Without
  // data-backtotop-threshold that is one viewport height — the reader has
  // left the first screen, whatever that screen happens to be — measured
  // the way the observer measures the viewport itself
  // (documentElement.clientHeight excludes a horizontal scrollbar, just
  // like the observer's own rootBounds). Re-resolved on every (re)build,
  // so a rotated phone gets its new height with the resize.
  resolveThreshold = () => {
    const fallback = document.documentElement.clientHeight;

    const attribute = this.control.dataset.backtotopThreshold;
    if (attribute === undefined) return fallback;

    return BackToTop.parseThreshold(attribute, fallback);
  };



  // The threshold is baked into the observed region, so a resize that
  // changes it (the default follows the viewport height) needs a new
  // observer. The viewport is this module's only root, so one debounced
  // window listener is enough — no ResizeObserver.
  watchResize = () => {
    this.handleResize =
      debounceThenExecute(this.rebuild, defaults.rebuildDelay);

    window.addEventListener('resize', this.handleResize);
  };



  // Tear down and re-create the observer with the re-measured threshold.
  // Skipped when the threshold did not actually change — a width-only
  // resize, or any resize at all with an explicit
  // data-backtotop-threshold. Re-observing fires the initial entry
  // again, so the state is recomputed from scratch.
  //
  // The destroyed check is what keeps a teardown final: removing the
  // resize listener cannot un-queue a debounce that is already waiting,
  // so a resize shortly before the unmount would otherwise land here
  // afterwards and observe() a fresh observer onto the removed sentinel
  // — one nothing would ever disconnect again.
  rebuild = () => {
    if (this.destroyed) return;
    if (this.resolveThreshold() === this.threshold) return;

    this.observer.disconnect();
    this.observe();
  };



  // Optional teardown for hosts that mount/unmount this subtree
  // repeatedly instead of doing a full page (re)load — see
  // destroyModulesInScope() in boot.js. Disconnects the observer and the
  // resize watcher, and removes the sentinel: it was prepended to
  // document.body, outside this module's own subtree, so it would
  // otherwise never be cleaned up on unmount. Dropping both attributes
  // leaves the control in its no-JS state, so a later init starts from
  // the same baseline as a fresh page. Guarded throughout because
  // construction can bail out early (unusable markup, no
  // IntersectionObserver) before any of this exists.
  destroy = () => {
    this.destroyed = true;
    this.observer?.disconnect();
    window.removeEventListener('resize', this.handleResize);
    this.sentinel?.remove();
    this.control.removeAttribute(defaults.hiddenAttribute);
    this.control.removeAttribute(defaults.readyAttribute);
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'backToTop',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a
  // per-element, per-module flag before calling init), so no
  // extra guard is needed here.
  const instance = new BackToTop(el, reporter);
  return instance.destroy;
}
