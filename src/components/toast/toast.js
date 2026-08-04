/**
 * toast.js
 * ----------------------------------------------------------------------------
 * Transient messages about something that has just happened — "Saved", "Link
 * copied", "Could not upload the file". The platform has no element for it,
 * and the two things such a message has to get right are exactly the two a
 * hand-rolled one gets wrong: it has to reach a screen reader without being
 * read twice or read as a control, and it must never take something away
 * from the reader before they can use it.
 *
 * What works without this script
 * ------------------------------
 * The stack is authored markup, so a message the server already knows about
 * — the flash message after a redirect, "your order is on its way" — is
 * written into it and is on screen at the first paint, script or no script.
 * What the module adds to such a message is a way to dismiss it and a timer
 * that does so by itself; without the chunk it stays, which is a static
 * notice rather than a broken widget. Nothing is hidden behind a control
 * this script has to deliver first, so the component ships no
 * pre-enhancement state (see docs/preEnhancement.md).
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * Announcing is the platform's: an element with aria-live is watched by the
 * accessibility layer, and anything added to it is read out. The entrance
 * and exit are CSS alone (@starting-style for a node that has just been
 * inserted, a transition on the leaving state), and how long they take is
 * asked of the element rather than duplicated here — see removeItem.
 *
 * What this script adds
 * ---------------------
 * 1. Two live regions, built at init and inserted after the stack. The
 *    announcement is deliberately NOT the toast itself, and that split is
 *    the architecture of this module (see buildAnnouncers): a live region
 *    reads out every control inside it, so a toast that is one would
 *    announce the name of its own dismiss button — and one region cannot be
 *    polite and assertive at once, while an error and a "Saved" are not the
 *    same kind of interruption.
 * 2. A way out of every message: a dismiss control, injected per item, plus
 *    Escape while the focus is inside one. Injected rather than authored
 *    because a button that does nothing until this chunk arrives is not
 *    markup worth shipping.
 * 3. The timer that makes a toast transient — and the four situations in
 *    which it must not run: while the pointer is over the stack, while the
 *    focus is inside it, while the tab is in the background, and for a
 *    message holding a control of its own. The first three pause and resume
 *    with the time that was left rather than starting over; the last one
 *    never starts (see durationFor).
 * 4. Messages at runtime, without the project importing anything: a
 *    "toast:show" event carrying the message, and a declarative
 *    data-toast-trigger on any control. Both end in the same show(), which
 *    builds an item carrying the same attributes an author would have
 *    written — so there is one code path, and the inspector shows the
 *    authored form of whatever is on screen.
 * 5. A ceiling on the stack (data-toast-max): past it the oldest message
 *    leaves, so a loop that reports twenty failures does not bury the page.
 *
 * Accessibility
 * -------------
 * The kind of a message is in the announcement as a word ("Error: could not
 * save"), because in the stack it is a colour and an icon, and neither is
 * text. The icons come from the stylesheet, not from here, so they are on
 * screen for an authored message too, and their shapes differ per variant so
 * a forced-colors context loses the hue and keeps the meaning.
 *
 * Auto-dismissal is a time limit (WCAG 2.2.1), and this module treats it as
 * one. It pauses whenever the reader is anywhere near the stack or the tab
 * is not in front of them; data-toast-duration="0" switches it off for one
 * message or for the whole stack; and a message that holds a control — an
 * "Undo" link, a "retry" button — is never given a timer at all, whatever
 * the attributes say, because a countdown running against a reader who is
 * trying to reach that control is the one thing a toast must not do.
 *
 * The focus is never moved to a toast: a passive notification that steals
 * the caret interrupts far more than it reports. It is moved when a toast
 * that HAD the focus leaves — to the next message in the stack, or back to
 * wherever the reader came from — because a node removed from under the
 * focus drops it to <body>, and the next Tab would start over at the top of
 * the page.
 *
 * Reaching a toast in the first place is the part no component can solve
 * from the inside: wherever the stack sits in the document, the tab order
 * puts it either behind the whole page or before it. Hence the recommended
 * root (a named <section>, i.e. a region landmark, which AT can jump to from
 * anywhere), the rule that a message holding a control never expires — and
 * the rule for the project, which is that a toast must never be the only way
 * to reach an action.
 *
 * Configuration
 * -------------
 * On the stack root (data-js-behavior="toast"), all optional:
 * - data-toast-duration     ms a message stays; 0 keeps it until it is
 *                           dismissed (default 6000)
 * - data-toast-max          how many messages may be on screen at once
 *                           (default 3)
 * - data-toast-politeness   "polite" | "assertive" for everything but an
 *                           error, which is assertive either way (default
 *                           "polite")
 *
 * The strings this module generates — the dismiss control's name and the word
 * the announcement is prefixed with per variant — are not attributes: they
 * belong to markup this module writes, so there is nothing to write them into.
 * They follow <html lang> instead (de/en, see the labels map).
 *
 * On one message (authored, or written by this module):
 * - data-toast-item         required; marks the message
 * - data-toast-body         the content element inside it
 * - data-toast-variant      "info" | "success" | "warning" | "error"
 * - data-toast-duration     as above, for this message only
 * - data-toast-politeness   as above, for this message only
 *
 * On a control that shows a message (anywhere on the page):
 * - data-toast-trigger      required; the value names the stack by id, and
 *                           an empty value means the page's only stack
 * - data-toast-message      the text to show
 * - data-toast-template     id of a <template> whose content becomes the
 *                           message, for one that needs more than text
 * - data-toast-variant / -duration / -politeness  as above
 * ----------------------------------------------------------------------------
 */



