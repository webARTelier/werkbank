/**
 * slider.js
 * ----------------------------------------------------------------------------
 * A slider (carousel) an editor can place without knowing a single option:
 * the markup is a container and a list of slides, one attribute says which
 * KIND of slider it is, and everything else — how many slides are on screen,
 * whether it fades, whether it rotates on its own — comes from a named preset
 * in this file. The gap it closes is not "sliding" (see below) but the
 * distance between a CMS field and a slider configuration: an editor picks
 * "hero" or "gallery", not `slidesPerView`, `effect` and `spaceBetween`.
 *
 * This is the one component in the collection with a VENDOR dependency:
 * Swiper (https://swiperjs.com, MIT) does the sliding. It is installed as an
 * npm package, bundled into this component's own lazy chunk by Rollup and its
 * core stylesheet is inlined into slider.min.css by Sass — nothing is fetched
 * from a CDN at runtime, and the version that ships is the version
 * package.json pins.
 *
 * What works without this script
 * ------------------------------
 * The authored markup is a horizontal, scroll-snapping strip of slides — CSS
 * alone, no vendor class in sight (see slider.scss). Every slide is in the
 * document, in reading order, and reachable by dragging, by a trackpad, by a
 * scrollbar and by whatever a screen reader does with a list. Nothing is
 * hidden and no control is promised that does not exist, so a chunk that never
 * arrives costs the reader the transitions and the buttons, not the content.
 * That is also why the ready attribute here is keyed POSITIVELY (see point 6):
 * the scroll-snap strip is not a transitional state to be lifted, it is the
 * design for every reader this script does not reach.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * Scroll snapping, momentum, the drag, `overscroll-behavior`, and — before
 * `init()` and forever without it — the whole strip: `scroll-snap-type` plus
 * `scroll-snap-align` is a carousel that needs no JavaScript at all, and it is
 * what the pre-enhancement layer is built from. A `<button>` brings its role,
 * Enter and Space; `aria-current` on a bullet is what says which one is the
 * current slide. What CSS cannot do is animate between slides on a control's
 * press, tell an assistive technology that a slide changed, keep a set of
 * bullets in step with the position, or lay out "three slides per view, two
 * below the small breakpoint" — which is where Swiper comes in.
 *
 * What this script adds
 * ---------------------
 * 1. The preset lookup. `data-slider-type` names one entry of `presets`
 *    below; a missing attribute takes the `default` entry and an unknown one
 *    is reported and falls back to it, because an editor's typo must not cost
 *    the slider. `presets` is deliberately the FIRST thing in this file and
 *    the only thing a consuming project is expected to rewrite: which kinds of
 *    slider a site has is a design decision, not this component's.
 * 2. Swiper, handed a clean box. The vendor classes ("swiper",
 *    "swiper-wrapper", "swiper-slide") are written by this module, never by
 *    the author, so the vendor stylesheet cannot take hold of markup its
 *    script is not driving yet — and the ready attribute is set BEFORE the
 *    instance is built, so the pre-enhancement scrolling and gaps are gone by
 *    the time Swiper measures the box (see setup).
 * 3. The controls, injected rather than authored: previous/next, one bullet
 *    per slide, and — only where the preset rotates — a stop/start control.
 *    Unenhanced they would be buttons that do nothing, which is the same
 *    reason passwordToggle injects its own. An editor therefore writes no
 *    control, and a preset decides which ones exist.
 * 4. Keyboard control, on by default and SCOPED TO FOCUS. Swiper's Keyboard
 *    module is what runs, but it is enabled while focus is inside this slider
 *    and disabled again when focus leaves, instead of Swiper's own default of
 *    listening on `document` for anything in the viewport (see
 *    handleFocusIn). Two sliders on one page would otherwise both step on one
 *    press, and `PageUp`/`PageDown` — Swiper hijacks those too by default —
 *    are scrolling keys that belong to the page.
 * 5. The rotation, where a preset asks for one, with everything WCAG 2.2.2
 *    wants around it: a stop/start control, a stop on pointer entry and on
 *    focus entry, and a slider that starts stopped when the reader asked for
 *    reduced motion — the same opt-in marquee uses, and it holds if the
 *    preference is switched on later.
 * 6. "data-slider-ready" on the root, set before Swiper is constructed and
 *    removed again by the cleanup function. Only ever written. What it gates
 *    is switched ON by its presence (the vendor box) rather than lifted by it,
 *    so `init()`'s bail-outs simply never write it and the scroll-snap strip
 *    stays — see the note in docs/preEnhancement.md.
 * 7. The gap, taken from CSS. `--slider-gap` is one declaration in one place
 *    and it feeds both states: the pre-enhancement strip uses it as a `gap`,
 *    and this module reads it and hands it to Swiper as `spaceBetween`,
 *    re-reading it when the viewport changes so a responsive gap follows. A
 *    preset that states `spaceBetween` itself takes over and the reading stops.
 *
 * Accessibility
 * -------------
 * - The widget follows the ARIA APG carousel pattern, and Swiper's A11y module
 *   is what writes most of it: `role="group"` plus
 *   `aria-roledescription="slider"` and an accessible name on the root, a
 *   label per slide ("3 of 7"), `aria-live` on the track while nothing rotates
 *   (and `off` while something does, because a live region plus a timer is an
 *   announcement the reader never asked for), `aria-current` on the bullet of
 *   the current slide, and a slide scrolled into view when something inside it
 *   takes focus.
 * - The slides stay a LIST. Swiper's `slideRole` is deliberately turned off
 *   here: the authored markup is a `<ul>`, which is what tells a reader
 *   without this script how many slides there are, and overwriting each
 *   `<li>` with `role="group"` would leave an empty list behind. The carousel
 *   semantics arrive as `aria-roledescription="slide"` instead, which adds the
 *   word without taking the role away.
 * - Every control is a real `<button type="button">` named by a real text
 *   node, visually hidden and only visually, so it still names the control if
 *   this component's stylesheet never arrives — which is exactly the situation
 *   in which the glyph is missing too. Swiper's own `aria-label` for the two
 *   navigation buttons is fed the SAME strings, so what is seen and what is
 *   announced cannot differ (WCAG 2.5.3).
 * - No control ever leaves the tab order. Every preset rewinds instead of
 *   stopping at its ends, which is what keeps Swiper from setting `disabled`
 *   and `tabindex="-1"` on a navigation button at the last slide — a control
 *   that becomes disabled under the focus drops it to `<body>`, and the next
 *   Tab starts over at the top of the page.
 * - The rotation control's NAME changes ("Stop"/"Start") rather than carrying
 *   `aria-pressed`: for a transport control the useful announcement is what
 *   pressing does next, which is the same reading video.js's play/pause
 *   control follows and the opposite of passwordToggle's. Its glyph follows
 *   from the state class written in the same method, so the two cannot drift.
 * - Reduced motion is honoured twice: the rotation does not start (here), and
 *   the slide transition is instant (slider.scss).
 *
 * Configuration (all optional, on the component root)
 * ---------------------------------------------------
 * - data-slider-type="…"   which entry of `presets` to use (default:
 *                          "default"). This is the attribute a CMS exposes to
 *                          an editor.
 * - data-slider-label="…"  the slider's accessible name. Strongly
 *                          recommended and reported when it is missing: a
 *                          named region is what lets a screen reader user
 *                          find and skip the thing.
 *
 * Markup contract
 * ---------------
 * - data-slider-track      required, on the element holding the slides.
 *                          EVERY element child of it is a slide — an editor
 *                          adds one by adding a list item, with no attribute
 *                          to remember.
 * Everything else is CSS: how wide a slide is, how big the controls are, where
 * they sit and what they look like are questions about a box (see the token
 * block in slider.scss).
 * ----------------------------------------------------------------------------
 */



