# fileUpload

A native file field in a box that says what is attached to it: the whole box is
a drop target, and every file gets a row with its name, its size and a control
that takes that one file back out. Optionally it also holds the selection to a
size limit — the one constraint the platform has no attribute for. The file
input itself is left completely alone: it keeps the picker, the keyboard,
`accept`, `multiple`, `required` and the form.

By default it uploads nothing: the files travel with the form the way they
always did, and the server stays the only place where a file is really checked.
Give it an endpoint and it uploads each file as it is chosen instead, with a
real progress bar per file.

## The progress bar is an endpoint, not a flag

"Show a progress bar" cannot be a display option. A submitted form reports
nothing back to the page while it uploads — no event, no byte count, nothing —
so a bar means taking the transfer **away** from the form, which changes what
the server receives, what a failure looks like and who clears up afterwards.
The option is therefore the endpoint itself, and one attribute picks the lane:

| | no `data-fileupload-url` | `data-fileupload-url="…"` |
|---|---|---|
| Who carries the bytes | the form, on submit | the module, on selection |
| Endpoint needed | none | one, plus a sweep |
| Progress bar | **impossible** | per file |
| Server sees | files, as always | handles — and files without JS |
| Cleanup story | none | unclaimed uploads must be swept |
| Cost of getting in | copy three files | design an upload route |
| A file over a limit | stays, marked, blocks the form | refused at the door |

**Start without it.** Add the attribute when the files are large enough that
somebody has to be told how far they have got, because that is the one thing a
form post cannot report. There is deliberately nothing in between: a box that
promised a bar with nowhere to send to would be a bar that never moves.

Everything else is the same in both lanes — the same box, the same drop zone,
the same rows, the same stylesheet, the same size limits. Adding an endpoint
later is one attribute and some server work, not a different component to
restyle.

## Files needed to copy
- `fileUpload.html` – markup
- `fileUpload.scss` – styles (source; compiled to `dist/css/fileUpload.min.css`)
- `fileUpload.js` – behavior
- `src/_shared/js/rafThrottle.js`, `resolveLocale.js`, `formatTemplate.js`,
  `parseByteSize.js`, `parseNonNegative.js`, `formatByteSize.js`,
  `matchesAccept.js`, `fileKey.js`, `uniqueId.js` – bundled utilities
  (imported by the module; the build resolves them, so this only matters if
  you paste the source into a plain project)

There is **no vendor dependency**.

## Usage

Both hooks go on the element **wrapping** the field, not on the field itself —
the box is the drop target, and the input is what the box is built around. The
module finds the field on its own (the first `input[type="file"]` inside), so
there is no attribute to wire. The field keeps everything it had, `name` and
`required` included: without the module the form has to post the files the
ordinary way, in either lane.

```html
<div class="c-fileUpload" data-js-behavior="fileUpload">
  <label class="c-fileUpload__label" for="attachments">Attachments</label>
  <input class="c-fileUpload__field" type="file" id="attachments"
         name="attachments" accept="application/pdf,image/*" multiple />
  <p class="c-fileUpload__hint">PDF or image files.</p>
  <p class="c-fileUpload__dropHint">You can also drop them anywhere in this box.</p>
</div>
```

The same markup with one attribute more uploads as it goes, and every row gets
a bar:

```html
<div class="c-fileUpload" data-js-behavior="fileUpload"
     data-fileupload-url="/api/uploads">
  …the same label, input and hints…
</div>
```

The module appends three nodes to the box: the list of files, the running total
where a total limit is set, and one visible status line. Do not author any of
them — they all describe files that do not exist when the page is written. In
the upload lane each finished transfer also gets a hidden input **inside its own
row**, carrying the handle the server returned, so a row and the value it stands
for are one thing and removing the row removes the handle with it.

### Options

On the **field**, in both lanes, next to the platform's own constraints — which
is where the next person to read that line will look for them:

| Attribute | Effect |
|---|---|
| `accept` | *(platform)* which types the picker offers — and which types a **drop** may add. A dropped file the picker would never have offered is reported, not accepted |
| `multiple` | *(platform)* several files. A drop **appends**; without the attribute it **replaces** what is there with the first file it carries |
| `required` | *(platform)* an empty field fails the form's own validation, with the browser's own message. In the upload lane the module takes the attribute over and keeps its meaning (see below) |
| `data-fileupload-maxsize` | the largest a single file may be, e.g. `"5MB"` |
| `data-fileupload-maxtotal` | the largest the whole selection may be, e.g. `"20MB"` |

