/**
 * accordion.js
 * ----------------------------------------------------------------------------
 * Adds a smooth open/close height animation to native <details>, without
 * taking over any of the base behaviour.
 *
 * What works without this script
 * ------------------------------
 * Open/close, aria-expanded and single-open grouping via the name attribute
 * are all native. This script only supplies the height animation for
 * browsers without ::details-content + interpolate-size (currently Firefox
 * and Safari), so the animation is a pure progressive enhancement.
 *
 * Strategy
 * --------
 * 1. Feature detection: where the native solution exists the script does
 *    nothing and CSS handles the animation on its own.
 *
 * 2. Otherwise the panel content is wrapped in an extra element and animated
 *    via CSS Grid (grid-template-rows: 0fr <-> 1fr), with the <summary>
 *    click intercepted (preventDefault) so we control open/close entirely:
 *      - opening simply sets 'open'; CSS animates 0fr -> 1fr.
 *      - closing sets a 'data-closing' state attribute — a pure CSS state
 *        toggle (grid-template-rows -> 0fr), exactly like toggling a class.
 *        'open' stays set so the 1fr -> 0fr transition can run and is
 *        removed once it ends.
 *    Deliberately no inline styles / requestAnimationFrame (that stuttered)
 *    and no 'toggle' listener (writing 'open' from there would loop).
 *
 * 3. Grouping (single-open) moves to JS as well. Native 'name' grouping
 *    makes the browser remove the open sibling's 'open' attribute
 *    *instantly*: it snaps shut unanimated and is left broken for later
 *    toggles, and no animation is possible while 'name' is present. So the
 *    fallback drops 'name' and animate-closes the open sibling(s) itself.
 *    Both panels may be 'open' at the same moment, so the outgoing one
 *    collapses (1fr -> 0fr) while the incoming one expands (0fr -> 1fr).
 * ----------------------------------------------------------------------------
 */



const defaults = {
  itemSelector: '[data-accordion-item]',
  panelSelector: '[data-accordion-panel]',
  wrapperAttr: 'data-accordion-wrapper',
  clipAttr: 'data-accordion-clip',

  // "The module has taken over." Set on the container when the fallback
  // enhancement starts; the stylesheet switches from the native animation
  // to the grid one on it. The standard ready attribute every component
  // owns (see docs/preEnhancement.md) — accordion needs no pre-enhancement
  // state of its own, since a <details> renders closed either way, but the
  // name stays the shared one.
  readyAttr: 'data-accordion-ready',
};



/**
 * Does the browser animate natively (::details-content + interpolate-size)?
 * @returns {boolean}
 */
function supportsNativeAnimation() {
  return (
    CSS.supports('interpolate-size', 'allow-keywords') &&
    CSS.supports('selector(::details-content)')
  );
}



class AccordionEnhancer {

  constructor(container, params, reporter) {
    this.container = container;
    this.reporter = reporter;
    this.itemSelector = params.itemSelector;
    this.panelSelector = params.panelSelector;
    this.wrapperAttr = params.wrapperAttr;
    this.clipAttr = params.clipAttr;
    this.readyAttr = params.readyAttr;

    this.enhance();
  }



  // wraps every item in the container so it can be animated
  enhance = () => {
    this.container.setAttribute(this.readyAttr, '');

    // Per-item records, so we can coordinate grouped (single-open)
    // behaviour ourselves instead of leaving it to the browser.
    this.records = [];

    const items = this.container.querySelectorAll(this.itemSelector);
    if (!items.length) {
      this.reporter?.report(
        'accordion',
        'no items found in container.', { el: this.container }
      );
      return;
    }

    items.forEach((item) => this.enhanceItem(item));
  };



  // adds the animation wrapper to a single <details> element and
  // intercepts the summary click to drive the animation manually
  enhanceItem = (details) => {
    const panel = details.querySelector(this.panelSelector);
    if (!panel || panel.closest('[' + this.wrapperAttr + ']')) return;

    const summary = details.querySelector('summary');
    if (!summary) return;

    // Two nested elements:
    //   wrapper -> the CSS grid that animates grid-template-rows 0fr <-> 1fr
    //   clip    -> the grid item (min-height:0, overflow:hidden, NO padding)
    // The clip MUST be padding-free: a border box cannot shrink below its
    // own padding, so padding here would leave a residual "half line" at
    // the end of the close. The panel keeps its padding inside the clip,
    // where it is simply clipped away.
    const wrapper = document.createElement('div');
    wrapper.setAttribute(this.wrapperAttr, '');
    const clip = document.createElement('div');
    clip.setAttribute(this.clipAttr, '');

    panel.parentNode.insertBefore(wrapper, panel);
    wrapper.appendChild(clip);
    clip.appendChild(panel);

    // Take grouping over: remember the group name, then drop the native
    // 'name' so the browser stops closing siblings instantly (which would
    // bypass our animation). Single-open is enforced in JS below.
    const group = details.getAttribute('name');
    if (group) details.removeAttribute('name');

    const record = { details, wrapper, group, summary, isAnimating: false };
    this.records.push(record);

    // preventDefault stops the browser from flipping 'open' itself, so no
    // 'toggle' feedback loop can occur. Works for mouse and keyboard
    // (Enter/Space on a <summary> dispatches a click). Kept on the record
    // rather than inline so destroy() can remove exactly this function.
    record.handleSummaryClick = (event) => {
      event.preventDefault();
      if (record.isAnimating) return;

      if (details.open) {
        record.isAnimating = true;
        this.animateClose(details, wrapper, () => { record.isAnimating = false; });
        return;
      }

      // Opening: animate-close any open sibling in the same group first
      // (see file header), then open this one — CSS runs both at once.
      if (group) this.closeGroupSiblings(record);
      details.open = true;
    };

    summary.addEventListener('click', record.handleSummaryClick);
  };



  // Animates the record's open sibling(s) closed. Only for grouped
  // (single-open) accordions, where we drive exclusivity ourselves after
  // dropping the native 'name' attribute.
  closeGroupSiblings = (record) => {
    this.records.forEach((other) => {
      if (other === record || other.group !== record.group) return;
      if (!other.details.open || other.isAnimating) return;

      other.isAnimating = true;
      this.animateClose(other.details, other.wrapper, () => {
        other.isAnimating = false;
      });
    });
  };



  // Closes an open item. 'data-closing' is a pure CSS state toggle (the
  // SCSS forces grid-template-rows back to 0fr while 'open' is still set),
  // so the browser runs the 1fr -> 0fr transition just like a class would.
  // 'open' comes off only once the transition ends. No inline styles.
  animateClose = (details, wrapper, onDone) => {
    const onTransitionEnd = (event) => {
      if (event.propertyName !== 'grid-template-rows') return;
      wrapper.removeEventListener('transitionend', onTransitionEnd);
      details.removeAttribute('open');
      details.removeAttribute('data-closing');
      onDone();
    };

    wrapper.addEventListener('transitionend', onTransitionEnd);
    details.setAttribute('data-closing', '');
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly
  // — see destroyModulesInScope() in boot.js. Every listener here sits
  // inside the container and dies with it; this is for the host that keeps
  // the same <details> elements (only their content changed) and would
  // otherwise accumulate one summary click listener per re-init.
  destroy = () => {
    this.records?.forEach((record) => {
      record.summary.removeEventListener('click', record.handleSummaryClick);
    });
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'accordion',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // modern browsers animate natively -> nothing to enhance
  if (supportsNativeAnimation()) return;

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new AccordionEnhancer(el, defaults, reporter);
  return instance.destroy;
}
