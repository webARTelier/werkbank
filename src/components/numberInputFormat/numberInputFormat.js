/**
 * numberInputFormat.js
 * ----------------------------------------------------------------------------
 * Groups a plain text field into a readable number while the user types,
 * pastes or edits — "1.234,56" on a German page, "1,234.56" on an English
 * one. It is the direct counterpart of dateInputFormat, built the same way on
 * a different mask. It never validates and never calculates — a range, a step
 * or a minimum is formValidation's business, and rounding is nobody's here.
 *
 * The gap it closes
 * -----------------
 * <input type="number"> is the obvious answer and it is the wrong one for a
 * grouped number: it cannot group at all (the spec has no display format), it
 * disagrees with itself across engines about whether a comma is a decimal
 * point, it brings a spinner nobody asked for, and — decisively —
 * setSelectionRange is not allowed on it, so the caret cannot be preserved.
 * Without caret preservation every keystroke throws the reader back to the
 * end of the value, which is exactly what this component exists to prevent.
 * So, like dateInputFormat, it enhances only text-like fields (text / tel /
 * search) and reports any other type instead of half-working on it.
 *
 * What the platform already does
 * ------------------------------
 * - Intl.NumberFormat().formatToParts() names the group and decimal
 *   character of the page's language, so neither is assumed here (see
 *   numberSeparators). fr-FR groups with a narrow no-break space and de-CH
 *   with an apostrophe; a hard-coded "." would be wrong in both.
 * - A text field already accepts a number, keeps its own undo stack and
 *   posts its value. Nothing about that is reimplemented.
 * - inputmode="decimal" asks the touch keyboard for a keypad *with* the
 *   locale's decimal key — the reason it is preferred over "numeric", which
 *   offers digits only and leaves an iOS reader unable to type a comma.
 * - A hidden input is how a value nobody typed travels in a form, which is
 *   what a machine-readable number is (the same move fileUpload makes for a
 *   server-side handle).
 *
 * Strategy (as in dateInputFormat: derive the state from the source)
 * -----------------------------------------------------------------
 * The value is always rebuilt from one source of truth — the sign, the
 * integer digits and the fraction digits the field currently holds. Every
 * edit re-reads those three and re-renders, instead of patching the string in
 * place, so the display can never drift into a half-grouped state however the
 * edit arrived (typing, pasting, deleting, drag-drop, autofill).
 *
 * Those integer digits are the number's, not the string's: a leading zero is
 * dropped as it is read ("0007" is 7, "0012.50" is 12,50), because a grouped
 * number never carries one. Left in, "0007" would render as "0.007" on a
 * German page — a thousandth of what was typed — and a value arriving in
 * fixed width from a server is exactly where that happens. A lone "0" stays:
 * it is a number, and it is where a value on its way to "0,5" starts.
 *
 * Caret preservation
 * ------------------
 * Assigning input.value moves the caret to the end, so it is tracked as an
 * anchor of two parts: which section it sits in (integer or fraction) and how
 * many digits of that section precede it. After re-rendering, the anchor is
 * resolved back to an index. The section is what a pure digit count cannot
 * express — the fourth digit of "1.234,56" and the caret before ",56" would
 * otherwise be the same place. A caret that lands just after an integer digit
 * steps over a *group* separator so it sits ready for the next digit, but
 * never over the *decimal* separator, which would silently move the typing
 * into the fraction.
 *
 * Because the separators are re-derived, deleting one on its own would put it
 * straight back and trap the caret — so a Backspace/Delete that lands on a
 * group separator removes the adjacent *digit* instead, which is what the
 * reader meant. The decimal separator is exempt: deleting it is a real edit
 * ("12,5" -> "125"), not a fight with the formatter.
 *
 * Typing speaks the page's language, a paste is read as a value
 * ------------------------------------------------------------
 * Two different things arrive in a field and they are read differently, which
 * is deliberate:
 *
 * - **Typing.** The decimal separator is the page's decimal character and
 *   nothing else. The module owns the group character — it writes one every
 *   three digits — so that same character cannot also mean "decimal point"
 *   without the two readings colliding on the module's own output. A German
 *   numpad sends "," and an English one ".", and inputmode="decimal" gives a
 *   touch keyboard the right key, so this is what a reader actually types.
 * - **A wholesale value** (paste, drop, autofill, a server-rendered initial
 *   value, a programmatic set followed by "change"). Here the separators are
 *   part of the value, and the reading is locale-independent where it can be:
 *   with two distinct separators present the *last* one is the decimal point,
 *   so "1,234.56" and "1.234,56" both read as 1234.56 whatever the page's
 *   language is. Only a lone separator is genuinely ambiguous, and there the
 *   page's language decides: on a German page "1.234" is 1234 and "1,234" is
 *   1.234; on an English page it is the other way round. A lone page-group
 *   character is only read as a grouping where it actually groups — exactly
 *   three digits after it, and a first group of one to three digits with no
 *   leading zero in front of it. "12.5" fails the first test, "1234.560" the
 *   second (grouped, that number reads "1.234.560") and "0.999" the third
 *   (nobody writes 999 as "0.999"), so all three are decimal points. Those
 *   last two tests are what let the machine value below survive a round trip:
 *   a form coming back from the server with "1234.560" or "0.999" in the
 *   field still means 1.234,560 and 0,999, not a million and not 999. What
 *   stays genuinely ambiguous is one to three leading digits with exactly
 *   three after the separator — "1.500", "10.500", "123.456" — which read as
 *   the page's grouping; nothing can settle those from the string alone.
 *
 * The error case is only what survives both readings: a pasted string that is
 * not a number keeps its digits and drops the rest. Nothing is reported for
 * it — the reporter is for authoring mistakes, and a paste is the reader's.
 *
 * The submitted value (the one way this component could do harm)
 * -------------------------------------------------------------
 * The field posts what it shows, so an unattended form would send "1.234,56"
 * to a server expecting "1234.56". Silently rewriting a number the server
 * reads differently is the one real risk here, so the default is the same as
 * dateInputFormat's: the visible value is left alone and the project parses
 * it. Where that is not wanted, one documented opt-in switches the machine
 * value on:
 *
 *   data-numberinputformat-submit
 *
 * With it, the field's own "name" MOVES to an injected
 * <input type="hidden"> that carries "1234.56" — a "." decimal, no grouping,
 * a leading "-" where negative. The name moves rather than being duplicated,
 * because two inputs of one name would post two values. It degrades the right
 * way: until the chunk arrives the visible field still carries its name and
 * still posts, so a script that never loads costs formatting, not the field.
 * A field with no "name" cannot have one moved, which is reported.
 *
 * Two things the author owes this lane, both of them accessibility:
 *
 * - **An error message has to find the visible field.** The server only ever
 *   sees the hidden input, so a message rendered from the posted name must
 *   still be wired to the field the reader can focus — id/aria-describedby on
 *   the visible input, not on the hidden one. A message that describes a
 *   field nobody can reach fails WCAG 3.3.1 (Error Identification), and it is
 *   this lane, not the component, that makes the mistake easy to walk into.
 * - **A redisplayed value goes back into the visible field.** After a failed
 *   submit the server holds "1234.56" and has to put it back where the reader
 *   sees it; the module re-reads it as a wholesale value and re-groups it
 *   (see the round-trip note above).
 *
 * Behaviour on blur
 * -----------------
 * Blur is where the value is tidied, never while it is being typed: a
 * dangling decimal separator goes ("12," -> "12"), a fraction with no integer
 * gains its zero (",5" -> "0,5") and, where data-numberinputformat-decimals
 * is set, the fraction is padded to that many digits ("1,5" -> "1,50"). Blur
 * itself never shortens anything, and nothing anywhere here rounds. An empty
 * field stays empty — padding it would invent a value nobody gave.
 *
 * The cap does cut, and it is worth being precise about where. While typing,
 * a digit beyond it cannot be entered in the first place, so there is nothing
 * to lose. A *wholesale* value has no keystroke to refuse, so the cap applies
 * to what arrived: a pasted or redisplayed "1234.567" enters a decimals="2"
 * field as 1.234,56. That is truncation — 1.234,57 would be a calculated
 * value and this component does not calculate — so a server sending back more
 * decimals than the field accepts loses the ones beyond it. Nothing is
 * reported for it: the cap is what the author asked for.
 *
 * Negative numbers
 * ----------------
 * Allowed, always, and not behind an attribute: a sign is part of how a
 * number is written, and "this field may not go below zero" is a constraint —
 * min="0" plus formValidation — not a formatting question. A "-" anywhere in
 * the value makes it negative and is rendered leading; typing it again takes
 * it off, so the key toggles the sign.
 *
 * maxlength is not a digit limit on a formatted field
 * ---------------------------------------------------
 * The separators this module writes count towards maxlength like any other
 * character, so maxlength="5" stops the reader after "1.234" — four digits,
 * not five — and the effective limit moves every time a group separator
 * appears. The module's own writes are not subject to it at all (maxlength
 * constrains typing, not an assignment), so an authored value may well exceed
 * what the reader is then allowed to type. Cap the fraction with
 * data-numberinputformat-decimals and the magnitude with min/max plus
 * formValidation, and leave maxlength off the field.
 *
 * Pre-enhancement
 * ---------------
 * None, and none is possible: the field looks like a field before and after,
 * nothing is hidden, and no control is promised that the script has to
 * deliver. The one visible change is that a pre-filled value re-groups, which
 * can widen it — a Layer 4 case (see docs/preEnhancement.md), answered by the
 * stylesheet's tabular-nums rather than by a ready attribute. So there is no
 * data-numberinputformat-ready: there would be nothing for CSS to key off.
 *
 * Accessibility
 * -------------
 *   - The field works fully without JavaScript: a normal text input, so a
 *     number can still be typed — just without the grouping. The formatting
 *     is a pure enhancement, never a dependency.
 *   - Editing mid-value stays possible for keyboard and assistive-tech users
 *     because the caret is preserved (see above) rather than forced to the
 *     end.
 *   - inputmode="decimal" is added where the author set none, so a touch
 *     keyboard offers the keypad *and* the decimal key; an author-set value
 *     is never overridden.
 *   - IME composition is left alone until it finishes (see handleInput) —
 *     rewriting the value mid-composition would drop what is being composed.
 *   - Labelling and a format hint (WCAG 3.3.2) and, where the field collects
 *     the reader's own data, an autocomplete token (WCAG 3.3.5) are the
 *     author's responsibility and are shown in the markup snippet; this
 *     component only formats.
 *   - Where data-numberinputformat-decimals is set, the hint MUST name the
 *     limit ("at most two decimals"). The cap works like maxlength: the key
 *     beyond it does nothing and says nothing, and an instruction given up
 *     front is the only thing that keeps that from reading as a broken
 *     field. WCAG 3.3.2 again, and the one place this component's options
 *     add a duty rather than take one away.
 *   - The field must be a text-like type (text / tel / search); see the gap
 *     above. Any other type is reported and skipped.
 *
 * Two places where a screen reader says something else than what happened.
 * Both come out of decisions taken above, both are worth knowing before a
 * BITV/WCAG review, and neither has a fix inside the component: a screen
 * reader echoes the KEY, and the key is not what this module did.
 *
 *   - Backspace/Delete on a group separator removes the adjacent digit
 *     instead (see resolveGroupDelete). NVDA and JAWS announce the character
 *     that sat before the caret — the separator — while a digit is what
 *     actually goes. The value stays correct and stays readable at any time;
 *     what is briefly wrong is the echo.
 *   - Typing "-" a second time takes the sign off rather than inserting
 *     anything, and is echoed as "minus" either way.
 *
 * A live region would only add a second, competing announcement per
 * keystroke, which is why there is none: the field is not a status, and the
 * value is available to be read at any moment.
 *
 * Configuration (all optional, all per field)
 * -------------------------------------------
 *   data-numberinputformat           marks the field to format
 *   data-numberinputformat-decimals  max fraction digits, and the number
 *                                    blur pads to (default: unlimited, no
 *                                    padding). "0" means integers only
 *   data-numberinputformat-submit    move the field's name onto a hidden
 *                                    input carrying "1234.56"
 * ----------------------------------------------------------------------------
 */



