/**
 * comboBox.js
 * ----------------------------------------------------------------------------
 * Turns a native <input list> + <datalist> into the ARIA 1.2 combobox with
 * list autocomplete: type, and a filtered list of suggestions appears that
 * can be styled, walked with the arrow keys and announced properly. It closes
 * the collection's largest gap — "type, and pick from many values" — for the
 * case a <select> cannot serve, because the reader may also enter something
 * that is not in the list.
 *
 * What works without this script
 * ------------------------------
 * Everything the field is for. The markup is a labelled <input> whose list
 * attribute points at a <datalist> in the page, so every current engine
 * already offers those values while typing — unstyled, filtered by its own
 * rules, but there. The value is typed and submitted the same way with or
 * without this module, and the optional toggle button is hidden until the
 * script arrives, because a control that opens a list nobody has built yet
 * would be a dead control. Nothing is ever hidden that the reader needs.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * <datalist> is the data source and stays the data source: the options are
 * read from it, never from an attribute or a fetch, so the same markup feeds
 * the native popup before the module arrives and the built one after. The
 * <input> keeps its type, its name, its value, its constraint validation and
 * its label. Where the value has to be one of the suggestions, that is said
 * through setCustomValidity() — the platform's own channel, which
 * checkValidity(), :invalid and formValidation all read already. The listbox
 * is hidden with the hidden attribute rather than a class, so it leaves the
 * accessibility tree with the same declaration that hides it.
 *
 * What this script adds
 * ---------------------
 * 1. A listbox the project can style. A <datalist> popup is drawn by the
 *    engine: it takes no CSS at all, its filtering differs per browser (a
 *    substring here, a prefix there), and Safari on iOS renders nothing for
 *    a long list. This module builds a real role="listbox" out of the very
 *    same options, and takes the list attribute OFF the input so the native
 *    popup cannot open on top of its replacement. The attribute goes back on
 *    teardown.
 * 2. One filtering rule, stated by the author. data-combobox-match picks
 *    "contains" (default) or "start", and it is applied to the option's value
 *    AND its label. Matching folds case and combining marks, so "zurich"
 *    finds "Zürich" — a reader should not have to know how a word is spelled
 *    in order to find it.
 * 3. Keyboard operation per the APG: Down/Up open the list and walk it (with
 *    a wrap at both ends), Alt+Down opens without choosing, Alt+Up closes,
 *    Enter takes the highlighted option, Escape closes, Tab leaves with what
 *    was typed. Focus never leaves the field — the highlighted option is
 *    pointed at with aria-activedescendant, which is what keeps the caret,
 *    the text selection and every other module bound to the field working.
 *    Where the query matches nothing, opening from the keyboard shows the
 *    FULL list rather than nothing at all — the way back from a typo is what
 *    the toggle is for, and the toggle is not in the tab order.
 * 4. The one announcement the pattern cannot make on its own: how many
 *    suggestions there are now. aria-expanded says the list is open and
 *    aria-activedescendant says which option is current, but nothing says
 *    "three left" as the reader types — so a polite status region does, once
 *    per change of that sentence, never twice in a row, and not at all for a
 *    field the reader has just emptied.
 * 5. Optional strictness. data-combobox-strict reports a value that is not
 *    one of the options through setCustomValidity(), and snaps an entry that
 *    differs only in case or in accents to the option's own spelling on blur,
 *    so what is submitted is what the list says. It never rewrites anything
 *    else and never clears the field. A reset of the surrounding form lifts
 *    the report again — that is the one value change no input event
 *    announces, so the form is listened to for it.
 * 6. A live data source. The <datalist> is watched, so options rendered in
 *    later (a fragment loaded into the page, a server-filled list) are picked
 *    up without re-initialising the field.
 *
 * Accessibility
 * -------------
 * The ARIA APG "editable combobox with list autocomplete" pattern, manual
 * selection: role="combobox" with aria-expanded, aria-controls and
 * aria-autocomplete="list" on the input; role="listbox" on the popup with one
 * role="option" per suggestion; aria-activedescendant naming the current
 * option and aria-selected="true" on it. Manual selection on purpose —
 * nothing is ever written into the field until the reader asks for it, so the
 * value cannot change under a screen reader that is still reading it out.
 *
 * The listbox is named after the field itself (its <label>, or the input's
 * own aria-labelledby / aria-label), and a field without a name is reported
 * rather than shipped, because the listbox would then be nameless too. The
 * optional toggle is a real <button> outside the tab order (the arrow keys
 * are the keyboard's way in, and a second tab stop for the same list is
 * noise) — and they reach the same full list it opens, so nothing the button
 * does is pointer-only; it needs its own name, and a missing one is
 * reported. The status region is role="status" — polite, never
 * focus-stealing — and visually hidden by one rule in comboBox.scss.
 *
 * Escape closes the list and stops there: it never clears the field. A value
 * someone has typed is not thrown away by a key press meant to dismiss a
 * popup, which is the rule siteSearch follows for the same reason. Where the
 * list is closed already, the key is left alone, so it still reaches the
 * dialog or the menu the field may be sitting in. An Escape that belongs to
 * an IME composition is left alone as well.
 *
 * Configuration
 * -------------
 * On the root (data-js-behavior="comboBox"):
 * - data-combobox-match="contains | start"  where the query has to appear in
 *                                  an option; default "contains"
 * - data-combobox-strict            the value has to be one of the options;
 *                                   an entry that is not is reported through
 *                                   setCustomValidity()
 * - data-combobox-message="…"       your own text for that message
 *
 * Inside it (markup contract):
 * - an <input> with a list attribute pointing at a <datalist>. That pair is
 *   the whole wiring — there is no attribute to add to either of them.
 * - data-combobox-toggle            optional; a <button type="button"> that
 *                                   opens the full list. Hidden until the
 *                                   module runs.
 *
 * The popup is inserted as the input's last sibling, so the element that
 * holds the input is what positions it — see comboBox.scss.
 * ----------------------------------------------------------------------------
 */



