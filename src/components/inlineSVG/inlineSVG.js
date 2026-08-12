/**
 * inlineSVG.js
 * ---------------------------------------------------------------------------
 * Swaps an <img> pointing at an .svg file for a real, inline <svg> node — so
 * the SVG's own markup can be styled and scripted directly (currentColor, CSS
 * on inner shapes, DOM access to paths) instead of being a sealed,
 * un-stylable raster-like image.
 *
 * Why this is needed
 * ------------------
 * An SVG referenced through <img src="icon.svg"> renders but is a black box:
 * its internals are unreachable from the page's CSS/JS and it cannot inherit
 * currentColor. Inlining the file exposes the whole SVG tree to the document.
 *
 * Strategy (like the other components: lean on the platform, fill the gap)
 * -----------------------------------------------------------------------
 * The source of truth is the fetched SVG file itself: the module fetches it,
 * parses it with the native DOMParser, carries the relevant <img> attributes
 * onto the resulting <svg> and replaces the <img> in place. A stateless DOM
 * transform, like its sibling scaleSVG, so plain functions rather than a
 * lifecycle class.
 *
 * What this transform adds
 * ------------------------
 * 1. Fetch + parse: only same-origin .svg sources are fetched (same-origin
 *    policy); anything else stays a plain <img>, untouched. Repeated
 *    references to the same file share one fetch + parse (see svgCache).
 * 2. Attribute carry-over: id, class (merged), width/height and data-scale
 *    move onto the <svg>, so layout and scaleSVG keep working.
 * 3. Id & class de-collision: every id inside the inlined SVG (and every
 *    internal reference to it — href, url(#…) in attributes, inline style and
 *    <style>) gets a unique per-instance prefix, so multiple inlined SVGs on
 *    one page cannot clash over shared ids (gradients, clip-paths, masks,
 *    filters, <use> targets). The same prefix goes on the class names an
 *    embedded <style> targets — Figma-style exports carry generic names like
 *    .cls-1, and an inline <svg>'s <style> is document-global — so one SVG's
 *    rules cannot bleed onto another's shapes. See §Scoping.
 * 4. Accessible name: an <img alt> / aria-label becomes the <svg>'s
 *    aria-label + role="img"; an explicitly empty alt marks the graphic
 *    decorative (aria-hidden + focusable="false"). See §Accessibility.
 * 5. Sanitization: <script> and <foreignObject> elements, every on*
 *    event-handler attribute and any javascript: URI are stripped from the
 *    fetched markup before it is inlined. Same-origin only constrains where a
 *    file comes from, not what it contains — a same-origin media library that
 *    accepts uploads is still an untrusted source. See §Sanitization.
 *
 * Scoping
 * -------
 * Two inlined SVGs on one page share a single document, so anything global to
 * that document can collide: element ids (and the url(#…)/href/<use> pointing
 * at them) and the class-selector rules of an embedded <style>. Both are
 * neutralised by a per-instance prefix. Ids are always prefixed (they must be
 * unique regardless); class names only when the SVG's own <style> styles
 * them (those are the ones that can leak) — classes the file leaves unstyled
 * stay intact, so a project can still target them from its own CSS.
 * Element-local features (transform, presentation attributes, inline style)
 * are never global and need no scoping. Because the prefix varies per
 * instance, project CSS cannot target an inlined SVG's inner shapes by their
 * original id or styled class; recolour via currentColor or structural
 * selectors, the intended styling surface anyway.
 *
 * Sanitization
 * ------------
 * A fetched .svg is untrusted content, not code: same-origin only proves
 * where it was served from, and a same-origin path (a CMS media library, a
 * user-uploaded asset) can still carry a hostile payload. Before an inlined
 * SVG is ever cloned into the page, <script> and <foreignObject> elements are
 * removed and every on* attribute / javascript: URI is stripped from every
 * remaining node, so an inlined file cannot execute script even if its source
 * is compromised. This runs once per fetched file (see svgCache), not per
 * instance.
 *
 * Accessibility
 * -------------
 * An <img> conveys its meaning through alt; a bare inline <svg> has neither
 * an implicit role nor a name, so the swap would silently drop the accessible
 * name. The image's name is therefore mapped onto the SVG: a non-empty alt
 * (or an aria-label) is copied to aria-label and the SVG gets role="img"; an
 * explicit alt="" means the author marked the image decorative, so the SVG is
 * hidden from AT (aria-hidden="true", focusable="false"). An SVG the author
 * already named (aria-label / aria-labelledby) is respected as-is. An <img>
 * with no alt at all leaves the intent undefined; rather than emit an unnamed
 * SVG it is hidden from AT (as if decorative) and the missing alt reported,
 * so the authoring gap surfaces instead of shipping silently.
 *
 * Configuration
 * -------------
 * None. Put data-js-behavior="inlineSVG" directly on an <img> whose src is an
 * .svg file, or on any container holding such <img> elements; every matching
 * image inside the boot scope is converted. Non-.svg and cross-origin images
 * are ignored.
 * ---------------------------------------------------------------------------
 */



