# embedConsent

The box that stands in for a third-party embed until the visitor has allowed
it — with the information layer that makes the click an informed one, and a
seam that lets an existing consent skip the click entirely.

## Files needed to copy

- `embedConsent.js` — the behaviour
- `embedConsent.scss` → `dist/css/embedConsent.min.css`
- `embedConsent.html` — the copy-paste snippet
- from `_shared/js/`: `resolveLocale.js`, `formatTemplate.js`, `uniqueId.js`,
  `describedBy.js` — pure utilities, imported as flat siblings
- from `_shared/js/`: `createConsentGate.js` — the service, built in
  `boot.js`. Not imported by this component; it arrives through `services`.

## Usage

Put the component around nothing: it *is* the embed's place in the page. The
markup ships the facade — everything shown before consent — and the script
builds the iframe when it may.

```html
<div class="your-media-container">
  <div class="c-embedConsent" data-js-behavior="embedConsent"
       data-embedconsent-provider="youtube"
       data-embedconsent-id="https://www.youtube.com/watch?v=…"
       data-embedconsent-service="youtube"
       data-embedconsent-category="marketing"
       data-embedconsent-title="What the video shows">

    <div class="c-embedConsent__facade" data-embedconsent-facade>
      <img class="c-embedConsent__poster" src="/media/poster.jpg" alt=""
           data-embedconsent-poster>

      <div class="c-embedConsent__panel">
        <p class="c-embedConsent__notice" data-embedconsent-notice>
          …see below…
        </p>

        <p class="c-embedConsent__actions">
          <button class="c-embedConsent__toggle" type="button"
                  data-embedconsent-toggle hidden>Load and play video</button>
          <a class="c-embedConsent__fallback" href="https://youtu.be/…"
             data-embedconsent-fallback>Watch on YouTube instead</a>
        </p>
      </div>
    </div>

  </div>
</div>
```

The container is required wiring, not decoration: it owns size and aspect
ratio (`aspect-ratio: 16 / 9`). Here that ratio is a **minimum, not a fixed
box** — the one place this component departs from `video`. A paragraph of
legally required text in a 16/9 box 400px wide has about 225px to live in, so
a long notice is allowed to make the box taller; clipping it, or hiding it
behind an inner scrollbar, would defeat the component. The **embed** never
does: the iframe is out of flow, so once it is in, the box is exactly the
ratio you asked for. A container with no height at all falls back to
`--embedConsent-min-block-size` (12rem).

### The notice is the component

One hard rule, and the script enforces it: **no notice, no button.** Where
`[data-embedconsent-notice]` is missing or empty, the load button stays
hidden and the reporter says why. A play button over a poster tells the
visitor nothing, so pressing it is not an informed decision — and consent
that is not informed is not consent.

Nothing is lost by the refusal: the fallback link still reaches the content,
and the consent-gate lane still works (a consent platform collected its own
consent with its own information).

Keep the notice on **its own element** — the paragraph, not the panel
around it. The script points the button's `aria-describedby` at whatever
carries the attribute, and a description containing the button would read the
button's own label back as part of its explanation.

What the text has to carry:

| | |
| --- | --- |
| **Who** | the provider, and the company behind it |
| **What** | at minimum the IP address; say so if it goes to a third country |
| **Why** | what the embed is for, in one clause |
| **Where to read more** | a link to *your* privacy policy |

The wording is your lawyer's or your DPO's call. This component only
guarantees that there is somewhere to put it, that it is shown before the
decision, and that a screen reader gets it *with* the button rather than
having to go looking (`aria-describedby`).

### The poster is yours

`img.youtube.com/vi/…` and Vimeo's thumbnail API are the request this
component exists to defer: using one hands the visitor's IP to the provider
before anything was agreed. Serve your own file, or ship no poster at all —
the notice then sits on the component's own surface, which for a map is the
honest rendering anyway.