// A message holding a focusable element is a message the reader has to be able
// to reach, which is what takes its timer away (see durationFor).
import { focusableSelector } from './focusableSelector.js';
import { resolveLocale } from './resolveLocale.js';



const defaults = {

  // One message of the stack. This is both the behavioural hook and the
  // stylesheet's, because a message is authored OR generated and the two have
  // to look the same: a class would mean this module writing "m-toast__item"
  // onto its own nodes, i.e. styling through a name it does not own (the same
  // reason dropdownNav styles its injected toggles through
  // [data-dropdownnav-toggle]).
  itemAttr: 'data-toast-item',

  // The content element inside a message. One element rather than "whatever
  // is in there", because it is the middle column of the item's layout.
  bodyAttr: 'data-toast-body',

  // The injected dismiss control, and the text node that names it next to the
  // aria-hidden glyph.
  dismissAttr: 'data-toast-dismiss',
  labelAttr: 'data-toast-label',

  // The two injected live regions; the value is the politeness, which is also
  // what the aria-live attribute next to it says.
  liveAttr: 'data-toast-live',

  // The one state this module writes: the message is on its way out. The
  // stylesheet fades and slides it, and the node goes when that has finished.
  stateAttr: 'data-toast-state',
  leavingState: 'leaving',

  // Per-message options, read off the item — and, except for the variant,
  // off the root as the default for the whole stack.
  variantAttr: 'data-toast-variant',
  durationAttr: 'data-toast-duration',
  politenessAttr: 'data-toast-politeness',

  // Stack-wide options on the root.
  maxAttr: 'data-toast-max',

  // A control that shows a message, and what it shows. The value of the
  // trigger attribute names the stack by id; empty means the page's only one
  // (see owns).
  triggerAttr: 'data-toast-trigger',
  messageAttr: 'data-toast-message',
  templateAttr: 'data-toast-template',

  // <html lang> matching none of the offered locales falls back to this.
  fallbackLocale: 'en',

  // The event any code on the page can fire to show a message, without
  // importing this module or holding a reference to the stack. Dispatch it on
  // the document, or on the stack itself (see handleShowEvent).
  showEvent: 'toast:show',

  // Defaults for the values above.
  duration: 6000,
  max: 3,
  politeness: 'polite',
  variant: 'info',
};



const variants = ['info', 'success', 'warning', 'error'];
const politenessLevels = ['polite', 'assertive'];



// Localized text, keyed by locale then by a message id — the same shape
// countdown, inputCharCount, video and formValidation use, so one <html lang>
// settles every component on the page. These are the strings of the chrome this
// module generates, which is why they cannot come from the markup: the dismiss
// control it injects, and the word that says what kind of message a screen
// reader is hearing (in the stack that is a colour and an icon, and neither of
// those is text).
//
// `info` is empty on purpose: "Info: your session ends in 5 minutes" adds a
// word and no information, while the other three change what the sentence
// means. To add a language, add a block.
const labels = {

  de: {
    close: 'Meldung schließen',
    info: '',
    success: 'Erfolg',
    warning: 'Warnung',
    error: 'Fehler',
  },

  en: {
    close: 'Dismiss',
    info: '',
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
  },
};



