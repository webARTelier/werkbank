/**
 * formValidation.js
 * --------------------------------------------------------------------------
 * Progressive-enhancement controller that turns the browser's built-in form
 * validation into accessible, inline error messages. It validates on submit,
 * gates the submit when something is wrong, and — once the user has tried
 * to submit — keeps each field's message in sync live as they fix it.
 *
 * Strategy (like the other components: derive state from the native source)
 * -------------------------------------------------------------------------
 * The single source of truth is the platform's Constraint Validation API.
 * Every message and state class is derived from `field.validity` (a live
 * ValidityState) and `field.checkValidity()` — never from a parallel model
 * we maintain ourselves. Just as the dialog leans on the native <dialog>,
 * the accordion on <details> and the countdown recomputes from its target
 * date, this component leans on the constraints the author already declared
 * in the markup (`required`, `type="email"`, `pattern`, `minlength`,
 * `min`/`max`, `step`, …). We add no validation rules of our own; we only
 * present the platform's verdict.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * The browser knows, at any moment, whether each control satisfies its
 * constraints (`willValidate`, `validity`, `validationMessage`) and blocks
 * a native submit of an invalid form on its own. Without JavaScript that is
 * exactly what happens: the form validates and the browser shows its default
 * bubbles — so the form is never left unguarded. This script is a pure
 * enhancement layered on top.
 *
 * What this script adds
 * ---------------------
 * 1. Inline messages instead of native bubbles: we set `novalidate` on the
 *    form (only now, from JS — so the no-JS path keeps native validation)
 *    to suppress the browser's transient bubbles, and render a persistent
 *    message per field instead. The bubble disappears on the next click; an
 *    inline message stays readable while the user fixes the field.
 * 2. Localized, overridable text: the native `validationMessage` follows the
 *    browser UI language, not the page. We ship de/en defaults chosen from
 *    <html lang> and let the author override any message per field via
 *    data attributes (see resolveMessage / the `checks` list), falling back
 *    to the native message for anything we do not cover. On top of that, ALL
 *    default messages are maintainable in one place by a CMS: a single
 *    <script type="application/json" data-fv-messages> block on the page
 *    (same {locale: {id: template}} shape as defaultMessages below) is merged
 *    over the built-in defaults — see readCmsMessages. Templates may
 *    interpolate live field limits via {minLength}, {maxLength},
 *    {valueLength}, {min}, {max}.
 * 3. Accessible wiring: an invalid field gets `aria-invalid="true"` and an
 *    `aria-describedby` link to its inline message, tying the message to the
 *    control (WCAG 3.3.1). The message itself is a quiet element (NOT a live
 *    region): errors are announced once, together, through the summary in
 *    point 4 — so a failed submit does not fire a burst of competing alerts,
 *    and live typing does not re-announce on every keystroke. All of it is
 *    removed again the moment the field becomes valid.
 * 4. Error summary + focus management: on a failed submit we inject (or update)
 *    a focusable, labelled summary at the top of the form that lists every
 *    invalid field as a link jumping to it, and move focus there. Focusing the
 *    summary announces the problem count and lets a keyboard or screen-reader
 *    user step through every error from one place (WCAG 2.4.3 / 3.3.1 /
 *    4.1.3), instead of only landing on the first field. The summary stays in
 *    sync as fields are fixed and disappears once the form is valid.
 * 5. Live correction feedback: after the first submit attempt, each field is
 *    re-validated as it changes, so a message clears the instant the value
 *    becomes valid instead of only on the next submit. Before that first
 *    attempt we stay quiet, so a user is never nagged about a field they
 *    have not reached yet.
 * 6. One cross-field rule: `data-fv-equals="#otherField"` (e.g. an email or
 *    password confirmation). The platform has no native constraint for "must
 *    match that field", so this is the single rule we add ourselves — but we
 *    feed it THROUGH the native API via setCustomValidity(), so everything
 *    downstream (validity, messages, aria, focus) keeps working off the
 *    platform verdict. When the referenced field changes, every field
 *    pointing at it is re-validated too, so a fixed pair clears on either
 *    side.
 *
 * Styling contract
 * ----------------
 * This component ships no styles of its own (behaviour-only; see the stub
 * `formValidation.scss` and the CLAUDE.md focus-ring convention). It only
 * toggles class hooks the consuming project styles: `is-submitted` on the
 * form, and `is-invalid` on each field's item container, plus the `fv-error`
 * message element. Restyle freely — the JS never reads these classes back,
 * it only owns writing them.
 * --------------------------------------------------------------------------
 */

