/**
 * countdown.js
 * ----------------------------------------------------------------------------
 * Renders a live countdown for one module instance and updates the mapped
 * day/hour/minute/second nodes from a target date provided in the markup.
 *
 * Strategy (mirrors the other components: recompute state from the source)
 * -----------------------------------------------------------------------
 * Every tick recomputes the remaining time from the target date against
 * Date.now() instead of decrementing a counter — like adaptiveScrollFade
 * reading scrollTop live and the accordion reading details.open live. So the
 * display cannot drift (no accumulating float error) and self-corrects after
 * the tab was throttled or asleep, where a decrementing setInterval would
 * "lose" seconds.
 *
 * Markup requirements
 * -------------------
 * The day/hour/minute nodes are required; if any is missing the module
 * reports and does not initialize. The seconds node is optional — without it
 * the countdown omits the seconds output and runs normally.
 *
 * Accessibility — auto-updating content (BITV/WCAG 2.2.2, Level A)
 * ---------------------------------------------------------------
 * A countdown auto-updates, starts on its own, lasts longer than five seconds
 * and sits next to other content, so WCAG 2.2.2 "Pause, Stop, Hide" requires
 * a mechanism to pause/stop the movement: a real <button> (keyboard operable,
 * labelled, aria-pressed) that stops and resumes the tick. It satisfies 2.2.2
 * for *all* users and is not conditional on any user preference. Under
 * prefers-reduced-motion the tick additionally slows to once per minute and
 * the fast-churning seconds unit is dropped, so users who asked for less
 * motion get no per-second flicker in the first place.
 *
 * Accessibility — screen-reader output (BITV/WCAG 4.1.3 / 1.3.1)
 * -------------------------------------------------------------
 * The visual units are a fragmented, per-second-changing view ("5" / "Days" /
 * ":" / "3" / "Hours" …). Announcing that every second would flood assistive
 * tech, so it leaves the accessibility tree (aria-hidden on the units) and
 * ONE coherent, natural-language sentence goes into a visually hidden node
 * instead ("5 days, 3 hours, 12 minutes remaining until …"). The display
 * wrapper carries role="timer", whose implicit aria-live is "off": screen
 * readers can read the current value on demand but are never interrupted. The
 * sentence is rewritten only when the minute value changes, so it stays cheap
 * and seconds never appear in it. When the target is reached a single polite
 * message goes out through a role="status" node — a legitimate one-off
 * announcement rather than a per-second stream.
 *
 * Localization
 * ------------
 * The spoken sentence and the pause control's label are chosen from <html
 * lang> (de/en, falling back to en) — the mechanism inputCharCount, video and
 * formValidation use. The strings live in the `labels` map as plain
 * templates, so adding a language is a set of strings and not a code change,
 * and the plural form of a unit ("1 Tag" / "2 Tage") is part of the message
 * id rather than something this module assembles.
 *
 * Marquee integration (optional)
 * ------------------------------
 * The usual case is a standalone countdown with no marquee involved. Placed
 * inside a marquee module (data-js-behavior="marquee"), which clones its
 * content for the scrolling effect, those clones carry duplicate countdown
 * markup that is never initialized as its own module — so syncMirrors pushes
 * the current values into the sibling clones. Without a marquee it is a
 * no-op.
 * ----------------------------------------------------------------------------
 */



import { resolveLocale } from './resolveLocale.js';
import { formatTemplate } from './formatTemplate.js';



const defaults = {
  selDays: '[data-countdown-days]',
  selHours: '[data-countdown-hours]',
  selMinutes: '[data-countdown-minutes]',
  selSeconds: '[data-countdown-seconds]',
  selDisplay: '[data-countdown-display]',
  selUnits: '[data-countdown-units]',
  selUnit: '[data-countdown-unit]', // a single unit wrapper (label + value)
  selSummary: '[data-countdown-summary]',

  dateAttr: 'data-countdown-date', // target date; selector derived from it
  labelAttr: 'data-countdown-label', // optional: what the countdown counts to

  tickMs: 1000, // normal cadence
  reducedTickMs: 60000, // cadence under prefers-reduced-motion

  // <html lang> matching none of the offered locales falls back to this.
  fallbackLocale: 'en',
};