// The close glyph, inlined from src/_shared/media/img/icons/close.svg (the
// canonical source). Embedded rather than <img>-referenced so
// stroke="currentColor" follows the control's own colour and its hover state,
// and aria-hidden because the text node next to it is what names the control.
// width/height are carried over although the stylesheet sizes the glyph: an
// inline <svg> without them is 300x150, which is what the control would be if
// this component's CSS never arrived.
const closeIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" ' +
  'height="24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" aria-hidden="true" focusable="false">' +
  '<path d="M6 6 18 18M18 6 6 18" /></svg>';



// Every initialised stack on the page. Module scope, the way dialog keeps its
// shared open counter there: a request that names no stack has to know
// whether there is exactly one to mean (see owns), and no instance can see
// that on its own.
const regions = new Set();



class Toast {

  constructor(root, params, reporter) {
    this.root = root;
    this.params = params;
    this.reporter = reporter;

    const locale = resolveLocale(Object.keys(labels), params.fallbackLocale);
    this.labels = labels[locale] || labels[params.fallbackLocale];

    // The item tag follows the root rather than being fixed: an <li> outside a
    // list is invalid markup, and the container is the author's choice.
    //
    // The recommended root is a named <section>, which is a region landmark —
    // the one navigation mode that reaches the stack from anywhere, and a
    // stack holding an "Undo" is a stack the reader may have to reach (the
    // tab order cannot help much: wherever the stack sits in the document,
    // it is either behind the whole page or before it). A list root works
    // and gives the reader a count instead; it is the lesser trade, because
    // content outside every landmark is content a screen-reader user has no
    // way to jump to.
    this.itemTag = root.tagName === 'OL' || root.tagName === 'UL' ? 'li' : 'div';

    // Per-message bookkeeping: the pending timer and the announcement node
    // that belongs to the message. Keyed by the item and deleted with it, so
    // the map holds exactly the messages that are on screen.
    this.tracked = new Map();

    this.paused = false;
    this.hovered = false;
    this.focused = false;

    // Where the focus came from when it first entered the stack (see
    // moveFocusOut).
    this.focusReturn = null;

    // A "toast:show" that bubbles from the stack reaches both listeners below,
    // and one event must not become two messages.
    this.handledEvents = new WeakSet();

    // Requests this stack has already complained about, so a reader pressing
    // the same ambiguous control twice does not fill the console twice.
    this.reportedAmbiguity = new WeakSet();

    regions.add(this);

    this.buildAnnouncers();
    this.adoptAuthoredItems();

    this.root.addEventListener('click', this.handleRootClick);
    this.root.addEventListener('keydown', this.handleRootKeydown);
    this.root.addEventListener('pointerenter', this.handlePointerEnter);
    this.root.addEventListener('pointerleave', this.handlePointerLeave);
    this.root.addEventListener('focusin', this.handleFocusIn);
    this.root.addEventListener('focusout', this.handleFocusOut);
    this.root.addEventListener(params.showEvent, this.handleShowEvent);

    // On the document, because that is the point of both: code that fires a
    // message does not have the stack to hand, and a trigger may sit anywhere
    // on the page — including in markup that arrives later, which a delegated
    // listener picks up without re-initialising anything (the way dialog
    // reaches its triggers).
    document.addEventListener(params.showEvent, this.handleShowEvent);
    document.addEventListener('click', this.handleTriggerClick);

    // A message must not expire while nobody is looking at it.
    document.addEventListener('visibilitychange', this.syncPaused);
  }



  // ---- the announcement (see file header, gap 1) --------------------------