import { resolveLocale } from './resolveLocale.js';



const defaults = {

  // The field-group container that holds one control (or one radio/checkbox
  // group) together with its message. It receives the invalid-state class
  // and is where the message element is appended. Marked with a behavioural
  // attribute (not a style class) so the script stays decoupled from the CSS.
  // When a field has no such ancestor we fall back to its parent element.
  itemAttr: 'data-fv-item',

  // Generic per-field message override: one message shown for whichever
  // constraint the field currently fails. A per-constraint override (see
  // `checks`) is more specific and wins over this.
  messageAttr: 'data-fv-message',

  // Cross-field rule: the attribute value is a selector (scoped to the form)
  // for the field this one must match, e.g. data-fv-equals="#email". Message
  // override: data-fv-equals-message. See syncEqualsValidity.
  equalsAttr: 'data-fv-equals',

  // State hooks (styling only; the JS owns writing them, never reads them
  // back).
  formSubmittedClass: 'is-submitted', // on the <form>, after the first submit
  itemInvalidClass: 'is-invalid',     // on an invalid field's item container
  errorClass: 'fv-error',             // on the injected message element

  // The error summary injected at the top of the form on a failed submit: a
  // focusable, labelled region listing every invalid field as a link that
  // moves focus to it. Focus is moved here on submit, so this is the single
  // place errors are announced — the per-field messages stay quiet (see the
  // file header). Class hooks are styling-only; the JS owns writing them.
  summaryClass: 'fv-summary',
  summaryTitleClass: 'fv-summary__title',
  summaryListClass: 'fv-summary__list',
  summaryAttr: 'data-fv-summary',

  // A page-level JSON block with this marker attribute overrides/extends the
  // built-in defaultMessages — the single place a CMS maintains all default messages
  // (shape: {locale: {messageId: template}}). Locales are derived from the
  // merged object, so a CMS can add languages beyond de/en without
  // touching JS.
  messagesSelector: 'script[type="application/json"][data-fv-messages]',

  // Used when <html lang> matches none of the offered locales. Any single
  // message not covered falls back to the browser's native validationMessage.
  fallbackLocale: 'en',

  // Ordered ValidityState flags to test. The first flag that is true decides
  // the message. `attr` is the friendly per-field override attribute for that
  // constraint (read as data-fv-<attr>, e.g. data-fv-required="…").
  checks: [
    { key: 'valueMissing', attr: 'fvRequired' },
    { key: 'typeMismatch', attr: 'fvType' },
    { key: 'tooShort', attr: 'fvMinlength' },
    { key: 'tooLong', attr: 'fvMaxlength' },
    { key: 'patternMismatch', attr: 'fvPattern' },
    { key: 'rangeUnderflow', attr: 'fvMin' },
    { key: 'rangeOverflow', attr: 'fvMax' },
    { key: 'stepMismatch', attr: 'fvStep' },
    { key: 'badInput', attr: 'fvBadinput' },
  ],
};



