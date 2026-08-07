/**
 * tooltip.js
 * ----------------------------------------------------------------------------
 * A short hint about a control the reader can see but may not understand —
 * what the icon-only button does, what format the field wants. The platform
 * has an answer for this, the title attribute, and it is the reason the
 * component exists: title never appears on a touch device, appears only
 * inconsistently on keyboard focus, cannot be styled, cannot be reached with
 * the pointer, and shows up after a delay the reader cannot change. A hint
 * worth writing is worth showing to everyone, so it is written into the
 * markup instead.
 *
 * What works without this script
 * ------------------------------
 * All of the showing and hiding. The hint is authored next to its control
 * inside the component root, and tooltip.scss reveals it on :hover and on
 * :has([data-tooltip-trigger]:focus-visible) — a hint on hover and on
 * keyboard focus, placed on one of four sides, with an arrow and a fade, and
 * none of it waiting for a chunk to arrive. The first paint is already the
 * resting state, so the component ships no pre-enhancement state (see
 * docs/preEnhancement.md).
 *
 * What this script adds
 * ---------------------
 * 1. The description wiring: the hint gets an id (generated only where the
 *    author wrote none) and role="tooltip", and the control gets an
 *    aria-describedby pointing at it, added to whatever was in there
 *    already. This is the half CSS cannot do, and it is what turns a hint
 *    that is merely visible into one a screen reader reads out — which it
 *    does at every focus, not only while the bubble is on screen.
 * 2. Escape (WCAG 1.4.13, "dismissible"): a hint that covers what the reader
 *    was looking at has to go away without them having to move the pointer
 *    or the focus off the control first. Escape sets data-tooltip-dismissed
 *    on the root, which the stylesheet's show rules are guarded against; the
 *    next hover or focus clears it. A tap outside does the same, as the
 *    backstop for touch — where a tap leaves :hover standing on the control
 *    it came from, there is no pointer to move away. Escape is deliberately
 *    not swallowed: a tooltip is a passive hint, not a layer that owns the
 *    key, and a dialog underneath it must still get to close.
 *
 *    The key is watched for as long as the component lives, and the question
 *    "is a hint up?" is answered by reading the two conditions back off the
 *    DOM (see isShown) rather than from a flag this module kept. Both are
 *    the same lesson: the stylesheet shows the hint, so the stylesheet is
 *    the truth, and it can start showing one from a state change no event
 *    reports. :focus-visible turning on after a click — the reader clicked
 *    the control, then touched the keyboard — is the common one; a pointer
 *    already resting on the trigger when the chunk arrives is the other. A
 *    module that mirrors the state instead of reading it believes no hint
 *    is up in both cases, and then Escape does nothing while the reader is
 *    looking at one. Worse, on the first of the two the keystroke that was
 *    meant to dismiss the hint is the very thing that turns :focus-visible
 *    on, so Escape *opens* it.
 * 3. Putting the bubble where the stylesheet cannot. Without a measurement
 *    a hint can only be centred on the element it is positioned in and left
 *    there, and that is wrong twice: against the edge of the viewport it
 *    hangs off the screen, and on a root wider than its control (a hint on
 *    a full-width field) it is centred on the wrong thing. The result is
 *    written as data-tooltip-flipped (the preferred side had no room, use
 *    the opposite one), --tooltip-shift (how far the bubble moves) and
 *    --tooltip-arrow-shift (how far the arrow moves back, so it keeps
 *    pointing at the control), all three consumed by tooltip.scss — the
 *    script never writes a coordinate itself, so appearance stays owned by
 *    the CSS.
 *
 *    Every hint is measured, not only the one on screen: the bubble is
 *    hidden with visibility rather than display, so it is a real box in the
 *    layout at all times, and an absolutely positioned one at that. Left at
 *    its unmeasured resting position — centred on its root — a hint on a
 *    control near the right edge of a narrow window reaches past the
 *    viewport and puts a horizontal scrollbar under the whole page before
 *    anyone has hovered anything (WCAG 1.4.10, "reflow"). So the first
 *    measurement happens at init, every hint is re-measured on resize and
 *    again once a webfont has swapped in — which changes how wide every
 *    hint wants to be and announces itself through no event of its own;
 *    only following the page as it scrolls is reserved for the hint that is
 *    actually up. All of it is collapsed into one pass per frame by
 *    rafThrottle, and that pass reads every hint before it writes to any of
 *    them, so a page full of tooltips costs one layout instead of one each.
 *
 *    One kind of hint has to be read twice. The width bound is itself a
 *    measured value, so a hint it actually narrows wraps into more lines
 *    *after* it has been written, and the height taken before that is the
 *    height of a box that no longer exists. The centring survives it — the
 *    height cancels out of that sum — but the clamp against the viewport
 *    edge does not, and a long hint beside its control is then left hanging
 *    past the bottom of the window. So a hint whose width the bound changed
 *    is read a second time once it has been applied, and only that hint:
 *    the extra pass costs a layout, and everywhere else the first read was
 *    already right. Applying a shift cannot change a height, so one
 *    correction is always enough.
 * 4. Warnings about the three ways this markup goes quietly wrong: a trigger
 *    the keyboard cannot reach, a title attribute doubling the hint with the
 *    browser's own, and a focusable element inside the bubble — content
 *    nobody can reach, because a tooltip is never focused.
 *
 * Accessibility
 * -------------
 * A tooltip describes; it never *is* the information. Anything the reader
 * must have belongs in the page, and anything they must interact with
 * belongs in a popover — a tooltip is not focusable, has no way to be
 * opened from the keyboard other than focusing its control, and is gone the
 * moment that focus moves.
 *
 * The hint is hidden with visibility, not display, and that is a deliberate
 * accessibility choice as much as a layout one: a node that aria-describedby
 * points at directly contributes its text whether it is visible or not, so
 * the description reaches a screen reader on focus even before the bubble
 * has faded in — and it reaches one that never renders the bubble at all.
 *
 * The trigger has to be a real control (a button, a link, a field). A hint
 * hung on a <span> is a hint no keyboard reaches, which is why that case is
 * reported rather than patched with a tabindex: an element made focusable
 * without being operable is a worse tab stop than none.
 *
 * Configuration
 * -------------
 * On the component root (data-js-behavior="tooltip"):
 * - data-tooltip-position="top | right | bottom | left"  (optional)
 *     The side of the trigger the hint sits on; default "top". Read by the
 *     CSS and by the measurement here alike, so one attribute is the single
 *     source of truth for both. The values are physical on purpose: a hint
 *     points at a spot on the screen, not at a spot in the reading order.
 *
 * Inside it, both required and both plain markers, not style classes:
 * - data-tooltip-trigger    the control being described
 * - data-tooltip-bubble     the hint
 * ----------------------------------------------------------------------------
 */



