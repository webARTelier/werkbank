/**
 * lightbox.js
 * ----------------------------------------------------------------------------
 * Progressive-enhancement controller for an image gallery: the page holds
 * ordinary links to the full-size images, and this module turns them into an
 * overlay viewer that steps through the set in place — the one thing a
 * gallery wants that the platform has no element for.
 *
 * What works without this script
 * ------------------------------
 * Every item is an <a href> pointing at its own full-size image, so the
 * gallery is a set of links that open those images. That is a working
 * document rather than a degraded one: the picture is reachable, its URL can
 * be shared, "open in a new tab" and "save image as" do what they say.
 * Nothing is ever hidden behind a control this script has to deliver first,
 * which is why the component ships no pre-enhancement state (see
 * docs/preEnhancement.md): before the chunk arrives the gallery already
 * looks the way it will look afterwards, and the viewer does not exist at
 * all.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * The viewer is a native <dialog> opened with showModal(), so the top layer,
 * the focus trap, the inert page behind it, ::backdrop, the Escape key and
 * the focus handed back to the thumbnail afterwards all come from the
 * browser — the same deal dialog and offCanvasNav make. Choosing which
 * candidate of a responsive image to download is the platform's job too: the
 * viewer <img> is handed srcset/sizes and the browser decides. The
 * open/close animation is CSS alone (@starting-style + allow-discrete), and
 * a broken image renders its own alt text. This module sizes nothing, styles
 * nothing and writes no inline styles.
 *
 * What this script adds
 * ---------------------
 * 1. The viewer. One <dialog> per gallery, built at init and appended to
 *    <body> — deliberately outside the gallery's own subtree, because an
 *    ancestor carrying a filter / backdrop-filter / transform becomes the
 *    containing block of a fixed-position element and would pull the
 *    top-layer overlay back into the page box. It is built eagerly (a
 *    handful of empty nodes, no request: the <img> has no src yet) so its
 *    live region is in the document before the first announcement — a live
 *    region that is inserted and filled in one go is announced by nobody.
 * 2. Opening from a thumbnail. One delegated listener on the gallery root,
 *    so an item rendered later — a filtered gallery, an AJAX page, a
 *    framework re-render — opens the viewer too. Modified and non-primary
 *    presses are left to the browser: they mean "new tab", "download",
 *    "copy the address", and the href is a real image URL, so all of it
 *    works. Taking those presses would break the very fallback the
 *    component is built on. So is a press the viewer cannot fulfil — a set
 *    that is empty or filtered down to nothing, an item without an href:
 *    the press stays with the link underneath it rather than being
 *    swallowed by a viewer that never opens (see takePress).
 * 3. Opening from a control that is not one of the images: an icon beside a
 *    picture, a "see all 12 photos" link, a button in a teaser. It carries
 *    data-lightbox-open and may sit anywhere on the page — hence a second
 *    delegated listener, this one on the document, the way dialog reaches its
 *    triggers. Naming the gallery by id is one of the two ways to point at
 *    it; an empty value means "the gallery I am inside", which needs no id at
 *    all (see ownsOpener). data-lightbox-index picks the image to start at,
 *    counted from 1 like the counter the reader sees. Such a control is
 *    better authored as an <a href> than as a <button>, for the same reason
 *    the items are links: a button does nothing until this chunk arrives,
 *    while a link to the image — or to the gallery's own fragment — is a
 *    control with a job either way.
 * 4. Stepping through the set. The injected controls, ArrowLeft/ArrowRight
 *    (which follow the writing direction, because the controls do) and
 *    Home/End — those two only while the viewer is not itself scrollable,
 *    because there they are the only way to its own ends (see keyTarget).
 *    The ends of a non-looping gallery are marked aria-disabled
 *    rather than [disabled]: a control that becomes [disabled] under the
 *    focus drops it to <body>, and the next Tab would start over at the top
 *    of the page. data-lightbox-loop opts into wrapping around instead.
 * 5. What the viewer shows. The full-size source (plus srcset/sizes for a
 *    responsive candidate set), the text alternative, the caption, the
 *    position counter — and, while the current image is still loading, a
 *    state class the stylesheet turns into a spinner. The two neighbours
 *    are preloaded, since they are one press away.
 * 6. The announcement. Swapping the src of an <img> inside an open dialog is
 *    silent, so a visually hidden live region says which image is on screen
 *    and what it shows.
 * 7. The ARIA of the triggers. Both kinds get aria-haspopup="dialog" and an
 *    aria-controls pointing at the viewer, so a control that opens an overlay
 *    says so before it is pressed.
 * 8. The body scroll lock. A modal dialog makes the page behind it inert but
 *    does not stop it from scrolling, so a body class does (is-scrollLocked,
 *    shared with dialog and offCanvasNav).
 *
 * Accessibility
 * -------------
 * The viewer follows the ARIA APG modal-dialog pattern, which the native
 * element implements for us; it carries an accessible name
 * (data-lightbox-label) and its controls are named by real text nodes rather
 * than aria-label, so they still read if this component's stylesheet never
 * arrives — the glyph next to the text is aria-hidden, so the text is the
 * only name there is. The full-size image inherits the thumbnail's alt text
 * (an image with no alt attribute at all is reported: an unlabelled picture
 * is the one thing an image viewer must not produce, WCAG 1.1.1), while an
 * explicitly empty alt is left alone — that is an author saying
 * "decorative". The visible counter is aria-hidden because the live region
 * says the same thing in a sentence, and hearing "2 / 6" twice is worse than
 * hearing it once. The controls are 44px touch targets (WCAG 2.5.8) and keep
 * their name in every state, so a voice-control user's word for them never
 * changes. Escape, the focus trap and the focus returning to the trigger are
 * the platform's. Every trigger — thumbnail or separate opener — is given
 * aria-haspopup="dialog" and an aria-controls pointing at the viewer;
 * aria-expanded is deliberately not part of it, because a modal takes over
 * the page rather than expanding a region that belongs to its trigger. An
 * icon-only opener still needs a name of its own: the module cannot invent
 * one, and it is the author's markup.
 *
 * Configuration
 * -------------
 * On the root (data-js-behavior="lightbox"):
 * - data-lightbox-loop            navigation wraps around at both ends
 *                                 instead of stopping (optional)
 * - data-lightbox-label           accessible name of the viewer
 *                                 (default: "Image viewer")
 * - data-lightbox-close-label     name of the close control
 * - data-lightbox-prev-label      name of the "previous" control
 * - data-lightbox-next-label      name of the "next" control
 * - data-lightbox-counter         template of the visible counter
 *                                 (default: "{index} / {total}")
 * - data-lightbox-status          template of the announcement
 *                                 (default: "Image {index} of {total},
 *                                 {label}" — {label} is the caption or the
 *                                 alt text, and an empty one takes its
 *                                 separator with it)
 *
 * On each item (markup contract):
 * - data-lightbox-item            required; the trigger. An <a href> whose
 *                                 target is the full-size image. The module
 *                                 may also sit on a single item directly,
 *                                 which then is the whole set.
 * - data-lightbox-srcset          candidate list for the viewer image
 *                                 (optional)
 * - data-lightbox-sizes           the sizes attribute that goes with it
 *                                 (optional)
 * - data-lightbox-alt             text alternative; defaults to the alt of
 *                                 the <img> inside the item (optional)
 * - data-lightbox-caption         caption; defaults to the <figcaption> of a
 *                                 <figure> the item sits in (optional)
 *
 * On a separate opener (anywhere on the page):
 * - data-lightbox-open            required; the value names the gallery by
 *                                 id. Left empty it means the gallery the
 *                                 opener sits inside, which needs no id.
 * - data-lightbox-index           which image to open, counted from 1;
 *                                 defaults to the first (optional)
 * ----------------------------------------------------------------------------
 */



