# lightbox

Image and gallery viewer: a list of links to full-size images, opened in place in a native `<dialog>`.

## Files needed to copy
- `lightbox.html` – markup
- `lightbox.scss` – styles (source; compiled to `dist/css/lightbox.min.css`)
- `lightbox.js` – behavior

No shared utility is needed — the module imports nothing.

## Usage

The gallery is a `<div class="m-lightbox" data-js-module="lightbox">` holding one `<a data-lightbox-item href="…">` per image. Anything else on the page can open the viewer too — see [Opening from a separate control](#opening-from-a-separate-control). That href is the full-size file: it is what the viewer shows, and it is where a reader without this module — or one who middle-clicks, opens in a new tab, or saves the image — still ends up. So the gallery is a working document before the script arrives, which is why the component ships **no pre-enhancement state** (see [`docs/preEnhancement.md`](../../../docs/preEnhancement.md)): the markup renders the same either way, and the viewer does not exist at all until the chunk has loaded.

On the gallery root, all optional:

| Attribute | What it does |
| --- | --- |
| `data-lightbox-loop` | Stepping past an end wraps around. Without it the ends are walls. |
| `data-lightbox-label` | Accessible name of the viewer (default `Image viewer`). |
| `data-lightbox-close-label` | Name of the close control (default `Close image viewer`). |
| `data-lightbox-prev-label` | Name of the "previous" control (default `Previous image`). |
| `data-lightbox-next-label` | Name of the "next" control (default `Next image`). |
| `data-lightbox-counter` | Template of the visible counter (default `{index} / {total}`). |
| `data-lightbox-status` | Template of the announcement (default `Image {index} of {total}, {label}`). |

In both templates `{index}` and `{total}` are the position in the set and `{label}` is the caption or, failing that, the alt text. An empty `{label}` takes the punctuation in front of it with it, so the sentence never ends on a dangling comma.

On each item:

| Attribute | What it does |
| --- | --- |
| `data-lightbox-item` | **Required.** Marks the trigger — an `<a href>` pointing at the full-size image. |
| `data-lightbox-srcset` | Candidate list for the **viewer** image; the `href` stays the fallback. |
| `data-lightbox-sizes` | The `sizes` attribute that goes with it. |
| `data-lightbox-alt` | Text alternative; defaults to the `alt` of the `<img>` inside the link. |
| `data-lightbox-caption` | Caption; defaults to the `<figcaption>` of a `<figure>` the item sits in. |

On a separate opener — a control that is not one of the pictures:

| Attribute | What it does |
| --- | --- |
| `data-lightbox-open` | **Required.** Marks the control. Its value names the gallery by `id`; left empty it means "the gallery I am inside". |
| `data-lightbox-index` | Which image to open, counted from **1** like the counter in the viewer. Defaults to the first. |

**A single image** needs no gallery around it: put `data-js-module="lightbox"` on the link itself and it is the whole set — the viewer then opens without navigation controls and without a counter. Keep `.m-lightbox` on that element or an ancestor, because that is where the custom properties are declared.

**Responsive images** are the platform's job on both sides. The thumbnails carry their own `srcset`/`sizes` (plus `width`/`height`, so the grid reserves the box before the pixels arrive), and the viewer gets its own candidate list from `data-lightbox-srcset`/`data-lightbox-sizes` — the browser picks from it, the module only hands it over. The two neighbours of the current image are preloaded through a detached `Image()` carrying the same `srcset`/`sizes`, so what is warmed is the candidate the viewer will actually ask for. The picture on screen asks for `fetchpriority="high"` and those two for `low`: unranked, the guess about the next press would share the connection with the image the reader is waiting for right now.

**Items may arrive late.** Clicks are handled through delegated listeners — one on the gallery root for the items, one on the document for the openers — and the navigation set is read when the viewer opens, not cached at init. A filtered, paged or lazily rendered gallery therefore works without re-initialising anything, and so does an opener that a CMS or an AJAX teaser puts on the page later.

## Opening from a separate control

Anything can open the viewer, not just the pictures: an icon beside an image, a "see all 12 photos" link, a button in a teaser. Mark it with `data-lightbox-open`, and point it at the gallery in one of two ways:

```html
<!-- inside the gallery: no value, and no id anywhere -->
<div class="m-lightbox" data-js-module="lightbox">
  …
  <a data-lightbox-open href="/media/gallery/harbour-1600.jpg">View all photos</a>
</div>

<!-- anywhere else on the page: name the gallery by id -->
<a data-lightbox-open="gallery-harbour" data-lightbox-index="3"
   href="/media/gallery/waterfall-1600.jpg">Jump to the waterfall</a>
```

The empty form is not just shorthand. On a page built from repeatable content elements — the normal case in a CMS, where an editor can place the same element twice — it is one id fewer that has to stay unique, which is the trap the [project readme](../../../readme.md) warns about.

`data-lightbox-index` is counted from **1**, the way the counter in the viewer counts, so the attribute says what a reader would say ("the third image"). A value that does not name an image of the set — a gallery that has since been filtered, paged or shortened — is reported through the reporter and clamped to the nearest one, rather than obeyed into an empty viewer.

**Author it as an `<a href>`, not as a `<button>`.** A button does nothing until this chunk arrives; a link is a control with a job either way — point it at the image it opens, or at the gallery's own `#fragment`. This is the same rule the items follow, and the reason this component needs no pre-enhancement state at all. Modified and non-primary clicks are left to the browser on openers too, so "open in a new tab" keeps working on them.

The component ships **no styles** for openers: they are your controls, the way `dialog` leaves its triggers to the project. An icon-only opener needs a name of its own — an `aria-label`, or a visually hidden text node inside it — because the module cannot invent one.


## The viewer is injected on `<body>`

The module builds one `<dialog>` per gallery and appends it to `document.body`, deliberately **outside** the gallery's own subtree: an ancestor carrying a `filter`, `backdrop-filter` or `transform` becomes the containing block of a fixed-position element, which would pull the top-layer overlay back into the page box. Three consequences worth knowing:

- **The custom properties are declared twice** — on `.m-lightbox` for the gallery and on `[data-lightbox-ui="viewer"]` for the viewer. An override for the viewer has to name that surface; one on `.m-lightbox` cannot reach it.
- **Every generated node carries `data-lightbox-ui="<part>"`** (`viewer`, `figure`, `stage`, `image`, `bar`, `caption`, `counter`, `close`, `prev`, `next`, `live`, `controlLabel`), and those attributes are the styling hooks — the generated chrome gets no `m-*` classes, the same way `dropdownNav` styles its injected toggles.
- **The language is mirrored.** A `lang` on or above the gallery root is copied onto the dialog, because the viewer would otherwise inherit the document's language while every string in it (the labels, the captions) belongs to the gallery.

It is built eagerly at `init()` — a handful of empty nodes, no request, since the `<img>` has no `src` yet — so its live region is in the document before the first announcement. A live region that is inserted and filled in one go is announced by nobody.

## What the platform does

The viewer is opened with `showModal()`, so the top layer, the focus trap, the inert page behind it, `::backdrop`, `Esc` and the focus handed back to the thumbnail afterwards all come from the browser — the same deal `dialog` and `offCanvasNav` make. A broken image renders its own alt text. What the module adds around that: opening from a thumbnail, stepping through the set, the responsive source handover, the loading state, the announcement and the body scroll lock (`is-scrollLocked`, shared with `dialog`/`offCanvasNav`; released only once no other modal dialog is open, read from the DOM via `dialog[open]:modal`).

**Modified clicks are left alone.** A click with a modifier key, or with anything but the primary button, means "new tab", "download", "copy the address" — and since the href is a real image, all of it works. Taking those presses would break the fallback the component is built on.

**So is a press the viewer cannot fulfil.** Both trigger paths — the thumbnails and the separate openers — work out where the press would land *before* cancelling the navigation, and hand it back to the link if nothing can be shown there: a set that is empty or filtered down to nothing, an item whose `href` has gone, a thumbnail that left the DOM between the press and the query. The case is not theoretical, because items may legitimately arrive late (see above): an opener pressed before the AJAX items are in would otherwise cancel the navigation and open nothing at all, leaving the reader with a dead control while the link underneath it led to the picture.

**Clicking beside the picture closes the viewer** — light dismiss, the gesture `dialog` implements on its backdrop; here it is the `<dialog>` itself, the figure and the letterboxing around the image, i.e. the three boxes that hold no content of their own. A press is only taken as such if it *began* on one of them: `click` is dispatched on the nearest common ancestor of press and release, so dragging a photograph aside — the one gesture a picture invites — would otherwise arrive as a press on the letterboxing and dismiss the viewer mid-gesture.

**Focus restoration needs a target, and a mouse click does not always leave one.** WebKit follows the macOS convention of not focusing a clicked link, so there a viewer opened with the mouse has `<body>` as "the element that had the focus" and the platform's restoration has nowhere to go. The thumbnail is therefore focused before the viewer opens — but only where the click left the focus nowhere, so an engine that focuses what it clicks is untouched. `dialog` and `offCanvasNav` carry the same one-liner.

## Keyboard

| Key | What it does |
| --- | --- |
| `←` / `→` | Previous / next image, following the writing direction (in a right-to-left context the controls swap sides, so the keys swap with them). |
| `Home` / `End` | First / last image — **unless the viewer is itself scrollable** (see below), where the two keys stay with the scroll container. |
| `↑` / `↓`, `PageUp` / `PageDown` | Never taken: they scroll the viewer when there is something to scroll. |
| `Esc` | Closes the viewer (the platform's, not ours). |
| `Tab` | Cycles the viewer's own controls — the native focus trap. |

`Home`/`End` are handed back whenever the `<dialog>` has become a scroll container — at high zoom, or under a caption long enough to push the picture down to its floor. There they are the only way to the top and the bottom of it, while the set can still be walked with the arrows and the controls; keeping them would take away a scroll a keyboard user has no other key for.

Navigation is by controls and keys only: there is no swipe handler, because a half-implemented gesture that fights the browser's own panning is worse than none, and the controls are 44px targets (WCAG 2.5.8) sitting where a thumb reaches them.

## Accessibility

- The viewer follows the ARIA APG modal-dialog pattern, which the native element implements; it carries an accessible name (`data-lightbox-label`) and its controls are named by **real text nodes** rather than `aria-label`, so they still read if this component's stylesheet never arrives — the glyph next to the text is `aria-hidden`, so the text is the only name there is.
- **Every trigger says what it does.** Thumbnails and separate openers alike are given `aria-haspopup="dialog"` and an `aria-controls` pointing at the injected viewer, so a control that opens an overlay announces that before it is pressed. `aria-expanded` is deliberately not part of it: a modal takes over the page rather than expanding a region that belongs to its trigger — the line `dialog` draws too. `init()`'s cleanup function takes both attributes off again, but only on the triggers the module actually wrote them on.
- **The announcement.** Swapping the `src` of an `<img>` inside an open dialog is silent, so a visually hidden `role="status"` region says which image is on screen and what it shows. On the way in it is filled **two frames after `showModal()`**, not before it and not with it: the content of a closed `<dialog>` is not rendered and therefore not in the accessibility tree at all, so text set beforehand is never announced — but text set in the same turn as the opening puts the region's arrival and its content in one accessibility-tree update, which an engine reports as "a new region appeared", i.e. as nothing. The first frame is where the region arrives, the second is where its text is a *change* to something already there. Every later announcement (stepping through the set) is synchronous, the region being established by then. The visible counter is `aria-hidden`: hearing "2 / 6" twice is worse than hearing it once.
- **Text alternatives.** The full-size image inherits the thumbnail's `alt` — same picture, same description. An image with no `alt` attribute at all is reported through the reporter (an unlabelled picture is the one thing an image viewer must not produce, WCAG 1.1.1); an explicitly empty `alt=""` is left alone, because that is an author saying "decorative" and it is theirs to say.
- **The ends of a non-looping gallery** are marked `aria-disabled="true"`, never `[disabled]`: a control that becomes `[disabled]` while it has the focus drops it to `<body>`, and the reader's next `Tab` would start over at the top of the page. The control keeps its place, its name and its tab stop; it simply has nowhere to go. Its name never changes either, so a voice-control user's word for it keeps working.
- The loading spinner is a pseudo-element, so it adds nothing to the accessibility tree — the live region already says where the reader is.
- **In a forced-colors context** (the Windows contrast themes) two states are said again in system colours, because both carry their meaning in a colour difference that the forcing would flatten: the end of a non-looping gallery (a dimmed glyph, repainted in `GrayText` — otherwise a wall looks exactly like a way on) and the loading spinner, whose leading edge becomes `Highlight` so the ring keeps an edge that visibly turns instead of being an even circle.

## Styling

The gallery's grid (`.m-lightbox__grid`) is `auto-fill` rather than a breakpoint list: it drops a column whenever a thumbnail would fall below `--lightbox-thumb-min`. Thumbnails are cropped to `--lightbox-thumb-ratio` via `object-fit`, which keeps the grid's rhythm whatever the sources are — set the ratio to `auto` for a gallery that should keep every image's own proportions. None of the gallery CSS is required for the behaviour: a project with its own layout keeps it and only marks the links.

The open/close animation is a pure CSS enhancement (`@starting-style` + `allow-discrete`) and `prefers-reduced-motion` is respected (including the spinner, which then holds still). Opening and closing are timed **separately** for the reason spelled out in `dialog`'s readme: the shared `--an-ease` is an ease-*out*, which an entrance wants and an exit turns into a snap. Mechanically that needs two rules, because a transition always runs with the timing declared in the state it animates *to*. The closing animation depends on the `overlay` property to keep the dialog in the top layer while it fades — currently Chromium-only, so elsewhere the close is instant while the open still animates. That is the intended fallback, not a bug to work around.

While an image is loading, the viewer carries `is-loading`: the picture is held back (an `<img>` whose `src` has just changed paints as an empty box first, and on a reopen it would still show the previous image) and the stage shows a spinner. The class is removed on `load` **and** on `error`, so a broken image ends up showing its alt text rather than a spinner that never stops.

The image keeps its `src` on close on purpose: the closing animation holds the dialog in the top layer while it fades, and clearing the source there would blank the picture halfway through its own exit.

**The picture has a floor.** The figure splits into a `1fr` stage and an `auto` bar, so a long caption takes room *from* the image rather than pushing it out of the viewport — but only down to `--lightbox-stage-min-size`. Without that floor the arithmetic runs all the way to zero: at 400 % zoom (a 320×256 viewport, the reflow case of WCAG 1.4.10) four caption lines left a 0×0 picture that no scroll position could bring back. Past the floor the two rows no longer fit and overflow the figure, which the `<dialog>` scrolls — deliberately the dialog and not the bar, because a scroll container holding no focusable element is one a keyboard user cannot scroll. Ordinary viewports are untouched by it: the floor only ever binds where the caption would otherwise have won.

**The three controls are the one part of this component that sits on arbitrary user media** rather than on a surface of the theme, so they are built the way `video` builds its play button: a darkened disc (`--lightbox-control-bg-color`, a scrim anchored to plain black — an overlay token that *brightens*, as overlays usually do, is exactly what disappears over a light photograph), a light ring around it and a light glyph inside. The ring is `currentColor`, mirroring the `stroke="currentColor"` of those SVGs, so it follows the glyph through hover and the `aria-disabled` state and the two cannot drift apart. The pairing is what keeps the control readable over *any* picture: the disc carries the boundary over a light one, the ring over a dark one, and the glyph only ever sees the disc (WCAG 1.4.11). Hover deepens the disc instead of brightening it, for the same reason.

Keyboard focus uses the shared `focus-ring()` mixin (`light` tone) on the thumbnails and on the three controls — on the controls with a **negative offset**, so the ring is drawn on the control's own disc. Outside it the ring would lie on the photograph, where a 2px line has no background it can rely on (`sky-400` is 2.1:1 over a white one). `adaptiveScrollFade` pulls its ring inwards for the same reason, there because a mask would clip it.

The control glyphs are inline SVGs copied from `src/_shared/media/img/icons/` (`close.svg`, `chevronLeft.svg`, `chevronRight.svg` — the canonical sources); they are embedded rather than `<img>`-referenced so `stroke="currentColor"` follows the button colour and its hover state.

See `lightbox.html` for a ready-to-copy snippet.

## Integration

The JS exports `init(el, services)` and does not self-initialize. It is loaded on demand by `boot.js` for every element carrying `data-js-module="lightbox"` — one viewer per gallery. (Unlike a global system, nothing runs on pages that have no gallery.)

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is only used for warnings (a gallery with no items, an item without an `href`, an image without a text alternative, an image that failed to load). Without it the module degrades silently.

`init()` returns a cleanup function that closes the viewer (running the close teardown, so the page cannot stay scroll-locked), removes both delegated listeners, hands the triggers back without the ARIA it wrote on them, and takes the injected `<dialog>` off `<body>` again. The loader only needs this for a host that mounts/unmounts the same markup repeatedly instead of a full page (re)load — see `destroyModulesInScope()` in `boot.js`.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`). The example images come from `picsum.photos` at several widths per photo, so the `srcset`/`sizes` lists are real rather than illustrative.
