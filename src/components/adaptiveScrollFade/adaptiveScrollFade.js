/**
 * adaptiveScrollFade.js
 * ----------------------------------------------------------------------------
 * Adds an adaptive fade mask to a scrollable container: whenever content is
 * hidden beyond an edge, that edge fades out to signal "there is more to
 * scroll". A container that is not (yet) overflowing shows no fade at all.
 *
 * Strategy (mirrors the accordion's CSS-state approach)
 * -----------------------------------------------------
 * No inline styles — the script only toggles two state attributes on the
 * container:
 *   - data-fade-top    -> content is hidden above the scroll position
 *   - data-fade-bottom -> content is hidden below the scroll position
 * The mask-image gradient lives entirely in the SCSS, which reacts to them.
 * Without JavaScript no attribute is set, the mask stays fully opaque and the
 * content stays readable — the fade is a pure progressive enhancement.
 *
 * Accessibility
 * -------------
 * A plain scrollable <div> is invisible to the keyboard: it cannot receive
 * focus, so arrow keys / PageUp / PageDown / Home / End / Space never reach
 * it. While the container overflows this script makes it focusable
 * (tabindex="0") and the browser handles every scroll key natively; once it
 * fits again the tabindex goes, so a box that fits is not a dead tab stop.
 * An author-set tabindex is left alone. This is the axe rule "scrollable
 * region must be keyboard accessible".
 *
 * That tab stop must be named, or screen-reader users land on it with no idea
 * what they landed on (BITV/WCAG 4.1.2). We cannot invent a meaningful name,
 * so the omission is reported once, as soon as the box becomes focusable.
 * Adding aria-label / aria-labelledby fixes it and also promotes the box to
 * role="region" — unnamed we emit no landmark rather than an unlabelled one.
 *
 * Configuration (all optional, read from the container)
 * -----------------------------------------------------
 *   - data-fade-threshold="1"          px tolerance before an edge counts as
 *                                       "reached"
 *   - style="--scrollFade-size: 40px"  fade depth (pure CSS, no JS involved)
 * ----------------------------------------------------------------------------
 */



import { rafThrottle } from './rafThrottle.js';



const defaults = {
  threshold: 1, // px tolerance before an edge counts as "reached"
  thresholdAttr: 'data-fade-threshold',
  fadeTopAttr: 'data-fade-top',
  fadeBottomAttr: 'data-fade-bottom',
};



class ScrollFade {

  constructor(container, params, reporter) {
    this.container = container;
    this.reporter = reporter;
    this.fadeTopAttr = params.fadeTopAttr;
    this.fadeBottomAttr = params.fadeBottomAttr;

    // per-instance threshold: data attribute overrides the default
    const raw = container.getAttribute(params.thresholdAttr);
    const parsed = raw !== null ? parseFloat(raw) : NaN;
    this.threshold = Number.isFinite(parsed) ? parsed : params.threshold;

    // Keyboard a11y bookkeeping. An author who manages focus keeps the
    // tabindex to themselves; otherwise we add/remove it as the box
    // starts/stops overflowing. `scrollable` starts undefined so the first
    // update() always syncs the initial state.
    this.authorControlsFocus = container.hasAttribute('tabindex');
    this.scrollable = undefined;

    // Warn at most once, the first time the box becomes focusable unnamed.
    this.warnedMissingName = false;

    // Expose the scroll area as a region only if the author supplied a name —
    // an unlabelled landmark would be noise. Never clobber an author's role.
    const hasName =
      container.hasAttribute('aria-label') ||
      container.hasAttribute('aria-labelledby');
    if (hasName && !container.hasAttribute('role')) {
      container.setAttribute('role', 'region');
    }

    // collapse bursts of scroll/resize events into one update per paint frame
    this.requestUpdate = rafThrottle(this.update);

    this.bindEvents();
    this.update();
  }



