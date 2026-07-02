"use strict"

const fs = require("fs")
const path = require("path")
const { rollup } = require("rollup")
const { nodeResolve } = require("@rollup/plugin-node-resolve")
const terser = require("@rollup/plugin-terser")

const config = require("./config")
const { printJsError } = require("./format")

// Components import shared helpers as flat siblings (e.g. "./debounce.js").
// Those files actually live in _shared/js, so when a relative import cannot be
// found next to the importer we fall back to the shared directory. Runtime
// externals (the generated registry) are kept external here.
function sharedResolver() {
  const sharedDir = config.js.sharedDir
  const externals = new Set(config.js.runtimeExternals)

  return {
    name: "shared-resolver",
    resolveId(source, importer) {
      if (externals.has(source)) {
        return { id: source, external: true }
      }
      if (!importer) return null
      if (!source.startsWith("./") && !source.startsWith("../")) return null

      const local = path.resolve(path.dirname(importer), source)
      if (fs.existsSync(local)) return null // resolves normally

      const candidate = path.join(sharedDir, path.basename(source))
      if (fs.existsSync(candidate)) return candidate

      return null
    },
  }
}

async function buildJs({ dev = false } = {}) {
  const plugins = [nodeResolve(), sharedResolver()]
  if (!dev) plugins.push(terser())

  let bundle
  try {
    bundle = await rollup({
      input: config.js.entries,
      plugins,
      // Anything not resolved above (bare specifiers etc.) is treated as truly
      // external only via the resolver; surface other unresolved ids as errors.
      onwarn(warning, warn) {
        if (warning.code === "EMPTY_BUNDLE") return
        warn(warning)
      },
    })

    const bootName = config.js.bootName
    await bundle.write({
      dir: config.js.outDir,
      format: "es",
      sourcemap: dev,
      entryFileNames: (chunk) =>
        chunk.name === bootName
          ? `${bootName}.min.js`
          : `modules/${chunk.name}.min.js`,
      chunkFileNames: "modules/[name].min.js",
    })

    return true
  } catch (err) {
    printJsError(err)
    const fail = new Error("JS build failed")
    fail.showStack = false // gulp-cli prints only the message, no stack trace
    throw fail
  } finally {
    if (bundle) await bundle.close()
  }
}

module.exports = { buildJs }
