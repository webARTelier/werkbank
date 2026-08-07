/**
 * dataTable.js
 * ----------------------------------------------------------------------------
 * Makes a plain <table> sortable, and keeps a wide one usable on a narrow
 * screen. Both are gaps the platform leaves open: a table is exactly the
 * right element for tabular data and the browser renders it perfectly, but
 * it has no sorting of its own, and the box that scrolls it sideways is
 * invisible to the keyboard.
 *
 * What the platform already does
 * ------------------------------
 * - <table>, <thead>, <th scope> and <caption> carry the semantics. A screen
 *   reader announces which column a cell belongs to without a line of ARIA,
 *   and the caption names the table.
 * - overflow: auto scrolls a box that is narrower than its content, and the
 *   arrow keys scroll the nearest scroll container around the focus.
 * - A <button> is operated by Enter and Space, and aria-sort is the state
 *   the ARIA APG "Sortable Table" pattern asks for — no roving tabindex, no
 *   key handling of its own.
 * - Intl knows how the page's language writes a number, so "1.234,50" is
 *   read as one value on a German page and as something else on an English
 *   one.
 * The scroll box, the sticky header/column and the stacked layout are all
 * CSS (see dataTable.scss). This script adds what CSS cannot express.
 *
 * What the script adds
 * --------------------
 * 1. A sort control per marked column: the header cell's own content moves
 *    into a <button>, so the column label stays the control's name and the
 *    unenhanced markup carries no control that does nothing. Every sortable
 *    header starts at aria-sort="none", which is what tells a screen reader
 *    the column offers sorting at all.
 * 2. Sorting: rows are reordered inside each <tbody>, one write per body,
 *    by moving the existing <tr> nodes — nothing is re-rendered, so
 *    whatever sits inside a cell survives. Equal values keep their document
 *    order, and an empty cell always sorts last, in both directions.
 * 3. The value a column sorts by, in the order the platform offers it:
 *    data-datatable-value, then a <time datetime>, then the visible text.
 * 4. One polite announcement per sort, from a visually hidden status region
 *    — the rows below the header have all moved, and nothing about that
 *    reaches a screen reader on its own.
 * 5. Keyboard access to the scroll box: while it overflows and holds nothing
 *    focusable it becomes a tab stop (tabindex="0") named by the table's
 *    caption, so the arrow keys can scroll it.
 * 6. The measured size of the two frozen edges, as custom properties the
 *    stylesheet turns into scroll-padding, so a control scrolled into view
 *    does not end up parked underneath them.
 * 7. The two things the stacked layout cannot do without: the column label
 *    each cell shows in front of its value, and the explicit roles that
 *    keep the table a table once its parts stop being table boxes.
 * 8. Reports for wiring the stylesheet cannot fix — a missing table, a
 *    merged header or body cell, a header that already holds a control, a
 *    scroll box that cannot be named.
 *
 * Accessibility
 * -------------
 * Follows the APG sortable-table pattern: the control is a real button
 * inside the columnheader, and the sort state lives in aria-sort on that
 * header — the one place assistive tech looks for it. The direction
 * indicator is a pseudo-element in the stylesheet, so it adds nothing to
 * the accessibility tree and cannot be read out twice.
 *
 * Every sortable column carries aria-sort, "none" until it is the one the
 * table is sorted by. The attribute is the only thing that distinguishes a
 * sort control from any other button in a header cell, so leaving it off
 * the unsorted columns would hide the feature from the readers who most
 * need to be told it is there.
 *
 * A sort moves every row in the table while focus stays on the button that
 * did it. aria-sort states the new state, but a change to it on the
 * focused button's PARENT is not something NVDA or JAWS read out by
 * themselves — hence the polite status region (WCAG 4.1.3). It is written
 * only on an actual activation; an initial sort from the markup is the
 * table's resting state, not news.
 *
 * The scroll box follows the same rule dialog applies to its own scroll
 * region: a tab stop only while it overflows AND contains nothing focusable
 * — a sortable table already offers a keyboard path through its buttons,
 * and the arrow keys scroll the box the focus is in. A focusable region
 * needs an accessible name (WCAG 4.1.2), so the module borrows the table's
 * <caption> and reports the case where there is nothing to borrow rather
 * than emitting an unlabelled landmark.
 *
 * The two sticky modifiers freeze an edge of that same box, and the browser
 * does not know about them when it scrolls a focused control into view: it
 * parks the control under the frozen header or behind the frozen first
 * column, where a keyboard user cannot see what they are on (WCAG 2.4.11).
 * Only a measurement can say how deep those edges are, so the module takes
 * it on every resize and hands it to the stylesheet, which is where the
 * question of whether an edge is frozen at all is answered.
 *
 * Configuration (all optional)
 * ----------------------------
 * On the component root (the element with data-js-behavior="dataTable"):
 * - data-datatable-stacked         ask for the stacked layout on a narrow
 *                                  viewport; the module writes the labels
 *                                  and roles it needs (see 7.)
 * - data-datatable-announce        your own template for the sort
 *                                  announcement, with {column} and
 *                                  {direction} (see `labels` below)
 * - aria-label / aria-labelledby   name the scroll box yourself instead of
 *                                  letting the caption name it
 * On a header cell in the <thead> row:
 * - data-datatable-sort            make the column sortable. The value
 *                                  names the kind of data — "text",
 *                                  "number" or "date"; empty means "guess"
 *                                  (numbers or text, never dates), which is
 *                                  re-made on every sort, like the keys
 * - data-datatable-sorted          "ascending" | "descending": sort by this
 *                                  column on load
 * On a body cell:
 * - data-datatable-value           the machine-readable value to sort by,
 *                                  where the visible text is formatted for
 *                                  people
 * - data-datatable-label           the column label the stacked layout
 *                                  shows; written by the module where the
 *                                  author left it out
 * ----------------------------------------------------------------------------
 */



