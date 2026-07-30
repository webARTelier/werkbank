/**
 * dateInputFormat.js
 * ----------------------------------------------------------------------------
 * Progressive-enhancement script that auto-formats a plain text field into a
 * grouped date mask (DD.MM.YYYY by default) while the user types, pastes or
 * edits. It never validates the date — impossible values like 99.99.9999 are
 * left untouched — it only inserts the separators, so it pairs naturally with
 * the formValidation component for range/plausibility checks.
 *
 * Strategy (mirrors the other components: derive the state from the source)
 * ------------------------------------------------------------------------
 * The value is always rebuilt from a single source of truth — the digits the
 * field currently holds. On every input we strip everything down to digits,
 * cap them at the mask length and re-group them, instead of patching the
 * string in place. Like the countdown recomputes from the target date and the
 * accordion reads details.open live, the displayed value can never drift into
 * a half-formatted state, no matter how the edit arrived (typing, pasting,
 * deleting, drag-drop).
 *
 * Caret preservation
 * ------------------
 * Naively assigning input.value moves the caret to the end, which makes
 * editing in the middle of the field impossible (every keystroke throws you
 * back to the end). We therefore track the caret in *digit space*: we count
 * how many digits sit before the caret, reformat, then place the caret just
 * past that many digits in the new string. Because separators are re-derived,
 * deleting one on its own would simply re-insert it and trap the caret — so a
 * Backspace/Delete that lands on a separator removes the adjacent *digit*
 * instead, which is what the user meant.
 *
 * Accessibility
 * -------------
 *   - The field works fully without JavaScript: it is a normal text input, so
 *     a date can still be typed (just without the auto-inserted dots). The
 *     formatting is a pure enhancement, never a dependency.
 *   - Editing mid-value stays possible for keyboard and assistive-tech users
 *     because the caret is preserved (see above) rather than forced to the
 *     end.
 *   - When the author has not set one, we add inputmode="numeric" so touch
 *     devices offer the numeric keypad. We never override an author-set value.
 *   - When the field carries an autocomplete token (WCAG 3.3.5, e.g.
 *     autocomplete="bday"), browsers fill it in ISO order (YYYY-MM-DD). We
 *     detect such a wholesale value and reorder it into the mask before
 *     grouping, so the autofilled date is not garbled (see
 *     isoDigitsInMaskOrder / the `order` config). Setting the token itself
 *     stays the author's responsibility.
 *   - Labelling and a format hint (WCAG 3.3.2 — e.g. placeholder="DD.MM.YYYY"
 *     plus a visible/aria-describedby hint) are the author's responsibility
 *     and are shown in the markup snippet; the component only handles
 *     formatting.
 *   - The field must be a text-like type (text / tel / search). On
 *     type="date", "number", etc. a DD.MM.YYYY mask is meaningless (and caret
 *     control is not even allowed), so the module reports and skips that
 *     field.
 *
 * Per-field mask
 * --------------
 * The mask defaults to DD.MM.YYYY but can be overridden per field by giving the
 * data attribute a pattern value, e.g. data-dateinputformat="MM/DD/YYYY". The
 * pattern is parsed into groups, separator and segment order (see
 * parseMaskPattern), so different locales can coexist on one page without
 * touching the source. An empty attribute keeps the module defaults; an invalid
 * pattern is reported and also falls back to the defaults.
 * ----------------------------------------------------------------------------
 */



const defaults = {
  selInput: '[data-dateinputformat]',

  // Field types we may enhance. All support setSelectionRange (needed for caret
  // preservation); type="date"/"number"/"email"/… do not and are skipped.
  supportedTypes: ['text', 'tel', 'search'],

  // Touch-keyboard hint, applied only when the author has not set inputmode.
  inputMode: 'numeric',

  // Default mask shape. Group sizes are joined by `separator`; the sum of the
  // groups is the maximum number of digits kept. This is the fallback — a field
  // may override the whole mask inline via data-dateinputformat="MM/DD/YYYY"
  // (see parseMaskPattern), so different locales can coexist on one page.
  groups: [2, 2, 4], // DD . MM . YYYY
  separator: '.',

  // Semantic order of the mask segments, aligned with `groups`. Only used to
  // reorder a wholesale ISO date (YYYY-MM-DD, as browsers autofill an
  // autocomplete="bday" field) into this order before grouping — see
  // isoDigitsInMaskOrder. Keys: "D" day, "M" month, "Y" year. For MM/DD/YYYY
  // use ["M", "D", "Y"]; set to null to disable ISO reordering entirely.
  // A per-field pattern (above) derives this order from the pattern itself.
  order: ['D', 'M', 'Y'], // DD . MM . YYYY
};