// The page's language decides how a number is written, and the platform is
// asked rather than a table consulted. Both helpers are shared with
// dataTable, which reads the visible text of a cell with the same pair.
import { pageLocale } from './pageLocale.js';
import { numberSeparators } from './numberSeparators.js';



const defaults = {
  selInput: '[data-numberinputformat]',

  // Field types we may enhance. All support setSelectionRange (needed for
  // caret preservation); type="number"/"date"/"email"/… do not and are
  // skipped — see the file header for why type="number" in particular is not
  // the answer here.
  supportedTypes: ['text', 'tel', 'search'],

  // Touch-keyboard hint, applied only when the author set no inputmode.
  // "decimal" rather than "numeric": the latter offers digits only, which
  // leaves an iOS reader unable to type the decimal separator.
  inputMode: 'decimal',

  // Max fraction digits while typing, and the number blur pads to. null keeps
  // whatever the reader entered and pads nothing. Per field via
  // data-numberinputformat-decimals.
  decimals: null,
  decimalsAttr: 'data-numberinputformat-decimals',

  // Opt-in: move the field's name onto a hidden input holding the machine
  // value ("1234.56"). Absent, the visible value is what the form posts.
  submitAttr: 'data-numberinputformat-submit',

  // Edits that deliver a whole value rather than a character, so they are
  // read with the locale-independent rules (see readValue) instead of with
  // the page's separators alone. insertReplacementText covers autocorrect and
  // a speech/autofill replacement of the whole field.
  wholesaleInputTypes: [
    'insertFromPaste',
    'insertFromPasteAsQuotation',
    'insertFromDrop',
    'insertFromYank',
    'insertReplacementText',
  ],
};



