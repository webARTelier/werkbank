/**
 * readMore.js
 * ----------------------------------------------------------------------------
 * Cuts a long text down to a preview of a few lines and gives the reader a
 * control that opens it again. The cut is a stylesheet's job and stays one
 * (see readMore.scss); what no stylesheet can answer is whether a given text
 * needs a control at all — that depends on the width it was given, the font
 * that arrived and the words in it, and the answer changes on every resize. A
 * "Read more" under a text that is already complete is the one thing this
 * component must never show.
 *
 * What the platform already does
 * ------------------------------
 * - The preview is plain CSS: a max-block-size in "lh" units, overflow
 *   hidden, and a mask that fades the last lines out. Nothing here writes a
 *   height, and the preview is on screen at the first paint — a round trip
 *   before this module can exist.
 * - A <details> would do the whole job, except for the one thing this
 *   component is about: it shows all of its content or none of it, with no
 *   preview in between.
 * - An <a href="#the-region"> is a control that already works: it takes the
 *   reader to the region, and ":target" in the stylesheet lifts the cut. That
 *   is what the page does before this module arrives, and what it keeps doing
 *   if the chunk never does.
 * - A button is operated by Enter and Space, and aria-expanded is the state
 *   the ARIA APG "Disclosure" pattern asks for.
 * - A transition animates between two lengths. It cannot interpolate towards
 *   an intrinsic keyword such as max-content — only Chromium can, through
 *   interpolate-size — which is the whole reason point 2 below exists:
 *   without it the open/close animates in one engine and snaps in the other
 *   two.
 *
 * What the script adds
 * --------------------
 * 1. The measurement: with the cut in force, is there anything below it? That
 *    decides whether the control is there at all — a cut that reaches nothing
 *    changes nothing, but a control that opens nothing is a lie. Re-taken on
 *    a resize, on a content change, once the web fonts have arrived, once the
 *    page has finished loading and once a close has played out — each of them
 *    changes how many lines the text takes, or when the box can be believed
 *    about it.
 * 2. The second length the movement needs. The stylesheet has the cut; the
 *    height of the whole text is the other end, and only a measurement can
 *    give it. It is handed over for the duration of the movement and taken
 *    back afterwards, so the open region rests uncapped and nothing inside it
 *    can be clipped later (see holdHeight / releaseHeight).
 * 3. The toggle's second half. Unenhanced it is a link INTO the region; from
 *    here on it is the control that opens and closes it, so the jump is
 *    prevented, the role corrected and Space handled — the link-to-button
 *    upgrade offCanvasNav performs on its burger.
 * 4. The two labels and aria-expanded, in step: the control says what it will
 *    do next and states what it did.
 * 5. Keyboard safety: a link inside the cut-away part is still in the tab
 *    order, so focus landing BELOW THE CUT opens the region rather than
 *    leaving the reader on something they cannot see. Focus inside the
 *    preview changes nothing — that part is painted, and the reader can see
 *    what they are on.
 * 6. The fragment, which is the fallback's own control: a document opened at
 *    the region — or at an anchor inside it — starts open, and an in-page
 *    link to either later does the same. Without that the enhancement would
 *    take something away, because ":target" lifts the cut only for as long as
 *    this module has not run.
 *
 * Accessibility
 * -------------
 * The cut text stays in the accessibility tree, and that is the whole
 * difference between this and a disclosure widget: nothing is hidden here, a
 * few lines are simply not painted. A screen reader reads the text in full
 * whether it is cut or not, so aria-expanded describes a region that is
 * truncated visually. The honest trade of the two available ones — the
 * alternative is cutting a sentence in half for the readers who cannot see
 * that it continues, and a text is one node either way, so there is no "rest"
 * to hide from anyone.
 *
 * What that does mean is that the clipped part keeps its place in the tab
 * order: a link four lines below the cut is still reachable, and the browser
 * would scroll it into a box that shows nothing (WCAG 2.4.11). So focus
 * landing below the cut opens the region (see handleBodyFocus and belowCut).
 * Below it only: the preview is painted, so a link in the first line is one
 * the reader can see and a pointer can press, and opening the whole text
 * because somebody clicked it would be a state change with nothing behind it.
 *
 * The control is a real link before the module runs and a real button
 * afterwards; the chevron is a pseudo-element in the stylesheet, drawn from
 * aria-expanded, so what the eye sees and what a screen reader reads cannot
 * drift apart and the arrow is never announced twice.
 *
 * Configuration (all optional)
 * ----------------------------
 * On the component root (the element with data-js-behavior="readMore"):
 * - data-readmore-expand     the label of the closed control; the markup's own text
 *                            stands in where this is absent
 * - data-readmore-collapse   the label of the open control (see `labels`)
 * The size of the preview is a stylesheet question, not a script one:
 * --readMore-lines / --readMore-collapsed-size in readMore.scss.
 * ----------------------------------------------------------------------------
 */



