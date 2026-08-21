/**
 * pageLocale.js
 * ----------------------------------------------------------------------------
 * <html lang> as something Intl will accept, or undefined for the browser's
 * own default. An empty or malformed tag makes every Intl constructor throw,
 * and a feature dying because a lang attribute has a typo would be a poor
 * trade — so a tag Intl cannot canonicalize counts as "not stated" rather
 * than as an error.
 *
 * Not to be confused with resolveLocale: that one picks from the list of
 * locales a component actually ships translations for. This one hands the
 * page's language to Intl, which knows them all.
 *
 * Pure, stateless utility — import it directly as a flat sibling
 * (`import { pageLocale } from "./pageLocale.js"`); the build resolves it
 * from _shared/js/ (see CLAUDE.md, "DI vs. direct import").
 * ----------------------------------------------------------------------------
 */



export function pageLocale() {
  const lang = (document.documentElement.lang || '').trim();
  if (!lang) return undefined;

  try {
    Intl.getCanonicalLocales(lang);
    return lang;
  } catch {

    // Not a language tag Intl recognises, so the browser's default is the
    // better guess than a throw on every constructor downstream.
    return undefined;
  }
}