import { rafThrottle } from './rafThrottle.js';
import { getCssCustomProperty } from './getCssCustomProperty.js';
import { focusableSelector } from './focusableSelector.js';
import { uniqueId } from './uniqueId.js';
import { addDescribedBy, removeDescribedBy } from './describedBy.js';



const defaults = {

  // The two parts, marked in the markup. Data attributes rather than the
  // m-tooltip__* classes, so the styling stays free to change.
  triggerSelector: '[data-tooltip-trigger]',
  bubbleSelector: '[data-tooltip-bubble]',

  // Preferred side, read from the component root. Doubles as the CSS hook —
  // the placement rules in tooltip.scss key on the same attribute.
  positionAttr: 'data-tooltip-position',

  // Side used when the attribute is absent (or carries an unknown value).
  defaultPosition: 'top',

  // Written on the root when the preferred side has no room; the stylesheet
  // then renders the hint on the opposite side.
  flippedAttr: 'data-tooltip-flipped',

  // Written on the root by Escape (and by a tap outside). The stylesheet's
  // show rules are guarded against it, so the hint goes without the reader
  // having to move the pointer off the control first.
  dismissedAttr: 'data-tooltip-dismissed',

  // Custom properties carrying the two measured corrections into the CSS:
  // how far the bubble moves from where the stylesheet put it, and how far
  // the arrow then sits from the middle of the bubble. Both are declared as
  // 0px in tooltip.scss, so the placement resolves with or without this
  // module.
  shiftProp: '--tooltip-shift',
  arrowShiftProp: '--tooltip-arrow-shift',

  // How much horizontal room the hint's side actually offers. Joins the
  // max-inline-size in tooltip.scss as a third bound, and it is what a
  // sideways hint needs: the shift can slide a hint along its control, but
  // nothing can slide a bubble that is wider than the gap between its
  // control and the edge of the window. 100vw in the stylesheet, so the
  // bound does nothing until it has been measured.
  availableProp: '--tooltip-available',

  // Custom property holding the trigger -> bubble gap. Registered as a
  // <length> in tooltip.scss (@property), so its computed value always
  // resolves to pixels and can be read back as one number here.
  offsetProp: '--tooltip-offset',

  // Gap (px) used when that property cannot be read as a number — a project
  // whose stylesheet does not ship the token. Its own value, not the inset
  // below: the two happen to match in the shipped CSS, but one is the
  // distance to the trigger and the other the distance to the viewport edge.
  offsetFallback: 8,

  // Minimum distance (px) the hint keeps to the viewport edges.
  viewportInset: 8,

  // Prefix for the id generated for a hint the author did not name.
  idPrefix: 'tooltip',
};