On the **root**, and all of them only meaningful in the upload lane, because
they say *how* to upload:

| Attribute | Effect |
|---|---|
| `data-fileupload-url` | where to POST each file. **Its presence turns the bars on** |
| `data-fileupload-part` | the multipart part name (default `file`) |
| `data-fileupload-name` | the hidden inputs' name (default: the field's own `name`) |
| `data-fileupload-key` | the JSON key holding the handle (default `id`) |
| `data-fileupload-delete-url` | `DELETE <url>?<key>=<handle>` when a row goes — under `data-fileupload-key`, so `id` unless you changed it |
| `data-fileupload-token` | a CSRF token, sent as a header |
| `data-fileupload-token-header` | that header's name (default `X-CSRF-Token`) |
| `data-fileupload-concurrency` | transfers at a time (default `3`) — because twenty parallel uploads on one line finish later than three at a time and report nonsense on the way |

`accept` is a filter, not a verdict: it names types, and the contents of a file
are the server's business. Attaching the same file twice adds it once — name,
size and timestamp together are as close to an identity as a `File` gets.

A dropped **folder** is turned away by the same reasoning and gets its own
sentence, because no `accept` value would have let a directory in. A file input
cannot produce one without `webkitdirectory`, so a box that read one out on its
own would be doing what the control it is attached to cannot — and left alone a
directory arrives in `dataTransfer.files` looking almost like an empty file,
which would mean a row naming a folder and, in the upload lane, a transfer that
fails on the first read. The question is put to the drag entry
(`webkitGetAsEntry().isDirectory`), never to the file: "no extension and zero
bytes" describes an empty file just as well. A missing entry counts as *not* a
folder — a synthetic `DataTransfer` answers `null` in Chromium and a real entry
in WebKit (measured), so the other reading would drop every file of a
programmatic drop in one of the two engines.

A **disabled** field takes nothing, so the box stops inviting a drop for as
long as the attribute is there: the invitation goes and the dashed edge falls
back to the transparent one it wears before the module arrives. It is a
stylesheet rule rather than something `init()` decides, because a field is
disabled and enabled again while the page is open.

Everything visible is CSS. The knobs are declared on the component root
(`fileUpload.scss`, one block at the top): `--fileUpload-zone-style` /
`-zone-color` for the zone's edge, `--fileUpload-bar-*` for the bar,
`--fileUpload-done-color` for the tone on "uploaded",
`--fileUpload-error-color` for a row over the limit and a failed transfer,
`--fileUpload-padding` / `-gap` / `-list-gap` / `-item-*` for the spacing,
`--fileUpload-remove-size` for the cross on the remove control,
`--fileUpload-hint-size` for the hints and the status line, plus the other
colour tokens. They belong on the root itself (inline for a single instance, or
a rule that hits `.c-fileUpload`), because a declaration on the element beats an
inherited value whatever an ancestor's specificity is.

The wording of the status line, the row states and the controls is built in for
`de`/`en`, picked from `<html lang>`; any other language falls back to `en`.

## The size limits

There is no native `maxsize`, which is why these two are the only options the
default lane has. Both are optional and both take a size with a unit — `"5MB"`,
`"1,5 gb"`, `"500 kb"` — or a bare number of bytes. Steps are **decimal**
(1 kB = 1000 bytes), the same as the sizes in the rows, so a limit and a file
size can never both read "5 MB" while one of them is over the other. Absent,
malformed or zero means **no limit**: a component that invented one would refuse
a file the author never said anything about. Both are read fresh on every pass,
like `accept`, so a project may tighten either one while the page is open.

What happens to a file over a limit is the one place the two lanes deliberately
differ, and each does the only sensible thing for what a row means to it:

- **Without an endpoint the file stays in the selection.** Its row is marked
  "too large", the status line names the limit, and the field itself is made
  invalid through `setCustomValidity()` — so the form refuses to send, the
  browser writes that sentence on the control, and `formValidation` renders it
  with no extra wiring, because it honours an author-set custom message above
  every message of its own. The alternative — dropping the file — would take
  away what the reader just chose, leave a single-file field reading "no file
  chosen" with no explanation anywhere near it, and work only in an engine that
  can rewrite a selection at all. Here the file *is* the field's value.
- **With an endpoint the file is refused at the door** and never uploaded. The
  point of checking in the browser is to not spend two minutes sending something
  the server will throw away, and here a row means a transfer: a file that will
  never be sent is not one. It is announced instead of listed.

Two consequences worth knowing:

