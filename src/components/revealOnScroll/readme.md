# revealOnScroll

Reveals elements as they enter the viewport: `IntersectionObserver`s mark the
items that are still waiting, and CSS animates them into place. The module
element is the **container**; the items inside it are marked with
`data-reveal-item`, and while an item is waiting it carries
`data-reveal-pending` — the single styling hook.

This solves what pure CSS cannot: there is no selector for "this element is on
screen now". A scroll-driven animation (`animation-timeline: view()`) is the
lower rung and the better tool where it fits, but it answers a different
question — it is *scrubbed*, so it runs backwards as the reader scrolls back
and never settles into "revealed, done" — and it is not available in every
engine this collection targets.

The component's one rule about *what* it hides: **only what the reader cannot
see**, and the browser is what decides that. Two observers watch every item —
one whose edge is the trigger line, and one without any offset that is the only
thing allowed to mark an item. So nothing ever blinks out of the page, and a
chunk that never arrives cannot hide anything at all.

## Files needed to copy
- `revealOnScroll.html` – markup
- `revealOnScroll.scss` – styles (source; compiled to `dist/css/revealOnScroll.min.css`)
- `revealOnScroll.js` – behavior
- `_shared/js/parseNonNegative.js`, `_shared/js/debounce.js` – utilities
  imported by the behavior (copy alongside it)

## Usage
Put `data-js-behavior="revealOnScroll"` on the container and
`data-reveal-item` on every element inside it that should be revealed. That is
all: the script marks the items the reader cannot see with
`data-reveal-pending` and removes the attribute again when an item crosses the
trigger line. That
attribute name is fixed — the shipped SCSS keys its waiting look off it, so
there is nothing to gain from renaming it; restyle the rules instead.

A container that has **no** marked item inside it *is* the item, so a single
card, figure or section needs nothing but `data-js-behavior`. Where the items
cannot carry an attribute of their own — CMS output, a generated list —
`data-reveal-items` names them with a selector instead, resolved inside the
container: `data-reveal-items=":scope > li"`. A selector that matches nothing
is reported as the typo it usually is rather than falling back to the
single-element lane.

Items are revealed **once** by default: each one is unobserved as it arrives
and both observers are dropped with the last of them. `data-reveal-repeat` keeps
them running and puts an item back into its waiting state once it has left the
view, so the reveal replays. Left the *view* — not merely crossed back over the
trigger line: an item resting below that line is still in plain sight, and it is
never taken away.

`data-reveal-stagger="90"` releases the items that come in together 90ms apart,
in document order, which turns a grid of cards into a sequence.
`data-reveal-offset="200"` moves the trigger line 200px above the bottom edge,
so a tall element is revealed once it has really come in rather than when its
first pixel appears.

**There is no root option, and items inside a scroll box need nothing extra.**
An `IntersectionObserver` on the default root intersects a target with the clip
box of every ancestor on the way up, so an item scrolled out of an
`overflow: auto` box is reported as gone without the box being named anywhere.
That is the difference to `stickyObserver` and `scrollSpy`, which do take a root:
they need the box an element is pinned or measured against, while a reveal is
about what the reader can see. A container root would in fact be worse here — it
would reveal the items in a box the reader has not scrolled to yet.

The shipped stylesheet provides `c-reveal` as a convenience look: a fade plus a
32px rise, with `c-reveal--fade` (no movement at all),
`c-reveal--left` / `--right` (sideways) and `c-reveal--zoom` as directions.
Each modifier sets exactly one custom property, so a direction they do not
cover is one declaration on the item. `data-reveal-pending` is a styling hook —
override or replace those rules, or key your own component's waiting look off
the attribute and load nothing from here at all. The script does not read
`c-reveal`.

Two things to know about that class: it carries a `transition` for `opacity`,
`translate` and `scale`, so an item that also animates one of those on hover
should state its own transition for it; and a sideways reveal starts outside
the item's own box, which can widen a non-clipping ancestor's scroll area —
give that ancestor `overflow-x: clip`. The second one is **required**, not
cosmetic: left out, a narrow viewport gets a horizontal scrollbar on a page
that should only scroll one way (WCAG 1.4.10), and the reveal is what caused
it. The vertical default cannot do this — a page may scroll that way.

### Configuration (optional, attributes on the container)
- `data-reveal-items` – CSS selector for the items, resolved inside the
  container (start it with `:scope` for a child selector). Default:
  `[data-reveal-item]` — and a container with no marked item is the single
  item itself.
- `data-reveal-offset` – px the trigger line sits above the bottom edge of the
  viewport. Has to stay below the viewport height: a line above the top edge of
  the screen could never be crossed, so such a value is reported and dropped to
  `0` rather than leaving the items hidden. That verdict is re-checked on every
  (debounced) resize, because it belongs to the viewport and not to the markup —
  see *Integration*. Default: `0`.
- `data-reveal-stagger` – ms between two items revealed together, in document
  order. Skipped under `prefers-reduced-motion`. Default: `0`.
- `data-reveal-repeat` – presence only: an item that has left the view waits
  again. Default: revealed once and done.
- `--reveal-distance`, `--reveal-translate`, `--reveal-scale`,
  `--reveal-duration`, `--reveal-ease`, `--reveal-delay` (CSS custom
  properties) – tune the shipped look. Set them in your CSS or inline:
  `style="--reveal-distance: 64px"`. `--reveal-delay` is the CSS side of the
  stagger, for a fixed order that does not depend on when an item arrives
  (`.c-reveal:nth-child(2) { --reveal-delay: 80ms; }`).

See `revealOnScroll.html` for a ready-to-copy snippet.

