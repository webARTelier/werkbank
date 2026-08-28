/**
 * revealOnScroll.js
 * ----------------------------------------------------------------------------
 * "Let the section fade up as it scrolls into view" needs one piece of
 * information CSS cannot hold: whether an element has entered the viewport
 * yet — and, once it has, that it stays entered. There is no selector for it.
 *
 * This module closes that gap. It boots on a container, takes the elements
 * marked with data-reveal-item inside it (or the container itself when none
 * are marked) and writes ONE state attribute per item:
 *   - data-reveal-pending -> this item is still waiting to be revealed
 * That attribute is the whole styling hook. The script sets no inline styles
 * and runs no animation: the waiting look, the movement and its duration all
 * live in the SCSS, which also honours prefers-reduced-motion and print.
 *
 * What the platform already does, and is therefore not re-done here
 * ----------------------------------------------------------------------
 *   - IntersectionObserver does the watching. No scroll listener, nothing
 *     measured per frame; the browser reports the moments an item crosses an
 *     edge, and everything between two crossings costs nothing.
 *   - It also does the *seeing*. Against the default root — the viewport — an
 *     observer intersects a target with the clip box of every ancestor on the
 *     way up, so an item scrolled out of an overflow: auto box is reported as
 *     gone without the box being named anywhere. That is why this module has
 *     no root option, unlike stickyObserver and scrollSpy: those need the box
 *     an element is pinned or measured against, while a reveal is about what
 *     the reader can see. A container root would be strictly worse — it would
 *     reveal the items inside a box the reader has not even scrolled to yet.
 *   - CSS does the animating, from a transition on the item plus the state
 *     attribute above — including making it instant under
 *     prefers-reduced-motion and lifting it for print.
 *   - A scroll-driven animation (animation-timeline: view()) can express this
 *     in CSS alone, and where it is enough it is the better tool. Not as a
 *     scrubber — that one is tied to the scroll position and runs backwards
 *     as the reader scrolls back — but as a SWITCH: the timeline animates an
 *     unregistered custom property, which therefore flips discretely, and a
 *     style query starts an ordinary time-based animation with it. Pausing
 *     never rewinds currentTime, so a finished reveal stays finished. What
 *     that lane cannot do is why the question is answered by an observer
 *     here: it is missing from Firefox stable, it cannot be made fail-safe
 *     (no feature query exists for a style query, so an engine with the
 *     timeline and without them would leave an item paused at opacity 0),
 *     scrolling back mid-animation leaves an item half-revealed, and repeat,
 *     offset, the focusin reveal and a document-order stagger have no
 *     equivalent in it. The readme carries the snippet and the measurements.
 *
 * What the script adds
 * --------------------
 *   1. It hides only what nobody is looking at, and it lets the browser
 *      decide what that means. Two observers watch every item: the TRIGGER,
 *      whose bottom edge sits data-reveal-offset px above the viewport's,
 *      reveals an item that has crossed it; the VIEW, which has no offset at
 *      all, is the only thing that ever marks one — and it can only report an
 *      item the reader cannot see. So no item is ever taken away, at startup
 *      or later, and there is nothing for a late-arriving chunk to hide.
 *   2. It staggers a group: items revealed by the same report can be released
 *      one after another (data-reveal-stagger, in document order), so a grid
 *      of cards arrives as a sequence instead of a block. The stagger is
 *      skipped for a reader who asked for reduced motion — there is nothing
 *      to sequence when the reveal is instant.
 *   3. It can hide again (data-reveal-repeat): an item the view observer
 *      reports as gone waits once more, so the reveal replays on the way
 *      back. "Gone" is the view observer's word, not the trigger's — an item
 *      resting below the trigger line is still in plain sight.
 *   4. It reveals an item the keyboard reaches before the scrolling does, so
 *      focus never lands inside something invisible, and it keeps a focused
 *      item from being hidden again.
 *   5. In the default reveal-once mode an item is unobserved as it arrives,
 *      and both observers are dropped once the last one is done.
 *   6. It re-checks data-reveal-offset whenever the viewport changes. The
 *      offset is baked into the trigger's rootMargin and is only usable while
 *      it stays below the viewport height — and that is not a property of the
 *      markup: a value that fits a desktop window can be taller than the
 *      whole screen after a rotation or at 400% zoom, where the trigger line
 *      would sit above the top edge and nothing could ever cross it. Checked
 *      only at startup it would take the content away exactly there, so one
 *      debounced resize listener rebuilds the trigger — and only an instance
 *      that asked for an offset owns that listener at all.
 *
 * Accessibility
 * -------------
 * Nothing here is meaningful to assistive technology: an item waiting to be
 * revealed is transparent, not hidden — it keeps its box, its text and its
 * place in the accessibility tree, so a screen reader, find-in-page and
 * reading mode see the whole document at all times. The module adds no ARIA,
 * no roles and no live regions, and the state attribute must stay decorative.
 * Two consequences are handled rather than left to the reader: keyboard focus
 * reveals its item immediately (and pins it — and the stylesheet drops the
 * transition while the focus is inside, so a focus ring is never drawn on a
 * box that is still fading in), and print lifts the pending state in CSS,
 * because paper cannot scroll anything into view.
 *
 * A reveal is motion, so prefers-reduced-motion decides how much of it there
 * is: the shipped stylesheet neutralises the pending state entirely for that
 * reader — the content is simply there, with no appearance to wait for.
 *
 * Configuration (all optional, read from the module element)
 * ----------------------------------------------------------
 *   - data-reveal-items="..." CSS selector for the items, resolved inside the
 *       module element. Use it when the items cannot carry an attribute of
 *       their own (CMS output, a generated list): ":scope > li" or
 *       ":scope > .card". Default: [data-reveal-item], and a container with
 *       no marked item at all is the single item itself.
 *   - data-reveal-offset="..." px the trigger line sits above the bottom edge
 *       of the viewport, so an item is revealed only once it has come that
 *       far in. Must stay below the viewport height — a line above the top
 *       edge of the screen could never be crossed; such a value is reported
 *       and dropped to 0, re-checked on every resize. Default: 0 — the moment
 *       the item's edge appears.
 *   - data-reveal-stagger="..." ms between two items revealed together, in
 *       document order. Default: 0 — they are revealed in one go.
 *   - data-reveal-repeat (presence) re-hides an item that has left the view,
 *       so the reveal replays. Default: revealed once and done.
 * ----------------------------------------------------------------------------
 */



