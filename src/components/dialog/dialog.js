/**
 * dialog.js
 * ----------------------------------------------------------------------------
 * Controller for a single native <dialog>: it wires the outside triggers,
 * adds light-dismiss and body-scroll locking, and cleans up media on close —
 * everything the native element does not give for free — while leaving all
 * the heavy lifting to the platform.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * A native <dialog> opened with showModal() renders in the top layer, traps
 * focus inside itself, paints a ::backdrop, closes on Escape and — crucially
 * — moves focus in on open and restores it to the opener on close. All of
 * that is leaned on deliberately (the way accordion leans on <details> and
 * countdown recomputes from the target date): the native behaviour is the
 * source of truth, the script only fills the gaps around it.
 *
 * What this script adds
 * ---------------------
 * 1. Triggers: open triggers live *outside* the dialog and reference it by id
 *    (data-open-dialog="<dialogId>"). Clicks go through a single delegated
 *    listener on document, not one per trigger found at init, so a trigger
 *    inserted later — CMS/AJAX content, a framework re-render — still opens
 *    the dialog. ARIA (aria-haspopup / aria-controls / aria-expanded) is
 *    seeded per-trigger the first time it is seen, which happens at
 *    construction and again on every open()/close(), so any trigger present
 *    by the time the dialog is first used ends up fully wired.
 * 2. Light dismiss: clicking the backdrop closes the dialog, which is not
 *    native. Because the visible surface lives in an inner .c-dialog__panel
 *    and the <dialog> itself is padding-free, a click whose target IS the
 *    <dialog> can only have landed on the backdrop — no coordinate math
 *    needed. Opt out per dialog with data-dialog-static (also blocks Escape,
 *    see below).
 * 3. Body scroll lock: modal dialogs make the background inert but do NOT
 *    stop the page behind them from scrolling, hence a body class. A shared
 *    counter keeps the lock correct when several (non-modal) dialogs overlap.
 * 4. Media cleanup: closing pauses every <video>/<audio> (harmless, so always
 *    done) and reloads the <iframe>s the author opted in with
 *    data-dialog-media, so a closed dialog cannot keep playing sound.
 *    Resetting an <iframe> src reloads it — dropping its state and costing a
 *    request — so it is opt-in rather than applied to every frame.
 * 5. Keyboard-scrollable body: a plain overflowing <div> scrolls with the
 *    mouse wheel but is invisible to the keyboard (it cannot take focus, so
 *    the arrow and paging keys never reach it). While the marked scroll
 *    region (data-dialog-scroll) overflows AND holds nothing else focusable
 *    it becomes a tab stop, exposed as a named region for AT — mirroring
 *    adaptiveScrollFade — and stops being one once it fits. Overflow is
 *    tracked live while the dialog is open (a ResizeObserver on the region
 *    and its children plus a MutationObserver on its child list), so content
 *    that grows or shrinks after open — async loads, a font swap, an
 *    expanding control — flips the tab stop too, not just a viewport resize.
 *
 * Single close funnel
 * -------------------
 * Every close path — the close button, the backdrop, Escape, a
 * <form method="dialog"> submit, a programmatic close() — ends in the native
 * "close" event, and ALL teardown hangs off that one event: exactly one place
 * unlocks scroll, resets the triggers and stops media, and no path can bypass
 * it. The "cancel" event (fired just before an Escape close) is used only to
 * veto the close for static dialogs.
 *
 * Modality
 * --------
 * Modal is the default (showModal): what most dialogs want, and what unlocks
 * the native focus trap + backdrop. Add data-dialog-nonmodal for a non-modal
 * dialog (show()), e.g. a toolbox that leaves the page interactive.
 * ----------------------------------------------------------------------------
 */



import { rafThrottle } from './rafThrottle.js';
import { focusableSelector } from './focusableSelector.js';



// Marks an <iframe> the close handler may reload to stop it playing (see
// stopMedia). Opt-in, because reloading a frame drops its state and costs a
// request.
const mediaAttr = 'data-dialog-media';