// Localized default messages, keyed by locale then by a message id. The ids
// are the ValidityState flags (plus `equals` for the cross-field rule), with
// a few control-type variants for the ones whose wording should differ (a
// checkbox is "tick this", a select is "choose an entry"). Values are plain
// template strings — NOT functions — so the whole map stays JSON-shaped and
// a CMS can override it 1:1 via the data-fv-messages block (see
// readCmsMessages). {placeholders} are interpolated from the live element
// by formatMessage. Anything not covered here degrades to the browser's own
// validationMessage.
const defaultMessages = {

  de: {
    valueMissing: 'Bitte füllen Sie dieses Feld aus.',
    valueMissingCheckbox: 'Bitte aktivieren Sie dieses Feld, um fortzufahren.',
    valueMissingRadio: 'Bitte wählen Sie eine der Optionen aus.',
    valueMissingSelect: 'Bitte wählen Sie einen Eintrag aus der Liste.',
    typeMismatch: 'Bitte geben Sie einen Wert im richtigen Format ein.',
    typeMismatchEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    typeMismatchUrl: 'Bitte geben Sie eine gültige URL ein (z. B. https://…).',
    patternMismatch: 'Bitte halten Sie sich an das geforderte Format.',
    tooShort: 'Bitte verwenden Sie mindestens {minLength} Zeichen (aktuell {valueLength}).',
    tooLong: 'Bitte verwenden Sie höchstens {maxLength} Zeichen (aktuell {valueLength}).',
    rangeUnderflow: 'Bitte wählen Sie einen Wert größer oder gleich {min}.',
    rangeOverflow: 'Bitte wählen Sie einen Wert kleiner oder gleich {max}.',
    stepMismatch: 'Bitte wählen Sie einen gültigen Wert.',
    badInput: 'Bitte geben Sie einen gültigen Wert ein.',
    equals: 'Die Eingaben stimmen nicht überein.',
    summaryTitleSingular: 'Bitte korrigieren Sie eine Eingabe:',
    summaryTitlePlural: 'Bitte korrigieren Sie {count} Eingaben:',
  },
  
  en: {
    valueMissing: 'Please fill out this field.',
    valueMissingCheckbox: 'Please tick this box to continue.',
    valueMissingRadio: 'Please select one of the options.',
    valueMissingSelect: 'Please choose an item from the list.',
    typeMismatch: 'Please enter a value in the correct format.',
    typeMismatchEmail: 'Please enter a valid email address.',
    typeMismatchUrl: 'Please enter a valid URL (e.g. https://…).',
    patternMismatch: 'Please match the requested format.',
    tooShort: 'Please use at least {minLength} characters (currently {valueLength}).',
    tooLong: 'Please use no more than {maxLength} characters (currently {valueLength}).',
    rangeUnderflow: 'Please choose a value no lower than {min}.',
    rangeOverflow: 'Please choose a value no higher than {max}.',
    stepMismatch: 'Please choose a valid value.',
    badInput: 'Please enter a valid value.',
    equals: 'The values do not match.',
    summaryTitleSingular: 'Please correct one entry:',
    summaryTitlePlural: 'Please correct {count} entries:',
  },
};



// The placeholders a message template may use, each read live from the field
// at the moment the message is rendered (so "currently 3 characters" stays
// true).
const messageTokens = {
  minLength: (el) => el.minLength,
  maxLength: (el) => el.maxLength,
  valueLength: (el) => el.value.length,
  min: (el) => el.min,
  max: (el) => el.max,
};



// Interpolates {placeholder} tokens in a message template from the live
// field. Unknown placeholders are left as-is so a CMS typo stays visible,
// not silent.
function formatMessage(template, field) {
  if (!template) return '';
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    messageTokens[key] ? String(messageTokens[key](field)) : match
  );
}



// Reads the page-level CMS message block (see defaults.messagesSelector)
// and merges it over the built-in defaults, per locale and per message id —
// so the CMS only has to maintain the messages (or locales) it actually
// changes. Non-string values are ignored defensively; a malformed block is
// reported and skipped so the built-in messages keep working.
function readCmsMessages(selector, reporter) {
  const el = document.querySelector(selector);
  if (!el) return null;

  try {
    return JSON.parse(el.textContent);
  } catch (error) {
    reporter?.report('formValidation', 'ignoring malformed data-fv-messages JSON.', el);
    return null;
  }
}



function mergeMessages(builtIn, cms) {
  if (!cms || typeof cms !== 'object') return builtIn;

  const merged = { ...builtIn };
  for (const [locale, entries] of Object.entries(cms)) {
    if (!entries || typeof entries !== 'object') continue;
    merged[locale] = { ...merged[locale] };
    for (const [id, template] of Object.entries(entries)) {
      if (typeof template === 'string') merged[locale][id] = template;
    }
  }
  return merged;
}



// Turns a name/id into an id-safe token for the message element's id.
function safeIdPart(value) {
  return String(value || 'field').replace(/[^a-zA-Z0-9_-]/g, '-');
}



// Input/button types that submit or reset a form. They report willValidate
// but are never "invalid", so we exclude them from the fields we validate —
// see getFields.
const buttonTypes = ['submit', 'reset', 'button', 'image'];



// Distinguishes multiple forms on one page, so their generated
// message-element ids never collide (a form without its own id still gets a
// unique scope).
let instanceCount = 0;



class FormValidation {

