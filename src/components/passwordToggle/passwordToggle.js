/**
 * passwordToggle.js
 * ----------------------------------------------------------------------------
 * Lets the person filling in a password field read back what they typed. A
 * masked field is the only control on a form whose value nobody can
 * proof-read: every other mistake is visible and correctable, this one is a
 * row of dots, and the usual answer to that — a second "repeat your password"
 * field — asks for the same guess twice instead of showing it once. Being
 * able to look is also what makes a long, pasted, unmemorable password
 * practical, which is what WCAG 2.2's 3.3.8 "Accessible Authentication" is
 * about: that criterion is met by not standing in the way of pasting and of
 * password managers (which this component does not — see below), and the
 * reveal is the supporting technique next to it. It is NOT what 1.3.5 asks
 * for; that one is about the autocomplete token, and is met here by leaving
 * the token alone.
 *
 * What the platform already does
 * ------------------------------
 * - The field itself: <input type="password"> masks the value, keeps it out
 *   of the accessibility tree as characters, and carries its label, its
 *   autocomplete token and the browser's password manager without a line of
 *   script. None of that is this component's business, and all of it must
 *   survive it — which is why the type attribute is the ONLY thing here that
 *   ever changes.
 * - A <button> is keyboard operable, has a role and takes Enter and Space;
 *   aria-pressed is what the ARIA APG "Button (toggle)" pattern uses to say
 *   which of two states it is in.
 * - Edge on Windows ships a reveal control of its own, drawn into the field
 *   as ::-ms-reveal while it has focus and a value. It is the one engine
 *   where this component would be the SECOND eye in the same field, so the
 *   stylesheet takes it away — but only once ours is running (see the ready
 *   attribute below). No other current engine offers one.
 * - And then the ladder stops. There is no element, attribute, pseudo-class
 *   or property that unmasks a password field: the type attribute is the
 *   whole switch and only script can flip it. That is the reason this
 *   component has a script at all, and the reason the control is INJECTED
 *   rather than authored — a "show password" button in the markup would be a
 *   control that does nothing at all until a chunk arrives.
 *
 * What this script adds
 * ---------------------
 * 1. The control: a real <button type="button"> after the field, inside the
 *    component root, so it follows the field in the tab order and submits
 *    nothing. Its name is a text node rather than an aria-label, so it still
 *    names the control if the stylesheet never arrives — and where the
 *    built-in wording is not the page's language, that node says which
 *    language it is in (see markLabelLanguage). The glyph is drawn in CSS
 *    from aria-pressed (see passwordToggle.scss), the way readMore draws its
 *    chevron from aria-expanded, so what the eye reads and what a screen
 *    reader reads cannot drift apart.
 * 2. The switch, with the caret kept where it was: swapping the type collapses
 *    the selection in engines that re-create the field's inner editor, so the
 *    range is read before and written back after. Nothing else about the
 *    field is touched — same node, same name, same value, same autocomplete,
 *    so the form posts what it always posted and the password manager keeps
 *    the field it knows.
 * 3. The state, as aria-pressed on a button whose name never changes. The
 *    opposite of what video.js does with its play/pause control, and for the
 *    opposite reason: for a transport control the useful announcement is what
 *    pressing does NEXT, whereas here it is the state itself — whether this
 *    password is legible on screen right now is the fact a reader needs, and
 *    a name that changed under them would announce it as an action instead.
 * 4. Re-masking when the form is submitted. Revealing is a moment of
 *    proof-reading, not a setting: a page restored from the back/forward
 *    cache, or re-rendered after a failed validation, must not come back with
 *    the password on screen.
 * 5. The three attributes that make a revealed password safe to be text
 *    (see `textSafety`). While it is masked they mean nothing; the moment it
 *    is text, a spell checker would treat it as a word — some of them send
 *    what they check to a server — and a phone keyboard would capitalize and
 *    autocorrect it.
 * 6. "data-passwordtoggle-ready" on the root, set LAST. Both rules that read
 *    it hand something over to a control that has to exist: the gutter the
 *    button sits in, and Edge's own reveal. See passwordToggle.scss.
 *
 * Accessibility
 * -------------
 * - The button is a toggle button: constant accessible name, state in
 *   aria-pressed (point 3 above). It also points at the field it operates
 *   with aria-controls, naming it with a generated id where the author gave
 *   it none.
 * - The built-in wording exists in two languages and a page can be in a
 *   third. Where it is, the name carries its own lang so a screen reader
 *   pronounces it with the right rules (WCAG 3.1.2) — the alternative is
 *   "Show password" read out by a French voice.
 * - The glyph is aria-hidden by construction — it is a CSS mask on a
 *   pseudo-element, so there is no node to announce — and the two states are
 *   two SHAPES, not two colours: a forced-colors theme and a greyscale
 *   printout keep the distinction (WCAG 1.4.1).
 * - Focus never moves. Pressing the button leaves focus on the button, so the
 *   reader can look, read and put it back without a trip through the field.
 * - The default hit area is 2.25rem (36px), past the 24px of WCAG 2.5.8, and
 *   the button is the only target inside the field's box.
 * - Revealing puts the password on screen for anyone who can see the screen.
 *   That is the point of the control and the reason it is off at rest, never
 *   remembered between fields or page loads, and dropped again at submit.
 *
 * Configuration (all optional, on the component root)
 * ---------------------------------------------------
 * - data-passwordtoggle-label="…"  the button's accessible name, where the
 *                                  built-in de/en wording is not the page's
 *                                  language or not its tone.
 * Everything else is CSS: the size of the control, where it sits and what it
 * looks like are questions about a box (see the token block in
 * passwordToggle.scss).
 * ----------------------------------------------------------------------------
 */