import { debounceThenExecute } from './debounce.js';
import { parseNonNegative } from './parseNonNegative.js';



const defaults = {

  // The items inside the module element. A container that has none of them
  // is itself the item — the single-element lane (see resolveItems).
  itemSelector: '[data-reveal-item]',

  // Written on the module element by init(), removed again by the cleanup
  // function. Only ever written, never read back: it exists for the OPT-IN
  // pre-enhancement rule in the snippet, which hides the items until the
  // module has taken over. Set as the first thing the constructor does, so
  // every bail-out below lifts it (the constructor runs in one synchronous
  // task, so no frame can paint in between) — a reported author error must
  // not turn into permanently invisible content.
  readyAttr: 'data-revealonscroll-ready',

  // Written on every item that is still waiting for its reveal, removed when
  // it is revealed. Not overridable from the markup: the shipped SCSS keys
  // its waiting look off this exact name, so a renamed attribute would only
  // take the animation away.
  pendingAttr: 'data-reveal-pending',

  offset: 0, // px the trigger line sits above the viewport's bottom edge

  stagger: 0, // ms between two items revealed together

  // ms of resize silence before the trigger observer is rebuilt with the
  // re-checked offset
  rebuildDelay: 150,
};



// Items in the order they stand in the document, which is the order a stagger
// has to release them in. IntersectionObserver reports in observation order,
// so this is normally a no-op — but the order of a batch is not something the
// spec promises, so the sequence is established here rather than assumed.
const inDocumentOrder = (items) => [...items].sort((a, b) => (
  a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
));



class RevealOnScroll {

  // item -> pending stagger timer. Also the reason this module returns a
  // cleanup function at all: a timer outlives the subtree it was started for.
  timers = new Map();

  // The items that currently carry the pending attribute.
  waiting = new Set();

  // The items that are through with it — reveal-once only, where it is what
  // says when the observers can go.
  done = new Set();

  // Set by destroy(), read by the debounced rebuild: the resize handler can
  // already be queued when the host unmounts, and a debounced call cannot be
  // cancelled from the outside.
  destroyed = false;

  // Whether the requested offset is currently too tall for the viewport, so
  // resolveOffset() reports each crossing of that line once instead of on
  // every step of a slow window drag.
  offsetDropped = false;



  constructor(root, reporter) {
    this.root = root;
    this.reporter = reporter;
    this.items = [];

    // Whatever happens below, the module element says "handled" — see
    // defaults.readyAttr for why this is the first statement.
    this.root.setAttribute(defaults.readyAttr, '');

    // Very old engines without IntersectionObserver stay unenhanced: nothing
    // is marked, so every item simply stands in the page as authored.
    if (!('IntersectionObserver' in window)) return;

    this.items = this.resolveItems();
    if (!this.items.length) return;

    // What the markup asked for, kept apart from what the viewport currently
    // allows: resolveOffset() answers the second question, and it is asked
    // again on every resize.
    this.requestedOffset = parseNonNegative(this.root.dataset.revealOffset, defaults.offset);
    this.offset = this.resolveOffset();

    this.stagger = parseNonNegative(this.root.dataset.revealStagger, defaults.stagger);
    this.repeat = this.root.hasAttribute('data-reveal-repeat');
    this.motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    this.observe();
    this.watchResize();
    this.root.addEventListener('focusin', this.handleFocusIn);
  }



