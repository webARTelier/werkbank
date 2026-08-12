/**
 * siteSearch.js
 * ----------------------------------------------------------------------------
 * Controller for a site search that expands out of a toggle: the search form
 * is authored as an ordinary form in the page, and this module folds it away
 * behind the small control sitting next to it — the layout a site header
 * wants when there is no room for a search bar.
 *
 * What works without this script
 * ------------------------------
 * The markup is a <search> landmark holding a toggle and a real form: a
 * labelled <input type="search"> and a submit button, pointing at the site's
 * search page with a GET. Without this module that form is simply there —
 * visible, focusable, submittable — and the stylesheet hides the toggle,
 * because a control that folds a field away does nothing until the script
 * operating it has arrived. Both halves hang off data-sitesearch-ready, set
 * only once the field can actually be expanded again, so "the field is
 * collapsed" and "there is a control that brings it back" always arrive
 * together. Nothing is ever hidden without a way out.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * <search> is the search landmark, <form> builds the query string and does
 * the navigating, <input type="search"> brings the search key on a mobile
 * keyboard and a clear button in Chromium and WebKit, and <label for> names
 * the field. The expansion itself is a plain CSS transition in both
 * directions — no top layer, no @starting-style, nothing to time from script.
 * This module writes one ARIA attribute; the stylesheet does the rest. It
 * never validates, never submits and never styles.
 *
 * What this script adds
 * ---------------------
 * 1. The disclosure. aria-expanded on the toggle is the single source of
 *    truth AND the styling hook: the stylesheet reaches the collapsed form
 *    from it through the adjacent-sibling combinator (toggle + form), so
 *    there is no state class, no second source of truth and no inline style.
 *    That is also why the form has to be the toggle's next element sibling —
 *    markup breaking the contract is reported and left completely alone,
 *    which leaves a working search form in the page.
 * 2. The focus into the field on open. Expanding a search field and leaving
 *    the caret behind would make every visitor click twice. It takes a style
 *    flush to happen at all: a field that is still visibility:hidden cannot
 *    take the focus, and focus() on one quietly does nothing.
 * 3. Explicit dismissal: pressing the toggle again, and Escape while the
 *    focus is inside the component. Both close the field and hand the focus
 *    back to the toggle. Escape is only consumed where it belongs — with the
 *    focus elsewhere the key stays available to whatever the reader is
 *    actually in (a dialog, a menu), the rule dropdownNav follows, and an
 *    Escape cancelling an IME composition is not this component's either.
 * 4. Incidental dismissal: a press outside the component, or the focus
 *    leaving it, closes the field — but only while it is empty. A query
 *    someone has typed is not swept out of sight by a click somewhere else;
 *    nothing about it is lost either way, since the value survives the
 *    collapse and comes back with it.
 * 5. Where the focus goes. A collapsed field is visibility:hidden, so a focus
 *    still inside it would be dropped on <body> — it moves to the toggle
 *    first, in every path that closes (see releaseFocus).
 * 6. The one thing the initial fold must not do: animate. The field is in the
 *    page until this module collapses it, so the collapsed state and the
 *    "ready" flag are written a style flush apart — otherwise every page load
 *    would open with the search bar folding itself away (see the
 *    constructor).
 *
 * Accessibility
 * -------------
 * The ARIA APG disclosure pattern: a real <button> carrying aria-expanded and
 * aria-controls, and a region genuinely hidden when collapsed (visibility:
 * hidden takes the field out of the tab order and the accessibility tree).
 * The toggle keeps the same accessible name in both states — aria-expanded
 * tells the state, and a control that renames itself would break the name a
 * voice-control user just spoke. The field is named by a real <label>, never
 * by the placeholder alone, and the toggle by a text node next to its
 * aria-hidden glyph; a missing name is reported on either rather than
 * silently shipped — as is a field id that occurs twice in the document,
 * which would leave the second instance nameless while its own label points
 * at the first. Escape returns the focus to the toggle; that press is
 * consumed, so the native clear-on-Escape of an <input type="search"> does
 * not fire while the field is open — the type's own clear button still does
 * it, and the query survives the collapse instead of being thrown away. An
 * Escape belonging to an IME composition is left alone (see handleKeydown).
 *
 * Configuration
 * -------------
 * On the root (data-js-behavior="siteSearch"):
 * - data-sitesearch-side="start"   style only: the field unrolls towards the
 *                                  inline-start of the toggle, for a toggle
 *                                  sitting at the end of a header (optional)
 *
 * Inside it (markup contract):
 * - data-sitesearch-toggle         required; the control that expands the
 *                                  field. Must be the form's previous element
 *                                  sibling.
 * - data-sitesearch-form           required; the search form — the region the
 *                                  toggle expands
 * - data-sitesearch-input          the text field: what is focused on open, and
 *                                  what is read to tell an empty search from a
 *                                  typed one
 * ----------------------------------------------------------------------------
 */



