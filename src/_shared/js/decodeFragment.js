/**
 * decodeFragment.js
 * ----------------------------------------------------------------------------
 * Decodes a URL fragment to the id it addresses — the pairing key of every
 * component that wires itself through plain anchor links (tabs, scrollSpy,
 * backToTop, offCanvasNav), because the href fragment IS the wiring there and
 * the no-JS jump link stays intact.
 *
 * A fragment can carry malformed percent-encoding ('#%zz' typed into the
 * markup, or mangled in a shared link), where decodeURIComponent throws. That
 * is mapped to null here, so one broken href is reported or ignored instead of
 * aborting an init or a hashchange handler.
 * ----------------------------------------------------------------------------
 */



export function decodeFragment(fragment) {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return null;
  }
}