const knownPositions = ['top', 'right', 'bottom', 'left'];

const oppositeOf = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};



// ---- what every tooltip on the page shares -------------------------------
//
// Three listeners that cannot belong to a single instance. Escape and a tap
// outside have to reach a hint this module never saw appear (see isShown), so
// they cannot be hung on the showing and have to exist as long as any tooltip
// does. Resize concerns every hint rather than the one on screen, for the
// reason in the header. And a page can carry dozens of tooltips, which would
// otherwise be dozens of listeners all asking the same question of the same
// event — so there is one of each, and a set of who wants the answer.

const liveTooltips = new Set();



// One pass for all of them, in the same phases a single tooltip goes
// through (see reposition): relax every hint, then read every hint, then
// write to every hint. Interleaving read and write would make each
// instance's write invalidate the next instance's read, turning one layout
// into one per tooltip. Nothing is painted in between — the browser gets to
// the screen only once this whole pass has returned — so the relaxed state
// is never visible.
//
// The correction after it is that shape once more, and it runs only for the
// hints that asked for it: the ones whose width the bound just written
// actually changed, which is what makes the height the read above took
// stale (see measure). Where no hint did, the write above is the last thing
// to happen and no second layout is forced.
const repositionAll = rafThrottle(() => {
  liveTooltips.forEach((tooltip) => tooltip.relax());

  const pending = [];
  liveTooltips.forEach((tooltip) => pending.push([tooltip, tooltip.measure()]));
  pending.forEach(([tooltip, measurement]) => tooltip.apply(measurement));

  const refining = pending.filter(([, measurement]) => measurement.refine);
  if (!refining.length) return;

  const corrections = refining.map(([tooltip, measurement]) =>
    [tooltip, tooltip.measureCross(measurement.alongBlock)]
  );
  corrections.forEach(([tooltip, cross]) => tooltip.applyCross(cross));
});



// A keystroke is also how :focus-visible turns on for a control that was
// clicked, and that is a change no event reports — so the hint owning the
// focus re-reads itself here, before Escape asks whether it is up. Without
// that, the first Escape on a clicked control would show the hint (the
// keystroke switches the engine to keyboard modality) instead of taking it
// away, and no later Escape would reach it either.
function handleDocumentKeydown(event) {
  liveTooltips.forEach((tooltip) => {
    if (tooltip.root.contains(document.activeElement)) tooltip.sync();
  });

  // Not preventDefault()ed and not stopped: the hint takes itself away, but
  // a dialog or a native popover underneath it still gets the same Escape.
  // A tooltip is a passive hint, not a layer that owns the key.
  if (event.key !== 'Escape') return;
  liveTooltips.forEach((tooltip) => tooltip.dismissIfShown());
}



// The backstop for touch. Most engines drop the hover state of the last
// element tapped as soon as something else is, and then pointerleave has
// already taken the hint away — but where one does not, a tap has no "leave"
// to offer and nothing else would. Capturing, so a handler on the way that
// stops the event cannot keep a hint standing.
function handleDocumentPointerDown(event) {
  liveTooltips.forEach((tooltip) => {
    if (!tooltip.root.contains(event.target)) tooltip.dismissIfShown();
  });
}



function registerTooltip(tooltip) {
  if (!liveTooltips.size) {
    document.addEventListener('keydown', handleDocumentKeydown);
    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    window.addEventListener('resize', repositionAll);
  }

  liveTooltips.add(tooltip);
}



