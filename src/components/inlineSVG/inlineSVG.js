/**
 * inlineSVG.js
 * ----------------------------------------------------------------------------
 * Converts SVG <img> elements into inline <svg> nodes so styles and DOM updates
 * can target the SVG content directly while preserving relevant attributes.
 * ----------------------------------------------------------------------------
 */



async function inlineSvg(img, reporter) {
  const src = img.getAttribute('src')
  if (!src || !/\.svg(\?|#|$)/i.test(src)) return

  try {
    const res = await fetch(src, { credentials: 'same-origin' })
    if (!res.ok) return

    const text = await res.text()
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    const svg = doc.querySelector('svg')
    if (!svg) return

    prefixSvgIds(svg, nextSvgIdPrefix())

    if (img.id) svg.id = img.id

    const imgClass = img.getAttribute('class')
    if (imgClass) svg.setAttribute('class', imgClass)

    if (img.getAttribute('aria-label')) {
      svg.setAttribute('aria-label', img.getAttribute('aria-label'))
    }

    if (
      !svg.getAttribute('role') &&
      (svg.getAttribute('aria-label') || img.getAttribute('alt'))
    ) {
      svg.setAttribute('role', 'img')
    }

    if (img.getAttribute('width') && !svg.getAttribute('width')) {
      svg.setAttribute('width', img.getAttribute('width'))
    }

    if (img.getAttribute('height') && !svg.getAttribute('height')) {
      svg.setAttribute('height', img.getAttribute('height'))
    }

    if (img.dataset.scale && !svg.dataset.scale) {
      svg.dataset.scale = img.dataset.scale
    }

    img.replaceWith(svg)
  }

  catch {
    reporter?.report('inlineSvg', 'failed to convert', img)
  }
}

let inlineSvgIdCounter = 0

// creates a unique prefix for ids inside each inlined SVG.
function nextSvgIdPrefix() {
  inlineSvgIdCounter += 1

  return `inlinesvg-${inlineSvgIdCounter}`
}

// rewrites internal SVG ids and references to prevent document-level collisions.
function prefixSvgIds(svg, prefix) {
  const idMap = new Map()
  const idNodes = svg.querySelectorAll('[id]')

  idNodes.forEach((node) => {
    const oldId = node.getAttribute('id')
    if (!oldId) return

    const newId = `${prefix}-${oldId}`
    idMap.set(oldId, newId)
    node.setAttribute('id', newId)
  })

  if (!idMap.size) return

  const attrsWithUrlRefs = [
    'clip-path',
    'mask',
    'filter',
    'fill',
    'stroke',
    'marker-start',
    'marker-mid',
    'marker-end',
  ]

  const attrsWithHashRefs = ['href', 'xlink:href']
  const allNodes = svg.querySelectorAll('*')

  allNodes.forEach((node) => {
    attrsWithHashRefs.forEach((attr) => {
      const value = node.getAttribute(attr)
      if (!value || !value.startsWith('#')) return

      const refId = value.slice(1)
      const newRefId = idMap.get(refId)
      if (!newRefId) return

      node.setAttribute(attr, `#${newRefId}`)
    })

    attrsWithUrlRefs.forEach((attr) => {
      const value = node.getAttribute(attr)
      if (!value || !value.includes('url(#')) return

      let updatedValue = value
      idMap.forEach((newId, oldId) => {
        updatedValue = updatedValue.replaceAll(`url(#${oldId})`, `url(#${newId})`)
      })

      if (updatedValue !== value) {
        node.setAttribute(attr, updatedValue)
      }
    })

    const styleValue = node.getAttribute('style')
    if (!styleValue || !styleValue.includes('url(#')) return

    let updatedStyleValue = styleValue
    idMap.forEach((newId, oldId) => {
      updatedStyleValue = updatedStyleValue.replaceAll(`url(#${oldId})`, `url(#${newId})`)
    })

    if (updatedStyleValue !== styleValue) {
      node.setAttribute('style', updatedStyleValue)
    }
  })

  const styleNodes = svg.querySelectorAll('style')
  styleNodes.forEach((styleNode) => {
    const css = styleNode.textContent
    if (!css || !css.includes('url(#')) return

    let updatedCss = css
    idMap.forEach((newId, oldId) => {
      updatedCss = updatedCss.replaceAll(`url(#${oldId})`, `url(#${newId})`)
      updatedCss = updatedCss.replaceAll(`#${oldId}`, `#${newId}`)
    })

    if (updatedCss !== css) {
      styleNode.textContent = updatedCss
    }
  })
}



// collects SVG image candidates from the boot element or its descendants.
function collectTargetImages(el) {
  if (!(el instanceof Element)) return []

  if (el instanceof HTMLImageElement) {
    return [el]
  }

  return [...el.querySelectorAll('img')]
}



// --- loader-compatible entry point ---
export async function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof Element)) {
    reporter?.report(
      'inlineSvg',
      'module was initialized on a non-element node:',
      el
    )
    return
  }

  const images = collectTargetImages(el)
  if (!images.length) return

  for (const img of images) {
    await inlineSvg(img, reporter)
  }
}