// Localized text, keyed by locale then by a message id — the shape
// inputCharCount, video and formValidation use, so a translation is a set of
// plain strings rather than a code change. {placeholders} are interpolated
// from the live values by formatTemplate.
//
// The unit ids carry the plural form, because "1 Tag" and "2 Tage" are two
// different words: which form a count takes is a property of the language, so
// it belongs here and not in the arithmetic below.
//
// The *Labelled variants are for markup that names what the countdown counts
// to (data-countdown-label); without one the clause would dangle.
const labels = {

  de: {
    dayOne: '{count} Tag',
    dayOther: '{count} Tage',
    hourOne: '{count} Stunde',
    hourOther: '{count} Stunden',
    minuteOne: '{count} Minute',
    minuteOther: '{count} Minuten',

    summary: 'Noch {units}.',
    summaryLabelled: 'Noch {units} bis {label}.',
    finished: 'Der Countdown ist abgelaufen.',
    finishedLabelled: 'Der Countdown bis {label} ist abgelaufen.',

    togglePause: 'Countdown pausieren',
    toggleResume: 'Countdown fortsetzen',
  },

  en: {
    dayOne: '{count} day',
    dayOther: '{count} days',
    hourOne: '{count} hour',
    hourOther: '{count} hours',
    minuteOne: '{count} minute',
    minuteOther: '{count} minutes',

    summary: '{units} remaining.',
    summaryLabelled: '{units} remaining until {label}.',
    finished: 'The countdown has finished.',
    finishedLabelled: 'The countdown to {label} has finished.',

    togglePause: 'Pause countdown',
    toggleResume: 'Resume countdown',
  },
};



class Countdown {

  constructor(module, config, reporter) {
    this.module = module;
    this.reporter = reporter;
    this.config = config;

    const locale = resolveLocale(Object.keys(labels), config.fallbackLocale);
    this.labels = labels[locale] || labels[config.fallbackLocale];

    this.intervalId = null;
    this.paused = false;
    this.finished = false;
    this.lastSummary = '';

    // prefers-reduced-motion is read live so the cadence adapts if the user
    // flips the OS setting while the page is open.
    this.motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    this.initCountdown();
  }



  // resolves required nodes and starts the countdown loop.
  initCountdown = () => {
    const days = this.module.querySelector(this.config.selDays);
    const hours = this.module.querySelector(this.config.selHours);
    const minutes = this.module.querySelector(this.config.selMinutes);
    const seconds = this.module.querySelector(this.config.selSeconds);

    if (!days || !hours || !minutes) {
      this.handleMissingElements();
      return;
    }

    const targetMs = this.getTargetMs();
    if (targetMs === null) {
      this.handleMissingDate();
      return;
    }

    this.targetMs = targetMs;
    this.counterElements = { days, hours, minutes, seconds };

    // Walk up to the unit wrapper via its data hook (not the
    // .m-countdown__unit style class) so the whole seconds column can be
    // hidden under reduced motion without coupling behaviour to styling.
    this.secondsUnit = seconds ? seconds.closest(this.config.selUnit) : null;

    // Optional wiring for the accessibility tree, all progressive: without it
    // the countdown still works, it just exposes a less polished experience.
    this.display = this.module.querySelector(this.config.selDisplay) || this.module;
    this.units = this.module.querySelector(this.config.selUnits);
    this.summary = this.module.querySelector(this.config.selSummary);
    this.label = (this.module.getAttribute(this.config.labelAttr) || '').trim();

    this.setupAccessibility();
    this.start();
  };



  // Reads the target date from the module or its configured child element.
  // The selector is derived from dateAttr, so the attribute name lives in one
  // place.
  getTargetDate = () => {
    const selector = `[${this.config.dateAttr}]`;
    const targetDateElement = this.module.matches(selector)
      ? this.module
      : this.module.querySelector(selector);

    if (!targetDateElement) return '';

    return (targetDateElement.getAttribute(this.config.dateAttr) || '').trim();
  };



  // Parses the target date to an epoch timestamp; null when it is missing or
  // unparseable, so the caller can report and bail out.
  getTargetMs = () => {
    const raw = this.getTargetDate();
    if (!raw) return null;

    const ms = Date.parse(raw);
    return Number.isNaN(ms) ? null : ms;
  };



