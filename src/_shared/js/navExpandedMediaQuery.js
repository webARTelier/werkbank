/**
 * navExpandedMediaQuery.js
 * ----------------------------------------------------------------------------
 * Builds the media query for "the navigation is expanded" — the viewport range
 * where a site navigation shows itself in full rather than behind a burger.
 * The breakpoint stays single-sourced in the SCSS (--bp-navigation, see
 * _shared/scss/_breakpoint_tokens.scss) and is read back from there, so the
 * layout switch in the stylesheet and the behaviour that has to follow it
 * cannot drift apart.
 *
 * `fallback` is the query to use when the project does not ship the token, and
 * the two callers want opposite things from that case — which is why it is a
 * parameter rather than one built-in default:
 *   - offCanvasNav passes "not all" (never matches), so the drawer stays in
 *     charge at every width: closing it at a width where nothing else shows
 *     the navigation would take the navigation away.
 *   - dropdownNav passes "(min-width: 0px)" (always matches), because its flip
 *     rules are scoped to the flyout layout in the stylesheet anyway, and a
 *     stacked panel sits in the flow where it cannot overflow.
 * ----------------------------------------------------------------------------
 */



import { getCssCustomProperty } from './getCssCustomProperty.js';



// Only a length the query can carry; a token that resolves to anything else
// (or to nothing at all) is not usable as a breakpoint.
const lengthPattern = /^[\d.]+(px|em|rem)$/;



export function navExpandedMediaQuery(prop, fallback) {
  const breakpoint = getCssCustomProperty(document.documentElement, prop);
  if (!lengthPattern.test(breakpoint)) return fallback;

  return `(min-width: ${breakpoint})`;
}
