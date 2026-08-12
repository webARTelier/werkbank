/**
 * popover.js
 * ----------------------------------------------------------------------------
 * Companion for a native [popover] element whose placement next to its
 * trigger is done by CSS anchor positioning (see popover.scss). The platform
 * and the stylesheet carry the behaviour; this script only validates the
 * declarative wiring and back-fills the anchored placement in engines without
 * CSS anchor positioning.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * The Popover API ([popover] + popovertarget) needs no script at all: the
 * browser wires the trigger click, renders the popover in the top layer,
 * light-dismisses an auto popover (outside click / Esc) and exposes the
 * trigger's expanded state to assistive tech. On top of that, a popover
 * opened via popovertarget receives that trigger as its *implicit anchor
 * element*, so the stylesheet can place it with position-area without any
 * anchor-name wiring — and the browser re-anchors it on scroll and resize and
 * flips it at the viewport edge (position-try-fallbacks), all without
 * JavaScript.
 *
 * What this script adds
 * ---------------------
 * 1. Wiring validation: the declarative API fails silently, so the reporter
 *    warns where the element is missing the popover attribute, has no id, no
 *    trigger on the page points at it, or the placement attribute carries an
 *    unknown value.
 * 2. Anchored-placement fallback: an engine without CSS anchor positioning
 *    shows the popover centered in the viewport (the UA default) — usable,
 *    but detached from its trigger. Detected once via CSS.supports (the same
 *    condition the stylesheet tests), this script mirrors the CSS placement:
 *    it measures the trigger and the open popover, puts the popover on the
 *    configured side, flips to the opposite side when the viewport runs out
 *    of room and clamps the result to the viewport. The measured coordinates
 *    go into --popover-fallback-* custom properties (plus the is-jsAnchored
 *    state class) and are consumed by the "@supports not" block in
 *    popover.scss — the script never writes top/left itself, so appearance
 *    stays owned by the CSS. While the popover is open the position follows
 *    scroll and resize (rafThrottle collapses the bursts into one measurement
 *    per frame); the listeners are torn down on close.
 *
 * Accessibility
 * -------------
 * Nothing to add by hand: the browser maps popovertarget to the trigger's
 * expanded/collapsed state for AT. A popover is plain content in the top
 * layer and needs no role or name of its own; widget-like popovers (menus,
 * listboxes, …) get their pattern's roles in the markup instead.
 *
 * Configuration
 * -------------
 * data-popover-position="top | right | bottom | left" (optional) The side of
 *   the trigger the popover sits on; default "bottom". Read by the CSS
 *   (position-area) and by this fallback, so one attribute is the single
 *   source of truth for both. The values are physical on purpose: an anchored
 *   overlay points at a spot on the screen, not at a spot in the reading
 *   direction.
 * ----------------------------------------------------------------------------
 */



import { rafThrottle } from './rafThrottle.js';
import { getCssCustomProperty } from './getCssCustomProperty.js';



const defaults = {

  // Placement side, read from the popover element. Doubles as the CSS hook
  // (position-area in popover.scss keys on the same attribute).
  positionAttr: 'data-popover-position',

  // Side used when the attribute is absent (or carries an unknown value).
  defaultPosition: 'bottom',

  // State class set once fallback coordinates have been written; the
  // "@supports not" block in popover.scss applies them only with it, so a
  // popover is never positioned from half-initialised values.
  positionedClass: 'is-jsAnchored',

  // Custom properties carrying the measured coordinates into the CSS.
  topProp: '--popover-fallback-top',
  leftProp: '--popover-fallback-left',

  // Custom property holding the trigger→popover gap. Registered as a <length>
  // in popover.scss (@property), so its computed value always resolves to
  // pixels and can be read back as one number here.
  offsetProp: '--popover-offset',

  // Gap (px) used when that property cannot be read as a number — a project
  // whose stylesheet does not ship the token. Its own value, not the inset
  // below: the two happen to match in the shipped CSS, but one is the
  // distance to the trigger and the other the distance to the viewport edge.
  offsetFallback: 8,

  // Minimum distance (px) the fallback keeps to the viewport edges.
  viewportInset: 8,
};



