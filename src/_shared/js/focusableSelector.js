/**
 * focusableSelector.js
 * ----------------------------------------------------------------------------
 * Elements that can already receive keyboard focus. Several components ask the
 * same question of a box — does it hold something the keyboard reaches by
 * itself? — and act on opposite answers:
 *   - dialog / tabs: a box that holds one needs no tabindex of its own, so an
 *     extra tab stop on the container would be redundant noise.
 *   - toast: a message that holds one must never be taken away on a timer,
 *     because the reader has to be able to reach that control (WCAG 2.2.1).
 *   - dropdownNav: it is the first thing the focus should land on when a
 *     submenu is opened from the keyboard.
 *
 * Disabled controls and tabindex="-1" are excluded: focusing them would
 * silently do nothing, so they cannot stand in for reachable content.
 * ----------------------------------------------------------------------------
 */



export const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(',');
