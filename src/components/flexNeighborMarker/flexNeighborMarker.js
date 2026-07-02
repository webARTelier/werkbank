/**
 * Marks flex items that have a sibling in the same visual row 
 * so CSS can style row relationships without hardcoded layout assumptions.
 */



// Copy-Paste-Hinweis: benötigt _shared/js/debounce.js (im Zielprojekt mitkopieren)
import { debounceThenExecute } from "./debounce.js"



const defaults = {
  selContainer: "[data-markflex-container]",
  neighborClass: "has-neighbor",
  tolerance: 1,
  debounceMs: 100,
}



class FlexNeighborMarker {
  // parses positive numeric options and falls back for invalid values.
  static parsePositiveFloat(value, fallback) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }


  
  constructor(module) {
    if (!(module instanceof HTMLElement)) return

    this.module = module
    this.selContainer = defaults.selContainer
    this.neighborClass = defaults.neighborClass
    this.tolerance = FlexNeighborMarker.parsePositiveFloat(
      this.module.dataset.markflexTolerance,
      defaults.tolerance
    )
    this.debounceMs = defaults.debounceMs

    this.containers = this.resolveContainers()
    if (!this.containers.length) {
      this.handleMissingContainer()
      return
    }

    this.recompute = debounceThenExecute(this.compute, this.debounceMs)
    this.start()
  }


  
  // resolves all flex containers that should be inspected.
  resolveContainers = () =>
    this.module.matches(this.selContainer)
      ? [this.module]
      : Array.from(this.module.querySelectorAll(this.selContainer))


  
  // returns the direct flex items for one container.
  getAllItems = (container) => Array.from(container.children)


  
  // groups items by visual row and marks all but the last item per row.
  computeContainer = (container) => {
    const allItems = this.getAllItems(container)
    if (!allItems.length) return

    allItems.forEach((el) => el.classList.remove(this.neighborClass))

    const rows = []

    for (const item of allItems) {
      const top = item.getBoundingClientRect().top
      const row = rows.find((candidate) => Math.abs(candidate.top - top) <= this.tolerance)

      if (row) {
        row.allItems.push(item)
        row.top = (row.top * (row.allItems.length - 1) + top) / row.allItems.length
        continue
      }

      rows.push({ top, allItems: [item] })
    }

    rows.forEach((row) => {
      row.allItems
        .slice(0, -1)
        .forEach((item) => item.classList.add(this.neighborClass))
    })
  }


  
  // recomputes row markers for every managed container.
  compute = () => this.containers.forEach(this.computeContainer)


  
  // waits for layout to settle before measuring row positions.
  afterLayout = () => {
    requestAnimationFrame(() => requestAnimationFrame(this.compute))
  }


  
  // registers layout, resize, font, and load observers for recomputation.
  start = () => {
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", this.afterLayout, {
          once: true,
        })
      : this.afterLayout()

    window.addEventListener("resize", this.recompute, { passive: true })

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(this.recompute)
      this.containers.forEach((container) => observer.observe(container))
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(this.recompute).catch(() => {})
    }

    window.addEventListener("load", this.recompute, { once: true })
  }


  
  handleMissingContainer = () => {
    console.warn(
      `[markflexneighbors] missing container (selector: "${this.selContainer}").`,
      this.module
    )
  }
}



// loader-compatible entry point (boot.js -> mod.init(el))
export function init(el) {
  if (!(el instanceof HTMLElement)) {
    console.warn("[markflexneighbors] module was initialized on a non-element node.", el)
    return
  }

  new FlexNeighborMarker(el)
}
