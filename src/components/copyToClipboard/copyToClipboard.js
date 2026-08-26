/**
 * copyToClipboard.js
 * ----------------------------------------------------------------------------
 * Puts a string into the visitor's clipboard on one press: a code snippet, a
 * coupon code, an IBAN, a share link. The visible half of that is three lines
 * anybody can write, which is why the control is everywhere and why so few of
 * them are usable — what is missing is the other half. A copy leaves no trace
 * on the page: no navigation, no value that changed, no element that appeared.
 * Whoever cannot see the checkmark flash is told nothing at all, and the
 * usual attempt to fix that — swapping the button's label from "Copy" to
 * "Copied" — moves the focused control's own accessible NAME under the
 * reader, which is announced as a different button rather than as a result.
 *
 * So this module is the announcement, the state hook and the failure path;
 * everything visible is the project's (see the styling contract below).
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * - The clipboard write itself: navigator.clipboard.writeText() is one call,
 *   it needs a user gesture and a secure context, and both are the platform's
 *   rules rather than this module's. Where it is not there — a page served
 *   over plain http, an engine too old — the control stays hidden and the
 *   reader keeps the page they had: the text is on screen, selectable, and
 *   Ctrl+C is theirs. No document.execCommand("copy") fallback is shipped;
 *   it is deprecated, and an insecure origin is a deployment to fix rather
 *   than a browser to work around.
 * - A <button> is keyboard operable, has a role, takes Enter and Space and
 *   announces itself. Nothing here adds a tabindex or a key handler.
 * - An element carrying aria-live is watched by the accessibility layer, and
 *   text put into it is read out without the focus moving. That is the whole
 *   announcement mechanism; this module only decides what goes in and when.
 *
 * And then the ladder stops: there is no attribute, no element and no
 * pseudo-class that copies anything, so the control is dead without a script.
 * Which is why it ships `hidden` in the markup and this module reveals it —
 * video does the same with its play/pause toggle, and where that works it
 * beats any CSS pre-enhancement state, because it needs no ready attribute
 * and no media query (see docs/preEnhancement.md §4). Every bail-out below
 * therefore simply returns: a control this module cannot work stays hidden,
 * which is exactly what it is.
 *
 * What this script adds
 * ---------------------
 * 1. The press: reads the source (see readSource), writes it, and does
 *    nothing else — no focus move, no scroll, no selection of the reader's
 *    making. Where the copy button is, the reader already is.
 * 2. The announcement, through a polite live region the module puts after the
 *    button — one sentence when the text is in the clipboard, another when it
 *    could not be. A NEW node per announcement, because re-assigning the same
 *    text to the same node is not a change and would not be announced: the
 *    second "Copied" would be silent (toast's announcer rests on the same
 *    observation). The sentence is taken out again when the state is, so a
 *    reader moving through the page with a virtual cursor later does not
 *    find a stale result standing where nothing is shown any more.
 * 3. The state, as one attribute the project's CSS reacts to:
 *    data-copy-state="copied" | "error", on the button AND on the source
 *    element where there is one, dropped again after data-copy-duration. It
 *    is a styling hook only — the reader is told in words, not by a colour.
 *    The two channels start and end together: whatever the duration says,
 *    it says for both, and data-copy-duration="0" keeps both standing. Where
 *    two controls copy the same box, the state on that box belongs to the
 *    last press: an earlier control's timer no longer takes it off (see
 *    stateOwners).
 * 4. The failure path, which a hand-written copy button never has: a rejected
 *    write, a target that is not in the document, a source that is empty. All
 *    three end in the same reported, announced, styleable error state.
 * 5. Two events — "copy:copied" and "copy:failed" — for a message of the
 *    project's own. This is the seam to `toast`: the outcome is known only
 *    after the write settles, so a declarative data-toast-trigger on the same
 *    button would report a success it cannot have seen yet.
 *
 * What it deliberately does not do
 * -------------------------------
 * - **text/plain only.** A copy that also carries text/html is a different
 *   promise — what the receiving application pastes then depends on which of
 *   the two it prefers — and this component's promise is the string the
 *   reader can see.
 * - **It never writes an empty string.** writeText("") would replace whatever
 *   the reader had in the clipboard with nothing, and taking something away
 *   is the one thing a copy button must not do. An empty source is a failure,
 *   not a copy.
 * - **It does not select the text as a consolation.** On a failed write the
 *   text stays exactly where it was — selectable, untouched. Moving the
 *   reader's selection for them is a different action from the one they
 *   pressed, and it would also throw away a selection they had.
 *
 * Accessibility
 * -------------
 * - The focus never moves. The button keeps it, so the reader can press it
 *   twice, or carry on tabbing, without being put somewhere.
 * - The button's accessible name never changes. What happened is said by the
 *   live region; a name that changed under a focused control would be
 *   announced as a new control instead of as a result. (passwordToggle keeps
 *   its name constant for the neighbouring reason.)
 * - The region is polite, not assertive, and it holds both outcomes. The
 *   reader pressed a button and is waiting for exactly this sentence a few
 *   hundred milliseconds later, so there is nothing to interrupt — assertive
 *   is for what happens to a reader unbidden. A project that wants the
 *   failure louder routes it through `toast` (whose error variant is
 *   assertive) and opts this announcement out.
 * - Where the built-in wording is not the page's language, the announced line
 *   carries its own lang, so a screen reader pronounces it with the right
 *   rules instead of reading "Copied to the clipboard." in a French voice
 *   (WCAG 3.1.2). An author's own wording is in the page's language by
 *   definition and is left alone.
 * - The state attribute is never the only channel: everything it draws is
 *   also said. That is WCAG 4.1.3 for a status message, and it is the half a
 *   checkmark-only copy button is missing.
 * - Naming the button is the project's job — an icon-only copy control needs
 *   a visually-hidden text node or an aria-label, and there are as many of
 *   them on one page as there are snippets, so "Copy" alone may not
 *   distinguish them.
 *
 * Configuration (attributes on the <button> itself, which is also where
 * data-js-behavior="copyToClipboard" goes)
 * ----------------------------------------------------------------------------
 * - data-copy-target="<selector>"   the element whose visible text is copied,
 *                                   resolved against the document and
 *                                   re-resolved on every press.
 * - data-copy-text="…"              a literal string instead. One of the two
 *                                   is required; with both, this one wins and
 *                                   the other is reported.
 * - data-copy-copied-text="…"       what the announcement says on success.
 *                                   {text} interpolates the copied string.
 *                                   Default: the built-in sentence for
 *                                   <html lang>. An EMPTY value opts the
 *                                   announcement out — which is what to do
 *                                   when a toast says it instead.
 * - data-copy-error-text="…"        the same for a failed copy.
 * - data-copy-duration="2000"       ms the outcome stands: the state
 *                                   attribute on the button and the source,
 *                                   and the sentence in the live region. 0
 *                                   keeps both until the next press.
 *
 * Styling contract
 * ----------------
 * Behaviour-first, and there is no look to offer: a copy button is one of the
 * project's own buttons, standing in a toolbar next to its siblings, so a
 * shipped vocabulary would only be something to override. The stylesheet
 * therefore ships one rule, and it is an accessibility necessity rather than
 * a design choice — the injected live region has to be visually hidden.
 * Everything else is a hook this module only ever WRITES:
 *   - [data-copy-state="copied" | "error"]  on the button and on the source
 *   - .copy-srStatus / [data-copy-status]   the injected live region
 * See copyToClipboard.scss.
 * ----------------------------------------------------------------------------
 */