function unregisterTooltip(tooltip) {
  liveTooltips.delete(tooltip);
  if (liveTooltips.size) return;

  document.removeEventListener('keydown', handleDocumentKeydown);
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  window.removeEventListener('resize', repositionAll);
}



class Tooltip {

  constructor(root, trigger, bubble, config, reporter) {
    this.root = root;
    this.trigger = trigger;
    this.bubble = bubble;
    this.config = config;
    this.reporter = reporter;

    // Whether a hint was up the last time this instance looked. Not the
    // state itself — isShown() reads that off the DOM — only the record of
    // what the transient scroll listener was last set up for.
    this.shown = false;

    // The last values written to the two shift properties. The first is
    // kept because subtracting it from the bubble's measured box is what
    // gives back the position the stylesheet put it in — the fixed point
    // every measurement starts from; the second so that a measurement that
    // leaves the cross axis alone can hand it back untouched.
    this.shift = 0;
    this.arrowShift = 0;

    this.position = this.readPosition();
    this.reportAuthoringProblems();
    this.connectDescription();

    // Collapse scroll bursts into one measurement per paint frame.
    this.requestReposition = rafThrottle(this.reposition);

    this.root.addEventListener('pointerenter', this.handlePointerEnter);
    this.root.addEventListener('pointerleave', this.handlePointerLeave);
    this.root.addEventListener('focusin', this.handleFocusIn);
    this.root.addEventListener('focusout', this.handleFocusOut);

    registerTooltip(this);

    // Place the hint before it is ever asked for: hidden or not it is a box
    // in the layout, and an unmeasured one can hang past the edge of the
    // window (see the header). Through the shared pass rather than directly,
    // so a page with a dozen tooltips — whose modules are all constructed in
    // the same frame — pays for one layout instead of a dozen.
    repositionAll();

    // And once more when a webfont swaps in. The measurement above was taken
    // in the fallback face, and a different face gives every hint a
    // different width — the number both the width bound and the shift are
    // computed from, and the one that decides whether a hint reaches past
    // the edge of the window. Nothing reports the swap as an event, so the
    // promise is the trigger (as in marquee and flexNeighborMarker).
    document.fonts?.ready.then(repositionAll).catch(() => {});

    // And this catches the case where the pointer was already resting on the
    // trigger while the chunk loaded: pointerenter has fired long ago and is
    // never coming, so nothing else would notice that a hint is up.
    this.sync();
  }



  readPosition = () => {
    const raw = this.root.getAttribute(this.config.positionAttr);
    if (raw === null || raw === '') return this.config.defaultPosition;
    if (knownPositions.includes(raw)) return raw;

    this.reporter?.report(
      'tooltip',
      `unknown ${this.config.positionAttr} value "${raw}" — expected one ` +
      `of ${knownPositions.join(', ')}. Falling back to ` +
      `"${this.config.defaultPosition}".`,
      this.root
    );
    return this.config.defaultPosition;
  };



  // The three ways this markup is quietly wrong. None of them is fatal — the
  // hint still shows on hover — so each is reported and nothing is patched:
  // a tabindex on a non-control would create a tab stop that does nothing,
  // and removing an author's title attribute would throw away text.
  reportAuthoringProblems = () => {
    if (!this.trigger.matches(focusableSelector)) {
      this.reporter?.report(
        'tooltip',
        'the trigger cannot receive keyboard focus, so the hint is ' +
        'reachable by pointer only. Mark the control itself (button, link, ' +
        'field) as the trigger rather than a wrapper around it.',
        this.trigger
      );
    }

    if (this.trigger.hasAttribute('title')) {
      this.reporter?.report(
        'tooltip',
        'the trigger also carries a title attribute — the browser will ' +
        'show its own tooltip next to this one. Move the text into the ' +
        'hint and drop the attribute.',
        this.trigger
      );
    }

    if (this.bubble.querySelector(focusableSelector)) {
      this.reporter?.report(
        'tooltip',
        'the hint contains a focusable element, which nobody can reach: a ' +
        'tooltip is never focused and closes as soon as the trigger loses ' +
        'the focus. Use the popover component for content to interact with.',
        this.bubble
      );
    }
  };



