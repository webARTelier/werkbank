/**
 * dialog.js
 * ----------------------------------------------------------------------------
 * Progressive-enhancement controller for a single native <dialog> element: it
 * wires the outside triggers, adds light-dismiss and body-scroll locking, and
 * cleans up media on close — everything the native element does not give for
 * free — while leaving all the heavy lifting to the platform.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * A native <dialog> opened with showModal() renders in the top layer, traps
 * focus inside itself, paints a ::backdrop, closes on Escape and — crucially
 * — moves focus in on open and restores it to the opener on close. We
 * deliberately lean on all of that (the same way the accordion leans on
 * <details> and the countdown recomputes from the target date): the native
 * behaviour is the source of truth, the script only fills the gaps around it.
 *
 * What this script adds
 * ---------------------
 * 1. Triggers: open triggers live *outside* the dialog and reference it by id
 *    (data-open-dialog="<dialogId>"). On init we find them, wire the click,
 *    and reflect state into ARIA (aria-haspopup / aria-controls /
 *    aria-expanded).
 * 2. Light dismiss: clicking the backdrop closes the dialog. This is not
 *    native. Because the visible surface lives in an inner .m-dialog__panel
 *    and the <dialog> itself is padding-free, a click whose target IS the
 *    <dialog> element can only have landed on the backdrop — no coordinate
 *    math needed. Opt out per dialog with data-dialog-static (also blocks
 *    Escape, see below).
 * 3. Body scroll lock: modal dialogs make the background inert but do NOT stop
 *    the page behind them from scrolling, so we toggle a body class. A shared
 *    counter keeps the lock correct when several (non-modal) dialogs overlap.
 * 4. Media cleanup: on close we pause every <video>/<audio> (harmless, so
 *    always done) and reload the <iframe>s that the author has opted in with
 *    data-dialog-media, so a closed dialog cannot keep playing sound in the
 *    background. Resetting an <iframe> src reloads it — which drops its state
 *    and costs a request — so it is opt-in rather than applied to every frame.
 * 5. Keyboard-scrollable body: a plain overflowing <div> scrolls with the
 *    mouse wheel but is invisible to the keyboard (it cannot take focus, so the
 *    arrow / paging keys never reach it). Whenever the marked scroll region
 *    (data-dialog-scroll) actually overflows AND holds nothing else focusable,
 *    we make it a tab stop so those keys work, and expose it as a named region
 *    for AT — mirroring adaptiveScrollFade. Removed again once it fits. Overflow
 *    is tracked live while the dialog is open (a ResizeObserver on the region
 *    and its children plus a MutationObserver on its child list), so content
 *    that grows or shrinks after open — async loads, a font swap, an expanding
 *    control — flips the tab stop too, not just a viewport resize.
 *
 * Single close funnel
 * -------------------
 * Every close path — the close button, the backdrop, Escape, a
 * <form method="dialog"> submit, or a programmatic close() — ends in the
 * native "close" event. We hang ALL teardown off that one event, so there is
 * exactly one place that unlocks scroll, resets the triggers and stops media,
 * and no path can bypass it. The "cancel" event (fired just before an Escape
 * close) is used only to veto the close for static dialogs.
 *
 * Modality
 * --------
 * Modal is the default (showModal): it is what most dialogs want and it is
 * what unlocks the native focus trap + backdrop. Add data-dialog-nonmodal for
 * a non-modal dialog (show()), e.g. a toolbox that leaves the page interactive.
 * ----------------------------------------------------------------------------
 */



import { rafThrottle } from "./rafThrottle.js"



// Elements that can already receive keyboard focus. If the scroll region holds
// any of these, a keyboard user reaches its content anyway, so we do NOT make
// the container itself a (redundant) tab stop — see syncScrollFocusability.
const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")



