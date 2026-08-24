/**
 * marquee.js
 * --------------------------------------------------------------------------
 * Turns a strip of content into an infinitely scrolling marquee (news
 * ticker). The obsolete <marquee> element is gone for good reasons, and CSS
 * alone cannot loop arbitrary content seamlessly: a gapless loop needs the
 * content measured, cloned often enough to cover the viewport and
 * re-evaluated on every resize. That measuring work is what this script does.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * Without JavaScript the markup is a plain, fully readable strip: the track
 * sits statically in its clipping container (structure shipped in
 * marquee.scss) and no content is duplicated. The motion is pure extra —
 * nothing meaningful depends on it.
 *
 * What this script adds
 * ---------------------
 * 1. Clone management: the track is cloned just often enough (at least
 *    `clones`, more on a wider viewport) that one full cycle never exposes a
 *    gap. The count is re-evaluated (debounced) on resize, via
 *    ResizeObserver, after fonts load and on window load. It follows from the
 *    visible width, and that width is capped at the viewport so the
 *    clones can never be what asks for more clones — see getVisibleWidth.
 * 2. The animation itself, via the Web Animations API — each track travels
 *    exactly one track width per cycle, so the loop is seamless. No inline
 *    styles; pausing/resuming happens on the Animation objects.
 * 3. An optional "overflow" start mode that animates only while the content
 *    is wider than the visible track, and stops (and cleans up its clones)
 *    once everything fits.
 * 4. Pause control: hovering pauses, focus inside the track pauses, and an
 *    author-provided toggle button ([data-marquee-toggle]) lets the user
 *    pause/resume explicitly (WCAG 2.2.2 Pause, Stop, Hide).
 *
 * Placement: the container needs a width of its own
 * -------------------------------------------------
 * The clipping container clips only while an ancestor holds it to a width.
 * In this collection's own layout <body> is a grid, so a marquee dropped
 * straight into it is fine — but one placed inside anything else (a tabs
 * panel, a <details>, a wrapper of the project's own) sits in a box whose
 * default min-inline-size: auto lets it grow with its content. Then the
 * strip never clips: the tracks stand side by side and push the page
 * sideways instead of being cut off. Give such a wrapper
 * min-inline-size: 0 — which is what _demo.scss does for .shell, for
 * exactly this reason. The module reports the condition where it measures
 * it and keeps running at a clone count capped to the viewport.
 *
 * Accessibility
 * -------------
 * - Clones are a purely visual repetition: they get aria-hidden="true" and
 *   `inert`, and cloned ids are stripped, so assistive tech and the tab order
 *   only ever see the original track.
 * - `prefers-reduced-motion: reduce` starts the marquee paused; pressing the
 *   toggle is an explicit opt-in to motion. When the preference flips to
 *   "reduce" at runtime the marquee pauses again. This lives here rather than
 *   in CSS because the animation is WAAPI, which a media query cannot stop.
 * - The toggle follows the APG toggle-button pattern: the author keeps a
 *   constant label ("Pause"), the script reflects the state via aria-pressed.
 *   The button ships `hidden` in the markup and is only revealed by the
 *   script, so a page without JS shows no dead control.
 * - No live region: the moving text is the original, readable content;
 *   announcing every loop would be pure noise.
 *
 * Configuration (all optional; on the element carrying
 * data-js-behavior="marquee")
 * --------------------------------------------------------------------------
 * - `data-marquee-direction="left|right"`  visual scroll direction (default
 *                                          "left")
 * - `data-marquee-start="always|overflow"` "overflow" animates only while the
 *                                          content is wider than the visible
 *                                          track (default "always")
 * - `data-marquee-speed="80"`              pixels per second (positive number,
 *                                          default 80) — a constant velocity,
 *                                          so tickers with differently long
 *                                          content all scroll at the same
 *                                          pace
 * - `[data-marquee-toggle]`                an optional <button> inside the module
 *                                          (outside the container!) wired as
 *                                          pause/play toggle
 *
 * Styling contract
 * ----------------
 * marquee.scss ships only the structure the animation cannot work without
 * (clipping flex row, non-shrinking track, `--marquee-gap` between
 * repetitions). Everything visible is the consuming project's design, styled
 * via its own classes and the state hooks this script writes (and never reads
 * back):
 *   - `is-running` on the module element  animations are built
 *   - `is-paused` on the module element   the user chose pause
 * --------------------------------------------------------------------------
 */