  // Which elements are revealed? The marked ones inside the module element,
  // or — for the single-element lane — the module element itself, so a lone
  // card needs no second attribute on the same tag. An explicit
  // data-reveal-items selector that matches nothing is a typo rather than
  // that lane, so it is reported instead of silently falling back.
  resolveItems = () => {
    const selector = this.root.dataset.revealItems?.trim();

    try {
      const found = [...this.root.querySelectorAll(selector || defaults.itemSelector)];
      if (found.length) return found;
    } catch {
      this.reporter?.report(
        'revealOnScroll',
        `invalid data-reveal-items selector ("${selector}").`
      );
      return [];
    }

    if (!selector) return [this.root];

    this.reporter?.report(
      'revealOnScroll',
      `found no items for selector "${selector}".`
    );
    return [];
  };



  // How far above the viewport's bottom edge the trigger line may sit. A
  // value that reaches past the top edge is not a late trigger but an
  // unusable one: it would shrink the observed box to nothing, no item could
  // ever cross the line, and everything marked would stay marked. That is the
  // one way this module could lose content, so such a value is reported and
  // dropped rather than honoured.
  //
  // Re-asked on every rebuild, because the answer belongs to the viewport and
  // not to the markup: an offset that fits a desktop window can be taller
  // than the whole screen after a rotation or at 400% zoom. Measured the way
  // the observer measures the viewport itself (documentElement.clientHeight
  // excludes a horizontal scrollbar, like the observer's own rootBounds).
  resolveOffset = () => {
    if (this.requestedOffset < document.documentElement.clientHeight) {
      this.offsetDropped = false;
      return this.requestedOffset;
    }

    if (!this.offsetDropped) {
      this.offsetDropped = true;

      this.reporter?.report(
        'revealOnScroll',
        `data-reveal-offset (${this.requestedOffset}px) is not smaller than the ` +
        'viewport height and would keep the items from ever being revealed; ' +
        'using 0 for as long as the viewport is that short.'
      );
    }

    return defaults.offset;
  };



  // Two observers on the same items, and the difference between them is the
  // point:
  //   - the TRIGGER carries data-reveal-offset as a negative bottom margin,
  //     so its edge is the line an item is revealed at;
  //   - the VIEW has no margin, so it answers the plain question "can the
  //     reader see this at all" — the only question that may hide something.
  // Both take the default root, which is what makes an overflow box the
  // browser's business rather than this module's (see the header).
  observe = () => {
    this.observeTrigger(this.items);

    this.view = new IntersectionObserver(this.handleView);
    for (const item of this.items) this.view.observe(item);
  };



  // The trigger observer, built for a given set of items. The offset is baked
  // into its rootMargin, so a changed offset means a new observer rather than
  // an adjusted one — which is the whole of what rebuild() does below. The
  // view observer has no margin and therefore never needs rebuilding.
  observeTrigger = (items) => {
    this.trigger = new IntersectionObserver(this.handleTrigger, {
      rootMargin: `0px 0px -${this.offset}px 0px`,
    });

    for (const item of items) this.trigger.observe(item);
  };



  // A viewport that got shorter can invalidate the offset (see
  // resolveOffset), and the offset lives in the trigger's rootMargin — so the
  // answer has to be asked again while the page is open. One debounced window
  // listener is enough: the viewport is what the observers measure against
  // anyway, so there is no box to watch with a ResizeObserver.
  //
  // An instance without an offset has nothing to re-check — its trigger line
  // IS the viewport's bottom edge, at every size — so it owns no listener at
  // all and the common case stays exactly as observer-only as before.
  watchResize = () => {
    if (!this.requestedOffset) return;

    this.handleResize = debounceThenExecute(this.rebuild, defaults.rebuildDelay);
    window.addEventListener('resize', this.handleResize);
  };



  // Replace the trigger observer with one built for the re-checked offset.
  // Skipped when the verdict did not change — a width-only resize, or any
  // height change that stayed on the same side of the line — and skipped when
  // there is nothing left to reveal.
  //
  // Only the items still waiting are re-observed: in the default lane an item
  // that has arrived is through with both observers, and putting it back
  // would just have it reported and finished a second time.
  //
  // The destroyed check is what keeps a teardown final: removing the resize
  // listener cannot un-queue a debounce that is already waiting, so a resize
  // shortly before the unmount would otherwise land here afterwards and
  // observe a fresh observer onto a subtree nothing disconnects again.
  rebuild = () => {
    if (this.destroyed) return;

    const remaining = this.items.filter((item) => !this.done.has(item));
    if (!remaining.length) return;

    const offset = this.resolveOffset();
    if (offset === this.offset) return;

    this.offset = offset;
    this.trigger.disconnect();
    this.observeTrigger(remaining);
  };