// All matching number inputs inside the current boot scope. The module
// element may be the input itself (attribute on the field) or a wrapper
// (attribute on a container holding one or more number fields).
function getInputsInScope(scope, selector) {
  if (scope.matches(selector)) return [scope];
  return [...scope.querySelectorAll(selector)];
}



function isDigit(char) {
  return char >= '0' && char <= '9';
}



function onlyDigits(value) {
  return value.replace(/[^0-9]/g, '');
}



function countDigits(value) {
  return onlyDigits(value).length;
}



// A "-" anywhere makes the number negative, and an even count takes it back
// off, so the minus key toggles the sign instead of stacking up. Rendered
// leading whatever position it was typed in.
function signOf(value) {
  const count = (value.match(/-/g) || []).length;
  return count % 2 === 1 ? '-' : '';
}



// Groups the integer digits from the right, e.g. "1234567" -> "1.234.567".
// A locale without a group character (or an unusable one, see
// numberSeparators) simply gets the digits back.
function groupInteger(digits, group) {
  if (!group || digits.length < 4) return digits;

  const parts = [];
  for (let end = digits.length; end > 0; end -= 3) {
    parts.unshift(digits.slice(Math.max(0, end - 3), end));
  }

  return parts.join(group);
}



// The three-part value as the field shows it. `frac === null` means there is
// no decimal separator at all; `frac === ''` means one was typed but no digit
// has followed it yet ("12,"), which has to survive so the reader can keep
// typing.
function formatParts(parts, separators) {
  const integer = groupInteger(parts.int, separators.group);
  const fraction = parts.frac === null ? '' : separators.decimal + parts.frac;

  return parts.sign + integer + fraction;
}



