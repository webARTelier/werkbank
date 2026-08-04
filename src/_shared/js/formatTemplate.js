/**
 * formatTemplate.js
 * ----------------------------------------------------------------------------
 * Interpolates {placeholder} tokens in a template string from a plain values
 * object. The templates are the localized strings a component displays or
 * announces, which is why they are plain strings and not functions: that keeps
 * the whole label map JSON-shaped, so a CMS can override it 1:1 (see
 * formValidation's data-fv-messages block) and word order stays with the
 * translation rather than with the code.
 *
 * An unknown placeholder is left as it is, so a typo in a template stays
 * visible instead of turning into a silent gap.
 * ----------------------------------------------------------------------------
 */



export function formatTemplate(template, tokens) {
  if (!template) return '';

  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    key in tokens ? String(tokens[key]) : match
  );
}