const defaults = {

  // The trigger of one image: an <a href> pointing at the full-size file,
  // which is what a reader without this module gets. Queried inside the
  // root, and matched against the root itself for a single image that
  // carries the module on the link.
  itemAttr: 'data-lightbox-item',

  // Per-item overrides, all optional and all read off that link.
  srcsetAttr: 'data-lightbox-srcset',
  sizesAttr: 'data-lightbox-sizes',
  altAttr: 'data-lightbox-alt',
  captionAttr: 'data-lightbox-caption',

  // A control that opens the viewer without being one of the images: an
  // icon next to a picture, a "see all 12 photos" link, a button in a
  // teaser. Its value names the gallery by id; left empty it means "the
  // gallery I am inside" (see ownsOpener).
  openAttr: 'data-lightbox-open',

  // Which image such a control opens, counted from 1 the way the counter in
  // the viewer counts. Optional — without it the viewer opens at the first.
  openIndexAttr: 'data-lightbox-index',

  // Presence on the root: stepping past an end wraps around to the other
  // one. Without it the ends are walls, and the controls say so.
  loopAttr: 'data-lightbox-loop',

  // The strings of the injected chrome. Every one of them is an attribute on
  // the root plus a default below, because the chrome is generated: there is
  // no markup for a project to write them into.
  labelAttr: 'data-lightbox-label',
  closeLabelAttr: 'data-lightbox-close-label',
  prevLabelAttr: 'data-lightbox-prev-label',
  nextLabelAttr: 'data-lightbox-next-label',
  counterAttr: 'data-lightbox-counter',
  statusAttr: 'data-lightbox-status',

  label: 'Image viewer',
  closeLabel: 'Close image viewer',
  prevLabel: 'Previous image',
  nextLabel: 'Next image',
  counterTemplate: '{index} / {total}',
  statusTemplate: 'Image {index} of {total}, {label}',

  // Marker on every node this module injects; its value names the part
  // ('viewer', 'image', 'prev', …) and it is the styling hook the
  // stylesheet uses — the generated chrome carries no m-* classes, the same
  // way dropdownNav styles its injected toggles through
  // [data-dropdownnav-toggle]. It also makes the markup readable in the
  // inspector.
  uiAttr: 'data-lightbox-ui',

  // Prefix for the generated viewer id, which the triggers' aria-controls
  // points at.
  viewerIdPrefix: 'lightbox-viewer',

  // State class on the viewer while the current image has not arrived yet.
  loadingClass: 'is-loading',

  // Body class toggled while the viewer (or any other modal dialog) is open.
  scrollLockClass: 'is-scrollLocked',
};



// The control glyphs, inlined from src/_shared/media/img/icons/ (the
// canonical sources: close.svg, chevronLeft.svg, chevronRight.svg). Embedded
// rather than <img>-referenced so stroke="currentColor" follows the button's
// own colour and its hover state, and aria-hidden because the text node next
// to the glyph is what names the control. width/height are carried over from
// those sources although the stylesheet sizes the glyph: an inline <svg>
// without them is 300x150, which is what the buttons would be if this
// component's CSS never arrived.
const iconAttributes =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" ' +
  'height="24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' +
  'focusable="false"';

