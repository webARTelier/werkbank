# dev_dashboard

One bar along the bottom edge of the page that answers the questions you ask
a page over and over while building it: **what viewport am I in, what did I
break accessibility-wise, what is pushing that horizontal scrollbar, how do I
get this URL onto a phone, which `sizes`/`srcset` do these images need, and do
I really have to type a name and an address into this form again?**

Six tools in one file: five have an icon in the bar, the sixth — the page
information — is read out in it permanently. The ones that watch the page carry
a green or red mark on their icon, and every tool that needs room to be read or
operated opens a panel above the bar.

## Load it

```html
<script src="dev_dashboard.js"></script>
```

One line, during development only. No stylesheet, no build, no dependency, no
module: it is a classic script, so it also runs from `file://`, out of a
console paste and as a bookmarklet. All of its own UI lives in a shadow root
with `all: initial` — the page cannot style it and it does not style the page.

It registers itself as `window.__devTools.dashboard` with `open()`, `close()`,
`destroy()`, `collapse()`, `expand()` and `show(id)`, plus one object per tool
(`a11y`, `overflow`, `srcset`, `form`, `qr`). Loading it twice re-opens the copy
that is already there instead of stacking a second one on top of it.

## Mark up

**Nothing.** The srcset measurement used to want an attribute on every image;
it is pointed at them by clicking now — see *Pick the images* below. The form
filler finds its forms by itself.

The srcset attribute still works as a **pre-selection**, for a page you measure
over and over:

```html
<img data-dev-srcset src="…">                    <!-- without label -->
<img data-dev-srcset="hero, full bleed" src="…"> <!-- with label -->
```

Marked images join the selection shortly after `load`, with the value as their
label; without a value the file name is the label. Pre-select one image per
distinct layout behaviour: four tiles of equal width are one measurement, not
four.

The form filler takes an attribute too, and there it steers rather than
selects — `data-dev-form="skip"` keeps a field (or everything inside an
element) out, anything else forces what is written. See *Fill a form* below.

The page information expects four custom properties — `--viewportName`,
`--navstate`, `--density`, `--input` — which this project declares on `:root`
in `shared.min.css`. A page that does not declare one shows an amber `?` in
its place, with the property name in the tooltip. Nothing else is expected.

## Operate it

| Icon | Tool | What a click does |
| ---- | ---- | ----------------- |
| — | page information | Nothing to click: viewport size and the four tokens are read out permanently, live on resize. |
| ♿ | a11y inspector | Opens the list of findings. **Green mark** = nothing found, **red mark with a count** = that many findings. |
| ↔ | horizontal overflow | Opens the list of elements wider than the document, widest first. Same green/red mark, measured again on every resize. |
| ▦ | QR code | Shows a QR code of the current URL, encoded in the page itself. |
| 🖼 | srcset measurement | Opens the panel: the selected images, the sweep range, the results. **pick images** hands the page over for clicking; **measure** sweeps the viewport range in a probe frame and reports `sizes` and `srcset`. |
| 📝 | form filler | Opens the list of forms. **fill** writes Gandalf the Grey into one of them, **fill all** into all, **reset** takes it back. The mark counts the fields that were written — **green**, or **red with the number the browser still rejects**. |

The icons in the bar are inline SVG; the glyphs above only stand in for them
here. Every one carries its tool's name as `title` and `aria-label`, and the
three that keep a count put their result into that name as well.

**Everything that reacts to a click says so under the cursor.** Every icon and
every button in the bar and in the panels lightens on hover, and the ones that
already carry a state keep that state's colour while doing it: the open tool
and the active unit of the srcset toggle deepen their blue, a pressed **mark in
page** deepens its red, and the **✕** that removes the dashboard turns red,
because it is the one control that cannot be undone. A disabled button
(**measure** with nothing selected) stays put, and a row that is only a note —
not a clickable finding — does not light up.

- **A click on a row** in the a11y, overflow or form list scrolls that element
  into view and flashes it. **mark in page** outlines every finding — or, in the
  form filler, every field that was written — at once; it is off to begin with,
  it is taken back when you press it again, when the panel is closed and when
  the dashboard is removed.