// resolveLocale picks the built-in wording from <html lang> the way every
// other component here does; formatTemplate interpolates {text} into a
// wording the author supplied; parseNonNegative reads the duration option.
import { resolveLocale } from './resolveLocale.js';
import { formatTemplate } from './formatTemplate.js';
import { parseNonNegative } from './parseNonNegative.js';



const defaults = {

  // Where the text comes from. Exactly one per control: an element in the
  // document, or a literal string. Behavioural data attributes rather than
  // classes, so the JS stays decoupled from the CSS.
  targetAttr: 'data-copy-target',
  textAttr: 'data-copy-text',

  // Wording overrides for the two announcements, {text} interpolated. An
  // empty value means "say nothing" — the lane for a project that announces
  // through toast and must not have it said twice.
  copiedTextAttr: 'data-copy-copied-text',
  errorTextAttr: 'data-copy-error-text',

  // How long the outcome stands — the state attribute AND the sentence in
  // the live region, which end together. 2 s is long enough to be seen, long
  // enough for the announcement to have been taken, and short enough that a
  // second press reads as a second copy; 0 holds both until the next press,
  // for a design where the checkmark is meant to stand.
  durationAttr: 'data-copy-duration',
  duration: 2000,

  // The one visible hook, written on the button and on the source element.
  // Same shape as loadFragment's data-fragment-state, and for the same
  // reason: the state of an action belongs on the thing it happened to.
  stateAttr: 'data-copy-state',
  copiedState: 'copied',
  errorState: 'error',

  // The injected live region. The class is the styling hook (its one shipped
  // rule is the visually-hidden recipe), the attribute is what an inspector
  // and a project's own selector find it by.
  statusClass: 'copy-srStatus',
  statusAttr: 'data-copy-status',

  // The seam for a message of the project's own — a toast, a log line, an
  // analytics call. Namespaced, so neither can collide with the platform's
  // own "copy" event, which is a different thing entirely (a copy the reader
  // triggered on a selection).
  copiedEvent: 'copy:copied',
  failedEvent: 'copy:failed',

  // <html lang> matching none of the locales in `labels` falls back to this.
  fallbackLocale: 'en',
};