import { uniqueId } from './uniqueId.js';



const defaults = {

  // The control that expands the field. It has to sit immediately before the
  // form: the stylesheet keys the collapsed state off "toggle + form" (see
  // the file header), so nothing may come between the two.
  toggleAttr: 'data-sitesearch-toggle',

  // The search form — the region the toggle expands, and what its
  // aria-controls points at.
  formAttr: 'data-sitesearch-form',

  // The text field inside the form. The script needs it for two things: the
  // focus on open, and the "is there a query" test that keeps an incidental
  // dismissal from folding a typed search away (see dismiss).
  inputAttr: 'data-sitesearch-input',

  // "The module has taken over." Set on the root; the stylesheet reveals the
  // toggle only when it is there, so the field can never be folded away
  // without the control that brings it back.
  readyAttr: 'data-sitesearch-ready',

  // Prefix for generated form ids (aria-controls needs one).
  formIdPrefix: 'sitesearch-form',
};



class SiteSearch {

  constructor(root, params, reporter) {
    this.root = root;
    this.params = params;
    this.reporter = reporter;

    this.enhanced = false;
    this.generatedId = false;

    this.toggle = root.querySelector(`[${params.toggleAttr}]`);
    this.form = root.querySelector(`[${params.formAttr}]`);
    this.input = root.querySelector(`[${params.inputAttr}]`);

    if (!this.reportContract()) return;

    this.reportMissingToggleName();
    this.reportMissingInput();

    // A duplicated id would trip the name check below as well — with advice
    // that does not fit ("add a <label>") for a field that has one and is
    // only being shadowed. So the more specific finding wins.
    if (!this.reportDuplicateInputId()) this.reportMissingFieldName();

    this.seedToggle();

    // The collapsed state above and the "ready" flag below are separated by a
    // style flush on purpose. Until now the form was the expanded one
    // everybody sees without this module, so writing both in one go would
    // leave the browser one style change to look at — "wide, no transition"
    // to "narrow, with a transition" — and every page load would open with
    // the search bar folding itself away. Flushing in between makes the
    // collapsed state the browser's new starting point, so the first fold is
    // instant and only the ones a reader actually causes animate.
    this.flushStyles();

    this.startListening();

    // Set last, and only for a field that can be expanded again: until it is
    // there the stylesheet keeps the toggle hidden, so a failure above leaves
    // the search form in the page rather than behind a dead control.
    root.setAttribute(params.readyAttr, '');
    this.enhanced = true;
  }



  // The two elements this module cannot work without, plus the order the
  // stylesheet depends on. Returning false leaves the markup completely
  // untouched, which is the safe outcome every time: the search form stays
  // in the page, visible and submittable.
  reportContract = () => {
    if (!this.toggle || !this.form) {
      this.reporter?.report(
        'siteSearch',
        `needs a [${this.params.toggleAttr}] control and a ` +
        `[${this.params.formAttr}] form — the search form is left in the ` +
        'page as it was authored.', this.root
      );
      return false;
    }

    if (this.toggle.nextElementSibling !== this.form) {
      this.reporter?.report(
        'siteSearch',
        `the [${this.params.formAttr}] must be the next element sibling of ` +
        `the [${this.params.toggleAttr}] control — the stylesheet reaches ` +
        'the collapsed field from the toggle, so the search form is left ' +
        'in the page as it was authored.', this.root
      );
      return false;
    }

    return true;
  };



