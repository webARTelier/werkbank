/**
 * Reads and trims a CSS custom property from a given DOM scope.
 */

export function getCssCustomProperty(scope, name) {
  return getComputedStyle(scope).getPropertyValue(name).trim()
}