  // Two visually hidden live regions, one per politeness, built once and kept
  // for the life of the stack. Three decisions in here, and each answers a
  // way the obvious version fails:
  //
  // - The stack itself is NOT a live region. Everything inside a live region
  //   is read out when it appears, including the names of the controls in it,
  //   so a dismissable message would announce itself as "Saved, Dismiss,
  //   button" — and an "Undo" toast would be worse. Announcing a copy of the
  //   text instead leaves the stack as plain content: reachable, operable,
  //   and read once.
  // - There are two of them, because aria-live is a property of the region
  //   and not of the message. "Could not save your changes" should interrupt;
  //   "Saved" should wait its turn. One region could only ever be one of the
  //   two.
  // - They are built at init, not with the first message. A live region that
  //   is inserted and filled in one go is announced by nobody: an engine
  //   reports that as "a new region appeared", i.e. as nothing.
  //
  // They go next to the stack rather than on <body>, so they inherit the lang
  // of whatever the stack sits in and a German message on an English page is
  // pronounced in German.
  buildAnnouncers = () => {
    this.announcers = {};

    for (const level of politenessLevels) {
      const region = document.createElement('div');
      region.setAttribute(this.params.liveAttr, level);
      region.setAttribute('aria-live', level);

      // Not role="status" / role="alert": both imply aria-atomic="true", and
      // the engine would then re-read the whole region — every announcement
      // still in it — each time one is added.
      region.setAttribute('aria-atomic', 'false');

      this.announcers[level] = region;
    }

    this.root.after(this.announcers.polite, this.announcers.assertive);
  };



  // What a screen reader hears about one message: its text, prefixed with the
  // kind of message it is, in the region matching its politeness. A node per
  // announcement rather than one node whose text is replaced, because
  // replacing text with the same text is not a change and would not be
  // announced — the second "Could not save" would be silent. The node is
  // removed with the message it belongs to.
  //
  // Called before the dismiss control is injected, which is what keeps the
  // control's name out of the sentence.
  announce = (item) => {
    const text = this.announcementFor(item);
    if (!text) return null;

    const line = document.createElement('p');
    line.textContent = text;
    this.announcers[this.politenessFor(item)].append(line);

    return line;
  };



  // The sentence itself: the kind of message, then what it says. The variant
  // is a colour and an icon in the stack, and neither of those is text.
  announcementFor = (item) => {
    const message = (item.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!message) return '';

    const kind = this.labels[this.variantOf(item)];

    return kind ? `${kind}: ${message}` : message;
  };



  // Which region a message is announced in. The message's own attribute
  // first, then the variant — an error interrupts, because "stop what you are
  // reading" is what it means and what assertive is for — then the stack's
  // default.
  politenessFor = (item) => {
    const own = this.readPoliteness(
      item.getAttribute(this.params.politenessAttr), item
    );
    if (own) return own;

    if (this.variantOf(item) === 'error') return 'assertive';

    const stack = this.readPoliteness(
      this.root.getAttribute(this.params.politenessAttr), this.root
    );

    return stack ?? this.params.politeness;
  };



  // ---- messages coming in -------------------------------------------------

  // The messages the author wrote into the stack. Their content is left
  // exactly as it is — this module never rewrites what an author put on the
  // page — so all they get is the way out and the timer.
  adoptAuthoredItems = () => {
    const items = this.root.querySelectorAll(`[${this.params.itemAttr}]`);
    for (const item of items) this.enhanceItem(item);
  };



  // The one way a message reaches the stack at runtime: the event and the
  // triggers both end up here.
  show = (options) => {
    const item = this.createItem(options);
    if (!item) return null;

    // Culled before the new message is added rather than after, so the stack
    // is never one message taller than its own maximum, not even for a frame.
    this.enforceMax();

    this.root.append(item);

    // In this order: the announcement is taken from the item's text, and the
    // dismiss control enhanceItem injects would otherwise be part of it.
    const announcement = this.announce(item);
    this.enhanceItem(item, announcement);

    return item;
  };



  // Builds the message. It carries the same attributes an author would have
  // written, so everything below it — the timer, the announcement, the
  // stylesheet — reads one kind of item and not two, and the inspector shows
  // the authored form of what is on screen.
  createItem = (options) => {
    const params = this.params;

    const body = this.createBody(options);
    if (!body) return null;

    const item = document.createElement(this.itemTag);
    item.setAttribute(params.itemAttr, '');
    item.setAttribute(
      params.variantAttr, this.normaliseVariant(options.variant, options.source)
    );

    // Only when the request actually asked for them: absent, they fall
    // through to the stack's own defaults, which is what "not specified"
    // should mean.
    if (options.duration !== undefined && options.duration !== null &&
        options.duration !== '') {
      item.setAttribute(params.durationAttr, String(options.duration));
    }
    if (options.politeness) {
      item.setAttribute(params.politenessAttr, String(options.politeness));
    }

    item.append(body);

    return item;
  };