// The exact condition the stylesheet tests — keep the two in sync, or script
// and CSS would disagree about who positions the popover.
const supportsAnchorPositioning =
  CSS.supports('anchor-name: --a') && CSS.supports('position-area: bottom');

const knownPositions = ['top', 'right', 'bottom', 'left'];

const oppositeOf = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};



class Popover {

  constructor(popover, config, reporter) {
    this.popover = popover;
    this.config = config;
    this.reporter = reporter;

    this.triggers = this.findTriggers();
    this.position = this.readPosition();

    // In engines with CSS anchor positioning the stylesheet does all the
    // placement — the validation above was everything this script had to do.
    if (supportsAnchorPositioning) return;
    this.setupFallback();
  }



  // The triggers referencing this popover by id. Without an id the
  // declarative API cannot address the popover at all, so that is warned as
  // an authoring error; so is a popover no trigger points at (it could still
  // be opened programmatically, hence init continues).
  findTriggers = () => {
    const id = this.popover.id;
    if (!id) {
      this.reporter?.report(
        'popover',
        'popover has no id, no popovertarget trigger can address it.',
        this.popover
      );
      return [];
    }

    const selector = `[popovertarget="${CSS.escape(id)}"]`;
    const triggers = [...document.querySelectorAll(selector)];
    if (!triggers.length) {
      this.reporter?.report(
        'popover',
        `no trigger with popovertarget="${id}" found on the page.`,
        this.popover
      );
    }
    return triggers;
  };



  readPosition = () => {
    const raw = this.popover.getAttribute(this.config.positionAttr);
    if (raw === null || raw === '') return this.config.defaultPosition;
    if (knownPositions.includes(raw)) return raw;

    this.reporter?.report(
      'popover',
      `unknown ${this.config.positionAttr} value "${raw}" — expected one ` +
      `of ${knownPositions.join(', ')}. Falling back to ` +
      `"${this.config.defaultPosition}".`,
      this.popover
    );
    return this.config.defaultPosition;
  };



  // ---- anchored-placement fallback (see file header, gap 2) --------------

  setupFallback = () => {

    // A trigger whose action is "hide" only ever closes the popover — it can
    // never be the anchor the popover opened from.
    this.anchorTriggers = this.triggers.filter((trigger) => {
      const action = trigger.getAttribute('popovertargetaction') || 'toggle';
      return action !== 'hide';
    });

    // The ToggleEvent carries no invoker in the engines this fallback
    // targets, so the last activated trigger is remembered instead (keyboard
    // activation fires click too). A popover opened programmatically via
    // showPopover() anchors to the first — and usually only — trigger.
    this.activeTrigger = this.anchorTriggers[0] ?? null;
    this.anchorTriggers.forEach((trigger) => {
      trigger.addEventListener('click', this.handleTriggerClick);
    });

    // Collapse scroll/resize bursts into one measurement per paint frame.
    this.requestReposition = rafThrottle(this.reposition);

    this.popover.addEventListener('toggle', this.handleToggle);
  };



  handleTriggerClick = (event) => {
    this.activeTrigger = event.currentTarget;
  };



  // Position on open and follow the anchor while the popover stays open; a
  // closed popover needs no listeners, so they are torn down again. The
  // capturing scroll listener also catches scrollable containers between the
  // root and the trigger (scroll events do not bubble).
  handleToggle = (event) => {
    if (event.newState === 'open') {
      this.reposition();
      window.addEventListener('resize', this.requestReposition);
      window.addEventListener('scroll', this.requestReposition, true);
      return;
    }

    window.removeEventListener('resize', this.requestReposition);
    window.removeEventListener('scroll', this.requestReposition, true);
  };