// resolveLocale picks the built-in wording the way every other component here
// does; uniqueId names the field for aria-controls where its author did not.
import { resolveLocale } from './resolveLocale.js';
import { uniqueId } from './uniqueId.js';



const defaults = {

  // An author's own name for the button, on the root.
  labelAttr: 'data-passwordtoggle-label',

  // "The control is there." Set on the root by init() once the button is in
  // the document and wired, removed again by the cleanup function, and only
  // ever written — never read back. Set LAST, like dataTable's and
  // fileUpload's, because what it gates is switched ON by its presence: the
  // gutter that keeps the value clear of the button, and the removal of
  // Edge's native reveal. A chunk that never arrives must leave the field
  // padded for nothing and stripped of the one reveal the platform did offer.
  readyAttr: 'data-passwordtoggle-ready',

  // Styling hooks written onto the two injected nodes. The JS never reads
  // them back and never selects by them — it holds the elements it made.
  buttonClass: 'c-passwordToggle__button',
  labelClass: 'c-passwordToggle__label',

  // For a field the author left unnamed, so aria-controls has something to
  // point at.
  idPrefix: 'passwordToggleField',

  // What a field must not be while its value is TEXT rather than dots. All
  // three are inert on a password field, so they are set once and held for
  // the component's lifetime rather than flapping with every press:
  //   spellcheck    a password is not a word. Browser spell checking has
  //                 sent field contents to a remote service more than once,
  //                 and a red underline under a passphrase is noise either
  //                 way.
  //   autocapitalize / autocorrect  a phone keyboard would capitalize the
  //                 first character and "correct" the rest, silently
  //                 changing a value the reader is looking straight at.
  // The author's own values are held and handed back by destroy().
  textSafety: {
    spellcheck: 'false',
    autocapitalize: 'none',
    autocorrect: 'off',
  },

  // <html lang> matching none of these falls back to this locale.
  fallbackLocale: 'en',
};



// The button's accessible name. One string, because the name is constant:
// the state is announced by aria-pressed, not by the wording (see the header,
// point 3).
const labels = {

  de: {
    toggle: 'Passwort anzeigen',
  },

  en: {
    toggle: 'Show password',
  },
};



class PasswordToggle {

  constructor(root, field, config, reporter) {
    this.root = root;
    this.field = field;
    this.config = config;
    this.reporter = reporter;

    // The state, and the only thing this component remembers. It starts
    // masked on every init: a revealed password is a moment, not a setting.
    this.revealed = false;

    // Held rather than used and dropped: the wording's language is what
    // markLabelLanguage compares against the page's.
    const locale = resolveLocale(Object.keys(labels), config.fallbackLocale);
    this.locale = labels[locale] ? locale : config.fallbackLocale;
    this.labels = labels[this.locale];

    this.setup();
  }



  setup = () => {
    this.holdTextSafety();
    this.buildButton();

    // On the form, not the field: "submit" is dispatched at the form and does
    // not bubble up from the controls it collects. A form-less field (a login
    // box wired by fetch) simply has nothing to listen to, and the reveal
    // then lasts until the reader presses again.
    this.form = this.field.form;
    this.form?.addEventListener('submit', this.handleSubmit);

    // Last: everything the stylesheet reserves space for now exists.
    this.root.setAttribute(this.config.readyAttr, '');
  };



  // The three attributes from `textSafety`, with whatever the author had
  // there held for destroy(). A null in the map means "there was no attribute
  // here" — which is what has to be put back, not an empty string.
  holdTextSafety = () => {
    this.heldAttrs = new Map();

    Object.entries(this.config.textSafety).forEach(([name, value]) => {
      this.heldAttrs.set(name, this.field.getAttribute(name));
      this.field.setAttribute(name, value);
    });
  };