// The vendor library. Bundled into this component's lazy chunk by Rollup —
// `import Swiper from 'swiper'` is a bare specifier the build resolves out of
// node_modules, so nothing is loaded from a CDN and no <script> is added to
// the page. The modules are named individually rather than taken from
// 'swiper/bundle' so the chunk carries the six features the presets use and
// not the twenty-four Swiper ships.
import Swiper from 'swiper';
import {
  A11y,
  Autoplay,
  EffectFade,
  Keyboard,
  Navigation,
  Pagination,
} from 'swiper/modules';

// Shared utilities, imported as flat siblings (see CLAUDE.md, "DI vs. direct
// import"): the label templates are interpolated with formatTemplate, the gap
// and the named breakpoints are read out of CSS, and resolveLocale picks the
// built-in wording from <html lang>.
import { formatTemplate } from './formatTemplate.js';
import { getCssCustomProperty } from './getCssCustomProperty.js';
import { parseNonNegative } from './parseNonNegative.js';
import { resolveLocale } from './resolveLocale.js';



// The slider types an editor can choose from, and the one thing in this file a
// consuming project is meant to replace: which kinds of slider a site has is
// its design system's business, not this component's. Each entry is a plain
// Swiper options object (https://swiperjs.com/swiper-api#parameters) with
// three conveniences on top:
//
//   navigation: true   inject a previous/next pair and wire it
//   pagination: true   inject one bullet per slide and wire it
//   breakpoints        may be keyed by the project's breakpoint NAMES
//                      ("small", "medium", "large", "xxl") instead of pixel
//                      values, so a preset cannot drift away from
//                      _shared/scss/_breakpoints.scss. A numeric key is
//                      passed through untouched.
//
// What deliberately does NOT appear in an entry is `keyboard`, `a11y`,
// `rewind` and the autoplay guards: those are in `baseOptions` below, because
// they are decisions about the component rather than about a type of slider.
const presets = {

  // One slide at a time, stepped by its controls. The type to reach for when
  // in doubt, and the one an editor gets without choosing.
  default: {
    navigation: true,
    pagination: true,
  },

  // A hero / stage banner: one slide, cross-faded rather than slid, rotating
  // on its own until the reader takes over. crossFade keeps the outgoing slide
  // from showing through the incoming one, which is what makes text on an
  // image readable mid-transition.
  hero: {
    effect: 'fade',
    fadeEffect: { crossFade: true },
    autoplay: { delay: 6000 },
    navigation: true,
    pagination: true,
  },

  // A row of teasers, one per view on a phone and up to three on a wide
  // screen. The breakpoint names are the project's own (see above).
  gallery: {
    slidesPerView: 1,
    breakpoints: {
      small: { slidesPerView: 2 },
      large: { slidesPerView: 3 },
    },
    navigation: true,
    pagination: true,
  },

  // Slides that keep a width of their own, so the next one peeks in at the
  // trailing edge and says there is more. The widths are the project's CSS —
  // "auto" means "ask the slide", so a stylesheet that states none leaves
  // every slide at the vendor default of 100%.
  //
  // Deliberately NOT centeredSlides: centring the first slide leaves half the
  // box empty in front of it, and the option that is supposed to fix that
  // (centeredSlidesBounds) puts this configuration into an inconsistent
  // starting state — measured on Swiper 14.1.0: slidesGrid begins at -280 and
  // the slider opens on slide 2. Peeking at one edge is what this preset
  // promises, and it is what it does.
  showcase: {
    slidesPerView: 'auto',
    navigation: true,
    pagination: true,
  },
};