// rafThrottle collapses a burst of resize/observer events into one
// measurement per frame. uniqueId names a region that has to be pointed at
// (aria-controls) and was not named by its author. resolveLocale picks the
// built-in labels the way every other announcing component here does.
import { rafThrottle } from './rafThrottle.js';
import { uniqueId } from './uniqueId.js';
import { resolveLocale } from './resolveLocale.js';



const defaults = {

  // the text region that gets cut, and the control that opens it
  bodyAttr: 'data-readmore-body',
  toggleAttr: 'data-readmore-toggle',

  // "The region is closed", on the root: the cut is in force. The only thing
  // this module writes that paints anything, and the stylesheet's hook for
  // the whole collapsed rendering. Presence IS the state, so writing it is
  // idempotent. It says nothing about whether the cut actually cuts anything
  // — see sync().
  collapsedAttr: 'data-readmore-collapsed',

  // "There really is something below the cut", on the root: the answer to the
  // measurement, and what the stylesheet hangs the fade on. Written together
  // with the toggle's own visibility, from the same boolean, and deliberately
  // NOT re-measured during a movement — the fade has to stay for the whole
  // way down.
  clippedAttr: 'data-readmore-clipped',

  // an author's own labels, on the root
  expandAttr: 'data-readmore-expand',
  collapseAttr: 'data-readmore-collapse',

  // "This text has been measured." Set on the root as the FIRST thing the
  // constructor does, removed again by the cleanup function. Only ever
  // written, never read back. It lifts the pre-enhancement cut in
  // readMore.scss, which is why it has to be set on the bail-out paths too —
  // see the constructor.
  readyAttr: 'data-readmore-ready',

  // The height of the whole text, measured and written to the root as a
  // length — but only while the region is moving (see holdHeight and
  // releaseHeight). The one thing this module puts in a style attribute, for
  // the reason dataTable puts its two there: only a measurement can answer
  // how tall a text is, and the stylesheet needs that answer as a length to
  // animate towards.
  contentProp: '--readMore-content-size',

  // prefix for the id an unnamed region is given
  idPrefix: 'readMore-body',

  // <html lang> matching none of the locales below falls back to this one
  fallbackLocale: 'en',
};



// The built-in labels, for markup that carries none of its own. Kept short:
// this control sits under a paragraph, not in a toolbar.
const labels = {

  de: {
    expand: 'Weiterlesen',
    collapse: 'Weniger anzeigen',
  },

  en: {
    expand: 'Read more',
    collapse: 'Show less',
  },
};



class ReadMore {

