/**
 * otherModalOpen.js
 * ----------------------------------------------------------------------------
 * Whether a modal <dialog> other than the given one is currently open.
 *
 * The body scroll-lock class is shared by every component that opens a modal
 * (dialog, offCanvasNav, lightbox), so the last one to close is the only one
 * that may release it: a lightbox opened from inside a drawer would otherwise
 * leave that drawer with a scrolling page behind it.
 *
 * All three have to ask, and read from the DOM rather than counting per
 * instance, because a counter in one module could only ever see that
 * module's own dialogs. dialog keeps such a counter as well — for the
 * dialogs it drives itself — and it is precisely not a substitute for this:
 * it hits zero while a drawer or a viewer is still up.
 *
 * :modal is what tells an actually-modal dialog from one merely opened with
 * show(); the support probe runs once, because matches() throws on a
 * selector the engine cannot parse.
 * ----------------------------------------------------------------------------
 */



const supportsModalSelector =
  typeof CSS !== 'undefined' && CSS.supports?.('selector(:modal)') === true;



export function otherModalOpen(self) {
  if (!supportsModalSelector) return false;

  return [...document.querySelectorAll('dialog[open]')].some(
    (other) => other !== self && other.matches(':modal')
  );
}