// Copy-paste note: requires _shared/js/debounce.js
// (copy it along into the target project)
import { debounceThenExecute } from './debounce.js';



const defaults = {

  // Behavioural hooks (data attributes, not style classes, so the JS stays
  // decoupled from the CSS). All of them live inside the module element.
  selContainer: '[data-marquee-container]', // clipping viewport (flex row)
  selAnimated: '[data-marquee-animated]',   // the track that scrolls
  selToggle: '[data-marquee-toggle]',       // optional pause/play button

  // Flag written onto generated clone tracks so they can be recognized,
  // styled and removed again.
  cloneAttr: 'data-marquee-clone',

  // Per-instance option attributes (see the header comment) and their
  // fallbacks when an attribute is absent or invalid.
  directionAttr: 'data-marquee-direction',
  direction: 'left',          // visual scroll direction (left|right)
  startAttr: 'data-marquee-start',
  startMode: 'always',        // always | overflow (run only on overflow)
  speedAttr: 'data-marquee-speed',
  speed: 80,                  // px/s — one constant velocity for the whole
                              // cycle, so tickers with differently long
                              // content all scroll at the same pace
  // Seconds for one cycle, only a transient fallback before the track can be
  // measured — speed needs a width to turn into a duration (see
  // getCycleDuration).
  fallbackCycleSeconds: 8,

  // Clone count used only while the track cannot be measured yet (a width of
  // zero). Once it can be, the count follows from the viewport and the track
  // width, so there is nothing to configure — see getRequiredCloneCount.
  fallbackClones: 3,

  // State classes written on the module element (styling hooks only; the JS
  // never reads them back).
  runningClass: 'is-running', // animations are built (possibly paused)
  pausedClass: 'is-paused',   // the USER chose pause (toggle / reduced
                              // motion) — not set for transient hover or
                              // focus pauses

  // How long a resize burst may settle before overflow and clone count are
  // re-evaluated.
  debounceMs: 100,
};



class Marquee {

  constructor(root, config, reporter) {
    this.root = root;
    this.config = config;
    this.reporter = reporter;

    this.container = root.querySelector(config.selContainer);
    this.animated = root.querySelector(config.selAnimated);
    this.toggle = root.querySelector(config.selToggle);
    this.parent = root.parentElement;

    if (!this.container) {
      this.reportMissing('container', config.selContainer);
      return;
    }

    if (!this.animated) {
      this.reportMissing('animated', config.selAnimated);
      return;
    }

    // Exactly one track is expected: it is the element cloned and animated.
    // Extra tracks are silently ignored by querySelector above, hence the
    // warning rather than letting a typo change the visible result unnoticed.
    if (root.querySelectorAll(config.selAnimated).length > 1) {
      this.reporter?.report(
        'marquee',
        `more than one "${config.selAnimated}" found; only the first track` +
        ' is animated and cloned — wrap all moving content in a single' +
        ' track.',
        this.root
      );
    }

    this.direction = this.readKeyword(
      config.directionAttr, ['left', 'right'], config.direction
    );
    this.startMode = this.readKeyword(
      config.startAttr, ['always', 'overflow'], config.startMode
    );
    this.speed = this.readNumber(config.speedAttr, config.speed);

    this.allAnimated = [];
    this.allAnimations = [];
    this.isRunning = false;
    this.resizeObserver = null;

    // One warning per instance about a container that does not clip (see
    // warnUnclipped) — the condition is re-measured on every rebuild, so
    // without this it would be reported on every resize frame.
    this.warnedUnclipped = false;

    // Seconds per cycle actually applied to the running animations, always
    // derived from the track width (see getCycleDuration). The fallback
    // stands in until the first measurement.
    this.cycleDuration = config.fallbackCycleSeconds;

    // Border-box width of the source track at the last (re)build. The
    // seamless loop relies on every track being an exact, equal-width copy,
    // so a change here forces a re-clone (see run).
    this.contentWidth = 0;

    // Three independent pause reasons; the animations run only while none
    // applies (see syncPlayState). Only userPaused is a durable choice,
    // reflected into aria-pressed / is-paused.
    this.hoverPaused = false;
    this.focusPaused = false;

    // Reduced motion starts the marquee paused; the toggle then acts as an
    // explicit opt-in to motion.
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.userPaused = this.reducedMotion.matches;

    this.recompute = debounceThenExecute(this.evaluate, config.debounceMs);

    this.setup();
  }