  constructor(root, params, reporter) {
    this.root = root;
    this.params = params;
    this.reporter = reporter;
    this.expanded = false;
    this.destroyed = false;
    this.isLink = false;
    this.generatedId = false;

    // "A movement is under way." Nothing may be measured while it is set: see
    // sync(), which the ResizeObserver drives on every frame of it.
    this.moving = false;

    // Before anything that can fail: while this attribute is missing the
    // stylesheet cuts the text down (the pre-enhancement state, see
    // docs/preEnhancement.md), so a bail-out that left it off would hand the
    // reader a permanently shortened text. The constructor runs in one
    // synchronous task, so no frame can paint between this line and the cut
    // render() re-states through its own attribute a few lines down — tabs
    // sets its own attribute first for exactly this reason.
    root.setAttribute(params.readyAttr, '');

    this.body = root.querySelector(`[${params.bodyAttr}]`);
    if (!this.body) {
      reporter?.report(
        'readMore',
        `no [${params.bodyAttr}] in the component root — there is nothing ` +
        'to shorten. The text is left in full.', { el: root }
      );
      return;
    }

    this.toggle = root.querySelector(`[${params.toggleAttr}]`);
    if (!this.toggle) {
      reporter?.report(
        'readMore',
        `no [${params.toggleAttr}] in the component root — a text nobody ` +
        'can open must not be cut, so it is left in full.', { el: root }
      );
      return;
    }

    // Read before anything is written, so destroy() can hand the markup
    // back the way it was authored.
    this.authoredHidden = this.toggle.hidden;
    this.authoredLabel = this.toggle.textContent;

    this.ensureId();
    this.readLabels();
    this.wireToggle();

    // A document opened at a fragment pointing into the region is a reader
    // who asked for the whole text — where the no-script fallback would have
    // left them, since ":target" is what lifts the cut without this module.
    this.expanded = this.targeted();

    this.requestSync = rafThrottle(this.sync);
    this.startListening();
    this.render();

    // Measured straight away, and only here: nothing is travelling yet. The
    // stylesheet has been showing the cut since the first paint (the
    // pre-enhancement state), and render() has just re-stated the same thing
    // through its own attribute — so the height this reads is the height on
    // screen, not one on its way somewhere.
    this.sync();
  }



  // aria-controls needs an id, and so does the fragment the unenhanced toggle
  // points at. An authored id is always kept; a generated one gets the
  // component working but cannot repair the fallback, because only the markup
  // can point the toggle's href at it — hence the report.
  ensureId = () => {
    if (this.body.id) return;

    this.body.id = uniqueId(this.params.idPrefix);
    this.generatedId = true;

    this.reporter?.report(
      'readMore',
      'the text region has no id, so no fragment can address it: the ' +
      'toggle is not a working link before this module arrives, and the ' +
      'stylesheet therefore leaves the text uncut until then. An id here ' +
      'plus href="#<id>" on the toggle is the whole wiring.', { el: this.body }
    );
  };



  // Is the document's fragment pointing into this region? The region's own id
  // is the documented case — the unenhanced toggle links to it — but an
  // anchor INSIDE the text counts as much: the browser scrolls to it either
  // way, and a target below the cut is one the reader would be taken to and
  // then not shown. That second case is also the one ":target" alone cannot
  // see, which is why the pre-enhancement block carries a ":has(:target)" of
  // its own.
  targeted = () => {
    if (this.body.matches(':target')) return true;
    return !!this.body.querySelector(':target');
  };



  // What the control says in each of its two states. The label the markup
  // already carries is the authored one — what the reader sees before this
  // module runs, so replacing it with a built-in string would change the
  // page's own wording a round trip in. An attribute wins over it, for
  // setting both labels in one place.
  readLabels = () => {
    const { params } = this;
    const strings =
      labels[resolveLocale(Object.keys(labels), params.fallbackLocale)];

    const authored = this.authoredLabel.replace(/\s+/g, ' ').trim();

    this.expandLabel =
      this.root.getAttribute(params.expandAttr) || authored || strings.expand;
    this.collapseLabel =
      this.root.getAttribute(params.collapseAttr) || strings.collapse;
  };



  wireToggle = () => {
    this.toggle.setAttribute('aria-controls', this.body.id);

    // The recommended toggle is a link into the region, a control with a job
    // before this module exists (see the file header). Now that it opens and
    // closes the region it is a button, and saying so is what makes Space
    // work below and stops a screen reader announcing a link that navigates
    // nowhere.
    this.isLink = this.toggle.tagName === 'A';
    if (this.isLink) this.toggle.setAttribute('role', 'button');
  };



  // Open or closed, in one place. The ARIA state, the label and the attribute
  // the stylesheet reads are written on every pass, so none of the three can
  // drift apart.
  //
  // What this deliberately does NOT do is measure: setExpanded() has just set
  // the "moving" flag, and a height told to travel cannot be believed until
  // it has arrived. sync() holds off while the flag is up, releaseHeight()
  // asks again after.
  render = () => {
    this.toggle.setAttribute('aria-expanded', String(this.expanded));
    this.toggle.textContent =
      this.expanded ? this.collapseLabel : this.expandLabel;

    this.root.toggleAttribute(this.params.collapsedAttr, !this.expanded);

    // Opening cannot take the control away — it is what closes the region
    // again. Closing leaves it as it was, which is visible: the reader just
    // pressed it.
    if (this.expanded) this.toggle.hidden = this.authoredHidden;
  };