import { uniqueId } from './uniqueId.js';
import { resolveLocale } from './resolveLocale.js';
import { formatTemplate } from './formatTemplate.js';



const defaults = {

  // The control that opens the full list. Optional: the arrow keys and a
  // click in the field open it too, so a project that wants no chevron
  // simply leaves the button out.
  toggleAttr: 'data-combobox-toggle',

  // Where the query has to sit inside an option: "contains" or "start".
  matchAttr: 'data-combobox-match',
  defaultMatch: 'contains',
  matchModes: ['contains', 'start'],

  // Presence asks for the value to be one of the options, reported through
  // the native constraint API rather than by this module drawing anything.
  strictAttr: 'data-combobox-strict',

  // An author's own text for that report.
  messageAttr: 'data-combobox-message',

  // The injected listbox, its options, and the marked part of an option's
  // text. Addressed by attribute, not by class: the module does not own the
  // stylesheet's class names (same reason dataTable addresses its status
  // region this way).
  listAttr: 'data-combobox-list',
  optionAttr: 'data-combobox-option',
  markAttr: 'data-combobox-mark',

  // The two text parts of an option: the value, and the label where the
  // author gave one that differs from it.
  valueAttr: 'data-combobox-value',
  labelAttr: 'data-combobox-label',

  // The injected live region the suggestion count is announced through, and
  // the one style it needs (being visually hidden) in comboBox.scss.
  statusAttr: 'data-combobox-status',

  // "The module has taken over." Set on the root; the stylesheet reveals the
  // toggle only when it is there, so the button can never be in the page
  // without the list it opens.
  readyAttr: 'data-combobox-ready',

  // Prefixes for the ids the module has to be able to point at.
  listIdPrefix: 'combobox-list',
  labelIdPrefix: 'combobox-label',

  // The language the announcements and the strict message are taken from,
  // where <html lang> names one this module does not ship.
  fallbackLocale: 'en',
};



// What the status region says, keyed by locale. Natural sentences, because
// they are read out: "3 suggestions available." and not "Suggestions: 3".
// {count} is the number of options currently in the list.
const labels = {

  de: {
    one: 'Ein Vorschlag verfügbar.',
    many: '{count} Vorschläge verfügbar.',
    none: 'Keine Vorschläge.',
    invalid: 'Bitte wählen Sie einen Eintrag aus der Liste.',
  },

  en: {
    one: 'One suggestion available.',
    many: '{count} suggestions available.',
    none: 'No suggestions.',
    invalid: 'Please choose an entry from the list.',
  },
};



// Lowercased and stripped of its combining marks, so "zurich" finds "Zürich"
// and "cafe" finds "Café". A reader looking for a value should not have to
// know how it is accented, and on a German keyboard the accented key is
// often not even there.
//
// Only ever used for the match TEST — see markRange for why the marking uses
// a plainer comparison.
function fold(text) {
  return text.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
}