// What every preset is merged onto. These are decisions about the component,
// not about a kind of slider, which is why a preset does not restate them:
//
//   rewind          the ends wrap instead of stopping, so Swiper never sets
//                   `disabled` + tabindex="-1" on a navigation button — a
//                   control that becomes disabled under the focus drops it to
//                   <body> (see the header, "Accessibility").
//   keyboard        ON as the component's default, but enabled and disabled
//                   with the focus rather than by Swiper (see the header,
//                   point 4). It is registered here as `enabled: false` for
//                   exactly that reason: the module has to exist for
//                   swiper.keyboard.enable() to be there at all.
//   pageUpDown      off: those two keys scroll the page, and a slider in the
//                   viewport does not get to take them.
//   a11y            the roles, labels and the live region. `slideRole: null`
//                   keeps the authored <li> a list item; the labels are
//                   filled in per instance (see buildOptions).
//   watchSlidesProgress   lets Swiper mark which slides are visible, which is
//                   what its focus handling uses to decide whether a slide
//                   holding the newly focused element has to be scrolled to.
const baseOptions = {
  rewind: true,
  watchSlidesProgress: true,

  keyboard: {
    enabled: false,
    onlyInViewport: false,
    pageUpDown: false,
  },

  a11y: {
    enabled: true,
    containerRole: 'group',
    slideRole: null,
    scrollOnFocus: true,
    wrapperLiveRegion: true,
  },
};



