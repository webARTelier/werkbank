/**
 * adaptiveScrollFade.js
 * ----------------------------------------------------------------------------
 * Adds an adaptive fade mask to a scrollable container: whenever content is
 * hidden beyond an edge, that edge fades out to signal "there is more to
 * scroll". A container that is not (yet) overflowing shows no fade at all.
 *
 * Strategy (mirrors the accordion's CSS-state approach)
 * -----------------------------------------------------
 * This script deliberately sets no inline styles. It only toggles two state
 * attributes on the container:
 *   - data-fade-top    -> content is hidden above the scroll position
 *   - data-fade-bottom -> content is hidden below the scroll position
 * The mask-image gradient itself lives entirely in the SCSS, which reacts to
 * these attributes. Without JavaScript no attribute is set, the CSS mask stays
 * fully opaque, and the content remains completely readable — the fade is a
 * pure progressive enhancement.
 *
 * Accessibility — keyboard operability
 * ------------------------------------
 * A plain scrollable <div> is invisible to the keyboard: it cannot receive
 * focus, so arrow keys / PageUp / PageDown / Home / End / Space never reach
 * it. Whenever the container actually overflows, this script therefore makes
 * it focusable (tabindex="0") and the browser handles all scroll keys
 * natively. Once it stops overflowing the tabindex is removed again, so a box
 * that fits is not a dead tab stop. If the author already set a tabindex, we
 * leave it alone.
 *
 * When the author gives the box an accessible name (aria-label /
 * aria-labelledby) we also promote it to role="region", so screen-reader
 * users hear what the focusable scroll area is; without a name we do not emit
 * an unlabelled landmark. This matches the axe rule "scrollable region must be
 * keyboard accessible".
 *
 * Accessibility — the accessible name is mandatory
 * ------------------------------------------------
 * A focusable scroll region without a name drops screen-reader users onto a
 * tab stop with no idea what they landed on (BITV/WCAG 4.1.2). We cannot
 * invent a meaningful name, so rather than degrade silently we report the
 * omission (once, via the reporter) as soon as the box actually becomes
 * focusable. Authors fix it by adding aria-label / aria-labelledby — which
 * also promotes the box to a named role="region".
 *
 * Configuration (all optional, read from the container)
 * -----------------------------------------------------
 *   - data-fade-threshold="1"          px tolerance before an edge counts as
 *                                       "reached"
 *   - style="--scrollFade-size: 40px"  fade depth (a plain CSS custom
 *                                       property, handled by the SCSS — no JS
 *                                       involved)
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

    // Keyboard a11y bookkeeping. If the author already manages focus we never
    // touch the tabindex; otherwise we add/remove it as the box starts/stops
    // overflowing. `scrollable` starts undefined so the first update() always
    // syncs the initial state.
    this.authorControlsFocus = container.hasAttribute('tabindex');
    this.scrollable = undefined;

    // A focusable scroll region MUST have an accessible name. We warn at most
    // once, the first time the box actually becomes focusable without one.
    this.warnedMissingName = false;

    // A focusable scroll area should tell assistive tech what it is. Only when
    // the author supplied an accessible name do we expose it as a region — an
    // unlabelled landmark would be noise. Never clobber an author-set role.
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
    // A ResizeObserver on the container alone only sees its own (constrained)
    // content box, so it misses content that grows/shrinks *inside* a fixed
    // height — the scrollHeight changes while the box stays the same size,
    // and the fade/tabindex state would go stale. We therefore also observe the
    // direct children: any reflow deeper in the tree changes the height of the
    // child that contains it, which the observer then picks up.
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.requestUpdate);
      this.resizeObserver.observe(this.container);
      for (const child of this.container.children) {
        this.resizeObserver.observe(child);
      }
    }

    // Keep the set of observed children in sync as content is added/removed,
    // and re-sync the state on every structural change. Only direct children
    // need tracking (see above), so a shallow childList observation suffices.
    if (this.resizeObserver && 'MutationObserver' in window) {
      this.mutationObserver = new MutationObserver(this.onChildListChange);
      this.mutationObserver.observe(this.container, { childList: true });
    }
  };



  // Mirror added/removed direct children into the ResizeObserver so newly
  // inserted content is measured and detached nodes are dropped, then re-run
  // update() for the size change the mutation itself may have caused.
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



  // adaptive fade: only fade an edge while there is still content beyond it.
  // We only flip the state attributes here; the SCSS turns them into the mask.
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



  // Enforce the accessible name (BITV/WCAG 4.1.2). Once the box overflows it
  // becomes a keyboard tab stop, so an unnamed box leaves screen-reader users
  // stranded. We re-read the attributes live (an author may set the name after
  // init) and warn only once, and only while the box is actually focusable.
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



  // Make the box a tab stop only while it actually overflows, so keyboard users
  // can scroll it with the arrow / paging keys the browser wires up for free.
  syncFocusability = (scrollable) => {
    if (this.authorControlsFocus) return;
    if (scrollable === this.scrollable) return; // no state change, nothing to do
    this.scrollable = scrollable;

    if (scrollable) {
      this.container.setAttribute('tabindex', '0');
      return;
    }

    // Don't yank the tabindex out from under a user who is focused here; drop
    // it only once focus has moved on. Otherwise their focus would vanish
    // mid-interaction (e.g. a resize that briefly makes the box fit).
    if (this.container === document.activeElement) return;
    this.container.removeAttribute('tabindex');
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
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
  new ScrollFade(el, defaults, reporter);
}
