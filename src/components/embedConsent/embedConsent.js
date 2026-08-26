/**
 * embedConsent.js
 * ----------------------------------------------------------------------------
 * A third-party embed — a YouTube player, a Vimeo player, a Google map — is
 * an <iframe> that starts requesting from somebody else's server the moment
 * the markup is parsed. The visitor's IP address, their user agent and,
 * depending on the provider, a cookie are on their way before anything has
 * been agreed. This component is the box that goes in that iframe's place: a
 * locally hosted poster, a NOTICE saying who would receive what, a button
 * that loads it, and a plain link to the content at the provider for anybody
 * who would rather go there than let it in here.
 *
 * It generalises the YouTube facade that used to live in `video` (which now
 * covers self-hosted <video> only) and adds the two halves that facade did
 * not have: the information layer that makes the click an INFORMED one, and
 * the ability to skip the click entirely for a visitor whose consent the
 * page already has.
 *
 * Two ways in, and the second one never replaces the first
 * -------------------------------------------------------
 *   1. The CLICK. Always available, always sufficient on its own. A page
 *      needs no consent-management platform, no cookie and no configuration
 *      for this lane to work.
 *   2. The CONSENT GATE (`services.consent`, built in boot.js). Where the
 *      visitor has already allowed this provider — in a cookie banner, on a
 *      previous page — the embed is simply there and nobody is asked twice.
 *      Consent arriving later fills the box; consent withdrawn later empties
 *      it again.
 *
 * The order matters and it is the whole design: the gate may only ever REMOVE
 * the click, never be the only way in. Consent platforms load late, fail, and
 * are removed by content blockers on a large share of real visits — a box
 * that then sat there saying "waiting for consent" would be a broken box. So
 * the facade is the resting state, and everything the gate does is an
 * improvement on it.
 *
 * What this component is NOT
 * --------------------------
 * It is not a cookie banner and it does not ask the consent question itself.
 * It STORES NOTHING and WRITES NOTHING — no cookie, no localStorage, no
 * consent record of its own. A record of what a visitor permitted is a legal
 * document with an obligation to withdraw and an obligation to prove attached
 * to it, and that belongs to the project's CMP. A click here covers this page
 * view; a reload puts the notice back.
 *
 * Since the permanent lane (see 9 below) it can HAND a decision to that
 * platform — which is the same sentence read in the other direction, not a
 * softening of it. The component asks the gate, the gate calls a callback the
 * project wrote, the platform stores, documents and answers back. Nothing in
 * here keeps a byte of it, and a grant that never reached the platform is
 * reported rather than remembered locally: a consent nobody can prove is not
 * one worth having.
 *
 * Which category a service falls into is not decided here either. The markup
 * names the tokens to ask for and the project's boot.js says how they are
 * answered; nothing in this file knows a single CMP.
 *
 * What the platform already does (so this script does NOT reimplement it)
 * ----------------------------------------------------------------------
 * - An <iframe> that is not in the document requests nothing. The whole
 *   deferral is "do not create the element yet" — there is no blocking, no
 *   interception and no rewriting of a src involved.
 * - `loading="lazy"` on the iframe defers even a granted embed until it is
 *   near the viewport, so a page with six consented maps on it makes six
 *   requests as the reader arrives at them rather than all of them at once.
 * - An <iframe> is focusable and in the tab order. Handing the focus over
 *   after a click is one call, not a tabindex arrangement.
 * - A `<a href>` to the content at the provider needs nothing from this
 *   script to work, which is why it is the no-JS way in and stays visible
 *   afterwards.
 * - `role="status"` is the platform's polite live region; text written into
 *   it is read out once without taking the focus anywhere.
 *
 * What the script adds
 * --------------------
 *  1. The iframe, built from a provider preset (`youtube`, `vimeo`,
 *     `googleMaps`, `openStreetMap`) or from a URL given verbatim. Each
 *     preset owns its own URL construction, so a full watch URL, a share
 *     URL or a bare id all work, and each picks the privacy-friendlier host
 *     and parameters the provider offers (youtube-nocookie.com, Vimeo's
 *     dnt=1, no cookie-setting Maps API key).
 *  2. The consent gate, subscribed for the whole lifetime of the instance:
 *     granted now -> the embed is there from the start; granted later -> the
 *     box fills; WITHDRAWN later -> the iframe is removed and the notice
 *     comes back. The withdrawal half is the one homegrown facades never
 *     have, and it is the half a visitor has a right to.
 *  3. Autoplay only after a click, and only where the LABEL SAYS SO. A
 *     gate-loaded video is created without the autoplay parameter: nobody
 *     asked for it in this page view, and sound starting on its own is
 *     exactly what WCAG 2.2.2 is about. The click lane sets it, because
 *     pressing "load and play the video" is a request to watch it — and
 *     that is what the shipped label reads wherever it will actually
 *     happen. A button that says "load" and then starts a player with
 *     sound is a control describing itself wrongly, which is the reading
 *     an accessibility audit will take to it. Where a project wants the
 *     frame without the playback, data-embedconsent-autoplay="false" says
 *     so and the label follows.
 *  4. One hard rule: NO NOTICE, NO BUTTON. Where
 *     [data-embedconsent-notice] is missing or empty the click lane stays
 *     switched off and the reporter says why. A bare play button over a
 *     poster is not informed consent — the visitor was told nothing — and
 *     the component refuses to pretend otherwise. Nothing is lost by it: the
 *     fallback link still reaches the content, and the GATE lane still works
 *     (a CMP collected its own consent with its own information).
 *  5. The notice is attached to the button, not merely placed near it: the
 *     button gets `aria-describedby` pointing at it, so the information is
 *     read out with the control rather than left to be found.
 *  6. Both silent CHANGES are said, and only those. Consent granted while
 *     the page is open, and consent withdrawn, are announced in a polite
 *     live region — the first because content appeared that nobody on this
 *     page asked for, the second because content a reader may have been in
 *     the middle of is gone. An embed that was already there when the page
 *     was built says nothing: to that reader it was simply part of the page,
 *     and a sentence on every load is noise rather than information.
 *  7. The focus is never taken, and never dropped. It moves exactly twice:
 *     into the iframe when the focus stood inside the facade that is being
 *     replaced (the click lane, always; the gate lane, when a banner
 *     happened to leave it there), and back onto the button when a
 *     withdrawal destroys an iframe the reader was standing in.
 *  8. Optionally, ONE PRESS FOR A GROUP. A page carrying six videos costs a
 *     visitor six presses, so data-embedconsent-group lets one press fill
 *     every other box that names the same service token — for this page
 *     view, storing nothing, exactly as the single press stores nothing.
 *     Off by default: six unrelated videos keep costing six presses unless
 *     the author said otherwise. Three things hold it honest — the label
 *     says the press reaches further, only the pressed box may start a
 *     player, and rule 4 stands (a box whose own notice is empty is not in
 *     any group, because the press that would fill it explained nothing to
 *     the visitor about it). The group never crosses providers: the key is
 *     the service token, so a press about YouTube cannot fill a map.
 *  9. Optionally, ONE PRESS FOR GOOD. Where the project's consent gate can
 *     hand a decision to its CMP (services.consent.canGrant()), a second
 *     button offers the visitor the thing the click lane cannot: "and always
 *     allow YouTube". The press does exactly what the plain one does — the
 *     embed goes in here and now — and then asks the gate to tell the
 *     platform. The platform stores it, documents it and writes its own
 *     answer back, and the gate's subscription is what fills the rest of the
 *     page and the next page. This component stores nothing either way, and
 *     a grant that could not be handed over is REPORTED rather than
 *     pretended: the button said "always" and only the page view was
 *     delivered.
 *
 *     Five conditions, all of them checked, because this is the one control
 *     here that outlives the page view:
 *       - The project wired BOTH grant and revoke into the gate. Withdrawal
 *         has to be as easy as consent (GDPR Art. 7(3)), so a project that
 *         can only grant gets no grant control at all.
 *       - The author shipped BOTH buttons, [data-embedconsent-grant] and
 *         [data-embedconsent-revoke]. Same rule seen from the markup side:
 *         the way back is part of the offer, not an afterthought somewhere
 *         else on the page.
 *       - The plain load button is available. A box offering only the
 *         permanent choice would make a lasting decision the price of
 *         watching one video, which is the dark pattern this whole lane
 *         would otherwise be.
 *       - There is a SERVICE token to grant. A category ("marketing") is
 *         more than the notice explained, and it is not this component's to
 *         translate — see createConsentGate.js.
 *       - Rule 4 still stands, through the condition above: no notice, no
 *         load button, therefore no permanent one either.
 *
 *     And the way back is a real control on the box, revealed exactly while
 *     there is a platform-held consent to take back (never after a plain
 *     click — a reload already takes that one back, so a "withdraw" there
 *     would be a button that does nothing).
 *
 * Accessibility
 * -------------
 * - The button ships `hidden` in the markup and is revealed by the script,
 *   so a page without JavaScript never shows a dead control. Its label says
 *   what pressing it does — "Load YouTube", or "Load and play YouTube"
 *   where the click really does start a player — shipped in de/en and
 *   overridden by any text the author put in the button.
 * - Every string this component writes into the page is MARKED WITH THE
 *   LANGUAGE it is in, but only where that is not the page's own (WCAG
 *   3.1.2): <html lang="fr"> gets the English labels, and English text
 *   inside a French page has to say so, while lang="en" on every label of
 *   an English page is noise. Same test as toast's, read off
 *   resolveLocale's own matching, so lang="de-CH" resolving to "de" counts
 *   as the page's language and adds nothing.
 * - The injected iframe gets a `title` from data-embedconsent-title; without
 *   one the reporter says so and a generic name naming the provider is used,
 *   because an untitled frame is a "frame" and nothing more. That fallback
 *   is one of this component's own strings, so the iframe carries the label
 *   language with it — `lang` on an element covers its attribute values,
 *   and it is set only where the title was NOT the author's, because
 *   marking somebody else's wording as English would be the same error in
 *   the other direction.
 * - The poster is decorative (alt=""): it depicts the content the notice and
 *   the button already name, and describing it twice only lengthens the way
 *   to the control.
 * - Nothing in the facade is colour-coded: the notice is text, and the
 *   states this component has are stated in words (WCAG 1.4.1).
 * - The permanent lane's two controls are real buttons, shipped `hidden` and
 *   labelled from the same de/en table, and the grant one carries the same
 *   `aria-describedby` as the load button: it asks for more than the other,
 *   so it may not ask for it with less. The revoke control is authored
 *   OUTSIDE the facade and therefore comes before the iframe in the tab
 *   order — the way out of the content precedes the content, which is where
 *   it can be found.
 *
 * Configuration (on the element carrying data-js-behavior="embedConsent")
 * ----------------------------------------------------------------------
 * - `data-embedconsent-provider="youtube|vimeo|googleMaps|openStreetMap"`
 *                                  picks a preset. With it,
 *                                  data-embedconsent-id is what the preset
 *                                  needs (a video URL or id; a map query;
 *                                  an OSM bbox).
 * - `data-embedconsent-src="URL"`   the generic lane: the iframe URL
 *                                  verbatim, for a provider with no preset
 *                                  (or a keyed Maps Embed API URL). Wins
 *                                  over a preset if both are given. Must be
 *                                  an absolute http(s) URL — a relative one
 *                                  is not a third-party embed, and this
 *                                  component has nothing to say about one.
 * - `data-embedconsent-service="…"` the token the gate is asked for.
 *                                  Defaults to the preset name.
 * - `data-embedconsent-category="…"` a second token, for a CMP that only
 *                                  knows categories ("marketing"). Either
 *                                  token being granted is enough.
 * - `data-embedconsent-title="…"`   accessible title for the iframe. Set it.
 * - `data-embedconsent-allow="…"`   permissions policy for the iframe,
 *                                  overriding the preset's.
 * - `data-embedconsent-autoplay="false"`
 *                                  stops the click lane adding the
 *                                  provider's autoplay parameter, for a
 *                                  project that wants the player in the
 *                                  page but not playing. The shipped
 *                                  button label follows it, so the control
 *                                  keeps describing what it does.
 * - `data-embedconsent-group`       opt-in: a press here also fills every
 *                                  other box in the same group, for this
 *                                  page view (see 8 above). An empty value
 *                                  means the group IS the service token; a
 *                                  value names a group, so two YouTube
 *                                  boxes on one page can stay apart.
 * - `[data-embedconsent-facade]`    everything shown before consent, hidden
 *                                  in one move once the embed is in.
 * - `[data-embedconsent-notice]`    the information layer. REQUIRED for the
 *                                  click lane (see 4 above), and for a
 *                                  place in a group (see 8).
 * - `[data-embedconsent-toggle]`    the load button, shipped `hidden`.
 * - `[data-embedconsent-grant]`     opt-in: the button that also asks the
 *                                  project's CMP to remember this provider
 *                                  (see 9 above). Shipped `hidden`, revealed
 *                                  only where all five conditions hold.
 * - `[data-embedconsent-revoke]`    the way back, and required alongside the
 *                                  one above. Shipped `hidden`, revealed
 *                                  while a platform-held consent is what is
 *                                  filling this box. Put it OUTSIDE the
 *                                  facade — the facade is hidden exactly
 *                                  when this control is needed.
 * - `[data-embedconsent-poster]`    the LOCALLY hosted preview image.
 *                                  Optional — and never a provider's
 *                                  thumbnail URL, which would be the very
 *                                  request this component defers. That one
 *                                  is checked: a poster served from a known
 *                                  thumbnail endpoint is reported.
 * - `[data-embedconsent-fallback]`  the link to the content at the provider.
 *                                  Stays visible after enhancement: "not
 *                                  here" is a legitimate answer.
 *
 * Styling contract
 * ----------------
 * The script sets no inline styles. It toggles `hidden` on the facade, on the
 * load button and on the permanent lane's two controls, stamps the injected
 * iframe with [data-embedconsent-embed] and writes [data-embedconsent-ready]
 * on the root; embedConsent.scss keys on exactly these hooks. The
 * c-embedConsent* classes are styling only — the JS never touches them.
 * ----------------------------------------------------------------------------
 */



