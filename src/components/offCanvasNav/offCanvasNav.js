/**
 * offCanvasNav.js
 * ----------------------------------------------------------------------------
 * Progressive-enhancement controller for an off-canvas ("burger") navigation
 * built on the native <dialog> element: the site navigation is authored as an
 * ordinary block in the page, and below the navigation breakpoint the module
 * turns it into a drawer that slides in over the page from a burger control.
 *
 * What works without this script
 * ------------------------------
 * The markup is a <dialog> holding the navigation plus a link pointing at it.
 * The stylesheet renders that dialog as what it is until this module has taken
 * over — a plain block in the flow — so the whole navigation is visible and
 * every link reachable, and the burger is a working in-page link to it.
 * Nothing is hidden and no control does nothing. Every rule that collapses the
 * navigation is scoped to data-offcanvasnav-ready, which is set only once the
 * drawer can actually be opened, so "collapsed into a drawer" and "there is a
 * control that opens it" always arrive together.
 *
 * The same flow rendering is what the page shows *above* the navigation
 * breakpoint, where the burger is gone and the full navigation belongs in the
 * page again. So one piece of markup serves both layouts and neither the
 * navigation nor its links are ever duplicated.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * A <dialog> opened with showModal() renders in the top layer above the rest
 * of the page, keeps the focus inside itself, makes everything behind it
 * inert, paints a ::backdrop, closes on Escape and restores the focus to the
 * opener afterwards. The slide-in and the backdrop fade are pure CSS
 * (@starting-style). We deliberately lean on all of it — the same way dialog
 * does — and only fill the gaps.
 *
 * What this script adds
 * ---------------------
 * 1. The trigger. It lives *outside* the dialog and names it by id
 *    (data-offcanvasnav-toggle="<dialogId>"). Clicks are handled through one
 *    delegated listener on document rather than a listener per control found
 *    at init, so a burger inserted later — CMS/AJAX content, a framework
 *    re-render — still opens the drawer. ARIA is seeded per trigger the first
 *    time it is seen, which happens at construction and again on every
 *    open/close, so any trigger present by the time the drawer is first used
 *    ends up fully wired.
 * 2. The link-to-button upgrade. The recommended trigger is an
 *    <a href="#<dialogId>">, because that is a control with a job before this
 *    module exists: it navigates to the navigation, which is then a plain
 *    block in the page. Once the drawer is there the link's job is taken over
 *    — a control that opens a dialog is a button — so the module prevents the
 *    jump, corrects the role and handles Space, which a link does not. Only
 *    where the drawer rendering applies, though: above the navigation
 *    breakpoint the link keeps its original job and the click is handed back
 *    to the browser, because a drawer opened up there would be the flow
 *    rendering lifted into the top layer (see open).
 * 3. Light dismiss: a press beside the panel closes the drawer. This is not
 *    native. Because the visible surface is an inner panel and the <dialog>
 *    itself is a padding-free box over the whole viewport, a click whose
 *    target IS the <dialog> can only have landed next to the panel — no
 *    coordinate math needed (the same trick as dialog).
 * 4. Body scroll lock: a modal dialog makes the page behind it inert but does
 *    NOT stop it from scrolling, so a body class does. It is released only
 *    once no other modal dialog is open, which is read from the DOM rather
 *    than counted per instance — that way it also sees the dialogs of other
 *    components sharing the same class.
 * 5. Closing on an in-page link: a link that stays on this document would
 *    leave the drawer covering the very target it just jumped to, so the
 *    drawer closes and lets the browser do the navigating. Links to another
 *    document are left alone — there the browser replaces the page anyway.
 *    The focus follows the reader to the jump target rather than back to the
 *    burger the platform would return it to (see refocus). A press that does
 *    not take this page anywhere keeps the drawer open: a modified click
 *    (new tab, new window), a target or download attribute, or a click
 *    another script has already handled (see navigatesInPlace).
 * 6. Closing when the navigation breakpoint is crossed: from there up the
 *    page shows its full navigation again, so a drawer left open would cover
 *    a page that no longer needs it, with the focus trapped inside it. CSS
 *    cannot take an element out of the top layer, so this is the one state
 *    change that has to happen in script. The burger is display:none from
 *    there up, so the focus goes to the panel — the platform's own
 *    restoration would drop it on <body> (see refocus).
 * 7. The role of the flow rendering. A <dialog> is exposed as role="dialog"
 *    whether it is open or not, and no stylesheet can change that — so above
 *    the navigation breakpoint the whole navigation would sit in a "dialog"
 *    that is in fact a plain block in the page, and a screen reader
 *    announces it as one. The role is therefore corrected for exactly that
 *    state and handed back as soon as the drawer rendering applies (see
 *    syncRole).
 * 8. The exit. The entrance is pure CSS (@starting-style), the exit cannot
 *    be: a dialog that has been closed leaves the top layer at once in every
 *    engine without the "overlay" property — Chromium is still the only one
 *    that has it — so the panel is off the screen before it could animate.
 *    So the drawer is *not* closed on the way out; it is marked with
 *    data-offcanvasnav-closing, which is what the stylesheet animates, and
 *    the native close() follows once that has played. Every path out of the
 *    drawer runs through it, Escape included (see handleCancel).
 *
 * Composition instead of a second navigation
 * ------------------------------------------
 * Submenus are none of this module's business: put a dropdownNav inside the
 * drawer and it brings its own disclosure buttons — its stacked layout is
 * exactly the one that applies below the navigation breakpoint, so the
 * submenus collapse in the drawer like an accordion. This module owns the
 * drawer, its trigger and its dismissal, nothing else.
 *
 * Accessibility
 * -------------
 * The drawer is a modal dialog, so the platform provides the focus trap, the
 * inert page, Escape and the focus restoration to the burger — which needs
 * the burger to have had the focus when the drawer opened, and a clicked
 * control does not get it in every engine (see adoptFocus). The
 * trigger gets aria-haspopup="dialog" and aria-controls; aria-expanded is
 * deliberately omitted, because the ARIA APG modal-dialog pattern uses
 * aria-haspopup alone — a modal takes over the page instead of expanding a
 * region that belongs to the trigger (dialog does the same). The <dialog>
 * needs an accessible name (aria-label / aria-labelledby, ideally pointing at
 * the drawer title); a missing one is reported rather than silently shipped.
 * Which element receives the focus on open stays the markup's business —
 * autofocus on the close control is the usual choice.
 *
 * Two paths out of the drawer need the focus somewhere other than the burger
 * the platform hands it back to, and both name their target before closing
 * (see refocus): the navigation breakpoint, where the burger is display:none
 * from there up and the focus would land on <body>, and an in-page link,
 * where the reader has just jumped somewhere that is not the burger. The
 * dialog role of the flow rendering is corrected in syncRole.
 *
 * Configuration
 * -------------
 * On the <dialog> (data-js-behavior="offCanvasNav"):
 * - id                              required; the triggers address the
 *                                   drawer by it. Without one the markup is
 *                                   left completely alone.
 * - data-offcanvasnav-always        the drawer is used at every viewport
 *                                   width, so the module does not close it
 *                                   at the navigation breakpoint (optional)
 * - data-offcanvasnav-side="end"    style only: the panel comes in from the
 *                                   inline-end edge instead (optional)
 *
 * On the trigger (anywhere on the page):
 * - data-offcanvasnav-toggle="<id>" the drawer this control opens
 *
 * Inside the drawer:
 * - data-offcanvasnav-panel         required; the visible panel, i.e. the
 *                                   element the exit animation moves
 * - data-offcanvasnav-close         any element that closes the drawer
 * ----------------------------------------------------------------------------
 */



