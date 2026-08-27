# filterList

Filters a group of items that is already in the page — a card grid, a list of
people, a set of downloads — by what somebody types and by the facets they
tick. The module element is the **region** that holds both the controls and
the items; `data-filterlist-item` marks an item, `data-filterlist-query` the
field, `data-filterlist-facet` a select or a checkbox.

[`dataTable`](../dataTable/readme.md) does the neighbouring job and can only do
it for a `<table>`. This one asks nothing of the markup but "here is an item",
and it owns no vocabulary at all: the cards, the grid and the filter bar are
your own CSS. What it ships is the half a hand-written filter usually does not
have — the count in words, the empty state, the way back, and a `hidden` that
actually hides.

## Files needed to copy
- `filterList.html` – markup
- `filterList.scss` – styles (source; compiled to `dist/css/filterList.min.css`)
- `filterList.js` – behavior

Seven utilities from `_shared/js/` ride along: `foldText.js` (lowercases and
strips combining marks, so `zurich` finds `Zürich`), `rafThrottle.js` (one
re-index per frame when the list changes), `debounce.js` (the announcement
waits for typing to settle), `resolveLocale.js` and `formatTemplate.js` (the
built-in wording and its `{shown}` / `{total}` tokens), `uniqueId.js` (an id
for the live region) and `describedBy.js` (links it to the field without
trampling your own hint).

The stylesheet is **two rules**, and neither is a look: the
`display: none !important` that keeps `hidden` hiding, and the visually-hidden
recipe for the live region the module injects. It is small, and it is not
optional — see *Keep the stylesheet* below.

## Usage

```html
<section data-js-behavior="filterList">

  <search data-filterlist-controls hidden>
    <label for="teamQuery">Search the team</label>
    <input id="teamQuery" type="search" autocomplete="off" data-filterlist-query>

    <p aria-hidden="true" data-filterlist-count></p>
  </search>

  <ul role="list">
    <li data-filterlist-item>Amelie Roth — interface design</li>
    <li data-filterlist-item>Jonas Weber — accessibility</li>
  </ul>

  <p hidden data-filterlist-empty>Nobody here matches that.</p>
</section>
```

**The controls ship `hidden` and the module removes it.** Keep the attribute.
Nothing in HTML or CSS filters a list — no element, no attribute, no selector
asks whether an element's text contains a string somebody is still typing — so
a filter bar without a script is a bar that does nothing. This is `video`'s
approach and [`copyToClipboard`](../copyToClipboard/readme.md)'s rather than a
CSS pre-enhancement block: no ready attribute, no media query, and a chunk that
never arrives leaves the page exactly as authored. What is left in that case is
the complete list, which is what the reader came for — that is what makes
hiding the bar allowed at all.

The same attribute covers every case in which the module gives up: a region
with no `data-filterlist-item` in it, and a region with neither a query field
nor a facet control. **The bar appears when it filters and not before**, and
the reporter says why in the console.

**The bar arrives after the first paint, so reserve its place where the shift
would be felt.** The module is a lazily imported chunk — which is what makes
"hidden until it works" possible at all — so the row it sits in moves once,
when it appears. Nothing can be done about that from here: reserving the space
would mean shipping a look. Where it matters, that is one line of your own CSS
— a `min-block-size` on the bar's container, or the bar laid over the top of
the list.

`<search>` rather than a `<form>` in the example above is deliberate: there is
no submission to prevent and no `action` to point anywhere. Where the field
*does* sit in a form — because you have a real server-side fallback — the
module prevents the implicit submission on Enter once it is running, and it
prevents the reset press from submitting too, since filtering is already
instant and a round trip would only throw the result away. A submit **button**
of your own inside the controls is the one thing left that still submits: give
it `type="button"` where it is only there for the fallback, or leave it out.

### What gets searched

The item's **own visible text**, whitespace collapsed. Where that is too much —
a card whose body copy matches every query — put the text to search in
`data-filterlist-text` on the item instead. It **replaces** the item's own
text, so it is also where keywords that are not on screen belong (a synonym,
a former product name, an SKU). A CMS template is the natural place to emit
it.