import { resolveLocale } from './resolveLocale.js';
import { formatTemplate } from './formatTemplate.js';
import { uniqueId } from './uniqueId.js';
import { addDescribedBy, removeDescribedBy } from './describedBy.js';



const defaults = {

  // Behavioural hooks (data attributes, not style classes, so the JS stays
  // decoupled from the CSS). All of them live inside the component element.
  selFacade: '[data-embedconsent-facade]',
  selNotice: '[data-embedconsent-notice]',
  selToggle: '[data-embedconsent-toggle]',
  selFallback: '[data-embedconsent-fallback]',
  selPoster: '[data-embedconsent-poster]',

  // The permanent lane's two controls (see 9 in the header). A pair, always:
  // neither is wired without the other.
  selGrant: '[data-embedconsent-grant]',
  selRevoke: '[data-embedconsent-revoke]',

  // Per-instance option attributes (see the header comment).
  providerAttr: 'data-embedconsent-provider',
  srcAttr: 'data-embedconsent-src',
  idAttr: 'data-embedconsent-id',
  serviceAttr: 'data-embedconsent-service',
  categoryAttr: 'data-embedconsent-category',
  titleAttr: 'data-embedconsent-title',
  allowAttr: 'data-embedconsent-allow',
  autoplayAttr: 'data-embedconsent-autoplay',
  groupAttr: 'data-embedconsent-group',

  // Stamped on the injected iframe so the stylesheet can size it without the
  // JS hooking onto styling classes.
  embedAttr: 'data-embedconsent-embed',

  // Marks the polite live region the component puts inside the root. Not a
  // class: the project styles nothing with it, and the shipped stylesheet
  // addresses this attribute.
  statusAttr: 'data-embedconsent-status',

  // Written on the root by init(), removed again by the cleanup function.
  // Only ever written, never read back. Set LAST, and the reason is the same
  // one fileUpload and passwordToggle have: nothing here is hidden before
  // init(), so there is no pre-enhancement state to lift — the flag says
  // "the button in this box works now", which is what a project's own
  // no-flash rule keys off (see the readme).
  readyAttr: 'data-embedconsent-ready',

  // <html lang> matching none of the offered locales falls back to this.
  fallbackLocale: 'en',
};