This is the one mistake in the whole component that fails **silently**:
everything else here either warns or visibly does nothing, while a poster
pulled from the provider leaves a page that looks exactly right and has
already made the request. So the script checks it. A poster served from a
known thumbnail host — `*.ytimg.com`, `img.youtube.com`, `*.vimeocdn.com`,
`vumbnail.com`, `maps.googleapis.com` — is reported to the console.

Deliberately *not* a general "is this poster cross-origin" test: your own
asset CDN is a perfectly good place for one, and a warning that cries wolf
about it is a warning people learn to scroll past.

### Providers

| `data-embedconsent-provider` | `data-embedconsent-id` | Embeds |
| --- | --- | --- |
| `youtube` | full URL (watch, youtu.be, shorts, embed, live) or bare id | `youtube-nocookie.com`, `rel=0` |
| `vimeo` | URL, `id`, or `id/hash` for an unlisted video | `player.vimeo.com`, `dnt=1` |
| `googleMaps` | what you would type into the search box | the keyless embed |
| `openStreetMap` | a bbox, `minLon,minLat,maxLon,maxLat` | the OSM export embed |

Anything else — a keyed Maps Embed API URL, a Spotify player, a form
provider — goes in `data-embedconsent-src` as a URL, verbatim. It wins over a
preset if both are given, and it has to be an **absolute http(s) URL**: a
relative one is not a third-party embed, and anything the URL parser rejects
is reported and left alone rather than handed to an iframe broken. The
button's label and the frame's fallback title then name the URL's host.

A video loaded by the **click** starts playing; one loaded by the **gate**
does not. Nobody asked for it in that page view, and sound starting on its
own is what WCAG 2.2.2 is about.

Where the click does start a player, **the shipped label says so** — "Load
and play YouTube", not "Load YouTube". A control that reads *load* and then
begins playing with sound is describing itself wrongly, which is how an
accessibility audit will read it, so the two shipped labels follow the
behaviour rather than papering over it. If you write your own label for a
video, say the same thing. `data-embedconsent-autoplay="false"` switches the
playback off for a project that wants the player in the page but silent, and
the label follows it back to "Load YouTube".

### One press for a whole group

A page carrying six videos costs a visitor six presses. `data-embedconsent-group`
lets one press fill every other box naming the same service token — for that
page view, storing nothing, exactly as the single press stores nothing.

```html
<div class="c-embedConsent" data-js-behavior="embedConsent"
     data-embedconsent-provider="youtube"
     data-embedconsent-service="youtube"
     data-embedconsent-group> … </div>
```

**Opt-in per box, and it stays that way.** A box without the attribute is
never filled by somebody else's press, even from the same provider — six
unrelated videos keep costing six presses unless you said otherwise. Give the
attribute a value and it names a group instead
(`data-embedconsent-group="products"`), so a hero video and one buried in a
legal text can stay apart although both are YouTube.

What holds it honest:

| | |
| --- | --- |
| **The label says so** | leave the button empty and the shipped label reads "Load and play YouTube — the others on this page are loaded too". A control that describes itself wrongly is the one thing this component will not ship, so the group gets its own two labels rather than a hedge on the old ones. Write your own and keeping it accurate is yours |
| **Only the pressed box may play** | the rest are built without the autoplay parameter. Nobody pressed them, and five players starting at once is precisely WCAG 2.2.2 |
| **The notice rule still stands** | a box whose own notice is empty is not in any group and is not filled. The press that would fill it explained nothing about it — that is rule one held to, not an exception to it. (The **gate** may still fill such a box: there a platform did its own informing) |
| **It never crosses providers** | the key is the service token, the same identity the gate is asked for, so a press about YouTube cannot load a map |
| **One announcement** | from the box you pressed — "2 further embeds from YouTube on this page have been loaded as well". The boxes that filled stay silent, so a group of six is one sentence and not six |

Two things worth knowing before you switch it on. A box the gate **emptied**
on a withdrawal is filled again by a group press, exactly as five individual
presses would fill five of them; deciding otherwise would mean forbidding the
single press too, and the click lane is the one thing the gate may never
overrule. And `loading="lazy"` is what keeps this cheap — the boxes below the
fold request nothing until the reader reaches them, so six frames is not six
requests.

