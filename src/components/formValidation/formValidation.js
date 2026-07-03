/**
 * formValidation.js
 * ----------------------------------------------------------------------------
 * Initializes Pristine validation per form and keeps aria bindings in sync.
 * ----------------------------------------------------------------------------
 */



const defaults = {
  availableLocales: ["de", "en"],
  config: {
    classTo: "c-form__item",
    errorTextParent: "c-form__item",
    errorClass: "is-invalid",
    errorTextClass: "pristine-error"
  }
}



let pristineConstructorPromise = null

// loads the Pristine vendor once and returns its constructor.
function loadPristineConstructor() {
  if (typeof window.Pristine === "function") {
    return Promise.resolve(window.Pristine)
  }

  if (pristineConstructorPromise) return pristineConstructorPromise

  pristineConstructorPromise = import("./pristine.js").then(() => {
    if (typeof window.Pristine === "function") {
      return window.Pristine
    }

    throw new Error("pristine vendor loaded but window.Pristine is not available")
  })

  return pristineConstructorPromise
}



class FormValidation {

  constructor(form, Pristine, params = defaults) {
    this.form = form
    this.Pristine = Pristine
    this.availableLocales = params.availableLocales
    this.config = params.config

    this.classTo = this.config.classTo
    this.errorClass = this.config.errorClass
    this.errorTextClass = this.config.errorTextClass
    this.selErrorItem = `.${this.classTo}.${this.errorClass}`

    this.initForm()
    this.markInitialized()
    this.startListening()
  }



  // initializes pristine and selects locale
  initForm = () => {
    this.Pristine.setLocale(this.getLocale())
    this.validation = new this.Pristine(this.form, this.config)
  }



  // prevents double initialization
  markInitialized = () => {
    this.form.classList.add("has-validation")
  }



  // validates on submit and updates aria on changes
  startListening = () => {
    this.form.addEventListener("submit", (e) => {
      this.markSubmitted()

      if (!this.validation.validate()) {
        e.preventDefault()
        this.updateAriaAttributes()
        this.scrollFirstErrorIntoView()
      }
    })

    this.form.addEventListener("change", () => {
      this.updateAriaAttributes()
    })
  }



  // marks the form as submitted for styling
  markSubmitted = () => {
    this.form.classList.add("is-submitted")
  }



  // chooses the locale based on <html lang="...">
  getLocale = () => {
    const rawLang = (document.documentElement.lang || "").toLowerCase()
    const baseLang = rawLang.split("-")[0]

    if (this.availableLocales.includes(rawLang)) return rawLang
    if (this.availableLocales.includes(baseLang)) return baseLang

    return "en"
  }



  // maintains aria-describedby links to the current error message
  updateAriaAttributes = () => {
    this.form.querySelectorAll("input, textarea, select").forEach((input) => {
      const errorParent = input.closest(this.selErrorItem)

      if (!errorParent) {
        input.removeAttribute("aria-describedby")
        return
      }

      const errorElement = errorParent.querySelector(`.${this.errorTextClass}`)
      if (!errorElement) return

      const sourceId = input.name || input.id || "form-field"
      const safeId = sourceId.replace(/[^a-zA-Z0-9_-]/g, "-")
      errorElement.id = `${safeId}-error`
      errorElement.setAttribute("role", "alert")
      input.setAttribute("aria-describedby", errorElement.id)
    })
  }



  // scrolls the first error into view after failed submit
  scrollFirstErrorIntoView = () => {
    const firstErrorItem = this.form.querySelector(this.selErrorItem)
    if (!firstErrorItem) return

    firstErrorItem.scrollIntoView({ behavior: "smooth", block: "center" })
  }
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export async function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof HTMLFormElement)) {
    reporter?.report("formvalidation", "module expects a <form> root element.", el)
    return
  }

  if (el.classList.contains("has-validation")) {
    return
  }

  try {
    const Pristine = await loadPristineConstructor()
    new FormValidation(el, Pristine, defaults)
  }

  catch (error) {
    reporter?.report("formvalidation", "failed to initialize pristine validation", error)
  }
}