// What the component has to be able to say. The button label is the only one
// an author routinely overrides (by writing text into the button); the rest
// are spoken, not read, and there is nothing to override them for.
//
// Every one of them names the provider, and every one can: a preset knows
// its own name and every other embed has come through absoluteEmbedUrl(), so
// there is always at least a host to call the other side by. That is worth
// stating because the alternative was written first — a second, nameless
// shape of each string — and it became unreachable the moment a src that
// does not parse stopped being embedded at all.
//
// The button label exists in four versions rather than one plus a hedge,
// along two axes that are both settled before the button is revealed: does
// the press start a player (see point 3 in the header), and does it reach
// the other boxes on this page (point 8). A control that describes itself
// wrongly is the one thing this component will not ship, so each combination
// gets its own sentence.
//
// The group label carries no COUNT, deliberately. A number would be true at
// init and false the moment loadFragment brings another box in or takes one
// away; "the others on this page" survives that without a single
// recalculation. The announcement is the opposite case — it is written at
// press time, when the number is exact — and there it earns its place.
//
// The permanent lane's own label (grantLoad / grantLoadPlay) takes the
// autoplay axis and NOT the group one, and that is a claim about what the
// press does rather than a saving of two strings: a consent handed to the
// platform reaches every box on the page whether it opted into a group or
// not, and the next page too. "Always allow YouTube" already says more than
// "and the others on this page" would, and adding both would describe the
// smaller half of the same press.
const labels = {

  de: {
    load: '{provider} laden',
    loadPlay: '{provider} laden und abspielen',
    loadGroup: '{provider} laden — und die übrigen auf dieser Seite',
    loadPlayGroup: '{provider} laden und abspielen — die übrigen auf dieser '
      + 'Seite werden mitgeladen',
    grantLoad: '{provider} laden und dauerhaft erlauben',
    grantLoadPlay: '{provider} laden, abspielen und dauerhaft erlauben',
    revoke: 'Einwilligung für {provider} zurücknehmen',
    loaded: 'Der Inhalt von {provider} wurde geladen.',
    loadedGroupOne: 'Eine weitere Einbettung von {provider} auf dieser Seite '
      + 'wurde ebenfalls geladen.',
    loadedGroupMany: '{count} weitere Einbettungen von {provider} auf dieser '
      + 'Seite wurden ebenfalls geladen.',
    withdrawn: 'Der Inhalt von {provider} wurde entfernt, weil die '
      + 'Einwilligung zurückgenommen wurde.',
    frameTitle: 'Eingebetteter Inhalt von {provider}',
  },

  en: {
    load: 'Load {provider}',
    loadPlay: 'Load and play {provider}',
    loadGroup: 'Load {provider} — and the others on this page',
    loadPlayGroup: 'Load and play {provider} — the others on this page are '
      + 'loaded too',
    grantLoad: 'Load {provider} and allow it permanently',
    grantLoadPlay: 'Load and play {provider}, and allow it permanently',
    revoke: 'Withdraw consent for {provider}',
    loaded: 'Content from {provider} has been loaded.',
    loadedGroupOne: 'One further embed from {provider} on this page has been '
      + 'loaded as well.',
    loadedGroupMany: '{count} further embeds from {provider} on this page '
      + 'have been loaded as well.',
    withdrawn: 'Content from {provider} has been removed because the '
      + 'consent was withdrawn.',
    frameTitle: 'Embedded content from {provider}',
  },
};



// An id is exactly 11 characters from YouTube's id alphabet.
function isYouTubeId(value) {
  return /^[\w-]{11}$/.test(value || '');
}



// Extracts the video id from whatever the CMS field holds: a bare id or any
// of the common URL shapes (watch?v=, youtu.be/, shorts/, embed/, live/ —
// with or without www./m., also youtube-nocookie). Returns "" when nothing
// usable is found so the caller can report it.
function youTubeId(raw) {
  const value = (raw || '').trim();

  if (isYouTubeId(value)) return value;

  let url;
  try {
    url = new URL(value);
  } catch {

    // Not a URL and not a bare id, so there is nothing left to try.
    return '';
  }

  const host = url.hostname.replace(/^(www|m)\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return isYouTubeId(id) ? id : '';
  }

  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return '';

  const fromQuery = url.searchParams.get('v');
  if (isYouTubeId(fromQuery)) return fromQuery;

  const segments = url.pathname.split('/').filter(Boolean);
  if (!['shorts', 'embed', 'live'].includes(segments[0])) return '';

  return isYouTubeId(segments[1]) ? segments[1] : '';
}



