/**
 * marquee.js
 * ----------------------------------------------------------------------------
 * Creates an infinitely scrolling marquee track with
 * optional overflow-only start, clone management,
 * and resize-aware re-evaluation of animation state.
 * ----------------------------------------------------------------------------
 */



// Copy-paste note: requires _shared/js/debounce.js (copy it along into the target project)
import { debounceThenExecute } from "./debounce.js"



const defaults = {
  clones: 3,
  mode: "rtl",
  startMode: "always",
  duration: 8,
  debounceMs: 100,
  selContainer: "[data-marquee-container]",
  selAnimated: "[data-marquee-animated]",
}



class Marquee {

  // parses positive integer options and falls back for invalid values.
  static parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
  }


  
  constructor(marquee, config, reporter) {
    if (!(marquee instanceof HTMLElement)) return

    this.marquee = marquee
    this.config = config
    this.reporter = reporter

    if (this.marquee.classList.contains("is-initialized")) return

    this.modes = new Set(["rtl", "ltr"])
    this.startModes = new Set(["always", "overflow"])

    this.currentMode = (this.marquee.dataset.mode || this.config.mode).toLowerCase()

    this.startMode = (this.marquee.dataset.marqueeStartMode || this.config.startMode).toLowerCase()

    this.duration = Marquee.parsePositiveInt(
      this.marquee.dataset.duration, this.config.duration
    )

    this.minClones = Marquee.parsePositiveInt(
      this.marquee.dataset.clones, this.config.clones
    )

    this.debounceMs = this.config.debounceMs

    this.selContainer = this.config.selContainer
    this.selAnimated = this.config.selAnimated

    this.container = this.marquee.querySelector(this.selContainer)
    this.animated = this.marquee.querySelector(this.selAnimated)
    this.parent = this.marquee.parentElement
    this.allAnimated = []
    this.allAnimations = []
    this.isRunning = false
    this.resizeObserver = null
    this.recompute = debounceThenExecute(this.evaluate, this.debounceMs)

    this.handleMouseEnter = () => {
      this.allAnimations.forEach((animation) => animation.pause())
    }

    this.handleMouseLeave = () => {
      this.allAnimations.forEach((animation) => animation.play())
    }

    if (!this.container) {
      this.handleMissingElement("container", this.selContainer)
      return
    }

    if (!this.animated) {
      this.handleMissingElement("animated", this.selAnimated)
      return
    }

    if (!this.modes.has(this.currentMode)) {
      this.handleUnknownMode(this.currentMode)
      return
    }

    if (!this.startModes.has(this.startMode)) {
      this.handleUnknownStartMode(this.startMode)
      return
    }

    this.start()
  }



  // initializes state and schedules the first layout measurement.
  start = () => {
    this.markInitialized()
    this.setPauseOnHover()
    this.observeResize()

    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", this.afterLayout, { once: true })
      : this.afterLayout()

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(this.recompute).catch(() => {})
    }

    window.addEventListener("load", this.recompute, { once: true })
  }



  // prevents double initialization.
  markInitialized = () => {
    this.marquee.classList.add("is-initialized")
  }



  // pauses and resumes active animations on pointer hover.
  setPauseOnHover = () => {
    this.container.addEventListener("mouseenter", this.handleMouseEnter)
    this.container.addEventListener("mouseleave", this.handleMouseLeave)
  }



  // watches relevant elements for size changes that affect overflow.
  observeResize = () => {
    window.addEventListener("resize", this.recompute, { passive: true })

    if (!("ResizeObserver" in window)) return

    this.resizeObserver = new ResizeObserver(this.recompute)
    const observedElements = [this.parent, this.marquee, this.container, this.animated]

    observedElements
      .filter((element) => element instanceof HTMLElement)
      .forEach((element) => this.resizeObserver.observe(element))
  }



  // waits for layout to settle before evaluating animation state.
  afterLayout = () => {
    requestAnimationFrame(() => requestAnimationFrame(this.evaluate))
  }



  // starts or stops the marquee based on the current start mode.
  evaluate = () => {
    if (this.shouldStart()) {
      this.run()
      return
    }

    this.stop()
  }



  // decides whether the marquee should currently animate.
  shouldStart = () => {
    if (this.startMode === "always") return true

    return this.hasHorizontalOverflow()
  }



  // checks whether the animated content exceeds the visible track width.
  hasHorizontalOverflow = () => {
    const visibleWidth = this.getVisibleWidth()

    if (!Number.isFinite(visibleWidth)) return false

    return this.animated.scrollWidth - visibleWidth > 1
  }



  // returns the smallest available visible width for the marquee track.
  getVisibleWidth = () => {
    const widths = [this.container.clientWidth, this.marquee.clientWidth]

    if (this.parent instanceof HTMLElement) {
      widths.push(this.parent.clientWidth)
    }

    return widths
      .filter((value) => Number.isFinite(value) && value > 0)
      .reduce((smallest, value) => Math.min(smallest, value), Number.POSITIVE_INFINITY)
  }



  // creates clones and animations when the marquee needs to run.
  run = () => {
    const requiredCloneCount = this.getRequiredCloneCount()

    if (this.isRunning && this.getCurrentCloneCount() === requiredCloneCount) return

    if (this.isRunning) {
      this.cancelAnimations()
      this.removeClones()
    }

    this.cloneItems(requiredCloneCount)
    this.setAnimation()
    this.isRunning = true
  }



  // duplicates the animated item enough times to fill the animation loop.
  cloneItems = (cloneCount) => {
    if (this.allAnimated.length) return

    this.allAnimated.push(this.animated)

    for (let i = 0; i < cloneCount; i++) {
      const cloned = this.animated.cloneNode(true)
      cloned.dataset.marqueeClone = "1"
      this.container.appendChild(cloned)
      this.allAnimated.push(cloned)
    }
  }



  // returns the number of managed clone tracks.
  getCurrentCloneCount = () => Math.max(this.allAnimated.length - 1, 0)



  // calculates how many clones are needed to avoid visible gaps.
  getRequiredCloneCount = () => {
    const contentWidth = this.animated.scrollWidth
    const visibleWidth = this.getVisibleWidth()

    if (!Number.isFinite(contentWidth) || contentWidth <= 0) return this.minClones
    if (!Number.isFinite(visibleWidth) || visibleWidth <= 0) return this.minClones

    // Keep enough tracks so one full-cycle translate 
    // never exposes an empty gap.
    const requiredTracks = Math.ceil(visibleWidth / contentWidth) + 1
    const autoClones = Math.max(requiredTracks - 1, 1)

    return Math.max(this.minClones, autoClones)
  }



  // starts Web Animations on every managed track.
  setAnimation = () => {
    const keyframes =
      this.currentMode === "rtl"
        ? [{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }]
        : [{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }]

    this.allAnimations = []

    this.allAnimated.forEach((animated) => {
      const animation = animated.animate(keyframes, {
        duration: this.duration * 1000,
        iterations: Infinity,
      })

      this.allAnimations.push(animation)
    })
  }



  // stops animation and removes runtime clones.
  stop = () => {
    if (!this.isRunning) return

    this.cancelAnimations()
    this.removeClones()
    this.isRunning = false
  }



  // cancels all active Web Animation instances.
  cancelAnimations = () => {
    this.allAnimations.forEach((animation) => animation.cancel())
    this.allAnimations = []
  }



  // removes generated clone nodes from the marquee container.
  removeClones = () => {
    this.container
      .querySelectorAll("[data-marquee-clone='1']")
      .forEach((clone) => clone.remove())

    this.allAnimated = []
  }



  handleMissingElement = (name, selector) => {
    this.reporter?.report("marquee", `missing "${name}" element (selector: "${selector}").`)
  }



  // warns when the configured animation direction is unsupported.
  handleUnknownMode = (currentMode) => {
    this.reporter?.report("marquee", `"${currentMode}" is not a valid mode (rtl|ltr).`)
  }



  // warns when the configured start mode is unsupported.
  handleUnknownStartMode = (startMode) => {
    this.reporter?.report("marquee", `"${startMode}" is not a valid start mode (always|overflow).`)
  }
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof HTMLElement)) {
    reporter?.report("marquee", "module was initialized on a non-element node.", el)
    return
  }

  new Marquee(el, defaults, reporter)
}
