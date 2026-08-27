/**
 * foldText.js
 * ----------------------------------------------------------------------------
 * Lowercases a string and strips its combining marks, so a match test does
 * not depend on how a value is accented: "zurich" finds "Zürich", "cafe"
 * finds "Café", "muenchen" does NOT find "München" (that one is a
 * transliteration, not an accent, and no amount of folding turns one into
 * the other).
 *
 * Why it exists at all: a reader looking for a value should not have to know
 * its diacritics, and on a German keyboard the accented key is often not
 * even there. Born in comboBox, hoisted here the day filterList needed the
 * same test for the same reason.
 *
 * Use it for the match TEST only, never to locate a substring for marking:
 * stripping a combining mark changes a string's length, so an index into the
 * folded text is not an index into the text on screen. comboBox's markRange
 * is the worked example of that distinction.
 *
 * NFD splits a precomposed character into its base plus its marks, and
 * \p{Mn} ("mark, nonspacing") is what those marks are. The result is not
 * recomposed: nothing here is ever displayed.
 * ----------------------------------------------------------------------------
 */



export function foldText(text) {
  return text.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
}