const icons = {
  close: `<svg ${iconAttributes}><path d="M6 6 18 18M18 6 6 18" /></svg>`,
  prev: `<svg ${iconAttributes}><path d="m15 5-7 7 7 7" /></svg>`,
  next: `<svg ${iconAttributes}><path d="m9 5 7 7-7 7" /></svg>`,
};



// The viewer needs an id for the triggers' aria-controls to point at, and it
// is the module's own node, so nobody else can have given it one. The counter
// is module-wide (a page may carry several galleries) and the result is
// checked against the document, so a hand-written id of the same shape
// elsewhere cannot be shadowed. Same helper siteSearch uses for its form ids.
let viewerIdCounter = 0;

function uniqueViewerId(prefix) {
  let id = `${prefix}-${++viewerIdCounter}`;
  while (document.getElementById(id)) {
    id = `${prefix}-${++viewerIdCounter}`;
  }
  return id;
}



// Whether the engine knows :modal (it tells an actually-modal dialog from
// one merely opened with show()). Probed once, because matches() throws on a
// selector the engine cannot parse — see otherModalOpen.
const supportsModalSelector =
  typeof CSS !== 'undefined' && CSS.supports?.('selector(:modal)') === true;



class Lightbox {

  constructor(root, params, reporter) {
    this.root = root;
    this.params = params;
    this.reporter = reporter;

    this.items = [];
    this.index = -1;
    this.loop = root.hasAttribute(params.loopAttr);

    // Where the press inside the viewer started (see handleViewerClick).
    this.pressOrigin = null;

    // Triggers this module has already put its ARIA on (see syncTriggers).
    this.seededTriggers = new WeakSet();

    // Elements whose contract this module has already complained about, so a
    // reader pressing the same broken control twice does not fill the
    // console with the same finding. One set per finding, so an element that
    // is missing several things is told about all of them.
    this.reportedSource = new WeakSet();
    this.reportedAlt = new WeakSet();
    this.reportedIndex = new WeakSet();

    // Reported rather than fatal: a gallery may well be filled after init
    // (a filter, an AJAX page), and the delegated listeners below pick those
    // items up. What they cannot do is guess a typo in the attribute.
    this.reportEmptyGallery();

    this.buildViewer();
    this.root.addEventListener('click', this.handleGalleryClick);

    // The openers are handled on the document rather than on the root,
    // because that is the point of them: a control that opens this gallery
    // may sit anywhere on the page (dialog reaches its triggers the same
    // way). One delegated listener also means an opener rendered later — a
    // CMS element, an AJAX teaser, a framework re-render — works without
    // re-initialising anything.
    document.addEventListener('click', this.handleOpenerClick);

    this.syncTriggers();
  }



  reportEmptyGallery = () => {
    if (this.collectItems().length > 0) return;

    this.reporter?.report(
      'lightbox',
      `no [${this.params.itemAttr}] link inside the gallery — the viewer ` +
      'has nothing to open (items added later are picked up).', this.root
    );
  };



  // The navigation set, read when the viewer opens rather than cached at
  // init: a gallery may be filtered, paged or rendered late, and the set the
  // reader can see is the set they should be able to step through.
  collectItems = () => {
    const selector = `[${this.params.itemAttr}]`;
    const items = [...this.root.querySelectorAll(selector)];

    // A single image needs no gallery around it: the module may sit on the
    // link itself, which then is the whole set.
    if (this.root.matches(selector)) items.unshift(this.root);

    return items;
  };



  // Every opener that belongs to this gallery. Queried across the document,
  // because an opener outside the gallery is the whole idea (see ownsOpener).
  collectOpeners = () =>
    [...document.querySelectorAll(`[${this.params.openAttr}]`)]
      .filter(this.ownsOpener);



  // Whose opener is this? Two ways to say it, and each answers a different
  // situation:
  //
  // - A value names the gallery by id, the way dialog's triggers name their
  //   dialog. That is what lets a control on the other side of the page open
  //   this one.
  // - An empty value means "the gallery I am inside", which needs no id at
  //   all. On a page built from repeatable content elements — the normal
  //   case in a CMS, where an editor can place the same element twice — that
  //   is one less id to keep unique, and the trap the project readme warns
  //   about is avoided rather than documented.
  ownsOpener = (opener) => {
    const target = opener.getAttribute(this.params.openAttr)?.trim();
    if (target) return this.root.id !== '' && target === this.root.id;

    return this.root.contains(opener);
  };



  // Announces what a trigger does: activating it opens a modal dialog.
  // aria-haspopup + aria-controls is the ARIA APG modal-dialog pattern, and
  // aria-expanded is deliberately absent — a modal takes over the page, it is
  // not an expandable region belonging to its trigger (dialog draws the same
  // line). Called at init and again on every open, so a thumbnail or an
  // opener that appeared later is wired by the time it is next used.
  syncTriggers = () => {
    for (const trigger of [...this.collectItems(), ...this.collectOpeners()]) {
      if (this.seededTriggers.has(trigger)) continue;

      this.seededTriggers.add(trigger);
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', this.viewer.id);
    }
  };