function hasAnyDigit(parts) {
  return parts.int.length > 0 || (parts.frac || '').length > 0;
}



// Caps the fraction at the configured number of digits. decimals === 0 means
// integers only, so the separator goes with the digits.
function capFraction(parts, decimals) {
  if (decimals === null || parts.frac === null) return parts;
  if (decimals === 0) return { ...parts, frac: null };

  return { ...parts, frac: parts.frac.slice(0, decimals) };
}



// A grouped number never carries a leading zero, so neither does the value
// here: "0007" grouped would render "0.007" on a German page and read as a
// thousandth of what was typed. A lone "0" stays — it is a number, and it is
// where a value on its way to "0,5" starts.
function stripLeadingZeros(digits) {
  return digits.replace(/^0+(?=\d)/, '');
}



// The one place a read value becomes parts, so the two readings below cannot
// normalize differently: digits only, no leading zero on the integer, the
// fraction capped. `fracRaw === null` means there was no decimal separator at
// all, which is not the same as one with no digit after it yet ("12,").
function makeParts(sign, intRaw, fracRaw, decimals) {
  return capFraction({
    sign,
    int: stripLeadingZeros(onlyDigits(intRaw)),
    frac: fracRaw === null ? null : onlyDigits(fracRaw),
  }, decimals);
}