  constructor(form, config, reporter) {
    this.form = form;
    this.config = config;
    this.reporter = reporter;

    // Built-in de/en defaults, overridden/extended by the page's CMS block.
    // The offered locales are whatever the merged map contains.
    const allMessages = mergeMessages(defaultMessages, readCmsMessages(config.messagesSelector, reporter));
    const locale = resolveLocale(Object.keys(allMessages), config.fallbackLocale);
    this.messages = allMessages[locale] || allMessages[config.fallbackLocale];

    // Whether the user has attempted a submit yet. Before that we validate
    // nothing on the fly, so no field is flagged before it has been reached.
    this.submitted = false;

    // The injected summary element while it exists (null otherwise).
    this.summary = null;

    // Per-form id scope + fallback counter for controls that have no name/id,
    // so message-element ids stay unique within and across forms.
    this.scopeId = form.id ? safeIdPart(form.id) : `fvForm${++instanceCount}`;
    this.autoId = 0;

    this.setup();
  }



  setup = () => {
    // Take over the messaging from JS: suppress the native bubbles so we can
    // show persistent inline messages instead. Set only now, so a no-JS page
    // keeps the browser's own validation (progressive enhancement — see file
    // header).
    this.form.setAttribute('novalidate', '');

    this.form.addEventListener('submit', this.handleSubmit);

    // Live correction feedback after the first submit attempt. Delegated to
    // the form so dynamically added fields are covered too; "input" catches
    // typing, "change" catches selects/checkboxes/radios that fire only on
    // commit.
    this.form.addEventListener('input', this.handleFieldChange);
    this.form.addEventListener('change', this.handleFieldChange);

    // A native reset returns every field to a valid resting value, so drop
    // all error UI and go quiet again until the next submit attempt.
    this.form.addEventListener('reset', this.handleReset);
  };



  // All controls the platform considers candidates for validation.
  // `willValidate` is the native filter: it is already false for disabled,
  // hidden, <output>, etc. Submit/reset/button controls DO report
  // willValidate (and are always valid), so we drop them explicitly — a
  // button is not a field to validate, and treating it as one would let its
  // (unwrapped) container stand in for a real field. Queried fresh each time
  // to include late-added fields.
  getFields = () =>
    [...this.form.elements].filter(
      (el) => el.willValidate && !buttonTypes.includes(el.type)
    );



  handleSubmit = (event) => {
    this.markSubmitted();

    const invalidFields = this.validateAll();
    if (!invalidFields.length) {
      this.removeSummary();
      return;
    }

    event.preventDefault();
    this.renderSummary(invalidFields);
    this.focusField(this.summary);
  };



  // Validates every field, updates its UI and returns the invalid controls in
  // DOM order — deduplicated so a radio/checkbox group (whose members share one
  // message) contributes a single entry. That order feeds both the focus
  // target and the summary, so both follow the visual field order.
  validateAll = () => {
    const invalid = [];
    const seen = new Set();
    for (const field of this.getFields()) {
      if (this.validateField(field)) continue;
      const id = this.errorIdFor(field);
      if (seen.has(id)) continue;
      seen.add(id);
      invalid.push(field);
    }
    return invalid;
  };



  // Only act once the user has tried to submit; then keep the changed field's
  // message in sync so a fixed field clears immediately.
  handleFieldChange = (event) => {
    if (!this.submitted) return;
    const field = event.target;
    if (field && field.willValidate && !buttonTypes.includes(field.type)) {
      this.validateField(field);
      this.revalidateEqualsDependents(field);
      this.refreshSummary();
    }
  };



  // When a field changes, any field whose data-fv-equals points at it must be
  // re-checked too — editing "Email" has to clear (or raise) the error on
  // "Repeat email", not just the other way around.
  revalidateEqualsDependents = (source) => {
    for (const dependent of this.form.querySelectorAll(`[${this.config.equalsAttr}]`)) {
      if (dependent === source) continue;
      if (this.equalsTargetOf(dependent) === source) this.validateField(dependent);
    }
  };



  handleReset = () => {
    for (const field of this.getFields()) {
      this.clearFieldError(field, this.itemOf(field));
      // A pending equals violation lives in the field's custom validity;
      // drop it so the resting form is natively valid again (values reset
      // right after this event, and we recompute from scratch on the next
      // submit anyway).
      if (field.hasAttribute(this.config.equalsAttr)) field.setCustomValidity('');
    }
    this.removeSummary();
    this.form.classList.remove(this.config.formSubmittedClass);
    this.submitted = false;
  };