- **Do not combine a limit with `data-fv-equals` on the same field.**
  `formValidation` owns a field's custom validity where that attribute is
  present, and the two would overwrite each other. (An equality rule on a file
  field has no meaning anyway.)
- The **cleanup function clears the custom validity**, so unmounting the
  component cannot leave a form blocked by a message whose author is gone.

Where a total limit is set, the running total is printed under the list
("12.4 MB of 20 MB") so the budget is visible while there is still room in it.
It is a line of text, not a bar, and not a live region: it is a standing fact
about the files rather than an event, and `role="status"` would have it read out
after every single one. A second bar would be worse still — in the upload lane
the bars in the rows are about bytes on their way to a server, and this one
would be about a budget.

## The upload lane

Only relevant where `data-fileupload-url` is set.

### Two shapes, and why the field loses its name

While the module uploads it **takes the `name` off the file field** and puts it
on the hidden inputs instead, so the same bytes cannot travel twice. Your
endpoint therefore sees one of two shapes under the same name:

```
without JS   attachments = the files themselves (multipart)
with JS      attachments = the handles your upload route returned
```

Both have to be handled server-side. That is the real price of a progress bar,
and it is worth saying plainly because it is the part that gets discovered late.
`required` moves the same way and for the same reason — the field is emptied
after every pick, so the attribute would otherwise block the form forever. It
keeps meaning "at least one file", answered against the queue.

Both are handed back by the cleanup function.

### The server side

Three routes' worth of work, and the third one is not optional:

1. **`POST <url>`** receives one file per request as `multipart/form-data`, in
   the part named by `data-fileupload-part`. Answer 2xx with JSON holding a
   handle: `{ "id": "9f3c…" }`. Anything else — a non-2xx, a body that is not
   JSON, a 200 without that key — counts as a failure, and the row offers
   Retry. An optional `"error"` string in the body is shown to the reader **as
   it stands**, so put something readable there.
2. **On submit you receive handles, not files.** Resolve them, and check that
   the current user may use them: a handle is a reference, and an unchecked
   reference is an access-control hole. Validate type and size again here —
   everything the browser did was a convenience, and none of it is a verdict.
3. **Sweep unclaimed uploads by age.** Files arrive before a form is submitted,
   so some will never be claimed: a reader who changed their mind, closed the
   tab, lost the connection. The optional `DELETE` route covers the case where
   someone takes a file back out, but it can never be relied on — a closed tab
   sends nothing.

### The honest tail end

100 % means the last byte left the browser. It does not mean the server is
finished with it — it may still be scanning, resizing or storing. So when the
upload's own `load` fires, the bar goes **indeterminate** and the row says
*processing* until the response arrives. A bar that sat at "100 %" for four
seconds would be the one moment where a progress display lies, and it is the
moment readers press things twice.

### The form cannot be sent early

While anything is queued, uploading, processing or failed, the module writes the
reason onto the field with `setCustomValidity()`. The browser then refuses the
submit and shows the message on the control, `validity` and `validationMessage`
are correct for anything else that reads them, and `formValidation` renders it
above every message of its own — with no extra wiring. It is the same channel
the size limits use in the default lane, and the reason neither lane has a
`submit` listener to collide with a project's own.

Two things this lane deliberately does **not** do:

- **No timeout on a transfer.** A large file on a slow line is slow, not
  broken, and a transfer cut off after N seconds looks exactly like a server
  that refused it.
- **No "are you sure you want to leave" dialog.** Leaving mid-form is the
  reader's call; the orphaned upload is the server's sweep to make (above), not
  a reason to take the page hostage.

## What the platform already does

Worth knowing, because it is what keeps the module small:

- The control opens the picker, is operated from the keyboard, and its own
  button is the single-pointer alternative that WCAG 2.5.7 asks for next to any
  dragging.
- **A file input is already a drop target.** Files dropped on the control
  itself are assigned to it and fire `change`, with no script at all. What this
  component adds is the *size* of that target and a visible invitation to use
  it — not the capability.
- `input.files` cannot be edited element by element, but the whole list can be
  assigned from a `DataTransfer`. That is the platform's own way of rewriting a
  selection, and it is what makes a per-file remove control possible in the
  default lane without keeping a second copy of the list.
- `Intl` names a byte size and a percentage in the page's language, so neither
  is assembled by hand.
- **`setCustomValidity()` is the platform's channel for a constraint it has no
  attribute for.** A size limit is exactly that, and so is "wait, something is
  still uploading", so both go through there instead of through a submit handler
  of the component's own — and the form, the message, `validity`,
  `validationMessage` and `formValidation` all keep working off the standard. It
  is the same route `formValidation` takes for its one non-native rule
  (`data-fv-equals`).