import { getCssCustomProperty } from './getCssCustomProperty.js';



const defaults = {

  // The burger control, outside the dialog, naming its drawer by id — the
  // same shape as dialog's data-open-dialog. Clicks on it are caught by one
  // delegated listener, so a trigger added later works too.
  triggerAttr: 'data-offcanvasnav-toggle',

  // A control inside the drawer that closes it; presence is enough.
  closeAttr: 'data-offcanvasnav-close',

  // The visible panel inside the dialog. The script needs a handle on it
  // for one thing only: the exit animation runs on it, so its computed
  // transition-duration is how long the drawer has to be kept open (see
  // exitDuration). Styling stays keyed on the class, as everywhere else.
  panelAttr: 'data-offcanvasnav-panel',

  // Set on the dialog while the drawer is on its way out — still open, but
  // already animating away. Presentational, like openAttr below: it exists
  // so the stylesheet has a state to move the panel and fade the backdrop
  // on. Closing the dialog first and animating afterwards is not an option,
  // see point 7 in the file header.
  closingAttr: 'data-offcanvasnav-closing',

  // Presence on the dialog opts out of the breakpoint coupling: the drawer
  // is then the navigation at every viewport width. Mirrored onto the
  // triggers, see seedTrigger.
  alwaysAttr: 'data-offcanvasnav-always',

  // "The module has taken over." Set on the dialog and on every trigger.
  // The stylesheet keeps the navigation in the flow until it is there, so
  // the drawer rules and the control that opens the drawer cannot exist
  // without each other.
  readyAttr: 'data-offcanvasnav-ready',

  // Purely presentational hook on the triggers while the drawer is open —
  // it carries no meaning for assistive tech (the ARIA above does that) and
  // exists so the stylesheet can morph the burger into a cross.
  openAttr: 'data-offcanvasnav-open',

  // Body class toggled while the drawer (or any other modal dialog) is open.
  scrollLockClass: 'is-scrollLocked',

  // The role the <dialog> is given while it is rendered as a plain block in
  // the page, i.e. while it is not a dialog at all — see syncRole for why it
  // is this role and not "none".
  flowRole: 'generic',

  // Shared token holding the navigation breakpoint, so the auto-close and
  // the layout switch in the stylesheet cannot drift apart (see
  // navExpandedMediaQuery).
  navBreakpointProp: '--bp-navigation',
};