  markSubmitted = () => {
    this.submitted = true;
    this.form.classList.add(this.config.formSubmittedClass);
  };



  // Runs the native check and reflects the verdict into the UI. Returns
  // validity so callers can track the first failure.
  validateField = (field) => {
    
    // Feed the one non-native rule into the native API first, so the
    // checkValidity() below already includes it.
    this.syncEqualsValidity(field);

    const item = this.itemOf(field);

    if (field.checkValidity()) {
      this.clearFieldError(field, item);
      return true;
    }

    this.showFieldError(field, item, this.resolveMessage(field));
    return false;
  };



  // The container that owns this field's invalid state and message. Prefer
  // the explicit item wrapper (which also groups radios/checkboxes under one
  // message); fall back to the field's parent so an unmarked form still
  // works.
  itemOf = (field) => field.closest(`[${this.config.itemAttr}]`) || field.parentElement;



  // --- data-fv-equals: the one rule the platform has no constraint for -----

  // Resolves the field this one must match. Scoped to the form; an invalid or
  // unresolvable selector yields null (reported once per validation, so a
  // typo does not silently disable the rule).
  equalsTargetOf = (field) => {
    const selector = field.getAttribute(this.config.equalsAttr);
    if (!selector) return null;

    try {
      return this.form.querySelector(selector);
    } catch (error) {
      return null;
    }
  };



  // Translates the match/mismatch into the native API via setCustomValidity,
  // so checkValidity(), validity.customError and validationMessage all
  // reflect it and the rest of the component needs no special casing. NOTE:
  // this owns the field's custom validity — do not combine data-fv-equals
  // with your own setCustomValidity on the same field.
  syncEqualsValidity = (field) => {
    if (!field.hasAttribute(this.config.equalsAttr)) return;

    const target = this.equalsTargetOf(field);
    if (!target) {
      this.reporter?.report(
        'formValidation',
        `data-fv-equals selector "${field.getAttribute(this.config.equalsAttr)}" matches nothing in this form.`,
        field
      );
      field.setCustomValidity('');
      return;
    }

    const matches = field.value === target.value;
    field.setCustomValidity(matches ? '' : this.equalsMessage(field));
  };



  // Message precedence mirrors resolveMessage: per-rule override > generic
  // override > localized default (CMS-overridable via the `equals` id).
  equalsMessage = (field) =>
    field.dataset.fvEqualsMessage ||
    field.dataset[this.datasetKey(this.config.messageAttr)] ||
    formatMessage(this.messages.equals, field);



  showFieldError = (field, item, message) => {
    if (item) item.classList.add(this.config.itemInvalidClass);
    field.setAttribute('aria-invalid', 'true');

    if (!item) return;
    const errorEl = this.getOrCreateErrorEl(field, item);
    errorEl.textContent = message;
    this.addDescribedBy(field, errorEl.id);
  };



  clearFieldError = (field, item) => {
    field.removeAttribute('aria-invalid');
    if (item) item.classList.remove(this.config.itemInvalidClass);

    // Look up THIS field's own message by its stable id, never a generic
    // container query: an unwrapped field's item can be a broad ancestor
    // (even the <form>), and a container query would then delete another
    // field's message that happens to sit inside it.
    const errorEl = document.getElementById(this.errorIdFor(field));
    if (errorEl) {
      this.removeDescribedBy(field, errorEl.id);
      errorEl.remove();
    }
  };



  // One message element per field (radios/checkboxes sharing a name share
  // one), reused across re-validations and found again by its stable id.
  // Marked with data-fv-error for styling/selection. It is intentionally NOT a
  // live region: the field is tied to it via aria-describedby (read when the
  // field takes focus), while the one-shot announcement of "what is wrong"
  // happens through the focused error summary — see the file header. This
  // keeps a failed submit from firing a burst of competing alerts and keeps
  // live typing from re-announcing on every keystroke.
  getOrCreateErrorEl = (field, item) => {
    const id = this.errorIdFor(field);
    let errorEl = document.getElementById(id);
    if (errorEl) return errorEl;

    errorEl = document.createElement('span');
    errorEl.className = this.config.errorClass;
    errorEl.setAttribute('data-fv-error', '');
    errorEl.id = id;

    item.append(errorEl);
    return errorEl;
  };