  // The content: a <template> the project authored, or the plain message. A
  // template rather than a string of HTML, because a message is data — it
  // comes from a form, a server, a filename — and parsing data as markup is
  // how a notification becomes an injection. It is also the answer to a
  // message that needs a control in it: the project writes that control, with
  // its own listener, and this module only clones it.
  createBody = (options) => {
    const params = this.params;
    const templateId =
      typeof options.template === 'string' ? options.template.trim() : '';

    if (templateId) {
      const template = document.getElementById(templateId);
      if (template instanceof HTMLTemplateElement) {

        // A <div>, not a <p>: a template may well hold block content, which a
        // paragraph cannot contain.
        const body = document.createElement('div');
        body.setAttribute(params.bodyAttr, '');
        body.append(template.content.cloneNode(true));

        return body;
      }

      this.reporter?.report(
        'toast',
        `no <template id="${templateId}"> on the page — falling back to the ` +
        'plain message, if the request carried one.',
        options.source ?? this.root
      );
    }

    const message =
      typeof options.message === 'string' ? options.message.trim() : '';
    if (!message) {
      this.reporter?.report(
        'toast',
        'a message was requested with nothing to say — give it a message ' +
        `(${params.messageAttr} / detail.message) or a template ` +
        `(${params.templateAttr} / detail.template).`,
        options.source ?? this.root
      );
      return null;
    }

    const body = document.createElement('p');
    body.setAttribute(params.bodyAttr, '');
    body.textContent = message;

    return body;
  };



  // Everything a message needs once it is in the stack, whichever way it got
  // there: the way out, and the timer that takes it away by itself.
  enhanceItem = (item, announcement = null) => {
    const params = this.params;

    // Read before the dismiss control is injected, so the way out this module
    // adds itself cannot count as "the message holds something to operate"
    // (see durationFor).
    const actionable = item.querySelector(focusableSelector) !== null;

    if (!item.querySelector(`[${params.dismissAttr}]`)) {
      item.append(this.createDismissControl());
    }

    const duration = this.durationFor(item, actionable);
    this.tracked.set(item, {
      announcement,
      duration,
      remaining: duration,
      timeoutId: null,
      startedAt: 0,
    });

    if (!this.paused) this.startTimer(item);
  };



  // A control the reader operates: the glyph plus a real text node naming it.
  // A text node rather than aria-label, because it still names the control
  // when this component's stylesheet is missing — and the glyph is
  // aria-hidden, so the text is the only name there is.
  createDismissControl = () => {
    const params = this.params;

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute(params.dismissAttr, '');
    button.insertAdjacentHTML('afterbegin', closeIcon);

    const label = document.createElement('span');
    label.setAttribute(params.labelAttr, '');
    label.textContent = this.labels.close;
    button.append(label);

    return button;
  };



  // ---- the timer (see file header, gap 3) ---------------------------------

  // How long a message stays, in ms; zero means "until it is dismissed".
  //
  // A message holding a control of its own is always zero, whatever the
  // attributes say. The reader has to be able to reach that control, and a
  // countdown running against them while they do is the one thing a toast
  // must not be (WCAG 2.2.1). An explicit duration on such a message is
  // therefore reported rather than obeyed — the markup is asking for two
  // things that cannot both be true. A duration inherited from the stack is
  // not: that one is a default for messages in general, not a statement about
  // this one.
  durationFor = (item, actionable) => {
    const params = this.params;
    const own = item.getAttribute(params.durationAttr);
    const configured = this.readDuration(
      own ?? this.root.getAttribute(params.durationAttr), item
    );

    if (!actionable) return configured;

    if (own !== null && configured > 0) {
      this.reporter?.report(
        'toast',
        `${params.durationAttr}="${own}" is ignored on a message that holds a ` +
        'control of its own: it stays until it is dismissed, so the reader ' +
        'can reach that control (WCAG 2.2.1).', item
      );
    }

    return 0;
  };



  readDuration = (raw, el) => {
    if (raw === null) return this.params.duration;

    // Number() rather than parseInt(): "6s" is not a number of
    // milliseconds, and parseInt would read it as 6 and quietly make the
    // message flash past instead of saying that the value is wrong. The
    // empty-string guard is because Number('') is 0, which would then look
    // like a deliberate "stays until dismissed".
    const value = raw.trim();
    const parsed = value === '' ? NaN : Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;

    this.reporter?.report(
      'toast',
      `unknown ${this.params.durationAttr} value "${raw}" — expected a number ` +
      `of milliseconds, or 0 to keep the message. Falling back to ` +
      `${this.params.duration}.`, el
    );

    return this.params.duration;
  };