// rafThrottle collapses a burst of resize events into one measurement per
// frame. focusableSelector answers both "is this box reachable already"
// (scroll access) and "would the button wrap a control" (sort control).
// uniqueId names a <caption> that has to be pointed at and has no id.
// resolveLocale + formatTemplate are the pair every announcing component in
// this collection uses (see inputCharCount): the page's language picks a
// template, the template keeps word order with the translation.
import { rafThrottle } from './rafThrottle.js';
import { focusableSelector } from './focusableSelector.js';
import { uniqueId } from './uniqueId.js';
import { resolveLocale } from './resolveLocale.js';
import { formatTemplate } from './formatTemplate.js';



const defaults = {

  // marks a sortable column, on a header cell of the <thead> row. The value
  // names the kind of data; an empty value asks for the guess.
  sortAttr: 'data-datatable-sort',

  // the column to sort by on load, and in which direction
  sortedAttr: 'data-datatable-sorted',

  // the machine-readable value of a cell, where its text is formatted for
  // people ("1.284" -> 1284, "7 Aug 2026" -> 2026-08-07)
  valueAttr: 'data-datatable-value',

  // the column label a cell shows in front of its value once the rows are
  // stacked as cards. Written by the module from the header, unless the
  // author wrote one.
  labelAttr: 'data-datatable-label',

  // presence asks for the stacked layout (the stylesheet applies it below
  // the "small" breakpoint) and is what makes the module write the labels
  // and roles that layout needs
  stackedAttr: 'data-datatable-stacked',

  // the injected sort control. A data attribute, not an m-* class: the
  // module does not own the stylesheet's class names — same reason toast
  // addresses its injected dismiss control this way.
  buttonAttr: 'data-datatable-sortbutton',

  // the injected status region that announces a sort, and the one style it
  // needs (being visually hidden) in dataTable.scss
  statusAttr: 'data-datatable-status',

  // an author's own announcement template, on the root
  announceAttr: 'data-datatable-announce',

  // The depth of the two frozen edges, measured on the root and written
  // there for the stylesheet to turn into scroll-padding. They are the one
  // thing this module puts in a style attribute, and deliberately so: only
  // a measurement can answer how wide a content-sized sticky column is, and
  // neither property paints anything or changes a layout, so the
  // ResizeObserver below cannot be fed by them.
  stickyHeadProp: '--dataTable-sticky-head-block-size',
  stickyColumnProp: '--dataTable-sticky-column-inline-size',

  // "This table has been enhanced." Set on the root at the end of a
  // successful init, removed again by the cleanup function. Only ever
  // WRITTEN, never read back. Note the direction: the stacked layout in
  // dataTable.scss is gated ON its presence rather than on its absence
  // (see the constructor), so a bail-out must not set it.
  readyAttr: 'data-datatable-ready',

  // the two directions, spelled the way aria-sort spells them, and the
  // third value that says "sortable, but not the sorted one"
  ascending: 'ascending',
  descending: 'descending',
  none: 'none',

  // <html lang> matching none of the locales below falls back to this one
  fallbackLocale: 'en',
};



// What the status region says after a sort, keyed by locale then by
// direction. Natural language, not "Region: ascending" — this is read out,
// and a colon is a pause, not a word. {column} is the header's own text, so
// the announcement names the column the same way the button does.
const labels = {

  de: {
    ascending: 'Nach {column} aufsteigend sortiert.',
    descending: 'Nach {column} absteigend sortiert.',
    directionAscending: 'aufsteigend',
    directionDescending: 'absteigend',
  },

  en: {
    ascending: 'Sorted by {column}, ascending.',
    descending: 'Sorted by {column}, descending.',
    directionAscending: 'ascending',
    directionDescending: 'descending',
  },
};



