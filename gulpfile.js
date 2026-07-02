"use strict"

const gulp = require("gulp")

const { buildScss } = require("./build/scss")
const { buildJs } = require("./build/js")
const { generateRegistry } = require("./build/registry")
const { clean } = require("./build/clean")
const { colors } = require("./build/format")

const { gray } = colors

// --- runners -----------------------------------------------------------------
// Each runner does its work and, on failure, lets the compact error (already
// printed by build/format.js) surface as a short Error. buildScss/buildJs throw
// e.g. `Error: SCSS build failed` — Gulp then logs just that one line.

async function scssRun(dev) {
  const files = await buildScss({ dev })
  files.forEach((f) => process.stdout.write(gray(`css   dist/css/${f}\n`)))
}

// JS bundling + registry generation run as a pair: the registry is derived
// from whatever landed in dist/js/modules.
async function jsRun(dev) {
  await buildJs({ dev })
  const { registry, globalRegistry } = await generateRegistry()
  process.stdout.write(
    gray(
      `js    ${registry.length} modules + ${globalRegistry.length} global -> dist/js/registry.js\n`
    )
  )
}

// Run scss + js together; surface the first failure after both have run so
// every compact error block gets a chance to print.
async function buildBoth(dev) {
  const results = await Promise.allSettled([scssRun(dev), jsRun(dev)])
  const failed = results.find((r) => r.status === "rejected")
  if (failed) {
    const fail = new Error(failed.reason.message)
    fail.showStack = false
    throw fail
  }
}

// --- public tasks ------------------------------------------------------------

function cleanTask() {
  return clean()
}
cleanTask.displayName = "clean"

async function build() {
  await clean()
  await buildBoth(false)
}
build.displayName = "build"

async function dev() {
  await clean()
  // Initial build: don't abort the watcher if it fails; the error is shown.
  await Promise.allSettled([scssRun(true), jsRun(true)])

  const watched = (fn) => async () => {
    try {
      await fn()
    } catch (err) {
      process.stderr.write(`Error: ${err.message}\n`)
    }
  }

  process.stdout.write(gray("watching for changes... (Ctrl+C to stop)\n"))
  gulp.watch(
    ["src/**/*.scss"],
    { ignoreInitial: true },
    watched(() => scssRun(true))
  )
  gulp.watch(
    ["src/**/*.js"],
    { ignoreInitial: true },
    watched(() => jsRun(true))
  )
}
dev.displayName = "dev"

async function scssTask() {
  await scssRun(false)
}
scssTask.displayName = "scss"

async function jsTask() {
  await jsRun(false)
}
jsTask.displayName = "js"

exports.clean = cleanTask
exports.scss = scssTask
exports.js = jsTask
exports.build = build
exports.dev = dev
