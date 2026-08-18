# dev_dashboard

One bar along the bottom edge of the page that answers the questions you ask
a page over and over while building it: **what viewport am I in, what did I
break accessibility-wise, what is pushing that horizontal scrollbar, how do I
get this URL onto a phone, and which `sizes`/`srcset` do these images need?**

Five tools in one file: four have an icon in the bar, the fifth — the page
information — is read out in it permanently. The two that watch the page carry
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
(`a11y`, `overflow`, `srcset`, `qr`). Loading it twice re-opens the copy that
is already there instead of stacking a second one on top of it.

## Mark up

Only the srcset measurement needs anything in the markup:

```html
<img data-dev-srcset src="…">                    <!-- without label -->
<img data-dev-srcset="hero, full bleed" src="…"> <!-- with label -->
```

The label is the heading the image appears under in the results. Mark one
image per distinct layout behaviour: four tiles of equal width are one
measurement, not four.

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
| 🖼 | srcset measurement | Opens the panel; **measure** sweeps the viewport range in a probe frame and reports `sizes` and `srcset`. |

The icons in the bar are inline SVG; the glyphs above only stand in for them
here. Every one carries its tool's name as `title` and `aria-label`, and the
two that scan put their result into that name as well.

- **A click on a row** in the a11y or overflow list scrolls that element into
  view and flashes it. **mark in page** outlines every finding at once; it is
  off to begin with, it is taken back when you press it again, when the panel
  is closed and when the dashboard is removed.
- **Scans run once, shortly after `load`**, and again whenever you press
  **scan again** (the overflow list additionally on every resize). So the
  marks can go stale after the page changes under you — that is what the
  button is for.
- <kbd>Esc</kbd> closes the open panel, or aborts a running sweep.
- The **chevron** folds the bar down to a thin strip, which is how you look at
  something the bar would otherwise sit in front of; the state is remembered
  in `localStorage`. The **✕** removes the dashboard from the page entirely.
- The console keeps its part: every scan logs its findings with **live element
  references**, which a panel can never offer, and every `focusin` logs the
  element that took focus.

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

**srcset measurement** — per marked image: the measured progression (viewport
range → render width → DPR → physical px), the `sizes` attribute in px or vw,
the `srcset` widths to generate, and the whole `<img>` to paste. The
recommendation is deliberately terse — at most 4 media conditions and 6
widths, rounded up and capped at 3840px.

## Limits

- **The a11y check is a heuristic on the DOM, not an audit.** It knows nothing
  about contrast, focus order, reading order, or ARIA that is syntactically
  fine but wrong. Use axe or a screen reader for the verdict; use this for the
  pass before that, while writing the markup.
- **The srcset measurement needs a local server.** It runs in a same-origin
  `<iframe>`, which `file://` and an `X-Frame-Options` / `frame-ancestors`
  header both rule out. Both cases are reported in the panel.
- **It measures the layout as it is now.** A container you change afterwards
  invalidates the result, and images that only appear after interaction are
  measured in whatever state a fresh load puts them in.
- **The bar reserves its own height in the page.** A `div` with
  `data-dev-dashboard-spacer` is appended to `<body>` so nothing in the flow
  ends up underneath the bar. Elements the page positions `fixed` at the
  bottom edge are not moved by that — fold the bar away to look at those.
- **What it writes into the page**, all of it reversible and all of it found
  by `grep data-dev-`: that spacer, one `<style data-dev-dashboard-style>`,
  and — only while you ask for it — `data-dev-dashboard-flag` /
  `data-dev-dashboard-focus` on the elements it points at. `destroy()` takes
  every one of them back.
- **A developer's accessibility bar, and stated as such**: real buttons,
  <kbd>Esc</kbd>, `aria-pressed`/`aria-expanded`, focus rings — but no ARIA
  patterns, no live regions, no reduced-motion audit.
