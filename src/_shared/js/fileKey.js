/**
 * fileKey.js
 * ----------------------------------------------------------------------------
 * As close to an identity as a File gets, for the one question a repeated drop
 * or a second pick asks: is this the same file again? The three parts a
 * browser reports without reading the contents — anything more would mean
 * hashing megabytes to prevent a duplicate row.
 *
 * Two genuinely different files can collide (same name, same byte count, same
 * timestamp), which is why this decides whether to ADD a file and never
 * whether two uploads are the same thing. A server that must not store a
 * duplicate compares contents; a list that must not show one compares this.
 * ----------------------------------------------------------------------------
 */



export function fileKey(file) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}
