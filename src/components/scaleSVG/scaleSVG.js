/**
 * scaleSVG.js
 * ----------------------------------------------------------------------------
 * Scales inline SVG elements using their viewBox and an optional data-scale
 * value.
 * ----------------------------------------------------------------------------
 */



const defaults = {
  selector: 'svg[data-scale]',
  sourceSelector: 'img[data-scale]',
  defaultScale: 0.2,
  observeForMs: 5000,
}



// scales one inline SVG using its viewBox and optional data-scale value.
function scaleSvg(svg, defaultScale, reporter) {
  if (!(svg instanceof SVGElement)) return false
  if (svg.classList.contains('is-scaled')) return false

  const viewBox = svg.getAttribute('viewBox')
  if (!viewBox) {
    reporter?.report('scalesvg', 'scalable SVG has no viewBox.', svg)
    return false
  }

  let scale = parseFloat(svg.dataset.scale || '')
  if (Number.isNaN(scale)) scale = defaultScale

  const [, , width, height] = viewBox.split(' ').map(Number)
  if (Number.isNaN(width) || Number.isNaN(height)) return false

  const scaledWidth = width * scale
  const scaledHeight = height * scale

  svg.classList.add('is-scaled')
  svg.setAttribute('width', String(scaledWidth))
  svg.setAttribute('height', String(scaledHeight))
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.style.setProperty('width', `${scaledWidth}px`)
  svg.style.setProperty('height', `${scaledHeight}px`)

  return true
}



// scales all matching inline SVG elements inside the current boot scope.
function scaleInScope(el, reporter) {
  let scaledCount = 0
  const candidates = new Set(el.querySelectorAll(defaults.selector))

  if (el.matches(defaults.selector)) {
    candidates.add(el)
  }

  candidates.forEach((svg) => {
    if (scaleSvg(svg, defaults.defaultScale, reporter)) {
      scaledCount += 1
    }
  })

  return scaledCount
}



// scales inline SVGs now or observes pending inline conversion for a short time.
export function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof Element)) {
    reporter?.report('scalesvg', 'module was initialized on a non-element node.', el)
    return
  }

  const initialScaledCount = scaleInScope(el, reporter)
  if (initialScaledCount > 0) return

  const hasScaleSource =
    el.matches(defaults.sourceSelector) ||
    Boolean(el.querySelector(defaults.sourceSelector))

  if (!hasScaleSource) return

  const observer = new MutationObserver(() => {
    const scaledCount = scaleInScope(el, reporter)
    if (scaledCount > 0) {
      observer.disconnect()
    }
  })

  observer.observe(el, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-scale'],
  })

  setTimeout(() => {
    observer.disconnect()
  }, defaults.observeForMs)
}