// Vimeo ids are numeric, and an unlisted video carries a second path segment
// — the privacy hash the player needs as `h`. Accepts "123456789",
// "123456789/abc123", a vimeo.com URL and a player.vimeo.com URL. Returns
// null when nothing usable is found.
function vimeoRef(raw) {
  const value = (raw || '').trim();

  const bare = value.match(/^(\d+)(?:\/([\w-]+))?$/);
  if (bare) return { id: bare[1], hash: bare[2] || '' };

  let url;
  try {
    url = new URL(value);
  } catch {

    // Not a URL and not a bare id, so there is nothing left to try.
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean);

  // player.vimeo.com/video/<id>, where the hash rides in the query instead.
  if (segments[0] === 'video') {
    return /^\d+$/.test(segments[1] || '')
      ? { id: segments[1], hash: url.searchParams.get('h') || '' }
      : null;
  }

  if (!/^\d+$/.test(segments[0] || '')) return null;

  return {
    id: segments[0],
    hash: /^[\w-]+$/.test(segments[1] || '') ? segments[1] : '',
  };
}



// The presets. Each one owns the whole URL it builds, because "the id" means
// something different per provider and squeezing all of them into one
// template would be a lie about three of the four.
//
// `autoplayParam` is the parameter the click lane adds and the gate lane
// never does (see 3 in the header). `allow` is the permissions policy the
// provider's player needs; a preset without one gets none.
//
// No preset uses a provider's own thumbnail endpoint for the poster, and
// none can: that request is the request this component exists to defer. The
// poster is the project's own file.
const providers = {

  youtube: {
    name: 'YouTube',

    // youtube-nocookie.com is the host Google offers for exactly this case,
    // and rel=0 keeps the end screen from advertising unrelated channels.
    resolve: (raw) => {
      const id = youTubeId(raw);
      return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : '';
    },

    autoplayParam: 'autoplay',
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media;'
      + ' gyroscope; picture-in-picture; web-share',
  },

  vimeo: {
    name: 'Vimeo',

    // dnt=1 is Vimeo's own "do not track": it stops the player storing
    // anything for analytics. Not a substitute for consent — the request
    // still happens — which is why it is behind the same gate as the rest.
    resolve: (raw) => {
      const ref = vimeoRef(raw);
      if (!ref) return '';

      const params = new URLSearchParams({ dnt: '1' });
      if (ref.hash) params.set('h', ref.hash);

      return `https://player.vimeo.com/video/${ref.id}?${params}`;
    },

    autoplayParam: 'autoplay',
    allow: 'autoplay; encrypted-media; picture-in-picture',
  },

  googleMaps: {
    name: 'Google Maps',

    // The keyless embed: the id is whatever you would type into the search
    // box — an address, a place name, a "lat,lng" pair. A project using the
    // keyed Maps Embed API passes its whole URL through
    // data-embedconsent-src instead, so no API key is built into a preset
    // here.
    resolve: (raw) => {
      const query = (raw || '').trim();
      if (!query) return '';

      const params = new URLSearchParams({ q: query, output: 'embed' });
      return `https://www.google.com/maps?${params}`;
    },

    allow: '',
  },

  openStreetMap: {
    name: 'OpenStreetMap',

    // Here so the cheapest answer to the whole consent question is one
    // attribute away: a map that needs no Google. The id is the bbox the
    // OSM export gives you, "minLon,minLat,maxLon,maxLat". Whether this one
    // needs consent at all is a question for the project — the IP still
    // travels — but there is no advertising business at the other end of it.
    resolve: (raw) => {
      const bbox = (raw || '').trim();
      if (!bbox) return '';

      const params = new URLSearchParams({ bbox, layer: 'mapnik' });
      return `https://www.openstreetmap.org/export/embed.html?${params}`;
    },

    allow: '',
  },
};



// The name to put in a label when no preset supplied one: the host the embed
// comes from, which is at least true and is what the notice is about anyway.
// Safe without a try/catch because every src that gets this far has already
// been through absoluteEmbedUrl().
function hostName(src) {
  return new URL(src).hostname.replace(/^www\./, '');
}



// data-embedconsent-src has to be an ABSOLUTE http(s) URL, and this is where
// that is enforced rather than hoped for. Two reasons, and neither is
// pedantry:
//
//   - A string the URL parser rejects would go into the iframe unchanged and
//     produce a broken frame on a button press. Reporting it and leaving the
//     fallback link in charge is the better failure.
//   - Resolved against the page instead, garbage becomes a same-origin URL —
//     which is how "::not a url::" ended up being announced as content from
//     the site's own host during development. A relative src is not a
//     third-party embed, and this component has nothing to say about one.
//
// Restricting the scheme comes free with it: javascript: and data: are not
// things to hand an iframe on a visitor's behalf.
function absoluteEmbedUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {

    // Not absolute, or not a URL at all — either way there is nothing here
    // that can be embedded.
    return '';
  }

  return url.protocol === 'https:' || url.protocol === 'http:' ? value : '';
}



// The hosts a provider serves its OWN preview images from. A poster taken
// from one of them is the very request this component defers: the visitor's
// IP is at the provider before anything has been agreed, while the box on
// screen says it is protecting them. It is the one authoring mistake that
// defeats the component silently — everything else fails loudly — which is
// what earns it a hostname list.
//
// Deliberately not a general "is this poster cross-origin" test: a project's
// own asset CDN is a perfectly good place for one, and a warning that cries
// wolf about it is a warning authors learn to scroll past.
const thumbnailHosts = [
  'ytimg.com',            // YouTube's thumbnail CDN — i.ytimg.com and friends
  'img.youtube.com',      // the /vi/<id>/hqdefault.jpg endpoint
  'vimeocdn.com',         // Vimeo's thumbnails
  'vumbnail.com',         // the third-party Vimeo thumbnail proxy
  'maps.googleapis.com',  // a Static Maps call used as a map "poster"
];



// The provider host a poster is loaded from, or "" where it is the project's
// own file. Relative to the document, because that is what the <img> does
// with it too.
function providerThumbnailHost(src) {
  let host;

  try {
    host = new URL(src, document.baseURI).hostname;
  } catch {

    // Not resolvable, so it is not a provider's endpoint either. A poster
    // that does not load is the project's own problem and a visible one.
    return '';
  }

  return thumbnailHosts.some(
    (name) => host === name || host.endsWith(`.${name}`)
  ) ? host : '';
}



// Every instance on this page that got as far as setup(). A set at module
// scope is what the chunk boundary already hands us — one import, one page
// view — and it is the idiom tooltip's `liveTooltips` and toast's `regions`
// use for the same reason. The references are strong ones, so destroy() has
// to take an instance out again.
const liveEmbeds = new Set();



// The group a box joins, or "" for a box that is on its own — which is the
// default and stays it: six unrelated videos keep costing six presses unless
// the author said otherwise.
//
// Keyed by the SERVICE TOKEN, which is the same identity the consent gate is
// asked for, so the grouping follows the granularity a project already
// decided rather than inventing a second one. A press about YouTube can
// therefore never fill a map: different recipient, different notice.
//
// An empty attribute means "group me by my service token"; a value names a
// group, so a hero video and one buried in a legal text can stay apart
// although both are YouTube.
//
// Read off an ELEMENT and not off an instance, because wireToggle has to ask
// the same question of boxes that have not been initialised yet — see the
// label comment there.
function groupKey(el) {
  if (!el.hasAttribute(defaults.groupAttr)) return '';

  return (el.getAttribute(defaults.groupAttr) || '').trim()
    || (el.getAttribute(defaults.serviceAttr) || '').trim()
    || (el.getAttribute(defaults.providerAttr) || '').trim();
}