// The navigation breakpoint stays single-sourced in the SCSS
// (--bp-navigation, see _shared/scss/_breakpoint_tokens.scss) and is read
// back from there — the same helper dropdownNav uses. A project that does not
// ship the token gets a query that never matches, which leaves the drawer in
// charge at every width: the safe end of the trade, because the alternative
// would be closing the drawer at a width where nothing else shows the
// navigation.
const lengthPattern = /^[\d.]+(px|em|rem)$/;

function navExpandedMediaQuery(prop) {
  const breakpoint = getCssCustomProperty(document.documentElement, prop);
  if (!lengthPattern.test(breakpoint)) return 'not all';
  return `(min-width: ${breakpoint})`;
}



// Whether the engine knows :modal (it tells an actually-modal dialog from one
// merely opened with show()). Probed once, because matches() throws on a
// selector the engine cannot parse — see otherModalOpen.
const supportsModalSelector =
  typeof CSS !== 'undefined' && CSS.supports?.('selector(:modal)') === true;



class OffCanvasNav {

  constructor(dialog, params, reporter) {
    this.dialog = dialog;
    this.params = params;
    this.reporter = reporter;

    this.seededTriggers = new WeakSet();
    this.isAlways = dialog.hasAttribute(params.alwaysAttr);
    this.enhanced = false;
    this.isClosing = false;
    this.exitTimer = 0;
    this.refocusTarget = null;

    this.panel = dialog.querySelector(`[${params.panelAttr}]`);

    // Read before anything is written, so destroy can hand the markup back
    // as it was authored. A <dialog> carrying a role of somebody else's
    // choosing is left with it — see syncRole.
    this.authoredRole = dialog.getAttribute('role');
    this.managesRole =
      this.authoredRole === null || this.authoredRole === params.flowRole;

    this.reportMissingName();
    this.reportMissingPanel();

    this.triggerSelector = this.buildTriggerSelector();
    if (!this.triggerSelector) return;

    this.startListening();
    this.syncTriggers();
    this.syncRole();
    this.reportMissingTrigger();

    // Set last, and only for a drawer that can be opened: until it is there
    // the stylesheet renders the dialog as a plain block, so a failure above
    // hands the navigation back to the page instead of hiding it away.
    dialog.setAttribute(params.readyAttr, '');
    this.enhanced = true;
  }