// A value being typed: the module owns the group character, so that character
// is noise here and the page's decimal character is the only decimal point
// (see the file header). Everything after the first one is more fraction
// digits; a second separator is dropped rather than starting a second
// fraction.
function readTyped(raw, separators, decimals) {
  const sign = signOf(raw);
  const stripped = separators.group ? raw.split(separators.group).join('') : raw;
  const at = stripped.indexOf(separators.decimal);

  if (at < 0) return makeParts(sign, stripped, null, decimals);

  return makeParts(sign, stripped.slice(0, at), stripped.slice(at + 1), decimals);
}



// Which of the separator characters in a wholesale value is the decimal
// point. Two distinct ones present -> the last is the decimal, whatever the
// page's language (so "1,234.56" and "1.234,56" both read as 1234.56). One
// character present is genuinely ambiguous, and there the page decides: its
// own decimal character is a decimal point, its group character is a grouping
// — but only where it actually groups, i.e. exactly three digits after it and
// a first group of one to three digits with no leading zero before it ("12.5"
// on a German page is 12,5, not 125). Returns -1 when the value has no
// decimal point at all.
function decimalIndexOf(value, separators) {
  const candidates = new Set(['.', ',', separators.group, separators.decimal]);
  candidates.delete('');

  const positions = [];
  for (let i = 0; i < value.length; i++) {
    if (candidates.has(value[i])) positions.push(i);
  }

  if (!positions.length) return -1;

  const distinct = new Set(positions.map((i) => value[i]));
  if (distinct.size > 1) return positions[positions.length - 1];
  if (positions.length > 1) return -1;

  const at = positions[0];
  if (value[at] === separators.decimal) return at;

  // Both halves have to look like a grouping, not just the right one. A
  // first group runs one to three digits and never carries a leading zero —
  // "1234.560" grouped is written "1.234.560" and nobody writes 999 as
  // "0.999" — so either failure says this separator was never a grouping,
  // and the value is a "." decimal: which is exactly the machine value the
  // submit lane posts, coming back from the server into the field it was
  // typed in. What stays genuinely ambiguous is one to three leading digits
  // with exactly three after the separator ("1.500", "10.500", "123.456");
  // those read as the page's grouping, and nothing can settle them from the
  // string alone.
  const first = onlyDigits(value.slice(0, at));
  const threeDigitsFollow = /^\d{3}(?!\d)/.test(value.slice(at + 1));
  const grouped = threeDigitsFollow
    && first.length > 0 && first.length <= 3
    && !first.startsWith('0');

  return grouped ? -1 : at;
}



// A wholesale value (paste, drop, autofill, the initial value): the
// separators are part of what arrived, so they are read rather than assumed —
// see decimalIndexOf. Anything that is not a digit or a separator is dropped;
// a string that is not a number at all keeps its digits, which is the most
// that can honestly be made of it.
function readValue(raw, separators, decimals) {
  const sign = signOf(raw);
  const at = decimalIndexOf(raw, separators);

  if (at < 0) return makeParts(sign, raw, null, decimals);

  return makeParts(sign, raw.slice(0, at), raw.slice(at + 1), decimals);
}



