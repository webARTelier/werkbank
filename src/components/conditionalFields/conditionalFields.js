/**
 * conditionalFields.js
 * ----------------------------------------------------------------------------
 * Shows a group of form fields only while another field asks for it: the
 * delivery address once "deliver somewhere else" is ticked, the phone number
 * once "call me" is picked, the "other, please specify" box once "other" is
 * chosen. It is the snippet every CMS form ends up with, written by hand
 * each time — and nearly always written as `display: none`, which is the
 * half that looks right and is not.
 *
 * The gap a hand-written version leaves
 * -------------------------------------
 * A group that is only hidden is still part of the form. A `required` field
 * in it blocks the submit, and the browser's bubble — or formValidation's
 * summary — points at a field nobody can see. Its values are still sent, so
 * the server receives an address for an order that is going to the billing
 * address. Both faults are invisible in testing, because a tester fills the
 * form in the order it is shown.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * - `disabled` on a <fieldset> disables every control inside it, nested
 *   fieldsets included. A disabled control is not submitted, and its
 *   `willValidate` is false, so neither the browser nor formValidation
 *   checks it — the required field in a closed group simply stops counting.
 * - A disabled control KEEPS its value. Somebody who ticks the box, types an
 *   address, unticks it and ticks it again finds the address where they left
 *   it, and the server still only receives what was on screen.
 * - `hidden` takes the group out of the layout AND out of the accessibility
 *   tree, which is what "not relevant right now" means.
 * - form.elements lists every control the form owns, wherever it sits, so
 *   a radio group, a checkbox group and a control outside the form that
 *   joins it through `form="…"` are all found the same way — by name, or
 *   by id.
 * - Nesting gives AND for free: a fieldset inside a disabled fieldset is
 *   disabled too, whatever its own condition says. So the grammar below has
 *   no `&&` and no brackets, and does not need them.
 * What HTML cannot express is the condition itself — no attribute says
 * "disabled unless that box is ticked" — and that is the whole of what this
 * script adds.
 *
 * What this script adds
 * ---------------------
 * 1. One attribute on each dependent <fieldset>, data-conditional-when,
 *    naming the field it depends on and, optionally, the values it waits
 *    for (grammar under Configuration).
 * 2. `hidden` and `disabled` on that fieldset while the condition is not
 *    met, both taken off again the moment it is. Nothing else is written
 *    onto the group — no class, no inline style, no ARIA.
 * 3. `required` on the fields marked data-conditional-required, written
 *    once the script runs. Only the script can tell when a group applies,
 *    so only the script may make its fields mandatory (see Progressive
 *    enhancement below).
 * 4. Chains settle. A group may hold the field another group depends on,
 *    and a control in a closed group counts as empty, so closing the outer
 *    group closes everything that hangs off it, in any document order.
 * 5. Re-evaluation wherever the platform changes a value without telling
 *    anyone: after a form reset (which fires no `input`), on `pageshow`
 *    (a page restored from the back/forward cache, or values restored by
 *    the browser, arrive the same silent way), and when a later render
 *    adds fieldsets or fields to the form — or, through `form="…"`,
 *    anywhere else in the page.
 * 6. A console warning where a group is placed where a reader will not
 *    meet it next — above its switch, or with other fields in between.
 * 7. One event: "conditionalfields:changed" bubbles off a fieldset whenever
 *    its state flips after init(), with detail { active }. It is what a
 *    project acts on where the change has to leave the form — a price, a
 *    step indicator — none of which is this module's job.
 *
 * Listening on the document, in the capture phase
 * -----------------------------------------------
 * The listeners sit on the DOCUMENT, not on the form, and keep only what
 * belongs to this form (`event.target.form`). An event travels through the
 * ancestors of the field it starts on, and a field that joins the form
 * through `form="…"` from somewhere else in the page has the form as its
 * owner but not as an ancestor: a listener on the form never hears it, and
 * its group would follow it only after a reset or a reload. The observer
 * watches the document for the same reason, and lets through only the
 * changes that touch this form.
 *
 * They listen in the CAPTURE phase, so a pass has settled before any
 * bubbling listener on the same form sees the event — whatever order the
 * modules were initialised in. formValidation is the reason: it
 * re-validates on the same `input`/`change`, and it has to find the group
 * already disabled, not one keystroke later.
 *
 * Progressive enhancement
 * -----------------------
 * Without the script every group is visible and enabled, so the form is
 * complete and posts everything — say in the <legend> when a group applies
 * ("Delivery address — only if different"). The first paint is that same
 * full form; the closed groups go when the chunk arrives. No pre-enhancement
 * block ships, because hiding a group before the script exists would leave
 * it unreachable for good if the chunk never arrives — the snippet documents
 * the opt-in rule and the trade instead. data-conditionalfields-ready is
 * written for that rule, after the first pass and on every bail-out.
 *
 * That full form must also be one a reader can SEND. An authored `required`
 * inside a group would make the browser insist on a delivery address from
 * somebody who never wanted one, because without the script nothing can
 * tell that the group does not apply. So a field in a group is marked
 * data-conditional-required instead, and this script writes `required` onto
 * it once it runs — from then on `disabled` keeps it out of the validation
 * whenever its group is closed. Without the script the field is optional on
 * the client and the server has the last word, which it has anyway.
 *
 * The groups that close at arrival close under nobody: where the focus is
 * already inside one (a reader who started typing before the chunk came),
 * that group is HELD open — it closes once the focus has left it, its
 * switch is changed, or the form is reset. Taking a group away while
 * somebody types in it is exactly the unrequested change WCAG 3.2.2 is
 * about, and the arrival of a script chunk is not a reader's request.
 *
 * `hidden` needs help to hide, though: it is a UA rule at specificity
 * (0,0,0), so the first `.formGroup { display: grid }` a project writes
 * would put every closed group back on screen. The stylesheet holds it —
 * see conditionalFields.scss.
 *
 * Accessibility
 * -------------
 * - Place a dependent group directly AFTER the field it depends on. A group
 *   that opens elsewhere is a change of context nobody is told about (WCAG
 *   3.2.2), and one that opens above the field is met only by scrolling
 *   back (1.3.2). In reading order, the new fields are simply what comes
 *   next. The module cannot move a group, but it says so in the console:
 *   a group that comes before its switch, or one with other fields
 *   between the switch and itself, is reported once.
 * - Prefer radios to a <select> where a choice opens a group. On Windows
 *   the arrow keys change a closed select's value — and fire `change` —
 *   with every press, so the groups behind it open and close while a reader
 *   only browses the options. Nothing is lost by it, but radios say the
 *   same thing in fewer surprises.
 * - Nothing is announced. A polite "3 new fields" on every tick would be
 *   noise, and the fields are where a reader is about to go anyway.
 * - No aria-expanded and no aria-controls on the controlling field:
 *   aria-expanded is not allowed on a checkbox or a radio, and
 *   aria-controls is ignored by most screen readers.
 * - The focus is never moved — with one exception, and it is a fault
 *   avoided. Where the focus is inside a group the pass closes (a chain, or
 *   a value changed by script), `hidden` would hand it to <body> and put the
 *   reader at the top of the document (WCAG 2.4.3). It goes to the field
 *   the group depends on instead, following a chain up where that field
 *   has just closed as well.
 * - `hidden` takes a closed group out of the accessibility tree, and
 *   `disabled` takes it out of the tab order and the validation, so the
 *   three channels — what is seen, what is reached, what is checked — never
 *   disagree.
 *
 * Configuration (data-js-behavior="conditionalFields" on the <form>)
 * ----------------------------------------------------------------------------
 * - data-conditional-when="…"   on a <fieldset> in the form. Read once, when
 *                               the fieldset is first seen. The grammar:
 *     name               the field is filled: a checked box or radio, an
 *                        option with a non-empty value, a non-empty text
 *     !name              the field is empty: the opposite of the above
 *     name=a             the field's value is "a"
 *     name=a|b           the field's value is "a" OR "b"
 *     name!=a|b          the field's value is neither "a" nor "b"
 *   `name` is the control's name (the platform also resolves an id). Values
 *   are compared exactly, case included, and a checkbox's value is its
 *   `value` attribute — "on" where it has none. For AND, nest the fieldsets.
 * - data-conditional-required    on a field inside such a fieldset, in place
 *                               of `required`. The script writes `required`
 *                               onto it when it runs and takes it off again
 *                               on destroy. Outside a dependent group it is
 *                               reported and ignored — write `required`.
 *
 * The module owns `hidden` and `disabled` on these fieldsets, and
 * `required` on the fields it was asked to make mandatory. An authored
 * `disabled` is honoured: such a group is shown and hidden, but never
 * enabled.
 * ----------------------------------------------------------------------------
 */