## Accessibility
**Nothing is hidden from assistive technology.** A waiting item is transparent,
not `hidden` or `display: none`: it keeps its box, its text and its place in
the accessibility tree, so a screen reader, find-in-page and reading mode see
the whole document at all times, whatever the scroll position is. The module
adds no ARIA, no roles and no live regions; keep the styling keyed on
`data-reveal-pending` decorative.

Four consequences are handled rather than left to the reader:

- **Keyboard focus reveals its item immediately.** A focus jump scrolls an item
  into view, but the observer only reports that one task later — so focus would
  land inside a transparent box for a moment. The module reveals the item on
  `focusin` instead, and in the repeat lane it never hides an item that
  contains the focus. *Immediately* includes the animation: `.c-reveal` drops
  its `transition` while the focus is inside (`:focus-within`), so the item
  stands at full contrast before the focus ring is drawn on it. Without that,
  taking the attribute off would only start a one-second fade, and the ring
  would be drawn at partial opacity on a box still travelling 32px — not a
  clearly visible focus position (WCAG 2.4.7, and the ring's contrast with it).
  A project that replaces the shipped look owes itself the same rule.
- **`prefers-reduced-motion` drops the reveal altogether.** The shipped
  stylesheet does not merely make it instant: it neutralises the waiting state,
  so that reader gets the content with no appearance to wait for. A project
  that keys its own look off the attribute owes itself the same block.
- **Print lifts the waiting state**, because paper cannot scroll anything into
  view. Without that rule an item that never made it into the viewport would
  print as an empty box.
- **A viewport too short for the offset cannot cost the reader the content.**
  `data-reveal-offset` is only usable while it stays below the viewport height,
  and that is not something the markup can decide once: a value that fits a
  desktop window is taller than the whole screen at 400% zoom or on a phone in
  landscape, where the trigger line would sit above the top edge and nothing
  could ever cross it. Checked only at startup, an offset would take the items
  away exactly in the situation WCAG 1.4.4 tests for — so it is re-checked on a
  debounced resize and dropped to `0` for as long as it does not fit.

`--reveal-duration` defaults to twice the shared `--an-duration`, i.e. one
second, and the reveal should stay in that region. WCAG 2.2.2 is about movement
that runs longer than five seconds without a way to stop it: one reveal is far
below that, but `data-reveal-stagger` multiplies — twenty items 300ms apart are
six seconds of movement on one screen. Budget stagger × items against the five
seconds, and mind a raised `--reveal-duration` on top of it.

## Integration
The JS exports `init(el, services)` and does not self-initialize. It is loaded
on demand by `boot.js` for every element carrying
`data-js-behavior="revealOnScroll"`.

The script sets **no inline styles** and runs no animation. It toggles one
attribute per item (`data-reveal-pending`) and writes
`data-revealonscroll-ready` on the container; the visuals — the movement, its
duration, `prefers-reduced-motion` and print — live in the SCSS. There is no
scroll listener and nothing is measured per frame or by hand: two
`IntersectionObserver`s report the crossings — the trigger line and plain
visibility — and every attribute write is idempotent. On engines without
`IntersectionObserver` no item is marked at all, so the page stands as
authored.

The one listener besides `focusin` is a **debounced `resize`**, and only an
instance that actually carries a `data-reveal-offset` owns it: the offset is
baked into the trigger's `rootMargin`, so a viewport that changed the verdict on
it (see *Accessibility*) needs a new trigger observer — built for the items that
are still waiting, since a revealed one is already through with both. Without an
offset the trigger line *is* the viewport's bottom edge at every size, so there
is nothing to re-check and no listener at all. The view observer never needs
rebuilding: it has no margin.

The **first screen deliberately does not animate**: revealing an item that is
already visible would mean taking it away from the reader first. Where a
project wants it anyway, the snippet documents the opt-in — hide the items in
your own CSS until `data-revealonscroll-ready` appears on the container, inside
`@media (scripting: enabled)`. The reveal then happens on its own, out of the
transition, the moment `init()` sets that attribute. What it costs is stated
there too: if the chunk never arrives, those items stay invisible. The
attribute is written as the *first* thing the module does, so every bail-out
(no `IntersectionObserver`, no items, a bad `data-reveal-items` selector) lifts
such a rule instead of leaving content behind it. See
[`docs/preEnhancement.md`](../../../docs/preEnhancement.md).

**Items that arrive later** — a *load more* button, an infinite-scroll page — are
not picked up by a running instance: the items are resolved once, and the
loader's per-element flag stops a second `init()` on the same container. Nothing
about the module has to change for that case, because the loader already answers
it: give **each batch its own container** carrying
`data-js-behavior="revealOnScroll"` and call `initModulesInScope(batch)` (exported
by `boot.js`) after inserting it. That is one instance per batch, each with its
own items and its own two observers — and a batch appended below the fold is
precisely what this module is for: its items are marked the moment they arrive
out of sight, and revealed as the reader gets to them. Re-initialising the
*existing* container instead would mean calling `destroyModulesInScope()` on it
first, which takes the pending attribute off every item still waiting.

`init()` returns a cleanup function: it clears the pending stagger timers,
disconnects both observers, drops the `focusin` and `resize` listeners and takes
both attributes off again, so a host that unmounts and remounts the subtree
(`destroyModulesInScope()`) hands the markup back exactly as it arrived. A
debounced rebuild that was already queued when the teardown happened finds a
`destroyed` flag and does nothing — removing a listener cannot un-queue it.

`services.reporter` (dependency injection via `boot.js`) is **optional** — it
is used only to warn on a non-element node, an invalid or empty
`data-reveal-items` selector, or a `data-reveal-offset` that is not smaller than
the viewport — the last one once per crossing of that line, not on every step of
a slow window drag.

## Demo
Open `demo.html` in the browser (requires a previous `gulp build`).