- **`XMLHttpRequest.upload` fires progress events** with `loaded`/`total` while
  the request body goes out. **`fetch()` does not** — a request body cannot be
  observed on its way out (streaming request bodies need HTTP/2, duplex support,
  and are unavailable in most engines). So XHR in the upload lane is not legacy
  code kept around; it is the only API in the platform that can answer "how
  far". The optional `DELETE` does use `fetch`, because there is nothing to
  report on it.
- **`<progress>` is a progress bar**: a role, a value, a max, announced by
  assistive tech and rendered by the engine. A `div` with a width would have to
  reimplement all of that. **Without a value it is indeterminate**, which is
  exactly the state between "the last byte left the browser" and "the server
  answered" — no third element and no spinner needed.
- `xhr.abort()` cancels a transfer for real: the socket closes and the server
  stops receiving.
- A **hidden input** is how a value nobody typed travels in a form, which is
  what a handle is.

## Progressive enhancement

Without the module — and in the gap before its chunk arrives — this is a label,
a file input and its hints, with its `name` and `required` intact: the picker
works, the keyboard works, the form submits the files the ordinary way, and
dropping onto the control works too. That is the fallback in both lanes, which
is why the field is never hidden and why the upload lane only takes the field's
`name` once it is actually running.

The dashed zone and the drop invitation therefore appear only once the module
is listening (`data-fileupload-ready` on the root). This is the one component
here that keys its zone **positively** on the ready attribute instead of using
the `pre-enhancement()` mixin, and the reason is worth stating: the mixin
declares the enhanced resting position for the gap, under
`@media (scripting: enabled)` — which is right when the stylesheet can deliver
that state on its own. A drop zone it cannot: scripting being enabled is not
the same as the chunk arriving, and a box that invites a drop it cannot receive
hands the file to the browser, which opens it and takes the reader off a
half-filled form. So the zone is off by default and switched on by the
attribute — the same positive keying `dataTable` uses for its stacked layout.
Nothing is hidden by the default state, so nothing is lost if the chunk never
arrives.

The edge is *transparent* rather than absent until then, so the box does not
move by a pixel when the module takes over.

Where an engine cannot construct a `DataTransfer`, the default lane still
renders the list — names and sizes — but carries no remove controls, and no
drop zone is claimed. A control that cannot do what it says is worse than no
control. The size limits are unaffected: they are enforced by the field's own
validity, which needs no rewriting of the selection — which is the second
reason they mark a file rather than remove it. The upload lane has no such
restriction: its files go to an `XMLHttpRequest`, not back into the field.

## Accessibility
- **Dragging is never the only way in.** The native control is untouched and
  keeps the picker one Enter away (WCAG 2.5.7). The zone is an addition on top
  of a control that already worked.
- **The list is real content**, not a decoration: a `<ul role="list">` of rows,
  each with real `<button type="button">` controls named after their file by a
  visually-hidden text node rather than an `aria-label` — the name still reads
  when the stylesheet never arrives, and "Remove report.pdf" tells a
  screen-reader user which row they are on where three identical "Remove"s
  would not. The remove control is renamed with the state in the upload lane,
  because "cancel this transfer" and "remove this file" are two promises.
- **Focus is put somewhere deliberate whenever a press takes its own control
  away**: after a removal it goes to the row that moved into the freed place,
  or to the field itself once the last row is gone; after a **Retry** it goes
  to the control beside it, which at that moment reads "cancel this upload" —
  the row has stopped being failed, so its Retry button is hidden and would
  otherwise drop the keyboard reader onto `<body>`. Retry also says what it
  did, because the failure the status line was reporting is no longer the
  state of anything.
- **Whatever is wrong with a row is a word in it** — "too large" next to the
  size, "failed" where a transfer did. The red edge is the emphasis on that
  word and never the signal itself (WCAG 1.4.1), which is also why it survives
  a forced-colors context, where the row takes a dashed edge instead of a tone.
  Only those two states colour a row at all: a green edge per finished upload
  would have a settled list shouting about nothing, and a moving bar is already
  the loudest thing in its row.
- **Every bar is named by its own row's file name** through `aria-labelledby`,
  so "photo.jpg, 42 %" is what is announced rather than "progress bar" three
  times over. **The percentages are never announced**: a bar is a live-updating
  value, not an event, and a live region on it would talk over everything else.
