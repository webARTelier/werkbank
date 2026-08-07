# dataTable

Makes a plain `<table>` sortable and keeps a wide one usable on a narrow screen:
the column headers become sort controls, the box around the table scrolls (and
is reachable by keyboard while it does), and — where the data asks for it — the
rows read as stacked cards below the `small` breakpoint.

## Files needed to copy
- `dataTable.html` – markup
- `dataTable.scss` – styles (source; compiled to `dist/css/dataTable.min.css`)
- `dataTable.js` – behavior
- `_shared/js/rafThrottle.js` – utility imported by the behavior (copy alongside it)
- `_shared/js/focusableSelector.js` – utility imported by the behavior
- `_shared/js/uniqueId.js` – utility imported by the behavior
- `_shared/js/resolveLocale.js` – utility imported by the behavior
- `_shared/js/formatTemplate.js` – utility imported by the behavior

## Usage

The **scroll box** carries `class="m-dataTable"` and
`data-js-behavior="dataTable"`; the `<table>` goes inside it and stays ordinary
markup — `<thead>`, `<th scope>` and `<caption>` already carry the semantics, so
the component adds no classes and no ARIA to the table itself.

```html
<div class="m-dataTable" data-js-behavior="dataTable">
  <table>
    <caption>Server response times, last 24 hours</caption>
    <thead>
      <tr>
        <th scope="col" data-datatable-sort="text">Region</th>
        <th scope="col" data-datatable-sort="number">Requests</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">Frankfurt</th>
        <td data-datatable-value="128400">128,400</td>
      </tr>
    </tbody>
  </table>
</div>
```

Without the module this is a complete, readable table in a scrolling box. The
sort controls do not exist in the markup — the module builds each one out of the
header label it already found there, so nothing ever promises a behaviour that
has not arrived.

### Sorting

- `data-datatable-sort` on a header cell of the `<thead>` row makes that column
  sortable. The value names the kind of data: `text`, `number` or `date`. An
  empty value lets the module guess — but only between numbers and text, never
  dates (`Date.parse()` accepts a bare number in some engines, which would turn
  a column of years into a column of dates). The guess is re-made **on every
  sort**, exactly like the sort keys, so a column whose cells were replaced (or
  were still empty when the module ran) is sorted by what it holds now. Naming
  the type is still the better markup — it is one DOM pass cheaper per sort and
  it cannot be talked out of by the data.
- `data-datatable-sorted="ascending" | "descending"` on one header cell sorts by
  that column on load.
- A fresh column starts **ascending**; the sorted column **flips**. There is no
  third state that restores the document order.
- Equal values keep their document order — in both directions. An empty cell
  (or one whose value does not parse as what the column claims to hold) always
  sorts **last**, in both directions.
- Rows are sorted **inside each `<tbody>` separately**: several bodies mean
  groups, and sorting across them would dissolve them.
- Rows are **moved, not re-rendered** (one insertion per body), so anything
  inside a cell — a nested module, an open `<details>` — survives a sort.

### Cells that span (the one markup the module turns itself off for)

Both features address a cell by its **position** in its row, so a `colspan`
shifts every cell behind it into the wrong column and a `rowspan` leaves the
rows it reaches into one cell short — sorting would compare another column and
the cards would print another column's label, in both cases without a visible
symptom. So a spanning cell anywhere in a `<tbody>` is **reported, and sorting
and the stacked labels stay off** — the same answer the module already gives for
a spanning cell in the header row. (A `rowspan` could not survive a sort anyway:
rows are moved as whole `<tr>` nodes, which would pull the spanned block apart.)

Two things this deliberately does *not* cover:

- A `<thead>` may still group its columns under a spanning row **above** the row
  that names them — the module takes the *last* `<thead>` row, so that is
  ordinary markup.
- A spanning cell in a `<tfoot>` ("Total" across three columns) costs the table
  nothing: a footer is never sorted. That row simply gets no
  `data-datatable-label`s rather than wrong ones, so in the stacked layout it
  reads as its own card of plain values.