// Where `needle` starts inside `haystack` under the given mode, or -1. Both
// arguments are already folded.
function matchIndex(haystack, needle, mode) {
  if (mode !== 'start') return haystack.indexOf(needle);
  return haystack.startsWith(needle) ? 0 : -1;
}



// The [start, end] of the query inside an option's text, for the marked
// span — or null where it cannot be located.
//
// Case is folded here, accents are not: stripping a combining mark changes a
// string's length, and an index into the stripped text is then not an index
// into the text on screen. So "zurich" finds "Zürich" in the list above and
// simply leaves it unmarked, which is the harmless half of the trade. The
// two length guards catch the same thing one step earlier, for the handful
// of characters whose lowercase form is longer than they are.
function markRange(text, query, mode) {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();

  if (haystack.length !== text.length) return null;
  if (needle.length !== query.length) return null;

  const start = matchIndex(haystack, needle, mode);
  if (start < 0) return null;

  return [start, start + needle.length];
}



class ComboBox {

  constructor(root, params, reporter) {
    this.root = root;
    this.params = params;
    this.reporter = reporter;

    this.enhanced = false;
    this.entries = [];
    this.shown = [];
    this.activeIndex = -1;
    this.announced = '';
    this.committing = false;
    this.showAll = false;
    this.generatedLabelId = false;

    this.labels =
      labels[resolveLocale(Object.keys(labels), params.fallbackLocale)];

    this.input = root.querySelector('input');
    this.toggle = root.querySelector(`[${params.toggleAttr}]`);

    // Read before anything is written: the list attribute is both the wiring
    // this module needs and the wiring it takes away (see swapOutNativeList).
    this.datalist = this.input?.list ?? null;
    this.listValue = this.input?.getAttribute('list') ?? '';

    if (!this.reportContract()) return;

    this.mode = this.readMode();
    this.strict = root.hasAttribute(params.strictAttr);
    this.reportMissingToggleName();

    this.readEntries();
    this.reportEmptyList();

    this.buildList();
    this.buildStatus();
    this.nameList();
    this.seedField();
    this.swapOutNativeList();
    this.watchDatalist();
    this.startListening();
    this.syncValidity();

    // Set last, and only once the list it opens actually exists: until it is
    // there the stylesheet keeps the toggle hidden, so a bail above leaves
    // the reader with the field and the native popup rather than with a
    // button that does nothing.
    root.setAttribute(params.readyAttr, '');
    this.enhanced = true;
  }



  // The two things this module cannot work without. Returning false leaves
  // the markup completely untouched, which is the safe outcome every time:
  // the field stays a field and the browser keeps offering the datalist.
  reportContract = () => {
    if (!this.input) {
      this.reporter?.report(
        'comboBox',
        'no <input> inside the component root — the root is the container ' +
        'around the field, not the field itself.', this.root
      );
      return false;
    }

    if (!(this.datalist instanceof HTMLDataListElement)) {
      this.reporter?.report(
        'comboBox',
        'the input needs a list attribute pointing at a <datalist> — that ' +
        'pair is the whole wiring, and it is also what the reader gets ' +
        'without this module. The field is left as it was authored.',
        this.input
      );
      return false;
    }

    if (!this.fieldName()) {
      this.reporter?.report(
        'comboBox',
        'the field has no accessible name — add a <label for>, or an ' +
        'aria-label. The suggestion list is named after the field, so it ' +
        'would be announced as an unnamed list box.', this.input
      );
    }

    return true;
  };



  // The toggle's glyph is aria-hidden, so a text node inside the button (or
  // an aria-label) is its whole accessible name. Dropping that <span> while
  // restyling leaves a button announced as nothing at all — the same check,
  // and the same reasoning, as in siteSearch.
  reportMissingToggleName = () => {
    if (!this.toggle) return;

    const named =
      this.toggle.hasAttribute('aria-label') ||
      this.toggle.hasAttribute('aria-labelledby') ||
      this.toggle.hasAttribute('title') ||
      this.toggle.textContent.trim() !== '';
    if (named) return;

    this.reporter?.report(
      'comboBox',
      'the toggle has no accessible name — put a (visually hidden) text ' +
      'node inside the button, or give it an aria-label.', this.toggle
    );
  };