const defaults = {

  // Markup contract: the element holding the slides. Every element child of
  // it is a slide — a behavioural data attribute rather than the styling
  // class, so restyling the component cannot break the script.
  selTrack: '[data-slider-track]',

  // Author options on the root.
  typeAttr: 'data-slider-type',
  labelAttr: 'data-slider-label',

  // "The box belongs to the vendor now." Set on the root by init() before the
  // Swiper instance is built, removed again by the cleanup function, and only
  // ever written — never read back. Keyed positively, like dataTable's and
  // passwordToggle's, and for a reason of its own: what its absence leaves
  // standing is not a transitional state but the scroll-snap strip every
  // reader without this chunk keeps (see docs/preEnhancement.md).
  readyAttr: 'data-slider-ready',

  // The vendor classes this module writes, so the vendor stylesheet only ever
  // applies to markup Swiper is actually driving. They are not styling hooks
  // of this component and nothing in slider.scss selects by them.
  vendorRootClass: 'swiper',
  vendorTrackClass: 'swiper-wrapper',
  vendorSlideClass: 'swiper-slide',

  // Styling hooks written onto the injected nodes. The module holds those
  // elements; it never selects by these.
  controlsClass: 'm-slider__controls',
  buttonClass: 'm-slider__button',
  prevClass: 'm-slider__button--prev',
  nextClass: 'm-slider__button--next',
  rotationClass: 'm-slider__rotation',
  paginationClass: 'm-slider__pagination',
  bulletClass: 'm-slider__bullet',
  labelClass: 'm-slider__label',

  // On the rotation control while the rotation is stopped. The state class is
  // what the stylesheet swaps the glyph on; the control's NAME carries the
  // state for everyone else (see the header).
  pausedClass: 'is-paused',

  // The gap between slides, read off the root and handed to Swiper as
  // spaceBetween. One declaration feeds both states; see the header, point 7.
  gapProperty: '--slider-gap',

  // Where a preset's named breakpoint keys are resolved from — the same
  // tokens _breakpoint_tokens.scss writes out of $viewportScales.
  breakpointPrefix: '--bp-',

  // The attributes Swiper's A11y module writes onto markup this module does
  // not own. Held before it runs so destroy() can hand the markup back the
  // way it was authored.
  heldRootAttrs: ['role', 'aria-label', 'aria-roledescription'],
  heldTrackAttrs: ['id', 'aria-live'],
  heldSlideAttrs: ['role', 'aria-label', 'aria-roledescription'],

  // Below two slides there is nothing to slide: no controls are injected, no
  // instance is built and the ready attribute is withheld, so the markup stays
  // the single-item strip it already is.
  minSlides: 2,

  // <html lang> matching none of the offered locales falls back to this.
  fallbackLocale: 'en',
};



// The reader-facing wording, as plain strings with {placeholder} tokens so the
// whole map stays JSON-shaped and a translation keeps its own word order (the
// same shape formValidation's overridable messages use).
const labels = {

  de: {
    region: 'Slider',
    roleDescription: 'Slider',
    slideRoleDescription: 'Slide',
    slide: 'Slide {index} von {total}',
    prev: 'Vorheriges Slide',
    next: 'Nächstes Slide',
    first: 'Das ist das erste Slide',
    last: 'Das ist das letzte Slide',
    bullet: 'Zu Slide {index}',
    stop: 'Automatischen Wechsel anhalten',
    start: 'Automatischen Wechsel starten',
  },

  en: {
    region: 'Carousel',
    roleDescription: 'carousel',
    slideRoleDescription: 'slide',
    slide: 'Slide {index} of {total}',
    prev: 'Previous slide',
    next: 'Next slide',
    first: 'This is the first slide',
    last: 'This is the last slide',
    bullet: 'Go to slide {index}',
    stop: 'Stop the automatic slide show',
    start: 'Start the automatic slide show',
  },
};



// Our label templates use {index} / {total} (formatTemplate's syntax, and the
// syntax a CMS would override). Swiper interpolates {{index}} /
// {{slidesLength}} itself, so the two templates it is handed are translated
// here rather than being kept in the map in a second dialect.
function toSwiperTemplate(template) {
  return template
    .replace('{index}', '{{index}}')
    .replace('{total}', '{{slidesLength}}');
}



class Slider {