  // One read phase (trigger rect, popover size, viewport), then one write
  // phase (the two custom properties + the state class) — never interleaved,
  // so a burst of repositions cannot thrash layout.
  reposition = () => {
    const trigger = this.activeTrigger;
    if (!trigger || !this.popover.matches(':popover-open')) return;

    const anchor = trigger.getBoundingClientRect();

    // offsetWidth/-Height are layout sizes: unlike getBoundingClientRect they
    // ignore the scale of a still-running open animation, so the popover is
    // not positioned from a transiently shrunken box.
    const size = {
      width: this.popover.offsetWidth,
      height: this.popover.offsetHeight,
    };

    const gap = this.readOffset();
    const inset = this.config.viewportInset;
    const viewport = {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };

    // Mirror position-try-fallbacks: when the preferred side lacks room and
    // the opposite side has more, flip. (The room a side offers is the space
    // between the anchor edge and the viewport edge, minus gap and inset.)
    const room = {
      top: anchor.top - gap - inset,
      bottom: viewport.height - anchor.bottom - gap - inset,
      left: anchor.left - gap - inset,
      right: viewport.width - anchor.right - gap - inset,
    };
    let side = this.position;
    const needed =
      side === 'top' || side === 'bottom' ? size.height : size.width;
    if (room[side] < needed && room[oppositeOf[side]] > room[side]) {
      side = oppositeOf[side];
    }

    const coords = this.coordsFor(side, anchor, size, gap);

    // Clamp into the viewport. On the cross axis this mirrors the anchored
    // behaviour (the popover slides along the trigger); on the main axis it
    // may overlap the trigger, the least-bad option once both sides are too
    // small anyway.
    coords.left = Math.min(
      Math.max(coords.left, inset),
      viewport.width - size.width - inset
    );
    coords.top = Math.min(
      Math.max(coords.top, inset),
      viewport.height - size.height - inset
    );

    this.popover.style.setProperty(
      this.config.topProp, `${Math.round(coords.top)}px`
    );
    this.popover.style.setProperty(
      this.config.leftProp, `${Math.round(coords.left)}px`
    );
    this.popover.classList.add(this.config.positionedClass);
  };



  // Viewport coordinates for the popover on a given side of the anchor,
  // centered along the other axis — the same box position-area yields.
  coordsFor = (side, anchor, size, gap) => {
    const centeredLeft = anchor.left + (anchor.width - size.width) / 2;
    const centeredTop = anchor.top + (anchor.height - size.height) / 2;

    if (side === 'top') {
      return { top: anchor.top - gap - size.height, left: centeredLeft };
    }
    if (side === 'bottom') {
      return { top: anchor.bottom + gap, left: centeredLeft };
    }
    if (side === 'left') {
      return { top: centeredTop, left: anchor.left - gap - size.width };
    }
    return { top: centeredTop, left: anchor.right + gap };
  };



  // The gap between trigger and popover, from the same token the anchored CSS
  // uses as margin. @property registers it as a <length>, so the computed
  // value is always in px whatever unit it was set in.
  readOffset = () => {
    const raw = getCssCustomProperty(this.popover, this.config.offsetProp);
    const parsed = parseFloat(raw);
    return Number.isNaN(parsed) ? this.config.offsetFallback : parsed;
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly —
  // see destroyModulesInScope() in boot.js. A no-op in engines with native
  // CSS anchor positioning, which wire none of this; in the fallback path it
  // removes the toggle listener, the trigger click listeners and — for a
  // popover destroyed while still open — the transient window scroll/resize
  // listeners handleToggle would otherwise never get to remove.
  destroy = () => {
    if (supportsAnchorPositioning) return;

    this.popover.removeEventListener('toggle', this.handleToggle);
    this.anchorTriggers?.forEach((trigger) => {
      trigger.removeEventListener('click', this.handleTriggerClick);
    });
    window.removeEventListener('resize', this.requestReposition);
    window.removeEventListener('scroll', this.requestReposition, true);
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'popover',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  if (!el.hasAttribute('popover')) {
    reporter?.report(
      'popover',
      'element has no popover attribute — add popover (or ' +
      'popover="manual") so the browser treats it as a popover.', el
    );
    return;
  }

  // An engine without the Popover API treats the attribute as inert and
  // renders the element as normal in-flow content (the stylesheet keeps it
  // visible there, see popover.scss). The intended degradation, not an error
  // — nothing to enhance, so bail silently.
  if (!('popover' in HTMLElement.prototype)) return;

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new Popover(el, defaults, reporter);
  return instance.destroy;
}