  // Is there anything below the cut? Asked again on every event that can
  // change the answer, because it is a function of the width, the font and
  // the words — none of which this module knows in advance. The answer only
  // ever decides whether the control is shown: a text that fits needs none,
  // and a control that opens nothing is worse than no control at all.
  sync = () => {

    // Not while the region is travelling. A height just told to move still
    // reports where it is coming from, so a measurement taken here would read
    // a closing text as uncut and take the control away at the very moment
    // the reader pressed it. The guard has to sit in this method rather than
    // only in render(): the ResizeObserver watches the region's box, so it
    // fires on every frame of the movement and would otherwise drive exactly
    // the measurement render() avoids. releaseHeight() asks again once the
    // movement is over.
    if (this.moving) return;

    // Nothing to decide while the region is open: the control stays whatever
    // the text measures now, and the reader is looking at all of it anyway.
    // The next close asks.
    if (this.expanded) return;

    // The comparison says something because the cut is in force whenever the
    // region is closed — an uncut box reports the same scrollHeight as
    // clientHeight and would answer "it fits" every time. Which is why the
    // state stays on a text that turned out to be short enough: a cut nothing
    // reaches changes nothing (a max-block-size above the content height does
    // not paint, and the fade's stops then lie past the end of the box), and
    // leaving it there keeps this one line honest.
    //
    // One pixel of tolerance: both values are rounded to integers, so a
    // fractional line height would otherwise report a text as cut that is one
    // rounding away from fitting exactly.
    const clipped = this.body.scrollHeight - this.body.clientHeight > 1;

    // One answer, two consumers: the control the reader presses, and the fade
    // the stylesheet draws over the last lines. Both are the same statement —
    // "this text goes on" — so both come from one boolean rather than two
    // measurements that could disagree.
    this.root.toggleAttribute(this.params.clippedAttr, clipped);
    this.toggle.hidden = this.authoredHidden || !clipped;
  };



  // Both directions travel between two lengths. One is the cut, which the
  // stylesheet has; the other the height of the whole text, which nothing but
  // a measurement can give — so it is handed over before the state flips and
  // taken back afterwards.
  setExpanded = (expanded) => {
    this.holdHeight();

    this.expanded = expanded;
    this.moving = true;
    this.render();

    this.startRelease();

    if (!expanded) this.keepStartInView();
  };



  // The height the movement runs to (opening) or from (closing), written to
  // the root as a length.
  //
  // Two readings, because only one can be exact. While the region is open the
  // box IS the whole text, so its own rect gives a fractional height — and
  // closing has to start from exactly where the box is, including
  // mid-movement when the reader changed their mind. While it is cut,
  // scrollHeight is the only source; it rounds, but it rounds UP, so nothing
  // is ever clipped by it (measured: 482 against a 481.5px box, in Chromium
  // and WebKit alike).
  holdHeight = () => {
    const cut = this.root.hasAttribute(this.params.collapsedAttr);
    const height = cut
      ? this.body.scrollHeight
      : this.body.getBoundingClientRect().height;

    this.root.style.setProperty(this.params.contentProp, `${height}px`);

    // Committing it. Style changes are coalesced, so without a read here the
    // closing region would go from "max-content" straight to the cut in one
    // recalculation and the transition would have no length to start from —
    // it would snap. Reading forces the recalculation that makes this length
    // the starting point.
    this.body.getBoundingClientRect();
  };



  // Gives the height back to the content once the movement has played out.
  // The cap is temporary by design: an open region left capped at a measured
  // length would clip whatever grows inside it afterwards — a nested
  // disclosure opening, an image arriving — and nothing would report it,
  // because a box that cannot grow triggers no ResizeObserver.
  startRelease = () => {
    window.clearTimeout(this.releaseTimer);

    const duration = this.movementDuration();
    if (!duration) {
      this.releaseHeight();
      return;
    }

    this.releaseTimer = window.setTimeout(this.releaseHeight, duration);
  };



  releaseHeight = () => {
    this.root.style.removeProperty(this.params.contentProp);
    this.moving = false;

    // The first settled moment since the state changed, and so the first one
    // worth measuring in (see sync).
    this.sync();
  };



