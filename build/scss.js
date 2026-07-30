"use strict"

const fs = require("fs")
const fsp = fs.promises
const path = require("path")
const sass = require("sass")
const browserslist = require("browserslist")
const { transform, browserslistToTargets } = require("lightningcss")

const config = require("./config")
const { printScssError, printSassDeprecation } = require("./format")

// Browser targets for Lightning CSS, derived from the "browserslist" field
// in package.json. Lightning CSS does its own vendor prefixing and syntax
// lowering against these targets, which replaces the previous separate
// Autoprefixer/PostCSS pass.
const targets = browserslistToTargets(browserslist(null, { path: config.root }))

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

// Post-processing via Lightning CSS: vendor prefixing / syntax lowering per
// the browserslist targets in both modes, plus minification in prod. Unlike
// the CleanCSS step it replaces, Lightning CSS parses modern CSS natively
// (@starting-style, anchor positioning, @property, :popover-open, transition
// values with overlay / allow-discrete), so no shielding or unit-rewriting
// workarounds are needed.
function postProcess(css, entry, { dev, inputSourceMap }) {
  try {
    return transform({
      filename: path.relative(config.root, entry),
      code: Buffer.from(css),
      minify: !dev,
      targets,
      inputSourceMap,
      sourceMap: dev,
    })
  } catch (err) {
    const loc = err.loc ? ` (${err.loc.line}:${err.loc.column})` : ""
    throw new Error(`Lightning CSS: ${err.message}${loc}`)
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

  // Dev: no minify pass, but the same target-based transform as prod so
  // both modes ship identical prefixes. The Sass source map is chained
  // through Lightning CSS so positions stay accurate after the transform.
  const processed = postProcess(result.css, entry, {
    dev,
    inputSourceMap: result.sourceMap ? JSON.stringify(result.sourceMap) : undefined,
  })

  await fsp.mkdir(config.scss.outDir, { recursive: true })
  const outFile = path.join(config.scss.outDir, outNameFor(entry))

  let css = processed.code.toString()
  if (dev && processed.map) {
    const mapFile = `${outFile}.map`
    await fsp.writeFile(mapFile, processed.map)
    css += `\n/*# sourceMappingURL=${path.basename(mapFile)} */\n`
  }
  await fsp.writeFile(outFile, css)

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
