/**
 * parseNonNegative.js
 * ----------------------------------------------------------------------------
 * Parses a non-negative numeric option, falling back for a missing or
 * unusable value. Used for the attributes whose value is a distance in px — a
 * pin offset, a spy line, a scroll threshold: a negative one would put the
 * trigger edge on the wrong side of the box it belongs to, so it counts as
 * unusable rather than as a direction.
 * ----------------------------------------------------------------------------
 */



export function parseNonNegative(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