  // How long the movement is given, read back from the stylesheet rather than
  // duplicated here — the way offCanvasNav times its exit. A project that
  // retunes --readMore-duration, and a reduced-motion preference that flattens
  // it, are both followed without a second source of truth.
  //
  // Timed rather than waited for, because "transitionend" cannot carry this:
  // an engine with nothing to animate stays silent (verified — WebKit fires
  // nothing at all where the height snaps), and the two engines do not even
  // agree on the property's name, Chromium reporting the physical
  // "max-height" for the logical one the stylesheet transitions.
  movementDuration = () => {
    const styles = window.getComputedStyle(this.body);
    const durations = styles.transitionDuration.split(',');
    const delays = styles.transitionDelay.split(',');

    // Both computed values are in seconds and carry one entry per
    // transitioned property, in the same order — so the movement has played
    // out once the slowest duration plus its own delay has run out. A
    // negative delay subtracts, which is what it does to the movement too,
    // and the reduce's floor of 0 catches the rest.
    const seconds = durations.reduce((longest, value, index) => {
      const duration = Number.parseFloat(value) || 0;
      const delay = Number.parseFloat(delays[index]) || 0;

      return Math.max(longest, duration + delay);
    }, 0);

    return seconds * 1000;
  };



  // Closing takes lines out of the middle of the page, and everything below
  // travels up by that much — including the reader, if they had scrolled past
  // the region while it was open. The component's top edge does not move
  // (only its bottom does), so bringing that edge back into view lands them
  // where the text begins instead of somewhere further down a page that just
  // got shorter. Only when they are actually below it; how the scrolling
  // looks stays the page's decision (scroll-behavior), so no behaviour is
  // passed.
  keepStartInView = () => {
    if (this.root.getBoundingClientRect().top >= 0) return;
    this.root.scrollIntoView({ block: 'start' });
  };



  handleToggleClick = (event) => {
    if (event.defaultPrevented) return;

    // The unenhanced control is a link INTO the region, and the jump is what
    // this module replaces.
    if (this.isLink) event.preventDefault();

    this.setExpanded(!this.expanded);
  };



  // Space activates a button but not a link, so the shape that carries the
  // no-script fallback needs it added back (Enter works natively on both).
  // The preventDefault also keeps the key press from scrolling the page.
  handleToggleKeydown = (event) => {
    if (event.defaultPrevented) return;
    if (event.key !== ' ' || !this.isLink) return;

    event.preventDefault();
    this.setExpanded(!this.expanded);
  };



  // The cut text is clipped, not hidden, so a link below the cut keeps its
  // place in the tab order (see the file header). Focus landing there
  // would put the reader on something they cannot see, so the region opens
  // instead — this is the one state change here that nobody asked for, and
  // it is the lesser of the two.
  //
  // Which is an argument about the clipped part only. The preview is painted,
  // and a link in its first line is one the reader can see and a pointer can
  // press — opening the whole text underneath them because they clicked it
  // would be a state change with nothing behind it. So the position decides,
  // not the mere fact that focus arrived.
  handleBodyFocus = (event) => {
    if (this.expanded) return;

    // Where the control is not there, nothing is cut (see sync()) — so
    // nothing focus could be sitting behind, and opening an already complete
    // region would only produce a "Show less" for a text with nothing more to
    // show.
    if (this.toggle.hidden) return;

    if (!this.belowCut(event.target)) return;

    this.setExpanded(true);
  };



  // Does this element reach past the cut? While the region is closed its own
  // box IS the preview, so that box's bottom edge is the cut, and both rects
  // are read against the viewport — which keeps a positioned ancestor
  // somewhere inside the text from changing the answer.
  //
  // "+ scrollTop" is what makes the answer about where the element sits
  // rather than where the engine has just put it: a hidden overflow is still
  // a scroll container, and Chromium scrolls it to pull a focused element
  // inside the box BEFORE this handler is called (verified — the same element
  // reads as below the cut in WebKit and inside it in Chromium, 65px out).
  // Adding back what the box was scrolled by undoes that, and it is zero in
  // every other case.
  //
  // Reaching past the cut is enough: an element the cut runs through is one
  // the reader cannot read either. The tolerance is sync()'s, for the same
  // reason — a cut on a line boundary lands within a rounding of the line box
  // below it.
  belowCut = (node) => {
    if (!(node instanceof Element)) return false;

    const cut = this.body.getBoundingClientRect().bottom;
    const bottom = node.getBoundingClientRect().bottom + this.body.scrollTop;

    return bottom - cut > 1;
  };