- **One status line, visible, polite.** `role="status"` on the same node the
  sighted reader sees, so the spoken and the printed sentence cannot drift
  apart. It states what was removed, what was not accepted, what is over the
  limit, what was uploaded or failed and how many files are attached now; it is
  empty at rest, because "no file selected" is the resting state of every file
  field on the web. The node stays *rendered* while it is empty (an empty block
  box is 0 tall) rather than being collapsed with `display: none`: a live region
  has to be in the accessibility tree before its text arrives, or there is
  nothing registered for a change to be announced on.
- **The drag state is presentational only** — no ARIA, nothing claimed. It
  changes two things at once (the edge closes from dashed to solid *and*
  changes colour), so it does not rely on colour alone, and in a forced-colors
  context the edge takes the system `Highlight`.
- **The zone's border is a control boundary**, so it uses
  `--color-border-control` (3:1, WCAG 1.4.11) rather than the quiet
  `--color-border` the rows inside it use.
- **The list is what makes the box survive a reflow test, and that is not a
  side effect.** The native control puts its button and its own file-name text
  on one line, in a shadow tree no stylesheet can reach; at 200 % text in a
  320px box that line wants 639px against the 286px it has, so something has
  to give. The field is capped at `max-inline-size: 100%`, which clips the
  name rather than letting the control scroll the whole page sideways
  (WCAG 1.4.10) — and the name survives anyway, because the list states every
  file in full and wraps over as many lines as it takes. A tester who measures
  the field at 400 % zoom will see it truncated; the answer is one line below
  it. Nothing else recovers it: `overflow-x`, `overflow`, `text-overflow`,
  `field-sizing`, an outer scroller and no cap at all were each measured in
  Chromium and WebKit, and the control renders identically under all six.
- A dropped file **outside** any zone still lands on the browser, which opens
  it. Preventing that is a page-level decision, not a component's — the snippet
  shows the two-line document listener if you want it.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying
`data-js-behavior="fileUpload"`, and it needs an `input[type="file"]` inside
that element — the reporter warns and it bails on markup without one (which
leaves a plain, working file field behind). It writes no inline styles: the drag
state and the row states are attributes, and everything else it writes is either
the nodes it injected or the field's own `files`.

Internally the two lanes are two classes over one shared box (`UploadBox`,
`SelectionList`, `TransferQueue`), and which one runs is decided once, before
anything is constructed. Only two answers lead to a queue: an endpoint that is
there, and handles that have a name to travel under. An endpoint with no name
available — no `name` on the field and no `data-fileupload-name` on the root —
is reported and **falls back to the default lane** rather than leaving the box
dead: a queue whose handles cannot be submitted would post an empty request,
which is worse than a plain file field that works.

In the default lane, rewriting the selection dispatches a **bubbling `change`
event** on the field, because assigning `files` fires none — so a project's own
listener and `formValidation` on a required field hear a removal exactly as they
hear the picker.

`init()` returns a cleanup function, so a host that mounts and unmounts the
same markup (an SPA route change, a framework re-render — see
`destroyModulesInScope()` in `boot.js`) gets the box handed back as authored:
the `reset` listener on the form goes, the three injected nodes go — otherwise a
second `init()` would add a second list and a second status region — both root
attributes go with them, and the field's custom validity is cleared, since a
message left behind would block a form with a demand nobody can explain any
more. In the upload lane it also aborts every running transfer (the rows that
would have carried their handles are going, so finishing them would only leave
orphans) and puts the field's `name` and `required` back, so the form posts
files again the way it did before the module took over.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is
used for author mistakes (the module on an element with no file field in it, an
endpoint with no name for its handles) and for one runtime case that is also an
author's problem: an endpoint that answers non-2xx, or 2xx without a handle. A
plain network error is not reported — there is nothing in the code to fix.
Without a reporter the module degrades silently.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).

The examples in the **default lane** work off any static file server. The
**upload lane** needs a server that accepts a POST, which no static file server
does — without a transfer there is no progress to show. One ships with the
project:

```
npm run build
npm run demo:upload
http://127.0.0.1:8123/src/components/fileUpload/demo.html
```

`dev/uploadServer.js` serves the project statically and answers
`POST /dev/upload`. It counts the bytes and **throws them away** — nothing is
stored — and it reads them slowly on purpose, so the bars move at a realistic
pace instead of jumping to 100 %. `?fail=1`, `?slow=<ms>` and
`?processing=<ms>` let the demo ask for a specific outcome; the page uses all
three.