  setup = () => {
    this.wireToggle();
    this.wirePauseListeners();
    this.observeResize();
    this.reducedMotion.addEventListener('change', this.handleMotionChange);

    // Reflect the initial (possibly reduced-motion) pause state before the
    // first animation exists.
    this.syncPlayState();

    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', this.afterLayout, { once: true })
      : this.afterLayout();

    // Web fonts and late-loading assets change the track width, so the
    // overflow / clone math is re-run once they have settled.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(this.recompute).catch(() => {});
    }

    window.addEventListener('load', this.recompute, { once: true });
  };



  // Reveals and wires the author-provided pause/play toggle. The button ships
  // `hidden` in the markup, so a page without JS never shows a dead control.
  // An endlessly moving marquee with no pause mechanism fails WCAG 2.2.2,
  // hence the warning.
  wireToggle = () => {
    if (!this.toggle) {
      this.reporter?.report(
        'marquee',
        `no ${this.config.selToggle} button found — auto-playing motion` +
        ' should offer a pause control (WCAG 2.2.2).',
        this.root
      );
      return;
    }

    this.toggle.hidden = false;
    this.toggle.addEventListener('click', this.handleToggle);
  };



  // Pauses while the pointer hovers the track or focus is inside it (a
  // keyboard user reading a link should not have it run away).
  wirePauseListeners = () => {
    this.container.addEventListener('mouseenter', this.handleMouseEnter);
    this.container.addEventListener('mouseleave', this.handleMouseLeave);
    this.container.addEventListener('focusin', this.handleFocusIn);
    this.container.addEventListener('focusout', this.handleFocusOut);
  };



  // Watches every element whose size affects the overflow / clone math.
  observeResize = () => {
    window.addEventListener('resize', this.recompute, { passive: true });

    if (!('ResizeObserver' in window)) return;

    this.resizeObserver = new ResizeObserver(this.recompute);
    const observedElements = [
      this.parent, this.root, this.container, this.animated,
    ];

    observedElements
      .filter((element) => element instanceof HTMLElement)
      .forEach((element) => this.resizeObserver.observe(element));
  };



  // Waits for layout to settle (two frames) before the first measurement.
  afterLayout = () => {
    requestAnimationFrame(() => requestAnimationFrame(this.evaluate));
  };



  // Starts or stops the marquee based on the current start mode.
  evaluate = () => {
    if (this.shouldStart()) {
      this.run();
      return;
    }

    this.stop();
  };



  // Decides whether the marquee should currently animate.
  shouldStart = () => {
    if (this.startMode === 'always') return true;

    return this.hasHorizontalOverflow();
  };



  // Whether the track content exceeds the visible track width.
  hasHorizontalOverflow = () => {
    const visibleWidth = this.getVisibleWidth();

    if (!Number.isFinite(visibleWidth)) return false;

    return this.animated.scrollWidth - visibleWidth > 1;
  };



  // The smallest available visible width for the marquee track.
  //
  // The viewport is in the list, and it is the one candidate that is not a
  // convenience: the other three are boxes the clones themselves can widen.
  // A clipping container only stays put while an ancestor holds it to a width
  // — the moment one of them is free to grow with its content (a grid or flex
  // item at its default min-inline-size: auto is the usual way), the clones
  // widen the box, the wider box asks for more clones, and those widen it
  // again. Measured before this cap: 12 tracks after 0.7s, 23 after 2s, 39
  // after 4s, tens of thousands if the page is left alone.
  //
  // The viewport ends that, because nothing the reader can see is wider than
  // it: the strip never scrolls (it is overflow: hidden), so whatever part of
  // it lies past the viewport edge cannot come into view and needs no track
  // to fill it. Taking the minimum keeps every narrower box winning, so a
  // marquee in a 300px sidebar is unaffected — and so is every correctly
  // clipped one, whose container is inside the viewport anyway.
  getVisibleWidth = () => {
    const widths = [
      this.container.clientWidth,
      this.root.clientWidth,
      document.documentElement.clientWidth,
    ];

    if (this.parent instanceof HTMLElement) {
      widths.push(this.parent.clientWidth);
    }

    return widths
      .filter((value) => Number.isFinite(value) && value > 0)
      .reduce(
        (smallest, value) => Math.min(smallest, value),
        Number.POSITIVE_INFINITY
      );
  };



  // The cap above keeps the clone count finite, but it cannot make the strip
  // clip: a container wider than the viewport is one no ancestor holds to a
  // width, so the tracks stand side by side in the open and push the page
  // into a horizontal scrollbar (WCAG 1.4.10) instead of being cut off.
  // Since the marquee's own content is what widens such a box, the layout
  // mistake shows up here first, and it is an authoring one — hence the
  // reporter.
  //
  // clientWidth is the padding box, not the content: a container that DOES
  // clip stays at its clipped width however many tracks are inside it, so
  // this cannot fire for a correctly placed marquee.
  warnUnclipped = () => {
    if (this.warnedUnclipped) return;
    if (this.container.clientWidth <= document.documentElement.clientWidth) {
      return;
    }

    this.warnedUnclipped = true;
    this.reporter?.report(
      'marquee',
      `${this.config.selContainer} is wider than the viewport, so it is not` +
      ' clipping: an ancestor is being widened by the marquee\'s own tracks.' +
      ' A grid or flex item at its default min-inline-size: auto is the usual' +
      ' cause — set min-inline-size: 0 on it (or give the marquee a container' +
      ' with a width of its own). The clone count is capped at the viewport' +
      ' meanwhile, so the marquee still runs.',
      this.root
    );
  };



  // Builds the clones and their animations, and rebuilds them whenever the
  // structure the seamless loop depends on changed: the required clone count
  // (viewport resized) OR the source track's width. Width matters because
  // every track is translated by exactly 100% of its OWN box per cycle, so
  // the loop stays seamless only while all tracks are exact, equal-width
  // copies. A nested widget mutating the original AFTER it was cloned (a
  // countdown injecting its pause control, web fonts widening the text)
  // changes that width, hence the re-clone to restore parity — and the
  // re-pace to the new width.
  //
  // Writes stay idempotent, and that takes both halves of the input: a
  // re-clone does not change the ORIGINAL track's width, and the clone count
  // is derived from a width the clones cannot inflate (see getVisibleWidth).
  // The first half alone is not enough — it was, for a while, and a marquee
  // whose container was free to grow cloned itself without bound. So a
  // ResizeObserver notification caused by our own clone insertion settles
  // instead of looping.
  run = () => {
    const contentWidth = this.animated.offsetWidth;
    const requiredCloneCount = this.getRequiredCloneCount();

    // Before the early return, so a marquee that has settled at the capped
    // count still says why it is not clipping.
    this.warnUnclipped();

    if (
      this.isRunning &&
      this.getCurrentCloneCount() === requiredCloneCount &&
      this.contentWidth === contentWidth
    ) return;

    if (this.isRunning) {
      this.cancelAnimations();
      this.removeClones();
    }

    this.contentWidth = contentWidth;
    this.cycleDuration = this.getCycleDuration();
    this.cloneItems(requiredCloneCount);
    this.setAnimation();
    this.isRunning = true;
    this.root.classList.add(this.config.runningClass);

    // Freshly created animations auto-play; re-applying the current pause
    // state keeps a paused marquee paused across a rebuild.
    this.syncPlayState();
  };



  // Stops the animation and removes the runtime clones — the DOM returns to
  // its original, unenhanced state.
  stop = () => {
    if (!this.isRunning) return;

    this.cancelAnimations();
    this.removeClones();
    this.isRunning = false;
    this.root.classList.remove(this.config.runningClass);
  };



  // How many clones are needed to avoid visible gaps: enough tracks that
  // viewport + one full cycle of travel is always covered. The extra track
  // covers the travel itself — during one cycle the leading one moves out by
  // its own width — and one clone is the floor, since a single track cannot
  // follow itself.
  getRequiredCloneCount = () => {
    const contentWidth = this.animated.scrollWidth;
    const visibleWidth = this.getVisibleWidth();
    const fallback = this.config.fallbackClones;

    if (!Number.isFinite(contentWidth) || contentWidth <= 0) return fallback;
    if (!Number.isFinite(visibleWidth) || visibleWidth <= 0) return fallback;

    const requiredTracks = Math.ceil(visibleWidth / contentWidth) + 1;

    return Math.max(requiredTracks - 1, 1);
  };



  // The number of managed clone tracks.
  getCurrentCloneCount = () => Math.max(this.allAnimated.length - 1, 0);



  // Duplicates the track often enough to fill the animation loop.
  cloneItems = (cloneCount) => {
    if (this.allAnimated.length) return;

    this.allAnimated.push(this.animated);
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < cloneCount; i++) {
      const clone = this.animated.cloneNode(true);

      clone.setAttribute(this.config.cloneAttr, '');

      // Clones are a purely visual repetition of the original track: inert
      // takes them out of the accessibility tree and the tab order in one go;
      // aria-hidden is the belt and braces for engines without inert support.
      // Cloned ids are stripped so the document keeps its ids unique.
      clone.setAttribute('aria-hidden', 'true');
      clone.inert = true;
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));

      fragment.appendChild(clone);
      this.allAnimated.push(clone);
    }

    this.container.appendChild(fragment);
  };



  // Removes the generated clone tracks from the container.
  removeClones = () => {
    this.container
      .querySelectorAll(`[${this.config.cloneAttr}]`)
      .forEach((clone) => clone.remove());

    this.allAnimated = [];
  };



  // Seconds for one full cycle (one track width of travel), derived from the
  // CURRENT track width so every marquee scrolls at the same pixel velocity
  // however long its content is. The fixed fallback stands in only while the
  // width cannot be measured yet.
  getCycleDuration = () => {
    const trackWidth = this.animated.offsetWidth;
    if (!Number.isFinite(trackWidth) || trackWidth <= 0) {
      return this.config.fallbackCycleSeconds;
    }

    return trackWidth / this.speed;
  };



  // Starts a Web Animation on every managed track. No inline styles involved
  // — pausing and cancelling happen on the Animation objects.
  setAnimation = () => {
    const keyframes = this.getKeyframes();

    this.allAnimations = this.allAnimated.map((animated) =>
      animated.animate(keyframes, {
        duration: this.cycleDuration * 1000,
        iterations: Infinity,
      })
    );
  };



  // Physical keyframes for one seamless cycle: each track travels exactly one
  // track width (100% of its own border box — which is why the repetition gap
  // must be padding, see marquee.scss). Physical is all there is to pick from
  // (there is no logical translate), and the project ships left-to-right
  // only, so there is no mirrored range to choose between either.
  getKeyframes = () => {
    if (this.direction === 'left') {
      return [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-100%)' },
      ];
    }

    return [
      { transform: 'translateX(-100%)' },
      { transform: 'translateX(0)' },
    ];
  };



  // Cancels all active Web Animation instances.
  cancelAnimations = () => {
    this.allAnimations.forEach((animation) => animation.cancel());
    this.allAnimations = [];
  };



  // The single place that applies the combined pause state. Class and
  // aria-pressed reflect only the durable USER choice; hover/focus pauses are
  // transient and stay invisible to styling and AT.
  syncPlayState = () => {
    const paused = this.userPaused || this.hoverPaused || this.focusPaused;

    this.root.classList.toggle(this.config.pausedClass, this.userPaused);
    this.toggle?.setAttribute('aria-pressed', String(this.userPaused));

    this.allAnimations.forEach((animation) => {
      if (paused) {
        animation.pause();
        return;
      }

      animation.play();
    });
  };



  handleToggle = () => {
    this.userPaused = !this.userPaused;
    this.syncPlayState();
  };



  handleMouseEnter = () => {
    this.hoverPaused = true;
    this.syncPlayState();
  };



  handleMouseLeave = () => {
    this.hoverPaused = false;
    this.syncPlayState();
  };



  handleFocusIn = () => {
    this.focusPaused = true;
    this.syncPlayState();
  };



  handleFocusOut = (event) => {

    // Focus moving between elements inside the track is no reason to resume.
    if (event.relatedTarget && this.container.contains(event.relatedTarget)) return;

    this.focusPaused = false;
    this.syncPlayState();
  };



  // A runtime switch TO "reduce" pauses the marquee. Switching away does not
  // auto-resume — staying still is the safe default, and the toggle is right
  // there.
  handleMotionChange = (event) => {
    if (!event.matches) return;

    this.userPaused = true;
    this.syncPlayState();
  };



  // Reads a keyword option from the module element. A missing attribute falls
  // back silently; a present but invalid value falls back WITH a warning, so
  // a typo never silently changes the behaviour.
  readKeyword = (attr, allowed, fallback) => {
    const raw = this.root.getAttribute(attr);
    if (raw === null) return fallback;

    const value = raw.trim().toLowerCase();
    if (allowed.includes(value)) return value;

    this.reporter?.report(
      'marquee',
      `"${raw}" is not a valid ${attr} (${allowed.join('|')});` +
      ` using "${fallback}".`,
      this.root
    );
    return fallback;
  };



  // Same contract as readKeyword, for a positive numeric option.
  readNumber = (attr, fallback) => {
    const raw = this.root.getAttribute(attr);
    if (raw === null) return fallback;

    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;

    this.reporter?.report(
      'marquee',
      `"${raw}" is not a valid ${attr} (positive number); using ${fallback}.`,
      this.root
    );
    return fallback;
  };



  reportMissing = (name, selector) => {
    this.reporter?.report(
      'marquee',
      `missing "${name}" element (selector: "${selector}").`,
      this.root
    );
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly —
  // see destroyModulesInScope() in boot.js. Cancels animations and clones
  // (mirrors stop()), then removes every listener/observer that would outlive
  // this subtree: window resize/load, the ResizeObserver and the
  // reduced-motion change listener. Guarded throughout because construction
  // can bail out early (missing container/track) before any of these exist.
  destroy = () => {
    this.stop();
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.recompute);
    window.removeEventListener('load', this.recompute);
    this.reducedMotion?.removeEventListener('change', this.handleMotionChange);
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report('marquee', 'module was initialized on a non-element node.', el);
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new Marquee(el, defaults, reporter);
  return instance.destroy;
}