  // A fragment that arrives after load: an in-page link to the region, or to
  // an anchor inside it. Unenhanced, ":target" answers both — and it stops
  // answering the moment this module runs, because that is what lifts the
  // pre-enhancement block. Without this handler the enhancement would take a
  // working control away and leave the reader on a preview the browser has
  // just scrolled them to. tabs watches the hash for the same reason, and the
  // toggle's own click never gets here: it is prevented, so it changes no
  // fragment.
  //
  // Opening does not disturb that scroll: the region's top edge stays where
  // it is and everything inside keeps its place, so a target below the cut is
  // at the same offset once it is painted.
  handleHashChange = () => {
    if (this.expanded) return;
    if (!this.targeted()) return;

    this.setExpanded(true);
  };



  startListening = () => {
    this.toggle.addEventListener('click', this.handleToggleClick);
    this.toggle.addEventListener('keydown', this.handleToggleKeydown);
    this.body.addEventListener('focusin', this.handleBodyFocus);

    // On the window, because the fragment is the document's state, not the
    // region's: the link that sets it may sit anywhere on the page.
    window.addEventListener('hashchange', this.handleHashChange);

    // The width decides how many lines the text takes, and the region is as
    // wide as the column it was put in — so the region's own resize is the
    // signal, not the window's.
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.requestSync);
      this.resizeObserver.observe(this.body);
    }

    // A cut box cannot report that its content grew: its height IS the cut,
    // so the observer above is blind to exactly the change a CMS render or a
    // framework update makes. Nothing this module writes lands inside the
    // region, so it cannot observe itself.
    this.mutationObserver = new MutationObserver(this.requestSync);
    this.mutationObserver.observe(this.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    // Two arrivals the observers miss for the same reason: the real font
    // rarely takes the same number of lines as the fallback it replaces, and
    // an image inside the text brings a height the first measurement did not
    // have.
    document.fonts?.ready.then(this.handleLateArrival);
    window.addEventListener('load', this.handleLateArrival, { once: true });
  };



  // Both late signals end up here, and both can arrive after a teardown — a
  // promise cannot be cancelled, and a "load" that never fires leaves its
  // listener behind.
  handleLateArrival = () => {
    if (this.destroyed) return;
    this.requestSync();
  };



  // Optional teardown for hosts that mount/unmount the same subtree
  // repeatedly — see destroyModulesInScope() in boot.js. The two observers
  // and the two window listeners outlive the subtree unless stopped; the rest
  // is handing the markup back as authored, which matters here more than in
  // most components because the ready attribute going away re-arms the
  // pre-enhancement cut, i.e. puts the markup in exactly the state a second
  // init() expects to find.
  destroy = () => {
    this.destroyed = true;

    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    window.removeEventListener('load', this.handleLateArrival);
    window.removeEventListener('hashchange', this.handleHashChange);
    window.clearTimeout(this.releaseTimer);

    // A height held for a movement that will now never finish — the region
    // has to be handed back uncapped, whatever it was in the middle of.
    this.root.style.removeProperty(this.params.contentProp);

    this.root.removeAttribute(this.params.collapsedAttr);
    this.root.removeAttribute(this.params.clippedAttr);
    this.root.removeAttribute(this.params.readyAttr);

    if (!this.toggle) return;

    this.toggle.removeEventListener('click', this.handleToggleClick);
    this.toggle.removeEventListener('keydown', this.handleToggleKeydown);
    this.body.removeEventListener('focusin', this.handleBodyFocus);

    this.toggle.removeAttribute('aria-expanded');
    this.toggle.removeAttribute('aria-controls');
    if (this.isLink) this.toggle.removeAttribute('role');

    this.toggle.textContent = this.authoredLabel;
    this.toggle.hidden = this.authoredHidden;

    // Only an id this module invented; an authored one is the markup's.
    if (this.generatedId) this.body.removeAttribute('id');
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'readMore',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new ReadMore(el, defaults, reporter);
  return instance.destroy;
}
