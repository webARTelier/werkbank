/**
 * inputCharCount.js
 * --------------------------------------------------------------------------
 * Progressive-enhancement controller that shows a live character counter
 * for a text field, and — when the field declares a `maxlength` — how much
 * of that budget is used or left. It is a pure enhancement layered on top
 * of a plain <input>/<textarea>: without JavaScript the field still works
 * and, if it has a `maxlength`, the browser still enforces the limit.
 *
 * Strategy (like the other components: derive state from the native source)
 * ------------------------------------------------------------------------
 * The single source of truth is the field itself: the current length is
 * always read from `field.value.length`, and the limit from the native
 * `maxlength` attribute. We keep no parallel model of "how many characters
 * are there" — every render recomputes from the live element, so the
 * counter cannot drift out of sync (paste, undo, autofill, cut all just
 * fire `input` and we re-read). Measuring length the same way the platform
 * does (UTF-16 code units) keeps the counter consistent with how
 * `maxlength` and the `tooLong` constraint themselves count.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * A `maxlength` attribute already prevents typing (and truncates a paste)
 * beyond the limit, entirely without script — so the field is never left
 * unguarded. What the platform does NOT offer is a *visible* count, or an
 * accessible announcement of it. That gap is all this script fills; it adds
 * no length rule of its own.
 *
 * What this script adds
 * ---------------------
 * 1. A visible counter injected after the field, updated instantly on every
 *    `input`. It is `aria-hidden` so it is purely a sighted-user affordance
 *    and does not compete with the announcement channel below.
 * 2. An accessible announcement: a separate visually-hidden status region
 *    (`role="status"`, polite) tied to the field via `aria-describedby`, so
 *    the current count is read when the field takes focus and — debounced,
 *    once typing pauses — announced as it changes. Debouncing is what keeps
 *    a screen reader from reciting the count on every single keystroke.
 * 3. Limit awareness: when the field has a `maxlength`, the counter shows
 *    "used / max" (or, in countdown mode, the remaining budget), and the
 *    field gets an `is-atLimit` state class the moment the budget is spent,
 *    plus a spoken "limit reached" note. The class is only a styling hook —
 *    being at the limit is a valid state, so no `aria-invalid` is set.
 * 4. Localized text (de/en) chosen from <html lang>, with token
 *    interpolation ({count} {max} {remaining}); a field may override the
 *    visible wording with `data-icc-text`.
 *
 * Accessibility
 * -------------
 * - The visible number is `aria-hidden`; the announcement goes through one
 *   quiet, polite status region (never `assertive`), debounced so live
 *   typing is not a burst of interruptions.
 * - The status region is linked with `aria-describedby` (author-set ids are
 *   preserved), so on focus the field is described by its current count.
 * - `maxlength` stays the real limit (enforced by the platform even without
 *   this script); `is-atLimit` is presentational only.
 *
 * Configuration (all optional; put `data-js-module="inputCharCount"` on the
 * <input>/<textarea> itself)
 * --------------------------------------------------------------------------
 * - `maxlength` (native)        enables the "used / max" display, the
 *                               countdown mode and the `is-atLimit` state.
 * - `data-icc-countdown`        show the remaining budget instead of the
 *                               used count (needs `maxlength`).
 * - `data-icc-text="…"`         override the VISIBLE template for this field
 *                               (tokens: {count} {max} {remaining}). The
 *                               spoken text keeps its natural-language
 *                               locale wording.
 *
 * Styling contract
 * ----------------
 * Behaviour-first: the component ships only the one style it must own — the
 * visually-hidden rule for its injected status region (an a11y necessity,
 * not a design choice). Everything visible is a hook the consuming project
 * styles and the JS only ever writes, never reads back:
 *   - `.icc-counter` / `[data-icc-counter]`  the visible counter element
 *   - `.is-atLimit` on the field             set while the budget is spent
 * See `inputCharCount.scss`.
 * --------------------------------------------------------------------------
 */



import { debounceThenExecute } from './debounce.js';
import { resolveLocale } from './resolveLocale.js';



const defaults = {

  // Field opt-ins (behavioural data attributes, not style classes, so the
  // JS stays decoupled from the CSS).
  countdownAttr: 'data-icc-countdown', // show remaining instead of used
  textAttr: 'data-icc-text',           // per-field visible template override

  // Injected elements. `counterClass` + `counterAttr` are styling hooks the
  // project owns; `statusClass` is the visually-hidden status region whose
  // one shipped style lives in inputCharCount.scss.
  counterClass: 'icc-counter',
  counterAttr: 'data-icc-counter',
  statusClass: 'icc-srStatus',
  statusAttr: 'data-icc-status',

  // State hook (styling only; the JS owns writing it, never reads it back).
  atLimitClass: 'is-atLimit',

  // How long typing must pause before the polite status region is updated,
  // so a screen reader announces the count once the user settles rather than
  // on every keystroke.
  announceDelay: 500,

  // <html lang> matching none of these falls back to this locale.
  fallbackLocale: 'en',
};



// Localized text, keyed by locale then by a message id. `*Visible` templates
// feed the sighted counter; `*Sr` templates feed the spoken status region and
// are deliberately natural language ("3 of 200 characters", not "3 / 200",
// which a screen reader would read as "3 slash 200"). {placeholders} are
// interpolated from the live field by formatLabel.
const labels = {

  de: {
    plainVisible: '{count} Zeichen',
    plainSr: '{count} Zeichen eingegeben',
    limitVisible: '{count} / {max}',
    limitSr: '{count} von {max} Zeichen',
    countdownVisible: 'noch {remaining}',
    countdownSr: 'noch {remaining} von {max} Zeichen übrig',
    atLimitSr: 'Maximale Länge erreicht: {max} von {max} Zeichen.',
  },

  en: {
    plainVisible: '{count} characters',
    plainSr: '{count} characters entered',
    limitVisible: '{count} / {max}',
    limitSr: '{count} of {max} characters',
    countdownVisible: '{remaining} left',
    countdownSr: '{remaining} of {max} characters remaining',
    atLimitSr: 'Character limit reached: {max} of {max} characters.',
  },
};