  // Not fatal: a datalist can be filled later (a loaded fragment, a
  // server-rendered update), and the observer below picks that up. But an
  // empty one at init is nearly always a wiring mistake, and it is invisible
  // — the field simply never suggests anything.
  reportEmptyList = () => {
    if (this.entries.length) return;

    this.reporter?.report(
      'comboBox',
      'the <datalist> holds no usable <option> — the field works, it just ' +
      'has nothing to suggest.', this.datalist
    );
  };



  readMode = () => {
    const raw = (this.root.getAttribute(this.params.matchAttr) || '').trim();
    if (!raw) return this.params.defaultMatch;
    if (this.params.matchModes.includes(raw)) return raw;

    this.reporter?.report(
      'comboBox',
      `unknown ${this.params.matchAttr}="${raw}" — expected ` +
      `${this.params.matchModes.join(' or ')}. Falling back to ` +
      `"${this.params.defaultMatch}".`, this.root
    );
    return this.params.defaultMatch;
  };



  // The options, folded once so every keystroke below is a comparison and
  // not a normalisation. A disabled option is dropped rather than rendered
  // unusable: a suggestion nobody may take is not a suggestion.
  //
  // value vs. label follows the platform's own reading of a datalist option:
  // the value is what goes into the field, the label is the aside next to it
  // ("DE" / "Deutschland"). HTMLOptionElement.label falls back to the
  // option's text, which is why an <option>Apple</option> ends up with one
  // text and not two.
  readEntries = () => {
    this.entries = [...this.datalist.options]
      .filter((option) => !option.disabled && option.value.trim() !== '')
      .map((option) => {
        const value = option.value;
        const label = option.label === value ? '' : option.label;

        return {
          value,
          label,
          foldedValue: fold(value),
          foldedLabel: fold(label),
        };
      });
  };



  // The listbox itself. Inserted as the input's last sibling rather than
  // appended to the root, so the element holding the field is what positions
  // it — a root that also holds a label and a hint would put the popup below
  // those.
  buildList = () => {
    this.list = document.createElement('ul');
    this.list.id = uniqueId(this.params.listIdPrefix);
    this.list.setAttribute(this.params.listAttr, '');
    this.list.setAttribute('role', 'listbox');
    this.list.hidden = true;

    (this.input.parentElement ?? this.root).append(this.list);
  };



  // The polite region the suggestion count is announced through. role=status
  // waits its turn and never takes the focus, which is what a running result
  // count should do. It sits inside the root so it travels with the
  // component; its one style is in comboBox.scss, addressed by the same
  // attribute.
  //
  // Always built, never adopted from markup that happens to carry the
  // attribute: destroy() takes this node back out, and a teardown that
  // removed an element the author wrote would hand back less markup than it
  // was given.
  buildStatus = () => {
    this.status = document.createElement('div');
    this.status.setAttribute(this.params.statusAttr, '');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.root.append(this.status);
  };



  // Whether the field has an accessible name at all — read from the
  // platform's own list where it can be, so a <label for> pointing at a
  // different field cannot be mistaken for one.
  fieldName = () =>
    (this.input.labels?.length ?? 0) > 0 ||
    this.input.hasAttribute('aria-labelledby') ||
    this.input.hasAttribute('aria-label');



  // A listbox needs a name of its own, and the field's is the only honest
  // one: this list is that field's suggestions. Pointing at the same <label>
  // keeps the two in step — rename the field and the list is renamed with it.
  nameList = () => {
    const label = this.input.labels?.[0];
    if (label) {
      if (!label.id) {
        label.id = uniqueId(this.params.labelIdPrefix);
        this.generatedLabelId = true;
      }
      this.list.setAttribute('aria-labelledby', label.id);
      return;
    }

    const labelledBy = this.input.getAttribute('aria-labelledby');
    if (labelledBy) {
      this.list.setAttribute('aria-labelledby', labelledBy);
      return;
    }

    const ariaLabel = this.input.getAttribute('aria-label');
    if (ariaLabel) this.list.setAttribute('aria-label', ariaLabel);
  };