- **Scans run once, shortly after `load`**, and again whenever you press
  **scan again** (the overflow list additionally on every resize). So the
  marks can go stale after the page changes under you — that is what the
  button is for.
- **Closing a panel takes that tool's marks out of the page** — but not what
  the form filler wrote. That is a change to the page, not a marker, and only
  **reset** undoes it.
- <kbd>Esc</kbd> closes the open panel, or aborts a running sweep.
- The **chevron** folds the bar down to a thin strip, which is how you look at
  something the bar would otherwise sit in front of; the state is remembered
  in `localStorage`. The **✕** removes the dashboard from the page entirely.
- The console keeps its part: every scan logs its findings with **live element
  references**, which a panel can never offer, and every `focusin` logs the
  element that took focus.

## Pick the images

**pick images** in the srcset panel hands the page over to the mouse. The panel
folds away so nothing is covered, the cursor becomes a crosshair, and a bar
above the dashboard counts what you have:

- **Click an image to select it, click it again to drop it.** As many as you
  like — that is the point. Each one gets a numbered badge above its top-left
  corner and a blue outline; the one under the cursor is outlined amber.
- **The click never reaches the page.** A linked image does not navigate, a
  slider does not slide. The page has the click back the moment picking ends.
- **Click anything, not only an `<img>`.** A click lands on the nearest
  `img`/`video`/`canvas`/`svg`; a click on a box that holds exactly one of them
  takes that one; anything else is measured as itself — which is how you
  measure the container of a CSS background image.
- **The label is read off the element**: the `data-dev-srcset` value where
  there is one, otherwise the file name, otherwise the `alt` text — which is
  what makes an image URL without a file name (`…/id/1015/600/400`) still
  readable in the results.
- <kbd>Esc</kbd> or **done** ends picking and opens the panel on the selection.
  Each row scrolls its image into view on a click and drops it on the ✕;
  **clear** empties the whole list. The selection survives all of that — only
  a reload forgets it.

**The selection is remembered as a CSS path**, because the sweep measures a
fresh copy of the page in the probe frame rather than the elements you clicked.
A path is `body > main > section:nth-of-type(5) > div > img`, anchored on the
nearest unique `id` where there is one. Elements the probe's own load puts
somewhere else — created by an interaction, moved by a script — are reported as
not found instead of being measured wrong.

From the console the same thing without the mouse:
`__devTools.dashboard.srcset.pick()` starts picking and `.done()` ends it,
`.select(el)` toggles one element, `.selected()` lists what is in, `.clear()`
empties it, and `.measure()` runs the sweep — or starts picking, if there is
nothing to sweep yet.

## Fill a form

**fill** writes **Gandalf the Grey** into one form, **fill all** into every form
on the page, and **reset** puts each field back exactly as it was — the value,
the checked state, which options were selected and the file list are all
remembered before the first character is written. Fields that no
`<form>` element owns are collected under one entry of their own, which is what
a component demo usually looks like.

Why Gandalf: **the entry has to be recognisable as a test entry at a glance** —
in the field, in a database row, in the mail that lands in somebody's inbox
three weeks later. `Max Mustermann` reads like a customer; `Gandalf the Grey`
does not. Nothing that could reach a real person is used either: the mail
domain is `aman.ea`, a TLD the root zone does not assign, so nothing can be
registered under it; the card is the universal `4111 1111 1111 1111` test
number, and the IBAN is a bank code nobody holds with **computed check
digits**, so a validator accepts it and no account exists behind it.

### What lands where

