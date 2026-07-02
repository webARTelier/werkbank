/**
 * Renders a live countdown for one module instance 
 * and updates mapped day/hour/minute/second nodes 
 * from a target date provided in the module markup.
 */



const defaults = {
  selDays: "[data-countdown-days]",
  selHours: "[data-countdown-hours]",
  selMinutes: "[data-countdown-minutes]",
  selSeconds: "[data-countdown-seconds]",
  selTargetDate: "[data-countdown-date]",
}



class Countdown {

  constructor(module, defaults, reporter) {
    if (!(module instanceof HTMLElement)) return;

    this.module = module
    this.reporter = reporter
    this.selDays = defaults.selDays
    this.selHours = defaults.selHours
    this.selMinutes = defaults.selMinutes
    this.selSeconds = defaults.selSeconds
    this.selTargetDate = defaults.selTargetDate

    this.initCountdown()
  }



  // resolves required nodes and starts the countdown loop.
  initCountdown = () => {
    const days = this.module.querySelector(this.selDays)
    const hours = this.module.querySelector(this.selHours)
    const minutes = this.module.querySelector(this.selMinutes)
    const seconds = this.module.querySelector(this.selSeconds)

    if (!days || !hours || !minutes) {
      this.handleMissingElements()
      return
    }

    const targetDateTime = this.getTargetDate()
    if (!targetDateTime) {
      this.handleMissingDate()
      return
    }

    const remainingMinutes = this.getRemainingMinutes(targetDateTime)
    const counterElements = {
      days,
      hours,
      minutes,
      seconds,
    }

    this.count(remainingMinutes, counterElements)
  }



  // reads the target date from the module or its configured child element.
  getTargetDate = () => {
    const targetDateElement = this.module.matches(this.selTargetDate)
      ? this.module
      : this.module.querySelector(this.selTargetDate)

    if (!targetDateElement) return ""

    return (targetDateElement.getAttribute("data-countdown-date") || "").trim()
  }



  // calculates the remaining time as minutes, clamped to zero.
  getRemainingMinutes = (targetDateTime) => {
    if (!targetDateTime) return 0

    const targetMs = Date.parse(targetDateTime)
    if (Number.isNaN(targetMs)) return 0

    const nowMs = Date.now()
    const diffMs = targetMs - nowMs

    const remainingMinutes = Math.ceil(diffMs / 60000)
    if (remainingMinutes <= 0) return 0

    return remainingMinutes
  }




  // renders the countdown immediately and refreshes it once per second.
  count = (remainingMinutes, counterElements) => {
    const { days, hours, minutes, seconds } = counterElements

    const render = () => {
      const total = Math.max(0, remainingMinutes)

      const d = Math.floor(total / 1440)
      const h = Math.floor((total % 1440) / 60)
      const m = Math.floor(total % 60)
      const s = Math.floor((total - Math.floor(total)) * 60)

      this.renderCountdownValue(days, d)
      this.renderCountdownValue(hours, h)
      this.renderCountdownValue(minutes, m)
      if (seconds) this.renderCountdownValue(seconds, s)

      this.syncMirrors({ d, h, m, s })
    }

    render()

    if (this.module._countdownIntervalId) {
      clearInterval(this.module._countdownIntervalId)
    }

    this.module._countdownIntervalId = setInterval(() => {
      remainingMinutes -= 1 / 60

      if (remainingMinutes <= 0) {
        remainingMinutes = 0
        render()
        clearInterval(this.module._countdownIntervalId)
        this.module._countdownIntervalId = null
        return
      }

      render()
    }, 1000)
  }



  // writes a numeric countdown value into an output element.
  renderCountdownValue = (element, value) => {
    if (!(element instanceof HTMLElement)) return
    element.textContent = value
  }



  // mirrors the current countdown values into cloned marquee instances.
  syncMirrors = ({ d, h, m, s }) => {
    const marquee = this.module.closest(".c-marquee")
    if (!(marquee instanceof HTMLElement)) return

    const mirrors = marquee.querySelectorAll("[data-js-module~='countdown']")

    mirrors.forEach((mirror) => {
      if (!(mirror instanceof HTMLElement) || mirror === this.module) return

      const mirrorDays = mirror.querySelector(this.selDays)
      const mirrorHours = mirror.querySelector(this.selHours)
      const mirrorMinutes = mirror.querySelector(this.selMinutes)
      const mirrorSeconds = mirror.querySelector(this.selSeconds)

      this.renderCountdownValue(mirrorDays, d)
      this.renderCountdownValue(mirrorHours, h)
      this.renderCountdownValue(mirrorMinutes, m)
      this.renderCountdownValue(mirrorSeconds, s)
    })
  }



  handleMissingElements = () => {
    this.reporter?.report("countdown", "missing day/hour/minute element")
    this.reporter?.report("countdown", "module was not initialized", this.module)
  }



  handleMissingDate = () => {
    this.reporter?.report(
      "countdown",
      "missing target date (data-countdown-date)",
      this.module
    )
  }
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof HTMLElement)) {
    reporter?.report("countdown", "module was initialized on a non-element node.", el)
    return
  }

  new Countdown(el, defaults, reporter)
}