  seedField = () => {
    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-expanded', 'false');
    this.input.setAttribute('aria-controls', this.list.id);
    this.input.setAttribute('aria-autocomplete', 'list');

    // The browser's own form autofill would render a second popup over this
    // one. Only where the author has said nothing: a field collecting the
    // reader's own data wants its autocomplete token (WCAG 1.3.5), and that
    // token is the author's call, not this module's.
    this.setAutocomplete = !this.input.hasAttribute('autocomplete');
    if (this.setAutocomplete) this.input.setAttribute('autocomplete', 'off');

    if (!this.toggle) return;

    // Out of the tab order, per the APG: the arrow keys are the keyboard's
    // way into the list, so a second tab stop for the same list is noise in
    // a form. An author-set tabindex is left alone.
    if (!this.toggle.hasAttribute('tabindex')) {
      this.toggle.setAttribute('tabindex', '-1');
    }
  };



  // The native popup and the built one would otherwise open on top of each
  // other. The <datalist> stays in the document and stays the data source —
  // only the input's pointer at it goes, and comes back on teardown.
  swapOutNativeList = () => {
    this.input.removeAttribute('list');
  };



  // A datalist filled or replaced after init (a loaded fragment, a
  // server-rendered update) is the same list as far as this module is
  // concerned, so it is re-read rather than requiring a re-init. The module
  // never writes into the datalist itself, so this cannot feed back.
  watchDatalist = () => {
    this.observer = new MutationObserver(this.handleDatalistChange);
    this.observer.observe(this.datalist, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value', 'label', 'disabled'],
    });
  };



  startListening = () => {
    this.input.addEventListener('input', this.handleInput);
    this.input.addEventListener('keydown', this.handleKeydown);
    this.input.addEventListener('click', this.handleFieldClick);
    this.input.addEventListener('blur', this.handleBlur);

    this.list.addEventListener('mousedown', this.handleListMouseDown);
    this.list.addEventListener('click', this.handleListClick);

    this.toggle?.addEventListener('click', this.handleToggleClick);

    // The focus can leave the component to anywhere, so this one is on the
    // root rather than on any single control inside it.
    this.root.addEventListener('focusout', this.handleFocusOut);

    // The one value change no handler above can see (see handleReset). The
    // listener sits on the form, which is outside this component's own
    // subtree — hence the removal in destroy().
    this.form = this.input.form;
    this.form?.addEventListener('reset', this.handleReset);
  };



  isOpen = () => this.input.getAttribute('aria-expanded') === 'true';



  query = () => this.input.value.trim();



  // The options the current query leaves, or all of them where the toggle
  // asked for the full list.
  filtered = () => {
    const raw = this.query();
    if (this.showAll || !raw) return this.entries;

    const needle = fold(raw);
    return this.entries.filter(
      (entry) =>
        matchIndex(entry.foldedValue, needle, this.mode) >= 0 ||
        matchIndex(entry.foldedLabel, needle, this.mode) >= 0
    );
  };



  // Builds the option rows. Text nodes throughout — an option's text comes
  // out of the document and is never handed to innerHTML.
  //
  // `entries` is for a caller that has already asked filtered() something
  // about the result and would otherwise have it computed a second time
  // (openFromKeyboard); everything else lets this method ask.
  render = (entries = null) => {
    this.shown = entries ?? this.filtered();
    this.list.replaceChildren(
      ...this.shown.map((entry, index) => this.buildOption(entry, index))
    );
    this.activeIndex = -1;
    this.input.removeAttribute('aria-activedescendant');
  };



  buildOption = (entry, index) => {
    const option = document.createElement('li');
    option.id = `${this.list.id}-option-${index}`;
    option.setAttribute(this.params.optionAttr, '');
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');

    const value = document.createElement('span');
    value.setAttribute(this.params.valueAttr, '');
    this.fillMarked(value, entry.value);
    option.append(value);

    if (!entry.label) return option;

    const label = document.createElement('span');
    label.setAttribute(this.params.labelAttr, '');
    this.fillMarked(label, entry.label);
    option.append(label);

    return option;
  };



  // The part of the text the reader typed, wrapped in a span the stylesheet
  // can pick out. A <mark> would be the tempting element and is the wrong
  // one: it carries meaning ("relevant to the current context") that several
  // screen readers announce, and having every suggestion announced with its
  // matched fragment called out is noise, not help. So this is a plain span
  // — the option's accessible name is its text either way.
  fillMarked = (host, text) => {
    const range = this.showAll ? null : markRange(text, this.query(), this.mode);
    if (!range) {
      host.append(document.createTextNode(text));
      return;
    }

    const [start, end] = range;
    const mark = document.createElement('span');
    mark.setAttribute(this.params.markAttr, '');
    mark.append(document.createTextNode(text.slice(start, end)));

    host.append(
      document.createTextNode(text.slice(0, start)),
      mark,
      document.createTextNode(text.slice(end))
    );
  };



  // Opening is conditional on there being something to open: an empty popup
  // is a box of nothing, and a listbox with no options is not a state the
  // pattern has. The count is announced either way, which is how a reader
  // learns that the last character they typed left nothing.
  open = ({ all = false, entries = null } = {}) => {
    this.showAll = all;
    this.render(entries);
    this.announce();

    if (!this.shown.length) {
      this.close();
      return;
    }

    if (this.isOpen()) return;

    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  };



  // The keyboard's way in, and the toggle's counterpart: where the query
  // leaves nothing, the FULL list opens rather than nothing at all.
  //
  // Without it the way back from a typo was the toggle alone — and the
  // toggle is deliberately out of the tab order, so "show me everything" was
  // a pointer-only function, which is what WCAG 2.1.1 rules out. Clearing
  // the field reached the same list, but that is a different action and
  // nothing tells a reader to try it.
  //
  // Asked before rendering rather than by opening twice, so the popup is
  // built once and the count is announced once — "no suggestions" followed
  // half a millisecond later by "19 suggestions available" is not a sentence
  // anyone needs to hear. The matches are handed on rather than asked for
  // again: this runs on every arrow key that meets a closed list.
  openFromKeyboard = () => {
    const matches = this.filtered();
    if (!matches.length) {
      this.open({ all: true });
      return;
    }

    this.open({ entries: matches });
  };



  close = () => {
    this.showAll = false;

    if (!this.isOpen()) return;

    this.setActive(-1);
    this.list.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
  };



  // The highlighted option, as aria-activedescendant plus aria-selected on
  // the row. Both are the accessibility truth AND the styling hook, so there
  // is no third state class to keep in step with them.
  setActive = (index) => {
    const previous = this.list.children[this.activeIndex];
    previous?.setAttribute('aria-selected', 'false');

    this.activeIndex = index;

    const current = this.list.children[index];
    if (!current) {
      this.input.removeAttribute('aria-activedescendant');
      return;
    }

    current.setAttribute('aria-selected', 'true');
    this.input.setAttribute('aria-activedescendant', current.id);

    // "nearest" because the list is the scroll container here, not the page:
    // the field is where the reader already is, and pulling the page around
    // while they type would be the rudest thing this module could do.
    current.scrollIntoView({ block: 'nearest' });
  };



  // Walks the list with a wrap at both ends, opening it first where it is
  // closed. Wrapping is what the APG asks for and what a short list wants:
  // Up from the field is the quickest way to the last entry.
  move = (step) => {
    if (!this.isOpen()) {
      this.openFromKeyboard();
      if (!this.isOpen()) return;
      this.setActive(step > 0 ? 0 : this.shown.length - 1);
      return;
    }

    const count = this.shown.length;
    if (!count) return;

    const next = (this.activeIndex + step + count) % count;
    this.setActive(next);
  };



  // Taking an option is the only path that writes into the field, and it
  // writes exactly the option's value. The input and change events go out
  // because a value has genuinely changed and everything else bound to this
  // field — a character count, a validation module, a dependent select — is
  // listening for them; the flag keeps this module's own input handler from
  // treating its own write as typing.
  commit = (index) => {
    const entry = this.shown[index];
    if (!entry) return;

    this.committing = true;
    this.input.value = entry.value;
    this.close();

    // selectionStart is null on the input types that have no text selection
    // (email, number). A combobox should never be one of those, but a caret
    // move is not worth a throw if it is.
    const caret = this.input.value.length;
    if (this.input.selectionStart !== null) {
      this.input.setSelectionRange(caret, caret);
    }
    this.input.focus();

    this.syncValidity();
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
    this.committing = false;
  };



  // One sentence per change, and never the same one twice in a row: the
  // count is re-derived on every keystroke, but "3 suggestions available"
  // repeated at each of them would talk over the reader's own typing.
  announce = () => {
    if (!this.status) return;

    const sentence = this.countSentence(this.shown.length);
    if (sentence === this.announced) return;

    this.announced = sentence;
    this.status.textContent = sentence;
  };



  // Says nothing, and makes sure the next sentence is not swallowed as a
  // repeat. A field the reader has just emptied has no result to report: the
  // list is closed, so "19 suggestions available" would be announcing a
  // popup that is not there — and they did not ask for the list, they
  // deleted their query. Clearing the text is silent; only new text in a
  // live region is read.
  clearAnnouncement = () => {
    if (!this.status) return;

    this.announced = '';
    this.status.textContent = '';
  };



  countSentence = (count) => {
    if (!count) return this.labels.none;
    if (count === 1) return this.labels.one;
    return formatTemplate(this.labels.many, { count });
  };



  // The strict lane, and the whole of it: the verdict goes through the
  // platform's constraint API, so checkValidity(), :invalid, the browser's
  // own bubble and formValidation all learn about it at once, and this
  // module draws nothing and blocks nothing. An empty field is not the
  // module's business — "this field is required" is what required says.
  syncValidity = () => {
    if (!this.strict) return;

    const raw = this.query();
    const valid = !raw || !!this.exactEntry(raw);
    this.input.setCustomValidity(valid ? '' : this.invalidMessage());
  };



  invalidMessage = () =>
    this.root.getAttribute(this.params.messageAttr) || this.labels.invalid;



  // The option a value names, comparing the way the filter compares: a
  // reader who typed "zurich" meant "Zürich", and a strict field that
  // rejected it would be rejecting its own matching rule.
  exactEntry = (value) => {
    const needle = fold(value);
    return this.entries.find((entry) => entry.foldedValue === needle) ?? null;
  };



  // Where a strict field's value differs from the option only in case or in
  // accents, the option's spelling wins — otherwise "zurich" is what the
  // server is asked to recognise. Only on blur, only in the strict lane, and
  // only when the reader has finished: rewriting mid-word would fight the
  // caret. Nothing else about the value is ever touched.
  normalizeValue = () => {
    if (!this.strict) return;

    const raw = this.query();
    if (!raw) return;

    const entry = this.exactEntry(raw);
    if (!entry || entry.value === this.input.value) return;

    // Same flag as commit(): the events below are this module's own write,
    // and without it the input handler would read them as typing and open
    // the list on a field the reader has just left.
    this.committing = true;
    this.input.value = entry.value;
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
    this.committing = false;
  };



  handleInput = (event) => {
    if (this.committing) return;

    // A value being composed is not a query yet: filtering on the half-built
    // characters an IME is still offering would empty the list under the
    // reader's candidate window.
    if (event.isComposing) return;

    this.syncValidity();

    // An autofill is a value change, not a reader typing into an open
    // field. It updates the validity above and stops there: a popup opening
    // on a field nobody is in would be a box appearing out of nowhere. The
    // two writes that arrive with no input event at all are a script setting
    // .value — which nothing can observe — and a form reset, which is why
    // the form is listened to separately.
    if (document.activeElement !== this.input) return;

    if (!this.query()) {
      this.close();
      this.render();
      this.clearAnnouncement();
      return;
    }

    this.open();
  };



  handleKeydown = (event) => {
    if (event.isComposing) return;

    const handler = this.keyHandlers[event.key];
    if (!handler) return;

    handler(event);
  };



  // Keyed by event.key so the routing stays a table and each branch stays a
  // sentence. Every one of them decides for itself whether the key was
  // actually consumed — a key this component does not use has to stay
  // available to the dialog, the form or the page around it.
  keyHandlers = {

    ArrowDown: (event) => {
      event.preventDefault();

      // Alt+Down is "show me the list", not "walk it": the APG separates the
      // two so a reader can see what is on offer without committing to a
      // first option they have not read yet.
      if (event.altKey) {
        this.openFromKeyboard();
        return;
      }

      this.move(1);
    },

    ArrowUp: (event) => {
      event.preventDefault();

      if (event.altKey) {
        this.close();
        return;
      }

      this.move(-1);
    },

    Enter: (event) => {
      if (!this.isOpen() || this.activeIndex < 0) return;

      // Only consumed where it took an option. With nothing highlighted the
      // key belongs to the form, and a combobox that swallowed it would be a
      // field you cannot submit from.
      event.preventDefault();
      this.commit(this.activeIndex);
    },

    Escape: (event) => {
      if (!this.isOpen()) return;

      event.preventDefault();
      this.close();
    },

    Tab: () => {
      this.close();
    },
  };



  // A press in the field opens the list; the focus arriving there does not.
  // Tabbing through a form should not leave a trail of open popups, while a
  // reader who clicked the field is asking to see what it offers.
  handleFieldClick = () => {
    if (this.isOpen()) return;
    this.open();
  };



  // Keeps the focus in the field while an option is pressed. Without this
  // the press would blur the input, the focusout below would close the list,
  // and the click would land on nothing — the classic reason a combobox
  // "cannot be clicked".
  //
  // On "mousedown" rather than "pointerdown", and the difference matters on
  // a touch screen: a prevented pointerdown can also cancel the pan the
  // browser was about to start, which would make a long list impossible to
  // scroll with a finger. A tap's mousedown arrives only once the gesture
  // has been settled as a tap — after the scroll decision, before the focus
  // change — which is exactly the moment this needs.
  handleListMouseDown = (event) => {
    event.preventDefault();
  };



  handleListClick = (event) => {
    const option = event.target.closest(`[${this.params.optionAttr}]`);
    if (!option) return;

    this.commit([...this.list.children].indexOf(option));
  };



  handleToggleClick = () => {
    if (this.isOpen()) {
      this.close();
      this.input.focus();
      return;
    }

    // The full list, not the filtered one: this is the way back when what
    // was typed matches nothing, and a button that opened an empty list
    // would be useless at exactly the moment it is needed.
    this.open({ all: true });
    this.input.focus();
  };



  handleBlur = () => {
    this.normalizeValue();
    this.syncValidity();
  };



  handleFocusOut = (event) => {
    if (event.relatedTarget && this.root.contains(event.relatedTarget)) return;
    this.close();
  };



  // A reset puts the form's values back without an input event ever firing,
  // so it is the one value change the handlers above never see. Left alone,
  // a strict field would keep reporting a value that is gone: the field is
  // empty, the message still says the entry is not in the list, and no
  // amount of pressing submit lifts it — only typing would.
  //
  // Deferred, because the event fires BEFORE the values are put back
  // (formValidation's own reset handler reads the same order). A microtask
  // is late enough: the reset runs synchronously after this listener
  // returns, so the field holds its new value by the time the queue is
  // reached. The guard is for a teardown in between — destroy() has already
  // cleared the message, and this must not write a new one onto a field it
  // has handed back.
  handleReset = () => {
    this.close();
    this.clearAnnouncement();

    queueMicrotask(() => {
      if (!this.enhanced) return;
      this.syncValidity();
    });
  };



  handleDatalistChange = () => {
    this.readEntries();
    this.syncValidity();

    if (!this.isOpen()) return;

    this.open({ all: this.showAll });
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly —
  // see destroyModulesInScope() in boot.js. Two things outlive the
  // component's own subtree and have to be taken back by hand: the observer
  // on the <datalist> (which may sit anywhere in the document, and may be
  // shared by several fields) and the reset listener on the <form> around
  // it. Everything else hands the markup back as authored, which here means
  // handing back a plain <input list> with the browser's own popup.
  destroy = () => {
    this.observer?.disconnect();
    this.form?.removeEventListener('reset', this.handleReset);

    this.input?.removeEventListener('input', this.handleInput);
    this.input?.removeEventListener('keydown', this.handleKeydown);
    this.input?.removeEventListener('click', this.handleFieldClick);
    this.input?.removeEventListener('blur', this.handleBlur);
    this.toggle?.removeEventListener('click', this.handleToggleClick);
    this.root.removeEventListener('focusout', this.handleFocusOut);

    if (!this.enhanced) return;

    this.list.remove();
    this.status?.remove();

    this.input.removeAttribute('role');
    this.input.removeAttribute('aria-expanded');
    this.input.removeAttribute('aria-controls');
    this.input.removeAttribute('aria-autocomplete');
    this.input.removeAttribute('aria-activedescendant');
    if (this.setAutocomplete) this.input.removeAttribute('autocomplete');
    if (this.listValue) this.input.setAttribute('list', this.listValue);

    // Cleared unconditionally: this module is the only thing that sets it on
    // this field (see the readme), and a field handed back holding a message
    // nothing will ever lift could not be submitted again.
    if (this.strict) this.input.setCustomValidity('');

    const label = this.input.labels?.[0];
    if (this.generatedLabelId) label?.removeAttribute('id');

    this.root.removeAttribute(this.params.readyAttr);
    this.enhanced = false;
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'comboBox',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new ComboBox(el, defaults, reporter);
  return instance.destroy;
}