### The value a cell sorts by

Three sources, in this order:

1. `data-datatable-value` on the cell — always **machine readable**: a plain
   number with a dot, or an ISO date. Use it where the visible text is formatted
   for people (`data-datatable-value="128400"` behind `128,400`).
2. A `<time datetime="…">` inside the cell — the platform's own machine-readable
   date, and the better markup for one.
3. The visible text.

Numbers in the **visible text** are read in the page's language: `<html lang>`
decides, via `Intl`, which of `,` and `.` groups and which one separates the
decimals, so `1.284,50` is one value on a German page. A `data-datatable-value`
is never read that way — it is the machine's format by definition.

### Responsive behaviour

Two answers, and they stack:

- **The scroll box** (always on). The table fills the box and only overflows it
  once its columns cannot get any narrower — `--dataTable-cell-min-inline-size`
  is that floor, and it is what makes the box scroll instead of squeezing every
  column into a two-character stack.
- **The stacked layout** (`data-datatable-stacked`, opt-in). Below the `small`
  breakpoint (575px) every row becomes a card of label/value pairs and the
  header row becomes a bar of sort chips — the one part of a table a narrow
  screen wants *more* of, not less. Whether a table has too many columns for a
  phone is a question about your data, which is why the component does not
  decide it for you. A column that offers no sorting has no chip to show, but
  its header cell is only hidden *visually*: an ARIA table maps a body cell to
  its header by position, and a header cell taken out of the accessibility tree
  would make every column after it read under its neighbour's name.