**Accents do not have to be typed.** `zurich` finds `Zürich` and `cafe` finds
`Café`, because both sides of the test are folded (NFD, combining marks
stripped, lowercased — `foldText.js`). A **transliteration** is a different
thing and is not covered: `muenchen` does not find `München`, and no amount of
folding turns one into the other. Where you need it, `data-filterlist-text` is
the place to put both spellings.

**A query is split on whitespace and every term has to be found**, in any
order: `red chair` and `chair red` are the same query. Matching is a substring
by default, so `art` finds `Stuttgart`; `data-filterlist-match="word"` narrows
it to the **start of a word**, which is the useful half of a word-boundary
rule — a reader types the beginning of a word, not the end of one. Words end
at anything that is neither a letter nor a number, so a hyphen, a slash and a
comma all count.

### Facets

A facet control carries `data-filterlist-facet="<group>"` and its **value** is
a token, matched against the item's `data-filterlist-tags` (a space-separated
list, folded the same way as the query so the accents are optional there too).

```html
<select id="peopleTeam" name="team" data-filterlist-facet="team">
  <option value="">Any team</option>
  <option value="design">Design</option>
</select>

<article data-filterlist-tags="design berlin" data-filterlist-item> … </article>
```

**OR inside a group, AND across groups** — what every faceted filter on the web
does, and what a reader means when they tick two colours and one size: either
colour, in that size. The group is named by the attribute's value; leave it
empty and the control's `name` names it (which a checkbox group already
shares), and with neither the control stands alone in a group of its own.

A **value of `""`** contributes no token, which is what makes an `<option
value="">Any team</option>` the neutral state — and it is what the reset
button puts a select **and a radio group** back to. Ship one in a radio group
and the reset has somewhere to put it: without it the group ends up with
nothing checked at all, which is a state nobody can click their way back into.
Only `<select>`, `checkbox` and `radio` are read; a text field carrying the
attribute is reported and ignored, because its raw content as a single token
would match nothing.

### The reset

`data-filterlist-reset` on a `<button>` clears the query and every facet in
one press. The module keeps it **`disabled` while there is nothing to
clear** — `disabled` rather than a class, because it is the platform's own way
of saying so and every assistive technology already announces it.

It has to be something a reader can **press** and the platform can
**disable**: a `<button>`, or an `<input>` of type `button`, `reset` or
`submit`. Anything else is reported and ignored — an `<a>` would take the
state silently and go on offering a reset that is not there, and a text field
carrying the attribute can be disabled without ever being something anybody
presses.

**The press submits nothing.** `event.preventDefault()` is called on it, for
the reason Enter in the field is swallowed: a `<button>` with no `type` is a
submit button, the bar may well sit in a form as a server-side fallback, and
once the module runs a round trip would only throw away the result the page
already has. It also keeps an `<input type="reset">` from resetting the form
behind the module's back — a native form reset writes the controls without
firing `input`, so the painted result and the controls would disagree until
the next keystroke.

A `<select>` and a radio group go back to their own **empty-value option** —
the "any" state — rather than to nothing at all; see *Facets* above.

**It moves the focus to the query field, and it is the only thing here that
moves the focus.** That is not a convenience: the same pass disables the
button, and an element disabled while it *has* the focus hands the focus to
`<body>` — so a reader who pressed "clear" with the keyboard would be put back
at the top of the document (WCAG 2.4.3), which is the one place they were not.
The move happens only where the focus really was on a reset control, since a
click does not focus a button in every engine and taking the focus off
something else would be the same fault in the other direction.

To hide it instead of disabling it, key off the state attribute — it sits on
the region, so the rule is one descendant selector:

```css
[data-filterlist-reset]                         { visibility: hidden; }
[data-filterlist-state] [data-filterlist-reset] { visibility: visible; }
```

### Configuration (attributes on the region)
- `data-filterlist-match` – `"any"` (default) or `"word"`: where a term may
  match. An unknown value is reported and treated as `"any"`.
- `data-filterlist-count-text` – the **visible** count template. Tokens
  `{shown}` `{total}`. Default: the built-in short form for `<html lang>`
  (`3 of 12`).
- `data-filterlist-status-text` – the **spoken** counting sentence, same
  tokens. Default: the built-in sentence for `<html lang>` (`de`, `en`,
  falling back to `en`), which has its own singular. An **empty** value opts
  it out.