// returns all matching date inputs inside the current boot scope. The module
// element may either be the input itself (attribute on the field) or a wrapper
// (attribute on a container that holds one or more date fields).
function getInputsInScope(scope, selector) {
  if (scope.matches(selector)) return [scope];
  return [...scope.querySelectorAll(selector)];
}



function isDigit(char) {
  return char >= '0' && char <= '9';
}



function onlyDigits(value) {
  return value.replace(/\D/g, '');
}



function countDigits(value) {
  return onlyDigits(value).length;
}



// groups a run of digits into the mask, e.g. "12032026" -> "12.03.2026".
// Trailing partial groups are kept ("1203" -> "12.03"), so the value formats
// progressively as the user types.
function groupDigits(digits, groups, separator) {
  const parts = [];
  let offset = 0;

  for (const size of groups) {
    if (offset >= digits.length) break;
    parts.push(digits.slice(offset, offset + size));
    offset += size;
  }

  return parts.join(separator);
}



// Parses a human mask pattern like "DD.MM.YYYY" or "MM/DD/YYYY" into the config
// the formatter uses: `groups` (segment lengths), `separator` (the char between
// them) and `order` (the semantic segments). Each segment must be a run of a
// single D/M/Y letter ("DD", "YYYY"); the first non-letter run is the
// separator. Returns null for an empty or malformed pattern, so the caller
// falls back to the module defaults.
function parseMaskPattern(pattern) {
  if (typeof pattern !== 'string' || pattern.trim() === '') return null;

  const trimmed = pattern.trim();
  const segments = trimmed.match(/[A-Za-z]+/g) || [];
  const separators = trimmed.match(/[^A-Za-z]+/g) || [];
  if (!segments.length) return null;

  const groups = [];
  const order = [];

  for (const segment of segments) {
    const key = segment[0].toUpperCase();
    // Only D/M/Y segments, each a uniform run of that one letter.
    if (!'DMY'.includes(key)) return null;
    if (![...segment].every((char) => char.toUpperCase() === key)) return null;

    groups.push(segment.length);
    order.push(key);
  }

  return {
    groups,
    separator: separators[0] ? separators[0][0] : '',
    order,
  };
}



// Builds the effective config for one field: the module defaults, with the mask
// overridden when the field carries a pattern in data-dateinputformat (e.g.
// "MM/DD/YYYY"). An invalid pattern is reported and ignored.
function resolveConfig(input, defaults, reporter) {
  const pattern = input.dataset.dateinputformat;
  if (!pattern) return defaults;

  const parsed = parseMaskPattern(pattern);
  if (!parsed) {
    reporter?.report(
      'dateInputFormat',
      `ignored invalid mask pattern "${pattern}"; expected a pattern of D/M/Y ` +
      'runs and a separator, e.g. "DD.MM.YYYY". Falling back to the default mask.',
      input
    );
    return defaults;
  }

  return { ...defaults, ...parsed };
}



// If `value` is a complete ISO date (YYYY-MM-DD), returns its digits reordered
// into the mask's segment order (`order`, e.g. ["D","M","Y"] for DD.MM.YYYY);
// otherwise returns null. Browsers autofill an autocomplete="bday" field in ISO
// order, which — grouped as raw digits — would garble (1990-05-15 -> 19.90.0515),
// so we reorder before grouping. Segments the order does not name are dropped,
// and surrounding whitespace (some autofills add it) is tolerated.
function isoDigitsInMaskOrder(value, order) {
  const match = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(value);
  if (!match) return null;

  const segments = { Y: match[1], M: match[2], D: match[3] };
  return order.map((key) => segments[key] ?? '').join('');
}



// returns the caret index in `formatted` positioned just after the nth digit.
// If the character that follows is a separator, the caret steps over it so it
// sits at the start of the next group, ready for the next digit.
function caretAfterNthDigit(formatted, digitCount) {
  if (digitCount <= 0) return 0;

  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (!isDigit(formatted[i])) continue;

    seen++;
    if (seen === digitCount) {
      let pos = i + 1;
      if (pos < formatted.length && !isDigit(formatted[pos])) pos++;
      return pos;
    }
  }

  return formatted.length;
}



class DateInputFormat {

  constructor(input, config, reporter) {
    this.input = input;
    this.config = config;
    this.reporter = reporter;

    // A DD.MM.YYYY mask only makes sense on a text-like field, which also
    // guarantees setSelectionRange is allowed (see file header).
    if (!this.config.supportedTypes.includes(this.input.type)) {
      this.handleUnsupportedType();
      return;
    }

    this.maxDigits = this.config.groups.reduce((sum, size) => sum + size, 0);

    // last value we wrote; used to tell "a separator was deleted" (digit count
    // unchanged) from "a digit was deleted" (digit count dropped).
    this.previousValue = '';

    this.enhance();
  }