| Field | Value |
| ----- | ----- |
| name | **Gandalf** · **the Grey**, with **Olórin** as the middle name |
| nickname, username | Mithrandir, `mithrandir` |
| e-mail | `mithrandir@aman.ea` |
| phone | `+49 1954 1955` — the years the three volumes appeared |
| website | `https://you-shall-not-pass.aman.ea` |
| address | Mithlond Quay 3 · 03019 Grey Havens · Lindon · Middle-earth |
| birthday | `1000-09-22` — the Istari land in Middle-earth in T.A. 1000, and the 22nd of September is the birthday in the Shire |
| company, position | The Fellowship of the Ring · Servant of the Secret Fire |
| password | `Mellon-Speak-Friend-3019!` |
| subject, message | *Concerning a certain ring* · "All we have to decide is what to do with the time that is given us.", followed by a line saying it is a test entry |
| bank | `DE45 3019 0000 3019 1954 00` · `SHIRDEFFXXX` · Michel Delving Savings |
| card | `4111 1111 1111 1111` · 12/30 · 319 |
| language, colour | Westron · `#8b8b8b`, which is the whole of his name |
| a date in a plain text field | `22.09.1000`, or `09/22/1000` — a `TT.MM.JJJJ` / `MM/DD/YYYY` placeholder is read as the mask and decides the order and the separator |
| PIN, coupon code | `3019` · `MELLON` — the password of the Doors of Durin makes a good voucher |
| number, range | `3`, a `1` where the field reads as a count, `19.54` where it reads as money, the middle of a range |
| file | `the-red-book-of-westmarch.txt`, or Gandalf's rune as a 64×64 PNG, JPEG, WebP or SVG where `accept` asks for an image |

The Third Age is in there twice, in the two places a number had to be invented:
`03019` is the year of the War of the Ring as a postcode, and the account
number is that year followed by 1954.

### How a field is recognised

The rules are tried in a fixed order and the first hit wins. Each rule matches
on the **`type`**, on an **`autocomplete`** token, or on the **words** — the
`name`, `id`, `placeholder`, `aria-label`, the `<label>` text and the enclosing
`<legend>`, in English and German. The strongest signals sit at the top of the
list, so a `type="email"` field called `firstname` still gets the address, and
an `autocomplete="family-name"` beats a name nobody can parse. Anything left
over is decided by its type: a `<textarea>` gets the message, a `date` the
birthday, everything else the plain name.

The `placeholder` counts as one of the words, which is what lets a plain text
field asking for `TT.MM.JJJJ` be recognised as a date at all. Keep an
annotation like *"number, no step given"* **out of the `<label>`** — the filler
reads the label, so a stray word in it steers the value. The demo page puts its
notes in a `<small>` under the field for exactly that reason.

Two attributes steer it from the markup:

```html
<input name="intern" data-dev-form="skip">        <!-- leave alone -->
<fieldset data-dev-form="skip"> … </fieldset>     <!-- and everything inside -->
<input name="codewort" data-dev-form="nickname">  <!-- force a kind -->
<input name="losung" data-dev-form="Mellon">      <!-- write this, literally -->
```

Anything that is not one of the known kinds is written as it stands, and the
panel reports it as `literal`.

### What it does with the things that are not text

- **Checkboxes** — one per group, plus every `required` one and everything that
  reads like a consent (`agree`, `datenschutz`, `terms`, `agb`, …). The rest are
  listed as left alone, with the reason.
- **Radios** — the first of the group, unless the group's `name` or `<legend>`
  says salutation or gender, in which case the male option wins.
- **Selects** — the first real option, skipping a `bitte wählen` placeholder; a
  country select gets Deutschland (Middle-earth is rarely on offer), a
  salutation select gets Herr. A `multiple` select gets the first two.
- **File inputs** — it *builds* the file. `accept` decides which: the Red Book
  as `.txt`, or Gandalf's rune drawn on a canvas and handed over as a real PNG,
  JPEG or WebP; `multiple` gets two. An `accept` nothing can be built for is
  reported, not silently skipped.
- **`readonly`, `disabled` and `type="hidden"`** are never touched, and the
  first two are listed with the reason.

### What the panel tells you afterwards

Every field it touched, with the kind it decided on and the value that went in —
and, where the field pushed back, what happened to it. **A `maxlength` cuts the
value** (with an `…` on the end), **a `min`/`max` moves it**, and a
`type="number"` that names no `step` still takes whole numbers only, so `19.54`
arrives as `20` — each of the three says so in its row. After writing, the
browser's own verdict is read off `validity`, so a `pattern` the value does not
match shows up immediately in amber instead of at the moment you press submit.

**Nothing is submitted** — the submit button stays yours to press. And every
field it writes gets an `input` and a `change` event through the **native value
setter**, so a character counter, an auto-growing textarea or a validator sees
the value the same way it sees a keystroke.

