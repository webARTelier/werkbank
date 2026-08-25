/**
 * video.js
 * --------------------------------------------------------------------------
 * Progressive-enhancement controller for CMS-maintained, SELF-HOSTED video:
 * a <video> with responsive sources — art direction (different footage /
 * aspect ratios per viewport) and resolution ladders (same footage, higher
 * pixel density), both declared as plain <source media="…"> elements — in
 * two behavioural modes the markup picks (click-to-play, and the ambient
 * loop an `autoplay` attribute asks for).
 *
 * Third-party video is NOT this module's business. It used to be: a YouTube
 * click-to-load facade shipped here as a second flavour, and it moved to
 * `embedConsent`, which generalises it to Vimeo, maps and anything else with
 * an iframe — and adds the two halves a bare poster-plus-play-button facade
 * never had. The information layer that makes the click an informed one, and
 * the seam that lets a visitor's existing consent skip the click. See
 * src/components/embedConsent/. One question, one answer: nothing in this
 * file knows a third-party host any more.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * - <source media="…"> inside <video> is native in current browsers: at load
 *   time the browser picks the first source whose media query matches.
 *   Without JavaScript a self-hosted video therefore already shows the right
 *   variant — and, with the `controls` attribute shipped in the markup, is
 *   fully operable.
 * - `autoplay muted loop playsinline` runs an ambient video natively.
 * - What the platform does NOT do: re-evaluate the media queries when the
 *   viewport changes after load (rotate, resize), hide/show the native
 *   controls around a custom play button, or pause ambient videos for
 *   reduced-motion users. Those gaps are all this script fills.
 *
 * What this script adds
 * ---------------------
 * 1. Source re-selection: it mirrors the native first-match-wins rule over
 *    the <source media> list via matchMedia, listens for media-query changes
 *    and — only when the chosen URL actually differs — swaps video.src while
 *    carrying playback position and play state over.
 * 2. Click-to-play mode (default): the native controls from the markup are
 *    taken over by a single centered play button; a click hides the button,
 *    reveals the native controls and plays. Pause/end hides the controls and
 *    brings the play button back.
 * 3. Ambient mode (the <video> carries `autoplay`): a persistent play/pause
 *    toggle (WCAG 2.2.2), and `prefers-reduced-motion: reduce` prevents the
 *    autostart — pressing play is the explicit opt-in.
 *
 * Accessibility
 * -------------
 * - The toggle button ships `hidden` in the markup and is only revealed by
 *   the script, so a page without JS never shows a dead control; the no-JS
 *   baseline is the native `controls`.
 * - Button labels are localized (de/en from <html lang>) and switch between
 *   "play" and "pause"; the icons are aria-hidden, the state is also mirrored
 *   as an `is-playing` class for styling.
 * - The click-to-play mode hands focus over in both directions: when the
 *   focused play button hides, focus moves to the <video> (whose native
 *   controls just appeared); when a pause removes the native controls again,
 *   focus moves from the <video> back to the reappearing play button.
 * - Reduced motion starts ambient videos paused (see above).
 *
 * Configuration (on the element carrying data-js-behavior="video")
 * ---------------------------------------------------------------
 * - `[data-video-toggle]`             the play (or play/pause) button inside
 *                                     the module, shipped `hidden`.
 * - Everything else is configured through native attributes alone:
 *   `controls` (no-JS baseline, taken over by the script), `autoplay muted
 *   loop playsinline` (ambient mode), `poster`, `preload` and the <source
 *   media> list.
 *
 * Styling contract
 * ----------------
 * The script sets no inline styles. It toggles `hidden` on the button and
 * writes `is-playing` on the module element; video.scss keys on exactly
 * these hooks. The m-video* classes are styling only — the JS never touches
 * them.
 * --------------------------------------------------------------------------
 */

import { resolveLocale } from './resolveLocale.js';



const defaults = {

  // Behavioural hooks (data attributes, not style classes, so the JS stays
  // decoupled from the CSS). All of them live inside the module element.
  selVideo: 'video',                    // the self-hosted video
  selToggle: '[data-video-toggle]',     // play / play-pause button

  // State class written on the module element (styling hook only; the JS
  // never reads it back).
  playingClass: 'is-playing',

  // <html lang> matching none of the offered locales falls back to this.
  fallbackLocale: 'en',
};