// What blur leaves behind: a dangling separator goes, a bare fraction gains
// its zero, and a configured fraction length is padded up to. An empty field
// stays empty — padding it would invent a value nobody entered.
function finishParts(parts, decimals) {
  if (!hasAnyDigit(parts)) return { sign: '', int: '', frac: null };

  const int = parts.int === '' ? '0' : parts.int;
  if (decimals === null) {
    return { ...parts, int, frac: parts.frac ? parts.frac : null };
  }

  if (decimals === 0) return { ...parts, int, frac: null };
  return { ...parts, int, frac: (parts.frac || '').padEnd(decimals, '0') };
}



// The machine value the hidden input carries: a "." decimal, no grouping, a
// leading "-" where negative. Empty for an empty field, so an untouched
// optional field posts nothing rather than a zero.
function machineValue(parts) {
  if (!hasAnyDigit(parts)) return '';

  const int = parts.int === '' ? '0' : parts.int;
  const frac = parts.frac ? `.${parts.frac}` : '';
  return parts.sign + int + frac;
}



// Where the caret sits, as the section it is in plus how many digits of that
// section precede it. The section is what a plain digit count cannot say —
// see the file header. `at` is where the decimal point is in `raw`, which the
// caller knows and this cannot: typing puts it at the page's decimal
// character, a wholesale value has it read out of the value (decimalIndexOf).
function caretAnchor(raw, caret, at) {
  if (at >= 0 && caret > at) {
    return { section: 'frac', digits: countDigits(raw.slice(at + 1, caret)) };
  }

  return { section: 'int', digits: countDigits(raw.slice(0, caret)) };
}



// The anchor resolved back to an index in the re-rendered value.
function caretIndex(formatted, anchor, separators) {
  const at = formatted.indexOf(separators.decimal);

  if (anchor.section === 'frac') {
    if (at < 0) return formatted.length;
    return Math.min(at + 1 + anchor.digits, formatted.length);
  }

  const end = at < 0 ? formatted.length : at;

  // No digit in front of the caret: it belongs after the sign, not before it,
  // or the next character typed would land on the wrong side of the minus.
  if (anchor.digits <= 0) return formatted.startsWith('-') ? Math.min(1, end) : 0;

  let seen = 0;
  for (let i = 0; i < end; i++) {
    if (!isDigit(formatted[i])) continue;

    seen++;
    if (seen !== anchor.digits) continue;

    // Step over a group separator so the caret sits at the start of the next
    // group, ready for the next digit — never over the decimal separator,
    // which would move the typing into the fraction.
    let index = i + 1;
    if (index < end && formatted[index] === separators.group) index++;
    return index;
  }

  return end;
}



// The effective per-field options: the module defaults, with the fraction
// length overridden where the field asks for one. An unusable value is
// reported and ignored.
function resolveConfig(input, base, reporter) {
  const raw = input.getAttribute(base.decimalsAttr);
  if (raw === null || raw.trim() === '') return base;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== raw.trim()) {
    reporter?.report(
      'numberInputFormat',
      `ignored invalid ${base.decimalsAttr}="${raw}"; expected a whole ` +
      'number of fraction digits, e.g. "2". Falling back to unlimited.',
      input
    );
    return base;
  }

  return { ...base, decimals: parsed };
}



class NumberInputFormat {

  constructor(input, config, reporter) {
    this.input = input;
    this.config = config;
    this.reporter = reporter;

    // A grouped number only makes sense on a text-like field, which also
    // guarantees setSelectionRange is allowed (see file header).
    if (!this.config.supportedTypes.includes(this.input.type)) {
      this.handleUnsupportedType();
      return;
    }

    this.separators = numberSeparators(pageLocale());

    // The last value written; it tells "a separator was deleted" (digit count
    // unchanged) from "a digit was deleted" (digit count dropped).
    this.previousValue = '';

    this.enhance();
  }