  startTimer = (item) => {
    const entry = this.tracked.get(item);
    if (!entry || entry.duration <= 0) return;

    entry.startedAt = performance.now();
    entry.timeoutId = setTimeout(
      () => this.dismiss(item), Math.max(0, entry.remaining)
    );
  };



  // Freezes a countdown with the time that was left on it. Not restarted from
  // the full duration on resume: a reader who moved the pointer across the
  // stack should not be handed the whole duration again, and one who read
  // half of the message should not lose the other half.
  holdTimer = (item) => {
    const entry = this.tracked.get(item);
    if (!entry?.timeoutId) return;

    clearTimeout(entry.timeoutId);
    entry.timeoutId = null;
    entry.remaining = Math.max(
      0, entry.remaining - (performance.now() - entry.startedAt)
    );
  };



  // The three situations in which no message may expire: the pointer is over
  // the stack, the focus is inside it, or the tab is not in front of the
  // reader. The first two are what makes the time limit adjustable in
  // practice — a reader who wants longer hovers or tabs to the message — and
  // the focus one is also what keeps a timer from pulling a control out from
  // under the reader who is about to press it.
  syncPaused = () => {
    const paused = this.hovered || this.focused || document.hidden;
    if (paused === this.paused) return;

    this.paused = paused;
    for (const item of this.tracked.keys()) {
      paused ? this.holdTimer(item) : this.startTimer(item);
    }
  };



  handlePointerEnter = () => {
    this.hovered = true;
    this.syncPaused();
  };



  handlePointerLeave = () => {
    this.hovered = false;
    this.syncPaused();
  };



  // The way back, remembered on the way in: a focusout tells us nothing,
  // because by then the element the reader came from is no longer the one
  // losing the focus. relatedTarget is null for a focus that came from
  // nowhere (a fresh page, a click on the background), which is a perfectly
  // good "nothing to go back to".
  handleFocusIn = (event) => {
    if (!this.root.contains(event.relatedTarget)) {
      this.focusReturn = event.relatedTarget;
    }

    this.focused = true;
    this.syncPaused();
  };



  handleFocusOut = (event) => {
    if (this.root.contains(event.relatedTarget)) return;

    this.focused = false;
    this.syncPaused();
  };



  // ---- messages going out -------------------------------------------------

  dismiss = (item) => {
    if (!item || !this.tracked.has(item)) return;

    const entry = this.tracked.get(item);
    this.holdTimer(item);
    this.tracked.delete(item);

    // While the message is still in the document: a node removed from under
    // the focus drops it to <body>, and the reader's next Tab would start
    // over at the top of the page.
    if (item.contains(document.activeElement)) this.moveFocusOut(item);

    entry.announcement?.remove();
    this.removeItem(item);
  };



  // Where the focus goes when the message holding it leaves: the next message
  // in the stack if there is one — the reader is working through them — and
  // otherwise back where they came from. If neither exists the focus falls to
  // <body>, which is the case this method exists to avoid and the reason the
  // stack belongs early in the document (see the readme).
  moveFocusOut = (item) => {
    const items = this.visibleItems();
    const index = items.indexOf(item);
    const neighbour = items[index + 1] ?? items[index - 1];

    const next = neighbour?.querySelector(`[${this.params.dismissAttr}]`);
    if (next) {

      // preventScroll because this is bookkeeping, not navigation: the stack
      // is fixed to the viewport, so the control is already in view.
      next.focus({ preventScroll: true });
      return;
    }

    // Scrolled into view on purpose here — the reader may have moved a long
    // way from where they were when they came to the stack.
    if (typeof this.focusReturn?.focus === 'function' &&
        this.focusReturn.isConnected) {
      this.focusReturn.focus();
    }
  };