// Stops whatever the dialog was playing. Runs on every close (see the file
// header). A plain function, not a `defaults` entry: `init(el, services)` is
// the only way in and takes no config, so a "hook" here could not be replaced
// by a project without editing this file.
function stopMedia(dialog) {

  // Pausing native media is cheap and side-effect-free, so it always happens
  // — a closed dialog must never keep playing sound.
  dialog.querySelectorAll('video, audio').forEach((media) => {
    if (typeof media.pause === 'function') media.pause();
  });

  // Reassigning src is the reliable cross-browser way to stop an <iframe>
  // (e.g. an embedded video) playing on in the background — but it reloads
  // the frame, losing its state and costing a request. So only iframes the
  // author marks as media (data-dialog-media) are touched, never every frame
  // (a map, an embedded form, an app keeps its state).
  dialog.querySelectorAll(`iframe[${mediaAttr}]`).forEach((iframe) => {
    const src = iframe.getAttribute('src');
    if (src) iframe.setAttribute('src', src);
  });
}



const defaults = {

  // Open triggers live outside the dialog and name their target dialog by id.
  triggerOpenAttr: 'data-open-dialog',

  // Close controls live inside the dialog; presence is enough.
  selClose: '[data-close-dialog]',

  // Opt-out / mode switches (presence-based, read off the dialog element).
  staticAttr: 'data-dialog-static',
  nonModalAttr: 'data-dialog-nonmodal',

  // The scrollable content region inside the dialog. A behavioural attribute,
  // not a style class, so the script stays decoupled from the CSS.
  scrollRegionAttr: 'data-dialog-scroll',

  // Body class toggled while at least one dialog is open.
  scrollLockClass: 'is-scrollLocked',
};



// Shared across all dialog instances on the page: how many are currently
// open. The body scroll lock is released only when this hits zero, so closing
// one dialog while another is still open does not unlock the page.
let openCount = 0;



class Dialog {

  constructor(dialog, config, reporter) {
    this.dialog = dialog;
    this.config = config;
    this.reporter = reporter;

    this.lastFocused = null;
    this.isStatic = dialog.hasAttribute(config.staticAttr);
    this.isModal = !dialog.hasAttribute(config.nonModalAttr);

    // Coalesce resize bursts into one scroll-region re-measure per paint
    // frame.
    this.requestScrollSync = rafThrottle(this.syncScrollFocusability);

    this.setup();
  }



  // Wires triggers, close controls, backdrop dismiss and the close funnel.
  setup = () => {
    this.seededTriggers = new WeakSet();
    this.triggerSelector = this.buildTriggerSelector();
    this.syncTriggers();
    document.addEventListener('click', this.handleTriggerClick);

    this.wireCloseControls();

    // Scrollable body bookkeeping (keyboard-scroll gap, see file header). An
    // author who manages the tabindex is never fought, and whether they named
    // the region decides whether the dialog's label gets borrowed.
    this.scrollRegion = this.dialog.querySelector(
      `[${this.config.scrollRegionAttr}]`
    );
    this.scrollAuthorTabindex = this.scrollRegion?.hasAttribute('tabindex') ?? false;
    this.scrollAuthorNamed = this.scrollRegion
      ? this.scrollRegion.hasAttribute('aria-label') ||
        this.scrollRegion.hasAttribute('aria-labelledby')
      : false;
    this.scrollFocusable = undefined; // tri-state: undefined until first sync
    this.scrollNameApplied = false;
    this.warnedMissingScrollName = false;

    // Track the scroll region's overflow live while the dialog is open, not
    // just on viewport resize: a ResizeObserver on the region AND its direct
    // children catches content growing/shrinking inside a fixed height (async
    // load, font swap, an expanding control) — a change the region's own box
    // does not report — and a MutationObserver keeps that child set current.
    // Mirrors adaptiveScrollFade. Wired on open, torn down on close.
    if (this.scrollRegion && 'ResizeObserver' in window) {
      this.scrollResizeObserver = new ResizeObserver(this.requestScrollSync);
    }
    if (this.scrollResizeObserver && 'MutationObserver' in window) {
      this.scrollMutationObserver = new MutationObserver(this.onScrollChildListChange);
    }

    // Light dismiss: a click whose target is the dialog element itself landed
    // on the backdrop (the padding-free dialog forwards content clicks to the
    // inner panel). Skipped for static dialogs.
    this.dialog.addEventListener('click', this.handleDialogClick);

    // Escape veto for static dialogs: "cancel" fires just before the native
    // Escape-close, so preventing it keeps the dialog open.
    this.dialog.addEventListener('cancel', this.handleCancel);

    // The one place all teardown happens (see file header).
    this.dialog.addEventListener('close', this.handleClose);
  };



