"use strict"

const fs = require("fs")
const path = require("path")

// -----------------------------------------------------------------------------
// Compact, readable console formatting for SCSS/JS build errors and Sass
// deprecation warnings. ANSI codes are hand-rolled on purpose so the build
// pulls in no extra colour dependency (e.g. chalk).
// -----------------------------------------------------------------------------

const ESC = "["
const codes = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  red: `${ESC}31m`,
  yellow: `${ESC}33m`,
  gray: `${ESC}90m`,
  bgRed: `${ESC}41m`,
  whiteText: `${ESC}97m`,
}

const wrap = (code) => (s) => `${code}${s}${codes.reset}`
const red = wrap(codes.red)
const yellow = wrap(codes.yellow)
const gray = wrap(codes.gray)
const redHeader = (s) => `${codes.bgRed}${codes.whiteText}${codes.bold}${s}${codes.reset}`

const RULE = "==============================================================="

// Build a coloured code frame straight from the source file so we fully
// control which lines appear and how they are coloured.
function buildCodeFrame(file, line, column, caretLength = 1) {
  let source
  try {
    source = fs.readFileSync(file, "utf8")
  } catch {
    return null
  }

  const lines = source.split(/\r?\n/)
  const idx = line - 1
  if (idx < 0 || idx >= lines.length) return null

  const gutter = (n) => String(n).padStart(String(line + 1).length, " ")
  const out = []

  // preceding line (orange/yellow)
  if (idx - 1 >= 0) {
    out.push(yellow(`${gutter(line - 1)} | ${lines[idx - 1]}`))
  }

  // offending line (red)
  out.push(red(`${gutter(line)} | ${lines[idx]}`))

  // caret line (red)
  const pad = " ".repeat(Math.max(0, column - 1))
  const carets = "^".repeat(Math.max(1, caretLength))
  out.push(red(`${" ".repeat(gutter(line).length)} | ${pad}${carets}`))

  // following line (orange/yellow)
  if (idx + 1 < lines.length) {
    out.push(yellow(`${gutter(line + 1)} | ${lines[idx + 1]}`))
  }

  return out.join("\n")
}

// Keep only the single relevant Sass location line, e.g.
//   scss\_shared\_foo.scss 4:1  @use
// and drop the "root stylesheet" trace line entirely.
function sassLocationLine(err, root) {
  const file = err.span && err.span.url ? urlToPath(err.span.url) : err.file
  if (!file) return null

  const rel = path.relative(root, file)
  const line = err.span ? err.span.start.line + 1 : err.line
  const col = err.span ? err.span.start.column + 1 : err.column
  if (line == null) return rel

  return `${rel} ${line}:${col}`
}

function urlToPath(url) {
  try {
    if (typeof url === "string" && url.startsWith("file:")) {
      return require("url").fileURLToPath(url)
    }
    if (url && url.href) return require("url").fileURLToPath(url.href)
  } catch {
    /* ignore */
  }
  return typeof url === "string" ? url : null
}

// Compact SCSS build error block per the project spec.
function printScssError(err, root) {
  const span = err.span
  const file = span && span.url ? urlToPath(span.url) : err.file
  const line = span ? span.start.line + 1 : err.line
  const column = span ? span.start.column + 1 : err.column
  const caretLength =
    span && span.start && span.end && span.start.line === span.end.line
      ? Math.max(1, span.end.column - span.start.column)
      : 1

  // sass_error message without the trailing "root stylesheet" trace lines
  const message = String(err.sassMessage || err.message || "")
    .split(/\r?\n/)
    .filter((l) => !/root stylesheet/i.test(l))
    .join("\n")
    .trim()

  const frame =
    file && line ? buildCodeFrame(file, line, column, caretLength) : null
  const loc = sassLocationLine(err, root)

  const lines = []
  lines.push(red(RULE))
  lines.push(` ${redHeader(" SCSS BUILD ERROR ")}`)
  if (message) lines.push(message)
  if (frame) lines.push(frame)
  if (loc) lines.push(gray(loc))
  lines.push(red(RULE))

  process.stderr.write(lines.join("\n") + "\n")
}

// Full deprecation warning (keeps the "Use ... instead" hint) + blank line.
function printSassDeprecation(warning, root) {
  const parts = []
  parts.push(yellow("Deprecation Warning"))
  if (warning.message) parts.push(warning.message)

  if (warning.span) {
    const loc = sassLocationLine({ span: warning.span }, root)
    if (loc) parts.push(gray(loc))
  }

  process.stderr.write(parts.join("\n") + "\n\n")
}

// Compact JS (Rollup) build error block: message + file:line:column, no stack.
function printJsError(err) {
  const lines = []
  lines.push(red(RULE))
  lines.push(` ${redHeader(" JS BUILD ERROR ")}`)
  lines.push(err.message || String(err))

  const loc = err.loc || (err.id ? { file: err.id } : null)
  if (loc) {
    const file = loc.file || err.id || ""
    const at =
      loc.line != null ? `${file}:${loc.line}:${loc.column ?? 0}` : file
    if (at) lines.push(gray(at))
  }
  if (err.frame) lines.push(err.frame)

  lines.push(red(RULE))
  process.stderr.write(lines.join("\n") + "\n")
}

module.exports = {
  printScssError,
  printSassDeprecation,
  printJsError,
  colors: { red, yellow, gray, redHeader },
}