  constructor(root, track, slides, config, reporter) {
    this.root = root;
    this.track = track;
    this.slides = slides;
    this.config = config;
    this.reporter = reporter;

    // Whether the reader wants the thing to rotate. Only meaningful where the
    // preset asks for a rotation at all, and the single fact the resume paths
    // below consult: a rotation the reader stopped must not come back because
    // the pointer left the box.
    this.rotating = false;

    // Reduced motion starts a rotating slider stopped; the control is then an
    // explicit opt-in to the motion, the way marquee's is.
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.labels = labels[
      resolveLocale(Object.keys(labels), config.fallbackLocale)
    ];

    this.setup();
  }



  setup = () => {

    // Order matters here, and it is the reason the ready attribute is written
    // in the middle of a method rather than at one of its ends:
    //   1. the options are resolved, which is also where the controls are
    //      built (Swiper has to be handed the actual nodes, not a promise of
    //      them — see buildOptions);
    //   2. the vendor classes go on, so the vendor stylesheet applies;
    //   3. the flag goes on, so the pre-enhancement scrolling and the CSS gap
    //      are gone — and a scroll offset the reader left behind goes with
    //      them, because an element that stops scrolling is at 0 by definition;
    //   4. only now is the instance built, and it measures a clean box.
    const options = this.buildOptions();

    this.addVendorClasses();
    this.holdAttrs();
    this.root.setAttribute(this.config.readyAttr, '');

    this.swiper = new Swiper(this.root, options);

    // Held before the motion preference is applied, and read off the instance
    // rather than off the preset, so the value that comes back when the
    // preference is switched off again is the one Swiper actually resolved —
    // the preset's own `speed` where it states one, and the library's default
    // where it does not, without this file having to know what that default is.
    this.baseSpeed = this.swiper.params.speed;
    this.applyMotionPreference();

    this.root.addEventListener('focusin', this.handleFocusIn);
    this.root.addEventListener('focusout', this.handleFocusOut);
    this.reducedMotion.addEventListener('change', this.handleReducedMotion);

    if (this.gapFromCss) this.swiper.on('resize', this.handleResize);

    if (this.rotationButton) this.setupRotation();
  };



  // Reduced motion, the half of it no stylesheet can carry: Swiper animates
  // the track with an INLINE transition-duration, which no rule can outrank,
  // so the slide change is made instant through the library's own `speed`
  // instead. A reader who asked for less motion is not asking for a slower
  // slide but for none. (The other half is the rotation, which then never
  // starts — see setupRotation; the controls' own hover transitions are the
  // stylesheet's.)
  applyMotionPreference = () => {
    this.swiper.params.speed = this.reducedMotion.matches ? 0 : this.baseSpeed;
  };



  // The resolved Swiper options: the base, the preset, the instance's labels,
  // and the three conveniences a preset may use (see `presets`). Returns a
  // plain object — nothing here touches the DOM except the control injection
  // the two shorthands ask for.
  buildOptions = () => {
    const { config, labels: text } = this;
    const preset = this.resolvePreset();

    const options = {
      ...baseOptions,
      ...preset,
      modules: [A11y, Autoplay, EffectFade, Keyboard, Navigation, Pagination],
      a11y: {
        ...baseOptions.a11y,
        containerMessage: this.regionLabel(),
        containerRoleDescriptionMessage: text.roleDescription,
        itemRoleDescriptionMessage: text.slideRoleDescription,
        slideLabelMessage: toSwiperTemplate(text.slide),
        prevSlideMessage: text.prev,
        nextSlideMessage: text.next,
        firstSlideMessage: text.first,
        lastSlideMessage: text.last,
      },
    };

    // The gap lives in CSS unless the preset insists on a number of its own.
    this.gapFromCss = !('spaceBetween' in preset);
    if (this.gapFromCss) options.spaceBetween = this.readGap();

    if (preset.breakpoints) {
      options.breakpoints = this.resolveBreakpoints(preset.breakpoints);
    }

    // The controls, built only where the preset asks for them and only ever
    // as the nodes Swiper is then pointed at — the two shorthands never reach
    // the constructor as booleans.
    if (preset.navigation === true || preset.pagination === true) {
      this.buildControls(preset);
    }

    if (preset.navigation === true) {
      options.navigation = {
        prevEl: this.prevButton,
        nextEl: this.nextButton,
      };
    }

    if (preset.pagination === true) {
      options.pagination = {
        el: this.paginationEl,
        clickable: true,
        bulletClass: config.bulletClass,
        // Our own bullet, for two reasons: a <button> written by Swiper would
        // carry no type attribute and would therefore SUBMIT the form a
        // slider happens to sit in, and a bullet named by a real text node
        // keeps its name where this stylesheet never arrived. Swiper leaves
        // the ARIA of a rendered bullet alone (except aria-current, which is
        // what the stylesheet draws the active one from), so the name here is
        // the only one there is.
        renderBullet: (index, className) =>
          `<button class="${className}" type="button">` +
          `<span class="${config.labelClass}">` +
          `${formatTemplate(this.labels.bullet, { index: index + 1 })}` +
          '</span></button>',
      };
    }

    if (preset.autoplay) {
      options.autoplay = {
        // A press, a drag or a bullet is the reader taking over, not a reason
        // to give up on the rotation for good — the stop control is what says
        // that, and it is the only thing that does.
        disableOnInteraction: false,
        // WCAG 2.2.2 wants a way to pause moving content. This is the cheap
        // half of it (the pointer resting on the slider); the control and the
        // stop on focus entry are the other half.
        pauseOnMouseEnter: true,
        ...preset.autoplay,
      };
    }

    return options;
  };