class EmbedConsent {

  // The iframe this instance put in the page, or null. The single source of
  // truth for "is the embed in" — the facade's hidden state mirrors it, but
  // this is what is asked.
  frame = null;

  // The gate's last answer, so a change can be read as a TRANSITION. A
  // withdrawal must only ever tear down an embed the gate had granted; a
  // spurious event re-evaluating to the same "no" must not touch an embed
  // the visitor loaded with their own click.
  granted = false;

  // Returned by services.consent.subscribe(), or null when the project
  // configured no gate at all.
  unsubscribe = null;

  // Whether the shipped label was written into an empty authored button, so
  // destroy() knows whether there is a label to take back. One per button
  // this component may label.
  wroteLabel = false;
  wroteGrantLabel = false;
  wroteRevokeLabel = false;

  // Whether the permanent lane is live on this box: all five conditions in
  // point 9 held. Read by syncRevoke, which must not reveal a way back on a
  // box that was never offered a way in.
  permanent = false;

  // The group this box joins (see groupKey), "" for a box on its own.
  group = '';

  // Whether the box's own notice actually says something. Rule 4 is enforced
  // through this in BOTH directions: no notice, no button — and no notice,
  // no place in a group either. A press may be multiplied; it may not fill a
  // box that told the visitor nothing.
  informed = false;

  // Both halves of the description link, remembered because the notice is
  // the AUTHOR'S element (see wireToggle): either may have been there before
  // this component ran, and neither may be taken away if it was.
  generatedNoticeId = false;
  wroteDescribedBy = false;
  wroteGrantDescribedBy = false;



  constructor(root, services) {
    this.root = root;
    this.reporter = services.reporter;
    this.gate = services.consent;

    this.facade = root.querySelector(defaults.selFacade);
    this.notice = root.querySelector(defaults.selNotice);
    this.toggle = root.querySelector(defaults.selToggle);
    this.fallback = root.querySelector(defaults.selFallback);
    this.poster = root.querySelector(defaults.selPoster);
    this.grantBtn = root.querySelector(defaults.selGrant);
    this.revokeBtn = root.querySelector(defaults.selRevoke);

    // Asked once, here, because two separate rules read it (see `informed`).
    this.informed = !!this.notice?.textContent.trim();

    const locale = resolveLocale(
      Object.keys(labels), defaults.fallbackLocale
    );

    this.labels = labels[locale];

    // The language to mark this component's own strings with — but only
    // where it is not the page's already (see the Accessibility notes in
    // the header). The test is resolveLocale's own matching read backwards,
    // so lang="de-CH" resolving to "de" counts as the page's language.
    const pageLocale = (document.documentElement.lang || '').toLowerCase();

    this.labelsLang =
      pageLocale === locale || pageLocale.split('-')[0] === locale
        ? null
        : locale;

    if (!this.facade) {
      this.reporter?.report(
        'embedConsent',
        `no ${defaults.selFacade} element — everything shown before consent`
        + ' has to sit in one element, so it can be taken away in one move.'
        + ' Nothing is enhanced.', root
      );
      return;
    }

    this.provider = providers[
      (root.getAttribute(defaults.providerAttr) || '').trim()
    ] || null;

    this.source = this.resolveSource();
    if (!this.source) return;

    // A preset's own name, or the host the embed comes from. Never empty:
    // this.source is either a preset's URL or one absoluteEmbedUrl() let
    // through, and both have a hostname.
    this.providerName = this.provider?.name || hostName(this.source);

    this.title = (root.getAttribute(defaults.titleAttr) || '').trim();

    // Whether the frame's title is one of OURS, which is what decides
    // whether the iframe is marked with the label language: `lang` on an
    // element covers its attribute values, so it would otherwise claim the
    // author's own wording is English too.
    this.ownTitle = !this.title;

    if (!this.title) {
      this.title = this.say('frameTitle');

      this.reporter?.report(
        'embedConsent',
        `no ${defaults.titleAttr} set — the embedded frame needs an`
        + ` accessible title; using "${this.title}".`, root
      );
    }

    if (!this.fallback) {
      this.reporter?.report(
        'embedConsent',
        `no ${defaults.selFallback} link — without one a visitor who does`
        + ' not consent, and every visitor without JavaScript, has no way to'
        + ' the content at all.', root
      );
    }

    // The poster is optional, but where there is one it has to be the
    // project's own file. This is the only rule the component can check and
    // could not otherwise state loudly: a thumbnail pulled from the provider
    // makes exactly the request everything else here defers, and the page
    // looks correct while it happens.
    const thumbnailHost = this.poster
      && providerThumbnailHost(this.poster.getAttribute('src') || '');

    if (thumbnailHost) {
      this.reporter?.report(
        'embedConsent',
        `the poster is loaded from ${thumbnailHost}, which is the provider's`
        + ' own thumbnail endpoint — that request is the one this component'
        + " exists to defer, so the visitor's IP is at the provider before"
        + ' anything has been agreed. Serve the poster from your own domain.',
        this.poster
      );
    }

    this.setup();
  }



  // One localized string with the provider's name in it. Every string this
  // component has takes exactly that one token, which is why there is a
  // helper rather than four call sites repeating the same object.
  say = (key) => formatTemplate(
    this.labels[key], { provider: this.providerName }
  );



  // The iframe URL. data-embedconsent-src wins over a preset, because a
  // project that wrote a whole URL out has a reason the preset does not know
  // about (an API key, a start time, a player parameter).
  resolveSource = () => {
    const given = (this.root.getAttribute(defaults.srcAttr) || '').trim();

    if (given) {
      const url = absoluteEmbedUrl(given);

      if (!url) {
        this.reporter?.report(
          'embedConsent',
          `${defaults.srcAttr}="${given}" is not an absolute http(s) URL, so`
          + ' there is nothing to embed — a relative one is not a'
          + ' third-party embed and anything else would land in the iframe'
          + ' broken. Nothing is enhanced.', this.root
        );
        return '';
      }

      return url;
    }

    if (!this.provider) {
      this.reporter?.report(
        'embedConsent',
        `neither ${defaults.srcAttr} nor a recognized`
        + ` ${defaults.providerAttr} (${Object.keys(providers).join(', ')})`
        + ' — there is nothing to embed. Nothing is enhanced.', this.root
      );
      return '';
    }

    const raw = this.root.getAttribute(defaults.idAttr) || '';
    const src = this.provider.resolve(raw);

    if (!src) {
      this.reporter?.report(
        'embedConsent',
        `"${raw}" is not something ${this.provider.name} can be asked for —`
        + ` check ${defaults.idAttr}. Nothing is enhanced.`, this.root
      );
      return '';
    }

    return src;
  };



