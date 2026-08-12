/**
 * backToTop.js
 * ----------------------------------------------------------------------------
 * A control that jumps back to the top of a long page. The jump itself needs
 * no script: an in-page anchor link IS the platform feature — the browser
 * scrolls to the top, honours `scroll-behavior` (and the reduced-motion query
 * the project guards it with) and, for a link pointing at a real element,
 * hands the sequential focus navigation starting point to that element, so
 * the next Tab continues at the top of the page instead of at the control.
 *
 * What the platform cannot express is WHEN that control should be on screen.
 * "Appear once the reader has left the first screen" has no widely supported
 * CSS form — scroll-driven animations come close, but support is still uneven
 * — and the usual answer is a scroll listener measuring the offset per frame.
 *
 * This module closes exactly that gap, with the sentinel pattern of
 * stickyObserver and scrollSpy:
 *   1. A zero-size, aria-hidden <div> is injected at the very top of the page
 *      content, and ONE IntersectionObserver watches it inside a region as
 *      tall as the threshold. No scroll listener, nothing measured per frame:
 *      the browser reports the two moments the sentinel crosses that region's
 *      edge. It also fires once right after observing, so a page restored
 *      mid-scroll starts in the correct state.
 *   2. While the sentinel is inside the region — the page is scrolled less
 *      than the threshold — ONE attribute marks the control:
 *        data-backtotop-hidden -> the control must not be on screen
 *      The SCSS keys the hiding and its transition off that attribute; this
 *      script sets no inline styles and runs no animations. A second
 *      attribute, data-backtotop-ready, comes with the first state write and
 *      says nothing about the state: it marks that the lazily loaded module
 *      has taken over, which is the one thing the hidden attribute cannot
 *      express (its absence means "visible" AND "not initialised yet"). The
 *      optional "start hidden" CSS in the readme keys off it.
 *   3. The threshold defaults to one viewport height ("the reader has left
 *      the first screen") and follows the viewport. It is baked into the
 *      observed region, so the observer is rebuilt once per (debounced)
 *      resize — the only non-observer listener this module owns. A page too
 *      short to scroll that far never shows the control at all, which is the
 *      point: there is nothing to come back from.
 *   4. Markup that cannot work is reported instead of silently enhanced: the
 *      control must be an <a> with an in-page href, and a fragment other than
 *      the document top must resolve to an element.
 *
 * The module is page-level by design. The sentinel sits in the page content
 * and the anchor jump scrolls the document, so a "back to top" for an inner
 * overflow: auto container is out of scope — it could not work unenhanced
 * either, which is where this component starts.
 *
 * Progressive enhancement: without JavaScript neither attribute is ever added
 * and the control stays what the markup already is — a plain, always visible
 * jump link, never a dead control. It is therefore also visible for the
 * moment between first paint and the lazy module taking over; see the readme
 * for the `@media (scripting: enabled)` opt-out (keyed off
 * data-backtotop-ready) for projects that prefer no flash over a control that
 * survives a broken script.
 *
 * Accessibility
 * -------------
 * The control is a real link with a real accessible name, so it is reachable
 * and operable without any ARIA — none is added. The hiding happens in CSS
 * through `visibility: hidden` (not opacity alone), which takes the hidden
 * control out of the tab order and the accessibility tree: no invisible tab
 * stop at the top of the page. The SCSS excludes `:focus-visible` from the
 * hidden state, so a control still holding keyboard focus is never hidden
 * away under the user. Which href form is used decides when that matters:
 * after activating an `href="#top"` by keyboard the focus stays on the
 * control (the document top is no element that could take it), and the
 * exception keeps it on screen until Tab moves on. A fragment that resolves
 * to an element instead makes the browser take focus off the link and set the
 * sequential focus navigation starting point to that element, so the next Tab
 * continues at the top of the page and the control just fades out. Scrolling
 * up by other means is covered as well — the Home key while the control has
 * focus, for instance.
 *
 * After a MOUSE click the exception does not apply, because `:focus-visible`
 * never became true: the control is hidden while it still holds DOM focus,
 * and the browser drops that focus to the document. Left so on purpose —
 * nothing visible loses its focus ring, and the alternatives are worse.
 * Keying the exception off `:focus` would leave the control parked on screen
 * after every click, and blurring it from a click handler would add behaviour
 * to a module whose whole point is that it adds none, to reach the state the
 * browser arrives at anyway. The recommended resolving-fragment href
 * sidesteps the case altogether.
 *
 * What this component cannot solve from the inside is being in the way of the
 * focus: fixed to a corner, it overlaps a focusable element the browser
 * parked flush against the bottom viewport edge. The readme documents the
 * `scroll-padding-block-end` that removes that partial coverage (WCAG 2.4.12,
 * AAA). Entire coverage (2.4.11, AA) needs the element to sit in the band
 * without any scroll happening, which no padding can reach — that one is the
 * page's layout.
 *
 * "Scrolled less than the threshold" is a purely visual fact: no ARIA state,
 * no live region, no announcement while scrolling. The injected sentinel is
 * empty and aria-hidden.
 *
 * Configuration (optional, read from the control)
 * -----------------------------------------------
 *   - data-backtotop-threshold="..."
 *       px the page must be scrolled before the control appears. Default: one
 *       viewport height, re-measured on resize. A `0` reveals the control as
 *       soon as the page is scrolled at all.
 * ----------------------------------------------------------------------------
 */