// What the live region says, keyed by locale then by outcome. Full sentences,
// because a screen reader reads them on their own with nothing around them.
//
// Neither built-in sentence quotes the copied text: a snippet of twelve lines
// read out in full is not a confirmation. {text} is offered to an author who
// knows their value is short — a coupon code, an order number — and it is
// interpolated into their wording, not into these.
const labels = {

  de: {
    copied: 'In die Zwischenablage kopiert.',
    error: 'Kopieren nicht möglich. Der Text lässt sich von Hand markieren und kopieren.',
  },

  en: {
    copied: 'Copied to the clipboard.',
    error: 'Copying failed. The text can still be selected and copied by hand.',
  },
};



// Who last wrote the state attribute onto a source element. Two controls may
// point at the SAME box — the shipped snippet does exactly that, a copy
// button and a "copied by toast" one on one snippet — and each holds a timer
// of its own. Without this, the first one's settle() takes the attribute off
// the box while the second one's state is still meant to stand, and the
// snippet stops being marked while the button that copied it still says it
// was.
//
// A WeakMap rather than an instance field, because the question is about the
// element: "whose state is on you right now". It is a registry of peers, the
// way embedConsent holds its group — not a collection this component owns
// (see CLAUDE.md) — and the weak key means a source that leaves the document
// takes its entry with it.
const stateOwners = new WeakMap();



class CopyToClipboard {

  // The pending end of the outcome: one timer for both channels, because the
  // state attribute and the sentence in the live region are two halves of
  // the same report and go away together (see settle). One per control,
  // cleared on every press, so pressing twice in a row is two full states
  // rather than one that ends early.
  timer = 0;

  // The element the state attribute was last written to, held rather than
  // looked up again: the source is re-resolved on every press, and the
  // attribute has to come off whatever it went on.
  stateTarget = null;

  // The injected live region, or null where both announcements are switched
  // off and none was built (see buildStatus).
  status = null;

  // The element the last press read from, set by readSource and read by
  // setState — null for the literal lane, where there is no source element.
  source = null;