// <html lang> as something Intl will accept, or undefined for the browser's
// own default. An empty or malformed tag makes every Intl constructor throw,
// and a table that cannot be sorted because a lang attribute has a typo in
// it would be a poor trade.
function pageLocale() {
  const lang = (document.documentElement.lang || '').trim();
  if (!lang) return undefined;

  try {
    Intl.getCanonicalLocales(lang);
    return lang;
  } catch {
    return undefined;
  }
}



// The group and decimal separator of the page's language, asked of the
// platform rather than assumed: "1.234" is one number in English and another
// in German, and only the page's language says which of the two this is.
// Visible text is parsed with these; a data-datatable-value is not (see
// parseNumber).
function numberSeparators(locale) {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
    const valueOf = (type) =>
      parts.find((part) => part.type === type)?.value || '';

    return { group: valueOf('group'), decimal: valueOf('decimal') || '.' };
  } catch {
    return { group: '', decimal: '.' };
  }
}



class DataTable {

  constructor(root, params, reporter) {
    this.root = root;
    this.params = params;
    this.reporter = reporter;
    this.columns = [];
    this.sortedColumn = null;
    this.direction = null;

    this.table = root.querySelector('table');
    if (!this.table) {
      reporter?.report(
        'dataTable',
        'no <table> found in the component root.', { el: root }
      );
      return;
    }

    // Keyboard-access bookkeeping for the scroll box. An author-set tabindex
    // means focus is being managed elsewhere, so the module keeps out of it;
    // `scrollable` starts undefined so the first sync always writes the
    // initial state.
    this.authorControlsFocus = root.hasAttribute('tabindex');
    this.authorNamed =
      root.hasAttribute('aria-label') || root.hasAttribute('aria-labelledby');
    this.scrollable = undefined;
    this.nameApplied = false;
    this.warnedMissingName = false;

    const locale = pageLocale();
    this.collator = new Intl.Collator(locale, {

      // "Item 2" before "Item 10", and case is not a sort criterion
      numeric: true,
      sensitivity: 'base',
    });
    this.separators = numberSeparators(locale);

    // The spoken strings take the page's language the same way, but through
    // resolveLocale: Intl knows every locale, this module knows two.
    this.labels =
      labels[resolveLocale(Object.keys(labels), params.fallbackLocale)];

    // Before anything that can sort: an initial sort ends by asking for a
    // measurement, and this is what collapses those requests into one per
    // frame.
    this.requestSync = rafThrottle(this.syncBox);

    // Both features below map a body cell to its column by position, so
    // both need a header row they can trust AND body rows that count the
    // same way. Neither is asked for unless the markup wants something from
    // it — a table with neither sortable columns nor the stacked layout
    // needs no <thead> at all.
    const wantsSorting = !!this.table.querySelector(`[${params.sortAttr}]`);
    const wantsStacked = root.hasAttribute(params.stackedAttr);
    this.headerRow = this.findHeaderRow();
    const mappable =
      (wantsSorting || wantsStacked) &&
      this.checkHeaderRow(wantsStacked) &&
      this.checkBodyRows();

    if (wantsSorting && mappable) this.setUpSorting();

    // The stacked layout is the one thing here that cannot survive on its
    // own: cards without their labels are a column of bare values. So the
    // ready flag — which is what switches that layout on — is withheld when
    // it was asked for and could not be prepared, and the table stays the
    // scrolling one it is at every wider viewport. This is the opposite
    // direction from a pre-enhancement flag (tabs sets its own first, so a
    // bail-out LIFTS the state); see docs/preEnhancement.md.
    const stacked = !wantsStacked || (mappable && this.prepareStackedLayout());

    this.startListening();
    this.syncBox();

    if (stacked) root.setAttribute(params.readyAttr, '');
  }



  // The row the columns are named in: the last row of the <thead>, so a
  // table that groups its columns under a spanning row above still resolves
  // to the row holding the individual column headers.
  findHeaderRow = () => {
    const head = this.table.tHead;
    if (!head || !head.rows.length) return null;
    return head.rows[head.rows.length - 1];
  };



  // Sorting and the stacked labels both address a body cell by the position
  // of its header — so a missing header row or a merged header cell makes
  // the mapping a guess, and a guess would put values under the wrong
  // label. Reported once here, with the reason, and both features stay off.
  checkHeaderRow = (wantsStacked) => {
    if (!this.headerRow) {

      // Two ways to end up here, and they are fixed differently: one table
      // wants labels it has no source for, the other marked a column
      // sortable outside the row that names the columns.
      const reason = wantsStacked
        ? 'the stacked layout needs a <thead> row to take the cell labels from.'
        : 'sortable columns have to sit in a <thead> row.';

      this.reporter?.report('dataTable', reason, { el: this.table });
      return false;
    }

    const merged = Array.from(this.headerRow.cells)
      .some((cell) => cell.colSpan > 1);
    if (!merged) return true;

    this.reporter?.report(
      'dataTable',
      'a header cell spans several columns, so a body cell cannot be ' +
      'mapped to its column — sorting and the stacked labels stay off.',
      { el: this.headerRow }
    );
    return false;
  };



