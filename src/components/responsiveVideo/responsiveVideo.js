/**
 * responsiveVideo.js
 * ----------------------------------------------------------------------------
 * Handles responsive video source switching
 * based on viewport and device density.
 * ----------------------------------------------------------------------------
 */



// Copy-paste note: requires _shared/js/debounce.js (copy it along into the target project)
import { debounceThenExecute } from "./debounce.js"
// Copy-paste note: requires _shared/js/getCssCustomProperty.js (copy it along into the target project)
import { getCssCustomProperty } from "./getCssCustomProperty.js"



const moduleConfig = {
  viewportMap: {
    tiny: "mobile",
    small: "mobile",
    medium: "tablet",
    large: "desktop",
    xxl: "desktop",
  },
  debounceMs: 300,
}

// resolves the bundled icon path for environments without document hints.
function getFallbackIconBaseHref() {
  return new URL("../../../src/_shared/media/img/icons/", import.meta.url).href
}



// normalizes optional icon base paths to absolute directory-style hrefs.
function normalizeBaseHref(baseHref) {
  const normalized = String(baseHref || "").trim()
  if (!normalized) return null
  return normalized.endsWith("/") ? normalized : `${normalized}/`
}



// infers the icon base path from an already rendered project icon.
function getIconBaseFromDocument() {
  const existingIcon = document.querySelector('img[src*="media/img/icons/"]')
  if (!(existingIcon instanceof HTMLImageElement)) return null

  const marker = "/media/img/icons/"
  const src = existingIcon.src
  const markerIndex = src.indexOf(marker)
  if (markerIndex === -1) return null

  return src.slice(0, markerIndex + marker.length)
}



// resolves play and pause icon URLs for the current video instance.
function resolveIcons(videoElement) {
  const dataPath = normalizeBaseHref(videoElement?.dataset?.responsivevideoIconsPath)
  const documentPath = normalizeBaseHref(getIconBaseFromDocument())
  const fallbackPath = getFallbackIconBaseHref()
  const iconBase = dataPath || documentPath || fallbackPath

  return {
    play: new URL("play.svg", iconBase).href,
    pause: new URL("pause.svg", iconBase).href,
  }
}


class ResponsiveVideo {

  constructor(video, config, reporter) {
    this.video = video;
    this.reporter = reporter;
    this.viewportMap = config.viewportMap;
    this.getCssCustomProperty = config.getCssCustomProperty;
    this.debounceThenExecute = config.debounceThenExecute;
    this.debounceMs = config.debounceMs;
    this.icons = config.icons;
    this.srcAttribute = this.video.querySelector("source");
    this.controlsMode = this.getControlsMode();
    this.toggleButton = null;
    this.toggleIcon = null;

    this.srcs = {};
    this.versions = [];
    this.missingVersions = [];
    this.bestGivenSource = "";
    this.lastUsedFile = "";

    if (!(this.srcAttribute instanceof HTMLSourceElement)) {
      this.handleMissingSourceElement()
      return
    }

    this.markInitialized()
    this.configureUiMode()

    if (!this.getSrcs()) return

    this.qualityOrder = Object.keys(this.srcs)
    this.createVersionArray()

    if (this.versions.length === 0) {
      this.handleMissingVersions()
      return
    }

    this.setBestGivenSource()
    this.findMissingVersions()
    this.prepareVideo()
    this.watchResize()
  }



  // reads whether the video uses native controls or a custom toggle.
  getControlsMode = () => {
    const mode = this.video.dataset.responsivevideoControls
    return mode === "toggle" ? "toggle" : "native"
  }



  // configures native or custom autoplay-toggle video behavior.
  configureUiMode = () => {
    if (this.controlsMode === "native") {
      this.video.controls = true
      this.video.removeAttribute("autoplay")
      this.video.removeAttribute("muted")
      return
    }

    this.video.controls = false
    this.video.muted = true
    this.video.autoplay = true
    this.video.loop = true
    this.video.playsInline = true
    this.video.setAttribute("muted", "")
    this.video.setAttribute("autoplay", "")
    this.video.setAttribute("loop", "")
    this.video.setAttribute("playsinline", "")
    this.createToggleButton()
  }



  // injects the custom play/pause toggle next to the video.
  createToggleButton = () => {
    const parent = this.video.parentElement
    if (!(parent instanceof HTMLElement)) return

    parent.classList.add("c-responsiveVideoToggleHost")

    const button = document.createElement("button")
    button.type = "button"
    button.className = "c-responsiveVideoToggle"
    button.setAttribute("aria-label", "Pause video")
    button.setAttribute("aria-pressed", "true")
    button.addEventListener("click", this.handleToggleClick)

    const icon = document.createElement("img")
    icon.className = "c-responsiveVideoToggle__icon"
    icon.alt = "Pause icon"
    button.appendChild(icon)

    this.video.addEventListener("play", this.updateToggleButton)
    this.video.addEventListener("pause", this.updateToggleButton)
    this.video.addEventListener("ended", this.updateToggleButton)

    parent.appendChild(button)
    this.toggleButton = button
    this.toggleIcon = icon
    this.updateToggleButton()
  }



  // toggles playback from the custom control.
  handleToggleClick = () => {
    if (this.video.paused) {
      this.video.play().catch(() => this.handleFailedPlay())
      return
    }

    this.video.pause()
  }



  // synchronizes toggle icon, label, and pressed state with playback.
  updateToggleButton = () => {
    if (!(this.toggleButton instanceof HTMLButtonElement)) return
    if (!(this.toggleIcon instanceof HTMLImageElement)) return

    const isPaused = this.video.paused
    this.toggleIcon.src = isPaused ? this.icons.play : this.icons.pause
    this.toggleIcon.alt = isPaused ? "Play icon" : "Pause icon"
    this.toggleButton.setAttribute("aria-label", isPaused ? "Play video" : "Pause video")
    this.toggleButton.setAttribute("aria-pressed", isPaused ? "false" : "true")
  }