  // ---- the injected viewer ------------------------------------------------

  buildViewer = () => {
    const params = this.params;

    this.viewer = this.createPart('dialog', 'viewer');
    this.viewer.setAttribute(
      'aria-label', this.option(params.labelAttr, params.label)
    );

    // The id the triggers' aria-controls points at (see syncTriggers).
    this.viewer.id = uniqueViewerId(params.viewerIdPrefix);

    // The viewer sits on <body>, so it inherits the document's language and
    // not the gallery's — while every string in it (the labels, the
    // captions) belongs to the gallery. A lang the gallery does not share
    // with the document is therefore mirrored onto the dialog, so a screen
    // reader pronounces a German caption in German on an English page. The
    // document's own language needs no copy: the dialog already has it.
    const lang = this.root.closest('[lang]')?.getAttribute('lang');
    if (lang && lang !== document.documentElement.lang) this.viewer.lang = lang;

    this.figure = this.createPart('figure', 'figure');
    this.stage = this.createPart('div', 'stage');

    this.image = this.createPart('img', 'image');
    this.image.alt = '';
    this.image.decoding = 'async';

    // The picture the reader is waiting for outranks the two neighbours
    // preloadNeighbours warms behind it — left unsaid the three requests are
    // equal, and speculation for a press that may never come would share the
    // connection with the image already on screen. Set once: it is the same
    // <img> for every image of the set.
    this.image.fetchPriority = 'high';

    this.bar = this.createPart('figcaption', 'bar');
    this.caption = this.createPart('span', 'caption');
    this.counter = this.createPart('span', 'counter');

    // Decoration as far as assistive tech is concerned: the live region
    // below says the same thing in a sentence.
    this.counter.setAttribute('aria-hidden', 'true');

    this.live = this.createPart('p', 'live');
    this.live.setAttribute('role', 'status');

    this.closeControl = this.createControl(
      'close', icons.close, this.option(params.closeLabelAttr, params.closeLabel)
    );

    // Where the focus starts. Left to the platform it would be the first
    // focusable node in the dialog, which is this button anyway — spelling
    // it out keeps that true if the chrome is ever reordered, and the way
    // out of an overlay is what a keyboard user looks for first.
    this.closeControl.autofocus = true;

    this.prevControl = this.createControl(
      'prev', icons.prev, this.option(params.prevLabelAttr, params.prevLabel)
    );
    this.nextControl = this.createControl(
      'next', icons.next, this.option(params.nextLabelAttr, params.nextLabel)
    );

    // <figcaption> has to be the figure's first or last child, so the bar
    // goes last; the controls follow the figure, which puts them in the tab
    // order after the picture they act on. The <img> is deliberately not
    // among them — it joins the document in render(), once it has a picture
    // (see there).
    this.bar.append(this.caption, this.counter);
    this.figure.append(this.stage, this.bar);
    this.viewer.append(
      this.figure,
      this.closeControl,
      this.prevControl,
      this.nextControl,
      this.live
    );

    this.viewer.addEventListener('pointerdown', this.handleViewerPointerDown);
    this.viewer.addEventListener('click', this.handleViewerClick);
    this.viewer.addEventListener('keydown', this.handleViewerKeydown);
    this.viewer.addEventListener('close', this.handleClose);
    this.closeControl.addEventListener('click', this.close);
    this.prevControl.addEventListener('click', this.handlePrevClick);
    this.nextControl.addEventListener('click', this.handleNextClick);
    this.image.addEventListener('load', this.settleImage);
    this.image.addEventListener('error', this.handleImageError);

    document.body.append(this.viewer);
  };



  // One helper for every generated node: it stamps the part marker, which is
  // both the stylesheet's hook and what makes the chrome readable in the
  // inspector (see uiAttr).
  createPart = (tag, part) => {
    const el = document.createElement(tag);
    el.setAttribute(this.params.uiAttr, part);
    return el;
  };



  // A control the reader operates: the glyph plus a real text node naming
  // it. A text node rather than aria-label, because it still names the
  // button when this component's stylesheet is missing — and the glyph is
  // aria-hidden, so it is the only name there is (dropdownNav and siteSearch
  // spell their labels out for the same reason).
  createControl = (part, icon, label) => {
    const button = this.createPart('button', part);
    button.type = 'button';
    button.insertAdjacentHTML('afterbegin', icon);

    const text = this.createPart('span', 'controlLabel');
    text.textContent = label;
    button.append(text);

    return button;
  };



  // A configurable string: the attribute on the root wins, the default in
  // `defaults` stands in. A blank attribute counts as "not set" — an
  // unnamed control is never what data-lightbox-label="" meant.
  option = (attr, fallback) => {
    const value = this.root.getAttribute(attr)?.trim();
    return value || fallback;
  };



  // ---- opening ------------------------------------------------------------

  // The presses that belong to the browser, not to us: a modified click and
  // anything but the primary button mean "new tab", "download", "copy the
  // address" — and both kinds of trigger can be a link to a real image, so
  // all of that works. Taking those presses would break the very fallback
  // the component is built on. (A middle click does not even fire "click" in
  // most engines; the check is there for the ones that do.)
  isOurs = (event) => {
    if (event.defaultPrevented) return false;
    if (event.button !== 0) return false;

    return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
  };