  // A dialog is announced by its accessible name, so without one a screen
  // reader user is dropped into an unnamed dialog and has to guess what it
  // holds.
  reportMissingName = () => {
    const hasName =
      this.dialog.hasAttribute('aria-label') ||
      this.dialog.hasAttribute('aria-labelledby');
    if (hasName) return;

    this.reporter?.report(
      'offCanvasNav',
      'the drawer has no accessible name — add aria-label, or ' +
      'aria-labelledby pointing at the drawer title, to the <dialog>.',
      this.dialog
    );
  };



  // Without the panel the drawer still opens and closes, it just does so
  // without an exit animation — the panel is what the script times the
  // close against (see exitDuration). Reported rather than fatal for
  // exactly that reason: nothing about the navigation is lost.
  reportMissingPanel = () => {
    if (this.panel) return;

    this.reporter?.report(
      'offCanvasNav',
      `no [${this.params.panelAttr}] inside the drawer — it will close ` +
      'without playing its exit animation.',
      this.dialog
    );
  };



  // Builds the selector matching this drawer's triggers. Returns null (and
  // reports) when the dialog has no id: nothing could address the drawer
  // then, and collapsing the navigation into a drawer nobody can open would
  // take the whole navigation off the page. This is the one failure that
  // leaves the markup completely untouched (see the constructor).
  buildTriggerSelector = () => {
    const id = this.dialog.id;
    if (!id) {
      this.reporter?.report(
        'offCanvasNav',
        'the <dialog> has no id, so no trigger can address it — the ' +
        'navigation is left in the page as a plain block.', this.dialog
      );
      return null;
    }
    return `[${this.params.triggerAttr}="${CSS.escape(id)}"]`;
  };



  // A drawer whose trigger is missing (or misspells the id) is a navigation
  // nobody can reach on a narrow viewport. Triggers may legitimately arrive
  // later, which is why this reports instead of bailing out.
  reportMissingTrigger = () => {
    if (this.getTriggers().length) return;

    this.reporter?.report(
      'offCanvasNav',
      `no trigger found for this drawer — add ` +
      `${this.params.triggerAttr}="${this.dialog.id}" to the control that ` +
      'should open it.', this.dialog
    );
  };



  // Re-queried rather than cached, so a trigger inserted after construction
  // is picked up the next time this runs (see syncTriggers).
  getTriggers = () => [...document.querySelectorAll(this.triggerSelector)];



  // Seeds ARIA on every trigger not seen yet and reflects the open state onto
  // all of them. Called at construction and again from open()/close(), so a
  // trigger added later is fully wired the next time the drawer is used — the
  // click handling is delegated for the same reason.
  syncTriggers = (isOpen = false) => {
    for (const trigger of this.getTriggers()) {
      if (!this.seededTriggers.has(trigger)) this.seedTrigger(trigger);
      trigger.toggleAttribute(this.params.openAttr, isOpen);
    }
  };



  seedTrigger = (trigger) => {
    this.seededTriggers.add(trigger);

    // aria-expanded is deliberately NOT set: the APG modal-dialog pattern
    // uses aria-haspopup alone, because a modal dialog takes over the page
    // rather than expanding a region that belongs to the trigger.
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', this.dialog.id);

    // "The module has taken over", plus the drawer's own "always" mode
    // mirrored onto the control. Only this module knows which trigger
    // belongs to which drawer, so the stylesheet could not decide by itself
    // whether this burger survives above the navigation breakpoint.
    trigger.setAttribute(this.params.readyAttr, '');
    if (this.isAlways) trigger.setAttribute(this.params.alwaysAttr, '');

    // The recommended trigger is a link to the navigation, because that
    // works without this module (see the file header). Now that it opens a
    // dialog it is a button, and saying so is what makes Space work below
    // and stops a screen reader announcing a link that navigates nowhere.
    if (trigger.tagName !== 'A') return;
    trigger.setAttribute('role', 'button');
  };



  // Delegated: matches a press anywhere on the page against this drawer's
  // trigger selector, so a trigger inserted after construction opens the
  // drawer too (see the file header).
  handleTriggerClick = (event) => {
    if (event.defaultPrevented) return;

    const trigger = event.target.closest?.(this.triggerSelector);
    if (!trigger) return;

    // No drawer to open in the flow rendering, and there the trigger's own
    // job is exactly right: jump to the navigation, which is a plain block
    // in the page. So the click is handed back to the browser rather than
    // prevented — the same fallback the trigger has before this module
    // exists (see open() for why it is refused up there).
    if (!this.isDrawerRendering()) return;

    // The trigger is a link to the navigation, and the navigation is now in
    // a drawer — so the jump is what the drawer replaces.
    event.preventDefault();

    this.adoptFocus(trigger);
    this.open();
  };