  // Links the hint to its control. The id is generated only where the author
  // wrote none, and aria-describedby is extended rather than assigned — the
  // control may already point at a format hint or at another module's node.
  connectDescription = () => {
    this.roleWasGenerated = !this.bubble.hasAttribute('role');
    if (this.roleWasGenerated) this.bubble.setAttribute('role', 'tooltip');

    this.idWasGenerated = !this.bubble.id;
    if (this.idWasGenerated) this.bubble.id = uniqueId(this.config.idPrefix);

    addDescribedBy(this.trigger, this.bubble.id);
  };



  // ---- is a hint up? -----------------------------------------------------

  // The one question everything below asks, and it is put to the DOM rather
  // than to a flag: these are exactly the two conditions tooltip.scss shows
  // the bubble on, guarded by the same attribute, so the answer cannot drift
  // from what the reader is looking at. `:has([data-tooltip-trigger]:
  // focus-visible)` on the root and `:focus-visible` on the trigger are the
  // same test — the trigger is the only thing that selector can match.
  isShown = () =>
    !this.root.hasAttribute(this.config.dismissedAttr) &&
    (this.root.matches(':hover') || this.trigger.matches(':focus-visible'));



  // ---- the two ways a hint is asked for ----------------------------------

  // Entering is also what forgets an earlier dismissal: coming back to a
  // control is a fresh request for its hint. Leaving is not, and neither is
  // anything else — the attribute has to survive for as long as the reader
  // stays where they were when they pressed Escape.
  handlePointerEnter = () => {
    this.root.removeAttribute(this.config.dismissedAttr);
    this.sync();
  };



  handlePointerLeave = () => {
    this.sync();
  };



  handleFocusIn = (event) => {

    // Mirror the stylesheet, which shows the hint for :focus-visible only.
    // This guard is about the dismissal above, not about the showing: a
    // control that was merely clicked already has the pointer on it, and
    // reviving a hint the reader just pressed Escape on would undo that.
    if (!event.target.matches(':focus-visible')) return;
    this.root.removeAttribute(this.config.dismissedAttr);
    this.sync();
  };



  // focusout fires before anything else is focused, so by now the trigger
  // has already stopped matching :focus-visible and isShown() reads true
  // only if the pointer is keeping the hint up on its own.
  handleFocusOut = () => {
    this.sync();
  };



  // A hint that is up follows the page as it scrolls; one that is not needs
  // no listener, so it exists exactly as long as the hint does. Resize is
  // not here — every hint is measured for that, up or not (see the header).
  sync = () => {
    const shown = this.isShown();
    if (shown === this.shown) return;
    this.shown = shown;

    if (!shown) {
      this.releaseTransientListeners();
      return;
    }

    this.reposition();

    // Capturing, so scrollable containers between the root and the trigger
    // are caught too (scroll events do not bubble).
    window.addEventListener('scroll', this.requestReposition, true);
  };



  releaseTransientListeners = () => {
    window.removeEventListener('scroll', this.requestReposition, true);
  };



  // ---- dismissal (WCAG 1.4.13) -------------------------------------------

  // Called for every instance by the shared Escape and tap-outside handlers,
  // so it decides for itself whether it has anything to take away. Asking
  // isShown() rather than a flag is the whole point: a hint the stylesheet
  // put up on its own is dismissible here just the same.
  dismissIfShown = () => {
    if (!this.isShown()) return;
    this.dismiss();
  };



  // The attribute stays until the next hover or focus (see the handlers
  // above): the point of "dismissible" is that the hint goes while the
  // pointer is still on the control, so clearing it on the way out would be
  // too early.
  dismiss = () => {
    this.root.setAttribute(this.config.dismissedAttr, '');

    this.shown = false;
    this.releaseTransientListeners();
  };



  // ---- keeping the hint on screen ----------------------------------------

  // One read phase (trigger rect, bubble box, viewport), then one write
  // phase (the flip attribute, the width bound and the two shift
  // properties) — never interleaved, so a burst of scroll events cannot
  // thrash layout. The two are separate methods rather than one, because
  // repositionAll() runs the read phase of every tooltip on the page before
  // the write phase of any of them. Every write is idempotent and computed
  // from the authored side rather than from the rendered one, so repeating
  // the measurement cannot walk the hint from side to side.
  //
  // The pair repeats where the width bound changed the bubble's width: the
  // height the first read took is then the height of a box that no longer
  // exists, and the cross axis has to be computed again from a fresh one.
  reposition = () => {
    this.relax();

    const measurement = this.measure();
    this.apply(measurement);
    if (!measurement.refine) return;

    this.applyCross(this.measureCross(measurement.alongBlock));
  };