- `data-filterlist-none-text` – the same for the nothing-found sentence,
  except for the default: that is **`[data-filterlist-empty]`'s own text**
  where you wrote one, and the built-in sentence only where you did not. With
  **both** this and `data-filterlist-status-text` empty the module builds no
  live region at all and says so in the console; see *Accessibility*.

### Styling

The module writes **one** attribute on the region:

```css
[data-filterlist-state="filtered"] .cardGrid { … }
[data-filterlist-state="empty"]    .cardGrid { … }   /* collapse it */
[data-filterlist-state]            [data-filterlist-reset] { … }
```

Its **absence** means the whole list is showing, which is the state most
projects have nothing to say about — so there is no third value to write rules
against. Everything else is the platform's own vocabulary: `hidden` on the
items that are out and on `[data-filterlist-empty]` while something matches,
`disabled` on the reset.

**The module owns those attributes** on those elements. Do not author them for
another purpose there and do not write them from your own script — the next
pass overwrites them.

**An item leaving is not animated, and cannot be from here.** `display: none`
has no transition to run, and the rule that hides it is `!important` on top of
that. This is deliberate rather than a limitation accepted: a filter re-runs on
every keystroke, so an item fading out is an item that may have to come
straight back, and half a card mid-fade is worse than an honest jump. Where you
want motion, animate the **container's** height, or the items' arrival
([`revealOnScroll`](../revealOnScroll/readme.md) is next door) — not their
removal.

**Do not treat the state as the whole story.** Whatever a rule draws, the
module has also said in words. A grid that quietly gets shorter is precisely
the half of a filter that leaves a screen-reader user with no result, and it is
the half this component exists for.

The controls' own `:focus-visible` rings are yours too, like the rest of their
look. `demo.html` shows one fully worked design around all of it.

### Keep the stylesheet

Two of its three selectors are not a look but the component working. `hidden`
is a UA rule at specificity (0,0,0), so the first `.card { display: flex }` you
write puts every filtered-out card back on screen — and giving a card a
`display` is the first thing anybody does to one. The component therefore ships

```scss
[data-filterlist-item][hidden],
[data-filterlist-empty][hidden],
[data-filterlist-controls][hidden] { display: none !important; }
```

Note the difference to `copyToClipboard`'s version of the same rule: there it
is a pre-enhancement guard that stops applying once `init()` removes `hidden`,
here two of the three are **permanent machinery**. The module writes and
removes `hidden` on the items and on the empty message for as long as it runs,
so commenting the rule out does not restore a look — it stops the component
filtering anything.

## Accessibility
- **A polite live region**, inserted into the region and filled with the count.
  This is the component's reason to exist: a grid that gets shorter is a change
  nobody who cannot see it is told about (WCAG 4.1.3). It is polite rather than
  assertive — the reader is typing and is waiting for exactly this number a
  moment later.
- **It goes after the controls and before the items**, which is where a sighted
  reader finds the count. A live region is announced from wherever it sits, so
  this is about the other reader: somebody going through the page linearly is
  not being announced at, they *arrive*, and at the end of the region they
  would arrive at the count after the whole list. The anchor is
  `[data-filterlist-controls]` where there is one, otherwise the outermost
  element of the region that holds the last control — and it goes *after* the
  wrapper rather than inside it, because the wrapper is still `hidden` at that
  moment and a live region in a hidden subtree announces nothing.
- **The announcement is debounced** (500 ms after typing stops), while the
  items move instantly. Without that, a screen reader recites a count per
  keystroke.
- **The region is also the field's description** (`aria-describedby`, your own
  ids preserved), so the current count is read when the field takes focus and
  not only when it changes.
- **The region is built complete and only then inserted.** A live region
  inserted empty and filled a moment later announces its first sentence at a
  reader who has not touched anything — and this module arrives after the first
  paint, so that moment is real. Arriving with its content in place makes the
  initial count a description instead of an interruption.
- **Every announcement is a new node** in that region. Assigning the same text
  to the same node is not a mutation, so a second `No entries found.` would be
  silent — and two different queries both finding nothing is exactly the case
  that has to be announced twice.
- **Filtered-out items get `hidden`**, so they leave the accessibility tree
  along with the layout. A rule that only dimmed them would leave a screen
  reader reading the items the filter excluded.