  handleGalleryClick = (event) => {
    if (!this.isOurs(event)) return;

    const item = event.target.closest(`[${this.params.itemAttr}]`);
    if (!item || !this.root.contains(item)) return;

    // The set is read per press rather than cached, because an index only
    // means something against the set the reader can see (see collectItems).
    this.items = this.collectItems();
    this.takePress(event, item, this.items.indexOf(item));
  };



  // A control that is not one of the images: it names the gallery (or sits
  // inside it) and, optionally, which image to start at.
  handleOpenerClick = (event) => {
    if (!this.isOurs(event)) return;

    const opener = event.target.closest(`[${this.params.openAttr}]`);
    if (!opener || !this.ownsOpener(opener)) return;

    this.items = this.collectItems();
    this.takePress(event, opener, this.openerIndex(opener));
  };



  // The native focus restoration on close needs an element to go back to,
  // and a clicked control does not get the focus in every engine: WebKit
  // follows the macOS convention and leaves it where it was, i.e. on <body>,
  // so a viewer opened with the mouse would have nothing to restore to. The
  // thumbnail is therefore focused first — but only where the click left the
  // focus nowhere, so an engine that focuses what it clicks is not touched
  // and a project moving the focus itself during the same click keeps it.
  // preventScroll because this is bookkeeping, not navigation: the thumbnail
  // was just clicked, so it is in view. dialog and offCanvasNav carry the
  // same one-liner for the same reason.
  adoptFocus = (item) => {
    const active = document.activeElement;
    if (active && active !== document.body) return;

    item.focus({ preventScroll: true });
  };



  // Where both trigger paths meet: the set has been read, the index is
  // where the press would land, and the only question left is whether the
  // press may be taken at all.
  //
  // It may not unless the viewer can actually deliver something — an empty
  // or filtered-out set, an item whose href has gone, a thumbnail that left
  // the DOM between the press and the query (indexOf -1). Cancelling the
  // navigation and then opening nothing would leave the reader with a
  // control that does exactly nothing, while the link underneath it leads
  // to the picture: the one outcome this component is built to avoid, and
  // the same reason a modified press is left alone (see isOurs).
  takePress = (event, trigger, index) => {
    if (!this.canOpenAt(index)) return;

    event.preventDefault();
    this.adoptFocus(trigger);
    this.openAt(index);
  };



  // Whether opening at this index would put a picture on screen — the same
  // two conditions render() checks, asked before the press is taken rather
  // than after. sourceFor reports a missing href on the way past, so the
  // markup bug is still named even though the press is handed back.
  canOpenAt = (index) => {
    const item = this.items[index];
    if (!item) return false;

    return this.sourceFor(item) !== '';
  };



  // Which image an opener starts at. Counted from 1, the way the counter in
  // the viewer counts, so the attribute says what a reader would say ("the
  // third image") rather than what an array would.
  openerIndex = (opener) => {
    const raw = opener.getAttribute(this.params.openIndexAttr);
    if (raw === null) return 0;

    // Number() rather than parseInt(): "3rd" is not a position, and parseInt
    // would read it as 3 and quietly open the third image instead of saying
    // that the attribute is wrong. The empty-string guard is because
    // Number('') is 0, which would then look like a valid position.
    const value = raw.trim();
    const position = value === '' ? NaN : Number(value);
    const index = position - 1;
    if (Number.isInteger(position) && index >= 0 && index < this.items.length) {
      return index;
    }

    this.reportOpenerIndex(opener, raw);

    // Reported and then clamped rather than obeyed: an opener pointing past
    // the end of a gallery that has since been filtered, paged or shortened
    // should still open something, and the first image is what it would have
    // opened without the attribute at all. A gallery holding nothing clamps
    // to -1, which takePress reads as "cannot be opened" and hands the press
    // back to the link.
    if (!Number.isInteger(position) || index < 0) return 0;

    return this.items.length - 1;
  };



  reportOpenerIndex = (opener, raw) => {
    if (this.reportedIndex.has(opener)) return;
    this.reportedIndex.add(opener);

    const outcome = this.items.length === 0
      ? 'the gallery holds no image at all, so the press is left to the link'
      : 'the viewer opens at the nearest one instead';

    this.reporter?.report(
      'lightbox',
      `${this.params.openIndexAttr}="${raw}" does not name an image of this ` +
      `gallery (it holds ${this.items.length}, counted from 1) — ${outcome}.`,
      opener
    );
  };



  // Opens the viewer at one image of the set. `items` is expected to be
  // current (an index only means something against the set the reader can
  // see) and the index to have been checked — takePress is the way in. The
  // render() guard below is kept all the same, so a later caller cannot
  // open an empty viewer by skipping that check.
  openAt = (index) => {
    if (this.viewer.open) return;
    if (!this.render(index)) return;

    // showModal() is what enables the top layer, the focus trap, the inert
    // page behind it, ::backdrop and the Escape handling.
    this.viewer.showModal();

    // Two frames later, and that is not a detail. A live region is announced
    // only when its text changes while it is already in the accessibility
    // tree — and the content of a closed <dialog> is not rendered, so it is
    // not in that tree at all. Filling it here and now would put the region's
    // arrival and its text in the same accessibility-tree update, which is
    // the case an engine reports as "a new region appeared", i.e. as nothing.
    // The first frame is where the opened dialog enters the tree, the second
    // is where the text is a change to something that was already there.
    // (marquee waits the same two frames, there for layout to settle.)
    this.afterLayout(this.announce);

    this.lockScroll();

    // Whatever has appeared since the last time round — a lazily rendered
    // thumbnail, an opener from an AJAX teaser — gets its ARIA now.
    this.syncTriggers();
  };