  // Hands the message to the stylesheet and removes it once whatever that
  // started has finished. The duration is asked of the element rather than
  // duplicated here as a number this module would have to keep in step with
  // the CSS: getAnimations() reports exactly the transitions and animations
  // actually running on it, so a stylesheet that animates nothing — a
  // reduced-motion preference, this component's CSS missing altogether —
  // returns an empty list and the message goes at once. allSettled because
  // removing an element cancels its animations, and a cancelled animation
  // rejects.
  removeItem = (item) => {
    item.setAttribute(this.params.stateAttr, this.params.leavingState);

    // An engine that cannot be asked has to be told, or the message would
    // never leave at all — the one failure mode worse than a missing exit
    // animation.
    if (typeof item.getAnimations !== 'function') {
      item.remove();
      return;
    }

    // Reading a computed value flushes the style change just made, which is
    // what creates the transition. Without it getAnimations() would be asked
    // before there is anything to report, and every message would vanish
    // without its exit.
    void getComputedStyle(item).transitionDuration;

    const running = item.getAnimations().map((animation) => animation.finished);
    Promise.allSettled(running).then(() => item.remove());
  };



  // The ceiling on the stack. Called with room for one more, since the caller
  // is about to add it.
  enforceMax = () => {
    const max = this.readMax();
    if (max <= 0) return;

    const items = this.visibleItems();
    const surplus = items.length - max + 1;
    for (const item of items.slice(0, Math.max(0, surplus))) this.dismiss(item);
  };



  readMax = () => {
    const raw = this.root.getAttribute(this.params.maxAttr);
    if (raw === null) return this.params.max;

    const value = raw.trim();
    const parsed = value === '' ? NaN : Number(value);
    if (Number.isInteger(parsed) && parsed >= 1) return parsed;

    this.reporter?.report(
      'toast',
      `unknown ${this.params.maxAttr} value "${raw}" — expected a whole ` +
      `number of 1 or more. Falling back to ${this.params.max}.`, this.root
    );

    return this.params.max;
  };



  // The messages that are on screen and staying: one already on its way out
  // is still in the document while it fades, but it is not something the
  // maximum should count or the focus should be moved to.
  visibleItems = () => {
    const params = this.params;
    const selector =
      `[${params.itemAttr}]:not([${params.stateAttr}='${params.leavingState}'])`;

    return [...this.root.querySelectorAll(selector)];
  };



  // ---- the ways in --------------------------------------------------------

  handleRootClick = (event) => {
    const control = event.target.closest?.(`[${this.params.dismissAttr}]`);
    if (!control) return;

    this.dismiss(control.closest(`[${this.params.itemAttr}]`));
  };



  handleRootKeydown = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;

    const item = event.target.closest?.(`[${this.params.itemAttr}]`);
    if (!item || !this.tracked.has(item)) return;