  // Phase one: take last measurement's width bound off again. The bound is
  // set from the room the hint's side has, so leaving it on would make the
  // bubble measure exactly as wide as that room — and the flip below asks
  // whether the room is smaller than the bubble, which would then never
  // again be true. A hint squeezed against one edge would sit there for
  // good instead of moving to the side that has space. So every measurement
  // starts from the width the hint would like to have.
  relax = () => {
    this.root.style.setProperty(this.config.availableProp, '100vw');
  };



  measure = () => {
    const anchor = this.trigger.getBoundingClientRect();

    // offsetWidth/-Height are layout sizes: unlike getBoundingClientRect
    // they ignore the translate the placement uses, so the bubble is
    // measured as the box it will occupy, not as the one it occupies now.
    const size = {
      width: this.bubble.offsetWidth,
      height: this.bubble.offsetHeight,
    };

    const gap = this.readOffset();
    const inset = this.config.viewportInset;
    const viewport = {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };

    // The room a side offers is the space between the trigger's edge and the
    // viewport edge, minus the gap and the inset. Flip only when the
    // preferred side cannot hold the hint and the opposite one has more —
    // two cramped sides are not a reason to move.
    const room = {
      top: anchor.top - gap - inset,
      bottom: viewport.height - anchor.bottom - gap - inset,
      left: anchor.left - gap - inset,
      right: viewport.width - anchor.right - gap - inset,
    };

    const side = this.position;
    const alongBlock = side === 'top' || side === 'bottom';
    const needed = alongBlock ? size.height : size.width;
    const flipped =
      room[side] < needed && room[oppositeOf[side]] > room[side];
    const resolved = flipped ? oppositeOf[side] : side;

    // How wide the hint may be before it reaches out of the window. A hint
    // above or below its control is centred and then slid, so it has the
    // whole window to work with; one beside its control has only what is
    // left between that control and the edge, and no amount of sliding
    // changes that — the slide is on the other axis. This is the bound that
    // keeps a sideways hint out of the page's scroll region, and it is
    // measured for hints that are not on screen too, because a hidden
    // bubble is a box like any other (see the header).
    const available = alongBlock
      ? viewport.width - inset * 2
      : Math.max(room[resolved], 0);

    // Whether this hint needs the second read: the bound about to be written
    // is narrower than the width the bubble was just measured at, so it will
    // wrap into more lines and the height read above describes a box that is
    // about to stop existing. Everything the cross axis does with a height
    // is wrong from there on — see reposition.
    const refine = available < size.width;

    // The cross-axis correction is only worth having for a hint that is up,
    // or for one whose cross axis is the horizontal one — those are the two
    // cases it can change something. Clamping a sideways hint that nobody
    // is looking at would mean dragging a bubble three screens down the
    // page up into the viewport, which buys nothing (a box pulled *inside*
    // the window cannot lengthen the page) and leaves a nonsense shift on
    // an element until the reader reaches it. With the cross axis skipped
    // there is nothing left for a second read to correct either.
    if (!alongBlock && !this.isShown()) {
      return {
        flipped,
        available,
        alongBlock,
        refine: false,
        shift: this.shift,
        arrowShift: this.arrowShift,
      };
    }

    return {
      flipped,
      available,
      alongBlock,
      refine,
      ...this.measureCross(alongBlock),
    };
  };