  // Wires up the accessibility tree once — see the file header for the
  // rationale.
  setupAccessibility = () => {

    // The flickering unit columns are decorative for screen readers.
    this.units?.setAttribute('aria-hidden', 'true');

    // role="timer" marks the value as a live-updating counter without forcing
    // announcements (implicit aria-live "off"). An author-set role is left
    // alone — and remembered, so destroy() takes back only ours.
    this.appliedRole = !this.display.hasAttribute('role');
    if (this.appliedRole) this.display.setAttribute('role', 'timer');

    // Single polite live region for the terminal "finished" message. Injected
    // here so authors do not have to hand-wire a11y plumbing.
    this.statusNode = document.createElement('span');
    this.statusNode.className = 'm-countdown__sr';
    this.statusNode.setAttribute('role', 'status');
    this.module.appendChild(this.statusNode);

    // The mechanism that satisfies WCAG 2.2.2 for every user.
    this.injectToggle();

    // React to OS-level reduced-motion changes while the page is open.
    this.motionQuery?.addEventListener?.('change', this.handleMotionChange);
    this.applyMotionPreference();
  };



  // The pause/resume control. A plain <button>, so keyboard and assistive
  // tech can operate it out of the box.
  injectToggle = () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'm-countdown__toggle';
    button.setAttribute('aria-pressed', 'false');
    button.textContent = this.labels.togglePause;
    button.addEventListener('click', this.toggle);

