"use strict"

const fs = require("fs")
const fsp = fs.promises
const path = require("path")
const sass = require("sass")
const postcss = require("postcss")
const autoprefixer = require("autoprefixer")
const CleanCSS = require("clean-css")

const config = require("./config")
const { printScssError, printSassDeprecation } = require("./format")

// Output name for a given .scss entry: <basename>.min.css (vendor files keep
// the .min suffix too, so vendor/foo.scss -> foo.min.css, never foo.css).
function outNameFor(entry) {
  const base = path.basename(entry, ".scss")
  return `${base}.min.css`
}

// Sass logger routed through the compact deprecation formatter. The modern
// Dart Sass API is used (compileAsync), so legacy-js-api deprecations never
// appear in the first place.
function makeLogger() {
  return {
    warn(message, options) {
      // Suppress legacy-js-api noise defensively; keep all other warnings full.
      if (options && options.deprecation && options.deprecationType &&
          options.deprecationType.id === "legacy-js-api") {
        return
      }
      printSassDeprecation({ message, span: options && options.span }, config.root)
    },
  }
}

async function compileEntry(entry, { dev }) {
  const result = await sass.compileAsync(entry, {
    style: dev ? "expanded" : "compressed",
    loadPaths: [path.dirname(entry), path.join(config.root, "src", "_shared", "scss")],
    sourceMap: dev,
    sourceMapIncludeSources: dev,
    logger: makeLogger(),
  })

  // Autoprefixer via PostCSS.
  const prefixed = await postcss([autoprefixer]).process(result.css, {
    from: entry,
    map: false,
  })

  await fsp.mkdir(config.scss.outDir, { recursive: true })
  const outFile = path.join(config.scss.outDir, outNameFor(entry))

  if (dev) {
    // Dev: keep it readable + ship a source map. No CleanCSS pass.
    let css = prefixed.css
    const mapFile = `${outFile}.map`
    if (result.sourceMap) {
      await fsp.writeFile(mapFile, JSON.stringify(result.sourceMap))
      css += `\n/*# sourceMappingURL=${path.basename(mapFile)} */\n`
    }
    await fsp.writeFile(outFile, css)
  } else {
    // Prod: minify with CleanCSS.
    const minified = new CleanCSS({ level: 2, returnPromise: false }).minify(
      prefixed.css
    )
    if (minified.errors && minified.errors.length) {
      throw new Error(`CleanCSS: ${minified.errors.join(", ")}`)
    }
    await fsp.writeFile(outFile, minified.styles)
  }

  return outNameFor(entry)
}

async function buildScss({ dev = false } = {}) {
  const written = []
  for (const entry of config.scss.entries) {
    if (!fs.existsSync(entry)) continue
    try {
      written.push(await compileEntry(entry, { dev }))
    } catch (err) {
      printScssError(err, config.root)
      const fail = new Error("SCSS build failed")
      fail.showStack = false // gulp-cli prints only the message, no stack trace
      throw fail
    }
  }
  return written
}

module.exports = { buildScss, outNameFor }