import { rafThrottle } from './rafThrottle.js';



const defaults = {

  // The condition, on the dependent <fieldset>. A behavioural attribute,
  // never a style class, so the project's own form design is free of this
  // module.
  whenAttr: 'data-conditional-when',

  // On a field inside such a group, in place of `required`: the field is
  // mandatory only once the script can tell when the group applies.
  requiredAttr: 'data-conditional-required',

  // Set on the form after the first pass and on every bail-out, removed on
  // destroy. Only ever written: it exists for the opt-in pre-enhancement
  // rule documented in the snippet (see docs/preEnhancement.md).
  readyAttr: 'data-conditionalfields-ready',

  // What a fieldset fires when its state flips after init(). Named after the
  // module rather than after the job, the way filterList's event is.
  changedEvent: 'conditionalfields:changed',
};



// Input types that carry no value a condition could mean: they are pressed,
// not filled. A <button> is left out the same way, by not being one of the
// three elements valuesOf() reads.
const buttonTypes = ['submit', 'reset', 'button', 'image'];



// "name", "!name", "name=a|b" or "name!=a|b" as { name, op, values }. The
// name may not contain "!" or "=", which no form field name in practice
// does; the values are everything after the operator, split on "|", so
// "other=" is a real condition — the empty value, a select's placeholder.
// Returns null for a condition with no name, which the caller reports.
function parseCondition(raw) {
  const source = raw.trim();
  const match = source.match(/^([^!=]+?)\s*(!?=)\s*(.*)$/);

  if (match) {
    return {
      name: match[1].trim(),
      op: match[2] === '=' ? 'in' : 'notIn',
      values: match[3].split('|').map((value) => value.trim()),
    };
  }

  const negated = source.startsWith('!');
  const name = (negated ? source.slice(1) : source).trim();
  if (!name) return null;

  return { name, op: negated ? 'empty' : 'filled', values: [] };
}



