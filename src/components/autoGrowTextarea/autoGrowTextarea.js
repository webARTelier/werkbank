/**
 * autoGrowTextarea.js
 * ----------------------------------------------------------------------------
 * Makes a <textarea> as tall as what is written in it: no inner scrollbar
 * while the text is short enough to show, and no field of empty rows kept
 * open for a value nobody has typed yet. A textarea is the one form control
 * whose content has no size limit and whose box does not follow it — "rows"
 * is a guess made when the page was written, so the reader either loses the
 * top of their own text or looks at a box three quarters empty.
 *
 * What the platform already does
 * ------------------------------
 * - "field-sizing: content" IS this component, in one declaration: the field
 *   sizes itself to its value, on every keystroke, at every width, in the
 *   real font, and it does so at the FIRST PAINT — a round trip before any
 *   module could exist. Where the engine has it, this script does nothing at
 *   all (see init) and autoGrowTextarea.scss is the whole component.
 * - "min-block-size" / "max-block-size" in "lh" units say how few and how
 *   many lines that box may be. The "rows" attribute cannot: the engine
 *   ignores it as soon as the field sizes to its content (verified in
 *   Chromium 151 and WebKit 26.5 — a rows="3" field is one row tall while
 *   empty), which is why the stylesheet states the minimum in line units.
 * - A textarea is a scroll container whatever we do with it, so a value
 *   taller than the cap stays reachable without a line of script.
 * - The engines that have none of the above still have the scrollbar. That
 *   is the state this module improves on, and it is a perfectly usable one:
 *   nothing is hidden and nothing is lost.
 *
 * What this script adds (and only where the engine needs it)
 * ---------------------------------------------------------
 * 1. The one length CSS cannot name on an engine without field-sizing: how
 *    tall this value is, at this width, in the font that actually arrived.
 *    It is measured on the field itself and handed to the stylesheet as
 *    "--autoGrowTextarea-content-size" — the only lasting thing this module
 *    writes, plus two scaffolding declarations that exist for the duration
 *    of the measurement and no longer (see sync). The clamps stay in CSS, so
 *    the minimum, the cap and the scrolling past the cap are the same rules
 *    in both lanes.
 * 2. The occasions to measure again, which are all the ones that change how
 *    many lines the value takes: typing and pasting ("input"), a column that
 *    got narrower (ResizeObserver), the web font arriving, the page finishing
 *    its load, a form being reset — the only value change in the list that
 *    fires no "input" event at all — and the field being focused.
 *
 *    That last one is there because a length this module wrote PINS the box,
 *    and a pinned box reports no resize: a change that alters how tall the
 *    lines are without altering the width (a reader's own stylesheet, as
 *    WCAG 1.4.12 asks to be survivable, or text-only zoom) reaches the
 *    observer only while the field rests at its minimum, where it moves
 *    min-block-size. Above the minimum nothing arrives at all, so the
 *    occasion has to be an interaction instead. What is left uncovered is a
 *    field the reader changes the typography of and then never touches: it
 *    keeps a box measured for the old type and scrolls the difference, which
 *    is a scrollbar too early and not a loss — the value stays reachable,
 *    the way it does past the cap.
 * 3. The resting statement that the field no longer has to be dragged open:
 *    "data-autogrowtextarea-ready", which is what lets the stylesheet drop
 *    the resize handle in this lane. It is deliberately the module's to set,
 *    because a chunk that never arrives must not leave a field that can
 *    neither grow nor be resized.
 *
 * Accessibility
 * -------------
 * There is nothing to announce and nothing to hide: this is the field's own
 * box, and the value is in it either way. No ARIA is set, no state is
 * claimed, and every state the component can be in is one the platform
 * already describes — which is also why growth is not animated. The box has
 * to be there when the caret arrives; a transition would put the caret
 * behind the edge of a box that is still on its way.
 *
 * Two things follow from the box being the reader's, not ours:
 * - The cap is a maximum, not a lid. Past it the field scrolls, so no value
 *   is ever unreachable — a component that grew without limit would push its
 *   own submit button off the screen instead.
 * - The resize handle is only taken away where growth is actually delivered
 *   (see 3 above and the two @supports lanes in the stylesheet).
 *
 * Configuration
 * -------------
 * None in JavaScript, and that is the point: how few lines the field may
 * be, how many it may grow to, and what happens past that are questions
 * about a box, which is CSS's subject. They are the knobs on the component
 * root in autoGrowTextarea.scss:
 *
 *   --autoGrowTextarea-min-rows / --autoGrowTextarea-min-size
 *   --autoGrowTextarea-max-rows / --autoGrowTextarea-max-size
 *   --autoGrowTextarea-box-extra   (the field's own padding + border, so a
 *                                   row count means that many rows of text)
 *   --autoGrowTextarea-inline-size (the width — stated because field-sizing
 *                                   sizes the inline axis too, and an
 *                                   unstated width would differ per lane)
 *
 * Put "data-js-behavior=autoGrowTextarea" on the <textarea> itself, and give
 * it a "rows" attribute matching the minimum: that is what an engine without
 * field-sizing shows until this module has measured, and what a reader with
 * scripting off keeps.
 * ----------------------------------------------------------------------------
 */



