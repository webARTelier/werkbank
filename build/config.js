"use strict"

const path = require("path")

const root = path.resolve(__dirname, "..")
const p = (...parts) => path.join(root, ...parts)

// -----------------------------------------------------------------------------
// Central, explicit build configuration.
// Entry points are listed explicitly (not auto-globbed) so the build stays
// reproducible and every output name is fully under our control.
// -----------------------------------------------------------------------------

module.exports = {
  root,
  p,

  dist: {
    root: p("dist"),
    css: p("dist", "css"),
    js: p("dist", "js"),
    jsModules: p("dist", "js", "modules"),
  },

  scss: {

    // Non-partial entries compiled to dist/css/<name>.min.css.
    // Vendor files keep the .min suffix too (e.g. vendor/foo.scss -> foo.min.css).
    entries: [
      p("src", "_shared", "scss", "shared.scss"),

      // component stylesheets — each compiles to dist/css/<name>.min.css and is
      // loaded by that component's demo.html alongside shared.min.css.
      p("src", "components", "accordion", "accordion.scss"),
      p("src", "components", "adaptiveScrollFade", "adaptiveScrollFade.scss"),
      p("src", "components", "autoGrowTextarea", "autoGrowTextarea.scss"),
      p("src", "components", "backToTop", "backToTop.scss"),
      p("src", "components", "comboBox", "comboBox.scss"),
      p("src", "components", "countdown", "countdown.scss"),
      p("src", "components", "dataTable", "dataTable.scss"),
      p("src", "components", "dateInputFormat", "dateInputFormat.scss"),
      p("src", "components", "dialog", "dialog.scss"),
      p("src", "components", "dropdownNav", "dropdownNav.scss"),
      p("src", "components", "fileUpload", "fileUpload.scss"),
      p("src", "components", "flexNeighborMarker", "flexNeighborMarker.scss"),
      p("src", "components", "formValidation", "formValidation.scss"),
      p("src", "components", "inlineSVG", "inlineSVG.scss"),
      p("src", "components", "inputCharCount", "inputCharCount.scss"),
      p("src", "components", "lightbox", "lightbox.scss"),
      p("src", "components", "loadFragment", "loadFragment.scss"),
      p("src", "components", "marquee", "marquee.scss"),
      p("src", "components", "numberInputFormat", "numberInputFormat.scss"),
      p("src", "components", "offCanvasNav", "offCanvasNav.scss"),
      p("src", "components", "passwordToggle", "passwordToggle.scss"),
      p("src", "components", "popover", "popover.scss"),
      p("src", "components", "readMore", "readMore.scss"),
      p("src", "components", "revealOnScroll", "revealOnScroll.scss"),
      p("src", "components", "scaleSVG", "scaleSVG.scss"),
      p("src", "components", "scrollSpy", "scrollSpy.scss"),
      p("src", "components", "siteSearch", "siteSearch.scss"),
      p("src", "components", "slider", "slider.scss"),
      p("src", "components", "stickyObserver", "stickyObserver.scss"),
      p("src", "components", "tabs", "tabs.scss"),
      p("src", "components", "toast", "toast.scss"),
      p("src", "components", "tooltip", "tooltip.scss"),
      p("src", "components", "video", "video.scss"),
    ],
    outDir: p("dist", "css"),
    // A .scss file counts as "vendor" if it lives under one of these folders.
    vendorDirs: [p("src", "_shared", "scss", "vendor")],
  },

  js: {

    // Rollup input map: output-name -> source file.
    // Component modules + shared helpers that the registry loads on demand.
    // "boot" is the page bootstrapper and lands at dist/js/boot.min.js;
    // everything else lands at dist/js/modules/<name>.min.js.
    entries: {
      boot: p("src", "_shared", "js", "boot.js"),

      // component modules
      accordion: p("src", "components", "accordion", "accordion.js"),
      adaptiveScrollFade: p("src", "components", "adaptiveScrollFade", "adaptiveScrollFade.js"),
      autoGrowTextarea: p("src", "components", "autoGrowTextarea", "autoGrowTextarea.js"),
      backToTop: p("src", "components", "backToTop", "backToTop.js"),
      comboBox: p("src", "components", "comboBox", "comboBox.js"),
      countdown: p("src", "components", "countdown", "countdown.js"),
      dataTable: p("src", "components", "dataTable", "dataTable.js"),
      dateInputFormat: p("src", "components", "dateInputFormat", "dateInputFormat.js"),
      dialog: p("src", "components", "dialog", "dialog.js"),
      dropdownNav: p("src", "components", "dropdownNav", "dropdownNav.js"),
      fileUpload: p("src", "components", "fileUpload", "fileUpload.js"),
      flexNeighborMarker: p("src", "components", "flexNeighborMarker", "flexNeighborMarker.js"),
      formValidation: p("src", "components", "formValidation", "formValidation.js"),
      inlineSVG: p("src", "components", "inlineSVG", "inlineSVG.js"),
      inputCharCount: p("src", "components", "inputCharCount", "inputCharCount.js"),
      lightbox: p("src", "components", "lightbox", "lightbox.js"),
      loadFragment: p("src", "components", "loadFragment", "loadFragment.js"),
      marquee: p("src", "components", "marquee", "marquee.js"),
      numberInputFormat: p("src", "components", "numberInputFormat", "numberInputFormat.js"),
      offCanvasNav: p("src", "components", "offCanvasNav", "offCanvasNav.js"),
      passwordToggle: p("src", "components", "passwordToggle", "passwordToggle.js"),
      popover: p("src", "components", "popover", "popover.js"),
      readMore: p("src", "components", "readMore", "readMore.js"),
      revealOnScroll: p("src", "components", "revealOnScroll", "revealOnScroll.js"),
      scaleSVG: p("src", "components", "scaleSVG", "scaleSVG.js"),
      scrollSpy: p("src", "components", "scrollSpy", "scrollSpy.js"),
      siteSearch: p("src", "components", "siteSearch", "siteSearch.js"),
      slider: p("src", "components", "slider", "slider.js"),
      stickyObserver: p("src", "components", "stickyObserver", "stickyObserver.js"),
      tabs: p("src", "components", "tabs", "tabs.js"),
      toast: p("src", "components", "toast", "toast.js"),
      tooltip: p("src", "components", "tooltip", "tooltip.js"),
      video: p("src", "components", "video", "video.js"),

      // shared helpers that are also lazily loadable modules
      debounce: p("src", "_shared", "js", "debounce.js"),
      getCssCustomProperty: p("src", "_shared", "js", "getCssCustomProperty.js"),
      resolveLocale: p("src", "_shared", "js", "resolveLocale.js"),
    },

    // Where component source files look up shared helpers imported as
    // flat siblings, e.g. `import { debounce } from "./debounce.js"`.
    sharedDir: p("src", "_shared", "js"),

    // Modules resolved at runtime, never bundled:
    // - ./registry.js  -> the generated registry (boot.js)
    // Kept external so Rollup neither inlines it nor tries to resolve its
    // dynamic module import.
    runtimeExternals: ["./registry.js"],

    outDir: p("dist", "js"),
    bootName: "boot",
  },

  registry: {

    // Written to dist/js/registry.js, generated from the files in dist/js/modules.
    outFile: p("dist", "js", "registry.js"),
    modulesDir: p("dist", "js", "modules"),
    // Modules initialised once per page (boot.js -> globalRegistry).
    // (none: dialog is now a per-element module loaded via data-js-behavior)
    globalModules: [],
    // Built module basenames end with this suffix.
    moduleSuffix: ".min.js",
  },
}