  // Stable, form-scoped id for a field's message element, derived from its
  // name (so a radio/checkbox group shares one message) or id, with a
  // per-form counter for anonymous controls remembered on the element itself.
  errorIdFor = (field) => {
    const base = field.name || field.id;
    if (!base && !field.dataset.fvAnon) field.dataset.fvAnon = `anon${++this.autoId}`;
    const key = base ? safeIdPart(base) : field.dataset.fvAnon;
    return `${this.scopeId}-fvError-${key}`;
  };



  // Resolves the message for a field's current failure, most specific first:
  // author's setCustomValidity() > per-constraint override (data-fv-<attr>)
  // > generic override (data-fv-message) > localized default > native
  // message.
  resolveMessage = (field) => {
    const validity = field.validity;

    // An author-set custom message (setCustomValidity elsewhere) is
    // intentional and already localized by them, so it wins outright.
    if (validity.customError && field.validationMessage) return field.validationMessage;

    const generic = field.dataset[this.datasetKey(this.config.messageAttr)];

    for (const check of this.config.checks) {
      if (!validity[check.key]) continue;

      const specific = field.dataset[check.attr];
      if (specific) return specific;
      if (generic) return generic;

      return this.defaultMessage(field, check.key) || field.validationMessage;
    }

    return generic || field.validationMessage;
  };



  // Localized default text for one ValidityState flag, with the control-type
  // and input-type variants applied and {placeholders} interpolated from the
  // element.
  defaultMessage = (field, key) => {
    const m = this.messages;

    if (key === 'valueMissing') {
      if (field.type === 'checkbox') return formatMessage(m.valueMissingCheckbox, field);
      if (field.type === 'radio') return formatMessage(m.valueMissingRadio, field);
      if (field.tagName === 'SELECT') return formatMessage(m.valueMissingSelect, field);
      return formatMessage(m.valueMissing, field);
    }

    if (key === 'typeMismatch') {
      if (field.type === 'email') return formatMessage(m.typeMismatchEmail, field);
      if (field.type === 'url') return formatMessage(m.typeMismatchUrl, field);
      return formatMessage(m.typeMismatch, field);
    }

    // For a pattern, an author-supplied `title` is the format instruction the
    // native message would show too, so prefer it (WCAG 3.3.2).
    if (key === 'patternMismatch') {
      return field.title ? field.title : formatMessage(m.patternMismatch, field);
    }

    return formatMessage(m[key], field);
  };



  // Moves focus to an element — the summary on a failed submit, or a field when
  // a summary link is used — then scrolls it into view (respecting
  // reduced-motion). Focusing, not just scrolling, lands keyboard/AT users on
  // it (WCAG 2.4.3).
  focusField = (element) => {
    element.focus({ preventScroll: true });

    const reduceMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  };



  // --- error summary -------------------------------------------------------

