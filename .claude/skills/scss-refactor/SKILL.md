---
name: scss-refactor
description: >-
  Apply a formatting or style-guide rule across the SCSS files of this
  project, gated by `npm run verify:scss` (byte-identical build plus blank-line
  lint). Load when asked to roll a rule out over many SCSS files, reformat
  SCSS, or run /scss-refactor <rule>. Not for a change to a single selector.
---

# SCSS refactor

The rule to apply is the argument (`/scss-refactor <rule>`). If none is given,
ask for it before doing anything.

## 1. Prepare (with the user)

1. Load `code-style-guide`. Leave comments as they are: in this project they
   are documentation (see `CLAUDE.md`).
2. `npm run verify:scss -- --baseline` on the untouched tree. Then
   `npm run verify:scss` must report `build diff: ok`. Note the lint count as
   the starting point; findings that existed before are not this run's job
   unless the rule covers them.
3. List the edge cases the rule meets in this codebase: nested `&__` / `&--`
   selectors, file-header notes, runs of blank lines, comments, media-query
   and `@include` wrappers, multi-line values. Grep for each and give counts.
4. Convert one representative file and show the diff.

Stop here until the user confirms the edge cases and the sample.

## 2. Run (autonomous)

- Work in batches of about 15 files, heaviest first.
- Change files with Edit or with a script that reads and writes UTF-8 and
  touches whitespace only. Never retype a code line.
- After each batch run `npm run verify:scss`. Fix every failure in the batch
  before starting the next one. Do not ask the user to review in between.
- `build diff` must stay ok unless the user asked for a visible change. A
  diff means code changed, not formatting: undo that edit, do not rebaseline.

## 3. Report

Only when `npm run verify:scss` exits 0 (or lint shows only findings the user
accepted in step 1):

- the rule as applied, in one or two sentences
- the edge cases hit, with counts
- three sample before/after diffs from different files
- one proposed commit message following the `commit-message` skill; do not
  commit until the user says so