// rafThrottle collapses a burst of ResizeObserver callbacks into one
// measurement per frame — the observer sees every intermediate width while a
// column is being dragged, and only the last one is worth a layout read.
import { rafThrottle } from './rafThrottle.js';



const defaults = {

  // "The module is running here." Set on the field by init() in both lanes
  // and only ever written — never read back. In the fallback lane the
  // cleanup function takes it off again; in the native one init() returns
  // before there is anything to clean up, so it stays for as long as the
  // element does — which costs nothing, because the only rule that reads it
  // is in the fallback lane's half of the stylesheet. That rule drops the
  // field's resize handle: until the measuring is actually being done,
  // dragging the field open is the reader's only way out of a value that
  // does not fit.
  readyAttr: 'data-autogrowtextarea-ready',

  // The height of the value as a LENGTH, measured by this module and written
  // to the field. It is the one thing here that STAYS in a style attribute,
  // for the reason readMore and dataTable put their measurements there: only
  // a measurement can answer how tall a text is, and a stylesheet cannot
  // take it. Do not set it by hand; the module overwrites it on every input.
  contentProp: '--autoGrowTextarea-content-size',
};



// Does the engine size a field to its own content? The stylesheet asks the
// same question in its own language ("@supports not (field-sizing: content)")
// and the two answers have to agree: what CSS handles there is exactly what
// this module leaves alone here. Asked once per page — it is a fact about the
// engine, not about an element.
const nativeFieldSizing =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('field-sizing', 'content');



// How tall is a line of this field? CSS has the answer as a unit ("1lh") and
// JS cannot ask for it, so what is kept instead is the pair that decides it,
// as a string to compare against later. Both halves are needed: a reader's
// stylesheet states a line-height, while text-only zoom moves the font size
// and may well leave line-height at "normal" — whose computed value is the
// word "normal" at every font size, so on its own it would report that
// nothing had changed.
const typeOf = styles => `${styles.fontSize}/${styles.lineHeight}`;



class AutoGrowTextarea {

  constructor(field, params, reporter) {
    this.field = field;
    this.params = params;
    this.reporter = reporter;
    this.destroyed = false;

    // What the last measurement was taken under: the width the value wrapped
    // at, and the type it wrapped in. A height this module wrote is itself a
    // resize, so the observer would otherwise answer its own answer for ever
    // — these two are what tell the module's own echo apart from a real
    // change (see handleResize).
    this.measuredAt = null;
    this.measuredType = null;

    // Two ways in, and they are not interchangeable: everything that
    // changed the VALUE has to measure, while the observer first asks
    // whether the width moved at all. Both collapse a burst into one
    // measurement per frame, and both being deferred to a frame is what
    // makes them safe to call from a "reset" handler (see startListening).
    this.requestSync = rafThrottle(this.sync);
    this.requestWidthCheck = rafThrottle(this.handleResize);

    this.startListening();
    this.sync();
  }