// Can a condition read a value off this element at all? The controls a
// reader fills in: <select>, <textarea>, and every <input> that is not a
// button. A <fieldset> or an <output> sharing the name is left out, so it
// cannot turn a lone checkbox into a group.
function isValueControl(el) {
  if (el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && !buttonTypes.includes(el.type);
}



// The values one control contributes as it stands. A disabled control
// contributes NOTHING, and that is what makes chains settle: a field inside
// a group this module has closed is empty as far as every other condition
// is concerned, exactly as it is empty as far as the submit is concerned.
// `:disabled` and not `.disabled`, because the property says nothing about
// a disabled ancestor fieldset.
function valuesOf(control) {
  if (control.matches(':disabled')) return [];

  if (control instanceof HTMLSelectElement) {
    return Array.from(control.selectedOptions, (option) => option.value);
  }

  if (control.type === 'checkbox' || control.type === 'radio') {
    return control.checked ? [control.value] : [];
  }

  return [control.value];
}



// Does this set of values meet the condition? "Filled" ignores empty
// strings, so a select resting on its "please choose" option and a text
// field holding nothing are both empty. The comparisons do not — "name="
// asks for the empty value on purpose.
function isMet(condition, values) {
  const filled = values.some((value) => value !== '');
  if (condition.op === 'filled') return filled;
  if (condition.op === 'empty') return !filled;

  const hit = values.some((value) => condition.values.includes(value));
  return condition.op === 'in' ? hit : !hit;
}



class ConditionalFields {

  // Read by the throttled re-index and the reset timer: neither can be
  // cancelled from the outside once queued, so each has to find out for
  // itself that there is nothing left to do.
  destroyed = false;

  // Every dependent fieldset seen so far, in document order. A record is
  // made once per element and kept, because it carries the one thing that
  // cannot be read back later — whether the AUTHOR shipped it disabled or
  // hidden, before this module started writing both.
  regions = [];
  records = new Map();

  // Elements this instance has already complained about. index() runs again
  // on every subtree change, so without it one mis-marked element would file
  // a warning per render.
  reported = new WeakSet();

  // Groups whose placement has been looked at. Once per group is enough:
  // the warning is about the authored markup, not about its state.
  placementChecked = new WeakSet();

  // The fields this instance made `required`, so destroy() takes off only
  // what it wrote and leaves an authored `required` alone.
  madeRequired = new Set();

  // The pending re-evaluation after a form reset, and the pending look at
  // where the focus went after it left a held group — so destroy() can
  // drop both.
  resetTimer = null;
  focusTimer = null;



  constructor(form, config, reporter) {
    this.form = form;
    this.config = config;
    this.reporter = reporter;

    this.reindex = rafThrottle(this.handleMutation);

    this.setup();
  }



  setup = () => {
    this.index();

    // A reader who started typing before the chunk arrived keeps the group
    // they are in (see the file header). Only the groups holding the focus
    // right now: the hold is about the moment of arrival, not a state.
    const focused = document.activeElement;
    for (const region of this.regions) {
      region.held = region.el.contains(focused);
    }

    this.run({ notify: false });

    // The document, not the form: a field may join the form from outside it
    // (see the file header). handleMutations keeps what touches this form.
    this.observer = new MutationObserver(this.handleMutations);
    this.observer.observe(document, { childList: true, subtree: true });

    // On the document, so a field outside the form that joins it through
    // `form="…"` is heard too; capture, so a pass has settled before any
    // bubbling listener on this form sees the same event (see the file
    // header). Both events, because a script that sets a value and
    // announces it usually fires only one of them, and which one is up to
    // that script.
    document.addEventListener('input', this.handleInput, true);
    document.addEventListener('change', this.handleInput, true);
    document.addEventListener('focusout', this.handleFocusOut);
    this.form.addEventListener('reset', this.handleReset);
    window.addEventListener('pageshow', this.handlePageShow);

    this.form.setAttribute(this.config.readyAttr, '');
  };



  // Reads the form: which fieldsets depend on something. form.elements and
  // not a descendant query, so a fieldset that joins the form through
  // `form="…"` counts and one inside the form that belongs to another form
  // does not — the platform's answer to "whose field is this", not ours.
  index = () => {
    const config = this.config;

    const fieldsets = Array.from(this.form.elements).filter(
      (el) => el instanceof HTMLFieldSetElement && el.hasAttribute(config.whenAttr)
    );

    this.regions = fieldsets
      .map((el) => this.recordFor(el))
      .filter(Boolean);

    // The names some condition reads — the only fields whose change can open
    // or close anything (see handleInput).
    this.names = new Set(this.regions.map((region) => region.condition.name));

    // Records of fieldsets that have left the form are dropped, so a host
    // re-rendering a section does not keep the old nodes alive.
    for (const el of this.records.keys()) {
      if (!fieldsets.includes(el)) this.records.delete(el);
    }

    // The attribute on anything but a fieldset is an author mistake worth
    // naming: only a fieldset passes `disabled` on to what it holds, and a
    // group that is only hidden is the fault this module exists to avoid.
    this.form.querySelectorAll(`[${config.whenAttr}]`).forEach((el) => {
      if (el instanceof HTMLFieldSetElement) return;

      this.complain(
        el,
        `${config.whenAttr} works on a <fieldset> only, because nothing else disables the fields inside it; this element is ignored.`
      );
    });

    this.markRequired();
  };



  // Writes `required` onto every field marked data-conditional-required
  // inside a dependent group. Runs on every re-index, so a field a later
  // render brings is mandatory too. Outside a group the marker would make a
  // field mandatory only when the script runs, for no reason the form could
  // give — that is an author mistake, reported and left alone. Not reported
  // is a field inside an element that carries the condition but is no group
  // (a condition naming no field, the attribute on a <div>): that element
  // has been reported already, with the cause, and a second warning saying
  // "outside a group" would point at the field instead.
  markRequired = () => {
    const attr = this.config.requiredAttr;

    for (const el of this.madeRequired) {
      if (el.form !== this.form) this.madeRequired.delete(el);
    }

    for (const el of this.form.elements) {
      if (!el.hasAttribute(attr) || !isValueControl(el)) continue;

      const inGroup = this.regions.some((region) => region.el.contains(el));
      if (!inGroup) {
        if (el.closest(`[${this.config.whenAttr}]`)) continue;

        this.complain(
          el,
          `${attr} belongs on a field inside a group with ${this.config.whenAttr}; write required on any other field. This field is left optional.`
        );
        continue;
      }

      if (el.required) continue;

      el.required = true;
      this.madeRequired.add(el);
    }
  };



  // The record for one fieldset, made on first sight. `active` starts as
  // null, which no evaluation returns — so the first pass writes every
  // record once, and a pass can tell a fieldset that is new from one whose
  // state flipped (only the latter fires the event).
  recordFor = (el) => {
    const known = this.records.get(el);
    if (known) return known;

    const raw = el.getAttribute(this.config.whenAttr) || '';
    const condition = parseCondition(raw);

    if (!condition) {
      this.complain(
        el,
        `${this.config.whenAttr}="${raw}" names no field; this group stays visible.`
      );
      return null;
    }

    const record = {
      el,
      condition,
      authoredDisabled: el.disabled,
      authoredHidden: el.hidden,
      active: null,
      held: false,
    };

    this.records.set(el, record);
    return record;
  };



  // One warning per element, however often the form is re-indexed.
  complain = (el, message) => {
    if (this.reported.has(el)) return;

    this.reported.add(el);
    this.reporter?.report('conditionalFields', message, el);
  };



  // The controls a condition reads, resolved on every pass rather than once:
  // a field may arrive after init() in a later render, and a condition that
  // pointed at nothing a moment ago may point at something now.
  //
  // Matched by name or id over form.elements, which is what namedItem()
  // does in one call — except in WebKit, where a field that joins the form
  // through `form="…"` and arrives as parsed markup (innerHTML, a fetched
  // fragment) is in the list but missing from namedItem()'s answer
  // (measured in WebKit 26.5; Chromium answers both). The list is right in
  // every engine, so the list is asked.
  controlsFor = (name) => Array.from(this.form.elements).filter(
    (el) => (el.name === name || el.id === name) && isValueControl(el)
  );



  // Should this group be open? Two answers are not the condition's to give,
  // and both come out OPEN, because a group wrongly shown costs a reader a
  // glance while a group wrongly hidden costs them the fields in it:
  // - the name resolves to no control (a typo, or a field not rendered yet);
  // - every control it resolves to sits inside the group itself, which would
  //   close the group over its own switch with no way to open it again.
  //
  // A group held at arrival (see setup) stays open although its condition
  // is not met — but only while its switch can still be reached. Where the
  // switch has just closed with a group further up, the hold lapses: a group
  // open behind a switch nobody can see could never be closed again.
  evaluate = (region) => {
    const { el, condition } = region;
    const controls = this.controlsFor(condition.name);

    if (!controls.length) {
      this.complain(
        el,
        `${this.config.whenAttr} names "${condition.name}", which is no field of this form; this group stays visible.`
      );
      return true;
    }

    if (controls.every((control) => el.contains(control))) {
      this.complain(
        el,
        `${this.config.whenAttr} names "${condition.name}", which sits inside this group, so it could never open again; this group stays visible.`
      );
      return true;
    }

    this.checkPlacement(region, controls);

    if (isMet(condition, controls.flatMap(valuesOf))) return true;

    if (region.held && controls.some((control) => !control.matches(':disabled'))) {
      return true;
    }

    region.held = false;
    return false;
  };



  // The module cannot move a group to where a reader meets it, but it can
  // say that it is somewhere else (WCAG 1.3.2 / 3.2.2, see the file header).
  // Two placements are reported, once per group:
  // - the group comes BEFORE a control of its switch, so what it opens is
  //   met only by going back;
  // - fields stand between the switch and the group, so what it opens is not
  //   what comes next. A field inside another dependent group does not
  //   count: groups hanging off the same switch, or off a field of a group
  //   in between, are all part of what the switch opens. Hidden inputs do
  //   not count either — nobody meets them.
  checkPlacement = (region, controls) => {
    const { el, condition } = region;
    if (this.placementChecked.has(el)) return;

    this.placementChecked.add(el);

    const switches = controls.filter((control) => !el.contains(control));
    const after = switches.some(
      (control) => el.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING
    );

    if (after) {
      this.complain(
        el,
        `${this.config.whenAttr} names "${condition.name}", which comes after this group, so a reader who changes it meets the new fields only by going back. Place the group directly after it.`
      );
      return;
    }

    const last = switches[switches.length - 1];
    const between = Array.from(this.form.elements).filter((field) => {
      if (!isValueControl(field) || field.type === 'hidden') return false;
      if (!(last.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      if (!(el.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_PRECEDING)) return false;

      return !this.regions.some(
        (other) => other.el !== el && other.el.contains(field) && !other.el.contains(el)
      );
    });

    if (!between.length) return;

    this.complain(
      el,
      `${between.length} field(s) stand between "${condition.name}" and the group it opens, so the new fields are not what a reader meets next. Place the group directly after it.`
    );
  };



  // The two writes this module makes, and nothing else. Only called when the
  // state really changed, so a pass that changes nothing writes nothing.
  apply = (region) => {
    region.el.hidden = !region.active;
    region.el.disabled = !region.active || region.authoredDisabled;
  };



  // Evaluates every group until nothing changes any more. One round settles
  // any chain whose links stand in document order; a link pointing BACK up
  // the form needs one more round each, so a round per group plus one is
  // the most a chain can take. Still moving after that means two groups
  // open and close each other — reported, and left where the last round put
  // them rather than looped on forever.
  settle = () => {
    for (let round = 0; round <= this.regions.length; round++) {
      let moved = false;

      for (const region of this.regions) {
        const active = this.evaluate(region);
        if (active === region.active) continue;

        region.active = active;
        this.apply(region);
        moved = true;
      }

      if (!moved) return;
    }

    this.reporter?.report(
      'conditionalFields',
      'these groups keep opening and closing each other; check their conditions for a loop.',
      this.form
    );
  };



  // One pass: read where the focus is, settle, put the focus somewhere real
  // if its group just closed, and tell the page what flipped. The states
  // are snapshotted BEFORE the pass, so a group that closed and reopened
  // within one pass has not changed and fires nothing. setup() passes
  // notify: false — nothing has flipped yet, the form is only being read.
  run = ({ notify = true } = {}) => {
    const focused = document.activeElement;
    const before = new Map(this.regions.map((region) => [region, region.active]));

    this.settle();
    this.rescueFocus(focused);

    if (!notify) return;

    for (const region of this.regions) {
      const previous = before.get(region);
      if (previous === null || previous === undefined) continue;
      if (previous === region.active) continue;

      region.el.dispatchEvent(new CustomEvent(this.config.changedEvent, {
        bubbles: true,
        detail: { active: region.active },
      }));
    }
  };



  // Where the pass closed the group holding the focus, the focus goes to the
  // field that group depends on — the control the reader most plausibly
  // came from, and the one that opens it again.
  //
  // In a chain that field may have been closed by the same pass: the group
  // depends on a box inside another group that has just closed as well. So
  // the chain is followed up, from the group around the focus to the group
  // around its switch, until a switch is found that can take the focus. The
  // outermost closed group is the one asked at every step, because it comes
  // first in document order. `seen` stops a loop the conditions might form.
  rescueFocus = (focused) => {
    if (!focused || focused === document.body) return;

    const outermostClosed = (nodes) => this.regions.find(
      (region) => !region.active && nodes.some((node) => region.el.contains(node))
    );

    const seen = new Set();
    let region = outermostClosed([focused]);

    while (region && !seen.has(region)) {
      seen.add(region);

      const controls = this.controlsFor(region.condition.name);
      const target = controls.find((control) => !control.matches(':disabled'));

      if (target) {
        target.focus();
        return;
      }

      region = outermostClosed(controls);
    }
  };



  // Only a change to a field some condition names can open or close
  // anything. Everything else typed into the form is let through untouched,
  // so a long free-text field costs one Set lookup per keystroke.
  handleInput = (event) => {
    const target = event.target;
    if (!isValueControl(target)) return;
    if (target.form !== this.form) return;

    if (!this.names.has(target.name) && !this.names.has(target.id)) return;

    // A change to its switch ends a group's hold: from here on the reader
    // has answered the question the group depends on.
    for (const region of this.regions) {
      const name = region.condition.name;
      if (name === target.name || name === target.id) region.held = false;
    }

    this.run();
  };



  // A native reset puts every control back to its default AFTER this event,
  // and fires no `input` while doing it — so the pass waits one task, and
  // then reads the values the reset left.
  handleReset = () => {
    for (const region of this.regions) region.held = false;

    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      if (!this.destroyed) this.run();
    }, 0);
  };



  // A held group closes once the focus has left it. `focusout` fires before
  // the focus has arrived anywhere, so the look waits one task and reads
  // document.activeElement then. Switching to another window fires
  // `focusout` too, but leaves activeElement where it was — so the group is
  // still held when the reader comes back. Heard on the document, because a
  // held group may be a fieldset that joins the form from outside it; with
  // no group held, which is nearly always, it costs one check.
  handleFocusOut = () => {
    if (!this.regions.some((region) => region.held)) return;

    clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => {
      if (this.destroyed) return;

      const focused = document.activeElement;
      let released = false;

      for (const region of this.regions) {
        if (!region.held || region.el.contains(focused)) continue;

        region.held = false;
        released = true;
      }

      if (released) this.run();
    }, 0);
  };



  // A page restored from the back/forward cache keeps its form values, and
  // a reload may have them restored by the browser — both silently. Every
  // `pageshow` therefore re-reads the form; where nothing changed, nothing
  // is written.
  handlePageShow = () => {
    this.run();
  };



  // The observer watches the whole document, so most of what it reports has
  // nothing to do with this form: a countdown's ticking text, a toast, a
  // slide. Only two kinds of change can matter, and only they queue a
  // re-read — one inside the form, and an element added or removed
  // elsewhere that is, or holds, a field joining this form through
  // `form="…"`. Removed nodes are asked too, because a switch that leaves
  // the page leaves its group with a condition to answer again.
  handleMutations = (records) => {
    if (this.destroyed) return;

    const id = this.form.id;
    const joining = id ? `[form="${CSS.escape(id)}"]` : null;

    const touches = records.some((record) => {
      if (this.form.contains(record.target)) return true;
      if (!joining) return false;

      const nodes = [...record.addedNodes, ...record.removedNodes];
      return nodes.some((node) => node instanceof Element
        && (node.matches(joining) || node.querySelector(joining)));
    });

    if (touches) this.reindex();
  };



  // A later render may bring fieldsets, or the fields a condition names, so
  // the form is re-read and evaluated as it stands. childList only: this
  // module's own writes are attributes, which this observer never sees.
  handleMutation = () => {
    if (this.destroyed) return;

    this.index();
    this.run();
  };



  // Optional teardown for hosts that mount and unmount this subtree — see
  // destroyModulesInScope() in boot.js. Every fieldset is handed back as
  // authored: open where it shipped open, disabled and hidden only where
  // the author said so — and every field it made `required` optional again.
  //
  // Less optional than it looks: the input/change/focusout listeners and
  // the observer sit on the document (see setup), so they do NOT die with
  // the form. A host that removes the form without calling this leaves them
  // behind, and they keep the instance and the removed form alive.
  destroy = () => {
    this.destroyed = true;

    clearTimeout(this.resetTimer);
    clearTimeout(this.focusTimer);
    this.observer?.disconnect();

    document.removeEventListener('input', this.handleInput, true);
    document.removeEventListener('change', this.handleInput, true);
    document.removeEventListener('focusout', this.handleFocusOut);
    this.form.removeEventListener('reset', this.handleReset);
    window.removeEventListener('pageshow', this.handlePageShow);

    for (const region of this.records.values()) {
      region.el.hidden = region.authoredHidden;
      region.el.disabled = region.authoredDisabled;
    }

    for (const el of this.madeRequired) el.required = false;
    this.madeRequired.clear();

    this.form.removeAttribute(this.config.readyAttr);
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'conditionalFields',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // The conditions are resolved through form.elements, which only a <form>
  // has. The ready attribute is written anyway, so an opt-in rule keyed on
  // it does not keep a group hidden behind a module that never ran.
  if (!(el instanceof HTMLFormElement)) {
    reporter?.report(
      'conditionalFields',
      'module must be initialized on a <form> element.', el
    );
    el.setAttribute(defaults.readyAttr, '');
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new ConditionalFields(el, defaults, reporter);
  return instance.destroy;
}