  // An intersecting item has crossed the trigger line. It is collected as a
  // batch so the stagger has something to sequence; one that was never marked
  // — in view from the start — has nothing to reveal and, in the reveal-once
  // lane, nothing left to be watched for either.
  handleTrigger = (entries) => {
    const arrived = [];

    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      if (this.waiting.has(entry.target)) {
        arrived.push(entry.target);
        continue;
      }

      this.finish(entry.target);
    }

    this.schedule(arrived);
  };



  // The view observer is the only thing that marks an item, and it reports
  // exactly one kind of item: one the reader cannot see — off screen, clipped
  // inside a scroll box, in a closed panel. At startup that is what puts the
  // page's whole depth into its waiting state; afterwards it is the repeat
  // lane's way back.
  handleView = (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) continue;
      if (!this.repeat && this.done.has(entry.target)) continue;

      this.hide(entry.target);
    }
  };



  // Release a batch: the first item right away, every following one a stagger
  // step later, in document order. A reader who asked for reduced motion gets
  // no sequence at all — the reveal is instant for them, so a delay would
  // only postpone content.
  schedule = (items) => {
    const step = this.motionQuery?.matches ? 0 : this.stagger;

    inDocumentOrder(items).forEach((item, index) => {
      const delay = index * step;

      if (!delay) {
        this.reveal(item);
        return;
      }

      window.clearTimeout(this.timers.get(item));
      this.timers.set(item, window.setTimeout(() => this.reveal(item), delay));
    });
  };



  // Take the pending attribute off and let the CSS transition do the rest.
  //
  // The item's stagger timer is cleared, not merely forgotten: this is also
  // where handleFocusIn arrives, and there a step for this item can still be
  // pending. Dropping it from the map without clearing it would leave a timer
  // nobody owns any more — destroy() only clears what the map still holds.
  reveal = (item) => {
    window.clearTimeout(this.timers.get(item));
    this.timers.delete(item);
    this.waiting.delete(item);
    item.removeAttribute(defaults.pendingAttr);

    this.finish(item);
  };



  // Reveal-once: an item that has arrived needs no more watching, and with
  // the last of them both observers go altogether — and the resize watcher
  // with them, because there is no trigger line left to rebuild. The repeat
  // lane never finishes anything — leaving the view is what starts its reveal
  // over.
  finish = (item) => {
    if (this.repeat) return;

    this.done.add(item);
    this.trigger.unobserve(item);
    this.view.unobserve(item);

    if (this.done.size < this.items.length) return;

    this.trigger.disconnect();
    this.view.disconnect();
    window.removeEventListener('resize', this.handleResize);
  };



  // Put an item into its waiting state. Only ever called for an item the
  // reader cannot see, plus one that they can: whatever holds the keyboard
  // focus stays visible, so a reader tabbing through a repeat lane is never
  // left in a transparent box.
  hide = (item) => {
    if (item.contains(document.activeElement)) return;

    window.clearTimeout(this.timers.get(item));
    this.timers.delete(item);
    this.waiting.add(item);
    item.setAttribute(defaults.pendingAttr, '');
  };



  // The keyboard can reach an item before the scrolling does: a focus jump
  // scrolls it into view, but the observers report that one task later, so
  // focus would land in a transparent box for a moment. Revealing it here
  // takes the moment away — and since focusin bubbles, one listener on the
  // module element covers every item.
  handleFocusIn = (event) => {
    const item = this.items.find((candidate) => candidate.contains(event.target));
    if (item && this.waiting.has(item)) this.reveal(item);
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly —
  // see destroyModulesInScope() in boot.js. The timers are the part that
  // really needs it; the attributes are taken back so the markup is handed
  // over exactly as it arrived. Guarded throughout because construction can
  // bail out early (no IntersectionObserver, no items).
  destroy = () => {
    this.destroyed = true;

    for (const timer of this.timers.values()) window.clearTimeout(timer);
    this.timers.clear();

    this.trigger?.disconnect();
    this.view?.disconnect();
    window.removeEventListener('resize', this.handleResize);
    this.root.removeEventListener('focusin', this.handleFocusIn);

    for (const item of this.items) item.removeAttribute(defaults.pendingAttr);
    this.waiting.clear();
    this.done.clear();

    this.root.removeAttribute(defaults.readyAttr);
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'revealOnScroll',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new RevealOnScroll(el, reporter);
  return instance.destroy;
}