  close = () => {
    if (!this.viewer.open) return;

    // Funnels through the native "close" event, so handleClose does the
    // teardown no matter which path got here (the control, the backdrop,
    // Escape or a programmatic close).
    this.viewer.close();
  };



  // The single teardown funnel for every close path. The image keeps its
  // src on purpose: the closing animation holds the dialog in the top layer
  // while it fades (allow-discrete), and clearing the source here would
  // blank the picture halfway through its own exit. A reopen is covered
  // instead by the loading state, which hides the previous image until the
  // new one has arrived.
  handleClose = () => {
    this.unlockScroll();
  };



  // ---- what the viewer shows ---------------------------------------------

  // Puts one image of the set on screen. Returns whether it got that far, so
  // a caller does not open (or announce) a viewer that has nothing in it.
  render = (index) => {
    const item = this.items[index];
    if (!item) return false;

    // Reported in sourceFor: a trigger without a target has nothing to show,
    // and the reader stays where they are rather than looking at a blank
    // frame.
    const source = this.sourceFor(item);
    if (!source) return false;

    this.index = index;
    this.viewer.classList.add(this.params.loadingClass);

    // The image joins the document the first time there is something to
    // show: an <img> that represents nothing is markup that says nothing,
    // and a page where nobody opens a viewer should not carry one per
    // gallery. Nothing is delayed by it — a detached image loads just the
    // same, which is what preloadNeighbours relies on too.
    if (!this.image.isConnected) this.stage.append(this.image);

    // sizes before srcset before src: the browser picks a candidate the
    // moment srcset is set, so a sizes attribute arriving afterwards would
    // be too late for that choice.
    this.image.sizes = item.getAttribute(this.params.sizesAttr) ?? '';
    this.image.srcset = item.getAttribute(this.params.srcsetAttr) ?? '';
    this.image.alt = this.altFor(item);
    this.image.src = source;

    // A source that has not changed (reopening the same image) fires no
    // load event at all, and a cached one can be complete before the
    // listener gets a chance — either way the state has to be settled here
    // or the spinner would never stop.
    if (this.image.complete) this.settleImage();

    this.renderBar(item);
    this.syncControls();
    this.preloadNeighbours();

    return true;
  };



  // Step to another image. Guarded against the current one, so Home on the
  // first image (or a held arrow key at an end) does not re-announce what
  // is already on screen.
  goTo = (index) => {
    if (index === this.index) return;
    if (!this.render(index)) return;

    this.announce();
  };



  goStep = (offset) => {
    const target = this.step(this.index, offset);
    if (target < 0) return;

    this.goTo(target);
  };



  // Where a step lands, or -1 for "nowhere": without looping the ends are
  // walls, which is the same thing the controls' aria-disabled says.
  step = (index, offset) => {
    const total = this.items.length;
    if (total === 0) return -1;

    const next = index + offset;
    if (next >= 0 && next < total) return next;
    if (!this.loop) return -1;

    return (next + total) % total;
  };



  renderBar = (item) => {
    const caption = this.captionFor(item);
    const single = this.items.length < 2;

    this.caption.textContent = caption;
    this.caption.hidden = caption === '';

    this.counter.textContent = this.fill(
      this.option(this.params.counterAttr, this.params.counterTemplate)
    );

    // "1 / 1" tells a reader nothing they cannot see.
    this.counter.hidden = single;

    // Nothing left to say: the bar goes rather than leaving an empty strip
    // under the image.
    this.bar.hidden = this.caption.hidden && this.counter.hidden;
  };



  // The controls exist only while there is more than one image, and at the
  // ends of a non-looping gallery they announce that they cannot be used —
  // via aria-disabled, not [disabled]: a button that becomes [disabled]
  // while it has the focus drops it to <body>, and the reader's next Tab
  // would start over at the top of the page. The state is not enforced here
  // either; goStep() simply has nowhere to go.
  syncControls = () => {
    const single = this.items.length < 2;

    this.prevControl.hidden = single;
    this.nextControl.hidden = single;

    this.prevControl.setAttribute(
      'aria-disabled', String(this.step(this.index, -1) < 0)
    );
    this.nextControl.setAttribute(
      'aria-disabled', String(this.step(this.index, 1) < 0)
    );
  };



  // What a screen reader hears on every change: the position plus the
  // caption or the alt text. Swapping the src of an <img> inside an open
  // dialog is silent, and the visible counter is aria-hidden. Called
  // directly while stepping, and deferred on the way in (see openAt) — hence
  // the guard: a viewer closed or torn down inside those two frames has
  // nothing left to announce.
  announce = () => {
    if (!this.viewer.open) return;

    const template = this.option(
      this.params.statusAttr, this.params.statusTemplate
    );

    this.live.textContent = this.fill(template, this.currentLabel());
  };



  // Two frames out: the first one renders what just changed, the second runs
  // after the engine has taken account of it (see openAt for why the
  // announcement needs that).
  afterLayout = (task) => {
    requestAnimationFrame(() => requestAnimationFrame(task));
  };



