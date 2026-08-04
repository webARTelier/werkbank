/**
 * scaleSVG.js
 * ---------------------------------------------------------------------------
 * Sizes an inline <svg> from its own viewBox: the width/height presentation
 * attributes are set to the viewBox size multiplied by a data-scale factor,
 * so a graphic gets its natural pixel size (or a multiple of it) without
 * anyone hand-computing pixel values in markup or CSS.
 *
 * Why this is needed
 * ------------------
 * An inline <svg> that carries only a viewBox has no concrete size: its
 * width/height default to auto, which resolves to 100% of the container
 * width — the graphic blows up to fill whatever holds it. This hits every
 * SVG pasted or inlined without explicit dimensions (the inlineSVG sibling
 * produces exactly such nodes when the source file declares no size). The
 * missing piece is pure arithmetic: the viewBox already knows the intrinsic
 * geometry; someone just has to turn it into a size.
 *
 * Strategy (like the other components: lean on the platform, fill the gap)
 * ------------------------------------------------------------------------
 * The viewBox is the source of truth — the browser parses it natively
 * (viewBox.baseVal) — and the width/height presentation attributes are
 * SVG's built-in sizing mechanism. The module only multiplies the two
 * numbers and writes the two attributes. Presentation attributes rank
 * below every CSS rule, so project CSS keeps full override power; no
 * inline styles are written. Like its sibling inlineSVG it is a stateless
 * DOM transform — plain functions, no lifecycle class.
 *
 * What this transform adds
 * ------------------------
 * 1. Sizing: every svg[data-scale] in the boot scope gets
 *    width/height = viewBox size × scale factor. An SVG without a usable
 *    viewBox is left untouched and reported.
 * 2. Idempotence: a sized SVG is marked with the is-scaled state class and
 *    each candidate is examined at most once, so repeated passes over the
 *    same scope (re-scans, observer runs) are safe and stay silent.
 * 3. Cooperation with inlineSVG: chain the two on one element
 *    (data-js-behavior="inlineSVG,scaleSVG") and boot awaits the conversion
 *    before calling this module, so the sweep finds real <svg> nodes. When
 *    that element is the <img> itself, inlineSVG has replaced it by then and
 *    the replacement is unreachable from the detached node — so the
 *    not-yet-sized candidates are picked up document-wide instead (see init).
 *    An <img data-scale> left unconverted in the scope is reported, since
 *    data-scale on an <img> sizes nothing.
 *
 * Accessibility
 * -------------
 * Sizing only — the module never touches roles, names or aria-*
 * attributes. Whether an SVG is meaningful (named) or decorative (hidden)
 * is owned by the markup author — or by inlineSVG when the SVG comes out
 * of an <img>.
 *
 * Configuration
 * -------------
 * data-scale="<factor>" — multiplier for the viewBox size (0.5 halves it,
 * 3 triples it). The attribute doubles as the opt-in marker: only
 * svg[data-scale] elements are touched. A bare data-scale sizes the SVG to
 * its natural viewBox size (factor 1); a value that is not a positive
 * number is reported and falls back to 1 as well.
 * ---------------------------------------------------------------------------
 */



const defaults = {

  // Inline SVGs opting in to sizing; data-scale is the behavioural hook.
  selector: 'svg[data-scale]',

  // <img> elements that inlineSVG may still swap for such an SVG.
  sourceSelector: 'img[data-scale]',

  // State class marking a sized SVG — the styling hook the JS hands to
  // the CSS (e.g. reveal a graphic only once it has its final size).
  scaledClass: 'is-scaled',

  // Scale factor used when data-scale carries no usable value: the SVG's
  // natural viewBox size.
  fallbackScale: 1,
};



// Every SVG the module has already examined — sized or reported as
// unusable — so repeated passes over the same scope are idempotent and
// never repeat a warning.
const examined = new WeakSet();