// Localized accessible names for the toggle button. The label switches
// between play and pause (media-player convention) rather than staying
// constant with aria-pressed, because "what pressing does next" is the
// clearer announcement for a transport control.
const labels = {

  de: {
    play: 'Video abspielen',
    pause: 'Video pausieren',
  },

  en: {
    play: 'Play video',
    pause: 'Pause video',
  },
};



// --------------------------------------------------------------------------
// Self-hosted <video>: responsive source switching + the two play modes.
// --------------------------------------------------------------------------
class HostedVideo {

  constructor(root, video, config, reporter) {
    this.root = root;
    this.video = video;
    this.config = config;
    this.reporter = reporter;

    this.toggle = root.querySelector(config.selToggle);
    this.labels = labels[
      resolveLocale(Object.keys(labels), config.fallbackLocale)
    ];

    // The behaviour mode comes from the native attribute, read once: a video
    // that declares `autoplay` is an ambient loop with a persistent toggle;
    // anything else is click-to-play behind a single play button.
    this.ambient = video.hasAttribute('autoplay');

    // Ordered snapshot of the <source> list. The script re-runs the native
    // first-match-wins selection over it whenever a media query flips (see
    // selectSource).
    this.sources = Array.from(video.querySelectorAll('source'))
      .map((source) => ({
        src: source.getAttribute('src') || '',
        media: source.getAttribute('media') || '',
      }))
      .filter((source) => source.src !== '');

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.setup();
  }



  setup = () => {
    if (!this.sources.length && !this.video.getAttribute('src')) {
      this.reporter?.report(
        'video',
        'the <video> has neither <source> children nor a src attribute —' +
        ' nothing to play.',
        this.root
      );
      return;
    }

    this.selectSource();
    this.observeMediaQueries();

    this.video.addEventListener('play', this.handlePlay);
    this.video.addEventListener('pause', this.handlePause);

    this.ambient ? this.setupAmbient() : this.setupClickToPlay();
  };



  // Ambient mode: the platform autostarts the muted loop; the script adds the
  // WCAG 2.2.2 pause control and the reduced-motion opt-out.
  setupAmbient = () => {
    if (!this.toggle) {
      this.reporter?.report(
        'video',
        `no ${this.config.selToggle} button found — an autoplaying video` +
        ' must offer a pause control (WCAG 2.2.2).',
        this.root
      );
    }

    this.wireToggle();

    // Reduced motion: prevent the autostart instead of racing it. Clearing
    // the autoplay flag stops a not-yet-started playback; pause() covers the
    // case where it already began. Playing stays available as an explicit
    // opt-in via the toggle.
    if (this.reducedMotion.matches) {
      this.video.autoplay = false;
      this.video.pause();
    }

    this.reducedMotion.addEventListener('change', this.handleMotionChange);
    this.syncState();
  };



  // Click-to-play mode: the markup ships native `controls` as the no-JS
  // baseline; the script takes them over and puts the single centered play
  // button in front. Without a toggle button there would be no way to start
  // the video, so there the native controls stay.
  setupClickToPlay = () => {
    if (!this.toggle) {
      this.reporter?.report(
        'video',
        `no ${this.config.selToggle} button found — leaving the native` +
        ' controls in place.',
        this.root
      );
      return;
    }

    this.video.controls = false;
    this.wireToggle();
    this.syncState();
  };



  wireToggle = () => {
    if (!this.toggle) return;

    this.toggle.hidden = false;
    this.toggle.addEventListener('click', this.handleToggle);
  };



  // Watches every media query the source list uses, so a viewport change
  // (resize, rotation, moving to a high-density screen) re-runs the
  // selection. matchMedia change events fire exactly on a boundary cross — no
  // debounce needed.
  observeMediaQueries = () => {
    const queries = [...new Set(
      this.sources.map((source) => source.media).filter(Boolean)
    )];

    // Kept on the instance (not just wired and discarded) so destroy() can
    // later remove exactly these listeners — window.matchMedia is not
    // guaranteed to return the same MediaQueryList object for the same query
    // string on a later call.
    this.mediaQueryLists = queries.map((query) => {
      const mq = window.matchMedia(query);

      // An unparseable query serializes to "not all" and would silently never
      // match — surface the typo instead.
      if (mq.media === 'not all' && query !== 'not all') {
        this.reporter?.report(
          'video',
          `"${query}" is not a valid media query; this <source> can never` +
          ' match.',
          this.root
        );
      }

      mq.addEventListener('change', this.handleMediaChange);
      return mq;
    });
  };