  enhance = () => {

    // Touch-keyboard hint — never clobber an author-set inputmode.
    // Remembered, so destroy() takes back only ours.
    this.appliedInputMode = !this.input.hasAttribute('inputmode');
    if (this.appliedInputMode) {
      this.input.setAttribute('inputmode', this.config.inputMode);
    }

    this.setupMachineValue();

    // Format any pre-filled value (server-rendered, or restored on a back
    // navigation) up front, finished as if it had just been left.
    this.normalize(true);

    this.input.addEventListener('input', this.handleInput);

    // Some autofill / password-manager paths set the value and fire only
    // "change" (no "input"), so a wholesale read there covers them too.
    this.input.addEventListener('change', this.handleChange);
    this.input.addEventListener('blur', this.handleBlur);

    // A form reset puts the authored default back without an input event. In
    // the machine-value lane that would leave the hidden input holding the
    // number the reader had typed — a stale value posted under the field's
    // own name — so the reset is followed back into a re-read. The listener
    // sits on the form, i.e. outside this module's element, which is what
    // destroy() is for.
    this.form = this.input.form;
    this.form?.addEventListener('reset', this.handleReset);
  };



  // The opt-in machine value: the field's name MOVES to a hidden sibling
  // carrying "1234.56". Two inputs of one name would post two values, hence
  // the move; and until this runs the visible field still has its name, so a
  // chunk that never arrives costs the grouping, not the field.
  setupMachineValue = () => {
    if (!this.input.hasAttribute(this.config.submitAttr)) return;

    const name = this.input.getAttribute('name');
    if (!name) {
      this.reporter?.report(
        'numberInputFormat',
        `${this.config.submitAttr} needs a name on the field to move onto ` +
        'the hidden input. The field was formatted, but no machine value is ' +
        'posted.',
        this.input
      );
      return;
    }

    this.machineInput = document.createElement('input');
    this.machineInput.type = 'hidden';
    this.machineInput.name = name;
    this.input.after(this.machineInput);

    this.movedName = name;
    this.input.removeAttribute('name');
  };



  // Writes the value and keeps the machine value in step. The caret is the
  // caller's business: an edit has one worth restoring, a normalize does not.
  write = (parts, caret) => {
    const formatted = formatParts(parts, this.separators);

    if (formatted !== this.input.value) this.input.value = formatted;
    this.previousValue = formatted;

    if (this.machineInput) this.machineInput.value = machineValue(parts);
    if (caret === undefined) return;

    this.input.setSelectionRange(caret, caret);
  };



  // Re-reads the whole value with the locale-independent rules and re-renders
  // it. For the initial value, a change event and a form reset — none of
  // which is live typing, and none of which has a caret worth keeping.
  normalize = (finish) => {
    const parts = readValue(this.input.value, this.separators, this.config.decimals);
    this.write(finish ? finishParts(parts, this.config.decimals) : parts);
  };



  handleInput = (event) => {

    // Let IME composition finish before rewriting the value; the next input
    // event (and blur) tidies up afterwards.
    if (event.isComposing) return;

    const raw = this.input.value;
    const caret = this.input.selectionStart ?? raw.length;

    // A pasted or dropped value is a value, not a character stream: it is
    // read with the separators it brought (decimalIndexOf) rather than with
    // the page's alone. The caret still follows, so it lands just after what
    // was pasted instead of at the end of the field — the anchor works here
    // too, once it is told where this value's decimal point actually sits.
    if (this.config.wholesaleInputTypes.includes(event.inputType)) {
      const parts = readValue(raw, this.separators, this.config.decimals);
      const anchor = caretAnchor(raw, caret, decimalIndexOf(raw, this.separators));
      const formatted = formatParts(parts, this.separators);

      this.write(parts, caretIndex(formatted, anchor, this.separators));
      return;
    }

    const typed = readTyped(raw, this.separators, this.config.decimals);
    const anchor = caretAnchor(raw, caret, raw.indexOf(this.separators.decimal));
    const resolved = this.resolveGroupDelete(event, typed, anchor);

    const formatted = formatParts(resolved.parts, this.separators);
    this.write(
      resolved.parts,
      caretIndex(formatted, resolved.anchor, this.separators)
    );
  };