### Working with your consent platform

The component asks one question — *has this visitor allowed this provider?* —
and it asks it of `services.consent`, built once in `boot.js`. Nothing in the
markup and nothing in this component knows which platform you run, and that
is deliberate: every CMP answers differently and the signatures drift with
major versions.

Out of the box the gate reads a token list off `<html>`:

```html
<html lang="en" data-consent="youtube maps">
```

Any platform can write that from its own callback, in a handful of lines —
ready-made ones for the six most common are in *Ready-made adapters* below.

Or ask the platform directly, in `boot.js`:

```js
const consent = createConsentGate({
  events: ['CookiebotOnAccept', 'CookiebotOnDecline'],
  resolve: (token) => window.Cookiebot?.consent?.[token] === true,
});
```

A `resolve` that throws counts as *not granted* —
`Cookiebot.consent.marketing` is a `TypeError` until Cookiebot has loaded,
and a gate that broke on that would be a gate that loads embeds on a page
whose platform is still on its way.

**Prefer the attribute.** It is the only lane a stylesheet can read — which
is what the two sections below are about.

Two tokens, one answer: the component asks with `data-embedconsent-service`
(the exact service) *and* `data-embedconsent-category` (what a
category-only platform would have granted), and either being present is
enough. That is how one markup contract serves both granularities.

### Where each piece goes

Two jobs, two places, and the reason they cannot share one is timing: they
answer at different moments in the life of a page.

| Job | Answered when | Belongs in |
| --- | --- | --- |
| The visitor consented on an earlier visit | **before the first paint** | the `<html>` tag — see the four routes below |
| The visitor consents (or withdraws) right now | while the page is open | next to your consent platform's own script, or in `boot.js` |

**The first job cannot wait for a script that loads normally**, and that is
not a performance opinion: `boot.min.js` is a deferred module, so it runs
after the first paint. By the time it could say "no notice needed here", the
notice is on screen. What has to exist before anything is drawn is the
attribute itself:

```html
<html lang="en" data-consent="youtube maps">
```

Four ways to be early enough, best first — and note that **none of them asks
the consent platform**, because at that moment the platform has not loaded.
Three of them read what it *stored* on an earlier visit; the fourth changes
when it loads.

| Route | What it costs |
| --- | --- |
| **1. Your server writes the attribute** into the `<html>` tag it emits | nothing, if your server renders the HTML and your platform stores its answer in a cookie |
| **2. Your platform's own script, blocking in `<head>`** before the stylesheets, with the translator right after it | a blocking third-party request before anything paints |
| **3. A few lines of inline `<script>`** at the very top of `<head>`, reading what the platform stored | you parse the platform's storage format yourself, and keep doing so |
| **4. Accept the flash** | a notice visible for a moment |

**Route 1** is the one with no downside worth the name. The consent cookie
travels with the document request, so the same template that emits `<html>`
can read it and write the tokens into the tag. No JavaScript is involved and
there is no moment at which the notice exists.

**Route 2** is worth knowing because it needs no parsing at all: most
platforms document a blocking `<head>` installation, precisely so they can
gate other scripts. Loaded that way, the platform answers before the first
paint and your translator (below) writes the attribute in time.
The trade is real and should be stated to whoever decides it: nothing on the
page is drawn until a third party's server has answered.

**Route 3** is not "asking the banner early". It reads the banner's own
cookie or `localStorage` entry directly and translates it. That works — both
are available synchronously at the top of `<head>` — but it makes you the
second party interpreting that storage, and the format is the platform's to
change:

- Klaro and Borlabs Cookie store JSON. A few lines really are a few lines.
- Cookiebot's cookie has a shape of its own; readable, not a one-liner.
- Usercentrics stores in `localStorage` rather than a cookie — which rules
  out route 1 entirely (**`localStorage` never reaches the server**) and
  makes this route the only one of the three available.
- TCF platforms (OneTrust, Didomi, Sourcepoint) store a base64 bitfield. That
  needs a real decoder, not an inline snippet; in practice route 3 is closed
  and route 1 needs the same decoder server-side.

