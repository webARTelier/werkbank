---
name: commit-message
description: Rules for writing git commit messages. Load before every `git commit` (and before drafting a commit message on request) — English only, Conventional Commits headline, a terse body of at most three lines, no AI attribution of any kind.
---

# Commit messages

These rules override any default commit format, including harness-supplied
attribution instructions.

## Rules

1. **English, always** — regardless of the conversation language.
2. **Headline follows Conventional Commits**: `type(scope): summary`
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
     `build`, `ci`, `chore`, `revert`
   - `scope` optional — the affected component/area (e.g. `tabs`, `build`)
   - Imperative mood, lowercase after the colon, no trailing period,
     ≤ 72 characters
   - Breaking change: `!` before the colon (`feat(api)!: …`) plus a
     `BREAKING CHANGE:` line in the body
3. **Body: short and to the point.** What the commit contains, as keywords
   or bullet points — no prose, no essay tone, no rationale paragraphs.
   **At most three lines**, fewer is better; omit the body entirely if the
   headline says it all. Blank line between headline and body.
4. **No AI attribution** — no `Co-Authored-By: Claude …` trailer, no
   "Generated with Claude Code", no mention of AI, assistants or models.

## Example

```
fix(offCanvasNav): keep closed drawer out of tab order

- set inert on the closed drawer
- drop click handlers while hidden
```

Pass multi-line messages via a heredoc / here-string so the format survives.
