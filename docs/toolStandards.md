# Tool authoring standards

A **tool** answers a question about the page you are building. It is not a
component, and the component checklist in
[`componentStandards.md`](componentStandards.md) does not apply to it.

Since 2026-08-18 the tools are not separate scripts either. They live in
**one dashboard**, `src/tools/dev_dashboard/dev_dashboard.js`: a bar along
the bottom edge of the page, one icon per tool, a panel wherever a tool needs
room to be read or operated. Adding a tool means adding a section to that
file — not a folder of its own.

## What separates a tool from a component

A component is **authored into** a page: markup, a class vocabulary,
`data-js-behavior`, `init(el, services)`, a stylesheet in the build, an entry
in `build/config.js`. A tool is **pointed at** a page: it brings no
vocabulary and nothing to author beyond one `<script>` line, it is never part
of what a visitor is served, and it never appears in `dist/`.

That is also why the `m-` / `c-` / `o-` question never comes up for a tool:
there is no cascade to place a class into, because every class a tool has
lives inside the dashboard's shadow root.

## Files

The whole area is three files, and the main file is named after the folder:

| File               | Purpose                                                  |
| ------------------ | -------------------------------------------------------- |
| `dev_dashboard.js` | Every tool: behaviour, UI and CSS in one file.            |
| `demo.html`        | A page that gives each tool something to work on.         |
| `readme.md`        | The documentation — the JS carries none (see below).      |

No `.scss`, no snippet file, **no entry in `build/config.js`** and no output
in `dist/`. `gulp build` does not know tools exist — the `src` file *is* the
artefact. Folder and file names follow the project convention, the `dev_`
prefix included.

## The rules

1. **One file, a classic script, zero imports.** Not an ES module, and
   nothing out of `_shared/js`. The dashboard has to survive being copied
   into a foreign project, pasted into a console and turned into a
   bookmarklet — and a classic script also runs from `file://`, where a
   module script does not. Duplicating a helper (a `debounce`, a formatter)
   inside it is therefore **correct**: tools sit outside the
   DI-vs-direct-import rule in [`CLAUDE.md`](../CLAUDE.md), because
   self-sufficiency is the point. It is also why load time is not an
   argument here: one local file during development costs nothing worth
   weighing against having to wire up four.

2. **Self-running, idempotent, one handle.** It runs on load, registers
   itself as `window.__devTools.dashboard`, and a second load re-opens what
   is already there instead of building a second copy:

   ```js
   const registry = (window.__devTools = window.__devTools || {});
   if (registry.dashboard) { registry.dashboard.open(); return; }
   …
   registry.dashboard = { open, close, destroy, collapse, expand, show, … };
   ```

   `open()` brings the bar up, `close()` puts the open panel away,
   `destroy()` removes everything from the page and deletes the key. Each
   tool adds its own object under that handle (`…dashboard.a11y.scan()`), so
   a console session can drive it without the UI.

3. **All UI in one shadow root on one host.** `all: initial` on the host
   *and* on `:host`, one `<style>` inside, one host element appended to the
   document. Class names inside stay plain (`.bar`, `.panel`) — the shadow
   root *is* the namespace. A tool never adds a stylesheet to the SCSS build
   and never a class to the page.

4. **The page under test is changed as little as possible, and never
   invisibly.** Three things are written into it, all reversible and all
   found by `grep data-dev-`:

   - a `div[data-dev-dashboard-spacer]` at the end of `<body>`, holding the
     bar's own height so nothing in the flow ends up underneath it. This is
     a **named exception** to the older "the page is not modified" rule: a
     bar that covers the bottom of the page hides exactly the thing you are
     usually looking at. Note what it cannot do — an element the page
     positions `fixed` at the bottom edge is not moved by flow space, which
     is why the bar folds away to a strip.
   - one `style[data-dev-dashboard-style]` carrying the marker rules. Inert
     until a marker attribute is set.
   - `data-dev-dashboard-flag` / `data-dev-dashboard-focus` on the elements
     a tool points at — **opt-in** behind a control, taken back by that same
     control, by closing the panel and by `destroy()`.

   Where a measurement can be taken without touching the page at all, it is:
   the srcset sweep measures a copy of the page in a probe frame, so scroll
   position, state and layout of the document you are looking at never move.