Whatever you read it with, it must **fail closed**: an unrecognised or
changed format means *not granted*. A platform that changes its storage in a
major version then costs you the flash again, which is harmless — a route 3
that guessed "granted" instead would be a privacy bug.

**Route 4 is a legitimate answer**, and the one to pick when the others cost
more than they are worth. What flashes is the *safe* state being shown before
it is dismissed: a visitor who has consented sees, for a fraction of a
second, the notice explaining what they already agreed to. Nothing is
requested from anyone in the meantime, and nobody is harmed by it.

**The second job is the translator** — the listener that turns your
platform's callback into the same attribute (the examples above). It can only
run once the platform has loaded, which on routes 1, 3 and 4 is after the
first paint; there it is late by definition and that is fine, because by then
the flash is either prevented or over. On route 2 the same lines are what
prevents it. Either way, put them where your project already configures its
banner, next to that script tag. It belongs to the banner, not
to this collection — which is also what keeps swapping banners a change to
banner files only.

`boot.js` is the alternative home for it, next to the `createConsentGate()`
call, and the convention would allow it — that is the composition root, where
a project assembles its collaborators. Keeping it next to the banner is still
the better arrangement, for the reason just given: it leaves a change of
banner as a change to banner files.

**You can leave `boot.js` untouched**, and for most projects that is the
tidiest arrangement. The shipped defaults are chosen for it: the gate reads
`data-consent` off `<html>` and listens for an event called `consentchange`.
So your translator ends with

```js
document.documentElement.setAttribute('data-consent', granted.join(' '));
window.dispatchEvent(new CustomEvent('consentchange'));
```

and all of your platform knowledge stays in your own files. (The event is
belt and braces — the gate notices the attribute change on its own. It costs
nothing and it makes the intent visible.)

The one case that *does* need `boot.js` edited is the `resolve` lane: asking
the platform directly instead of writing a note. Then the whole connection is
the configuration object, there is no translator and no attribute — and
therefore no way to answer the first job at all. Which is why it is the
second choice.

### Ready-made adapters

Every translator is the same three steps — *ask what is granted, write the
tokens, say so* — and only the first differs. Put this helper next to your
banner's script once:

```js
// The only two lines that touch this collection. `granted` is a list of
// tokens, and they have to be the same tokens your markup asks for in
// data-embedconsent-service / data-embedconsent-category.
function applyConsent(granted) {
  document.documentElement.setAttribute('data-consent', granted.join(' '));
  window.dispatchEvent(new CustomEvent('consentchange'));
}
```

Then one of the blocks below. They were written against each vendor's
published API in August 2026 and are **starting points, not guarantees**:
every one of these names has changed at least once across major versions.
Before trusting a block, open the console on a page that has the banner and
check that the global is what it claims to be — `window.Cookiebot`,
`window.UC_UI`, `window.klaro`, `window.BorlabsCookie`,
`window.cmplz_has_consent`, `window.__tcfapi`. Adjust the names; the shape
stays.

Where a block also has an **early read**, that is the route 3 version — an
inline `<script>` for the top of `<head>` that reads what the platform stored
last time. It writes the attribute only, never the event, because on the
first paint there is nobody listening yet.

#### Cookiebot

Categories only, so the tokens are the category names. `necessary` is always
true and therefore never worth asking about; the other three are the list.
Ask your markup for them with `data-embedconsent-category="marketing"`.

```js
['CookiebotOnConsentReady', 'CookiebotOnAccept', 'CookiebotOnDecline']
  .forEach((event) => window.addEventListener(event, () => {
    const consent = window.Cookiebot?.consent || {};

    applyConsent(
      ['preferences', 'statistics', 'marketing'].filter((c) => consent[c])
    );
  }));
```

Early read: the cookie is called `CookieConsent`, and its value is *not* JSON
— it is an encoded JavaScript-ish object, and a value of `-1` means "this
visitor is outside a region that requires consent, everything is accepted".
**Look at the actual cookie in your browser's inspector before using this**;
the property spelling is what the regex depends on.