  setup = () => {
    this.service = (this.root.getAttribute(defaults.serviceAttr) || '').trim()
      || (this.root.getAttribute(defaults.providerAttr) || '').trim();

    this.category =
      (this.root.getAttribute(defaults.categoryAttr) || '').trim();

    // Will the click lane start a player? Only where the preset has an
    // autoplay parameter at all (a map has none) and the project has not
    // switched it off. Resolved here rather than at click time, because the
    // BUTTON LABEL is chosen from it — see point 3 in the header.
    this.autoplay = !!this.provider?.autoplayParam
      && (this.root.getAttribute(defaults.autoplayAttr) || '').trim()
        !== 'false';

    // Opt-in, and resolved before wireToggle because the shipped label has
    // to say whether the press reaches further than this box.
    this.group = groupKey(this.root);

    if (this.root.hasAttribute(defaults.groupAttr) && !this.group) {
      this.reporter?.report(
        'embedConsent',
        `${defaults.groupAttr} needs something to group BY — give this box a`
        + ` ${defaults.serviceAttr}, or name the group in the attribute`
        + ' itself. It stays on its own.', this.root
      );
    }

    this.buildStatus();
    this.wireToggle();

    // After wireToggle, because one of its five conditions is "the plain
    // load button is available", and only wireToggle knows that. Before
    // watchGate, because that may embed straight away on an existing
    // consent — and the way back has to exist by then.
    this.wirePermanent();

    this.watchGate();

    // One press may reach every other box in the same group, so an instance
    // has to be findable by its peers from here on. The reference is a
    // strong one — destroy() takes it out again.
    liveEmbeds.add(this);

    // Last, once the button is wired and the gate is being watched: the flag
    // means "the control in this box works", so it must not be written
    // before it does.
    this.root.setAttribute(defaults.readyAttr, '');
  };



  // The live region, built empty and up front rather than on first use: a
  // region inserted and filled in the same task is one some assistive
  // technology never announces, and both things this component has to say
  // arrive without warning.
  buildStatus = () => {
    const region = document.createElement('div');

    region.setAttribute(defaults.statusAttr, '');
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');

    // Everything ever written in here is one of this component's own
    // strings, so the region can carry the label language once instead of
    // each announcement marking itself.
    if (this.labelsLang) region.lang = this.labelsLang;

    this.root.append(region);
    this.status = region;
  };



  // The click lane. Switched on only where there is something to be informed
  // BY — see rule 4 in the header. A missing notice therefore costs the
  // button and nothing else: the fallback link and the gate lane both stay.
  wireToggle = () => {
    if (!this.toggle) {
      this.reporter?.report(
        'embedConsent',
        `no ${defaults.selToggle} button — the box can only be filled by the`
        + ' consent gate, and the fallback link is the only way in.',
        this.root
      );
      return;
    }

    if (!this.informed) {
      this.reporter?.report(
        'embedConsent',
        `no ${defaults.selNotice} text — a button that loads third-party`
        + ' content without saying who receives what is not informed'
        + ' consent, so it stays hidden. Write the notice (provider, what is'
        + ' transferred, a link to your privacy policy).', this.root
      );
      return;
    }

    // The information is attached to the control, not merely placed near it.
    //
    // Both halves are remembered, and that is not bookkeeping for its own
    // sake: unlike inputCharCount's and formValidation's status nodes, the
    // notice is the AUTHOR'S element. It may already carry an id, and the
    // button may already have been pointed at it by hand — in which case
    // this component added nothing and destroy() must take nothing away.
    if (!this.notice.id) {
      this.notice.id = uniqueId('embedConsent-notice');
      this.generatedNoticeId = true;
    }

    this.wroteDescribedBy = addDescribedBy(this.toggle, this.notice.id);

    // An author's own wording wins; the shipped label is what a CMS that
    // filled everything else in leaves behind. Which of the two shipped
    // labels it is follows this.autoplay, so the control cannot end up
    // saying "load" and then starting a player with sound. The language
    // goes on the button itself and not on a wrapper span: the only thing
    // in there is this string.
    if (!this.toggle.textContent.trim()) {
      const key = this.autoplay ? 'loadPlay' : 'load';

      // Does this press really reach further than this box? Asked of the
      // MARKUP rather than of liveEmbeds, and that is the whole subtlety:
      // init() runs per element as the loader walks the page, so the first
      // box writes its label before the last box has registered itself. The
      // document is parsed in full before boot.js runs at all, which makes
      // it the only complete answer available at this moment.
      const grouped = this.group && this.hasGroupPeers();

      this.toggle.textContent = this.say(grouped ? `${key}Group` : key);
      if (this.labelsLang) this.toggle.lang = this.labelsLang;

      // So destroy() can take back the label as well as the `hidden` it
      // toggled — an authored button that came in empty has to go out
      // empty.
      this.wroteLabel = true;
    }

    this.toggle.hidden = false;
    this.toggle.addEventListener('click', this.handleClick);
  };



  // Is there another box a press here would fill? A peer carries the same
  // group key AND has a notice of its own — the second half is rule 4 held
  // to: a press may be multiplied, but never into a box that told the
  // visitor nothing. (The gate lane may fill such a box, because there a
  // platform did its own informing.)
  //
  // Only ever asked for the label, which is why the markup is the right
  // source; who is actually filled is decided from liveEmbeds at press time.
  hasGroupPeers = () => [
    ...document.querySelectorAll(`[${defaults.groupAttr}]`),
  ].some((el) => el !== this.root
    && groupKey(el) === this.group
    && !!el.querySelector(defaults.selNotice)?.textContent.trim());



  // The permanent lane (point 9 in the header): the only control here whose
  // press outlives the page view, and therefore the only one with five
  // conditions in front of it. Every one of them reports, because a control
  // an author shipped and this component refused to reveal is exactly the
  // silence that would be read as a bug.
  //
  // Opt-in through the MARKUP: a box with neither button says nothing at
  // all. A project can wire the gate's callbacks for its whole site and
  // still offer the permanent choice at three boxes out of forty.
  wirePermanent = () => {
    if (!this.grantBtn && !this.revokeBtn) return;

    // A pair, and the pair is the point. GDPR Art. 7(3): withdrawing has to
    // be as easy as consenting, so a box that can grant with one press and
    // has no control to take it back is not a box this component completes.
    // Neither half is wired without the other — a lone "withdraw" would be
    // as wrong in the other direction, offering to take back something this
    // box never offered to give.
    if (!this.grantBtn || !this.revokeBtn) {
      this.reporter?.report(
        'embedConsent',
        `the permanent lane needs BOTH ${defaults.selGrant} and`
        + ` ${defaults.selRevoke} — withdrawing has to be as easy as`
        + ' consenting, so a grant control with no way back is not revealed.'
        + ` Missing: ${this.grantBtn ? defaults.selRevoke : defaults.selGrant}.`
        + ' Neither button is wired.', this.root
      );
      return;
    }

    // One check for two causes: an author who shipped no load button at all,
    // and rule 4, which is wireToggle leaving the button hidden because there
    // is no notice to be informed by. Both end here, and both are reported
    // there. What this adds is the reason of its own — a box offering ONLY
    // the permanent choice would make a lasting decision the price of
    // watching one video.
    if (!this.toggle || this.toggle.hidden) {
      this.reporter?.report(
        'embedConsent',
        `the plain ${defaults.selToggle} button is not available in this box,`
        + ' so the permanent control is not either — it would make a lasting'
        + ' decision the only way to see the content. The reason the load'
        + ' button is unavailable is reported above.', this.root
      );
      return;
    }

    // Whether a decision can be handed to the platform at all is the
    // project's answer, given once in boot.js. No callbacks — and every TCF
    // setup, which has no write API — means no control, rather than a
    // control that quietly only covers the page view.
    if (!this.gate?.canGrant()) {
      this.reporter?.report(
        'embedConsent',
        'the consent gate cannot hand a decision to your platform, so the'
        + ' permanent control stays hidden. Pass grant AND revoke to'
        + ' createConsentGate() in boot.js (or on window.consentGateOptions)'
        + ' — see createConsentGate.js for what belongs in them, and why a'
        + ' category-only platform should not have them at all.', this.root
      );
      return;
    }

    // The identity that is granted has to be the specific one. A category is
    // more than this notice explained, and translating one into the other is
    // the project's decision at the composition root, not this component's.
    if (!this.service) {
      this.reporter?.report(
        'embedConsent',
        `the permanent control needs a ${defaults.serviceAttr} to grant. The`
        + ` ${defaults.categoryAttr} token is not a substitute: granting a`
        + ' whole category from a single embed grants more than the notice'
        + ' explained. It stays hidden.', this.root
      );
      return;
    }

    // The information is attached to this control too — it is the one that
    // asks for more than the other, so it may not ask for it with less.
    this.wroteGrantDescribedBy = addDescribedBy(this.grantBtn, this.notice.id);

    if (!this.grantBtn.textContent.trim()) {
      this.grantBtn.textContent = this.say(
        this.autoplay ? 'grantLoadPlay' : 'grantLoad'
      );

      if (this.labelsLang) this.grantBtn.lang = this.labelsLang;
      this.wroteGrantLabel = true;
    }

    if (!this.revokeBtn.textContent.trim()) {
      this.revokeBtn.textContent = this.say('revoke');

      if (this.labelsLang) this.revokeBtn.lang = this.labelsLang;
      this.wroteRevokeLabel = true;
    }

    this.grantBtn.hidden = false;
    this.grantBtn.addEventListener('click', this.handleGrant);
    this.revokeBtn.addEventListener('click', this.handleRevoke);

    // The revoke button stays hidden: syncRevoke reveals it only while a
    // platform-held consent is what is filling this box.
    this.permanent = true;
  };