  enhance = () => {

    // Touch-keyboard hint — never clobber an author-set inputmode.
    if (!this.input.hasAttribute('inputmode')) {
      this.input.setAttribute('inputmode', this.config.inputMode);
    }

    // Format any pre-filled value (e.g. server-rendered) up front.
    this.normalize();

    this.input.addEventListener('input', this.handleInput);
    // Some autofill / password-manager paths set the value and fire only
    // "change" (no "input"), so we normalize there too — this covers the
    // ISO autocomplete="bday" fill even when no input event arrives.
    this.input.addEventListener('change', this.handleChange);
    this.input.addEventListener('blur', this.handleBlur);
  };



  // Re-groups the current value from its digits without touching the caret.
  // Used for the initial value, on blur and for wholesale ISO values, where no
  // live caret matters.
  normalize = () => {
    const digits = this.digitsFrom(this.input.value);
    this.input.value = groupDigits(digits, this.config.groups, this.config.separator);
    this.previousValue = this.input.value;
  };



  // Extracts the mask digits from a raw value: a complete ISO date is reordered
  // into the mask's segment order first (see isoDigitsInMaskOrder), any other
  // value is just stripped to its digits. Capped at the mask length.
  digitsFrom = (value) => {
    const iso = this.config.order && isoDigitsInMaskOrder(value, this.config.order);
    return onlyDigits(iso || value).slice(0, this.maxDigits);
  };



  handleInput = (event) => {

    // Let IME composition finish before we rewrite the value; normalize() on
    // blur (and the next input event) tidies up afterwards.
    if (event.isComposing) return;

    // A wholesale ISO value (browser autofill of autocomplete="bday" arrives as
    // YYYY-MM-DD) is not live typing: reorder and reformat it via normalize(),
    // leaving the caret at the end, rather than running the digit-space caret
    // math below on ISO-ordered digits.
    if (this.config.order && isoDigitsInMaskOrder(this.input.value, this.config.order)) {
      this.normalize();
      return;
    }

    const input = this.input;
    const rawValue = input.value;
    const caret = input.selectionStart ?? rawValue.length;

    const typedDigits = onlyDigits(rawValue).slice(0, this.maxDigits);
    const typedBeforeCaret = Math.min(countDigits(rawValue.slice(0, caret)), typedDigits.length);

    const { digits, digitsBeforeCaret } =
      this.resolveSeparatorDelete(event, typedDigits, typedBeforeCaret);

    const formatted = groupDigits(digits, this.config.groups, this.config.separator);
    input.value = formatted;
    this.previousValue = formatted;

    const newCaret = caretAfterNthDigit(formatted, digitsBeforeCaret);
    input.setSelectionRange(newCaret, newCaret);
  };



  // A Backspace/Delete that landed on a separator leaves the digit count
  // unchanged (only the "." was removed). Re-grouping would put the separator
  // straight back and trap the caret, so we drop the adjacent digit instead —
  // the intuitive result. Every other edit is returned unchanged.
  resolveSeparatorDelete = (event, digits, digitsBeforeCaret) => {
    if (digits.length !== countDigits(this.previousValue)) {
      return { digits, digitsBeforeCaret };
    }

    if (event.inputType === 'deleteContentBackward' && digitsBeforeCaret > 0) {
      return {
        digits: digits.slice(0, digitsBeforeCaret - 1) + digits.slice(digitsBeforeCaret),
        digitsBeforeCaret: digitsBeforeCaret - 1,
      };
    }

    if (event.inputType === 'deleteContentForward' && digitsBeforeCaret < digits.length) {
      return {
        digits: digits.slice(0, digitsBeforeCaret) + digits.slice(digitsBeforeCaret + 1),
        digitsBeforeCaret,
      };
    }

    return { digits, digitsBeforeCaret };
  };



  handleChange = () => {
    this.normalize();
  };



  handleBlur = () => {
    this.normalize();
  };



  handleUnsupportedType = () => {
    this.reporter?.report(
      'dateInputFormat',
      `field type="${this.input.type}" is not supported; use type="text" ` +
      '(or "tel" / "search"). Field was skipped.',
      this.input
    );
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'dateInputFormat',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  const inputs = getInputsInScope(el, defaults.selInput);
  if (!inputs.length) {
    reporter?.report(
      'dateInputFormat',
      `no ${defaults.selInput} field found in the module scope.`, el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  // Each field resolves its own config, so a per-field mask pattern (e.g.
  // data-dateinputformat="MM/DD/YYYY") is honored independently.
  inputs.forEach((input) => {
    new DateInputFormat(input, resolveConfig(input, defaults, reporter), reporter);
  });
}