const defaults = {

  // Only same-origin .svg sources are inlined. Sent with the fetch so an
  // authenticated same-origin asset still resolves.
  fetchCredentials: 'same-origin',

  // Attributes on the id-carrying nodes whose value may reference another id
  // via url(#id) — these have to be rewritten alongside the id itself.
  urlRefAttrs: [
    'clip-path',
    'mask',
    'filter',
    'fill',
    'stroke',
    'marker-start',
    'marker-mid',
    'marker-end',
  ],

  // Attributes whose value is a bare #id reference (<use>, gradient links).
  hashRefAttrs: ['href', 'xlink:href'],
};



// Running counter shared across all conversions on the page, for a unique id
// prefix per inlined SVG (see prefixSvgIds).
let idCounter = 0;



// A unique prefix for the ids inside one inlined SVG.
function nextIdPrefix() {
  idCounter += 1;
  return `inlineSVG-${idCounter}`;
}



// Per-page cache keyed by resolved .svg src: each value is the promise of the
// file's parsed <svg> template (or null on failure). Repeated inlinings of
// the same file share a single fetch + parse; every instance clones the
// template before it is prefixed and mutated, so the cached node stays clean.
const svgCache = new Map();



// The cached template promise for a src, starting the load once.
function fetchSvgTemplate(src, reporter) {
  let template = svgCache.get(src);
  if (!template) {
    template = loadSvgTemplate(src, reporter);
    svgCache.set(src, template);
  }
  return template;
}



// Fetches and parses one .svg file into its <svg> root. null (and a report)
// on an HTTP error or a file without an <svg> root; the caller then leaves
// the original <img> in place.
async function loadSvgTemplate(src, reporter) {
  const res = await fetch(src, { credentials: defaults.fetchCredentials });
  if (!res.ok) {
    reporter?.report(
      'inlineSVG',
      `fetch failed (HTTP ${res.status}); left <img> in place.`, src
    );
    return null;
  }

  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) {
    reporter?.report('inlineSVG', 'fetched file has no <svg> root.', src);
    return null;
  }

  sanitizeSvg(svg, src, reporter);

  return svg;
}



// Attribute-name pattern for inline event handlers (onload, onclick, ...).
const eventHandlerAttr = /^on/i;



// True for a "javascript:" URI, tolerating the leading whitespace/control
// characters and mixed case browsers themselves normalize before matching the
// scheme — the same evasions a hand-written check must not miss.
function isJsUri(value) {
  const str = value || '';
  let start = 0;
  while (start < str.length && str.charCodeAt(start) <= 32) start += 1;
  return str.slice(start, start + 11).toLowerCase() === 'javascript:';
}