  // The selector matching this dialog's open triggers by id. null (and a
  // warning) where the dialog has no id — it can still be opened
  // programmatically or dismissed from the inside, just not addressed from an
  // outside trigger.
  buildTriggerSelector = () => {
    const id = this.dialog.id;
    if (!id) {
      this.reporter?.report(
        'dialog',
        'dialog has no id, no open trigger can target it.', this.dialog
      );
      return null;
    }
    return `[${this.config.triggerOpenAttr}="${CSS.escape(id)}"]`;
  };



  // Live list of this dialog's triggers — re-queried rather than cached, so a
  // trigger inserted after construction is picked up next time (see
  // syncTriggers).
  getTriggers = () => {
    if (!this.triggerSelector) return [];
    return [...document.querySelectorAll(this.triggerSelector)];
  };



  // Seeds ARIA on every present trigger not seeded yet, then (for a non-modal
  // dialog) reflects expandedState into aria-expanded on all of them.
  // aria-expanded is deliberately NOT set for a modal trigger: the ARIA APG
  // modal-dialog pattern uses only aria-haspopup (a modal takes over the
  // page, it is not an expandable region belonging to the trigger). Called at
  // construction (seeds only) and from open()/close() (seeds AND reflects),
  // so a trigger added later is fully wired the next time this dialog is
  // opened or closed.
  syncTriggers = (expandedState) => {
    for (const trigger of this.getTriggers()) {
      if (!this.seededTriggers.has(trigger)) {
        this.seededTriggers.add(trigger);
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-controls', this.dialog.id);
        if (!this.isModal) trigger.setAttribute('aria-expanded', 'false');
      }
      if (!this.isModal && expandedState) {
        trigger.setAttribute('aria-expanded', expandedState);
      }
    }
  };



  // Delegated: matches a click anywhere on the page against this dialog's
  // trigger selector, so a trigger inserted later still opens it (see
  // setup()).
  handleTriggerClick = (event) => {
    if (!this.triggerSelector) return;

    const trigger = event.target.closest(this.triggerSelector);
    if (!trigger) return;

    this.adoptFocus(trigger);
    this.open();
  };



  // Both the native restoration (modal) and restoreFocus below (non-modal)
  // hand the focus back to whatever had it when the dialog opened, so that
  // route needs an element to go back to — and a clicked control does not get
  // the focus in every engine: WebKit follows the macOS convention and leaves
  // it where it was, i.e. on <body>, so a dialog opened with the mouse has
  // nothing to restore to. Hence the focus goes onto the trigger first, but
  // only where the click left it nowhere: an engine that focuses its clicked
  // controls needs no help (a no-op), and a project moving the focus itself
  // during the same click keeps it. preventScroll because this is
  // bookkeeping, not navigation — the control was just clicked, so it is in
  // view. Keyboard activation needs none of it: there the trigger has the
  // focus by definition.
  //
  // In WebKit the restored focus then draws its ring, because WebKit reads a
  // programmatic focus as a keyboard one. Deliberate: the focus really is on
  // the trigger afterwards, so showing it is honest — hiding an indicator for
  // a focus position we just placed would be the wrong end of the trade.
  // offCanvasNav carries the same one-liner, for the same reason.
  adoptFocus = (trigger) => {
    const active = document.activeElement;
    if (active && active !== document.body) return;

    trigger.focus({ preventScroll: true });
  };



  // Every close control inside the dialog closes it. A <form method="dialog">
  // would close natively too; this also supports a plain button.
  wireCloseControls = () => {
    this.dialog
      .querySelectorAll(this.config.selClose)
      .forEach((btn) => btn.addEventListener('click', this.close));
  };



  handleDialogClick = (event) => {
    if (this.isStatic) return;
    if (event.target === this.dialog) this.close();
  };