// Reads the scale factor off one SVG. A bare/empty data-scale means "use
// the natural size"; a non-numeric or non-positive value is an authoring
// error, so it is reported before falling back.
function readScale(svg, reporter) {
  const raw = svg.dataset.scale;
  if (!raw) return defaults.fallbackScale;

  const scale = Number(raw);
  if (Number.isFinite(scale) && scale > 0) return scale;

  reporter?.report(
    'scaleSVG',
    `data-scale value "${raw}" is not a positive number; using the `
      + 'natural viewBox size.',
    svg
  );
  return defaults.fallbackScale;
}



// Reads the intrinsic size from the SVG's viewBox, using the browser's own
// parse (viewBox.baseVal). Reports and returns null when there is nothing
// usable to derive a size from.
function readViewBoxSize(svg, reporter) {
  if (!svg.hasAttribute('viewBox')) {
    reporter?.report(
      'scaleSVG',
      'svg has no viewBox to derive a size from.', svg
    );
    return null;
  }

  const { width, height } = svg.viewBox.baseVal;
  if (width > 0 && height > 0) return { width, height };

  reporter?.report(
    'scaleSVG',
    'viewBox has no positive width/height to derive a size from.', svg
  );
  return null;
}



// Sizes one inline SVG: viewBox size × scale factor, written as the
// width/height presentation attributes (never inline styles, so any CSS
// rule can still override the result).
function scaleSvg(svg, reporter) {
  if (!(svg instanceof SVGSVGElement)) return;
  if (examined.has(svg)) return;
  if (svg.classList.contains(defaults.scaledClass)) return;
  examined.add(svg);

  const size = readViewBoxSize(svg, reporter);
  if (!size) return;

  const scale = readScale(svg, reporter);

  svg.classList.add(defaults.scaledClass);
  svg.setAttribute('width', String(size.width * scale));
  svg.setAttribute('height', String(size.height * scale));
}



// Sizes every candidate inside one scope, the scope element itself
// included when it matches.
function scaleInScope(scope, reporter) {
  if (scope.matches(defaults.selector)) scaleSvg(scope, reporter);

  scope.querySelectorAll(defaults.selector).forEach((svg) => {
    scaleSvg(svg, reporter);
  });
}



// An <img data-scale> still sitting in the scope after the sweep is a source
// nothing converted into an inline <svg>, so there is nothing here for this
// module to size — data-scale on an <img> does not resize the image.
//
// Chaining the two modules on the same element is what gets this right: boot
// awaits inlineSVG before calling this one, so every conversion has already
// happened by the time the sweep runs. This used to be a MutationObserver
// waiting up to five seconds for swaps to appear, which only ever mattered for
// the reverse wiring (inlineSVG on the images, scaleSVG on an ancestor) — one
// no snippet and no demo uses. Naming the fix beats waiting for it.
function reportPendingSources(el, reporter) {
  const pending = el.querySelectorAll(defaults.sourceSelector).length
    + (el.matches(defaults.sourceSelector) ? 1 : 0);
  if (!pending) return;

  reporter?.report(
    'scaleSVG',
    `${pending} <img ${defaults.sourceSelector}> left in this scope: only an `
      + 'inline <svg> can be sized from its viewBox. Put both modules on the '
      + 'same element (data-js-behavior="inlineSVG,scaleSVG") so the '
      + 'conversion has happened before this one runs.',
    el
  );
}



// loader-compatible entry point
// (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof Element)) {
    reporter?.report(
      'scaleSVG',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Chained wiring (data-js-behavior="inlineSVG,scaleSVG" on one <img>):
  // boot awaits inlineSVG's init before calling this one, so the <img> it
  // hands over has already been swapped out of the document. The
  // replacement is unreachable from the detached node, but it carries the
  // data-scale that sat on the <img> — so pick up every not-yet-sized
  // candidate in the document instead. The examined guard keeps this
  // idempotent when several chained images each trigger the same sweep.
  if (!el.isConnected && el.matches(defaults.sourceSelector)) {
    scaleInScope(document.documentElement, reporter);
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed
  // here.
  scaleInScope(el, reporter);

  reportPendingSources(el, reporter);
}