  // Which preset to use. A missing attribute means "the default one" — that
  // is the point of a default — and an unknown one is an editor's typo, which
  // is reported and then also falls back, because a slider that renders is
  // worth more than a warning nobody in the CMS will see.
  resolvePreset = () => {
    const name = (this.root.getAttribute(this.config.typeAttr) || '').trim();

    if (!name) return presets.default;
    if (presets[name]) return presets[name];

    this.reporter?.report(
      'slider',
      `unknown slider type "${name}"; using the default preset. Known ` +
      `types: ${Object.keys(presets).join(', ')}.`, this.root
    );

    return presets.default;
  };



  // The slider's accessible name. There is nothing to derive it from — a
  // slider holds whatever an editor put in it — so a missing one is reported
  // and a generic name stands in: an unnamed group is harder to find and
  // impossible to skip, and a generic one at least says what the region is.
  regionLabel = () => {
    const authored = (this.root.getAttribute(this.config.labelAttr) || '')
      .trim();

    if (authored) return authored;

    this.reporter?.report(
      'slider',
      `no ${this.config.labelAttr} on the slider; falling back to ` +
      `"${this.labels.region}". A named region is what lets a screen ` +
      'reader user find and skip it.', this.root
    );

    return this.labels.region;
  };



  // The gap between slides, in px, read off the root so one CSS declaration
  // feeds both the pre-enhancement strip and Swiper. An unreadable or missing
  // value is 0 rather than a guess — a slider with no gap is a slider, a
  // slider with an invented one is a surprise.
  readGap = () => parseNonNegative(
    getCssCustomProperty(this.root, this.config.gapProperty), 0
  );



  // A preset's breakpoint keys, with the project's names ("small", "large")
  // swapped for the pixel values _breakpoint_tokens.scss publishes. Keeping
  // the names out of this file is the same rule the stylesheets follow: a
  // breakpoint is stated once, in _breakpoints.scss, and everything else asks.
  resolveBreakpoints = (breakpoints) => {
    const resolved = {};

    Object.entries(breakpoints).forEach(([key, value]) => {
      if (Number.isFinite(Number(key))) {
        resolved[key] = value;
        return;
      }

      const token = getCssCustomProperty(
        document.documentElement, `${this.config.breakpointPrefix}${key}`
      );

      if (!token) {
        this.reporter?.report(
          'slider',
          `unknown breakpoint name "${key}" in a preset; there is no ` +
          `${this.config.breakpointPrefix}${key} token. The entry is ignored.`,
          this.root
        );
        return;
      }

      resolved[parseNonNegative(token, 0)] = value;
    });

    return resolved;
  };



  // The vendor classes, written here so the vendor stylesheet — which is
  // inlined into this component's own CSS file — can only ever take hold of
  // markup whose script is present. Before this runs, ".swiper" and
  // ".swiper-wrapper" match nothing on the page.
  addVendorClasses = () => {
    const { config } = this;

    this.root.classList.add(config.vendorRootClass);
    this.track.classList.add(config.vendorTrackClass);
    this.slides.forEach((slide) => {
      slide.classList.add(config.vendorSlideClass);
    });
  };