  bindEvents = () => {
    this.container.addEventListener('scroll', this.requestUpdate, { passive: true });
    window.addEventListener('resize', this.requestUpdate);

    // Catch layout/content size changes (font swap, responsive media, …).
    // The container alone only reports its own (constrained) content box, so
    // it misses content growing *inside* a fixed height — scrollHeight
    // changes while the box does not, and the state goes stale. Hence the
    // direct children too: any reflow deeper down changes the height of the
    // child containing it, which the observer picks up.
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.requestUpdate);
      this.resizeObserver.observe(this.container);
      for (const child of this.container.children) {
        this.resizeObserver.observe(child);
      }
    }

    // Keep the observed children in sync as content is added/removed, and
    // re-sync the state on every structural change. Only direct children need
    // tracking (see above), so a shallow childList observation suffices.
    if (this.resizeObserver && 'MutationObserver' in window) {
      this.mutationObserver = new MutationObserver(this.onChildListChange);
      this.mutationObserver.observe(this.container, { childList: true });
    }
  };



  // Mirror added/removed children into the ResizeObserver so new content is
  // measured and detached nodes are dropped, then re-run update() for the
  // size change the mutation itself may have caused.
  onChildListChange = (records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) this.resizeObserver.observe(node);
      }
      for (const node of record.removedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) this.resizeObserver.unobserve(node);
      }
    }
    this.requestUpdate();
  };



  // Fade an edge only while content is still beyond it. This flips the state
  // attributes; the SCSS turns them into the mask.
  update = () => {
    const { scrollTop, scrollHeight, clientHeight } = this.container;

    const fadeTop = scrollTop > this.threshold;
    const fadeBottom = scrollTop + clientHeight < scrollHeight - this.threshold;

    this.container.toggleAttribute(this.fadeTopAttr, fadeTop);
    this.container.toggleAttribute(this.fadeBottomAttr, fadeBottom);

    // Same overflow test the fade uses: if either edge can fade, there is
    // hidden content, i.e. the box is scrollable and needs keyboard access.
    const scrollable = fadeTop || fadeBottom;
    this.syncFocusability(scrollable);
    this.warnMissingName(scrollable);
  };



  // Enforce the accessible name (BITV/WCAG 4.1.2) — see the file header. The
  // attributes are re-read live (an author may set the name after init), and
  // we warn once, only while the box is actually focusable.
  warnMissingName = (scrollable) => {
    if (this.warnedMissingName || !scrollable) return;

    const hasName =
      this.container.hasAttribute('aria-label') ||
      this.container.hasAttribute('aria-labelledby');
    if (hasName) return;

    this.warnedMissingName = true;
    this.reporter?.report(
      'adaptiveScrollFade',
      'scrollable box is keyboard focusable but has no accessible name; add ' +
      'aria-label or aria-labelledby so screen-reader users know what the ' +
      'scroll region contains (required for WCAG 4.1.2).',
      this.container
    );
  };



  // A tab stop only while the box overflows, so keyboard users get the arrow
  // and paging keys the browser wires up for free.
  syncFocusability = (scrollable) => {
    if (this.authorControlsFocus) return;
    if (scrollable === this.scrollable) return; // no state change, nothing to do
    this.scrollable = scrollable;

    if (scrollable) {
      this.container.setAttribute('tabindex', '0');
      return;
    }

    // Never yank the tabindex out from under a user focused here — their
    // focus would vanish mid-interaction (e.g. a resize that briefly makes
    // the box fit). Drop it once focus has moved on.
    if (this.container === document.activeElement) return;
    this.container.removeAttribute('tabindex');
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly
  // — see destroyModulesInScope() in boot.js. The scroll listener dies with
  // the container, but the window resize listener and both observers outlive
  // it unless stopped here.
  destroy = () => {
    this.container.removeEventListener('scroll', this.requestUpdate);
    window.removeEventListener('resize', this.requestUpdate);
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'adaptiveScrollFade',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new ScrollFade(el, defaults, reporter);
  return instance.destroy;
}