  // Whether this module took the `hidden` attribute off, so destroy() only
  // puts back what it removed (an author who forgot it gets nothing added).
  revealed = false;

  // Whether destroy() has run. A clipboard write that is still in flight
  // settles a task or two later, into succeed() or fail(), and by then this
  // module may have been handed back: the outcome would write the state
  // attribute onto a button that is `hidden` again, start a timer nobody
  // clears, and dispatch an event for a control that is gone. The promise
  // cannot be cancelled, so it is caught on arrival instead.
  destroyed = false;



  constructor(button, config, reporter) {
    this.button = button;
    this.config = config;
    this.reporter = reporter;

    const locale = resolveLocale(Object.keys(labels), config.fallbackLocale);
    this.locale = labels[locale] ? locale : config.fallbackLocale;
    this.labels = labels[this.locale];

    // The language to mark this module's own sentences with — but only where
    // it is not the page's already: <html lang="fr"> gets the English
    // wording, and English text inside a French page has to say so (WCAG
    // 3.1.2), while lang="de" inside a German page is noise. The test is
    // resolveLocale's matching read backwards, so lang="de-CH" resolving to
    // "de" counts as the page's language and adds nothing.
    const pageLocale = (document.documentElement.lang || '').toLowerCase();
    this.labelsLang =
      pageLocale === this.locale || pageLocale.split('-')[0] === this.locale
        ? null
        : this.locale;

    // The literal lane is decided by the attribute being PRESENT, not by it
    // having content: data-copy-text="" is an author saying "copy nothing",
    // which is a mistake worth the failure path rather than a reason to go
    // looking for a target.
    this.literal = button.getAttribute(config.textAttr);
    this.selector = button.getAttribute(config.targetAttr) || '';

    this.texts = {
      copied: this.wording(config.copiedTextAttr, this.labels.copied),
      error: this.wording(config.errorTextAttr, this.labels.error),
    };

    this.duration = parseNonNegative(
      button.getAttribute(config.durationAttr), config.duration
    );

    this.setup();
  }



  setup = () => {
    this.buildStatus();

    this.button.addEventListener('click', this.handleClick);

    // Last, and this component's whole pre-enhancement story: the control
    // ships `hidden` and is revealed once it can actually copy something.
    // Every bail-out in init() returns before this line, so a control that
    // cannot work is never shown — and a chunk that never arrives leaves the
    // page exactly as it was authored, with the text on screen and Ctrl+C
    // where it always was.
    if (this.button.hidden) {
      this.button.hidden = false;
      this.revealed = true;
    }
  };



  // A wording, plus whose it is. The distinction is not cosmetic: this
  // module's own sentence may be in a language the page is not, and has to
  // say so; an author's sentence was written for this page and must never be
  // claimed to be in another language (see announce).
  wording = (attr, builtIn) => {
    const authored = this.button.getAttribute(attr);

    if (authored === null) return { text: builtIn, builtIn: true };

    return { text: authored.trim(), builtIn: false };
  };



  // The live region, built at init and not with the first press: a region
  // inserted and filled in one go is announced by nobody — an engine reports
  // that as "a region appeared", i.e. as nothing.
  //
  // A <span>, so it is valid content wherever a button may stand: inside a
  // <p>, a heading, a <pre>, a table cell. It goes after the button rather
  // than on <body>, so it inherits the lang of what surrounds it and needs no
  // bookkeeping outside this subtree.
  //
  // Not role="status": that implies aria-atomic="true", and the whole region
  // would be re-read on every addition. aria-live="polite" is the same
  // announcement without the re-reading (toast's announcers are built this
  // way for the same reason), and it is what WCAG 4.1.3 asks for.
  // Both wordings emptied is a legitimate lane — the one for a project whose
  // toast says the result instead, where a second announcement would only
  // have the reader told twice. It is also the one configuration in which
  // this component can be wired up and still leave a screen-reader user with
  // nothing, so it is worth a line in the console: a page that reaches this
  // branch and has no listener on copy:copied / copy:failed reports the
  // outcome nowhere at all.
  buildStatus = () => {
    if (!this.texts.copied.text && !this.texts.error.text) {
      this.reporter?.report(
        'copyToClipboard',
        'both announcements are switched off, so no live region is built ' +
        'and this module says nothing. That is right only where something ' +
        'else says it — a toast listening for copy:copied / copy:failed. ' +
        'Without one, a screen reader is told nothing at all.',
        this.button
      );
      return;
    }

    const region = document.createElement('span');
    region.className = this.config.statusClass;
    region.setAttribute(this.config.statusAttr, '');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'false');

