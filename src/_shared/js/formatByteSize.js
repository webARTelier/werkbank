/**
 * formatByteSize.js
 * ----------------------------------------------------------------------------
 * Names a size in bytes in the page's own language — "980 bytes", "1,2 MB",
 * "3.4 GB" — through Intl.NumberFormat's unit style, so no size string is
 * assembled by hand and the decimal separator is the reader's own.
 *
 * Decimal steps (1 kB = 1000 bytes), because that is what the unit names mean
 * in CLDR and what the reader's file manager showed them next to the same
 * file. parseByteSize reads a limit on the same scale, so a limit and a size
 * can never both print "5 MB" while one is over the other.
 *
 * An engine without the unit style falls back to naming the bytes, which every
 * Intl can do — a long number instead of a short one, never a broken row.
 * ----------------------------------------------------------------------------
 */



// The units Intl knows, in the order a size grows through them.
const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'];



// One formatter per locale and unit, built when a size in it first turns up:
// constructing an Intl.NumberFormat is the expensive part, formatting with it
// is not. Module-level rather than per component, because two components
// formatting the same sizes have no reason to build the same formatter twice.
const formatters = new Map();



export function formatByteSize(bytes, locale) {
  let value = bytes;
  let index = 0;

  while (value >= 1000 && index < units.length - 1) {
    value /= 1000;
    index += 1;
  }

  const formatter = formatterFor(locale, index);
  if (formatter) return formatter.format(value);

  return `${bytes} ${units[0]}`;
}



function formatterFor(locale, index) {
  const key = `${locale ?? ''}|${index}`;
  if (formatters.has(key)) return formatters.get(key);

  let formatter = null;

  try {
    formatter = new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: units[index],

      // "1.2 MB" abbreviated, "980 bytes" spelled out. The short form of the
      // byte itself has no plural in CLDR ("980 byte"), and the long form of
      // everything above it is nobody's idea of a file size
      // ("1.2 megabytes").
      unitDisplay: index ? 'short' : 'long',

      // Only the divided numbers get a decimal: "980 bytes" is a size,
      // "980.4 bytes" is noise.
      maximumFractionDigits: index ? 1 : 0,
    });
  } catch {
    formatter = null;
  }

  formatters.set(key, formatter);
  return formatter;
}
