# toast

Transient messages in a stack over the page — announced to assistive technology through a live region the messages themselves are not part of.

## Files needed to copy
- `toast.html` – markup
- `toast.scss` – styles (source; compiled to `dist/css/toast.min.css`)
- `toast.js` – behavior

- `_shared/js/focusableSelector.js` – utility imported by the behavior (copy it
  alongside `toast.js`); it is what tells a message that holds a control of its
  own, which is a message that never expires.

## Usage

One stack per page, authored:

```html
<section class="m-toast" aria-label="Notifications" data-js-behavior="toast"></section>
```

**A named `<section>` is the recommended root**, because with an `aria-label` it is a region landmark — and landmark navigation is the one mode that reaches the stack *from anywhere*. That matters: a message may hold a control (an "Undo"), and the tab order cannot help much, because wherever the stack sits in the document it is either behind the whole page or before it. Reaching a toast is the part no component can solve from the inside; what it can do is be reachable, never expire while it holds a control, and say plainly that **a toast must not be the only way to perform an action**.

An `<ol role="list">` works too — the module then writes `<li>` items instead of `<div>` ones, because an `<li>` outside a list is invalid markup — and gives the reader a count instead of a landmark. It is the lesser trade: content that sits outside every landmark is content a screen-reader user has no way to jump to (it is also what axe-core's `region` rule reports). On a page with several stacks, give each its own name; two identically named landmarks are worse than one.

Where it goes in the document changes nothing visually — the stylesheet fixes it to a corner of the viewport — so early in `<body>`, right after the skip link, is the tidiest place for it.

### Three ways a message gets there

**In the markup**, for something the server already knows: the flash message after a redirect, "your order is on its way".

```html
<section class="m-toast" aria-label="Notifications" data-js-behavior="toast">
  <div data-toast-item data-toast-variant="success">
    <p data-toast-body>Your changes have been saved.</p>
  </div>
</section>
```

That message is on screen at the first paint, script or no script. What the module adds to it is a dismiss control and the timer.

**From a control**, with no project script at all:

```html
<button type="button" data-toast-trigger data-toast-message="Link copied"
        data-toast-variant="success">Copy link</button>
```

The press is never taken: the control is doing its own job (copying, submitting, deleting) and the message is the feedback, not the action. Modified and non-primary presses are ignored for the same reason.

**From your own code**, without importing anything:

```js
document.dispatchEvent(new CustomEvent('toast:show', {
  detail: { message: 'Could not save your changes', variant: 'error' },
}));

// shorthand — a string detail is the message
document.dispatchEvent(new CustomEvent('toast:show', { detail: 'Saved' }));
```

The event may be dispatched on `document` or on the stack itself, bubbling or not; the module listens in both places and ignores the duplicate when one event reaches both.

There is deliberately **no imported `show()` function**: `boot.js` owns the module's lifetime, the project never imports `toast.js` (see [Integration](#integration)), and an event needs no reference to anything. The trade is that an event fired *before* the chunk has loaded is lost — so fire messages from an interaction (always after load) and put a message you already have at page load into the markup, where it also survives the chunk never arriving. `<link rel="modulepreload" href="/dist/js/modules/toast.min.js">` shortens the window where it matters.

### Options

On the stack, all optional:

| Attribute | What it does |
| --- | --- |
| `data-toast-duration` | Milliseconds a message stays; `0` keeps it until it is dismissed (default `6000`). |
| `data-toast-max` | How many messages may be on screen at once; past it the oldest leaves (default `3`). |
| `data-toast-politeness` | `polite` or `assertive` for every message but an error, which is assertive either way (default `polite`). |

### Localization
The two strings this module generates follow `<html lang>` (German and English,
falling back to English) — the same mechanism `countdown`, `inputCharCount`,
`video` and `formValidation` use, so one `lang` attribute settles every
component on the page:

- the name of the injected dismiss control, and
- the word the announcement is prefixed with per kind of message — `Fehler:
  konnte nicht gespeichert werden`. `info` is deliberately empty: *"Info: your
  session ends in 5 minutes"* adds a word and no information, while the other
  three change what the sentence means.

They live in the `labels` map in `toast.js`; adding a language means adding a
block of strings. There are no per-variant label attributes — the strings
belong to markup this module writes, so there is nothing for a project to write
them into.

On one message — authored, or written by the module:

| Attribute | What it does |
| --- | --- |
| `data-toast-item` | **Required.** Marks the message. |
| `data-toast-body` | The content element inside it. |
| `data-toast-variant` | `info` (default), `success`, `warning`, `error`. |
| `data-toast-duration` | As above, for this message only. |
| `data-toast-politeness` | As above, for this message only. |

On a control that shows a message:

| Attribute | What it does |
| --- | --- |
| `data-toast-trigger` | **Required.** Marks the control. Its value names the stack by `id`; left empty it means the page's only stack. |
| `data-toast-message` | The text to show. |
| `data-toast-template` | `id` of a `<template>` whose content becomes the message. |
| `data-toast-variant`, `data-toast-duration`, `data-toast-politeness` | As above. |

The same keys are the event's `detail`, plus `target` for the stack's id.

### A message that needs more than text

`data-toast-template` (or `detail.template`) points at a `<template>`; its content is cloned into the message.

```html
<template id="toast-undo">
  <p>Draft deleted.</p>
  <button type="button" data-undo>Undo</button>
</template>
```

A template rather than a string of HTML, because a message is **data** — it comes from a form, a server, a filename — and parsing data as markup is how a notification becomes an injection. The control inside is the project's: wire it up in your own code, for instance with one delegated listener on the stack.

Such a message **never auto-dismisses**, whatever the attributes say — see below.

## The announcement is not the toast

The stack is not a live region. The module builds **two** visually hidden regions at `init()`, inserts them after the stack and announces a *copy* of each message's text in the one matching its politeness. Three reasons, and each is a way the obvious version fails:

- **A live region reads out everything in it**, including the accessible name of every control. A dismissable message that was itself announced would come through as "Saved, Dismiss, button", and an "Undo" toast would be worse. Announcing a copy leaves the stack as plain content: reachable, operable, read once.
- **`aria-live` is a property of the region, not of the message.** "Could not save your changes" should interrupt; "Saved" should wait its turn. One region can only ever be one of the two — hence one polite and one assertive, with `error` going to the assertive one by default and `data-toast-politeness` overriding either way.
- **A live region that is inserted and filled in one go is announced by nobody** — an engine reports that as "a new region appeared", i.e. as nothing. So both regions are in the document from `init()` on, long before the first message.

Two details follow from it. The announcement is a **new node per message** rather than one node whose text is replaced, because replacing text with the same text is not a change and would not be announced — the second "Could not save" would be silent. And it is taken from the message **before** the dismiss control is injected, which is what keeps that control's name out of the sentence.

The sentence itself is the kind of message and then its text: `Error: could not save your changes`. In the stack the kind is a colour and an icon, and neither of those is text; the prefix is what a screen-reader user gets instead. It is configurable per variant, and `info` has none by default because "Info: your session ends in 5 minutes" adds a word and no information.

A message the author wrote into the markup is **not** announced: it is part of the page at the first paint, and it is read where it stands like any other content.

## Auto-dismissal is a time limit

It is [WCAG 2.2.1](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html), and the component treats it as one rather than as a duration setting:

- **It pauses** while the pointer is over the stack, while the focus is inside it, and while the tab is in the background — and resumes with the time that was **left**, not from the start. A reader who moved the pointer across the stack is not handed the whole duration again; one who read half a message does not lose the other half.
- **It can be switched off** with `data-toast-duration="0"`, on one message or on the stack for all of them.
- **A message holding a control of its own never gets a timer at all**, whatever the attributes say. A countdown running against a reader who is trying to reach that control is the one thing a toast must not be, so an explicit `data-toast-duration` on such a message is reported through the reporter and ignored. (A duration inherited from the stack is not reported: that one is a default for messages in general, not a statement about this one.) The check is "does the message contain anything focusable", made *before* the dismiss control is injected — so the way out this module adds does not count as a reason to keep the message forever.

## Accessibility

- **The focus is never moved to a message.** A passive notification that steals the caret interrupts far more than it reports.
- **It is moved when a message that had the focus leaves**: to the next message in the stack (the reader is working through them), otherwise back to wherever the focus came from — remembered from the `focusin` that brought it into the stack, because by `focusout` the way back is already gone. A node removed from under the focus drops it to `<body>`, and the reader's next `Tab` would start over at the top of the page.
- **"Back where it came from" needs somewhere to come from.** The return target is remembered from the `focusin` that brought the focus into the stack, so it is the trigger for a keyboard user (who still has it) but nothing at all in WebKit after a *mouse* press, which follows the macOS convention of not focusing a clicked button. Then there is genuinely nothing to restore and the focus stays where the removal left it. Unlike `dialog` and `lightbox`, this component does **not** force the focus onto a clicked trigger to paper over that: those two are about to hand the focus to an overlay, while a toast may never be focused at all — and a focus ring drawn on every mouse press of every trigger is the worse trade.
- **Getting *to* a message** is the part no component can fix from the inside: wherever the stack sits in the document, the tab order puts it behind the whole page or before it. The three answers are the landmark root (see [Usage](#usage)), the rule that a message holding a control never expires, and the rule for the project — a toast must not be the only way to perform an action.
- **`Escape` dismisses the message the focus is in**, and the press is taken so it cannot also close a dialog the stack happens to sit in.
- **The dismiss control is injected, not authored.** A button that does nothing until the chunk arrives is not markup worth shipping — this is `video`'s trick in reverse. It is named by a real text node next to an `aria-hidden` glyph, so it still reads if this component's stylesheet never arrives, and `init()`'s cleanup function takes it off the page again.
- **The variant is never the only carrier of meaning.** Each of the four is a distinct icon *shape* as well as a colour (WCAG 1.4.1), and the kind of message is in the announcement as a word. Say in the text what the message means: the colour and the icon are decoration.
- **The message text is the ordinary text colour in every variant.** That is deliberate: the accent then only ever carries a border and an icon, i.e. the 3:1 of WCAG 1.4.11, and never the 4.5:1 of body text — which is what lets all four variants use a colour that is recognisably theirs.
- **In a forced-colors context** (the Windows contrast themes) the four accents collapse into one system colour. The icon shapes are what keep the kinds apart there, and the pseudo-element's `background-color` is repainted in `CanvasText` so the masked glyph does not end up the colour of the surface it sits on.
- **The dismiss control is a 32px target**, past the 24px minimum of WCAG 2.5.8, and it is the only target in a message, so nothing is crowding it.

## Where the stack can and cannot appear

The stack is `position: fixed` at `--toast-z-index` (`--zi-overlay`). A modal `<dialog>` is painted in the **top layer**, which is above every fixed element on the page whatever its `z-index` — so a stack outside the dialog cannot appear over it.

The answer is a second stack **inside** the dialog: a fixed element that is a descendant of a top-layer element is painted with it. Give both stacks an `id` and name the one you mean:

```html
<button data-toast-trigger="toast-dialog" data-toast-message="Saved">Save</button>
```

```js
document.dispatchEvent(new CustomEvent('toast:show', {
  detail: { target: 'toast-dialog', message: 'Saved' },
}));
```

With exactly one stack on the page no `id` is needed anywhere — the empty value means "the page's only stack". A request that names no stack while several exist is **dropped and reported** rather than guessed at: a message shown in the wrong place is a message the reader never sees.

## Styling

Placement is four custom properties, and the three modifiers are nothing but presets of them:

| Modifier | Where the stack goes |
| --- | --- |
| *(none)* | Bottom inline-end corner; messages slide up out of the edge. |
| `m-toast--blockStart` | Top instead of bottom — the anchor flips and the direction a message travels flips with it. |
| `m-toast--inlineStart` | The other inline edge. |
| `m-toast--inlineCenter` | Centred on the inline axis. |

Everything else goes through the `--toast-*` properties declared on `.m-toast`: the measure (`--toast-max-inline-size`), the spacing, the type, the accent colours (`--toast-accent-color`, overridden per variant), the timings and `--toast-shift-distance` for how far a message travels.

Entrance and exit are a pure CSS enhancement: `@starting-style` gives a freshly inserted message somewhere to come from, the `data-toast-state="leaving"` rule somewhere to go, and an engine without `@starting-style` simply shows the message. They are timed **separately** for the reason `dialog` and `lightbox` spell out — the shared `--an-ease` is an ease-*out*, which an entrance wants and an exit turns into a snap — which needs two rules, because a transition always runs with the timing declared in the state it animates *to*.

**The script does not know how long any of that takes.** It sets the leaving state and then asks the element which animations are actually running on it (`getAnimations()`), removing the node when they have finished. So there is no duration duplicated in the JS to keep in step with this file, and a stylesheet that animates nothing — `prefers-reduced-motion`, or this component's CSS missing altogether — resolves to an empty list and the message goes at once.

The icons come from the stylesheet as `mask-image` data URIs, not from the script — unlike `lightbox`'s control glyphs. A message the author wrote into the markup is on screen before the module arrives, and it should not be the one message without its icon. A mask rather than a background image because a mask takes its colour from the element, which is what lets one shape follow the variant's accent and be repainted in a system colour when that accent is forced away.

The stack is `pointer-events: none` and the messages take theirs back: it covers a strip of the page whether or not it holds anything, and it must not swallow the presses meant for what is underneath — the gaps between messages, and the whole box while it is empty. A leaving message drops back to `none` at once, so a control fading away under a pointer already moving towards it cannot be pressed.

`@media print` drops the stack: it is fixed to the viewport, so on paper it would print over the content, and a message about something that just happened on screen means nothing on a page that outlives it.

Every part of a message is addressed by a `data-toast-*` attribute rather than by an `m-toast__*` class, because a message is authored **or** generated and the two have to look identical — a class would mean the script writing style names it does not own (the same reason `dropdownNav` styles its injected toggles through `[data-dropdownnav-toggle]`). The stack keeps its class: it is the override surface and the only thing a project positions.

See `toast.html` for a ready-to-copy snippet.

## Progressive enhancement

The component ships **no pre-enhancement state** (see [`docs/preEnhancement.md`](../../../docs/preEnhancement.md)): nothing is hidden behind a control the script has to deliver first. A message in the markup renders the same before and after the module arrives and simply keeps standing without it, which is a static notice rather than a broken widget; the stack is empty until something asks for a message; and the one control the component owns is injected rather than authored, so it cannot exist before it works.

What *does* need the module is a message fired from code — see the note under [Three ways a message gets there](#three-ways-a-message-gets-there).

## Integration

The JS exports `init(el, services)` and does not self-initialize. It is loaded on demand by `boot.js` for every element carrying `data-js-behavior="toast"` — one instance per stack. (Unlike a global notification system, nothing runs on pages that have no stack.)

`services.reporter` (dependency injection via `boot.js`) is **optional** — it is only used for warnings (a request with nothing to say, a `<template>` that is not on the page, an unknown variant/duration/politeness value, a duration on a message that holds a control, a request that cannot tell two stacks apart). Without it the module degrades silently.

`init()` returns a cleanup function that removes the delegated `document` listeners and the `visibilitychange` listener, clears every pending timer (one that fired afterwards would reach into a detached tree), removes the two injected live regions — they sit next to the root, so they do not go with its subtree — and takes the injected dismiss controls off the authored messages again. The loader only needs this for a host that mounts/unmounts the same markup repeatedly instead of a full page (re)load — see `destroyModulesInScope()` in `boot.js`.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