  // The press does what the plain one does FIRST, and asks the platform
  // second. That order is the header's rule about the gate held to in the one
  // place it could be forgotten: a consent that never arrives anywhere — a
  // CMP removed by a content blocker, a callback wrong about its version —
  // must still leave the visitor with the content they pressed for.
  //
  // The group fan-out comes along for the same reason. Where the grant does
  // arrive, it is redundant (the gate reaches every box asking for this
  // token, group or no group); where it does not, it is the press behaving
  // exactly as the plain button would have.
  handleGrant = () => {
    this.embed('click');
    this.loadGroup();

    if (this.gate.grant(this.service)) return;

    this.reporter?.report(
      'embedConsent',
      `the consent gate could not hand "${this.service}" to your platform, so`
      + ' this press covered the page view and nothing beyond it — while the'
      + ' button promised otherwise. Check the grant callback against the CMP'
      + ' version actually running.', this.root
    );
  };



  // The way back. The platform is asked, and the embed goes either way —
  // a reader who pressed "withdraw" may not be left looking at the content
  // they just refused while a callback makes up its mind. Where the platform
  // answers, `granted` is already false by then, so the gate's own
  // withdrawal path finds nothing left to do rather than running twice.
  //
  // And where a platform answers "still granted" anyway, the gate re-embeds
  // it: the CMP's word is the later and the more general one, exactly as on
  // a withdrawal that arrives from a banner. That is a loud wiring bug
  // rather than a quiet one, which is the point.
  handleRevoke = () => {
    const reached = this.gate.revoke(this.service);

    this.granted = false;
    this.retract();

    if (reached) return;

    this.reporter?.report(
      'embedConsent',
      `the consent gate could not take "${this.service}" back at your`
      + ' platform, so this box is empty again but the consent may well still'
      + ' be stored. Check the revoke callback against the CMP version'
      + ' actually running.', this.root
    );
  };



  // The way back is offered exactly while there is something to go back
  // FROM: an embed that is in the box because the PLATFORM says so. After a
  // plain click there is nothing to withdraw — a reload takes that one back
  // on its own — and a "withdraw consent" button there would be a control
  // that describes something this component never did.
  // Idempotent on purpose: it is called from embed(), from retract() and from
  // the gate's own change handler, because those three do not cover each
  // other. embed() short-circuits on a box the visitor had already clicked
  // in, and that box still gains a consent there is now something to
  // withdraw.
  syncRevoke = () => {
    if (!this.permanent) return;

    this.revokeBtn.hidden = !(this.granted && this.frame);
  };



  watchGate = () => {
    if (!this.gate) return;

    if (!this.service && !this.category) {
      this.reporter?.report(
        'embedConsent',
        `neither ${defaults.serviceAttr} nor ${defaults.categoryAttr} —`
        + ' there is no token to ask the consent gate for, so an existing'
        + ' consent can never be honoured and every visitor is asked again.',
        this.root
      );
      return;
    }

    this.unsubscribe = this.gate.subscribe(this.handleGateChange);

    this.granted = this.gate.has(this.service, this.category);
    if (this.granted) this.embed('initial');
  };



  // A change is read as a transition, not as a state (see `granted`).
  handleGateChange = () => {
    const next = this.gate.has(this.service, this.category);
    const previous = this.granted;

    this.granted = next;

    if (next) this.embed('granted');

    // Withdrawn: the consent that put this here has been taken back, and
    // that is true even for an embed the visitor clicked in themselves — a
    // CMP decision is the later and the more general one.
    else if (previous) this.retract();

    // Outside both branches, and that is the case it exists for: a box the
    // visitor had already clicked in gains a platform-held consent without
    // anything else changing, because embed() finds a frame and returns. The
    // way back has to appear all the same.
    this.syncRevoke();
  };



  handleClick = () => {
    this.embed('click');
    this.loadGroup();
  };



  // The press, multiplied — and only the press. A WITHDRAWAL is never
  // propagated: the gate reaches every box on its own, and there is no
  // control here that would take one back.
  //
  // Own box first, peers after. The focus move belongs to the box the reader
  // pressed and should happen before five other boxes rearrange the page
  // under them.
  //
  // The fan-out hangs here and not in embed(), which is what keeps it one
  // level deep: a peer filled by a group must not go looking for a group of
  // its own.
  //
  // Worth knowing what this does NOT reinstate: a box the gate emptied on a
  // withdrawal is filled again by a press, exactly as five individual
  // presses would fill five of them. Deciding otherwise here would mean
  // forbidding the single press too, and the click lane is the one thing the
  // gate may never overrule (see the header).
  loadGroup = () => {
    if (!this.group) return;

    let count = 0;

    // Over a copy, for the reason createConsentGate copies its listener set:
    // nothing in this loop may be surprised by the set changing under it.
    for (const other of [...liveEmbeds]) {
      if (other === this || other.group !== this.group) continue;
      if (!other.informed || other.frame) continue;

      other.embed('group');
      count += 1;
    }

    if (count) this.announceGroup(count);
  };