    // Taken, so the same press cannot also close a dialog the stack happens
    // to sit in: the reader meant the message they were in.
    event.preventDefault();
    this.dismiss(item);
  };



  // The event any code on the page can fire. Handled on the document and on
  // the stack, because a project may reasonably dispatch it on either — and
  // deduped, because one that bubbles from the stack arrives at both.
  //
  // detail may be the options object or, as a shorthand, the message string.
  handleShowEvent = (event) => {
    if (this.handledEvents.has(event)) return;
    this.handledEvents.add(event);

    const detail = typeof event.detail === 'string'
      ? { message: event.detail }
      : (event.detail ?? {});

    if (!this.owns(detail.target, event.target)) return;

    this.show({
      message: detail.message,
      template: detail.template,
      variant: detail.variant,
      duration: detail.duration,
      politeness: detail.politeness,
      source: event.target instanceof Element ? event.target : this.root,
    });
  };



  // A control that shows a message declaratively — the case that needs no
  // project script at all. The press is never taken: the control is doing
  // something else (submitting, copying, deleting) and the message is the
  // feedback, not the action. Modified and non-primary presses are left alone
  // for the same reason a link's are — they mean "new tab", "download",
  // "copy the address", and none of those is the action the message reports.
  handleTriggerClick = (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const params = this.params;
    const trigger = event.target.closest?.(`[${params.triggerAttr}]`);
    if (!trigger) return;

    if (!this.owns(trigger.getAttribute(params.triggerAttr), trigger)) return;

    this.show({
      message: trigger.getAttribute(params.messageAttr),
      template: trigger.getAttribute(params.templateAttr),
      variant: trigger.getAttribute(params.variantAttr),
      duration: trigger.getAttribute(params.durationAttr),
      politeness: trigger.getAttribute(params.politenessAttr),
      source: trigger,
    });
  };



  // Whose message is this? Two ways to say it, and each answers a different
  // situation:
  //
  // - A value names the stack by id, the way dialog's triggers name their
  //   dialog. That is what lets a page carry more than one — the usual reason
  //   being a stack inside a modal <dialog>, because a fixed element outside
  //   it cannot be painted over the top layer.
  // - No value means the stack the request came from, if it came from inside
  //   one, and otherwise the page's only stack — which is the normal case and
  //   needs no id at all.
  //
  // With several stacks and nothing to tell them apart the request is
  // ambiguous, and it is dropped rather than guessed at: a message shown in
  // the wrong place is a message the reader never sees.
  owns = (target, source) => {
    const id = typeof target === 'string' ? target.trim() : '';
    if (id) return this.root.id !== '' && this.root.id === id;

    if (source instanceof Node && this.root.contains(source)) return true;
    if (regions.size === 1) return true;

    this.reportAmbiguous(source);

    return false;
  };



  // Reported by one stack only — the first one initialised — because every
  // stack on the page runs this and the finding is about the request, not
  // about any of them.
  reportAmbiguous = (source) => {
    if (regions.values().next().value !== this) return;

    const subject = source instanceof Element ? source : this.root;
    if (this.reportedAmbiguity.has(subject)) return;
    this.reportedAmbiguity.add(subject);

    this.reporter?.report(
      'toast',
      `the page has ${regions.size} toast stacks, so a request has to name ` +
      `one: give the stack an id and pass it as ${this.params.triggerAttr}=` +
      '"<id>" (or detail.target). Nothing was shown.', subject
    );
  };



  variantOf = (item) =>
    this.normaliseVariant(item.getAttribute(this.params.variantAttr), item);



  normaliseVariant = (raw, source) => {
    if (raw === null || raw === undefined) return this.params.variant;

    const value = String(raw).trim();
    if (value === '') return this.params.variant;
    if (variants.includes(value)) return value;

    this.reporter?.report(
      'toast',
      `unknown ${this.params.variantAttr} value "${value}" — expected one of ` +
      `${variants.join(', ')}. Falling back to "${this.params.variant}".`,
      source instanceof Element ? source : this.root
    );

    return this.params.variant;
  };



  // Returns null rather than a default, so the caller can fall through to the
  // next source (the message's own value, then the variant, then the stack's).
  readPoliteness = (raw, el) => {
    if (raw === null || raw === undefined) return null;

    const value = String(raw).trim();
    if (value === '') return null;
    if (politenessLevels.includes(value)) return value;

    this.reporter?.report(
      'toast',
      `unknown ${this.params.politenessAttr} value "${value}" — expected ` +
      `${politenessLevels.join(' or ')}.`, el
    );

    return null;
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly
  // instead of doing a full page (re)load — see destroyModulesInScope() in
  // boot.js. Three kinds of state outlive the stack's own subtree here: the
  // two delegated document listeners, the pending timers (a timer that fires
  // afterwards would reach into a detached tree) and the two live regions,
  // which sit next to the root rather than inside it.
  destroy = () => {
    regions.delete(this);

    document.removeEventListener(this.params.showEvent, this.handleShowEvent);
    document.removeEventListener('click', this.handleTriggerClick);
    document.removeEventListener('visibilitychange', this.syncPaused);

    this.root.removeEventListener('click', this.handleRootClick);
    this.root.removeEventListener('keydown', this.handleRootKeydown);
    this.root.removeEventListener('pointerenter', this.handlePointerEnter);
    this.root.removeEventListener('pointerleave', this.handlePointerLeave);
    this.root.removeEventListener('focusin', this.handleFocusIn);
    this.root.removeEventListener('focusout', this.handleFocusOut);
    this.root.removeEventListener(this.params.showEvent, this.handleShowEvent);

    for (const item of [...this.tracked.keys()]) this.holdTimer(item);
    this.tracked.clear();

    this.announcers.polite.remove();
    this.announcers.assertive.remove();

    // The authored messages are handed back as they were written: without the
    // module the dismiss control does nothing, so it must not be left behind
    // on the page.
    const controls = this.root.querySelectorAll(`[${this.params.dismissAttr}]`);
    for (const control of controls) control.remove();
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'toast',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new Toast(el, defaults, reporter);
  return instance.destroy;
}