  // A Backspace/Delete that landed on a group separator leaves the digit
  // count unchanged (only the "." went). Re-rendering would put the separator
  // straight back and trap the caret, so the adjacent digit goes instead —
  // the intuitive result. Three edits look the same from the digit count and
  // are none of this component's business: a deleted decimal separator
  // ("12,5" -> "125"), a deleted sign, and anything in the fraction, which
  // has no separators to fight over.
  resolveGroupDelete = (event, parts, anchor) => {
    const digits = parts.int.length + (parts.frac || '').length;
    if (digits !== countDigits(this.previousValue)) return { parts, anchor };
    if (anchor.section !== 'int') return { parts, anchor };

    const hadDecimal = this.previousValue.includes(this.separators.decimal);
    if (hadDecimal !== (parts.frac !== null)) return { parts, anchor };
    if (this.previousValue.startsWith('-') !== (parts.sign === '-')) {
      return { parts, anchor };
    }

    if (event.inputType === 'deleteContentBackward' && anchor.digits > 0) {
      return {
        parts: {
          ...parts,
          int: parts.int.slice(0, anchor.digits - 1) + parts.int.slice(anchor.digits),
        },
        anchor: { ...anchor, digits: anchor.digits - 1 },
      };
    }

    if (event.inputType === 'deleteContentForward' && anchor.digits < parts.int.length) {
      return {
        parts: {
          ...parts,
          int: parts.int.slice(0, anchor.digits) + parts.int.slice(anchor.digits + 1),
        },
        anchor,
      };
    }

    return { parts, anchor };
  };



  handleChange = () => {
    this.normalize(true);
  };



  handleBlur = () => {
    this.normalize(true);
  };



  // The default value is restored after the reset event, so the re-read waits
  // a tick for it.
  handleReset = () => {
    setTimeout(() => this.normalize(true), 0);
  };



  handleUnsupportedType = () => {
    this.reporter?.report(
      'numberInputFormat',
      `field type="${this.input.type}" is not supported; use type="text" ` +
      '(or "tel" / "search"). type="number" cannot group, cannot place a ' +
      'caret and is not the answer here. Field was skipped.',
      this.input
    );
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly —
  // see destroyModulesInScope() in boot.js. It matters more here than in
  // dateInputFormat: besides the listeners on the field, this module may hold
  // a listener on the surrounding <form> and a hidden input carrying the
  // field's own name, and both would outlive a re-init.
  //
  // The visible value stays as it is: it is what the visitor typed, the
  // formatting is idempotent, and a re-init reproduces the same grouping —
  // turning it back into a bare number would be the module editing user
  // input. The name, however, goes back on the field, so the markup posts
  // again exactly as it was authored. Guarded because the constructor bails
  // on an unsupported field type before enhance() runs.
  destroy = () => {
    this.input.removeEventListener('input', this.handleInput);
    this.input.removeEventListener('change', this.handleChange);
    this.input.removeEventListener('blur', this.handleBlur);
    this.form?.removeEventListener('reset', this.handleReset);

    if (this.movedName) this.input.setAttribute('name', this.movedName);
    this.machineInput?.remove();
    this.machineInput = null;

    if (this.appliedInputMode) this.input.removeAttribute('inputmode');
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'numberInputFormat',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  const inputs = getInputsInScope(el, defaults.selInput);
  if (!inputs.length) {
    reporter?.report(
      'numberInputFormat',
      `no ${defaults.selInput} field found in the module scope.`, el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  // Each field resolves its own config, so a per-field fraction length (e.g.
  // data-numberinputformat-decimals="2") is honored independently.
  const instances = inputs.map((input) => new NumberInputFormat(
    input, resolveConfig(input, defaults, reporter), reporter
  ));

  // The module element may be a wrapper holding several fields, so the single
  // cleanup boot.js stores has to tear down all of them.
  return () => instances.forEach((instance) => instance.destroy());
}