    this.button.after(region);
    this.status = region;
  };



  handleClick = () => {
    const text = this.readSource();

    // Emptied on the press, filled when the write settles. Two reasons, and
    // both matter: the previous outcome is stale the moment the reader
    // presses again, and clearing now puts the next sentence into a region
    // that is empty — so copying the same text twice is a real change in the
    // region and gets announced, where a second identical assignment would
    // have been silent.
    //
    // settle() empties it too, when the duration is up. This line is not
    // redundant with that one: it also covers the press that lands INSIDE
    // the duration, and the data-copy-duration="0" lane, where settle never
    // runs at all.
    this.status?.replaceChildren();

    if (!text) {

      // One task later, and for exactly the reason the region is emptied
      // above: emptying and refilling it inside ONE task is not a change the
      // accessibility layer can see, so a second identical failure in a row
      // would be silent — which is the failure of the checkmark-only copy
      // button, in the one place this module can still commit it. The write
      // path gets that gap for free, because its promise settles in a task of
      // its own; this path has to take one. Untracked on purpose: a teardown
      // in between is caught by the destroyed guard in fail().
      setTimeout(() => this.fail(text, null), 0);
      return;
    }

    // Nothing is awaited before this call. The clipboard write consumes the
    // press's transient activation, and an engine that has already yielded
    // to another task rejects it.
    navigator.clipboard.writeText(text).then(
      () => this.succeed(text),
      (error) => this.fail(text, error)
    );
  };



  // What goes into the clipboard: the text the reader can SEE. For a form
  // control that is its value, for anything else the text inside it.
  //
  // textContent rather than innerText, which is a rendering: it collapses
  // whitespace, and the indentation of a code block is the single most common
  // thing a copy button is pointed at. The outer edges ARE trimmed, because
  // in a pretty-printed document they are the indentation of the markup
  // rather than anything the reader can see; what sits between the first and
  // the last character is left exactly as authored.
  //
  // Anything that is not visible text — a link's href, a data attribute, the
  // page's own URL — belongs in data-copy-text, where the project puts the
  // string it means. Pointing at an <a> copies its label, because that is
  // what the label is.
  readSource = () => {
    if (this.literal !== null) {
      this.source = null;
      return this.literal;
    }

    // Re-resolved on every press rather than held from init: the box may be
    // filled after this module ran (a fragment loaded, a template rendered),
    // and its content may have been replaced since the last press.
    // loadFragment re-resolves its target for the same reason.
    const target = document.querySelector(this.selector);
    this.source = target;

    if (!target) {
      this.reporter?.report(
        'copyToClipboard',
        `nothing matches "${this.selector}", so there is nothing to copy.`,
        this.button
      );
      return '';
    }

    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return target.value;
    }

    return target.textContent.trim();
  };



  succeed = (text) => {
    if (this.destroyed) return;

    this.setState(this.config.copiedState);
    this.announce(this.texts.copied, text);
    this.emit(this.config.copiedEvent, { text });
  };



  // Every way this can go wrong ends here: a rejected write (no permission,
  // a document that lost the focus in the meantime), a target that is not in
  // the document, a source that is empty. The reader is told the same thing
  // in all three cases, because from where they are standing it IS the same
  // thing — the text is not in their clipboard. Which of the three it was is
  // the developer's business, and that goes to the reporter: a missing target
  // has already reported itself in readSource, a rejected write reports here.
  //
  // Nothing is reported after a teardown either: a write that settles into a
  // module the host has already handed back is not the project's problem, and
  // the control it would point at is gone.
  fail = (text, error) => {
    if (this.destroyed) return;

    if (error) {
      this.reporter?.report(
        'copyToClipboard',
        `the clipboard write was refused: ${error.message || error}.`,
        this.button
      );
    }

    this.setState(this.config.errorState);
    this.announce(this.texts.error, text);
    this.emit(this.config.failedEvent, { text, error: error || null });
  };



  // The visible channel, and the whole of it: one attribute, on the button
  // and on the source element where there is one — so a rule can flash the
  // snippet that was copied, not only the control that copied it. Written,
  // never read back, and never the only channel (see announce).
  setState = (state) => {
    clearTimeout(this.timer);

    // Off whatever it was last on, which may not be what it is going on now:
    // the source is re-resolved per press and the selector may have found a
    // different element.
    this.clearState();

    this.button.setAttribute(this.config.stateAttr, state);

    // Written and claimed in one step: from here on this instance is the one
    // whose settle() may take it off again (see clearState).
    this.stateTarget = this.source instanceof Element ? this.source : null;

    if (this.stateTarget) {
      stateOwners.set(this.stateTarget, this);
      this.stateTarget.setAttribute(this.config.stateAttr, state);
    }

    if (!this.duration) return;

    this.timer = setTimeout(this.settle, this.duration);
  };



  // The button's own attribute is always this instance's to remove — nothing
  // else writes it there. The source's is not: another control may have
  // copied the same box in the meantime, and its state is meant to stand for
  // its own duration. So the attribute comes off only where this instance is
  // still the last writer, which is what the stateOwners registry answers.
  clearState = () => {
    this.button.removeAttribute(this.config.stateAttr);

    if (this.stateTarget && stateOwners.get(this.stateTarget) === this) {
      this.stateTarget.removeAttribute(this.config.stateAttr);
      stateOwners.delete(this.stateTarget);
    }

    this.stateTarget = null;
  };



  // What the duration is up for, and it is both halves of the report at once.
  //
  // Taking the sentence back out is not cosmetic. A live region is announced
  // on the change, so the words have long been spoken by the time this runs —
  // but the node stays in the document, and a reader moving through the page
  // with a virtual cursor afterwards meets a "Copied to the clipboard."
  // sitting at a control that shows nothing of the sort any more. The visible
  // channel had already reverted; this is the audible one catching up with it.
  //
  // Which is exactly why it hangs on the same timer rather than one of its
  // own: where the state is meant to STAND — data-copy-duration="0", the
  // design where the checkmark stays until the next press — the sentence is
  // that checkmark's only counterpart in words, and removing it would take
  // the result away from the one reader who cannot see it. No duration, no
  // timer, and both halves stand.
  settle = () => {
    this.clearState();
    this.status?.replaceChildren();
  };



  // A new node per announcement rather than one node whose text is replaced:
  // assigning the same string to the same node is not a mutation, so the
  // second "Copied to the clipboard." would be silent. The region was emptied
  // on the press, in the task before this one, which is what makes appending
  // here a change the accessibility layer can see — and it is emptied again
  // when the duration is up, so the sentence does not outlive the state it
  // reports (see settle).
  announce = (wording, text) => {
    if (!this.status || !wording.text) return;

    const line = document.createElement('span');

    // Only this module's own sentence can be in a language the page is not.
    // The author's is the page's by definition, and a lang on it would claim
    // otherwise.
    if (wording.builtIn && this.labelsLang) line.lang = this.labelsLang;

    line.textContent = formatTemplate(wording.text, { text });

    this.status.append(line);
  };



  // The outcome, for whoever wants to do more with it than this module does:
  // show a toast, log it, count it. Bubbling, so one delegated listener on a
  // container serves every copy button inside it — and dispatched only once
  // the write has settled, which is the reason this event exists at all. A
  // declarative data-toast-trigger on the same button fires on the PRESS and
  // would report a success nobody has seen yet.
  emit = (type, detail) => {
    this.button.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
  };



  // Optional teardown for hosts that mount/unmount the same subtree
  // repeatedly — see destroyModulesInScope() in boot.js. Four things here
  // outlive the button's own node: a pending timer, the injected region
  // beside it, the state attribute, which may be sitting on a source element
  // somewhere else in the document, and a clipboard write still in flight,
  // which is the one that cannot be taken back — the flag is set first so the
  // outcome it settles into is dropped rather than written onto a control
  // that has been handed back. The `hidden` attribute goes back on last,
  // because without this module the control is what it was before — a button
  // that does nothing.
  destroy = () => {
    this.destroyed = true;

    clearTimeout(this.timer);

    this.button.removeEventListener('click', this.handleClick);

    this.clearState();
    this.status?.remove();

    if (this.revealed) this.button.hidden = true;
  };
}