  // The same mapping, one row further down — and the half that is easy to
  // miss, because a spanning body cell breaks it without a symptom: sorting
  // silently compares another column and the stacked layout prints another
  // column's label.
  //
  // A colspan shifts every cell behind it out of its column. A rowspan is
  // the worse of the two: it takes a cell out of the rows it reaches into,
  // so those rows count one cell short from that position on — and sort()
  // moves whole <tr> nodes, which would pull a block held together by one
  // cell apart.
  //
  // Only the <tbody> rows are asked. A spanning cell in a <tfoot> ("Total"
  // across three columns) is ordinary markup for a summary that is never
  // sorted, so it costs the table neither feature; applyLabels() leaves
  // such a row unlabelled rather than labelling it wrongly.
  checkBodyRows = () => {
    const spanning = Array.from(this.table.tBodies)
      .flatMap((body) => Array.from(body.rows))
      .flatMap((row) => Array.from(row.cells))
      .find((cell) => cell.colSpan > 1 || cell.rowSpan > 1);

    if (!spanning) return true;

    this.reporter?.report(
      'dataTable',
      'a body cell spans several columns or rows, so a cell cannot be ' +
      'mapped to its column — sorting and the stacked labels stay off.',
      { el: spanning }
    );
    return false;
  };



  // One column per marked header cell, in document order.
  setUpSorting = () => {
    Array.from(this.headerRow.cells).forEach((cell) => {
      if (!cell.hasAttribute(this.params.sortAttr)) return;

      const button = this.sortControl(cell);
      if (!button) return;

      // "Sortable, and not the column we are sorted by." Without it a
      // screen reader has a button in a column header and no way to know
      // what it does — the visible chevron says it, and the chevron is a
      // pseudo-element that says nothing to anyone else. sort() below moves
      // exactly one of these to a direction and puts the rest back here.
      cell.setAttribute('aria-sort', this.params.none);

      this.columns.push({
        cell,
        button,
        index: cell.cellIndex,
        type: this.declaredType(cell),
      });
    });

    if (!this.columns.length) return;

    // Before the initial sort, and before any click can reach it: a live
    // region has to be in the document *before* the text lands in it, or
    // the platform has nothing to notice a change against.
    this.buildStatus();
    this.applyInitialSort();
  };



  // The visually hidden region a sort is announced through. role="status"
  // is the polite live region of the platform — it never steals focus, and
  // it waits its turn, which is what a result should do. It sits inside the
  // root so it travels with the component; the one style it needs is in
  // dataTable.scss, addressed by the same attribute.
  buildStatus = () => {
    const existing = this.root.querySelector(`[${this.params.statusAttr}]`);
    if (existing) {
      this.status = existing;
      return;
    }

    this.status = document.createElement('div');
    this.status.setAttribute(this.params.statusAttr, '');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.root.append(this.status);
  };



  // One sentence per activation. Not called by the initial sort: a table
  // that arrives sorted is not reporting a change, and an announcement on
  // load is something the reader has to sit through before reaching the
  // page. An author template wins over the built-in one.
  announce = (column, direction) => {
    if (!this.status) return;

    const ascending = direction === this.params.ascending;
    const template =
      this.root.getAttribute(this.params.announceAttr) ||
      (ascending ? this.labels.ascending : this.labels.descending);

    this.status.textContent = formatTemplate(template, {
      column: column.button.textContent.replace(/\s+/g, ' ').trim(),
      direction: ascending
        ? this.labels.directionAscending
        : this.labels.directionDescending,
    });
  };



