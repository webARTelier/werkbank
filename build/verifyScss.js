"use strict"

// Acceptance gate for SCSS refactors:
//   npm run verify:scss -- --baseline   build the reference before changing anything
//   npm run verify:scss                 rebuild, diff against it, lint src/
//   npm run verify:scss -- --lint-only  lint without building

const fs = require("fs")
const os = require("os")
const path = require("path")

const config = require("./config")
const { buildScss } = require("./scss")
const { lintScss } = require("./lintScss")

const workDir = path.join(os.tmpdir(), "uiComponents-verifyScss")
const baselineDir = path.join(workDir, "baseline")
const currentDir = path.join(workDir, "current")
const scssRoot = config.p("src")

async function buildInto(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  await buildScss({ outDir: dir })
}

function contextAt(buf, offset) {
  const start = Math.max(0, offset - 40)
  return buf.subarray(start, offset + 40).toString("utf8")
}

function diffBuilds() {
  const failures = []
  const baseline = fs.readdirSync(baselineDir).sort()
  const current = fs.readdirSync(currentDir).sort()

  for (const name of new Set([...baseline, ...current])) {
    if (!baseline.includes(name)) {
      failures.push(`${name}: new file, not in the baseline`)
      continue
    }
    if (!current.includes(name)) {
      failures.push(`${name}: missing from the current build`)
      continue
    }
    const before = fs.readFileSync(path.join(baselineDir, name))
    const after = fs.readFileSync(path.join(currentDir, name))
    if (before.equals(after)) continue

    let offset = 0
    while (offset < before.length && before[offset] === after[offset]) offset++
    failures.push(
      `${name}: differs at byte ${offset}\n` +
      `    baseline: ${contextAt(before, offset)}\n` +
      `    current:  ${contextAt(after, offset)}`
    )
  }

  return { failures, count: current.length }
}

function lintAll() {
  const failures = []
  const files = fs.readdirSync(scssRoot, { recursive: true })
    .filter((name) => name.endsWith(".scss"))
    .sort()

  for (const name of files) {
    const source = fs.readFileSync(path.join(scssRoot, name), "utf8")
    for (const problem of lintScss(source)) {
      failures.push(`src/${name.split(path.sep).join("/")}:${problem.line}  ${problem.message}`)
    }
  }

  return { failures, count: files.length }
}

function report(title, { failures, count }, unit) {
  if (!failures.length) {
    process.stdout.write(`${title}: ok (${count} ${unit})\n`)
    return true
  }
  process.stdout.write(`${title}: ${failures.length} problem(s) in ${count} ${unit}\n`)
  for (const failure of failures) process.stdout.write(`  ${failure}\n`)
  return false
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--baseline")) {
    await buildInto(baselineDir)
    process.stdout.write(`baseline written to ${baselineDir}\n`)
    return
  }

  let ok = true
  if (!args.includes("--lint-only")) {
    if (!fs.existsSync(baselineDir)) {
      throw new Error("no baseline yet: run `npm run verify:scss -- --baseline` before changing anything")
    }
    await buildInto(currentDir)
    ok = report("build diff", diffBuilds(), "files") && ok
  }
  ok = report("lint", lintAll(), "files") && ok

  process.exitCode = ok ? 0 : 1
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`)
  process.exitCode = 1
})