  // Mirrors the native selection rule (first source whose media query
  // matches; an attribute-less source matches always) and applies it only
  // when the outcome actually changed. Playback position and play state
  // survive the swap: the position is re-applied once the new source's
  // metadata is in.
  selectSource = () => {
    if (!this.sources.length) return;

    const choice = this.sources.find(
      (source) => !source.media || window.matchMedia(source.media).matches
    );

    if (!choice) {
      this.reporter?.report(
        'video',
        'no <source> matches the current viewport — add one without a' +
        ' media attribute as the fallback (last in the list).',
        this.root
      );
      return;
    }

    const resolved = new URL(choice.src, document.baseURI).href;
    if (this.video.currentSrc === resolved) return;

    const wasPlaying = !this.video.paused && !this.video.ended;
    const position = this.video.currentTime;

    this.video.src = choice.src;

    if (position > 0) {
      this.video.addEventListener('loadedmetadata', () => {
        this.video.currentTime = position;
      }, { once: true });
    }

    if (wasPlaying) {
      this.video.play().catch(() => {});
    }
  };



  // The single place that reflects the play state: the is-playing class
  // drives the icon swap, the label announces what pressing does next, and in
  // click-to-play mode the native controls swap with the button.
  syncState = () => {
    const playing = !this.video.paused && !this.video.ended;

    this.root.classList.toggle(this.config.playingClass, playing);

    if (!this.toggle) return;

    this.toggle.setAttribute(
      'aria-label', playing ? this.labels.pause : this.labels.play
    );

    if (this.ambient) return;

    // Click-to-play: while playing the native controls own the surface and
    // the big play button disappears; on pause/end they swap back.
    this.video.controls = playing;

    // Hiding the toggle while it holds the keyboard focus would drop the
    // focus to <body>, stranding keyboard users at the top of the page. Hand
    // it to the video first (focusable — its native controls just came
    // back). Guarded by activeElement so play events from elsewhere (e.g. a
    // source swap resuming playback) never steal the user's focus.
    if (playing && document.activeElement === this.toggle) {
      this.video.focus();
    }

    this.toggle.hidden = playing;

    // Same handoff in reverse: pausing via the native controls leaves the
    // focus on the <video>, whose controls — and with them its keyboard
    // operability — were just removed. Hand it to the play button that took
    // the surface back over. The activeElement guard again keeps a pause from
    // elsewhere (e.g. programmatic) from stealing the focus.
    if (!playing && document.activeElement === this.video) {
      this.toggle.focus();
    }
  };



  handleToggle = () => {
    if (this.video.paused || this.video.ended) {
      this.video.play().catch(() => {});
      return;
    }

    this.video.pause();
  };



  handlePlay = () => this.syncState();

  handlePause = () => this.syncState();

  handleMediaChange = () => this.selectSource();



  // A runtime switch TO "reduce" pauses the ambient loop. Switching away does
  // not auto-resume — staying still is the safe default; the toggle is right
  // there.
  handleMotionChange = (event) => {
    if (!event.matches) return;

    this.video.pause();
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly
  // instead of doing a full page (re)load — see destroyModulesInScope() in
  // boot.js. The video/toggle listeners are bound to elements inside this
  // subtree and would die naturally with it; the matchMedia change listeners
  // (source-selection queries and reduced-motion) are not DOM-attached and
  // outlive the subtree unless explicitly removed.
  destroy = () => {
    this.mediaQueryLists?.forEach((mq) => {
      mq.removeEventListener('change', this.handleMediaChange);
    });
    this.reducedMotion?.removeEventListener('change', this.handleMotionChange);
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'video',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const video = el.querySelector(defaults.selVideo);

  if (video) {
    const instance = new HostedVideo(el, video, defaults, reporter);
    return instance.destroy;
  }

  reporter?.report(
    'video',
    'no <video> child found — nothing to enhance. A third-party embed is'
    + ' embedConsent, not this module.',
    el
  );
}
