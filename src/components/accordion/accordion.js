/**
 * accordion.js
 * ----------------------------------------------------------------------------
 * Progressive-enhancement script for animated <details> accordions: it adds a
 * smooth open/close height animation on top of native <details>, without
 * taking over any of the base behaviour.
 *
 * What works without this script
 * ------------------------------
 * The base functionality (open/close, aria-expanded, single-open grouping via
 * the name attribute) already works without any JavaScript. This script only
 * adds the smooth height animation for browsers that do not yet support
 * ::details-content + interpolate-size (currently e.g. Firefox and Safari) —
 * so the animation is a pure progressive enhancement.
 *
 * Strategy
 * --------
 * 1. Feature detection: if the browser supports the modern native solution,
 *    the script does nothing and CSS handles the animation fully.
 *
 * 2. Otherwise the panel content is wrapped in an extra element and animated
 *    via CSS Grid (grid-template-rows: 0fr <-> 1fr). The click on <summary>
 *    is intercepted (preventDefault) so we fully control the open/close:
 *      - opening simply sets 'open'; CSS animates 0fr -> 1fr.
 *      - closing sets a 'data-closing' state attribute — a pure CSS state
 *        toggle (grid-template-rows -> 0fr), exactly like toggling a class.
 *        'open' stays set so the 1fr -> 0fr transition can run, and is only
 *        removed once it ends.
 *    We deliberately do NOT touch inline styles / requestAnimationFrame for
 *    the animation (that caused a stutter), and do NOT listen to 'toggle'
 *    (modifying 'open' from there would create a feedback loop).
 *
 * 3. Grouping (single-open) is taken over by JS as well. Native grouping via
 *    the 'name' attribute makes the browser close the open sibling *instantly*
 *    by removing its 'open' attribute -> the sibling's content is hidden at
 *    once and it snaps shut without any animation (and is left in a broken
 *    state for later toggles). Since the browser enforces exclusivity by
 *    removing 'open' immediately, the outgoing panel cannot be animated while
 *    the 'name' attribute is present. We therefore drop the native 'name' in
 *    the fallback and animate-close the open sibling(s) ourselves. Both panels
 *    may then be 'open' at the same moment, so the outgoing one collapses
 *    (1fr -> 0fr) while the incoming one expands (0fr -> 1fr).
 * ----------------------------------------------------------------------------
 */



const defaults = {
  itemSelector: '[data-accordion-item]',
  panelSelector: '[data-accordion-panel]',
  wrapperAttr: 'data-accordion-wrapper',
  clipAttr: 'data-accordion-clip',
  enhancedAttr: 'data-js-enhanced',
};



/**
 * Checks whether the browser already supports the modern native
 * animation (::details-content + interpolate-size).
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
    this.enhancedAttr = params.enhancedAttr;

    this.enhance();
  }



  // wraps every item in the container so it can be animated
  enhance = () => {
    this.container.setAttribute(this.enhancedAttr, '');

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
    // The clip MUST be padding-free: a grid item's border box cannot
    // shrink below its own padding, so padding on the collapsing item
    // would leave a residual "half line" at the end of the close. The
    // panel keeps its padding safely inside the clip, where it is simply
    // clipped away.
    const wrapper = document.createElement('div');
    wrapper.setAttribute(this.wrapperAttr, '');
    const clip = document.createElement('div');
    clip.setAttribute(this.clipAttr, '');

    panel.parentNode.insertBefore(wrapper, panel);
    wrapper.appendChild(clip);
    clip.appendChild(panel);

    // Take over grouping ourselves: remember the group name, then drop
    // the native 'name' so the browser no longer closes siblings
    // instantly (which would bypass our animation). We enforce
    // single-open in JS below.
    const group = details.getAttribute('name');
    if (group) details.removeAttribute('name');

    const record = { details, wrapper, group, isAnimating: false };
    this.records.push(record);

    // We take over the native toggling entirely: preventDefault stops
    // the browser from flipping 'open' itself, so no 'toggle' feedback
    // loop can occur. Works for mouse and keyboard (Enter/Space on a
    // <summary> dispatches a click).
    summary.addEventListener('click', (event) => {
      event.preventDefault();
      if (record.isAnimating) return;

      if (details.open) {
        record.isAnimating = true;
        this.animateClose(details, wrapper, () => { record.isAnimating = false; });
        return;
      }

      // Opening: animate-close any open sibling in the same group
      // first (see class doc), then open this one. CSS animates the
      // incoming panel 0fr -> 1fr while the sibling runs 1fr -> 0fr.
      if (group) this.closeGroupSiblings(record);
      details.open = true;
    });
  };



  // Animates the open sibling(s) of the given record closed. Only used
  // for grouped (single-open) accordions, where we drive exclusivity
  // ourselves after dropping the native 'name' attribute.
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



  // Closes an open item. Setting 'data-closing' is a pure CSS state
  // toggle (see SCSS: it forces grid-template-rows back to 0fr while
  // 'open' is still set), so the browser runs the 1fr -> 0fr transition
  // just like a class toggle would. Only once the transition ends do we
  // remove 'open'. No inline styles, no requestAnimationFrame.
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
}



// loader-compatible entry point 
// (boot.js -> mod.init(el, services))
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
  new AccordionEnhancer(el, defaults, reporter);
}
