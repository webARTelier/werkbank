# copyToClipboard

Puts a string into the visitor's clipboard on one press — a code snippet, a
coupon code, an IBAN, a share link. The module element is the **button**
itself; `data-copy-target` names the element to copy from, or `data-copy-text`
carries the string directly.

The visible half of a copy button is three lines anybody can write, which is
why the control is everywhere and why so few of them are usable. **A copy
leaves no trace on the page**: nothing navigated, no value changed, no element
appeared. Whoever cannot see the checkmark flash is told nothing at all — and
the usual attempt to fix that, swapping the label from "Copy" to "Copied",
moves the focused control's own accessible *name* under the reader, which is
announced as a different button rather than as a result.

So what this module ships is the other half: the announcement, the state hook,
and the failure path a hand-written copy button does not have. Everything
visible stays the project's — a copy button is one of your own buttons,
standing in a toolbar next to its siblings.

## Files needed to copy
- `copyToClipboard.html` – markup
- `copyToClipboard.scss` – styles (source; compiled to `dist/css/copyToClipboard.min.css`)
- `copyToClipboard.js` – behavior

Three utilities from `_shared/js/` ride along: `resolveLocale.js` (picks the
built-in wording from `<html lang>`), `formatTemplate.js` (interpolates
`{text}` into a wording you supply) and `parseNonNegative.js` (reads the
duration option).

The stylesheet is **two rules**, and neither is a look: the visually-hidden
recipe for the live region the module injects, and the one that keeps `hidden`
hiding the control (see *Usage*). It is small, and it is not optional —
without the first, that region is visible text on the page.

## Usage

```html
<pre><code id="installCommand">npm install</code></pre>

<button type="button"
        data-js-behavior="copyToClipboard"
        data-copy-target="#installCommand"
        hidden>Copy the install command</button>
```

**The button ships `hidden` and the module removes it.** Keep the attribute.
Nothing in HTML or CSS copies anything — no attribute, no element, no state —
so a copy button without a script is a control that does nothing, and this is
`video`'s approach rather than a CSS pre-enhancement block: no ready
attribute, no media query, and a chunk that never arrives leaves the page
exactly as authored. Nothing is lost either way, which is what makes it
allowed at all: the text is on the page, selectable, and Ctrl+C has always
been there.

The same attribute covers every case in which the module gives up — an
insecure origin, a target selector that is not valid CSS, no source configured
at all. **The control appears when it works and not before**, and the reporter
says why in the console.

**You do not have to make `hidden` stick.** Its effect is a UA rule with
specificity (0,0,0), so a project's own `.button { display: inline-flex }` puts
every dead copy button back on screen — and giving a button a `display` is the
first thing anybody does to one. So the stylesheet carries one
`display: none !important` for an element that has this module's source
attribute *and* `hidden`. That is the only declaration this component takes off
you, it is scoped to exactly that pair, and it stops applying the moment the
module removes the attribute. (The `!important` is there for the reason the
reduced-motion blocks in this collection carry one: no author wants a layout
rule to resurrect a control the module deliberately left dead, and a
specificity safe against `.toolbar .button` in a later stylesheet cannot be
written without a hack.)

**The control arrives after the first paint, so reserve its place where the
shift would be felt.** The module is a lazily imported chunk — which is what
makes "hidden until it works" possible in the first place — so the row the
button sits in moves once, when it appears. Nothing is lost and nothing can be
done about it from here: reserving the space would mean shipping a look, and
the whole point is that the control is not on screen until it copies
something. A snippet toolbar that visibly jumps is worth one line of your own
CSS instead — a `min-inline-size` on the cell the button sits in, or a button
laid over the box (`position: absolute`) rather than beside it.

`type="button"` is required inside a `<form>`: a `<button>` without a type
defaults to submit, so every copy would send the form off as well. The module
reports that and leaves the control hidden rather than suppressing a submit the
page asked for.

**The clipboard needs a secure context.** `navigator.clipboard` does not exist
on a page served over plain http (localhost counts as secure) — the platform's
rule, not this component's. There the control stays hidden. No
`document.execCommand("copy")` fallback ships: it is deprecated, and an
insecure origin is a deployment to fix rather than a browser to work around.

**The case you will actually meet is your own LAN.** `localhost` and
`127.0.0.1` are secure contexts, so a copy button works on your machine and
then vanishes the moment you open the same page on a phone at
`http://192.168.x.x:5500` — which is exactly how you would test a copy button
by touch. That is this rule, not a bug: the console carries one warning per
control saying so. Ways round it, in order of effort: a tunnel that terminates
TLS (`cloudflared tunnel`, `ngrok`), a local certificate (`mkcert`), or
Chromium's `--unsafely-treat-insecure-origin-as-secure=http://192.168.x.x:5500`
for a throwaway profile. `demo.html` shows the third option a page has: detect
it with `window.isSecureContext` and say so on screen, so a page that shows no
controls explains why.