  // How tall is this value? Asked again on every event that can change the
  // answer, because it is a function of the width, the font and the words,
  // and none of the three is known when the page is written.
  //
  // Three declarations go into the field's style attribute here and only the
  // last of them survives the call:
  //   - the length is set to zero first, because scrollHeight reports the
  //     greater of the content and the box: a field still holding the height
  //     measured for a longer value would read that back and could never
  //     shrink again. Collapsed, the box is exactly what the stylesheet's
  //     minimum says, so the reading is the value's own height with that
  //     floor under it — the same floor the native lane has, rather than the
  //     markup's rows.
  //   - the scrollbar is taken out of the way, because a collapsed box has
  //     one, and a scrollbar that takes space makes the field narrower than
  //     it will be at rest: the value would be measured at a width it never
  //     wraps at and come back one line too tall (measured in a headed
  //     Chromium — 483px instead of 498px, and 280px instead of 256px).
  //   - then the answer goes in and the two scaffolding declarations come
  //     off again.
  // Nothing paints in between: this is one synchronous task.
  sync = () => {
    if (this.destroyed) return;

    const { field, params } = this;

    // Held rather than cleared afterwards: the field may well carry an inline
    // overflow of the author's own, and a measurement must hand back exactly
    // what it borrowed.
    const heldOverflow = field.style.overflowY;

    field.style.setProperty(params.contentProp, '0px');
    field.style.overflowY = 'hidden';

    const scrollHeight = field.scrollHeight;
    const styles = window.getComputedStyle(field);

    // scrollHeight is the content plus the padding — the padding box — so
    // what has to be added or taken off to arrive at a block-size depends on
    // which box the field sizes by. Read off the field rather than assumed:
    // whether "* { box-sizing: border-box }" is in force is the project's
    // decision, and this component has no business having an opinion on it.
    const paddingBlock =
      Number.parseFloat(styles.paddingBlockStart) +
      Number.parseFloat(styles.paddingBlockEnd);
    const borderBlock =
      Number.parseFloat(styles.borderBlockStartWidth) +
      Number.parseFloat(styles.borderBlockEndWidth);
    const borderBox = styles.boxSizing === 'border-box';

    field.style.overflowY = heldOverflow;

    // No box to measure: a field in a closed panel, under a display: none
    // ancestor, not in the document yet. Zero is not a height, and leaving
    // the zero written above in place would pin the field shut — so the
    // property comes off and the field keeps its authored rows until there
    // is something to measure. The ResizeObserver reports that moment: a box
    // appearing is a resize from nothing.
    if (!scrollHeight) {
      field.style.removeProperty(params.contentProp);
      return;
    }

    const height = borderBox
      ? scrollHeight + borderBlock
      : scrollHeight - paddingBlock;

    field.style.setProperty(params.contentProp, `${height}px`);

    // Remembered together with the length they belong to: the next resize is
    // only worth a measurement if it changed one of THESE.
    this.measuredAt = field.clientWidth;
    this.measuredType = typeOf(styles);
  };



  // Typing, pasting, cutting, undoing, an autofill: every value change a
  // user can cause fires this one event, and the field is measured for it
  // straight away rather than a frame later. The box has to be there when
  // the caret arrives.
  handleInput = () => {
    this.sync();
  };



  // The width decides how the value wraps, and the field is as wide as the
  // column it was put in — so the field's own resize is the signal, not the
  // window's (a sidebar opening changes one and not the other).
  //
  // What the observer also sees is the height this module just wrote, and
  // that one must not start a second measurement: it is the answer to the
  // last question, not a new one. The two remembered readings are the whole
  // guard — a resize that changed neither how wide the field is nor how tall
  // its lines are cannot have changed how many lines the value takes. It
  // guards this path only: an event that changed the value goes to sync()
  // directly, where neither reading has anything to say.
  //
  // The type has to be asked about as well as the width, because the two
  // things that change how tall a line is change no width at all: a reader's
  // own stylesheet (WCAG 1.4.12 asks for a line-height of 1.5 to be
  // survivable) and text-only zoom. Guarding on the width alone, both left
  // the field holding a length measured for smaller lines — a value needing
  // 256px in a box still stating 90px, which the field then scrolls instead
  // of growing. Nothing was lost, because a textarea scrolls, but the
  // component had quietly stopped doing its one job.
  //
  // This reaches a field resting at its minimum, where taller lines push
  // min-block-size past the written length and so do move the box. Above the
  // minimum the written length pins the box, no callback arrives at all
  // (measured: zero), and the type change is invisible here — which is what
  // the "focus" occasion in startListening() is for.
  handleResize = () => {
    const { field } = this;
    const type = typeOf(window.getComputedStyle(field));

    if (field.clientWidth === this.measuredAt && type === this.measuredType) {
      return;
    }

    this.sync();
  };