import { debounceThenExecute } from './debounce.js';
import { decodeFragment } from './decodeFragment.js';
import { parseNonNegative } from './parseNonNegative.js';



const defaults = {

  // set on the control while the page is scrolled less than the threshold;
  // its PRESENCE is the state, its absence the no-JS default the stylesheet
  // starts from
  hiddenAttribute: 'data-backtotop-hidden',

  // set on the control together with the first state write: the module is
  // live. NOT a state — it is the "the script has settled this" marker the
  // pre-enhancement CSS keys off, because the absence of hiddenAttribute
  // means both "visible" and "not initialised yet". Also set on its own when
  // the module bails, where it means the opposite ("nothing is coming") but
  // must have the same effect: lift the pre-enhancement state (see
  // releasePreEnhancement)
  readyAttribute: 'data-backtotop-ready',

  // marker on the injected sentinel: it makes the node identifiable in the
  // inspector and is the selector the shipped SCSS uses to take it out of
  // the flow
  sentinelAttribute: 'data-backtotop-sentinel',

  // ms of resize silence before the observer is rebuilt with the re-measured
  // threshold
  rebuildDelay: 150,
};



class BackToTop {

  // Set by destroy(), read by the debounced rebuild: the resize handler can
  // already be queued when the host unmounts, and a debounced call cannot be
  // cancelled from the outside.
  destroyed = false;



  constructor(control, reporter) {
    this.control = control;
    this.reporter = reporter;

    // Markup that could not work unenhanced is reported and left alone:
    // hiding a control that leads nowhere would only make the broken wiring
    // harder to notice.
    if (!this.checkControl()) {
      this.releasePreEnhancement();
      return;
    }

    // Very old engines without IntersectionObserver stay unenhanced — the
    // control keeps its base look and works as the jump link it already is.
    // Bail before touching the DOM so no orphaned sentinel is injected.
    if (!('IntersectionObserver' in window)) {
      this.releasePreEnhancement();
      return;
    }

    this.sentinel = this.injectSentinel();
    this.observe();
    this.watchResize();
  }



  // The control must be an in-page anchor link, because the jump IS the
  // native anchor behaviour: a <button> or a cross-document link would do
  // nothing without JavaScript, and this module adds no click handling to
  // rescue it.
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



  // Where the link goes stays the platform's business — only a fragment that
  // can never resolve is worth a warning. '#top' and a bare '#' are the two
  // the HTML spec resolves to the top of the document itself, so they need no
  // element to point at; any other must exist or the link scrolls nowhere.
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



  // An empty, zero-size <div> at the very top of the page content. Its
  // crossing of a fixed line is the one thing that can report "the reader has
  // scrolled this far" — the control itself cannot, being position: fixed and
  // so motionless relative to the viewport. The shipped SCSS takes the node
  // out of the flow, so it can neither occupy a flex/grid slot nor shift a
  // layout; that rule is part of the component, not decoration.
  injectSentinel = () => {
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.setAttribute(defaults.sentinelAttribute, '');
    document.body.prepend(sentinel);
    return sentinel;
  };



