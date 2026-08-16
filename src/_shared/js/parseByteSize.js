/**
 * parseByteSize.js
 * ----------------------------------------------------------------------------
 * Parses a file-size option — "5MB", "1,5 gb", "500 kb", "204800" — into a
 * number of bytes, falling back for a missing or unusable value. For the
 * limits an author writes in the markup, where "5242880" says nothing to the
 * next reader of that line and "5MB" says all of it.
 *
 * Decimal steps (1 kB = 1000 bytes), because that is what the unit names mean
 * in CLDR and what Intl.NumberFormat prints from them — a limit written "5MB"
 * has to be the same 5 MB the size next to it reports, or the reader is told
 * that a 5.1 MB file exceeds 5 MB while both lines read "5 MB".
 *
 * A bare number is bytes. Zero and negative values are unusable rather than
 * meaningful — "nothing may be larger than nothing" is a typo, not a limit —
 * and take the fallback, the same reading parseNonNegative applies to a
 * negative distance.
 * ----------------------------------------------------------------------------
 */



// The accepted suffixes and what each one multiplies by. The long forms are
// here because "500 bytes" is what an author writes when they mean it; "b" is
// a byte and never a bit, since what this parser measures is files.
const factors = {
  b: 1,
  byte: 1,
  bytes: 1,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  tb: 1e12,
};



export function parseByteSize(value, fallback = null) {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*([a-z]*)\s*$/i.exec(value ?? '');
  if (!match) return fallback;

  // A comma is a decimal separator to most of the world, and this value is
  // written by a person in a template, not serialized by a machine.
  const amount = Number.parseFloat(match[1].replace(',', '.'));

  // No suffix means bytes. An unknown one ("5xb") is a typo, and a typo may
  // not silently become a limit — it takes the fallback with everything else
  // this function cannot read.
  const factor = factors[match[2].toLowerCase() || 'b'];

  if (!Number.isFinite(amount) || amount <= 0 || !factor) return fallback;

  return amount * factor;
}