  // The correction along the axis the hint is free on: how far the bubble
  // has to move from where the stylesheet put it in order to sit over its
  // control and stay inside the viewport, and how far the arrow then sits
  // from the middle of the bubble so it keeps pointing at that control.
  //
  // Everything here is one line of arithmetic per case, so the two axes are
  // folded into one set of numbers rather than into two copies of the code.
  // `base` is where the stylesheet put the bubble on its own — the flip
  // does not touch the cross axis, so it is the same number before and
  // after one. The geometry is read here rather than handed in, because
  // this runs a second time for a hint the width bound narrowed, and the
  // point of that pass is that the box has changed since.
  measureCross = (alongBlock) => {
    const anchor = this.trigger.getBoundingClientRect();
    const placed = this.bubble.getBoundingClientRect();

    const center = alongBlock
      ? anchor.left + anchor.width / 2
      : anchor.top + anchor.height / 2;
    const length = alongBlock
      ? this.bubble.offsetWidth
      : this.bubble.offsetHeight;
    const limit = alongBlock
      ? document.documentElement.clientWidth
      : document.documentElement.clientHeight;
    const base = (alongBlock ? placed.left : placed.top) - this.shift;

    // Centred on the trigger — which is not the same as centred on the
    // component root once the root is wider than its control (a hint on a
    // full-width field) — and then pushed back inside the viewport.
    const wanted = this.intoViewport(center - length / 2, length, limit);

    const shift = Math.round(wanted - base);

    // The arrow's distance from the middle of the bubble: whatever is left
    // between the trigger's centre and the bubble's, once the bubble has
    // moved. Zero whenever the hint sits centred on its control.
    const arrowShift = Math.round(center - (base + shift) - length / 2);

    return { shift, arrowShift };
  };



  apply = ({ flipped, available, shift, arrowShift }) => {
    this.root.toggleAttribute(this.config.flippedAttr, flipped);
    this.root.style.setProperty(
      this.config.availableProp, `${Math.round(available)}px`
    );

    this.applyCross({ shift, arrowShift });
  };



  // The cross-axis half of the write on its own: it is all the correction
  // pass has to put back, and it is what the pass before it got wrong.
  applyCross = ({ shift, arrowShift }) => {
    this.root.style.setProperty(this.config.shiftProp, `${shift}px`);
    this.root.style.setProperty(
      this.config.arrowShiftProp, `${arrowShift}px`
    );

    this.shift = shift;
    this.arrowShift = arrowShift;
  };



  // Pushes a box of the given length back inside the viewport, never by
  // more than its overflow, so a hint stays as close to its control as it
  // can. A bubble longer than the viewport is pinned to the leading edge:
  // with nowhere to fit, the readable end is the one the text starts at.
  intoViewport = (start, length, viewportLength) => {
    const inset = this.config.viewportInset;
    const latest = Math.max(viewportLength - length - inset, inset);

    return Math.min(Math.max(start, inset), latest);
  };



  // The gap between trigger and hint, from the same token the placement uses
  // as its offset. @property registers it as a <length>, so the computed
  // value is always in px regardless of the unit it was set in.
  readOffset = () => {
    const raw = getCssCustomProperty(this.root, this.config.offsetProp);
    const parsed = parseFloat(raw);

    return Number.isNaN(parsed) ? this.config.offsetFallback : parsed;
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly
  // instead of doing a full page (re)load — see destroyModulesInScope() in
  // boot.js. Everything this module put somewhere else goes: the transient
  // scroll listener (which a component destroyed while its hint is up would
  // otherwise leave behind), its seat in the shared registry — whose three
  // document/window listeners go with the last instance — the id it added to
  // the trigger's aria-describedby, and the two attributes plus the property
  // it wrote on the root. The hint keeps working as the CSS-only tooltip it
  // was before.
  destroy = () => {
    this.releaseTransientListeners();
    unregisterTooltip(this);

    this.root.removeEventListener('pointerenter', this.handlePointerEnter);
    this.root.removeEventListener('pointerleave', this.handlePointerLeave);
    this.root.removeEventListener('focusin', this.handleFocusIn);
    this.root.removeEventListener('focusout', this.handleFocusOut);

    removeDescribedBy(this.trigger, this.bubble.id);
    if (this.roleWasGenerated) this.bubble.removeAttribute('role');
    if (this.idWasGenerated) this.bubble.removeAttribute('id');

    this.root.removeAttribute(this.config.flippedAttr);
    this.root.removeAttribute(this.config.dismissedAttr);
    this.root.style.removeProperty(this.config.shiftProp);
    this.root.style.removeProperty(this.config.arrowShiftProp);
    this.root.style.removeProperty(this.config.availableProp);
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'tooltip',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  const trigger = el.querySelector(defaults.triggerSelector);
  const bubble = el.querySelector(defaults.bubbleSelector);

  if (!trigger || !bubble) {
    reporter?.report(
      'tooltip',
      `needs a control marked ${defaults.triggerSelector} and a hint ` +
      `marked ${defaults.bubbleSelector} inside it.`, el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new Tooltip(el, trigger, bubble, defaults, reporter);
  return instance.destroy;
}