  handleCancel = (event) => {
    if (this.isStatic) event.preventDefault();
  };



  open = () => {
    if (this.dialog.open) return;

    // Remembered so focus can be restored where the native restoration does
    // not (only relevant for non-modal dialogs — see handleClose). On the
    // trigger route this is the trigger itself, because handleTriggerClick
    // focuses it first — otherwise a mouse click would leave <body> here in
    // engines that do not focus a clicked control, i.e. nothing worth
    // restoring.
    this.lastFocused = document.activeElement;

    // showModal() is what enables the native focus trap + backdrop; show()
    // opens a non-modal dialog that leaves the rest of the page interactive.
    this.isModal ? this.dialog.showModal() : this.dialog.show();

    // Only a modal dialog needs the page frozen behind it; a non-modal one is
    // meant to leave the rest scrollable and interactive.
    if (this.isModal) this.lockScroll();
    this.syncTriggers('true');

    // The dialog is now laid out, so scrollHeight/clientHeight are
    // meaningful: decide whether the body needs to be keyboard-scrollable,
    // and keep that in sync while it is open — a viewport resize (resize
    // listener) or a content size change (the observers) can flip whether it
    // overflows.
    this.syncScrollFocusability();
    this.observeScrollRegion();
    window.addEventListener('resize', this.requestScrollSync);
  };



  close = () => {

    // Funnels through the native "close" event, so handleClose does the
    // teardown regardless of how the dialog was closed.
    if (this.dialog.open) this.dialog.close();
  };



  // Single teardown funnel for every close path.
  handleClose = () => {
    if (this.isModal) this.unlockScroll();
    this.syncTriggers('false');
    stopMedia(this.dialog);
    this.restoreFocus();
    window.removeEventListener('resize', this.requestScrollSync);
    this.unobserveScrollRegion();
  };



  // Modal dialogs restore focus to the opener natively, so by the time this
  // runs the focus is back and activeElement is no longer <body> — nothing to
  // do. (That the platform *has* an opener to go back to on the mouse route
  // is what the focus call in handleTriggerClick is for.) Non-modal dialogs
  // get no native restoration, so focus left on a now-hidden node falls to
  // <body> and is put back here.
  restoreFocus = () => {
    const active = document.activeElement;
    const focusLost = !active || active === document.body;
    if (focusLost && typeof this.lastFocused?.focus === 'function') {
      this.lastFocused.focus();
    }
    this.lastFocused = null;
  };



  // ---- keyboard-scrollable body (see file header, gap 5) -----------------

  // Start watching the scroll region for size/content changes (called on
  // open). The region itself and its direct children: a ResizeObserver on the
  // region alone only sees its own (fixed) box, so it misses content growing
  // inside it — but that reflow changes the height of the child holding it,
  // which the observer picks up. The MutationObserver keeps the observed
  // child set current.
  observeScrollRegion = () => {
    const region = this.scrollRegion;
    if (!region) return;
    if (this.scrollResizeObserver) {
      this.scrollResizeObserver.observe(region);
      for (const child of region.children) this.scrollResizeObserver.observe(child);
    }
    this.scrollMutationObserver?.observe(region, { childList: true });
  };



  // Stop watching (called on close). disconnect() drops the region and every
  // observed child in one call, so a reopen starts from a clean child set.
  unobserveScrollRegion = () => {
    this.scrollResizeObserver?.disconnect();
    this.scrollMutationObserver?.disconnect();
  };



