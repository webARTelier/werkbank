/**
 * matchesAccept.js
 * ----------------------------------------------------------------------------
 * Would a file input's own "accept" attribute have offered this file? The
 * picker applies it by itself; a file arriving another way — dropped on a box,
 * handed to a queue — has not been past it, and this is the check that closes
 * that back door.
 *
 * Three token shapes, exactly the ones the attribute allows: an extension
 * (".pdf"), a whole family ("image/*") and one type ("application/pdf"). An
 * empty or absent attribute means the field takes anything.
 *
 * It stays a filter and never a verdict: "accept" names types, and a type is
 * what the operating system guessed from an extension. What is really inside a
 * file is the server's business, and no amount of client-side checking moves
 * that line.
 * ----------------------------------------------------------------------------
 */



export function matchesAccept(file, accept) {
  const tokens = (accept || '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (!tokens.length) return true;

  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));

    return type === token;
  });
}