  // prevents double initialization.
  markInitialized = () => {
    this.video.classList.add("is-initialized")
  }



  // parses responsive source data from the video dataset.
  getSrcs = () => {
    if (!this.video.dataset.srcs) {
      this.handleMissingSources()
      return false
    }

    try {
      this.srcs = JSON.parse(this.video.dataset.srcs)
      return true
    }
    catch {
      this.handleInvalidJSON()
      return false
    }
  }



  // builds the ordered viewport and retina source key list.
  createVersionArray = () => {
    Object.values(this.viewportMap).forEach((value) => {
      this.versions.push(value, `${value}Retina`)
    })

    this.versions = [...new Set(this.versions)]
  }



  // stores the best available source for fallback use.
  setBestGivenSource = () => {
    this.versions.forEach((version) => {
      if (this.srcs[version]) this.bestGivenSource = this.srcs[version]
    })
  }



  // detects missing configured source variants and fills them.
  findMissingVersions = () => {
    this.versions.forEach((version) => {
      if (!this.srcs[version]) this.missingVersions.push(version)
    })

    if (this.missingVersions.length > 0) this.createFallback()
  }



  // fills missing source variants from the next higher available quality.
  createFallback = () => {
    this.missingVersions.forEach((version) => {
      this.srcs[version] = this.getNextHigherVersion(version)
    })
  }



  // finds the next higher source variant for a missing key.
  getNextHigherVersion = (version) => {
    const versionIndex = this.versions.indexOf(version)

    for (let i = versionIndex + 1; i < this.versions.length; i++) {
      if (this.srcs[this.versions[i]]) return this.srcs[this.versions[i]]
    }

    return this.bestGivenSource
  }



  // selects and applies the best source for the current viewport.
  prepareVideo = () => {
    const { viewport, density } = this.getDeviceData()
    const viewportKey = this.viewportMap[viewport]

    if (!viewportKey) {
      this.handleUnknownViewport(viewport)
      return
    }

    const densitySuffix = density === "high" ? "Retina" : ""
    const srcKey = `${viewportKey}${densitySuffix}`
    const file = this.srcs[srcKey]

    if (!file) {
      this.handleMissingFile(srcKey)
      return
    }

    if (!this.needsUpgrade(file, this.lastUsedFile)) return

    const type = file.split(".").pop()
    this.srcAttribute.src = file
    this.srcAttribute.type = `video/${type}`
    this.video.load()

    if (this.video.autoplay) {
      this.video.play().catch(() => this.handleFailedPlay())
    }

    this.lastUsedFile = file
  }



  // reads responsive viewport and density values from CSS custom properties.
  getDeviceData = () => {
    const scope = document.body
    return {
      density: this.getCssCustomProperty(scope, "--density"),
      viewport: this.getCssCustomProperty(scope, "--viewportName"),
    }
  }



  // prevents switching to the same or lower-quality video source.
  needsUpgrade = (file, lastUsedFile) => {
    if (file === lastUsedFile) return false

    const fileIndex = this.qualityOrder.findIndex((key) => this.srcs[key] === file)
    const lastUsedFileIndex = this.qualityOrder.findIndex(
      (key) => this.srcs[key] === lastUsedFile
    )

    return fileIndex >= lastUsedFileIndex
  }



  // updates the selected source after debounced resize events.
  watchResize = () => {
    const resizeDebounced = this.debounceThenExecute(this.prepareVideo, this.debounceMs)
    window.addEventListener("resize", resizeDebounced)
  }



  handleMissingSourceElement = () => {
    this.reporter?.report("responsivevideo", "missing <source> element inside video.", this.video)
  }



  handleMissingSources = () => {
    this.reporter?.report("responsivevideo", "video data missing (data-srcs).", this.video)
    this.reporter?.report("responsivevideo", "module was not initialized.")
  }



  // warns when source data cannot be parsed.
  handleInvalidJSON = () => {
    this.reporter?.report("responsivevideo", "invalid JSON in data-srcs.", this.video)
    this.reporter?.report("responsivevideo", "module was not initialized.")
  }



  handleMissingVersions = () => {
    this.reporter?.report("responsivevideo", "no valid video sources found.", this.video)
    this.reporter?.report("responsivevideo", "module was not initialized.")
  }



  handleMissingFile = (srcKey) => {
    this.reporter?.report("responsivevideo", `no source found for key "${srcKey}".`, this.video)
  }



  // warns when CSS reports a viewport key outside the configured map.
  handleUnknownViewport = (viewport) => {
    this.reporter?.report(
      "responsivevideo",
      `unknown viewport "${viewport}". Check --viewportName and viewportMap.`
    )
  }



  // warns when browser autoplay restrictions block playback.
  handleFailedPlay = () => {
    this.reporter?.report("responsivevideo", "failed auto-play. Video might not be muted.")
  }
}



// loader-compatible entry point (boot.js -> mod.init(el, services)).
export function init(el, services = {}) {
  const reporter = services.reporter

  if (!(el instanceof HTMLVideoElement)) {
    reporter?.report("responsivevideo", "module must be initialized on a <video> element.", el)
    return
  }

  if (el.classList.contains("is-initialized")) {
    return
  }

  const config = {
    viewportMap: moduleConfig.viewportMap,
    getCssCustomProperty,
    debounceThenExecute,
    debounceMs: moduleConfig.debounceMs,
    icons: resolveIcons(el),
  }

  new ResponsiveVideo(el, config, reporter)
}