  // Four ways an embed can come to be, and each answers a different
  // question:
  //
  //   'click'    the visitor pressed the button. The player may start (that
  //              is what they asked for) and nothing is announced — they
  //              know what they just did.
  //   'granted'  consent arrived while the page was open, most likely from a
  //              banner elsewhere on it. No autoplay, and it IS announced:
  //              content appeared that nobody on this page asked for.
  //   'initial'  consent was already in place when the page was built. No
  //              autoplay, and nothing announced either — from the reader's
  //              side the embed was simply part of the page, and a "content
  //              has been loaded" on every page load is noise, not
  //              information.
  //   'group'    a peer's button was pressed and this box is in the same
  //              group. No autoplay — nobody pressed anything here, and five
  //              players starting at once is precisely WCAG 2.2.2 — and
  //              silent, because the box that WAS pressed announces once on
  //              behalf of the whole group.
  embed = (reason) => {
    if (this.frame) return;

    const hadFocus = this.root.contains(document.activeElement);
    const frame = document.createElement('iframe');

    frame.src = this.embedSource(reason === 'click');
    frame.title = this.title;

    // Only where the title is the component's own fallback: `lang` covers
    // an element's attribute values, so on an author-supplied title this
    // would mislabel their wording. It says nothing about the language of
    // the embedded document, which is that document's own business.
    if (this.ownTitle && this.labelsLang) frame.lang = this.labelsLang;

    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute(defaults.embedAttr, '');

    const allow = this.root.getAttribute(defaults.allowAttr)
      ?? this.provider?.allow;

    if (allow) frame.setAttribute('allow', allow);

    this.root.append(frame);
    this.frame = frame;

    this.facade.hidden = true;

    // The focus is only ever moved because it would otherwise be destroyed
    // along with the box it stood in — which is the click lane every time,
    // and the gate lane when a banner left the focus in here.
    //
    // preventScroll, because the frame takes exactly the box the facade had.
    // The reader pressed something they could see, so there is nothing to
    // bring into view; without it a box only partly in view would be pulled
    // up under the reader, which is a scroll nobody asked for.
    if (hadFocus) frame.focus({ preventScroll: true });

    this.syncRevoke();

    if (reason === 'granted') this.announce('loaded');
  };



  embedSource = (fromUser) => {
    if (!fromUser || !this.autoplay) return this.source;

    // Pressing "load and play the video" is a request to watch it, so the
    // player may start. Built through the URL API rather than string
    // concatenation because a project's own src may already carry a query —
    // and without a try/catch, because a source that reached this point
    // either came out of a preset or through absoluteEmbedUrl(), so the
    // parser cannot fail on it.
    const url = new URL(this.source);

    url.searchParams.set(this.provider.autoplayParam, '1');

    return url.toString();
  };



  retract = () => {
    if (!this.frame) return;

    // Asked of the ROOT rather than of the frame, because the frame is not
    // the only thing in here that is about to disappear: the reader may be
    // standing on the revoke button they just pressed, and syncRevoke is
    // seconds away from hiding it. Everything else in the root is either the
    // facade, which is coming back, or nothing.
    const hadFocus = this.root.contains(document.activeElement);

    this.frame.remove();
    this.frame = null;

    this.facade.hidden = false;

    // Before the focus lands, so the landing place is picked from what is
    // actually there — and so the control the reader may be standing on is
    // gone by the time anything is moved.
    this.syncRevoke();

    // The reader was standing in a frame that no longer exists; without this
    // the focus falls back to <body> and their place in the page is gone.
    // The button is the natural landing place — unless it is the hidden one
    // a missing notice leaves behind, in which case the link is what is
    // actually there.
    if (hadFocus) {
      const landing = this.toggle && !this.toggle.hidden
        ? this.toggle
        : this.fallback;

      // Same box, same reason as in embed(): nothing to bring into view.
      landing?.focus({ preventScroll: true });
    }

    this.announce('withdrawn');
  };



  announce = (key) => {
    if (!this.status) return;

    this.status.textContent = this.say(key);
  };



  // One announcement for the whole group, from the box that was pressed. Its
  // own embed stays as silent as ever — the reader knows what they just did.
  // What they cannot know is that other boxes filled as well, and that is
  // the one thing here worth saying.
  //
  // Two forms rather than Intl.PluralRules: de and en have exactly two
  // cardinal forms each, and the count is an integer this component produced
  // itself. A locale with more forms is the moment to reach for it, and not
  // before.
  announceGroup = (count) => {
    if (!this.status) return;

    this.status.textContent = formatTemplate(
      this.labels[count === 1 ? 'loadedGroupOne' : 'loadedGroupMany'],
      { provider: this.providerName, count }
    );
  };



  // Puts the element back the way it was authored: the facade visible, the
  // button hidden and undescribed, nothing of this component's own left in
  // the DOM. Called by the loader's destroyModulesInScope().
  destroy = () => {

    // First: a box that is on its way out must not still be findable by a
    // peer's press.
    liveEmbeds.delete(this);

    this.unsubscribe?.();
    this.unsubscribe = null;

    this.toggle?.removeEventListener('click', this.handleClick);
    this.grantBtn?.removeEventListener('click', this.handleGrant);
    this.revokeBtn?.removeEventListener('click', this.handleRevoke);

    // Only what this component actually wrote. An author who had already
    // described their button by their own notice keeps both the link and
    // the id (see wireToggle).
    if (this.toggle && this.wroteDescribedBy && this.notice?.id) {
      removeDescribedBy(this.toggle, this.notice.id);
      this.wroteDescribedBy = false;
    }

    if (this.grantBtn && this.wroteGrantDescribedBy && this.notice?.id) {
      removeDescribedBy(this.grantBtn, this.notice.id);
      this.wroteGrantDescribedBy = false;
    }

    if (this.generatedNoticeId) {
      this.notice.removeAttribute('id');
      this.generatedNoticeId = false;
    }

    if (this.toggle) {
      this.toggle.hidden = true;

      // A button that came in empty goes out empty: the shipped label and
      // the language marking on it are this component's, not the author's.
      if (this.wroteLabel) {
        this.toggle.textContent = '';
        this.toggle.removeAttribute('lang');
        this.wroteLabel = false;
      }
    }

    // The permanent lane's pair goes back the same way: both shipped
    // `hidden`, and a button that came in empty goes out empty.
    if (this.grantBtn) {
      this.grantBtn.hidden = true;

      if (this.wroteGrantLabel) {
        this.grantBtn.textContent = '';
        this.grantBtn.removeAttribute('lang');
        this.wroteGrantLabel = false;
      }
    }

    if (this.revokeBtn) {
      this.revokeBtn.hidden = true;

      if (this.wroteRevokeLabel) {
        this.revokeBtn.textContent = '';
        this.revokeBtn.removeAttribute('lang');
        this.wroteRevokeLabel = false;
      }
    }

    this.permanent = false;

    this.frame?.remove();
    this.frame = null;

    this.status?.remove();
    this.status = null;

    this.facade.hidden = false;
    this.root.removeAttribute(defaults.readyAttr);
  };
}



export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'embedConsent',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new EmbedConsent(el, services);

  // A bail-out in the constructor leaves nothing to tear down — and it must
  // not hand back a cleanup that would restore state it never changed.
  return instance.status ? instance.destroy : undefined;
}