  // Moves the header's own content into a button, so the column label IS
  // the control's accessible name and the markup needs no second copy of
  // it. An existing control is reused rather than wrapped again: init() can
  // run a second time over the same markup after destroy() (see
  // destroyModulesInScope() in boot.js), and a button inside a button would
  // be the result.
  sortControl = (cell) => {
    const existing = cell.querySelector(`[${this.params.buttonAttr}]`);
    if (existing) return existing;

    // Whatever is in the header cell becomes the label of a button, so
    // anything focusable in there would end up nested inside it — invalid
    // markup, and the inner control unreachable. The column stays unsorted.
    if (cell.querySelector(focusableSelector)) {
      this.reporter?.report(
        'dataTable',
        'a sortable header already holds a focusable element; the sort ' +
        'control would have to wrap it. Column stays unsorted.', { el: cell }
      );
      return null;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute(this.params.buttonAttr, '');

    while (cell.firstChild) button.append(cell.firstChild);
    cell.append(button);
    return button;
  };



  // The kind of data a column holds as the MARKUP states it, or null where
  // it does not — which is the request to guess (see sortType). Read once,
  // at init, because an unknown value is a markup error and should be
  // reported when the page loads rather than on the first click. It is
  // reported and treated as "guess" rather than dropping the column: a typo
  // should not cost the sorting.
  declaredType = (cell) => {
    const raw = (cell.getAttribute(this.params.sortAttr) || '')
      .trim().toLowerCase();

    if (raw === 'text' || raw === 'number' || raw === 'date') return raw;

    if (raw !== '') {
      this.reporter?.report(
        'dataTable',
        `unknown ${this.params.sortAttr} value '${raw}' — expected 'text', ` +
        "'number' or 'date'. Falling back to detection.", { el: cell }
      );
    }

    return null;
  };



  // The type a sort actually runs with: what the markup declared, or a
  // fresh guess. Guessed per activation and not once at init, because that
  // is the same promise sort() already makes about its keys — it reads them
  // from the DOM every time, so a cell whose content changed since the last
  // sort sorts by what it says now. A type frozen at init would be the one
  // thing about a column that could not follow it: a column that was still
  // empty when the module ran would stay "text" for good and then sort its
  // numbers lexically ("100" before "20"). The declared type costs nothing
  // to re-read, and the guess costs one pass over the column — on the click
  // that is about to reorder every row of the table anyway.
  sortType = (column) => column.type || this.detectType(column.index);



  // The guess is deliberately narrow: numbers or text. A date is only ever
  // recognised where the author said so or where the cell holds a <time
  // datetime>, because Date.parse() accepts a bare number in some engines —
  // a column of years would turn into a column of dates.
  detectType = (index) => {
    const values = this.columnCells(index)
      .map((cell) => this.cellValue(cell))
      .filter((value) => value.raw !== '');

    if (!values.length) return 'text';
    if (values.every((value) => value.time)) return 'date';

    const numeric = values
      .every((value) => this.parseNumber(value.raw, value.machine) !== null);
    return numeric ? 'number' : 'text';
  };



  // Every body cell of one column, across all bodies of the table.
  columnCells = (index) =>
    Array.from(this.table.tBodies)
      .flatMap((body) => Array.from(body.rows))
      .map((row) => row.cells[index])
      .filter((cell) => cell);



  // What a cell sorts by, in the order the platform offers it:
  //   1. data-datatable-value — the author's machine-readable value, which
  //      wins over everything, so a formatted cell sorts by its real value
  //   2. a <time datetime> — the platform's own machine-readable date
  //   3. the visible text, whitespace collapsed the way it is rendered
  // `machine` says which of the two worlds the string comes from: an
  // authored value is written in the machine's format, text in the reader's.
  cellValue = (cell) => {
    if (!cell) return { raw: '', machine: true, time: false };

    const authored = cell.getAttribute(this.params.valueAttr);
    if (authored !== null) {
      return { raw: authored.trim(), machine: true, time: false };
    }

    const time = cell.querySelector('time[datetime]');
    if (time) {
      const raw = (time.getAttribute('datetime') || '').trim();
      return { raw, machine: true, time: true };
    }

    const text = cell.textContent.replace(/\s+/g, ' ').trim();
    return { raw: text, machine: false, time: false };
  };



  // A number, or null for anything that is not one.
  //
  // A machine-readable string (the attribute, a <time>) is a plain number
  // with a dot: parsing it in the page's language would read "1234.5" on a
  // German page as 12345. Visible text is the other way round — it is
  // written the way the page's language writes numbers, so the separators
  // Intl reported are removed first, and everything else (a currency
  // symbol, a percent sign, a unit) with them.
  parseNumber = (raw, machine) => {
    if (!raw) return null;

    if (machine) {
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    }

    const { group, decimal } = this.separators;

    // Spaces of every width, written as escapes so they stay legible in
    // the source: several languages group with a space, and the ones Intl
    // reports are the no-break and the narrow no-break variants.
    let text = raw.replace(/[\s\u00a0\u202f\u2009]/g, '');
    text = text.replace(/\u2212/g, '-'); // the typographic minus
    if (group) text = text.split(group).join('');
    if (decimal) text = text.split(decimal).join('.');
    text = text.replace(/[^0-9+\-.]/g, '');

    if (!/[0-9]/.test(text)) return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  };



  // A timestamp, or null. Date.parse() understands the ISO form a <time
  // datetime> or a data-datatable-value carries; a date written for people
  // ("7.8.2026") is not parsed the same way by two engines, which is
  // exactly why those two attributes exist.
  parseDate = (raw) => {
    if (!raw) return null;
    const value = Date.parse(raw);
    return Number.isNaN(value) ? null : value;
  };



  // The comparable key of one cell. `empty` covers both a blank cell and a
  // value that does not parse as what the column claims to hold — neither
  // is a position in the order, so both go to the end (see sort()).
  sortKey = (cell, type) => {
    const { raw, machine } = this.cellValue(cell);

    if (type === 'number') {
      const value = this.parseNumber(raw, machine);
      return { empty: value === null, value };
    }

    if (type === 'date') {
      const value = this.parseDate(raw);
      return { empty: value === null, value };
    }

    return { empty: raw === '', value: raw };
  };



  // Reorders the rows of every <tbody> and moves the sort state to this
  // column. The bodies are sorted one by one, not as one list: a table that
  // groups its rows into several bodies means those groups, and sorting
  // across them would dissolve them.
  sort = (column, direction) => {
    const factor = direction === this.params.descending ? -1 : 1;

    // Once per sort, not once per body: every body holds the same columns,
    // and a guess that read one body at a time could compare two of them by
    // different rules.
    const type = this.sortType(column);

    Array.from(this.table.tBodies).forEach((body) => {

      // Every key is read before the first node moves: reading a cell after
      // a move would read a layout the move just invalidated, and the keys
      // come from the DOM on every sort so a cell whose content changed
      // since the last one sorts by what it says now.
      const entries = Array.from(body.rows, (row, index) => ({
        row,
        index,
        key: this.sortKey(row.cells[column.index], type),
      }));

      entries.sort((a, b) => {

        // An empty cell is not a small value, it is no value: it goes last
        // in both directions, so nobody has to scroll past a block of
        // blanks to reach the data.
        if (a.key.empty !== b.key.empty) return a.key.empty ? 1 : -1;

        const order = this.compare(a.key, b.key, type) * factor;

        // Equal values keep their document order — in both directions,
        // because the tie-breaker is not flipped with the comparison.
        return order || a.index - b.index;
      });

      // One insertion per body: the fragment collects the moves and the
      // append puts them back in one go. The rows are the original nodes,
      // so anything inside a cell — a nested module, an open <details> —
      // comes along untouched.
      const fragment = document.createDocumentFragment();
      fragment.append(...entries.map((entry) => entry.row));
      body.append(fragment);
    });

    // Exactly one column reports a direction; the rest go back to "none",
    // which is not the absence of a state but the statement that they are
    // sortable too. The stylesheet keys the active indicator off the two
    // direction values, never off the presence of the attribute.
    this.columns.forEach(({ cell }) =>
      cell.setAttribute('aria-sort', this.params.none));
    column.cell.setAttribute('aria-sort', direction);
    this.sortedColumn = column;
    this.direction = direction;

    // A different order can change the widest value in a column, so the
    // table may start or stop overflowing its box here.
    this.requestSync();
  };



  compare = (a, b, type) => {
    if (type === 'text') return this.collator.compare(a.value, b.value);
    return a.value - b.value;
  };



  // Sorts on load where a column asks for it. More than one column asking
  // is a markup error — the last one would silently win.
  applyInitialSort = () => {
    const { sortedAttr, ascending, descending } = this.params;
    const asked = this.columns
      .filter(({ cell }) => cell.hasAttribute(sortedAttr));
    if (!asked.length) return;

    if (asked.length > 1) {
      this.reporter?.report(
        'dataTable',
        `more than one column carries ${sortedAttr}; the first one wins.`,
        { el: this.headerRow }
      );
    }

    const column = asked[0];
    const raw = (column.cell.getAttribute(sortedAttr) || '')
      .trim().toLowerCase();

    if (raw !== ascending && raw !== descending) {
      this.reporter?.report(
        'dataTable',
        `unknown ${sortedAttr} value '${raw}' — expected '${ascending}' or ` +
        `'${descending}'. Sorting ${ascending}.`, { el: column.cell }
      );
    }

    this.sort(column, raw === descending ? descending : ascending);
  };



  // A click on a sort control. Enter and Space arrive here too — a button
  // fires them as clicks, which is the whole reason the control is one.
  handleClick = (event) => {
    const button = event.target.closest(`[${this.params.buttonAttr}]`);
    if (!button) return;

    const column = this.columns
      .find((candidate) => candidate.button === button);
    if (!column) return;

    // A new column starts ascending, the sorted one flips. There is no
    // third state that puts the document order back: it reads as a broken
    // toggle, and a reload is the honest way back.
    const flip =
      column === this.sortedColumn && this.direction === this.params.ascending;
    const direction = flip ? this.params.descending : this.params.ascending;

    this.sort(column, direction);

    // Only here, never from applyInitialSort(): this is the path where
    // something changed under a reader who asked for it.
    this.announce(column, direction);
  };



  // The two things the stacked layout needs and CSS cannot state itself.
  // Both are written only when that layout is asked for, so an ordinary
  // table pays nothing for either.
  prepareStackedLayout = () => {
    this.applyLabels();
    this.applyRoles();
    return true;
  };



  // The label a cell shows in front of its value once the rows are cards.
  // CSS can print an attribute of the element it is styling (content:
  // attr(...)), but it cannot read the text of another element — so the
  // column's name has to be copied onto the cell. An authored label always
  // wins: a long header ("Average response time in ms") often wants a
  // shorter one on a card.
  applyLabels = () => {
    const labels = Array.from(
      this.headerRow.cells,
      (cell) => cell.textContent.replace(/\s+/g, ' ').trim()
    );

    Array.from(this.table.rows).forEach((row) => {
      if (this.table.tHead?.contains(row)) return;

      // The <tfoot> summary checkBodyRows() let through: its spanning cell
      // is legitimate markup, but every cell behind that one has moved out
      // of its column, so the row gets no labels rather than wrong ones. A
      // total says what it is in its own row header anyway.
      if (Array.from(row.cells).some((cell) => cell.colSpan > 1)) return;

      Array.from(row.cells).forEach((cell) => {

        // A row header is the card's title, so it takes no label: it says
        // which row this is, not which column.
        if (cell.tagName === 'TH') return;
        if (cell.hasAttribute(this.params.labelAttr)) return;

        const label = labels[cell.cellIndex];
        if (!label) return;
        cell.setAttribute(this.params.labelAttr, label);
      });
    });
  };



  // The roles a display change would otherwise cost. The stacked layout
  // turns the table's parts into blocks, and a <td> that is no longer a
  // table-cell box stops being a cell in the accessibility tree — Chromium
  // and WebKit both drop the table semantics with the display type. Writing
  // the role each element already has puts them back, and costs nothing at
  // any wider viewport: every one of them is that element's implicit role.
  // An author-set role is never overwritten.
  applyRoles = () => {
    const setRole = (element, role) => {
      if (!element || element.hasAttribute('role')) return;
      element.setAttribute('role', role);
    };

    // The <caption> deliberately gets none. ARIA in HTML allows no role on
    // it at all (axe reports one as aria-allowed-role, and as an
    // unpermitted child of the table with it), and it does not need one:
    // the table takes its name from the caption through the parent/child
    // relationship, which a display type cannot change.
    setRole(this.table, 'table');

    const groups = [this.table.tHead, ...this.table.tBodies, this.table.tFoot];
    groups.forEach((group) => setRole(group, 'rowgroup'));

    Array.from(this.table.rows).forEach((row) => {
      setRole(row, 'row');

      Array.from(row.cells).forEach((cell) => {
        if (cell.tagName !== 'TH') {
          setRole(cell, 'cell');
          return;
        }

        // scope says it where the author set it; otherwise the <thead> does.
        const column =
          cell.scope === 'col' ||
          cell.scope === 'colgroup' ||
          (!cell.scope && this.table.tHead?.contains(cell));
        setRole(cell, column ? 'columnheader' : 'rowheader');
      });
    });
  };



  startListening = () => {
    this.table.addEventListener('click', this.handleClick);
    window.addEventListener('resize', this.requestSync);

    // Two boxes, because either side of the comparison can move: the root
    // when the layout around it changes, the table when its content does
    // (a font swap, a cell whose text was replaced). The table is as wide
    // as the box until its columns no longer fit, so its own resize is the
    // signal that they stopped fitting.
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.requestSync);
      this.resizeObserver.observe(this.root);
      this.resizeObserver.observe(this.table);
    }
  };



  // Everything that has to be re-read when the box or its content changes
  // size, in one rAF-throttled pass — both halves start from the same
  // layout, and neither of them writes anything that would invalidate it.
  syncBox = () => {
    this.syncStickyOffsets();
    this.syncScrollAccess();
  };



  // How deep the two frozen edges reach into the scroll box. The browser
  // scrolls a focused control just far enough to be inside the box, which
  // is not far enough when a sticky header or a sticky first column is
  // sitting on top of that edge — the control ends up behind it (WCAG
  // 2.4.11). scroll-padding is what moves the target region clear of them,
  // and it needs a length nothing but a measurement can give: the sticky
  // column is as wide as its content.
  //
  // Written unconditionally, consumed conditionally. Whether an edge is
  // frozen is a question the stylesheet answers — the modifier classes are
  // its vocabulary, not this module's — so the module supplies the numbers
  // and dataTable.scss decides under which modifier they mean anything.
  syncStickyOffsets = () => {
    const { stickyHeadProp, stickyColumnProp } = this.params;
    const head = this.table.tHead;
    const frozen = this.stickyColumnCell();

    this.root.style.setProperty(
      stickyHeadProp, `${head ? head.offsetHeight : 0}px`
    );
    this.root.style.setProperty(
      stickyColumnProp, `${frozen ? frozen.offsetWidth : 0}px`
    );
  };



  // The cell to measure the frozen column on. Not the table's first cell
  // blindly: the first row of a <thead> may be a grouping row whose first
  // cell spans two or three columns (findHeaderRow() takes the LAST row for
  // exactly that reason), and measuring that would push the scroll-padding
  // out by columns that are not frozen at all. So the data rows are asked
  // first — they are what a frozen first column exists for — then the row
  // that names the columns, then whatever the table starts with; a spanning
  // candidate is skipped rather than measured, and a table that is nothing
  // but spanning cells measures as 0, which is what the stylesheet's
  // fallback says anyway.
  stickyColumnCell = () => [
    this.table.tBodies[0]?.rows[0],
    this.headerRow,
    this.table.rows[0],
  ]
    .map((row) => row?.cells[0])
    .find((cell) => cell && cell.colSpan === 1) || null;



  // Makes the scroll box a tab stop exactly while it needs one, and only
  // ever writes attributes that do not affect layout — so an observer
  // cannot feed this back to itself.
  syncScrollAccess = () => {
    if (this.authorControlsFocus) return;

    const overflowing = this.root.scrollWidth - this.root.clientWidth > 1;

    // The rule dialog applies to its own scroll region: a box holding
    // something focusable is already reachable, and the arrow keys scroll
    // the scroll container the focus sits in — so a sortable table needs no
    // tab stop of its own, and a table without controls does.
    const hasFocusable = this.root.querySelector(focusableSelector) !== null;
    const scrollable = overflowing && !hasFocusable;

    if (scrollable === this.scrollable) return;

    if (scrollable) {
      this.scrollable = true;
      this.applyScrollAccess();
      return;
    }

    // Don't pull the tabindex out from under a reader parked on the box;
    // leave it until focus has moved on, a later sync cleans it up.
    if (this.root === document.activeElement) return;
    this.scrollable = false;
    this.removeScrollAccess();
  };



  applyScrollAccess = () => {
    this.root.setAttribute('tabindex', '0');

    // A focusable region has to say what it is (WCAG 4.1.2). An author-set
    // name or role is left alone; otherwise the table's <caption> names the
    // box that scrolls it, the way dialog borrows its own title. Only where
    // there is nothing to borrow do we report it rather than emit an
    // unlabelled landmark.
    if (this.authorNamed || this.root.hasAttribute('role')) return;

    const caption = this.table.caption;
    if (!caption) {
      this.warnMissingName();
      return;
    }

    if (!caption.id) caption.id = uniqueId('dataTable-caption');
    this.root.setAttribute('aria-labelledby', caption.id);
    this.root.setAttribute('role', 'region');
    this.nameApplied = true;
  };



  removeScrollAccess = () => {
    this.root.removeAttribute('tabindex');

    // Only ever undo what this module added; author markup is not ours.
    if (!this.nameApplied) return;
    this.root.removeAttribute('role');
    this.root.removeAttribute('aria-labelledby');
    this.nameApplied = false;
  };



  // Once, and only while the box is actually a tab stop: a table that never
  // overflows needs no name for a region it never becomes.
  warnMissingName = () => {
    if (this.warnedMissingName) return;
    this.warnedMissingName = true;

    this.reporter?.report(
      'dataTable',
      'the table is wider than its box, so it became keyboard focusable, ' +
      'but nothing names it: give the <table> a <caption> (which also ' +
      'names the table itself) or the root an aria-label — a focusable ' +
      'region without a name fails WCAG 4.1.2.', { el: this.root }
    );
  };



  // Optional teardown for hosts that mount/unmount the same subtree instead
  // of doing a full page (re)load — see destroyModulesInScope() in boot.js.
  // The click listener is bound to the table and would die with it; the
  // window listener and the observer outlive the subtree unless stopped.
  //
  // The ARIA and the sort controls stay in place, like the roles tabs
  // applies: they describe markup that is still there, and a second init()
  // over the same table reuses the buttons rather than wrapping them again.
  // Three things do go, because each of them is a promise only a running
  // module can keep: the ready flag (the stacked layout it switches on),
  // the two measured offsets (a frozen edge that moved would leave a stale
  // scroll-padding behind) and the status region (a live region nothing
  // writes to any more is one more thing for a screen reader to walk past).
  destroy = () => {
    this.table?.removeEventListener('click', this.handleClick);
    window.removeEventListener('resize', this.requestSync);
    this.resizeObserver?.disconnect();

    this.root.style.removeProperty(this.params.stickyHeadProp);
    this.root.style.removeProperty(this.params.stickyColumnProp);
    this.status?.remove();
    this.status = null;

    this.root.removeAttribute(this.params.readyAttr);
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'dataTable',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new DataTable(el, defaults, reporter);
  return instance.destroy;
}