const defaults = {
  // Open triggers live outside the dialog and name their target dialog by id.
  triggerOpenAttr: "data-open-dialog",
  // Close controls live inside the dialog; presence is enough.
  selClose: "[data-close-dialog]",
  // Opt-out / mode switches (presence-based, read off the dialog element).
  staticAttr: "data-dialog-static",
  nonModalAttr: "data-dialog-nonmodal",
  // The scrollable content region inside the dialog. Marked with a behavioural
  // attribute (not a style class) so the script stays decoupled from the CSS.
  scrollRegionAttr: "data-dialog-scroll",
  // Marks an <iframe> the close handler may reload to stop it playing (see
  // stopMedia). Opt-in, because reloading a frame drops its state.
  mediaAttr: "data-dialog-media",
  // Body class toggled while at least one dialog is open.
  scrollLockClass: "is-scrollLocked",
  // Optional media-cleanup hook. Runs on every close; override to customise.
  stopMedia: (dialog) => {
    // Pausing native media is cheap and side-effect-free, so we always do it —
    // a closed dialog must never keep playing sound.
    dialog.querySelectorAll("video, audio").forEach((media) => {
      if (typeof media.pause === "function") media.pause()
    })
    // Reassigning src is the reliable cross-browser way to stop an <iframe>
    // (e.g. an embedded video) from playing on in the background — but it
    // reloads the frame, losing its state and costing a request. So we only
    // touch iframes the author explicitly marks as media (data-dialog-media),
    // never every frame (a map, an embedded form, an app keeps its state).
    dialog.querySelectorAll("iframe[data-dialog-media]").forEach((iframe) => {
      const src = iframe.getAttribute("src")
      if (src) iframe.setAttribute("src", src)
    })
  },
}



// Shared across all dialog instances on the page: how many dialogs are
// currently open. The body scroll lock is released only when this hits zero,
// so closing one dialog while another is still open does not unlock the page.
let openCount = 0



class Dialog {

  constructor(dialog, config, reporter) {
    this.dialog = dialog
    this.config = config
    this.reporter = reporter

    this.lastFocused = null
    this.isStatic = dialog.hasAttribute(config.staticAttr)
    this.isModal = !dialog.hasAttribute(config.nonModalAttr)

    // Coalesce resize bursts into one scroll-region re-measure per paint frame.
    this.requestScrollSync = rafThrottle(this.syncScrollFocusability)

    this.setup()
  }



  // Wires triggers, close controls, backdrop dismiss and the close funnel.
  setup = () => {
    this.triggers = this.findTriggers()
    this.wireTriggers()
    this.wireCloseControls()

    // Scrollable body bookkeeping (keyboard-scroll gap, see file header). We
    // never fight an author who manages the tabindex themselves, and we track
    // whether they named it so we know whether to borrow the dialog's label.
    this.scrollRegion = this.dialog.querySelector(
      `[${this.config.scrollRegionAttr}]`
    )
    this.scrollAuthorTabindex = this.scrollRegion?.hasAttribute("tabindex") ?? false
    this.scrollAuthorNamed = this.scrollRegion
      ? this.scrollRegion.hasAttribute("aria-label") ||
        this.scrollRegion.hasAttribute("aria-labelledby")
      : false
    this.scrollFocusable = undefined // tri-state: undefined until first sync
    this.scrollNameApplied = false
    this.warnedMissingScrollName = false

    // Track the scroll region's overflow live while the dialog is open, not
    // just on viewport resize: a ResizeObserver on the region AND its direct
    // children catches content that grows/shrinks inside a fixed height (async
    // load, font swap, an expanding control) — a change the region's own box
    // does not report — and a MutationObserver keeps that child set current.
    // Mirrors adaptiveScrollFade. Wired on open, torn down on close.
    if (this.scrollRegion && "ResizeObserver" in window) {
      this.scrollResizeObserver = new ResizeObserver(this.requestScrollSync)
    }
    if (this.scrollResizeObserver && "MutationObserver" in window) {
      this.scrollMutationObserver = new MutationObserver(this.onScrollChildListChange)
    }

    // Light dismiss: a click whose target is the dialog element itself landed
    // on the backdrop (the padding-free dialog forwards content clicks to the
    // inner panel). Skipped for static dialogs.
    this.dialog.addEventListener("click", this.handleDialogClick)

    // Escape veto for static dialogs: "cancel" fires just before the native
    // Escape-close, so preventing it keeps the dialog open.
    this.dialog.addEventListener("cancel", this.handleCancel)

    // The one place all teardown happens (see file header).
    this.dialog.addEventListener("close", this.handleClose)
  }



  // Finds the open triggers that reference this dialog by id. Without an id the
  // dialog cannot be addressed by an outside trigger; we still initialise it
  // (it may be opened programmatically or dismissed from the inside) but warn.
  findTriggers = () => {
    const id = this.dialog.id
    if (!id) {
      this.reporter?.report(
        "dialog",
        "dialog has no id, no open trigger can target it.", this.dialog
      )
      return []
    }

    const selector =
      `[${this.config.triggerOpenAttr}="${CSS.escape(id)}"]`
    return [...document.querySelectorAll(selector)]
  }