  // The platform restores the focus to whatever had it when the drawer
  // opened, so that route needs an element to go back to — and a clicked
  // control does not get the focus in every engine: WebKit follows the macOS
  // convention and leaves it where it was, i.e. on <body>, with nothing to
  // restore. So the focus goes onto the trigger before opening — but only
  // where the click left it nowhere: an engine that focuses its clicked
  // controls needs no help (the call would be a no-op), and a project that
  // moves the focus itself during the same click keeps it. Giving the
  // platform its target beats rebuilding the restoration in the close path,
  // which would have to sort itself out against refocus and check whether
  // the burger is focusable at all (above the breakpoint it is none).
  // preventScroll because this is bookkeeping, not navigation — the control
  // was just clicked, so it is in view anyway. Keyboard activation needs
  // none of it: there the trigger has the focus by definition (see
  // handleTriggerKeydown).
  //
  // In WebKit the restored focus then draws its ring, because WebKit reads a
  // programmatic focus as a keyboard one. That is deliberate: the focus
  // really is on the burger afterwards, so showing it is honest — and
  // suppressing an indicator to hide a focus position we just placed would
  // be the wrong end of the trade.
  adoptFocus = (trigger) => {
    const active = document.activeElement;
    if (active && active !== document.body) return;

    trigger.focus({ preventScroll: true });
  };



  // Space activates a button but not a link, so the shape that carries the
  // no-JS fallback needs it added back (Enter works natively on both).
  handleTriggerKeydown = (event) => {
    if (event.defaultPrevented) return;
    if (event.key !== ' ') return;

    const trigger = event.target.closest?.(this.triggerSelector);
    if (!trigger || trigger.tagName !== 'A') return;

    // Nothing to open in the flow rendering — and nothing to prevent
    // either, see handleTriggerClick.
    if (!this.isDrawerRendering()) return;

    // Also keeps the key press from scrolling the page.
    event.preventDefault();
    this.open();
  };



  handleDialogClick = (event) => {
    
    // Delegated, so a close control rendered into the drawer later works
    // without being wired up separately.
    if (event.target.closest(`[${this.params.closeAttr}]`)) {
      this.close();
      return;
    }

    // Light dismiss: the dialog is a padding-free box over the whole
    // viewport and everything visible is the inner panel, so a click whose
    // target is the dialog itself landed beside the panel.
    if (event.target === this.dialog) {
      this.close();
      return;
    }

    const link = event.target.closest('a[href]');
    if (!link || !this.isSameDocumentLink(link)) return;
    if (!this.navigatesInPlace(event, link)) return;

    // The platform hands the focus back to the burger on close, and that is
    // not where the reader just went — the jump target is. Named here, moved
    // once the drawer has actually closed (see refocus).
    this.refocusTarget = this.fragmentTarget(link);
    this.close();
  };



