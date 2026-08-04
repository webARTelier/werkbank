/**
 * uniqueId.js
 * ----------------------------------------------------------------------------
 * Builds an id that is free in the document, for the nodes a component has to
 * be able to point at (aria-controls, aria-labelledby) and the author did not
 * name: siteSearch's form, dropdownNav's panels, lightbox's viewer.
 *
 * The counter is module-wide, so several instances on one page never collide,
 * and the result is checked against the document, so a hand-written id of the
 * same shape elsewhere cannot be shadowed. Ids are generated only where the
 * author provided none — an authored id is always kept.
 * ----------------------------------------------------------------------------
 */



let counter = 0;

export function uniqueId(prefix) {
  let id = `${prefix}-${++counter}`;

  while (document.getElementById(id)) {
    id = `${prefix}-${++counter}`;
  }

  return id;
}
