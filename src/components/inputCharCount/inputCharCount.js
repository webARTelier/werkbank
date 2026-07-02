/**
 * InputCharCount
 * renders a live character counter
 * next to a textarea/input and
 * supports optional countdown mode
 */

const defaults = {
  selInput: "[data-inputcharcount]",
  labels: {
    en: {
      default: {
        prefix: "",
        suffix: "characters",
      },
      countdown: {
        prefix: "",
        suffix: "characters remaining",
      },
    },
    de: {
      default: {
        prefix: "",
        suffix: "Zeichen",
      },
      countdown: {
        prefix: "Noch",
        suffix: "Zeichen übrig",
      },
    },
  },
}



// returns all uninitialized character-count inputs inside the boot scope.
function getInputsInScope(scope, selector) {
  const selInput = `${selector}:not(.is-initialized)`

  if (
    scope instanceof HTMLTextAreaElement
    || scope instanceof HTMLInputElement
  ) {
    return scope.matches(selInput) ? [scope] : []
  }

  return [...scope.querySelectorAll(selInput)]
}



class InputCharCount {

  constructor(input, params = defaults, reporter) {
    this.input = input
    this.reporter = reporter
    this.defaultLang = "en"
    this.maxChars = 0
    this.availableLabels = params.labels
    this.labels = {}

    this.markInitialized()

    // abort if labels are not available
    if (!this.setLabel()) return

    this.getMaxChars()
    this.createCounter()
    this.setCounterStatus()
    this.startListening()
  }



  // reads countdown mode from data-countdown
  get isCountdown() {
    return this.input.dataset.countdown === "true"
  }



  // prevents double initialization
  markInitialized = () => {
    this.input.classList.add("is-initialized")
  }



  // reads maxlength from the element
  getMaxChars = () => {
    const maxLength = this.input.getAttribute("maxlength")
    if (maxLength) this.maxChars = parseInt(maxLength, 10)
  }



  // selects labels based on document language and mode
  setLabel = () => {
    const rawLang = (document.documentElement.lang || "").toLowerCase()
    const baseLang = rawLang.split("-")[0]
    let lang = rawLang

    if (!(lang in this.availableLabels)) lang = baseLang
    if (!(lang in this.availableLabels)) lang = this.defaultLang

    if (!(lang in this.availableLabels)) {
      this.handleMissingLabels()
      return false
    }

    let labelType = "default"
    if (this.isCountdown) labelType = "countdown"

    const labelConfig = this.availableLabels[lang][labelType]
    if (!labelConfig || !("prefix" in labelConfig)) {
      this.handleMissingLabelPart("prefix")
      return false
    }

    if (!("suffix" in labelConfig)) {
      this.handleMissingLabelPart("suffix")
      return false
    }

    this.labels.prefix = labelConfig.prefix
    this.labels.suffix = labelConfig.suffix

    return true
  }



  // creates the status element after the input
  createCounter = () => {
    this.counter = document.createElement("div")
    this.counter.classList.add("c-charCounter")
    this.counter.setAttribute("role", "status")
    this.counter.setAttribute("aria-live", "polite")
    this.input.after(this.counter)
  }



  // updates counter on input events
  startListening = () => {
    this.input.addEventListener("input", () => {
      this.setCounterStatus()
    })
  }



  // renders the current count or remaining chars and toggles limit state
  setCounterStatus = () => {
    const charCount = this.input.value.length

    let label = `${this.labels.prefix} ${charCount} ${this.labels.suffix}`

    if (this.maxChars) {
      charCount >= this.maxChars
        ? this.input.classList.add("is-atLimit")
        : this.input.classList.remove("is-atLimit")

      let xOfN = `${charCount} / ${this.maxChars}`

      if (this.isCountdown) {
        xOfN = `${this.maxChars - charCount} / ${this.maxChars}`
      }

      label = `${this.labels.prefix} ${xOfN} ${this.labels.suffix}`
    }

    this.counter.textContent = label.trim()
  }



  handleMissingLabels = () => {
    this.reporter?.report("inputcharcount", "missing labels in configuration data.")
    this.reporter?.report("inputcharcount", "module was not initialized.", this.input)
  }



  handleMissingLabelPart = (labelPart) => {
    this.reporter?.report("inputcharcount", `missing label "${labelPart}" in configuration data.`)
    this.reporter?.report("inputcharcount", "module was not initialized.", this.input)
  }
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof HTMLElement)) {
    reporter?.report("inputcharcount", "module was initialized on a non-element node.", el)
    return
  }

  const selectorOverride = (el.dataset.inputcharcountSelector || "").trim()
  const selector = selectorOverride || defaults.selInput
  const allInputs = getInputsInScope(el, selector)
  if (!allInputs.length) return

  allInputs.forEach((input) => new InputCharCount(input, defaults, reporter))
}