  // What Swiper's A11y module is about to write onto markup this module did
  // not create, held so destroy() can hand it back. A null means "there was
  // no attribute here", which is what has to be put back — not an empty
  // string (the same shape passwordToggle holds its three field attributes
  // in).
  holdAttrs = () => {
    const { config } = this;
    this.heldAttrs = [];

    const hold = (node, names) => {
      names.forEach((name) => {
        this.heldAttrs.push([node, name, node.getAttribute(name)]);
      });
    };

    hold(this.root, config.heldRootAttrs);
    hold(this.track, config.heldTrackAttrs);
    this.slides.forEach((slide) => hold(slide, config.heldSlideAttrs));
  };



  // The controls: one bar after the track holding, in this order, the
  // stop/start control, "previous", the bullets and "next". After the track
  // because that is where they are read and where they are seen — and the
  // rotation control being three Tab presses away is not the problem it looks
  // like, because entering the slider with the keyboard stops the rotation on
  // its own (see handleFocusIn).
  buildControls = (preset) => {
    const { config } = this;

    const controls = document.createElement('div');
    controls.className = config.controlsClass;

    if (preset.autoplay) {
      this.rotationButton = this.buildButton(
        `${config.buttonClass} ${config.rotationClass}`, this.labels.stop
      );
      controls.append(this.rotationButton);
    }

    if (preset.navigation === true) {
      this.prevButton = this.buildButton(
        `${config.buttonClass} ${config.prevClass}`, this.labels.prev
      );
      controls.append(this.prevButton);
    }

    if (preset.pagination === true) {
      this.paginationEl = document.createElement('div');
      this.paginationEl.className = config.paginationClass;
      controls.append(this.paginationEl);
    }

    if (preset.navigation === true) {
      this.nextButton = this.buildButton(
        `${config.buttonClass} ${config.nextClass}`, this.labels.next
      );
      controls.append(this.nextButton);
    }

    this.track.after(controls);
    this.controls = controls;
  };



  // One control. A real <button type="button"> named by a real text node
  // rather than an aria-label, so it still names the control where this
  // stylesheet never arrived — which is exactly where the glyph is missing
  // too. The glyph itself is a CSS mask on a pseudo-element, so there is no
  // node here for a screen reader to announce or skip.
  buildButton = (className, text) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;

    const label = document.createElement('span');
    label.className = this.config.labelClass;
    label.textContent = text;