  // Watch the sentinel from the viewport. The positive top rootMargin grows
  // the observed region upwards by the threshold, so the sentinel — which
  // sits at scroll position 0 and travels up with the scroll — leaves that
  // region exactly when the page has been scrolled that far. isIntersecting
  // IS therefore "not scrolled far enough yet", and every flip is an edge
  // crossing the observer reports by itself, instant jumps (the Home key,
  // another anchor link) included. The sentinel can never leave the region
  // downwards: it stops at the top of the page.
  observe = () => {
    this.threshold = this.resolveThreshold();

    this.observer = new IntersectionObserver(this.handleIntersection, {
      rootMargin: `${this.threshold}px 0px 0px 0px`,
    });

    this.observer.observe(this.sentinel);
  };



  // Called from the two bail-outs in the constructor, and the only reason the
  // ready marker is ever written without a state beside it.
  //
  // The pre-enhancement rule in backToTop.scss keeps the control off screen
  // until this module reports in, so a page load does not start with a
  // visible control and take it away again. When the module bails, nothing is
  // ever going to report in — and the bail-outs above describe a control that
  // is still there: a working jump link, or broken wiring that should be easy
  // to spot. Neither survives being left hidden, so the marker goes on and
  // the control is the one the markup authored.
  releasePreEnhancement = () => {
    this.control.toggleAttribute(defaults.readyAttribute, true);
  };



  // The module's only DOM writes beside the sentinel, and idempotent ones:
  // toggleAttribute with an explicit force flag touches the attribute only
  // when the state actually changes.
  //
  // The ready marker is written HERE rather than in the constructor, and
  // after the state, so both land in the same task: a project using the
  // start-hidden CSS would otherwise get one frame in which the module is
  // "ready" but the state is not written yet — exactly the flash that CSS
  // exists to prevent.
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
  // left the first screen, whatever that screen happens to be — measured the
  // way the observer measures the viewport itself
  // (documentElement.clientHeight excludes a horizontal scrollbar, like the
  // observer's own rootBounds). Re-resolved on every (re)build, so a rotated
  // phone gets its new height.
  resolveThreshold = () => {
    const fallback = document.documentElement.clientHeight;

    const attribute = this.control.dataset.backtotopThreshold;
    if (attribute === undefined) return fallback;

    return parseNonNegative(attribute, fallback);
  };



  // The threshold is baked into the observed region, so a resize that changes
  // it (the default follows the viewport height) needs a new observer. The
  // viewport is this module's only root, so one debounced window listener is
  // enough — no ResizeObserver.
  watchResize = () => {
    this.handleResize =
      debounceThenExecute(this.rebuild, defaults.rebuildDelay);

    window.addEventListener('resize', this.handleResize);
  };



  // Tear down and re-create the observer with the re-measured threshold.
  // Skipped when the threshold did not change — a width-only resize, or any
  // resize with an explicit data-backtotop-threshold. Re-observing fires the
  // initial entry again, so the state is recomputed from scratch.
  //
  // The destroyed check is what keeps a teardown final: removing the resize
  // listener cannot un-queue a debounce that is already waiting, so a resize
  // shortly before the unmount would otherwise land here afterwards and
  // observe() a fresh observer onto the removed sentinel — one nothing would
  // ever disconnect again.
  rebuild = () => {
    if (this.destroyed) return;
    if (this.resolveThreshold() === this.threshold) return;

    this.observer.disconnect();
    this.observe();
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly —
  // see destroyModulesInScope() in boot.js. Disconnects the observer and the
  // resize watcher, and removes the sentinel: prepended to document.body,
  // outside this module's own subtree, it would otherwise never be cleaned
  // up. Dropping both attributes leaves the control in its no-JS state, so a
  // later init starts from the same baseline as a fresh page. Guarded
  // throughout because construction can bail out early (unusable markup, no
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



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'backToTop',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new BackToTop(el, reporter);
  return instance.destroy;
}