// Interpolates {placeholder} tokens in a template from a plain values object.
// Unknown placeholders are left as-is so a typo stays visible, not silent.
function formatLabel(template, tokens) {
  if (!template) return '';
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    key in tokens ? String(tokens[key]) : match
  );
}



// Distinguishes multiple counted fields on one page so their generated
// status-region ids never collide (a field without its own id still gets a
// unique one).
let instanceCount = 0;



class InputCharCount {

  constructor(field, config, reporter) {
    this.field = field;
    this.config = config;
    this.reporter = reporter;

    const locale = resolveLocale(Object.keys(labels), config.fallbackLocale);
    this.labels = labels[locale] || labels[config.fallbackLocale];

    // The native limit is the source of truth. A missing/zero maxlength means
    // "no limit" — plain count only, and countdown has nothing to count down.
    const max = parseInt(field.getAttribute('maxlength') || '', 10);
    this.max = Number.isFinite(max) && max > 0 ? max : 0;

    this.countdown = field.hasAttribute(config.countdownAttr);
    if (this.countdown && !this.max) {
      this.reporter?.report(
        'inputCharCount',
        `${config.countdownAttr} needs a maxlength to count down; showing the plain count instead.`,
        field
      );
      this.countdown = false;
    }

    // A per-field override for the visible wording (the spoken text keeps
    // its locale wording for clarity).
    this.textOverride = field.getAttribute(config.textAttr) || '';

    // Announce debounced: the visible counter updates instantly, but the
    // polite status region only settles after typing pauses (see renderSr).
    this.announce = debounceThenExecute(this.renderSr, config.announceDelay);

    this.setup();
  }



  setup = () => {
    this.buildCounter();
    this.buildStatus();

    // First paint is immediate for BOTH channels: the visible number so it is
    // never blank, and the status text so a field focused before typing is
    // already described by its current count (aria-describedby, set here).
    this.renderVisible();
    this.renderSr();

    this.field.addEventListener('input', this.handleInput);
  };



  // The visible counter, right after the field. aria-hidden so it is a purely
  // sighted affordance and does not double up with the spoken status region.
  buildCounter = () => {
    this.counter = document.createElement('div');
    this.counter.className = this.config.counterClass;
    this.counter.setAttribute(this.config.counterAttr, '');
    this.counter.setAttribute('aria-hidden', 'true');
    this.field.after(this.counter);
  };



  // The visually-hidden, polite status region. role="status" makes it a live
  // region announced without stealing focus; a stable id lets us describe the
  // field with it (addDescribedBy) so the count is read on focus too.
  buildStatus = () => {
    this.statusId = `iccStatus${++instanceCount}`;

    this.status = document.createElement('div');
    this.status.className = this.config.statusClass;
    this.status.setAttribute(this.config.statusAttr, '');
    this.status.id = this.statusId;
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');

    this.counter.after(this.status);
    this.addDescribedBy(this.field, this.statusId);
  };



  handleInput = () => {

    // Visible feedback is instant; the spoken announcement is debounced so a
    // screen reader is not interrupted on every keystroke.
    this.renderVisible();
    this.announce();
  };



  // Live values, recomputed from the field on every render so the counter can
  // never drift from the actual value.
  tokens = () => {
    const count = this.field.value.length;
    return {
      count,
      max: this.max,
      remaining: this.max ? Math.max(0, this.max - count) : 0,
    };
  };



  // Writes the visible counter and toggles at-limit. Both writes are
  // idempotent (textContent assignment, classList.toggle with a force flag).
  renderVisible = () => {
    const tokens = this.tokens();

    const template = this.textOverride || this.visibleTemplate();
    this.counter.textContent = formatLabel(template, tokens);

    // At-limit is meaningful only when there is a limit. Toggle it on the
    // field so the project can style the field and/or its sibling counter.
    if (this.max) {
      this.field.classList.toggle(
        this.config.atLimitClass, tokens.count >= this.max
      );
    }
  };



  // Writes the spoken status text. At the limit we say so explicitly, so a
  // screen-reader user learns the field will accept no more input.
  renderSr = () => {
    const tokens = this.tokens();

    if (this.max && tokens.count >= this.max) {
      this.status.textContent = formatLabel(this.labels.atLimitSr, tokens);
      return;
    }

    this.status.textContent = formatLabel(this.srTemplate(), tokens);
  };



  visibleTemplate = () => {
    if (!this.max) return this.labels.plainVisible;
    return this.countdown ? this.labels.countdownVisible : this.labels.limitVisible;
  };



  srTemplate = () => {
    if (!this.max) return this.labels.plainSr;
    return this.countdown ? this.labels.countdownSr : this.labels.limitSr;
  };



  // --- aria-describedby token helper (preserves any author-set ids) --------

  addDescribedBy = (field, id) => {
    const tokens = (field.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(Boolean);

    if (!tokens.includes(id)) tokens.push(id);
    field.setAttribute('aria-describedby', tokens.join(' '));
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (
    !(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)
  ) {
    reporter?.report(
      'inputCharCount',
      'module must be initialized on an <input> or <textarea>.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  new InputCharCount(el, defaults, reporter);
}