// Neutralizes anything in a fetched SVG that could execute script, before it
// is ever cloned into the page (see §Sanitization in the file header):
// <script> and <foreignObject> elements go outright, and every on*
// event-handler attribute or javascript: URI is stripped from every remaining
// node. Runs once per fetched file, on the cached template, so every clone is
// already clean.
function sanitizeSvg(svg, src, reporter) {
  let stripped = false;

  svg.querySelectorAll('script, foreignObject').forEach((node) => {
    node.remove();
    stripped = true;
  });

  svg.querySelectorAll('*').forEach((node) => {
    for (const attr of [...node.attributes]) {
      if (eventHandlerAttr.test(attr.name) || isJsUri(attr.value)) {
        node.removeAttribute(attr.name);
        stripped = true;
      }
    }
  });

  if (stripped) {
    reporter?.report(
      'inlineSVG',
      'fetched SVG contained script/event-handler content; stripped '
        + 'before inlining.', src
    );
  }
}



// Replaces one <img> with an inline clone of its .svg source. Non-.svg
// sources are skipped; any failure (network, parse, missing <svg>) leaves the
// original <img> in place and is reported. The unique id prefix is passed in
// so it can be assigned in document order before the concurrent conversions.
async function inlineOne(img, prefix, reporter) {
  const src = img.getAttribute('src');
  if (!src || !/\.svg(\?|#|$)/i.test(src)) return;

  try {
    const template = await fetchSvgTemplate(src, reporter);
    if (!template) return;

    const svg = template.cloneNode(true);
    scopeSvg(svg, prefix);
    carryAttributes(img, svg);
    applyAccessibleName(img, svg, reporter);

    img.replaceWith(svg);
  }

  catch {
    reporter?.report('inlineSVG', 'failed to convert image.', img);
  }
}



// Moves the presentation-relevant <img> attributes onto the inlined <svg>.
// Classes are merged (the fetched file may carry its own); width/height and
// data-scale are set only where the SVG does not already define them, so the
// file's own sizing wins and the scaleSVG companion can still read the scale.
function carryAttributes(img, svg) {
  if (img.id) svg.id = img.id;

  const imgClass = img.getAttribute('class');
  if (imgClass) {
    for (const name of imgClass.split(/\s+/)) {
      if (name) svg.classList.add(name);
    }
  }

  const width = img.getAttribute('width');
  if (width && !svg.hasAttribute('width')) svg.setAttribute('width', width);

  const height = img.getAttribute('height');
  if (height && !svg.hasAttribute('height')) svg.setAttribute('height', height);

  // Presence check, not truthiness: a bare data-scale (empty value) means
  // "natural viewBox size" to scaleSVG and has to be carried over as well.
  if ('scale' in img.dataset && !('scale' in svg.dataset)) {
    svg.dataset.scale = img.dataset.scale;
  }
}



// Preserves the image's accessible name on the SVG (see file header). An SVG
// the author already named is left untouched.
function applyAccessibleName(img, svg, reporter) {
  if (svg.hasAttribute('aria-label') || svg.hasAttribute('aria-labelledby')) {
    return;
  }

  const ariaLabel = img.getAttribute('aria-label');
  const alt = img.getAttribute('alt');

  // Decorative: an author who wrote alt="" opted the image out of AT, so the
  // inline SVG is not announced either.
  if (alt === '' && ariaLabel === null) {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    return;
  }

  // Named: the SVG becomes an image with the carried-over name. Icon files
  // are often authored decorative (aria-hidden / focusable="false") as silent
  // embeds; a meaningful <img alt> overrides that intent, so the suppression
  // that would keep the named graphic hidden from AT is cleared.
  const name = ariaLabel || alt;
  if (name) {
    svg.removeAttribute('aria-hidden');
    svg.removeAttribute('focusable');
    svg.setAttribute('aria-label', name);
    if (!svg.hasAttribute('role')) svg.setAttribute('role', 'img');
    return;
  }

  // No name at all: the <img> carried neither alt nor aria-label, so the
  // intent is undefined. An unnamed inline <svg> exposed to AT is the worst
  // outcome, so the safe reading wins (hidden, as if decorative) and the
  // missing alt is reported, so the authoring mistake surfaces instead of
  // passing silently.
  reporter?.report(
    'inlineSVG',
    '<img> has no alt attribute; inlined SVG hidden from assistive '
      + 'technology. Add alt (meaningful or empty) to make the intent explicit.',
    img
  );
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
}



// Makes one inlined SVG self-contained at the document level, so several on a
// page cannot interfere: ids (and their references) and the class names the
// SVG's own <style> targets both get the instance's unique prefix.
function scopeSvg(svg, prefix) {
  prefixSvgIds(svg, prefix);
  prefixSvgClasses(svg, prefix);
}



// Rewrites every id inside the SVG (and every internal reference to it) with
// a unique prefix, so multiple inlined SVGs cannot collide at the document
// level over shared ids — gradients, clip-paths, masks, filters, <use>
// targets.
function prefixSvgIds(svg, prefix) {
  const idMap = new Map();

  svg.querySelectorAll('[id]').forEach((node) => {
    const oldId = node.getAttribute('id');
    if (!oldId) return;

    const newId = `${prefix}-${oldId}`;
    idMap.set(oldId, newId);
    node.setAttribute('id', newId);
  });

  if (!idMap.size) return;

  svg.querySelectorAll('*').forEach((node) => {
    rewriteHashRefs(node, idMap);
    rewriteUrlRefs(node, idMap);
    rewriteInlineStyle(node, idMap);
  });

  rewriteStyleSheets(svg, idMap);
}



// #id references (e.g. <use href="#icon">, gradient links).
function rewriteHashRefs(node, idMap) {
  for (const attr of defaults.hashRefAttrs) {
    const value = node.getAttribute(attr);
    if (!value || !value.startsWith('#')) continue;

    const newId = idMap.get(value.slice(1));
    if (newId) node.setAttribute(attr, `#${newId}`);
  }
}



// url(#id) references inside presentation attributes.
function rewriteUrlRefs(node, idMap) {
  for (const attr of defaults.urlRefAttrs) {
    const value = node.getAttribute(attr);
    if (!value || !value.includes('url(#')) continue;

    const updated = replaceUrlIds(value, idMap);
    if (updated !== value) node.setAttribute(attr, updated);
  }
}



// url(#id) references inside an inline style attribute.
function rewriteInlineStyle(node, idMap) {
  const value = node.getAttribute('style');
  if (!value || !value.includes('url(#')) return;

  const updated = replaceUrlIds(value, idMap);
  if (updated !== value) node.setAttribute('style', updated);
}



// Both url(#id) and bare #id references inside embedded <style> blocks. One
// boundary-aware pass rewrites every #id (which also covers url(#id), since
// the closing ")" is not an identifier char): unlike a per-id replaceAll,
// matching longest ids first and refusing to run on into a longer identifier
// means a short id (#a) can never clobber a longer one (#ab) it prefixes, nor
// a same-prefixed id the file did not declare (#abc).
function rewriteStyleSheets(svg, idMap) {
  const idRefs = buildRefPattern([...idMap.keys()], '#');
  if (!idRefs) return;

  svg.querySelectorAll('style').forEach((styleNode) => {
    const css = styleNode.textContent;
    if (!css || !css.includes('#')) return;

    const updated = css.replace(idRefs, (match, oldId) => {
      const newId = idMap.get(oldId);
      return newId ? `#${newId}` : match;
    });

    if (updated !== css) styleNode.textContent = updated;
  });
}



// Scopes the class names the SVG's own <style> styles — and only those — with
// the instance prefix, on both the element class attributes and the <style>
// selectors. Figma-style exports carry generic class names (.cls-1, .cls-2)
// in an embedded <style>; because an inline <svg>'s <style> is
// document-global (no shadow boundary), two such SVGs sharing a name would
// style each other's shapes. Prefixing the styled classes confines each rule
// to its own SVG. Classes the file does not style itself stay intact, so they
// remain usable as page hooks (ids the file never references are still
// prefixed, only because ids must be unique).
function prefixSvgClasses(svg, prefix) {
  const styleNodes = [...svg.querySelectorAll('style')];
  if (!styleNodes.length) return;

  const styleText = styleNodes.map((node) => node.textContent || '').join('\n');

  // The class tokens actually present on elements are the authoritative set;
  // intersecting them with the ones the <style> references confines the
  // rewrite to real, internally-styled classes and sidesteps false positives
  // (a ".5" fragment inside a length value is never an element class).
  const classMap = new Map();
  svg.querySelectorAll('[class]').forEach((node) => {
    for (const name of node.getAttribute('class').split(/\s+/)) {
      if (!name || classMap.has(name)) continue;
      if (buildRefPattern([name], '\\.').test(styleText)) {
        classMap.set(name, `${prefix}-${name}`);
      }
    }
  });

  if (!classMap.size) return;

  svg.querySelectorAll('[class]').forEach((node) => {
    rewriteClassAttribute(node, classMap);
  });

  rewriteStyleClassSelectors(styleNodes, classMap);
}



// Swaps the mapped tokens in one element's class attribute, leaving unmapped
// tokens (and their order) untouched.
function rewriteClassAttribute(node, classMap) {
  const tokens = node.getAttribute('class').split(/\s+/).filter(Boolean);
  let changed = false;

  const next = tokens.map((name) => {
    const mapped = classMap.get(name);
    if (mapped) changed = true;
    return mapped || name;
  });

  if (changed) node.setAttribute('class', next.join(' '));
}



// Rewrites the mapped ".class" selector tokens inside the <style> blocks,
// with the same boundary-aware single pass as the id rewriting (see
// buildRefPattern).
function rewriteStyleClassSelectors(styleNodes, classMap) {
  const classRefs = buildRefPattern([...classMap.keys()], '\\.');
  if (!classRefs) return;

  styleNodes.forEach((styleNode) => {
    const css = styleNode.textContent;
    if (!css || !css.includes('.')) return;

    const updated = css.replace(classRefs, (match, name) => {
      const mapped = classMap.get(name);
      return mapped ? `.${mapped}` : match;
    });

    if (updated !== css) styleNode.textContent = updated;
  });
}



// One regex matching every "<sigil><name>" whose name is in the list — "#"
// for id references, "\\." for class selectors. Alternatives are ordered
// longest-first so the regex prefers the longer name, and a negative
// lookahead ((?![\w-])) forbids a match continuing into a longer identifier:
// that is what keeps a short name (#a / .a) from clobbering a longer one (#ab
// / .ab) it prefixes, or a same-prefixed name the file did not declare (#abc
// / .abc).
function buildRefPattern(names, sigil) {
  if (!names.length) return null;

  const alternatives = names
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');

  return new RegExp(`${sigil}(${alternatives})(?![\\w-])`, 'g');
}



// Escapes a string for literal use inside a RegExp.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}



// Replaces every url(#oldId) occurrence in a string using the id map.
function replaceUrlIds(value, idMap) {
  let updated = value;
  idMap.forEach((newId, oldId) => {
    updated = updated.replaceAll(`url(#${oldId})`, `url(#${newId})`);
  });
  return updated;
}



// The SVG-image candidates of the boot element: the element itself when it is
// an <img>, otherwise every descendant <img>.
function collectImages(el) {
  if (el instanceof HTMLImageElement) return [el];
  return [...el.querySelectorAll('img')];
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export async function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof Element)) {
    reporter?.report(
      'inlineSVG',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  const images = collectImages(el);
  if (!images.length) return;

  // Each id prefix is assigned synchronously in document order first, so
  // prefixes stay deterministic even though the conversions then run
  // concurrently (distinct sources fetch in parallel; repeated ones share one
  // fetch via svgCache). Double-init is prevented by the loader (boot.js sets
  // a per-element, per-module flag before calling init), so no extra guard is
  // needed here.
  await Promise.all(
    images.map((img) => inlineOne(img, nextIdPrefix(), reporter))
  );
}
