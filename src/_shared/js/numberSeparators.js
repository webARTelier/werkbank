/**
 * numberSeparators.js
 * ----------------------------------------------------------------------------
 * The group and decimal separator of a locale, asked of the platform rather
 * than assumed: "1.234" is one number in English and another in German.
 * Intl.NumberFormat().formatToParts() names the parts of a number the browser
 * has just formatted, so the two characters come from the same source the
 * browser itself uses — no table of locales to keep in step.
 *
 * Note that neither character is always the one a keyboard can type: fr-FR
 * groups with a narrow no-break space (U+202F) and de-CH with an apostrophe.
 * Callers must therefore compare against these values, never against "." and
 * ",".
 *
 * A locale Intl refuses falls back to the neutral pair — no grouping and a
 * "." decimal — so a caller renders a bare number rather than nothing at all.
 *
 * Pure, stateless utility — import it directly as a flat sibling
 * (`import { numberSeparators } from "./numberSeparators.js"`); the build
 * resolves it from _shared/js/ (see CLAUDE.md, "DI vs. direct import").
 * ----------------------------------------------------------------------------
 */



export function numberSeparators(locale) {
  try {

    // A value with both a group and a fraction, so both parts are present.
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
    const valueOf = (type) =>
      parts.find((part) => part.type === type)?.value || '';

    return { group: valueOf('group'), decimal: valueOf('decimal') || '.' };
  } catch {

    // An unusable locale: no grouping is always readable, "." is the widest
    // understood decimal point.
    return { group: '', decimal: '.' };
  }
}