  // Binds each trigger and seeds its ARIA so assistive tech announces that the
  // control opens a dialog. aria-expanded is deliberately NOT set for a modal
  // trigger: the ARIA APG modal-dialog pattern uses only aria-haspopup (a modal
  // takes over the page, it is not an expandable region belonging to the
  // trigger). We keep aria-expanded only for a non-modal dialog, where the
  // trigger behaves like a disclosure that toggles an inline popup.
  wireTriggers = () => {
    this.triggers.forEach((trigger) => {
      trigger.addEventListener("click", this.open)
      trigger.setAttribute("aria-haspopup", "dialog")
      trigger.setAttribute("aria-controls", this.dialog.id)
      if (!this.isModal) trigger.setAttribute("aria-expanded", "false")
    })
  }



  // Every close control inside the dialog closes it. A <form method="dialog">
  // would close natively too; this simply also supports a plain button.
  wireCloseControls = () => {
    this.dialog
      .querySelectorAll(this.config.selClose)
      .forEach((btn) => btn.addEventListener("click", this.close))
  }



  handleDialogClick = (event) => {
    if (this.isStatic) return
    if (event.target === this.dialog) this.close()
  }



  handleCancel = (event) => {
    if (this.isStatic) event.preventDefault()
  }



  open = () => {
    if (this.dialog.open) return

    // Remembered so we can restore focus if the native restoration does not
    // (only relevant for non-modal dialogs — see handleClose).
    this.lastFocused = document.activeElement

    // showModal() is what enables the native focus trap + backdrop; show()
    // opens a non-modal dialog that leaves the rest of the page interactive.
    this.isModal ? this.dialog.showModal() : this.dialog.show()

    // Only a modal dialog needs the page frozen behind it; a non-modal dialog
    // is meant to leave the rest of the page scrollable and interactive.
    if (this.isModal) this.lockScroll()
    this.setTriggersExpanded("true")

    // The dialog is now laid out, so scrollHeight/clientHeight are meaningful:
    // decide whether the body needs to be keyboard-scrollable, and keep that in
    // sync while it is open — a viewport resize (resize listener) or a content
    // size change (the observers) can flip whether it overflows.
    this.syncScrollFocusability()
    this.observeScrollRegion()
    window.addEventListener("resize", this.requestScrollSync)
  }



  close = () => {
    // Funnels through the native "close" event, so handleClose does the
    // teardown regardless of how the dialog was closed.
    if (this.dialog.open) this.dialog.close()
  }



  // Single teardown funnel for every close path.
  handleClose = () => {
    if (this.isModal) this.unlockScroll()
    this.setTriggersExpanded("false")
    this.runStopMedia()
    this.restoreFocus()
    window.removeEventListener("resize", this.requestScrollSync)
    this.unobserveScrollRegion()
  }



  // Modal dialogs restore focus to the opener natively, so by the time this
  // runs the focus is already back and activeElement is no longer <body>; we
  // then do nothing. Non-modal dialogs get no native restoration, so if focus
  // was left on a now-hidden node it falls to <body> and we put it back.
  restoreFocus = () => {
    const active = document.activeElement
    const focusLost = !active || active === document.body
    if (focusLost && typeof this.lastFocused?.focus === "function") {
      this.lastFocused.focus()
    }
    this.lastFocused = null
  }



  runStopMedia = () => {
    try {
      this.config.stopMedia(this.dialog)
    } catch (err) {
      this.reporter?.report("dialog", "stopMedia hook failed.", err)
    }
  }



  // Only meaningful for a non-modal trigger; modal triggers carry no
  // aria-expanded (see wireTriggers), so there is nothing to toggle.
  setTriggersExpanded = (state) => {
    if (this.isModal) return
    this.triggers.forEach((t) => t.setAttribute("aria-expanded", state))
  }



  // ---- keyboard-scrollable body (see file header, gap 5) -----------------

