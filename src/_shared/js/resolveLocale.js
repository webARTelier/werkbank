/**
 * resolveLocale.js
 * ----------------------------------------------------------------------------
 * Chooses a locale from <html lang> against the locales a caller offers:
 * the exact tag wins over its base language (lang="de-CH" matches an
 * offered "de-ch" before falling back to "de"); a page language that is
 * not offered at all falls back to the given default.
 *
 * Pure, stateless utility — import it directly as a flat sibling
 * (`import { resolveLocale } from "./resolveLocale.js"`); the build
 * resolves it from _shared/js/ and bundles it into the importing
 * component's lazy chunk (see CLAUDE.md, "DI vs. direct import").
 * ----------------------------------------------------------------------------
 */



export function resolveLocale(locales, fallbackLocale) {
  const raw = (document.documentElement.lang || "").toLowerCase()
  const base = raw.split("-")[0]

  if (locales.includes(raw)) return raw
  if (locales.includes(base)) return base
  return fallbackLocale
}