// The target selector, checked once here rather than at every press. An
// unparseable one is fatal: querySelector throws on it, and a throw inside a
// click listener is an uncaught error rather than a reported one — so the
// control stays hidden and the console says why.
//
// A selector that merely matches nothing YET is not fatal. The box may be
// filled by something else later (a loaded fragment, a rendered template) and
// the source is looked up again on every press, so this is a warning and the
// control is enhanced.
function checkSelector(button, selector, reporter) {
  try {
    if (document.querySelector(selector)) return true;

    reporter?.report(
      'copyToClipboard',
      `nothing matches "${selector}" yet; the source is looked up again on ` +
      'every press, so this is only a problem if it is still empty then.',
      button
    );
    return true;
  } catch {
    reporter?.report(
      'copyToClipboard',
      `"${selector}" is not a valid CSS selector, so the control cannot ` +
      'find anything to copy and stays hidden.',
      button
    );
    return false;
  }
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  // A real <button>, because copying is an action: a link would promise a
  // destination it does not have, and a div would need a role, a tabindex
  // and two key handlers to become what <button> already is.
  if (!(el instanceof HTMLButtonElement)) {
    reporter?.report(
      'copyToClipboard',
      'module must be initialized on a <button> — copying is an action, ' +
      'not a destination.', el
    );
    return;
  }

  // A button inside a form defaults to type="submit", so every press would
  // send the form off as well. There is no reading of that markup in which
  // it is what the author meant, and suppressing a submit the page asked for
  // is not this module's business — so it is reported and the control stays
  // hidden.
  if (el.form && el.type !== 'button') {
    reporter?.report(
      'copyToClipboard',
      `the control is a "${el.type}" button inside a <form>, so every press ` +
      'would submit it as well. Add type="button".', el
    );
    return;
  }

  // The platform's own precondition, not this module's: writeText() exists
  // only in a secure context. The control stays hidden, and the reader keeps
  // the page they had — the text is on screen and selectable.
  if (!navigator.clipboard?.writeText) {
    reporter?.report(
      'copyToClipboard',
      'no Clipboard API here — it needs a secure context (https, or ' +
      'localhost). The control stays hidden; the text stays selectable.', el
    );
    return;
  }

  const literal = el.getAttribute(defaults.textAttr);
  const selector = el.getAttribute(defaults.targetAttr);

  if (literal === null && !selector) {
    reporter?.report(
      'copyToClipboard',
      `nothing to copy: give the control ${defaults.targetAttr} (a selector ` +
      `for the element holding the text) or ${defaults.textAttr} (the ` +
      'string itself).', el
    );
    return;
  }

  if (literal !== null && selector) {
    reporter?.report(
      'copyToClipboard',
      `both ${defaults.textAttr} and ${defaults.targetAttr} are set; the ` +
      'literal string wins. Remove one of them.', el
    );
  }

  if (literal === null && !checkSelector(el, selector, reporter)) return;

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new CopyToClipboard(el, defaults, reporter);
  return instance.destroy;
}