  // Start watching the scroll region for size/content changes (called on open).
  // We observe the region itself and its direct children: a ResizeObserver on
  // the region alone only sees its own (fixed) box, so it misses content that
  // grows inside it — but that reflow changes the height of the child holding
  // it, which the observer then picks up. The MutationObserver keeps the
  // observed child set in sync as content is added/removed.
  observeScrollRegion = () => {
    const region = this.scrollRegion
    if (!region) return
    if (this.scrollResizeObserver) {
      this.scrollResizeObserver.observe(region)
      for (const child of region.children) this.scrollResizeObserver.observe(child)
    }
    this.scrollMutationObserver?.observe(region, { childList: true })
  }



  // Stop watching (called on close). disconnect() drops the region and every
  // observed child in one call, so a reopen starts from a clean child set.
  unobserveScrollRegion = () => {
    this.scrollResizeObserver?.disconnect()
    this.scrollMutationObserver?.disconnect()
  }



  // Mirror added/removed direct children into the ResizeObserver, then re-sync
  // for the size change the mutation itself may have caused.
  onScrollChildListChange = (records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) this.scrollResizeObserver.observe(node)
      }
      for (const node of record.removedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) this.scrollResizeObserver.unobserve(node)
      }
    }
    this.requestScrollSync()
  }



  // Make the scroll region a tab stop exactly while it needs one: it overflows
  // AND contains nothing else that could take focus. If it holds focusable
  // content a keyboard user already reaches it, so an extra tab stop on the
  // container would be redundant noise — this is the one place we intentionally
  // differ from adaptiveScrollFade, whose sole purpose IS to be a scroll surface.
  syncScrollFocusability = () => {
    const region = this.scrollRegion
    if (!region || this.scrollAuthorTabindex) return

    const overflowing = region.scrollHeight - region.clientHeight > 1
    const hasFocusable = region.querySelector(FOCUSABLE) !== null
    const needsFocus = overflowing && !hasFocusable

    if (needsFocus) {
      if (this.scrollFocusable === true) return
      this.scrollFocusable = true
      this.applyScrollAccess()
      return
    }

    if (this.scrollFocusable === false) return
    // Don't yank the tabindex out from under a user parked on the region; leave
    // it until focus has moved on (a later sync will clean it up).
    if (region === document.activeElement) return
    this.scrollFocusable = false
    this.removeScrollAccess()
  }



  applyScrollAccess = () => {
    const region = this.scrollRegion
    region.setAttribute("tabindex", "0")

    // A focusable scroll region should tell AT what it is (WCAG 4.1.2). Respect
    // an author-set name/role; otherwise borrow the dialog's own label (its
    // title) and expose the box as a region, so a screen-reader user tabbing
    // here is not stranded. Only if nothing can name it do we warn rather than
    // emit an unlabelled landmark.
    if (this.scrollAuthorNamed || region.hasAttribute("role")) return

    const labelledby = this.dialog.getAttribute("aria-labelledby")
    if (labelledby) {
      region.setAttribute("aria-labelledby", labelledby)
      region.setAttribute("role", "region")
      this.scrollNameApplied = true
    } else {
      this.warnMissingScrollName()
    }
  }



  removeScrollAccess = () => {
    const region = this.scrollRegion
    region.removeAttribute("tabindex")
    // Only undo the name/role we added ourselves; never touch author markup.
    if (this.scrollNameApplied) {
      region.removeAttribute("role")
      region.removeAttribute("aria-labelledby")
      this.scrollNameApplied = false
    }
  }



  warnMissingScrollName = () => {
    if (this.warnedMissingScrollName) return
    this.warnedMissingScrollName = true
    this.reporter?.report(
      "dialog",
      "the scrollable dialog body became keyboard focusable but has no " +
      "accessible name and the dialog has no aria-labelledby to borrow; add " +
      "aria-label/aria-labelledby to the [data-dialog-scroll] element so " +
      "screen-reader users know what the scroll region contains (WCAG 4.1.2).",
      this.scrollRegion
    )
  }



  lockScroll = () => {
    openCount += 1
    document.body.classList.add(this.config.scrollLockClass)
  }



  unlockScroll = () => {
    openCount = Math.max(0, openCount - 1)
    if (openCount === 0) {
      document.body.classList.remove(this.config.scrollLockClass)
    }
  }
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof HTMLElement) || el.tagName !== "DIALOG") {
    reporter?.report(
      "dialog",
      "module must be initialized on a <dialog> element.", el
    )
    return
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  new Dialog(el, defaults, reporter)
}