  // Builds (or updates) the summary from the current invalid fields. Never
  // steals focus itself — handleSubmit moves focus here once; live refreshes
  // only rewrite its contents so the user is not yanked around while typing.
  renderSummary = (fields) => {
    const summary = this.getOrCreateSummary();

    summary.querySelector(`.${this.config.summaryTitleClass}`).textContent =
      this.summaryTitle(fields.length);

    const list = summary.querySelector(`.${this.config.summaryListClass}`);
    list.textContent = '';

    for (const field of fields) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = field.id ? `#${field.id}` : '#';
      link.textContent = this.summaryEntryText(field);
      // Focus the control directly (works for id-less and visually-hidden
      // radio/checkbox controls too) instead of relying on the hash jump.
      link.addEventListener('click', (event) => {
        event.preventDefault();
        this.focusField(field);
      });
      item.append(link);
      list.append(item);
    }
  };



  // Live update after the first submit: rebuild the summary from a fresh scan
  // (without re-rendering each field) so a fixed field drops out and the
  // summary vanishes once nothing is wrong.
  refreshSummary = () => {
    const invalid = this.collectInvalid();
    if (!invalid.length) {
      this.removeSummary();
      return;
    }
    this.renderSummary(invalid);
  };



  // The current invalid fields, deduplicated per message id (like validateAll)
  // but WITHOUT touching any field UI — it only reads validity, so it is safe
  // to call on every keystroke. Equals fields are re-synced first so their
  // custom validity is current.
  collectInvalid = () => {
    const invalid = [];
    const seen = new Set();
    for (const field of this.getFields()) {
      if (field.hasAttribute(this.config.equalsAttr)) this.syncEqualsValidity(field);
      if (field.checkValidity()) continue;
      const id = this.errorIdFor(field);
      if (seen.has(id)) continue;
      seen.add(id);
      invalid.push(field);
    }
    return invalid;
  };



  // The focusable, labelled summary region, created once and reused. role +
  // aria-labelledby (to the count-bearing title) make focusing it announce the
  // problem; tabindex="-1" makes it programmatically focusable without joining
  // the tab order. It is deliberately NOT a live region — focus is moved here,
  // so a live region would double the announcement.
  getOrCreateSummary = () => {
    if (this.summary && this.summary.isConnected) return this.summary;

    const titleId = `${this.scopeId}-fvSummary-title`;

    const summary = document.createElement('div');
    summary.className = this.config.summaryClass;
    summary.setAttribute(this.config.summaryAttr, '');
    summary.setAttribute('role', 'group');
    summary.setAttribute('tabindex', '-1');
    summary.setAttribute('aria-labelledby', titleId);

    const title = document.createElement('p');
    title.className = this.config.summaryTitleClass;
    title.id = titleId;

    const list = document.createElement('ul');
    list.className = this.config.summaryListClass;

    summary.append(title, list);
    this.form.prepend(summary);
    this.summary = summary;
    return summary;
  };



  removeSummary = () => {
    if (this.summary) this.summary.remove();
    this.summary = null;
  };



  // "Bitte korrigieren Sie 3 Eingaben:" — singular/plural chosen by count, with
  // {count} interpolated. CMS-overridable via the summaryTitle* message ids.
  summaryTitle = (count) => {
    const template =
      count === 1 ? this.messages.summaryTitleSingular : this.messages.summaryTitlePlural;
    return String(template || '').replace(/\{count\}/g, String(count));
  };



  // One summary line: the field's label (the group's legend for radios) plus
  // its current message, so identical generic messages stay distinguishable
  // ("Name: Bitte ausfüllen" vs "E-Mail: Bitte ausfüllen").
  summaryEntryText = (field) => {
    const label = this.labelTextFor(field);
    const message = this.resolveMessage(field);
    return label ? `${label}: ${message}` : message;
  };



  // Best available accessible name for a field, for the summary line:
  // aria-label / aria-labelledby, else the associated or wrapping <label>, else
  // the group's <legend> (preferred for radios, whose own labels name only one
  // option), else the name/id as a last resort.
  labelTextFor = (field) => {
    const aria = field.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();

    const labelledby = field.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = labelledby
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || '')
        .join(' ');
      if (text.trim()) return this.collapse(text);
    }

    // A radio's own <label> names a single option; the group question lives in
    // the fieldset's <legend>, which is the useful summary label.
    if (field.type === 'radio') {
      const legend = field.closest('fieldset')?.querySelector('legend');
      if (legend) return this.collapse(legend.textContent);
    }

    if (field.id) {
      const explicit = this.form.querySelector(`label[for="${CSS.escape(field.id)}"]`);
      if (explicit) return this.collapse(explicit.textContent);
    }

    const wrapping = field.closest('label');
    if (wrapping) return this.collapse(wrapping.textContent);

    const legend = field.closest('fieldset')?.querySelector('legend');
    if (legend) return this.collapse(legend.textContent);

    return field.name || field.id || '';
  };



  collapse = (text) => String(text || '').replace(/\s+/g, ' ').trim();



  // --- aria-describedby token helpers (preserve any author-set ids) --------

  addDescribedBy = (field, id) => {
    const tokens = this.describedByTokens(field);
    if (!tokens.includes(id)) tokens.push(id);
    field.setAttribute('aria-describedby', tokens.join(' '));
  };



  removeDescribedBy = (field, id) => {
    const tokens = this.describedByTokens(field).filter((t) => t !== id);
    if (!tokens.length) {
      field.removeAttribute('aria-describedby');
      return;
    }
    field.setAttribute('aria-describedby', tokens.join(' '));
  };



  describedByTokens = (field) =>
    (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);



  // Converts a data attribute name ("data-fv-message") to its dataset key
  // ("fvMessage"), so the configured attribute name stays the single source.
  datasetKey = (attr) =>
    attr
      .replace(/^data-/, '')
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLFormElement)) {
    reporter?.report('formValidation', 'module must be initialized on a <form> element.', el);
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  new FormValidation(el, defaults, reporter);
}