5. **One author-facing hook, `data-dev-<stem>`**, lowercase, where a tool
   needs elements marked at all: `data-dev-srcset="hero"`. The optional
   value is the label the element is reported under. The stem is the tool's
   short name — the same one it uses as its key under the handle — and the
   readme names it.

6. **The bar is the launcher.** There are no corner slots to hand out any
   more: a tool is an icon in the bar, and a panel above it if it has
   something to show. Three rules keep the bar readable:

   - **Only one panel is open at a time.** The panel region belongs to
     whichever icon was pressed last; a second press closes it again.
   - **A tool that watches the page carries its state on the icon** — a
     green mark when it found nothing, a red mark with the count when it
     did. That is the whole report until the icon is pressed; nothing is
     drawn into the page before that.
   - **What is read constantly needs no panel.** The page information sits
     in the bar itself.

   The bar's own layers count down from `z-index: 2147483647`.

7. **Keyboard and labels, at a developer's bar.** Real
   `<button type="button">`, <kbd>Esc</kbd> closes or aborts, `aria-expanded`
   on a disclosure and `aria-pressed` on a toggle, `aria-label` on an
   icon-only control, a visible focus ring. Explicitly **not** the component
   bar: no ARIA patterns, no live regions, no reduced-motion audit. A tool is
   a developer surface, and holding it to the product bar would only stop
   tools from being written.

8. **No third-party request at runtime, and its own palette.** The same rule
   as the vendor section in `CLAUDE.md`: no CDN, no API, nothing that depends
   on someone else's uptime or sees the URL you are working on. The QR code
   is the case that proves it — it was a demo aid calling `api.qrserver.com`
   and could not be a tool until the encoder was written into the file. And
   since a tool cannot `@use` the project's tokens and has to look the same
   in a foreign project, its colours are written into its own `<style>`.

9. **What the project provides is expected, and its absence is reported in
   one character.** The page information reads `--viewportName`,
   `--navstate`, `--density` and `--input`, which every consuming project of
   this collection declares. A page that does not gets an amber `?` in that
   token's place with the property name in the tooltip — not a warning, not
   a console message, not a fallback value pretending the token was there.

## Adding a tool

A tool is an object pushed onto `TOOLS`, next to the others in the file:

```js
const myTool = {
  id: 'stem',                     // key under window.__devTools.dashboard
  label: 'what the panel says',   // panel title
  title: 'what the icon says',    // tooltip / aria-label
  icon: ICONS.stem,               // inline SVG string
  badge: null,                    // set through setBadge(tool, kind, text, title)
  controls: () => controlNodes(), // buttons for the panel header, built once
  onOpen: (body) => render(body), // fill the panel body
  onClose: () => setMarks(false), // give the page back
};
TOOLS.push(myTool);
```

The shell builds the button, wires the panel and keeps the badge in sync.
Everything shared already exists in the file and is used rather than
rewritten: `q`, `describe`, `escapeHtml`, `debounce`, `flash`, `setFlags`,
`copyButton`, `showToast`, `setBadge`, `refreshPanel`, `showTool`.

## Documentation: the readme is the documentation

- **The JS carries no comments.** One file holding four tools would otherwise
  be read as four documented tools, and the comments would drift from the
  readme the moment either changes. The code says what it does; the readme
  says what it is for.
- **`readme.md`** carries: the one-sentence "what it answers", `Load it` ·
  `Mark up` · `Operate it` · `What it reports` · `Limits`. A table where
  there is more than a handful of anything. Every tool in the bar appears in
  `Operate it` and in `What it reports`.
- **`demo.html` hangs on nothing from the build** — no `shared.min.css`, no
  `boot.min.js`, all styles in the document, the dashboard loaded with one
  `<script src="dev_dashboard.js">` at the end of `<body>`, and a back link
  to `tools.html`. That is a rule, not laziness: a tool has to be shown
  working on a page it knows nothing about, and borrowing the project's
  tokens would hide leakage in either direction. The demo's job is to give
  every tool something real to find — the four page-info tokens declared the
  way a project declares them, one deliberate mistake per accessibility
  check, an element that is too wide, and marked images.
- **The component demos load the dashboard**, one line each, inside the
  `<!-- for development only -->` markers. It replaced `dev_pageInfo.js` and
  `dev_qrCode.js`, which used to be loaded there as modules and are now the
  bar's read-out and its QR panel.
- **New panels go into `tools.html`**, the tool index at the project root.