- **Do not put `aria-live` on the item container.** Twelve cards leaving at
  once is not a message, and the region has already said what happened.
- **`[data-filterlist-count]` is left exactly as authored.** It is your
  element: the module writes text into it and nothing else. Mark it
  `aria-hidden="true"` where you would rather the number were only in the live
  region — static text in the page is readable with a virtual cursor either
  way, which is a feature rather than a duplicate announcement.
- **Nothing found is announced in your own words.**
  `[data-filterlist-empty]`'s text is the spoken sentence where you wrote one,
  ahead of the built-in wording and behind `data-filterlist-none-text`. It is
  what a sighted reader is looking at in that state and usually the only place
  the way out is written down — so write it there ("press *Clear* to start
  again") and it reaches everybody. One wording, two channels, nothing to keep
  in sync.
- **Filtering never moves the focus.** A reader typing stays in the field; a
  reader who ticked a facet stays on the facet. There are two exceptions and
  both are the same fault avoided: the **reset** (see *The reset* above), and
  an item that goes out while the focus is **inside** it. The second one can
  only happen when the pass was not started from a control — a later render
  changes an item's text and the observer re-runs the filter — and `hidden`
  on an element holding the focus would hand it to `<body>`, i.e. put the
  reader at the top of the document (WCAG 2.4.3). The focus goes to the query
  field instead. A pass on load never moves it at all.
- **Opting both sentences out is a promise.**
  `data-filterlist-status-text=""` plus `data-filterlist-none-text=""` builds
  no region, which is a real configuration: something else — a toast, a
  router announcing a route change — is saying it instead. That something
  else is then **required**, not recommended. Without it the list silently
  gets shorter and nobody who cannot see it is told, which is the one way
  this component can be wired up correctly and still fail WCAG 4.1.3. The
  module says so in the console every time.
- **The built-in wording says which language it is in** where that is not the
  page's, so a screen reader does not read `No entries found.` in a French
  voice (WCAG 3.1.2). Your own wording is in the page's language by definition
  and is left alone.
- **Naming the field is yours**, with a real `<label>` — and a `<fieldset>` /
  `<legend>` around a checkbox group, which is what names the facet.

## Working with other components

- **[`loadFragment`](../loadFragment/readme.md)** — items that arrive after
  `init()` are picked up on their own. A `MutationObserver` watches the region
  for children, so an appended batch is re-indexed and filtered as it stands,
  with nothing to re-initialise. (`childList` only: the module's own work on
  the items is `hidden`, an attribute, which the observer never sees.)
- **[`dataTable`](../dataTable/readme.md)** — the neighbour, not a competitor:
  it sorts and it needs a `<table>`. Rows can be `data-filterlist-item` too,
  but the two write to the same rows, so give the table's own scroll box a
  region of its own if you combine them.
- **A URL, a history entry, a request** — none of those are here, on purpose.
  Listen for the module's own event instead: `filterlist:changed` bubbles off
  the region on every pass.

  ```js
  document.addEventListener('filterlist:changed', (event) => {
    const { shown, total, query, facets } = event.detail;
    console.log(`${shown}/${total}`, query, facets);
  });
  ```

  It fires on the pass, not on the debounce, so what you get is the result you
  can act on. `facets` holds the **named** groups only — a lone control with
  neither a group name nor a `name` is keyed by its element, which has no place
  in an event detail.

## Integration
The JS exports `init(el, services)` and is boot-loaded per
`data-js-behavior="filterList"` — you never import `filterList.js` yourself. It
sets **no inline styles**: what it writes for the project to react to is
`data-filterlist-state`, plus `hidden` and `disabled`, which are the
platform's. The one thing it does beyond writing is move the focus, on the
reset press and nowhere else.
`services.reporter` is optional and used only for warnings (no items, no
controls, an unusable facet or reset, an unknown match mode, both announcements
opted out). `init` returns a cleanup function, so a host that mounts and
unmounts the same subtree can call `destroyModulesInScope()` — it disconnects
the observer, removes the injected region and its `aria-describedby` link,
shows every item again, re-hides the empty message and the controls and drops
the state attribute. The controls go back under `hidden` on purpose: without
the module they are again a bar that does nothing.

## Demo
Open `demo.html` in the browser (requires a prior `gulp build`).
