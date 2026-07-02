/**
 * Dialogs
 * lightweight <dialog> controller 
 * with delegated triggers and focus/scroll/aria handling
 */



const defaults = {
  selDialog: "[data-dialog]",
  selTriggerOpen: "[data-open-dialog]",
  selTriggerClose: "[data-close-dialog]",
  stopMedia: (dialog) => {
    if (!(dialog instanceof HTMLElement)) return

    dialog.querySelectorAll("video, audio").forEach((mediaEl) => {
      if (typeof mediaEl.pause === "function") mediaEl.pause()
    })

    dialog.querySelectorAll("iframe").forEach((iframe) => {
      const src = iframe.getAttribute("src")
      if (!src) return
      iframe.setAttribute("src", src)
    })
  }
}



let dialogsInstance = null;



class Dialogs {

  // initializes once if dialogs exist
  static init = (reporter) => {
    if (dialogsInstance) return dialogsInstance

    dialogsInstance = new Dialogs(defaults, reporter)
    return dialogsInstance
  }



  constructor(params, reporter) {
    this.reporter = reporter;
    this.selDialog = params.selDialog;
    this.selTriggerOpen = params.selTriggerOpen;
    this.selTriggerClose = params.selTriggerClose;
    this.stopMedia = params.stopMedia;

    this.lastFocused = null;

    this.startListening();
  }



  // covers dynamically added <dialog> elements
  get allDialogs() {
    return [...document.querySelectorAll(this.selDialog)];
  }



  // true if any managed dialog is currently open
  hasOpenDialogs = () =>
    this.allDialogs.some((dialog) => dialog.hasAttribute('open'));



  // delegates open/close triggers and provides an escape fallback
  startListening = () => {

    document.addEventListener('click', (e) => {
      this.checkClickedOpenTrigger(e);
      this.checkClickedCloseTrigger(e);
    })

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!this.hasOpenDialogs()) return;

      this.closeAllDialogs();
    })
  }



  // opens dialog by matching trigger data-open-dialog to dialog id
  checkClickedOpenTrigger = (e) => {
    const clickedOpen = e.target.closest(this.selTriggerOpen);
    if (!clickedOpen) return;

    const targetId = clickedOpen.getAttribute('data-target');
    if (!targetId) return;

    const dialog = document.getElementById(targetId);
    if (!dialog || dialog.tagName !== 'DIALOG') return;
    if (!dialog.matches(this.selDialog)) return;


    // ensures a single active dialog
    this.closeAllDialogs();

    const triggers = this.getOpenTriggers(dialog);
    this.openDialog(dialog, triggers);
  }



  // closes on close trigger or backdrop click
  checkClickedCloseTrigger = (e) => {
    const clickedClose = e.target.closest(this.selTriggerClose);
    const clickedBackdrop = e.target?.matches?.(this.selDialog);

    if (clickedClose || clickedBackdrop) this.closeAllDialogs();
  }



  // opens dialog and updates aria + scroll + focus
  openDialog = (dialog, triggers) => {
    this.lastFocused = document.activeElement;

    this.isModal(dialog) ? dialog.showModal() : dialog.show();

    this.setAriaExpanded(triggers, 'true');
    this.handleBodyScroll('lock');

    if (typeof dialog.focus === 'function') dialog.focus();
  }



  // closes all open dialogs and restores state
  closeAllDialogs = () => {
    const openDialogs = this.allDialogs.filter((d) => d.hasAttribute('open'));
    if (!openDialogs.length) return;

    openDialogs.forEach((dialog) => {
      const triggers = this.getOpenTriggers(dialog);

      this.stopMediaOnclose(dialog);

      try { dialog.close(); } catch { }

      this.setAriaExpanded(triggers, 'false');
    })

    this.handleBodyScroll('unlock');

    if (this.lastFocused) {
      this.lastFocused.focus();
      this.lastFocused = null;
    }
  }



  // finds open triggers for a dialog (covers dynamically added triggers)
  getOpenTriggers = (dialog) => {
    if (!dialog?.id) return [];

    const sel =
      `${this.selTriggerOpen}[data-open-dialog="${CSS.escape(dialog.id)}"]`;

    return [...document.querySelectorAll(sel)];
  }



  // runs optional media cleanup hook
  stopMediaOnclose = (dialog) => {
    try {
      this.stopMedia(dialog);
    } catch (err) {
      this.reporter?.report('Dialogs', 'onClose hook failed:', err);
    }
  }



  // keeps aria-expanded in sync on all open triggers
  setAriaExpanded = (triggers, status) => {
    triggers.forEach((trigger) => {
      trigger.setAttribute('aria-expanded', status);
    })
  }



  // locks/unlocks body scrolling while a dialog is open
  handleBodyScroll = (action) => {
    action === 'lock'
      ? document.body.classList.add('is-scrollLocked')
      : document.body.classList.remove('is-scrollLocked');
  }



  // modal mode is controlled via data-type="modal"
  isModal = (dialog) => dialog.dataset.type === 'modal';
}



// loader-compatible and boot-compatible entry point (boot.js -> mod.init(services))
export function init(services = {}) {
  return Dialogs.init(services.reporter)
}