  // Fills a template's placeholders. {label} is optional, and an empty one
  // takes its separator with it — "Image 2 of 6," read out with a dangling
  // comma is worse than the sentence without the clause, so whatever
  // punctuation or space sits directly before the placeholder goes too.
  // The label is substituted through a function because it is author text:
  // a caption containing "$&" would otherwise be rewritten by replace().
  fill = (template, label = '') => {
    const filled = template
      .replace('{index}', String(this.index + 1))
      .replace('{total}', String(this.items.length));

    if (label) return filled.replace('{label}', () => label);

    return filled.replace(/[\s,;:.–—-]*\{label\}/, '');
  };



  // The caption or, failing that, the text alternative — whichever says
  // what is on screen.
  currentLabel = () => {
    const item = this.items[this.index];
    if (!item) return '';

    return this.captionFor(item) || this.altFor(item);
  };



  // The two images the reader is one press away from, fetched while the
  // current one is on screen. The detached Image carries the same
  // srcset/sizes as the viewer's own <img>, so the candidate this warms is
  // the candidate the viewer will ask for.
  preloadNeighbours = () => {
    for (const offset of [1, -1]) {
      const item = this.items[this.step(this.index, offset)];
      if (!item) continue;

      // The source is read the way sourceFor reads it, minus the report: a
      // neighbour with no href is a markup bug the reader hears about when
      // they step to it, and a preload is no place to raise it. Skipped
      // rather than passed on as an empty string, because src="" is not
      // "no request" — it resolves to the current page and would fetch the
      // document.
      const source = item.getAttribute('href')?.trim();
      if (!source) continue;

      const preload = new Image();

      // Behind the picture on screen, which asks for 'high' (see
      // buildViewer): this is a guess about the next press, and it must not
      // compete with the image the reader is already waiting for.
      preload.fetchPriority = 'low';
      preload.sizes = item.getAttribute(this.params.sizesAttr) ?? '';
      preload.srcset = item.getAttribute(this.params.srcsetAttr) ?? '';
      preload.src = source;
    }
  };



  // The image has arrived — or failed, and then the state has to go all the
  // same: a broken <img> renders its alt text, which is what the reader
  // should be left with instead of a spinner that never stops.
  settleImage = () => {
    this.viewer.classList.remove(this.params.loadingClass);
  };



  handleImageError = () => {
    this.settleImage();

    this.reporter?.report(
      'lightbox',
      `the image "${this.image.currentSrc || this.image.src}" could not be ` +
      'loaded.', this.image
    );
  };



  // ---- reading one item ---------------------------------------------------

  // The image the viewer shows: the link's own href, which is also where a
  // reader without this module ends up. Reported once per item, since a
  // trigger without a target is a markup bug, not a state.
  sourceFor = (item) => {
    const href = item.getAttribute('href')?.trim();
    if (href) return href;

    if (this.reportedSource.has(item)) return '';
    this.reportedSource.add(item);

    this.reporter?.report(
      'lightbox',
      `a [${this.params.itemAttr}] has no href — it must point at the ` +
      'full-size image, which is both what the viewer shows and where a ' +
      'reader without this module goes.', item
    );

    return '';
  };



  // The text alternative for the full-size image: the author's override,
  // else the thumbnail's own alt — the same picture, so the same
  // description. A thumbnail with no alt attribute at all is reported; an
  // explicitly empty one is left alone, because that is an author saying
  // "decorative" and it is theirs to say.
  altFor = (item) => {
    const override = item.getAttribute(this.params.altAttr);
    if (override !== null) return override;

    const thumb = item.querySelector('img');
    if (thumb?.hasAttribute('alt')) return thumb.getAttribute('alt');

    this.reportMissingAlt(item);
    return '';
  };



  reportMissingAlt = (item) => {
    if (this.reportedAlt.has(item)) return;
    this.reportedAlt.add(item);

    this.reporter?.report(
      'lightbox',
      'the image has no text alternative — add alt to the thumbnail (an ' +
      `empty alt="" for a decorative one) or ${this.params.altAttr} to the ` +
      'link, so the viewer does not show an unlabelled picture ' +
      '(WCAG 1.1.1).', item
    );
  };



  // The caption under the image: the author's own text, else the
  // <figcaption> of a <figure> the item sits in — a gallery that captions
  // its thumbnails already should not have to say it twice.
  captionFor = (item) => {
    const own = item.getAttribute(this.params.captionAttr);
    if (own !== null) return own.trim();

    const figure = item.closest('figure');
    return figure?.querySelector('figcaption')?.textContent.trim() ?? '';
  };



  // ---- keyboard and pointer inside the viewer ----------------------------

  handleViewerKeydown = (event) => {
    if (event.defaultPrevented) return;

    const target = this.keyTarget(event.key);
    if (target < 0) return;

    // The key is ours now, so it must not also scroll the page behind the
    // viewer. Escape is deliberately absent from the list above: closing on
    // it is the platform's, and it does it better than we could.
    event.preventDefault();
    this.goTo(target);
  };