### What gets copied

`data-copy-target` copies **the text the reader can see** in that element: its
`value` for an `<input>`/`<textarea>`/`<select>`, otherwise its text content
with the outer whitespace trimmed. The indentation *inside* it is kept, so a
`<pre><code>` block arrives in the clipboard as it stands on screen — that is
`textContent` rather than `innerText`, which is a rendering and collapses
exactly the whitespace a code block is made of. The trimming at the edges is
the other side of the same coin: in a pretty-printed document those are the
indentation of the markup, not anything the reader can see.

The selector is resolved against the whole document and **looked up again on
every press**, so a box filled later — a loaded fragment, a rendered template —
works without re-initialising anything. A selector that matches nothing *yet*
is a warning, not a bail-out; one that is not valid CSS is a bail-out, because
resolving it inside a click listener would throw where nothing can report it.

`data-copy-text` takes a literal string instead, used exactly as written. That
is where anything which is not visible text belongs: a share URL, an `href`, an
order number your template knows. Pointing `data-copy-target` at an `<a>`
copies its **label**, because that is what the label is.

Two things the component deliberately does not do:

- **Text only.** The clipboard also takes `text/html`, and writing both would
  make what a receiving application pastes depend on which of the two it
  prefers. The promise here is the string the reader can see.
- **It never writes an empty string.** `writeText("")` would replace whatever
  the reader had in their clipboard with nothing, and taking something away is
  the one thing a copy button must not do. An empty source — or one that is
  not in the document — is the failure path instead.

### Configuration (attributes on the button)
- `data-copy-target` – CSS selector for the element to copy from. One of this
  and `data-copy-text` is **required**; with both, the literal wins and the
  console says so.
- `data-copy-text` – the literal string to copy.
- `data-copy-copied-text` – what the announcement says after a successful
  copy. `{text}` interpolates the copied string — for a short value only, since
  a twelve-line snippet read out in full is not a confirmation. Default: the
  built-in sentence for `<html lang>` (`de`, `en`, falling back to `en`). An
  **empty** value opts the announcement out; see *Working with toast*.
- `data-copy-error-text` – the same for a failed copy.
- `data-copy-duration` – ms the outcome stands (default `2000`): the state
  attribute on the button and on the source, and the sentence in the live
  region, which end together. `0` keeps both until the next press.

### Styling

The module writes **one** attribute and nothing else:

```css
.myCopy[data-copy-state="copied"] .myCopy__check { opacity: 1; }
.myCopy[data-copy-state="error"]  { color: var(--color-error); }
pre[data-copy-state="copied"]     { outline: 2px solid var(--color-success); }
```

It sits on the button **and** on the source element, so a rule can flash the
snippet that was copied as well as the control that copied it. The JS only ever
writes it, so restyling cannot break the behaviour.

**On the source, the state belongs to the last press.** Two controls may point
at one box — a copy button, and a second one that leaves the message to a
toast — and the box is marked for whichever of them copied it most recently,
while each button's own attribute still ends on its own duration. So a rule on
the source reads "this was just copied" rather than "this control's state",
and there is never more than one of it on the page.

**A `@keyframes` animation does not replay on a second press inside the
duration.** The module takes the attribute off and puts it back within one
task, so where the value is the same both times the computed style never
changes and an animation has nothing to restart from. State a flash as a
`transition` instead, or accept that the second copy in a row does not blink;
a failure (`copied` → `error`) is a real value change and animates as
expected.

Two rules for whoever styles it. **Do not swap the button's label text** from
CSS — not with `content`, not by hiding one span and showing another: the label
is the control's accessible name, and a name changing under a focused button is
announced as a different button rather than as a result. And **do not treat the
state as the whole story**: whatever it draws, the module has also said in
words. A checkmark alone is precisely the half that leaves a screen-reader user
with no result, and it is the half this component exists for.

The button's own `:focus-visible` ring is the project's too, like the rest of
its look. `demo.html` shows one fully worked design around all of it.

## Accessibility
- **A polite live region**, injected after the button and filled with one
  sentence per press. This is the component's reason to exist: a copy leaves
  no trace, so without it there is no result to perceive (WCAG 4.1.3). Both
  outcomes go through the same region, and it is polite rather than assertive —
  the reader pressed a button and is waiting for exactly this sentence a few
  hundred milliseconds later, so there is nothing to interrupt. Assertive is
  for what happens to a reader unbidden.