  // The control, built here rather than asked of the author for the reason in
  // the header: unenhanced it would be a button that does nothing. It goes
  // directly after the field, so the tab order needs no help and no tabindex.
  buildButton = () => {
    const { config } = this;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = config.buttonClass;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-controls', this.fieldId());

    // A real text node, not an aria-label: the name then reads even where
    // this component's stylesheet never arrived — which is exactly the
    // situation in which the glyph is missing too. The stylesheet hides it
    // visually and only visually (see the visually-hidden mixin).
    const label = document.createElement('span');
    label.className = config.labelClass;

    // An author's own name is written for this page and is in its language;
    // only the built-in wording can be in a language the page is not.
    const authored = this.root.getAttribute(config.labelAttr);
    label.textContent = authored || this.labels.toggle;

    if (!authored) this.markLabelLanguage(label);

    button.append(label);
    button.addEventListener('click', this.handleClick);

    this.field.after(button);
    this.button = button;
  };



  // The built-in wording comes in de and en, and a page in a third language
  // gets the en fallback — a passage in a language the page does not declare,
  // which a screen reader then pronounces with the page's rules ("Show
  // password" spoken French). So where the two differ, the name says which
  // language it is in; where they agree, the attribute would only repeat what
  // <html lang> already says (WCAG 3.1.2 / BITV 3.1.2a).
  //
  // The base language is what is compared: a wording chosen for "de" is the
  // right wording on a page in "de-CH", and lang="de" on the span there would
  // be a language change that is not one.
  markLabelLanguage = (label) => {
    const pageLang =
      (document.documentElement.lang || '').toLowerCase().split('-')[0];

    if (pageLang === this.locale) return;

    label.lang = this.locale;
  };



  // What aria-controls points at. An authored id is always kept; a generated
  // one is remembered so destroy() can hand the field back unnamed.
  fieldId = () => {
    if (this.field.id) return this.field.id;

    this.generatedId = uniqueId(this.config.idPrefix);
    this.field.id = this.generatedId;
    return this.generatedId;
  };



  handleClick = () => {
    this.setRevealed(!this.revealed);
  };



  // A submitted form is the end of the proof-reading: whatever brings this
  // page back — the back/forward cache, a re-render after a failed
  // validation, the browser restoring a session — must not bring the password
  // back with it, legible.
  handleSubmit = () => {
    this.setRevealed(false);
  };



  // The whole switch. Swapping the type is one assignment; the two lines
  // around it are there because some engines re-create the field's inner
  // editor when the type changes and drop the selection with it, which would
  // put the caret at the end of a value the reader was editing in the middle
  // of. Read before, written back after — and harmless where the engine kept
  // it, since it is the same range.
  //
  // Focus is deliberately left where it is (on the button): the reader
  // pressed it in order to look, not in order to type.
  setRevealed = (next) => {
    if (next === this.revealed) return;

    const { field } = this;

    // Both text and password support the selection API, but a field can be
    // in neither state by the time this runs — a host that swapped the type
    // itself, a disabled field in some engines — and selectionStart is null
    // there.
    const hasSelection = typeof field.selectionStart === 'number';
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const direction = field.selectionDirection || 'none';

    field.type = next ? 'text' : 'password';

    if (hasSelection) field.setSelectionRange(start, end, direction);

    this.revealed = next;
    this.button.setAttribute('aria-pressed', String(next));
  };



  // Optional teardown for hosts that mount/unmount the same subtree
  // repeatedly — see destroyModulesInScope() in boot.js. Three things here
  // outlive the component's own nodes and all three are handed back: the
  // submit listener sits on the form, the type may be "text" at that moment,
  // and the field carries attributes (and possibly an id) this module wrote.
  // The field must end up masked whatever happens, so that goes first.
  destroy = () => {
    this.setRevealed(false);

    this.form?.removeEventListener('submit', this.handleSubmit);
    this.button?.removeEventListener('click', this.handleClick);
    this.button?.remove();

    this.heldAttrs.forEach((value, name) => {
      if (value === null) {
        this.field.removeAttribute(name);
        return;
      }

      this.field.setAttribute(name, value);
    });

    if (this.generatedId) this.field.removeAttribute('id');

    this.root.removeAttribute(this.config.readyAttr);
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'passwordToggle',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // The field is found by what it IS, not by a class or a hook of ours: a
  // password field is a native, unambiguous thing to ask for, and asking for
  // it is also the guard — a root without one has nothing to reveal.
  const fields = el.querySelectorAll('input[type="password"]');

  if (!fields.length) {
    reporter?.report(
      'passwordToggle',
      'no <input type="password"> inside the component root — the toggle ' +
      'switches that type and has nothing to switch here.', el
    );
    return;
  }

  // One control, one field: the button says "show password", singular, and
  // the gutter the stylesheet reserves is on the field the button sits in.
  // Two fields in one root want two roots.
  if (fields.length > 1) {
    reporter?.report(
      'passwordToggle',
      `${fields.length} password fields inside one component root; the ` +
      'toggle takes the first. Give each field its own root.', el
    );
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new PasswordToggle(el, fields[0], defaults, reporter);
  return instance.destroy;
}