  // Mirror added/removed direct children into the ResizeObserver, then
  // re-sync for the size change the mutation itself may have caused.
  onScrollChildListChange = (records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) this.scrollResizeObserver.observe(node);
      }
      for (const node of record.removedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) this.scrollResizeObserver.unobserve(node);
      }
    }
    this.requestScrollSync();
  };



  // A tab stop exactly while the region needs one: it overflows AND contains
  // nothing else that could take focus. Holding focusable content, a keyboard
  // user already reaches it, so an extra tab stop on the container would be
  // noise — the one place this intentionally differs from adaptiveScrollFade,
  // whose sole purpose IS to be a scroll surface.
  syncScrollFocusability = () => {
    const region = this.scrollRegion;
    if (!region || this.scrollAuthorTabindex) return;

    const overflowing = region.scrollHeight - region.clientHeight > 1;
    const hasFocusable = region.querySelector(focusableSelector) !== null;
    const needsFocus = overflowing && !hasFocusable;

    if (needsFocus) {
      if (this.scrollFocusable === true) return;
      this.scrollFocusable = true;
      this.applyScrollAccess();
      return;
    }

    if (this.scrollFocusable === false) return;
    // Never yank the tabindex out from under a user parked on the region;
    // leave it until focus has moved on (a later sync cleans it up).
    if (region === document.activeElement) return;
    this.scrollFocusable = false;
    this.removeScrollAccess();
  };



  applyScrollAccess = () => {
    const region = this.scrollRegion;
    region.setAttribute('tabindex', '0');

    // A focusable scroll region should tell AT what it is (WCAG 4.1.2). An
    // author-set name/role is respected; otherwise the dialog's own label
    // (its title) is borrowed and the box exposed as a region, so a
    // screen-reader user tabbing here is not stranded. Only where nothing can
    // name it does a warning go out rather than an unlabelled landmark.
    if (this.scrollAuthorNamed || region.hasAttribute('role')) return;

    const labelledby = this.dialog.getAttribute('aria-labelledby');
    if (!labelledby) {
      this.warnMissingScrollName();
      return;
    }

    region.setAttribute('aria-labelledby', labelledby);
    region.setAttribute('role', 'region');
    this.scrollNameApplied = true;
  };



  removeScrollAccess = () => {
    const region = this.scrollRegion;
    region.removeAttribute('tabindex');
    // Only undo the name/role we added ourselves; never touch author markup.
    if (this.scrollNameApplied) {
      region.removeAttribute('role');
      region.removeAttribute('aria-labelledby');
      this.scrollNameApplied = false;
    }
  };



  warnMissingScrollName = () => {
    if (this.warnedMissingScrollName) return;
    this.warnedMissingScrollName = true;
    this.reporter?.report(
      'dialog',
      'the scrollable dialog body became keyboard focusable but has no ' +
      'accessible name and the dialog has no aria-labelledby to borrow; add ' +
      'aria-label/aria-labelledby to the [data-dialog-scroll] element so ' +
      'screen-reader users know what the scroll region contains (WCAG 4.1.2).',
      this.scrollRegion
    );
  };



  lockScroll = () => {
    openCount += 1;
    document.body.classList.add(this.config.scrollLockClass);
  };



  unlockScroll = () => {
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) {
      document.body.classList.remove(this.config.scrollLockClass);
    }
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly —
  // see destroyModulesInScope() in boot.js. Forces the dialog closed and puts
  // it through the existing single close funnel (unlockScroll, stopMedia,
  // resize listener, scroll observers), then removes the delegated trigger
  // listener and the dialog's own listeners.
  destroy = () => {
    const wasOpen = this.dialog.open;
    if (wasOpen) this.dialog.close();

    // Nowhere to put the focus in a teardown, so restoreFocus() has nothing
    // to do — cleared before the funnel below runs, to stay out of the way of
    // whatever the host is doing with the page.
    this.lastFocused = null;

    document.removeEventListener('click', this.handleTriggerClick);
    this.dialog.removeEventListener('click', this.handleDialogClick);
    this.dialog.removeEventListener('cancel', this.handleCancel);
    this.dialog.removeEventListener('close', this.handleClose);

    // close() does not dispatch "close" then and there — it queues a task —
    // so the listener removed a line ago would have swallowed the funnel. For
    // a dialog torn down while open that would leak: the page would stay
    // scroll-locked and openCount never come back down, so no later dialog
    // could unlock it either. Hence the funnel by hand, after the listener is
    // gone so the queued event cannot run it twice (unlockScroll counts, and
    // must not count this close down twice).
    if (wasOpen) this.handleClose();

    this.unobserveScrollRegion();
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement) || el.tagName !== 'DIALOG') {
    reporter?.report(
      'dialog',
      'module must be initialized on a <dialog> element.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new Dialog(el, defaults, reporter);
  return instance.destroy;
}