  // The toggle's name is the one thing here that cannot be borrowed from the
  // platform, and the most fragile: the glyph inside the button is
  // aria-hidden, so the visually hidden text node next to it is the whole
  // accessible name — and it names the only control left once the module has
  // folded the field away. Dropping that <span> while restyling is the
  // easiest mistake in this component and leaves a button announced as
  // nothing at all.
  //
  // The check is cruder than the field's: a button has no .labels to consult,
  // so the text content stands in for the name computation. It therefore errs
  // towards silence — text hidden from the accessibility tree still counts
  // here — which is the right direction for a warning: it never nags an
  // author over a name it merely cannot see.
  reportMissingToggleName = () => {
    const hasName =
      this.toggle.hasAttribute('aria-label') ||
      this.toggle.hasAttribute('aria-labelledby') ||
      this.toggle.hasAttribute('title') ||
      this.toggle.textContent.trim() !== '';
    if (hasName) return;

    this.reporter?.report(
      'siteSearch',
      'the toggle has no accessible name — its magnifier is aria-hidden, ' +
      'so put a (visually hidden) text node inside the button, or give it ' +
      'an aria-label.', this.toggle
    );
  };



  // Without the input the field still expands and collapses — it just has
  // nothing to focus, and every dismissal counts as "empty" because there is
  // no query to protect. Reported rather than fatal for that reason: nothing
  // about the search is lost.
  reportMissingInput = () => {
    if (this.input) return;

    this.reporter?.report(
      'siteSearch',
      `no [${this.params.inputAttr}] inside the form — the field will ` +
      'expand without taking the focus.', this.form
    );
  };



  // The id in <label for> is resolved document-wide, and the first element
  // carrying it wins. Two instances of the same snippet therefore leave the
  // second field nameless while a <label for> sits right next to it, pointing
  // at the first — which is how the field of a repeated CMS module loses its
  // name without anything looking wrong in the markup. Copy-paste is exactly
  // how it happens, so it is named rather than left to the check below.
  // Returns whether it reported, since the two findings overlap.
  reportDuplicateInputId = () => {
    const id = this.input?.id;
    if (!id) return false;
    if (document.querySelectorAll(`[id="${CSS.escape(id)}"]`).length < 2) {
      return false;
    }

    this.reporter?.report(
      'siteSearch',
      `the search field's id ("${id}") is used more than once in the ` +
      'document, so its <label for> names the first field only — give ' +
      'every instance a unique id.', this.input
    );
    return true;
  };



  // A search field announced as "edit, blank" is a field whose purpose the
  // reader has to guess. The placeholder is not a name: it is gone as soon as
  // anything is typed, and several engines do not expose it at all.
  //
  // The association is read from the platform's own list rather than looked
  // up by selector: input.labels is what the <label for> actually resolved
  // to, so a label whose id points at a *different* field cannot be mistaken
  // for a name here — and an ancestor <label> is covered by the same list.
  reportMissingFieldName = () => {
    if (!this.input) return;

    const hasName =
      this.input.hasAttribute('aria-label') ||
      this.input.hasAttribute('aria-labelledby') ||
      (this.input.labels?.length ?? 0) > 0;
    if (hasName) return;

    this.reporter?.report(
      'siteSearch',
      'the search field has no accessible name — add a <label for>, or ' +
      'aria-label, to the input.', this.input
    );
  };



  seedToggle = () => {
    if (!this.form.id) {
      this.form.id = uniqueId(this.params.formIdPrefix);
      this.generatedId = true;
    }

    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.setAttribute('aria-controls', this.form.id);
  };



  // Reading a layout property forces the browser to bring its style and
  // layout up to date; the value itself is never used.
  flushStyles = () => {
    void this.form.offsetWidth;
  };



  startListening = () => {
    this.toggle.addEventListener('click', this.handleToggleClick);

    // The interactions that dismiss the field happen outside it by
    // definition, so they are listened for on the document.
    document.addEventListener('keydown', this.handleKeydown);
    document.addEventListener('pointerdown', this.handlePointerDown);
    document.addEventListener('focusin', this.handleFocusIn);
  };



  isOpen = () => this.toggle.getAttribute('aria-expanded') === 'true';



