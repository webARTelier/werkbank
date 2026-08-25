/**
 * describedBy.js
 * ----------------------------------------------------------------------------
 * Adds or removes one id in a field's aria-describedby, preserving whatever
 * else is in there. Two components inject a node that describes a field and
 * have to link it without trampling the author's own hint: inputCharCount's
 * status region and formValidation's error message.
 *
 * aria-describedby is a token list, so it cannot simply be assigned: a field
 * may already point at a format hint, and a second module may point at its own
 * node too. Removing is the same story in reverse — the attribute goes only
 * once nothing is left in it, so a field is handed back exactly as it was
 * authored.
 *
 * addDescribedBy REPORTS whether it actually added the id. The two components
 * above never need to ask: they describe a node they created themselves, with
 * an id of their own, so the link cannot have been there before. embedConsent
 * is the case that does — the notice it points at is the AUTHOR'S element and
 * may already have been wired up by hand, and taking that apart on cleanup
 * would be removing markup the component never wrote.
 * ----------------------------------------------------------------------------
 */



function tokensOf(field) {
  return (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
}



export function addDescribedBy(field, id) {
  const tokens = tokensOf(field);
  if (tokens.includes(id)) return false;

  tokens.push(id);
  field.setAttribute('aria-describedby', tokens.join(' '));

  return true;
}



export function removeDescribedBy(field, id) {
  const tokens = tokensOf(field).filter((token) => token !== id);

  if (!tokens.length) {
    field.removeAttribute('aria-describedby');
    return;
  }

  field.setAttribute('aria-describedby', tokens.join(' '));
}