The stacked layout is the only part that waits for the module, because it needs
two things a stylesheet cannot produce: the column label on each cell (CSS can
print an attribute, not read another element's text) and the **explicit table
roles** — Chromium and WebKit both drop the table semantics the moment the cells
stop being table boxes, and writing the role each element already has puts them
back. Both are keyed off `data-datatable-ready`, so a chunk that never arrives
leaves the scrolling table rather than a stack of unlabelled values. Note the
direction: here the ready flag *switches a layout on*, where a pre-enhancement
state is normally *lifted* by it (see [`docs/preEnhancement.md`](../../../docs/preEnhancement.md)).

### Sticky modifiers (pure CSS)

- `m-dataTable--stickyHead` keeps the header row in view. It only does something
  when the box has a height to scroll inside — a sticky cell sticks within its
  own scroll container, not within the page. Set `--dataTable-max-block-size`
  along with it.
- `m-dataTable--stickyColumn` freezes the first cell of every row against the
  inline edge. It copies the row's own colour onto the frozen cell to cover what
  scrolls underneath, so **every row colour has to stay opaque** if you retune
  them.

Both of them cover an edge of the scroll box, and a browser scrolling a focused
control into view knows nothing about that — it parks the control underneath and
a keyboard user is left on something they cannot see (WCAG 2.4.11). The module
measures how deep each frozen edge reaches and writes it to the root as
`--dataTable-sticky-head-block-size` / `--dataTable-sticky-column-inline-size`;
the two modifiers turn those into `scroll-padding`. Nothing to wire — but do not
overwrite the two properties, they are measurements, not settings.

### Configuration (optional)

| Attribute | Where | Meaning |
| --- | --- | --- |
| `data-datatable-sort` | header cell | sortable column; `text` \| `number` \| `date` \| empty (guess) |
| `data-datatable-sorted` | header cell | `ascending` \| `descending` — sort on load |
| `data-datatable-value` | body cell | machine-readable value to sort by |
| `data-datatable-label` | body cell | the label the stacked layout shows; written by the module where you leave it out |
| `data-datatable-stacked` | root | ask for the card layout below `small` |
| `data-datatable-announce` | root | your own template for the sort announcement; `{column}` and `{direction}` are interpolated |
| `aria-label` / `aria-labelledby` | root | name the scroll region yourself instead of letting the `<caption>` name it |
| `tabindex` | root | take focus management over completely; the module then leaves it alone |

The announcement itself ships in German and English, picked from `<html lang>`
(any other language falls back to English) — `data-datatable-announce` is the way
past that for a third language or a different wording.

Colours, spacing, type, the row stripes and every measure of the stacked layout
are the `--dataTable-*` custom properties declared on the root in
`dataTable.scss` — that block is the documented override surface.

## Accessibility

- **Sort state is `aria-sort`** on the header cell, following the ARIA APG
  "Sortable Table" pattern: the control is a real `<button>` inside the
  `columnheader`, so Enter and Space work natively. **Every** sortable column
  carries the attribute — `none` until it is the one the table is sorted by,
  because that attribute is the only thing that separates a sort control from
  any other button in a header cell; without it the feature is invisible to the
  readers least able to guess at it. The direction arrow is a pseudo-element in
  the stylesheet, so what the eye sees and what a screen reader reads cannot
  drift apart, and the arrow is never announced twice.
- **A sort is announced once, politely.** Every row moves while focus stays on
  the button that moved them, and a change to `aria-sort` on the focused
  button's *parent* is not something NVDA or JAWS read out by themselves — so
  the module injects a visually hidden `role="status"` region and writes one
  sentence into it (WCAG 4.1.3). Only on an actual activation: a table that
  arrives sorted from the markup is a resting state, not news.
- **The sort control is the whole header cell.** The cell hands its padding to
  the injected button, which puts the click target at ~34px rather than the
  18px of a bare line of text — clearing WCAG 2.5.8 on its own instead of
  through the spacing exception. Its focus ring is inset (`focus-ring(light,
  -2px)`) so the scroll box cannot clip it at the first or last column.
- **The scroll box becomes a tab stop only while it needs one**: while it
  overflows *and* holds nothing focusable. A sortable table already offers a
  keyboard path through its buttons, and the arrow keys scroll the scroll
  container the focus sits in — the same rule `dialog` applies to its own scroll
  region. A table without controls does get `tabindex="0"`.
- A focusable region needs an accessible name (WCAG 4.1.2). The module borrows
  the table's `<caption>` (adding `role="region"` and `aria-labelledby`); with
  neither a caption nor an author-set name it **reports** the omission rather
  than emitting an unnamed region.
- The focus ring comes from the shared `focus-ring()` mixin (`light` tone) on
  both the box and the sort controls.
- A `forced-colors` block keeps the direction arrow visible when the system
  palette replaces every colour; `prefers-reduced-motion` makes the colour
  changes instant. Sorting itself never animates — a row travelling to its new
  position is a table that cannot be read while it settles.

## Integration

The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying
`data-js-behavior="dataTable"`.

The script writes attributes: `aria-sort` on every sortable header,
`data-datatable-label` on the cells, the explicit table roles,
`tabindex`/`role`/`aria-labelledby` on the scroll box while it is focusable, and
`data-datatable-ready` on the root when it is done. It injects two elements — a
`<button>` per sortable header and the status region — and sets **two custom
properties** on the root, the measured depth of the two frozen edges. Those are
the only things it puts in a `style` attribute, and neither of them paints or
changes a layout, so the `ResizeObserver` cannot be fed by its own writes.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is
used to report a missing `<table>`, a merged or missing header row, a spanning
cell in a `<tbody>`, a header cell that already holds a control, an unknown
attribute value, more than one column asking for the initial sort, and a
focusable scroll box that nothing names.

`init()` returns a cleanup function that removes the `window` resize listener,
disconnects the `ResizeObserver`, drops the ready attribute and the two measured
properties, and removes the status region. The loader only needs this for a host
that mounts/unmounts the same markup repeatedly instead of a full page (re)load
— see `destroyModulesInScope()` in `boot.js`. The sort controls and the ARIA stay
in place; a second `init()` over the same table reuses the buttons rather than
wrapping them again.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