  // Whether this press really is the browser taking *this* page to the link's
  // target, which is the only reason the drawer gets out of the way. It is
  // not, in four cases: another script has already handled the click (a
  // project's own control authored as a link inside the drawer — a
  // preventDefault does not stop the event from reaching us), a modified
  // click opens a tab or a window instead, a target names somewhere other
  // than this document, and a download navigates nowhere at all. In each of
  // them the reader stays exactly where they were, so a drawer that closed
  // would have closed for nothing — and dropped the focus somewhere else on
  // the way out. A middle click needs no test of its own: it fires
  // "auxclick", not "click".
  navigatesInPlace = (event, link) => {
    if (event.defaultPrevented) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return false;
    }
    if (link.target && link.target !== '_self') return false;
    return !link.hasAttribute('download');
  };



  // The element an in-page link points at, if it points at one at all: the
  // fragment may be empty (a link to the top of the same document) or name
  // nothing that exists. The browser percent-encodes a non-ASCII fragment in
  // link.hash, while the id in the document is not encoded, so it is decoded
  // back — guarded, because decodeURIComponent throws on a malformed escape.
  fragmentTarget = (link) => {
    const raw = link.hash.slice(1);
    if (!raw) return null;

    let id = raw;
    try {
      id = decodeURIComponent(raw);
    } catch {

      // Not decodable, so the raw fragment is the best guess there is.
    }

    return document.getElementById(id);
  };



  // A link that stays on this document leaves the reader on a page the
  // drawer is covering — including the very target it just jumped to — so
  // the drawer gets out of the way and the browser does the navigating.
  // Cross-document links are left alone: there the page is replaced anyway,
  // and closing first would only add a flash of the old page.
  //
  // Read off the link's own URL decomposition attributes rather than parsing
  // its href: they are already resolved against the document, and unlike a
  // URL() call they cannot throw on an href the browser could not resolve.
  // A javascript: or mailto: link reports an opaque origin, so it does not
  // match either.
  isSameDocumentLink = (link) =>
    link.origin === window.location.origin &&
    link.pathname === window.location.pathname &&
    link.search === window.location.search;



  // Which of the two renderings is in effect right now. Mirrors the two
  // scopes in the stylesheet exactly: the drawer applies below the navigation
  // breakpoint, and at every width for a drawer carrying
  // data-offcanvasnav-always.
  isDrawerRendering = () =>
    this.isAlways || this.expandedQuery?.matches !== true;



  // A <dialog> is exposed as role="dialog" whether it is open or not, and the
  // flow rendering cannot change that from CSS: above the navigation
  // breakpoint the whole navigation would sit in a "dialog" that is in fact a
  // plain block in the page, and a screen reader announces it as one. So the
  // role is corrected for exactly that state and taken back off the moment
  // the drawer rendering applies again.
  //
  // role="generic" and not role="none", which is the obvious candidate and
  // does not work here on two counts: a presentational role is dropped again
  // as soon as the element carries any global ARIA attribute (the drawer's
  // own aria-labelledby is one), and on a <dialog> engines refuse it even
  // without one — verified in Chromium, where role="none" and
  // role="presentation" both still resolve to role="dialog". "generic" is a
  // real role, so it wins; and an engine that does not know it falls back to
  // the element's implicit role, which is the behaviour we had anyway.
  syncRole = () => {
    if (!this.managesRole) return;

    if (this.isDrawerRendering()) this.dialog.removeAttribute('role');
    else this.dialog.setAttribute('role', this.params.flowRole);
  };



  // The page shows its full navigation from the breakpoint up (the very same
  // markup, rendered as a plain block), so a drawer left open would cover a
  // page that no longer needs it — with the focus trapped inside it.
  handleViewportChange = (event) => {
    if (event.matches) {

      // The burger is display:none from here up, so the platform's own focus
      // restoration would drop the focus on <body>. The navigation is about
      // to be a block in the page again, and the panel is where it sits.
      this.refocusTarget = this.panel;
      this.close();
    }

    // After the close, so an open drawer is never left as a modal dialog
    // without the dialog role: the drawer rendering — and with it the panel's
    // transition — has already stopped applying at this point, so close()
    // finds nothing to wait for and closes straight away.
    this.syncRole();
  };



  startListening = () => {

    // The trigger lives outside the dialog by definition, so both of its
    // listeners sit on the document.
    document.addEventListener('click', this.handleTriggerClick);
    document.addEventListener('keydown', this.handleTriggerKeydown);

    this.dialog.addEventListener('click', this.handleDialogClick);

    // Escape is the one dismissal the platform performs by itself. Caught
    // here so it takes the same animated route out as everything else.
    this.dialog.addEventListener('cancel', this.handleCancel);

    // The single close funnel: every path out of the drawer — the close
    // control, a press beside the panel, Escape, an in-page link, the
    // breakpoint, a programmatic close() — ends in the native "close"
    // event, so there is exactly one place that unlocks the page and resets
    // the triggers, and no path can bypass it. The one caller that reaches
    // the funnel without the event is the teardown, which cannot wait for a
    // queued task — see destroy.
    this.dialog.addEventListener('close', this.handleClose);

    if (this.isAlways) return;

    this.expandedQuery = window.matchMedia(
      navExpandedMediaQuery(this.params.navBreakpointProp)
    );
    this.expandedQuery.addEventListener('change', this.handleViewportChange);
  };



  open = () => {
    if (this.dialog.open) return;

    // Modal only where the drawer rendering applies. Above the navigation
    // breakpoint the stylesheet renders the dialog as a plain block, and
    // showModal() would lift *that* into the top layer: a chrome-free strip
    // in the corner with no panel and no backdrop, the whole page inert
    // behind it and the focus trapped inside, Escape the only way out. The
    // burger is display:none up there, so the intended markup never gets
    // here — a trigger a project styled itself does, which is why the
    // invariant is enforced here instead of being left to the stylesheet.
    if (!this.isDrawerRendering()) return;

    // showModal() is what enables the top layer, the focus trap, the inert
    // page behind it, ::backdrop and the Escape handling.
    this.dialog.showModal();

    this.lockScroll();
    this.syncTriggers(true);
  };



  // The one way out of the drawer. It closes in two steps, because the
  // platform gives us no way to animate the second one: the dialog is
  // marked as closing and stays open while the stylesheet moves the panel
  // out, and only then is it really closed. Closing first and animating
  // afterwards works in Chromium (allow-discrete on display/overlay holds
  // the dialog in the top layer) and nowhere else — Firefox and Safari have
  // no "overlay" property, so the drawer would simply vanish there.
  close = () => {
    if (!this.dialog.open || this.isClosing) return;

    // The attribute goes on first: it is what switches the panel to its
    // exit timing, and that is the timing read back on the next line.
    this.dialog.setAttribute(this.params.closingAttr, '');

    // The burger unfolds together with the drawer rather than after it.
    this.syncTriggers(false);

    const duration = this.exitDuration();
    if (!duration) {
      this.dialog.close();
      return;
    }

    this.isClosing = true;
    this.exitTimer = window.setTimeout(this.finishExit, duration);
  };



  finishExit = () => {

    // Funnels through the native "close" event, so handleClose does the
    // teardown no matter which path got here.
    this.dialog.close();
  };



  // How long the exit is given, read back from the panel's own computed
  // transition-duration rather than duplicated here: the timing lives in
  // the stylesheet (--offCanvasNav-duration-exit), and a project that
  // retunes it — or a reduced-motion preference that flattens it — is
  // followed without a second source of truth. Zero means there is nothing
  // to wait for: no panel, or the drawer rendering does not apply at this
  // viewport, in which case the drawer closes straight away.
  exitDuration = () => {
    if (!this.panel) return 0;

    // A computed transition-duration is always in seconds, with one entry per
    // transitioned property; the delays are their own list, which CSS repeats
    // from the start when it is the shorter one — hence the wrap-around
    // index. A property is done at its delay plus its duration, so the
    // longest of those sums is when the exit has played out. Reading the
    // delay too is what makes "the timing lives in the stylesheet" true for a
    // project that staggers the exit instead of only retuning its length; a
    // negative delay starts the transition partway in and therefore shortens
    // it, which the same sum expresses (floored at zero).
    const style = window.getComputedStyle(this.panel);
    const durations = style.transitionDuration.split(',');
    const delays = style.transitionDelay.split(',');

    const seconds = durations.reduce((longest, value, index) => {
      const duration = Number.parseFloat(value) || 0;
      const delay = Number.parseFloat(delays[index % delays.length]) || 0;
      return Math.max(longest, Math.max(0, duration + delay));
    }, 0);

    return seconds * 1000;
  };



  // Escape is handled by the platform, and it closes the dialog on the
  // spot — without the exit. The cancel event is where that native
  // dismissal is turned into the same animated close as every other path.
  // A programmatic close() fires no cancel, so the exit started here is not
  // caught again when it finishes.
  handleCancel = (event) => {
    event.preventDefault();
    this.close();
  };



  handleClose = () => {
    window.clearTimeout(this.exitTimer);
    this.isClosing = false;
    this.dialog.removeAttribute(this.params.closingAttr);

    this.unlockScroll();
    this.syncTriggers(false);
    this.refocus();
  };



  // Sends the focus where the path out of the drawer asked for it instead of
  // to the burger. Runs from the native "close" event, which is *after* the
  // platform has restored the focus to the opener — moving it any earlier
  // would only get overwritten. Without a named target the platform's
  // restoration is exactly right and nothing happens here.
  refocus = () => {
    const target = this.refocusTarget;
    this.refocusTarget = null;

    if (!target?.isConnected) return;

    // A container — the panel, a heading, a section — is not focusable by
    // itself. The attribute that makes it focusable is taken back off once
    // the focus leaves again, so the markup keeps the shape it was authored
    // in; an element that was focusable already is simply focused.
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
      target.addEventListener(
        'blur', () => target.removeAttribute('tabindex'), { once: true }
      );
    }

    target.focus();
  };



  lockScroll = () => {
    document.body.classList.add(this.params.scrollLockClass);
  };



  // Released only when no other modal dialog is still up: the body class is
  // shared with dialog, and a dialog opened from inside the drawer would be
  // left with a scrolling page behind it. Read from the DOM rather than
  // counted per instance, because a counter in this module could only ever
  // see this module's own drawers.
  unlockScroll = () => {
    if (this.otherModalOpen()) return;
    document.body.classList.remove(this.params.scrollLockClass);
  };



  otherModalOpen = () => {
    if (!supportsModalSelector) return false;

    return [...document.querySelectorAll('dialog[open]')].some(
      (other) => other !== this.dialog && other.matches(':modal')
    );
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly
  // instead of doing a full page (re)load — see destroyModulesInScope() in
  // boot.js. An open drawer is closed and put through the existing close
  // funnel (scroll lock, trigger state), then the document/media-query
  // listeners go and the markup is handed back as it was authored: the
  // triggers lose the ARIA and the role this module put on them, and the
  // dialog loses the attribute that collapses the navigation into a drawer.
  destroy = () => {

    // Straight to the native close, not through the animated one: a
    // teardown has nothing to show and nobody left to show it to — and with
    // nobody left, there is no focus to place either.
    this.refocusTarget = null;
    const wasOpen = this.dialog.open;
    if (wasOpen) this.dialog.close();
    window.clearTimeout(this.exitTimer);

    document.removeEventListener('click', this.handleTriggerClick);
    document.removeEventListener('keydown', this.handleTriggerKeydown);
    this.dialog.removeEventListener('click', this.handleDialogClick);
    this.dialog.removeEventListener('cancel', this.handleCancel);
    this.dialog.removeEventListener('close', this.handleClose);
    this.expandedQuery?.removeEventListener('change', this.handleViewportChange);

    // close() does not dispatch "close" then and there — it queues a task —
    // so the listener removed a line ago would have swallowed the teardown
    // the funnel exists for, and a drawer torn down while it was open would
    // have left the page scroll-locked with nothing on it to unlock. This is
    // the one caller that runs the funnel by hand, and it runs it *after* the
    // listener is gone so the queued event cannot run it a second time.
    if (wasOpen) this.handleClose();

    if (!this.enhanced) return;

    this.dialog.removeAttribute(this.params.readyAttr);

    // Whatever the role was before this module started managing it — an
    // attribute of its own, or none at all.
    if (this.managesRole) {
      if (this.authoredRole === null) this.dialog.removeAttribute('role');
      else this.dialog.setAttribute('role', this.authoredRole);
    }

    for (const trigger of this.getTriggers()) {
      if (!this.seededTriggers.has(trigger)) continue;

      trigger.removeAttribute('aria-haspopup');
      trigger.removeAttribute('aria-controls');
      trigger.removeAttribute(this.params.readyAttr);
      trigger.removeAttribute(this.params.alwaysAttr);
      trigger.removeAttribute(this.params.openAttr);

      // Only the role this module set is taken back off.
      if (trigger.getAttribute('role') === 'button') {
        trigger.removeAttribute('role');
      }
    }

    this.enhanced = false;
  };
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement) || el.tagName !== 'DIALOG') {
    reporter?.report(
      'offCanvasNav',
      'module must be initialized on a <dialog> element.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new OffCanvasNav(el, defaults, reporter);
  return instance.destroy;
}