  startListening = () => {
    this.field.addEventListener('input', this.handleInput);

    // The occasion that catches what no observer reports. A length this
    // module wrote pins the box, and a pinned box fires no resize callback —
    // so a change of type that leaves the width alone (a reader's own
    // stylesheet, text-only zoom) is unobservable on a field holding more
    // than its minimum. Focus is when it starts to matter: the reader is
    // about to type into this box, and from the first keystroke "input"
    // keeps it right. Deferred to a frame, like the reset handler, so the
    // measurement stays out of the browser's own focus handling.
    this.field.addEventListener('focus', this.requestSync);

    // A form reset puts the authored value back, and it is the one value
    // change in this component's life that fires no "input" event. On the
    // form, not the field: "reset" is dispatched at the form and does not
    // bubble up from the controls it resets. requestSync is the right
    // handler for it precisely because it measures in the next frame — the
    // reset event is cancelable, so at this point the fields are still
    // holding the old value, and the resetting happens once this task is
    // over.
    this.form = this.field.form;
    this.form?.addEventListener('reset', this.requestSync);

    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.requestWidthCheck);
      this.resizeObserver.observe(this.field);
    }

    // Two arrivals no observer reports: the real font rarely takes the same
    // number of lines as the fallback it replaces, and a page still loading
    // may yet be given a scrollbar, a stylesheet or a sidebar that changes
    // this field's width. Both can land after a teardown — a font promise
    // cannot be cancelled and a "load" that never fires leaves its listener
    // behind — which is what the destroyed guard in sync() is there for.
    document.fonts?.ready.then(this.requestSync);
    window.addEventListener('load', this.requestSync, { once: true });
  };



  // Optional teardown for hosts that mount/unmount the same subtree
  // repeatedly instead of doing a full page (re)load — see
  // destroyModulesInScope() in boot.js. The window listener, the font
  // promise and the reset listener on the form all outlive the field, and
  // the two things written to it are handed back: the measured length,
  // because it describes a value at a width that a re-render may not have
  // any more, and the ready attribute, because dropping it puts the resize
  // handle back — which is exactly the state a second init() expects to
  // find.
  destroy = () => {
    this.destroyed = true;

    this.resizeObserver?.disconnect();
    this.field.removeEventListener('input', this.handleInput);
    this.field.removeEventListener('focus', this.requestSync);
    this.form?.removeEventListener('reset', this.requestSync);
    window.removeEventListener('load', this.requestSync);

    this.field.style.removeProperty(this.params.contentProp);
    this.field.removeAttribute(this.params.readyAttr);
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLTextAreaElement)) {
    reporter?.report(
      'autoGrowTextarea',
      'module must be initialized on a <textarea> — it grows a field by its ' +
      'own value, so there is nothing it could do to another element.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  //
  // Set in both lanes and before the bail-out below, because it says "the
  // module is running here", not "the module is doing the growing". Which
  // lane delivers that is the stylesheet's question, and it asks it itself.
  el.setAttribute(defaults.readyAttr, '');

  // The engine grows the field on its own, from the first paint and without
  // a chunk having to arrive. Then there is no gap to cover and no length to
  // measure, and the honest thing for a progressive enhancement to do is
  // nothing: no listeners, no observer, no style attribute. This early
  // return is the component's main path, not its edge case.
  if (nativeFieldSizing) return;

  const instance = new AutoGrowTextarea(el, defaults, reporter);
  return instance.destroy;
}