From the console: `__devTools.dashboard.form.fill()` fills every form,
`.fill(2)` the second one, `.fill('#contactForm')` or `.fill(el)` a named one,
and `.reset()` mirrors all of that. `.mark(true)` outlines what was filled,
`.records()` hands back the log with live element references, `.forms()` lists
what it found, and **`.data` is the Gandalf object itself** — write to it and
the next fill uses your value.

## What it reports

**a11y inspector** — tables without `th`/`caption`, `<svg>` without
title/desc/role/aria-hidden, `<img>` with no `alt` attribute, icon elements
without `aria-hidden`/`role`, form controls without a label, buttons and links
with no accessible name, empty headings, a missing `<main>`, a positive
`tabindex`. A decorative `alt=""` and an image-only link named by its `alt`
text are deliberately **not** findings.

**horizontal overflow** — every element whose `offsetWidth` is larger than the
document's, with the excess in px. An ancestor usually shows up next to the
child that stretches it; the innermost row is the one to look at.

**QR code** — the current URL at error correction level M, versions 1–19
(up to 624 characters). Generated in the page: no request leaves the browser,
which is what keeps the dashboard free of third parties.

**srcset measurement** — per selected image: the measured progression (viewport
range → render width → DPR → physical px), the `sizes` attribute in px or vw,
the `srcset` widths to generate, and the whole `<img>` to paste. The
recommendation is deliberately terse — at most 4 media conditions and 6
widths, rounded up and capped at 3840px.

**form filler** — per form: every control it found, what it wrote, what it left
alone and why, and what the browser still rejects. See *Fill a form* above.

## Limits

- **The a11y check is a heuristic on the DOM, not an audit.** It knows nothing
  about contrast, focus order, reading order, or ARIA that is syntactically
  fine but wrong. Use axe or a screen reader for the verdict; use this for the
  pass before that, while writing the markup.
- **The srcset measurement needs a local server.** It runs in a same-origin
  `<iframe>`, which `file://` and an `X-Frame-Options` / `frame-ancestors`
  header both rule out. Both cases are reported in the panel.
- **The form filler is the one tool that changes the page for real.**
  Everything else marks, measures or reads; this one writes values a submit
  would send. So it is never automatic — nothing is filled until you press a
  button — it never submits, and **reset** is the way back, per form or for all
  of them. Reload and the memory of what was there before is gone with it.
- **It knows nothing about a rich-text editor.** `contenteditable`, a canvas
  signature pad and a component that keeps its value somewhere other than an
  `<input>` are all invisible to it. So is a field that only exists after an
  interaction: **scan again** is what picks those up.
- **It measures the layout as it is now.** A container you change afterwards
  invalidates the result, and images that only appear after interaction are
  measured in whatever state a fresh load puts them in.
- **The bar reserves its own height in the page.** A `div` with
  `data-dev-dashboard-spacer` is appended to `<body>` so nothing in the flow
  ends up underneath the bar. Elements the page positions `fixed` at the
  bottom edge are not moved by that — fold the bar away to look at those.
- **Below 640px the bar is two rows**, both centred: the icons on top, the
  page information underneath, each on one line. Side by side they would both
  be squeezed and the read-out would break mid-token. The reserved height
  follows — it is measured off the bar, not assumed. Folded away it is the
  same thin strip as everywhere, with the chevron at the right edge.
- **What it writes into the page**, all of it reversible and all of it found
  by `grep data-dev-`: that spacer, one `<style data-dev-dashboard-style>`,
  and — only while you ask for it — `data-dev-dashboard-flag` /
  `data-dev-dashboard-focus` on the elements it points at,
  `data-dev-dashboard-pick` on the selected images while the srcset panel is
  open or you are picking, `data-dev-dashboard-hover` on the one under the
  cursor, `data-dev-dashboard-fill` on the fields the form filler wrote while
  **mark in page** is pressed, and `data-dev-dashboard-picking` on `<html>` for
  the crosshair. `destroy()` takes every one of them back — the **values** the
  form filler wrote are the one thing it does not take back, because they are
  not a marker. Press **reset all** first.
- **A developer's accessibility bar, and stated as such**: real buttons,
  <kbd>Esc</kbd>, `aria-pressed`/`aria-expanded`, focus rings — but no ARIA
  patterns, no live regions, no reduced-motion audit.