  handleToggleClick = () => {
    if (this.isOpen()) {
      this.close({ returnFocus: true });
      return;
    }

    this.open();
  };



  open = () => {
    if (this.isOpen()) return;

    this.toggle.setAttribute('aria-expanded', 'true');

    // The collapsed field is visibility:hidden, and an element that is not
    // visible cannot take the focus — so without bringing the style up to
    // date first, focus() would quietly do nothing and the caret would be
    // left on the toggle. The attribute above makes the field visible again;
    // this makes the browser act on it.
    this.flushStyles();

    // preventScroll because this is not navigation: the reader has just
    // operated the toggle right next to the field, so it is in view anyway —
    // and the field is still a zero-width clipped box on this frame, not a
    // position worth scrolling to.
    this.input?.focus({ preventScroll: true });
  };



  close = ({ returnFocus = false } = {}) => {
    if (!this.isOpen()) return;

    this.releaseFocus(returnFocus);
    this.toggle.setAttribute('aria-expanded', 'false');
  };



  // The focus leaves the field before the field goes, not after: a collapsed
  // form is visibility:hidden, so a focus still inside it would be dropped on
  // <body> and the next Tab would start over at the top of the page. Where it
  // goes is the toggle either way — the control the field folds back into —
  // but how it gets there is not: an explicit dismissal (the toggle, Escape)
  // is the reader working the component, so the toggle is scrolled into view
  // like any other focus move, while an incidental one happens because the
  // reader is busy somewhere else, where yanking the page back would be the
  // rudest thing this module could do.
  releaseFocus = (returnFocus) => {
    if (returnFocus) {
      this.toggle.focus();
      return;
    }

    if (!this.form.contains(document.activeElement)) return;
    this.toggle.focus({ preventScroll: true });
  };



  handleKeydown = (event) => {
    if (event.key !== 'Escape') return;

    // Escape is also how an IME candidate list is cancelled, and that press
    // belongs to the composition, not to this disclosure: taking it would
    // fold the field away mid-word and drop the focus back onto the toggle.
    // dateInputFormat guards its own input the same way.
    if (event.isComposing) return;

    if (!this.isOpen()) return;

    // Only this component's own Escape is taken. With the focus somewhere
    // else the field stays as it is and the key press stays available to
    // whatever the reader is in.
    if (!this.root.contains(document.activeElement)) return;

    event.preventDefault();
    this.close({ returnFocus: true });
  };



  handlePointerDown = (event) => {
    if (this.root.contains(event.target)) return;
    this.dismiss();
  };



  handleFocusIn = (event) => {
    if (this.root.contains(event.target)) return;
    this.dismiss();
  };



  // Incidental dismissal: nobody asked for the field to close, it is just no
  // longer where the reader is. So it only closes while there is nothing to
  // fold away — a half-typed query is left standing rather than hidden behind
  // a toggle that gives no hint it is still holding one.
  dismiss = () => {
    if (!this.isOpen()) return;
    if (!this.isEmpty()) return;

    this.close();
  };



  isEmpty = () => (this.input?.value ?? '').trim() === '';



  // Optional teardown for hosts that mount/unmount this subtree repeatedly —
  // see destroyModulesInScope() in boot.js. The document listeners are the
  // state that outlives the component's own subtree; everything else hands
  // the markup back as authored, which here means handing back the expanded
  // search form (without aria-expanded the collapse rule stops matching, so
  // the field is in the page again — exactly the state a visitor without this
  // module gets).
  destroy = () => {
    document.removeEventListener('keydown', this.handleKeydown);
    document.removeEventListener('pointerdown', this.handlePointerDown);
    document.removeEventListener('focusin', this.handleFocusIn);
    this.toggle?.removeEventListener('click', this.handleToggleClick);

    if (!this.enhanced) return;

    this.root.removeAttribute(this.params.readyAttr);
    this.toggle.removeAttribute('aria-expanded');
    this.toggle.removeAttribute('aria-controls');
    if (this.generatedId) this.form.removeAttribute('id');

    this.enhanced = false;
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'siteSearch',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new SiteSearch(el, defaults, reporter);
  return instance.destroy;
}