    this.module.appendChild(button);
    this.toggleButton = button;
  };



  toggle = () => {
    this.paused ? this.resume() : this.pause();
  };



  pause = () => {
    if (this.paused || this.finished) return;
    this.paused = true;
    this.stopInterval();
    this.module.setAttribute('data-countdown-paused', '');
    this.toggleButton.setAttribute('aria-pressed', 'true');
    this.toggleButton.textContent = this.labels.toggleResume;
  };



  resume = () => {
    if (!this.paused || this.finished) return;
    this.paused = false;
    this.module.removeAttribute('data-countdown-paused');
    this.toggleButton.setAttribute('aria-pressed', 'false');
    this.toggleButton.textContent = this.labels.togglePause;
    this.start();
  };



  // Under prefers-reduced-motion the per-second unit is hidden and the tick
  // drops to once per minute, so there is no fast flicker; outside it, both
  // come back.
  applyMotionPreference = () => {
    const reduced = !!this.motionQuery?.matches;
    this.secondsUnit?.toggleAttribute('hidden', reduced);
  };



  handleMotionChange = () => {
    this.applyMotionPreference();
    if (!this.paused && !this.finished) this.start(); // restart at new cadence
  };



  // Renders immediately and refreshes at the current cadence.
  start = () => {

    // A target already in the past finishes on the first render, handled
    // synchronously rather than waiting a full cadence for the first tick
    // (which under reduced motion would be up to a minute).
    if (this.render()) {
      this.finish();
      return;
    }

    this.stopInterval();
    const cadence = this.motionQuery?.matches
      ? this.config.reducedTickMs
      : this.config.tickMs;

    this.intervalId = setInterval(() => {
      const finished = this.render();
      if (finished) this.finish();
    }, cadence);
  };



  stopInterval = () => {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  };



  // Computes the remaining time from the target date (not from a decremented
  // counter) and writes the mapped nodes. True once the target is reached, so
  // the loop can stop.
  render = () => {
    const { days, hours, minutes, seconds } = this.counterElements;

    const remainingMs = Math.max(0, this.targetMs - Date.now());
    const totalSeconds = Math.floor(remainingMs / 1000);

    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    this.renderCountdownValue(days, d);
    this.renderCountdownValue(hours, h);
    this.renderCountdownValue(minutes, m);
    if (seconds) this.renderCountdownValue(seconds, s);

    this.renderSummary({ d, h, m });
    this.syncMirrors({ d, h, m, s });

    return remainingMs <= 0;
  };



  // Writes a numeric countdown value into an output element.
  renderCountdownValue = (element, value) => {
    if (!(element instanceof HTMLElement)) return;
    element.textContent = value;
  };



  // Rewrites the screen-reader sentence, only when the minute value changed —
  // seconds never enter it, so on a normal tick this is a no-op. The node
  // lives inside the role="timer" region (aria-live off), so the write is
  // never announced; it just keeps the on-demand value fresh.
  renderSummary = ({ d, h, m }) => {
    if (!this.summary) return;

    const units = [
      this.unitText('day', d),
      this.unitText('hour', h),
      this.unitText('minute', m),
    ].join(', ');

    const template = this.label
      ? this.labels.summaryLabelled
      : this.labels.summary;

    const text = formatTemplate(template, { units, label: this.label });

    if (text === this.lastSummary) return;
    this.lastSummary = text;
    this.summary.textContent = text;
  };



  // One unit of the spoken sentence. The plural form is part of the message
  // id (see labels), so "1 Tag" vs "2 Tage" stays with the translation.
  unitText = (unit, value) => formatTemplate(
    this.labels[`${unit}${value === 1 ? 'One' : 'Other'}`], { count: value }
  );



  // Terminal state: stop ticking, drop the now pointless pause control and
  // announce once. role="status" reads the inserted text a single time — the
  // correct one-off use of a live region.
  finish = () => {
    this.finished = true;
    this.stopInterval();
    this.module.removeAttribute('data-countdown-paused');
    this.module.setAttribute('data-countdown-finished', '');

    this.toggleButton?.remove();
    this.toggleButton = null;

    const template = this.label
      ? this.labels.finishedLabelled
      : this.labels.finished;

    const message = formatTemplate(template, { label: this.label });

    // The timer's on-demand text is replaced too, so a screen reader reading
    // it later gets the same message.
    if (this.statusNode) this.statusNode.textContent = message;
    if (this.summary) this.summary.textContent = message;
  };



  // Mirrors the current values into cloned marquee instances. No-op in the
  // common case where the countdown runs without a marquee.
  syncMirrors = ({ d, h, m, s }) => {

    // The marquee is detected via its module attribute, not a styling class —
    // classes stay free for the consuming project's CSS.
    const marquee = this.module.closest("[data-js-behavior~='marquee']");
    if (!(marquee instanceof HTMLElement)) return;

    const mirrors = marquee.querySelectorAll("[data-js-behavior~='countdown']");

    mirrors.forEach((mirror) => {

      // querySelectorAll only yields elements and renderCountdownValue guards
      // each write, so the one check needed is skipping the source module.
      if (mirror === this.module) return;

      const mirrorDays = mirror.querySelector(this.config.selDays);
      const mirrorHours = mirror.querySelector(this.config.selHours);
      const mirrorMinutes = mirror.querySelector(this.config.selMinutes);
      const mirrorSeconds = mirror.querySelector(this.config.selSeconds);

      this.renderCountdownValue(mirrorDays, d);
      this.renderCountdownValue(mirrorHours, h);
      this.renderCountdownValue(mirrorMinutes, m);
      this.renderCountdownValue(mirrorSeconds, s);
    });
  };



  handleMissingElements = () => {
    this.reporter?.report(
      'countdown',
      'missing day/hour/minute element');
    this.reporter?.report(
      'countdown',
      'module was not initialized', this.module);
  };



  handleMissingDate = () => {
    this.reporter?.report(
      'countdown',
      'missing target date (data-countdown-date)',
      this.module
    );
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly —
  // see destroyModulesInScope() in boot.js. The running interval would keep
  // firing forever, retaining this instance and the detached module through
  // its closure; the matchMedia listener likewise outlives the module.
  //
  // The injected nodes go with them. A host that tears this module down and
  // initialises the same markup again keeps the module element, so leaving
  // them behind would add a second pause control and a second status region
  // on every cycle — the latter a live region announcing the same thing
  // twice.
  destroy = () => {
    this.stopInterval();
    this.motionQuery?.removeEventListener?.('change', this.handleMotionChange);

    this.toggleButton?.remove();
    this.toggleButton = null;
    this.statusNode?.remove();
    this.statusNode = null;

    // The rest is the markup handed back as it was authored.
    this.module.removeAttribute('data-countdown-paused');
    this.module.removeAttribute('data-countdown-finished');
    this.units?.removeAttribute('aria-hidden');
    this.secondsUnit?.removeAttribute('hidden');
    if (this.appliedRole) this.display?.removeAttribute('role');
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'countdown',
      'module was initialized on a non-element node.', el);
    return;
  }

  const instance = new Countdown(el, defaults, reporter);
  return instance.destroy;
}