```js
(function () {
  var raw = decodeURIComponent(
    (document.cookie.match(/(?:^|;\s*)CookieConsent=([^;]*)/) || [])[1] || ''
  );
  if (!raw) return;

  var all = ['preferences', 'statistics', 'marketing'];
  var granted = raw === '-1'
    ? all
    : all.filter(function (c) { return new RegExp(c + ':true').test(raw); });

  if (granted.length) {
    document.documentElement.setAttribute('data-consent', granted.join(' '));
  }
})();
```

#### Usercentrics

Per service, and the services are named in the admin UI — "YouTube Video",
"Google Maps". Those names contain spaces, so they cannot be tokens in a
space-separated attribute. Map them, which is the right place for that
decision anyway:

```js
const tokens = {
  'YouTube Video': 'youtube',
  'Google Maps': 'googleMaps',
  'Vimeo': 'vimeo',
};

const readUsercentrics = () => applyConsent(
  (window.UC_UI?.getServicesBaseInfo?.() || [])
    .filter((service) => service.consent?.status)
    .map((service) => tokens[service.name])
    .filter(Boolean)
);

window.addEventListener('UC_UI_INITIALIZED', readUsercentrics);
window.addEventListener('UC_UI_CMP_EVENT', readUsercentrics);
```

No early read: Usercentrics keeps its answer in `localStorage`, which **never
reaches the server** — so route 1 is out and only an inline script in `<head>`
can be early, reading that entry rather than a cookie.

#### Klaro!

Per service, and the ids are already slug-shaped, so they can be your tokens
directly.

```js
klaro.getManager().watch({
  update(manager, name, data) {

    // The watcher is called for other things too; 'consents' is the one
    // that carries the state of every service.
    if (name !== 'consents') return;

    applyConsent(Object.keys(data).filter((service) => data[service]));
  },
});
```

Early read: Klaro stores JSON, under the name `manager.storageName()` returns
(the cookie name, or the `localStorage` key — `klaro` by default).

```js
(function () {
  var raw = decodeURIComponent(
    (document.cookie.match(/(?:^|;\s*)klaro=([^;]*)/) || [])[1] || ''
  );
  if (!raw) return;

  try {
    var consents = JSON.parse(raw);
    var granted = Object.keys(consents).filter(function (s) {
      return consents[s] === true;
    });
    if (granted.length) {
      document.documentElement.setAttribute('data-consent', granted.join(' '));
    }
  } catch (e) {

    // Unreadable means not granted. Never guess in this direction.
  }
})();
```

#### Borlabs Cookie 3

Per service, but v3 has **no bulk getter** — you ask about one service at a
time, so name the ones you actually embed.

```js
const services = ['youtube', 'googlemaps', 'vimeo'];

const readBorlabs = () => applyConsent(
  services.filter((id) => window.BorlabsCookie?.Consents?.hasConsent(id))
);

window.addEventListener('borlabs-cookie-consent-saved', readBorlabs);
document.addEventListener('DOMContentLoaded', readBorlabs);
```

Version 2 is a different call — `BorlabsCookie.checkCookieConsent(id)` — so
check which major version the site runs before pasting this.

#### Complianz

Categories, and the cleanest early read of the lot: Complianz writes one
plain cookie per category.

```js
const categories = ['functional', 'preferences', 'statistics', 'marketing'];

const readComplianz = () => applyConsent(
  categories.filter((c) => window.cmplz_has_consent?.(c))
);

document.addEventListener('cmplz_status_change', readComplianz);
document.addEventListener('cmplz_enable_category', readComplianz);
readComplianz();
```

Three listeners for one answer is deliberate: `cmplz_enable_category` fires
once per category, so this runs several times on one decision. Every run
writes the same complete list, and the gate's own re-evaluation is a no-op
for an embed that is already in — so the repetition costs nothing and is
cheaper than working out which event is the last one.

Early read — `cmplz_marketing=allow`, and nothing to parse:

```js
(function () {
  var granted = ['functional', 'preferences', 'statistics', 'marketing']
    .filter(function (c) {
      return document.cookie.indexOf('cmplz_' + c + '=allow') !== -1;
    });

  if (granted.length) {
    document.documentElement.setAttribute('data-consent', granted.join(' '));
  }
})();
```

#### IAB TCF v2.2 (OneTrust, Didomi, Sourcepoint, …)

The shape works, and it is the part of this section to read most carefully.

```js
window.__tcfapi('addEventListener', 2, (tcData, success) => {
  if (!success) return;

  // 'tcloaded' is a choice made earlier, 'useractioncomplete' one just made.
  if (tcData.eventStatus !== 'tcloaded'
    && tcData.eventStatus !== 'useractioncomplete') return;

  // YOUR MAPPING GOES HERE — see below. This is not a recommendation.
  const granted = [];
  if (tcData.purpose?.consents?.[1]) granted.push('marketing');

  applyConsent(granted);
});
```

**TCF does not have a concept of "this embed may load".** It has advertising
purposes and vendor ids. Purpose 1 ("store and/or access information on a
device") is the closest thing to what an embed actually does, but consenting
to it is not a statement about a YouTube player, and Google's own vendors sit
in a *separate* string (`tcData.addtlConsent`, Additional Consent) rather
than in `tcData.vendor.consents`. So the mapping above is a placeholder, the
decision belongs to your DPO, and if a TCF banner is all a site has, leaving
embeds to the **click lane** is often the more honest answer than inventing a
correspondence.

#### Your platform is not here

Write your own; the shape is always the same, and three questions settle it:

1. **What tells you consent is ready or has changed?** An event on `window`
   or `document`, a watcher, a callback in the platform's config.
2. **What do you ask?** A per-service call, a category flag, a list you
   filter.
3. **What are the tokens?** Yours — they only have to match what your markup
   asks for, and they must not contain spaces.

Then call `applyConsent(...)` with the result. Nothing else in this component
or in the collection needs to know your platform exists.

### Killing the notice flash

`boot.min.js` is a deferred module and this component is a second, lazily
imported chunk, so the first paint is always the facade — a visitor who
consented long ago sees the notice for a moment. No JavaScript can close that
gap. A render-blocking stylesheet can, and that is the whole reason the
gate's default lane is an attribute rather than a function call.

So: get the attribute into the page by one of the four routes above, and add
one rule per token to your own CSS.

```css
html[data-consent~="youtube"]
.c-embedConsent[data-embedconsent-service="youtube"]
[data-embedconsent-facade] { display: none; }
```

That rule is yours and is not shipped here, because only your project knows
its token names. Without it nothing breaks; the notice is simply visible for
a moment.

### What this component does not do

- It is **not a cookie banner** and does not ask the consent question.
- It **stores nothing** — no cookie, no `localStorage`, no "always allow". A
  record of what a visitor permitted is a legal document with an obligation
  to prove it and an obligation to let them withdraw it attached, and that
  belongs to your platform. A click here covers one page view; a reload puts
  the notice back. A **group** press is the same promise made wider, not a
  weaker one: it reaches further across the page and no further in time.
- It does **not** decide which category a service falls into.
- It makes **no claim of compliance**. It puts the information in the right
  place at the right time and defers every request until it may be made;
  whether that is enough for a given project is a question for that
  project's lawyer.

## Accessibility

- The load button ships `hidden` in the markup and is revealed by the script,
  so a page without JavaScript never shows a dead control. Its label says
  what pressing it does; leave it empty and the script writes a localized
  "Load *provider*" — or "Load and play *provider*" where the click really
  does start a player, plus the two group variants where the press reaches
  the other boxes on the page (de/en from `<html lang>`, see *Providers* and
  *One press for a whole group* above). Both axes are settled before the
  button is revealed, so the label is picked rather than hedged.
- The button gets `aria-describedby` pointing at the notice, so the
  information is announced *with* the control.
- **Every string the script writes is marked with the language it is in,
  where that is not the page's own** (WCAG 3.1.2): a page in neither German
  nor English gets the English labels, and English text inside a French page
  has to say so. `lang="en"` on every label of an English page would be
  noise, so the test is `resolveLocale`'s own matching read backwards —
  `lang="de-CH"` resolving to `de` counts as the page's language and adds
  nothing. The strings your project writes are yours to mark.
- The injected iframe gets a `title` from `data-embedconsent-title`. Without
  one the reporter says so and a generic name is used — an untitled frame is
  announced as "frame" and nothing more. That fallback is one of the
  component's own strings, so the iframe carries the label language with it
  (`lang` on an element covers its attribute values); an author-supplied
  title is never marked, because claiming somebody else's wording is English
  is the same error in the other direction.
- The poster is decorative (`alt=""`): it depicts what the notice and the
  button already name.
- The focus is never taken and never dropped. It moves exactly twice: into
  the iframe when the focus stood in the facade being replaced, and back onto
  the button when a withdrawal destroys an iframe the reader was standing in.
- The two changes nobody clicked — consent arriving while the page is open,
  consent withdrawn — are announced in a polite `role="status"` region. An
  embed that was already there when the page was built says nothing: to that
  reader it was simply part of the page, and a sentence on every load is
  noise. Neither state is colour-coded.
- **A group press announces once, from the box that was pressed.** The boxes
  that filled without being asked stay silent, so a group of six produces one
  sentence rather than six talking over each other. The pressed box says
  nothing about *itself*, as ever — the reader knows what they just did; what
  they cannot know is that other boxes changed.
- Nothing about the notice depends on the stylesheet: without CSS it is a
  paragraph, a button and a link, in that order.
- **A contrast theme gets an opaque panel and a bordered button.** A forced
  colours theme replaces every colour but *not* an alpha channel: the
  panel's `rgba(0, 0, 0, 0.75)` comes back as translucent white with your
  poster showing through, which is the one thing a reader who turned that
  mode on asked not to have. Under `forced-colors: active` the panel
  restates its background as `Canvas` and takes a `CanvasText` border, and
  the button — which is a button only by virtue of its accent fill — takes a
  `ButtonText` border, because with the fill gone there would be no boundary
  at all. The poster is deliberately left alone: forced colours does not
  touch images, and hiding one would remove content rather than recolour it.
- **The notice's measure floor gives way before the viewport does.**
  `--embedConsent-notice-min-inline-size` is an rem value, so a reader who
  doubles their text size doubles it too; it is applied as
  `min(…, 100%)` so a 14rem floor cannot become a 448px panel in a 320px
  window and put the whole page into horizontal scrolling.
- **What the component cannot answer for is what is inside the iframe.** The
  moment consent is given, the provider's document is part of your page and
  part of any audit of it — and a Google Maps embed fails several test steps
  on its own. Nothing here can heal that. What the component does is make it
  happen only after a deliberate act, and keep the fallback link as the way
  to the content for anybody who does not want to make it; `openStreetMap`
  is the one preset whose result you can also reason about.

## Integration

The JS exports `init(el, services)` and is boot-loaded per
`data-js-behavior="embedConsent"` — never import `embedConsent.js` yourself.
It sets no inline styles: it toggles `hidden` on the facade and the button,
stamps `[data-embedconsent-embed]` on the injected iframe and writes
`[data-embedconsent-ready]` on the root.

`services.reporter` is optional (used only for warnings).
`services.consent` is optional too — without it the click lane is the only
one, which is a complete component and not a degraded one.

`init()` returns a cleanup function, so `destroyModulesInScope()` puts the
element back the way it was authored — including the two things it only
sometimes owns: the notice's `id` and the button's `aria-describedby` are
taken back **only where this component wrote them**. The notice is your
element, so an id or a description link you had already written by hand
survives untouched.

A cleanup also takes the instance out of the group, so a press elsewhere can
no longer reach it. In the other direction, markup brought in later by
`loadFragment` joins the group as soon as it is initialised: the shipped
group label carries no count, precisely so it stays true when that happens.

## Demo

Open `demo.html` in the browser (requires a prior `gulp build`).
