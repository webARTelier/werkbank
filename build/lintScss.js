"use strict"

// Checks the blank-line rules of the code style guide (SASS/CSS > Formatting
// rules, Comments, Nesting). Formatting only; the build diff covers the rest.

const DECLARATION = /^(--[\w-]+|\$[\w-]+|[a-z-]+)\s*:(?!:)/i
const USE_LINE = /^@(use|forward)\b/

// Code with strings, interpolation and comments removed, so braces and
// parentheses can be counted. `//` after a colon is a url, not a comment.
function codeOf(line, state) {
  let out = ""
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (state.blockComment) {
      if (ch === "*" && line[i + 1] === "/") {
        state.blockComment = false
        i++
      }
      continue
    }
    if (ch === "/" && line[i + 1] === "*") {
      state.blockComment = true
      i++
      continue
    }
    if (ch === "/" && line[i + 1] === "/" && line[i - 1] !== ":") break
    if (ch === "'" || ch === '"') {
      const end = line.indexOf(ch, i + 1)
      out += '""'
      i = end === -1 ? line.length : end
      continue
    }
    if (ch === "#" && line[i + 1] === "{") {
      const end = line.indexOf("}", i + 2)
      out += "x"
      i = end === -1 ? line.length : end
      continue
    }
    out += ch
  }
  return out.trim()
}

function classify(source) {
  const lines = source.split("\n")
  const state = { blockComment: false }
  const stack = []
  const closeOf = {}
  let depth = 0
  let parens = 0

  const info = lines.map((text, index) => {
    const trimmed = text.trim()
    const inComment = state.blockComment
    const code = codeOf(text, state)
    const item = { index, text: trimmed, code, depth, parent: stack[stack.length - 1], inParens: parens > 0 }

    if (!trimmed) item.kind = "blank"
    else if (!code || inComment) item.kind = "comment"
    else if (code.startsWith("}")) item.kind = "close"
    else if (code.endsWith("{")) item.kind = "open"
    else if (DECLARATION.test(code)) item.kind = "declaration"
    else item.kind = "other"

    for (const ch of code) {
      if (ch === "(") parens++
      if (ch === ")") parens--
      if (ch === "{") {
        stack.push(index)
        depth++
      }
      if (ch === "}") {
        const open = stack.pop()
        if (open !== undefined) closeOf[open] = index
        depth--
      }
    }
    if (item.kind === "close") {
      item.depth = depth
      item.parent = stack[stack.length - 1]
    }
    return item
  })

  // A selector spread over several lines, with or without a trailing `,`,
  // starts the rule on its first line; a declaration value ends in `;`.
  for (let i = info.length - 1; i >= 0; i--) {
    const item = info[i]
    const next = info[i + 1]
    item.ruleStart = item.kind === "open" ||
      (item.code !== "" && !/[;{}]$/.test(item.code) && next && next.depth === item.depth &&
        (next.kind === "open" || next.ruleStart))
    if (item.ruleStart && item.kind !== "open") item.kind = "selectorPart"
    item.close = closeOf[i]
  }

  return info
}

function isContinuation(info, i) {
  const prev = info[i - 1]
  if (!prev || prev.kind === "blank" || prev.kind === "comment") return false
  if (info[i].inParens) return true
  return !/[;{}]$/.test(prev.code)
}

function isNamed(item) {
  return item.depth === 0 || /^&(__|--)/.test(item.code)
}

// Only a selector is compact, never a mixin, function or at-rule body. It
// counts the lines of its own declarations; nested blocks do not count.
function isCompact(info, parent) {
  if (parent === undefined || info[parent].code.startsWith("@")) return false
  let lines = 0
  let open = false
  for (const item of info.slice(parent + 1, info[parent].close)) {
    if (item.parent !== parent || item.kind === "blank" || item.kind === "comment") continue
    if (item.kind === "declaration" || open) {
      lines++
      open = !item.code.endsWith(";")
    }
  }
  return lines <= 3
}

function expectation(info, anchor, target, prev) {
  const above = info[prev]
  const item = info[target]

  if (above.code.endsWith("{")) {
    if (anchor !== target) return { allowed: [1], reason: "leading comment in a block" }
    return item.ruleStart
      ? { allowed: [1], reason: `nested rule opening its block "${item.code}"` }
      : { allowed: [0], reason: "first line of a block" }
  }
  if (item && item.kind === "close" && anchor === target) {
    return { allowed: [0], reason: "closing brace" }
  }
  if (item && item.ruleStart) {
    if (item.depth === 0) return { allowed: [3], reason: `top-level rule "${item.code}"` }
    return isNamed(item)
      ? { allowed: [3], reason: `BEM name "${item.code}"` }
      : { allowed: [1], reason: `nested rule "${item.code}"` }
  }
  if (USE_LINE.test(above.code) && !(item && USE_LINE.test(item.code))) {

    // A file note directly under the imports takes one line and the three-line
    // gap follows it; a section banner takes the gap itself.
    return item.kind === "comment" && anchor === target
      ? { allowed: [1, 3], reason: "file note or section banner under the @use header" }
      : { allowed: [3], reason: "end of the @use header" }
  }
  if (item && item.depth > 0) {
    if (anchor !== target || info[anchor].kind === "comment") {
      return { allowed: [1], reason: "comment inside a block" }
    }
    const afterDeclaration = above.kind === "declaration" || isContinuation(info, prev)
    if (item.kind === "declaration" && afterDeclaration && isCompact(info, item.parent)) {
      return { allowed: [0], reason: "compact selector (3 declaration lines or fewer)" }
    }
    return { allowed: [0, 1], reason: "inside a block" }
  }
  return { allowed: [0, 1, 3], reason: "blank lines come in runs of 1 or 3" }
}

function lintScss(source) {
  const info = classify(source)
  const problems = []

  for (let anchor = 0; anchor < info.length; anchor++) {
    const item = info[anchor]
    if (item.kind === "blank") continue
    if (anchor > 0 && info[anchor - 1].kind === "comment" && item.kind === "comment") continue
    if (item.kind !== "comment" && info[anchor - 1] && info[anchor - 1].kind === "comment") continue
    if (isContinuation(info, anchor)) continue

    let prev = anchor - 1
    while (prev >= 0 && info[prev].kind === "blank") prev--
    if (prev < 0) continue
    const blanks = anchor - prev - 1

    let target = anchor
    while (target < info.length && info[target].kind === "comment") target++
    if (!info[target] || info[target].kind === "blank") target = anchor

    const { allowed, reason } = expectation(info, anchor, target, prev)
    if (!allowed.includes(blanks)) {
      problems.push({
        line: anchor + 1,
        message: `${blanks} blank line(s) above, expected ${allowed.join(" or ")} (${reason})`,
      })
    }
  }

  return problems
}

module.exports = { lintScss }