    button.append(label);
    return button;
  };



  // The rotation. Swiper started its own autoplay when the instance was
  // built, so the resting state here is "rotating" and the control was built
  // saying so — which leaves reduced motion as the one thing to act on, as a
  // stop rather than as a withheld start.
  setupRotation = () => {
    this.rotationLabel = this.rotationButton
      .querySelector(`.${this.config.labelClass}`);

    this.rotationButton.addEventListener('click', this.handleRotationClick);

    this.rotating = true;
    if (this.reducedMotion.matches) this.setRotation(false);
  };



  // Start or stop the rotation, and say so in both directions at once: the
  // name is what a screen reader announces, the state class is what the
  // stylesheet draws the glyph from. Both are written here and nowhere else,
  // so what is seen and what is announced cannot drift apart.
  //
  // This is the reader's own choice and the only durable one — `rotating` is
  // what the two focus paths consult, so a rotation somebody stopped never
  // comes back because the focus moved on.
  setRotation = (next) => {
    if (next === this.rotating) return;

    this.rotating = next;

    if (next) this.swiper.autoplay?.start();
    if (!next) this.swiper.autoplay?.stop();

    this.rotationLabel.textContent = next
      ? this.labels.stop
      : this.labels.start;
    this.rotationButton.classList.toggle(this.config.pausedClass, !next);
  };



  handleRotationClick = () => {
    this.setRotation(!this.rotating);
  };



  // The preference changed while the page was open. The slide duration follows
  // it in both directions — it is a setting, not a choice somebody made here —
  // while the rotation is stopped one way only: switching the preference off
  // again does not start anything, because staying still is the safe default
  // and the control is right there. marquee reads it the same way.
  handleReducedMotion = (event) => {
    this.applyMotionPreference();

    if (!event.matches) return;

    this.setRotation(false);
  };



  // Focus entered the slider. Two things follow, and both are about the
  // reader now being inside it: the arrow keys become this slider's (Swiper's
  // Keyboard module listens on `document`, so leaving it enabled would let one
  // press step every slider in the viewport), and a rotation pauses, because
  // content moving under a keyboard user reading it is the case WCAG 2.2.2 is
  // about.
  // A full stop and a fresh start rather than Swiper's own pause/resume pair:
  // those two carry the library's "paused by an interaction" bookkeeping and
  // hand the remaining fraction of a delay back, which is right for a pointer
  // brushing past and wrong here. Somebody who tabbed into a slider, read it
  // and tabbed on should get the whole delay, not the 400 ms that were left.
  handleFocusIn = () => {
    this.swiper.keyboard?.enable();
    if (this.rotating) this.swiper.autoplay?.stop();
  };



  // Focus left the slider — `relatedTarget` is where it went, and null when it
  // went nowhere the page can name (a browser chrome control, another window),
  // which counts as "left". The rotation only comes back if the reader never
  // stopped it themselves.
  handleFocusOut = (event) => {
    if (this.root.contains(event.relatedTarget)) return;

    this.swiper.keyboard?.disable();
    if (this.rotating) this.swiper.autoplay?.start();
  };



  // A responsive --slider-gap follows the viewport, so the value Swiper was
  // handed at init is re-read when it changes. Guarded by the comparison: a
  // gap that did not change must not cost a second layout pass on every
  // resize frame, and update() would otherwise run inside the resize Swiper
  // is already handling.
  handleResize = () => {
    const gap = this.readGap();
    if (gap === this.swiper.params.spaceBetween) return;

    this.swiper.params.spaceBetween = gap;
    this.swiper.update();
  };



  // Optional teardown for hosts that mount/unmount the same subtree
  // repeatedly — see destroyModulesInScope() in boot.js. Everything that
  // outlives this component's own nodes is handed back: the two focus
  // listeners and the media-query listener, the vendor instance (with its
  // inline styles and its own classes), the injected controls, the vendor
  // classes, the ARIA Swiper wrote onto markup this module does not own, and
  // the ready attribute last of all — so what is left standing is the
  // scroll-snap strip the author wrote.
  destroy = () => {
    this.root.removeEventListener('focusin', this.handleFocusIn);
    this.root.removeEventListener('focusout', this.handleFocusOut);
    this.reducedMotion.removeEventListener('change', this.handleReducedMotion);
    this.rotationButton?.removeEventListener('click', this.handleRotationClick);

    // (deleteInstance, cleanStyles): the second argument is what takes the
    // inline transforms and widths off the track and the slides again.
    this.swiper?.destroy(true, true);
    this.controls?.remove();

    // Every class the vendor prefixed, not just the one this module wrote:
    // Swiper's destroy() takes back the container classes it tracks, but it
    // adds "swiper-backface-hidden" outside that bookkeeping and leaves it
    // behind (measured). Sweeping the prefix rather than naming that one class
    // is what keeps a version bump from quietly leaving a new stray behind.
    const { config } = this;
    Array.from(this.root.classList)
      .filter((name) => name.startsWith(config.vendorRootClass))
      .forEach((name) => this.root.classList.remove(name));

    this.track.classList.remove(config.vendorTrackClass);
    this.slides.forEach((slide) => {
      slide.classList.remove(config.vendorSlideClass);
    });

    this.heldAttrs.forEach(([node, name, value]) => {
      if (value === null) {
        node.removeAttribute(name);
        return;
      }

      node.setAttribute(name, value);
    });

    this.root.removeAttribute(config.readyAttr);
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'slider',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  const track = el.querySelector(defaults.selTrack);

  if (!track) {
    reporter?.report(
      'slider',
      `no ${defaults.selTrack} inside the component root — there is nothing ` +
      'holding the slides, so the ready attribute is withheld and the ' +
      'authored markup stays as it is.', el
    );
    return;
  }

  // Every element child of the track is a slide. Asking for the children
  // rather than for a per-slide hook is what keeps an editor's job to "add a
  // list item" — and it is also the reason the track needs a marker of its own
  // rather than being guessed at.
  const slides = Array.from(track.children);

  // Fewer than two slides is not an author error, it is a slider an editor
  // filled with one thing. No controls, no instance, no ready attribute: the
  // markup is already exactly what it should look like.
  if (slides.length < defaults.minSlides) return;

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new Slider(el, track, slides, defaults, reporter);
  return instance.destroy;
}