- **Every announcement is a new node** in that region. Assigning the same text
  to the same node is not a mutation, so the second "Copied to the clipboard."
  would be silent. The region is emptied on the press and filled when the
  write settles, which is what makes each one a change the accessibility layer
  can see. A failure that needs no write at all — an empty source, a target
  that is not in the document — is announced one task later for exactly that
  reason: emptying and refilling the region inside a single task is not a
  change either, so the second identical failure in a row would be the silent
  one.
- **The sentence does not outlive the state it reports.** When
  `data-copy-duration` is up, the state attribute comes off *and* the region
  is emptied. The words were spoken long before, on the change — but the node
  stays in the document, and a reader moving through the page with a virtual
  cursor afterwards would otherwise meet a "Copied to the clipboard." standing
  at a control that shows nothing of the sort any more. With
  `data-copy-duration="0"` neither half is taken back: there the sentence is
  the standing checkmark's only counterpart in words.
- **The focus never moves**, and no selection is touched. Not on success, and
  not on a failure either: the text stays where it was, selectable. Selecting
  it for the reader would be a different action from the one they pressed, and
  it would throw away a selection they may already have had.
- **The button's accessible name is constant.** The result is said by the live
  region, not by the label. (`passwordToggle` keeps its name constant for the
  neighbouring reason.)
- **The built-in wording says which language it is in** where that is not the
  page's, so a screen reader does not read "Copied to the clipboard." in a
  French voice (WCAG 3.1.2). Your own wording is in the page's language by
  definition and is left alone.
- **Naming the button is yours.** "Copy" is enough when there is one; a page
  with six snippets needs six names a reader can tell apart. An icon-only
  control gets its name from a visually-hidden text node — better than an
  `aria-label`, because it still names the control when the stylesheet has not
  arrived.
- A page with many copy buttons gets a live region per button. They are empty
  at rest and out of the layout (absolutely positioned, so not a flex or grid
  item of the toolbar the button sits in), and keeping each one next to its
  button is what lets it inherit the surrounding `lang`.

## Working with toast

The module says the result; it draws nothing. For a **visible** message
[`toast`](../toast/readme.md) is the component next door, and there are two
ways to reach it:

**Declarative, no script** — `data-toast-trigger` plus `data-toast-message` on
the same button. It fires on the *press*, so it reports a copy before the write
has settled: fine for a share link, wrong if you care about the failure.

**Accurate** — listen for this module's own events, dispatched once the outcome
is known. They bubble, so one listener serves every copy button on the page:

```js
document.addEventListener('copy:copied', () => {
  document.dispatchEvent(new CustomEvent('toast:show', {
    detail: { message: 'Copied to the clipboard', variant: 'success' },
  }));
});

document.addEventListener('copy:failed', (event) => {
  console.warn('copy failed', event.detail.error);
});
```

`event.detail` is `{ text }` on success and `{ text, error }` on failure. The
names are namespaced so neither can be confused with the platform's own `copy`
event, which is a different thing entirely (a copy the reader triggered on a
selection).

**The one thing to get right:** a toast is a live region of its own, so it
announces the message itself. Opt this module's announcement out with an empty
`data-copy-copied-text=""` (and `data-copy-error-text=""`) on those buttons, or
the reader hears the result twice. Where both are empty the module does not
even build its region — and says so in the console, because that is the one
configuration in which this component can be wired up correctly and still
leave a screen-reader user with nothing at all. The warning is not an error:
it is right where a toast is listening, and it is there to be read by the
project that forgot the listener.

## Integration
The JS exports `init(el, services)` and is boot-loaded per
`data-js-behavior="copyToClipboard"` — you never import `copyToClipboard.js`
yourself. It sets **no inline styles**: the only thing it writes for the
project to react to is `data-copy-state`. `services.reporter` is optional and
used only for warnings (a missing source, an invalid selector, a submit button,
no Clipboard API, a refused write). `init` returns a cleanup function, so a host
that mounts and unmounts the same subtree can call `destroyModulesInScope()` —
it clears the pending timer, removes the injected region, takes the state
attribute off both ends and puts `hidden` back on the button, because without
the module the control is again what it was: a button that does nothing. A
clipboard write still in flight is the one thing that cannot be taken back, so
it is caught on arrival instead: an outcome settling after the teardown is
dropped rather than written onto a control that has been handed back, and no
`copy:copied` / `copy:failed` is dispatched for it.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