  keyTarget = (key) => {

    // Home/End jump to the ends of the set — but only while the viewer has
    // no ends of its own. At high zoom, or under a caption long enough to
    // squeeze the picture down to its floor, the dialog becomes a scroll
    // container, and then those two keys are how a keyboard user reaches the
    // top and the bottom of it; no other key does the same job, while the
    // set can still be walked with the arrows and the controls. So the
    // scroll container gets them back (the arrows below are unaffected: they
    // scroll nothing the reader cannot reach with the vertical ones).
    if (key === 'Home' || key === 'End') {
      if (this.viewerScrolls()) return -1;

      return key === 'Home' ? 0 : this.items.length - 1;
    }

    if (key !== 'ArrowRight' && key !== 'ArrowLeft') return -1;

    // ArrowRight means "the image on the right", and the controls are placed
    // with logical properties — so in a right-to-left context that is the
    // previous one, and the keys swap with them. Read per press rather than
    // cached: a project may flip direction at runtime.
    const rightwards = key === 'ArrowRight';
    const forwards = this.isRtl() ? !rightwards : rightwards;

    return this.step(this.index, forwards ? 1 : -1);
  };



  isRtl = () => getComputedStyle(this.viewer).direction === 'rtl';



  // Whether the viewer itself has something to scroll. The <dialog> is the
  // scroll container (the UA gives it overflow: auto) and the tolerance is
  // for the sub-pixel difference a fractional layout leaves behind.
  viewerScrolls = () => this.viewer.scrollHeight - this.viewer.clientHeight > 1;



  handlePrevClick = () => this.goStep(-1);



  handleNextClick = () => this.goStep(1);



  // Where a press started, kept for the light dismiss below. Recorded on
  // every press inside the viewer, not just on the boxes that dismiss it:
  // what matters is whether the press that ends beside the picture began
  // there.
  handleViewerPointerDown = (event) => {
    this.pressOrigin = event.target;
  };



  // Light dismiss: a press on the viewer itself, on the figure or on the
  // letterboxing around the image is a press outside the picture, so it
  // closes the viewer — the same gesture dialog implements on its backdrop.
  // The whitelist is the three boxes that hold no content of their own,
  // rather than "anything that is not the image", so a project adding
  // something to the chrome does not find its own element dismissing the
  // viewer.
  handleViewerClick = (event) => {

    // The origin is consumed here, whatever the press turns out to have
    // been, so a stale one cannot speak for the next press.
    const origin = this.pressOrigin;
    this.pressOrigin = null;

    const target = event.target;
    const outsidePicture =
      target === this.viewer || target === this.figure || target === this.stage;
    if (!outsidePicture) return;

    // A press that began somewhere else is not a press on the letterboxing,
    // whatever the click target says: "click" is dispatched on the nearest
    // common ancestor of the press and the release, so dragging a photograph
    // aside — the one gesture a picture invites, and the way an image is
    // dragged into another window — arrives here as a press on the stage and
    // would close the viewer mid-gesture. An origin of null is a click with
    // no press before it (a synthetic one, or an engine without pointer
    // events) and is taken at face value.
    if (origin && origin !== target) return;

    this.close();
  };



  // ---- body scroll lock ---------------------------------------------------

  lockScroll = () => {
    document.body.classList.add(this.params.scrollLockClass);
  };



  // Released only when no other modal dialog is still up: the body class is
  // shared with dialog and offCanvasNav, and a lightbox opened from inside
  // another dialog would otherwise leave that one with a scrolling page
  // behind it. Read from the DOM rather than counted per instance, because a
  // counter in this module could only ever see this module's own viewers.
  unlockScroll = () => {
    if (this.otherModalOpen()) return;

    document.body.classList.remove(this.params.scrollLockClass);
  };



  // Takes the ARIA of syncTriggers off again. The triggers are re-queried
  // rather than kept in a list — the seededTriggers set says which of them
  // this module wrote on, and a WeakSet is what keeps a thumbnail that has
  // since been removed from the page collectable.
  releaseTriggers = () => {
    for (const trigger of [...this.collectItems(), ...this.collectOpeners()]) {
      if (!this.seededTriggers.has(trigger)) continue;

      this.seededTriggers.delete(trigger);
      trigger.removeAttribute('aria-haspopup');
      trigger.removeAttribute('aria-controls');
    }
  };



  otherModalOpen = () => {
    if (!supportsModalSelector) return false;

    return [...document.querySelectorAll('dialog[open]')].some(
      (other) => other !== this.viewer && other.matches(':modal')
    );
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly
  // instead of doing a full page (re)load — see destroyModulesInScope() in
  // boot.js. The injected viewer is the state that outlives the gallery's
  // own subtree: it sits on <body>, so it has to be taken out by hand (the
  // same reason backToTop removes its sentinel).
  destroy = () => {
    const wasOpen = this.viewer.open;

    // The gallery root and the document are not ours to remove, so their
    // listeners have to go by hand. The listeners inside the viewer go with
    // the node further down — except the "close" one, which has to be gone
    // before the funnel below runs.
    this.root.removeEventListener('click', this.handleGalleryClick);
    document.removeEventListener('click', this.handleOpenerClick);
    this.viewer.removeEventListener('close', this.handleClose);

    // The triggers are the author's markup, so they are handed back as they
    // were written — but only the ones this module actually wrote on: a
    // project that seeded its own aria-haspopup keeps it.
    this.releaseTriggers();

    if (wasOpen) this.viewer.close();

    // close() does not dispatch "close" then and there — it queues a task —
    // so the listener removed a few lines up would have swallowed the
    // funnel, and a viewer torn down while it was open would leave the page
    // scroll-locked with nothing left to unlock it. Hence the funnel by
    // hand, after the listener is gone so the queued event cannot run it a
    // second time.
    if (wasOpen) this.handleClose();

    this.viewer.remove();
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'lightbox',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new Lightbox(el, defaults, reporter);
  return instance.destroy;
}
