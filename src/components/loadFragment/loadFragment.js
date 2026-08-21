/**
 * loadFragment.js
 * ----------------------------------------------------------------------------
 * A link navigates: it replaces the whole page. Putting ONE region of another
 * page into a box that is already in this one — the body of a dialog, a panel
 * beside a list, a detail view under a table row — is the thing HTML has no
 * element for. <iframe> is not it: that is a second document with its own
 * stylesheet, its own scrollbar and its own accessibility tree, sitting in a
 * box this page cannot lay out from the inside.
 *
 * This module closes that gap, and it is deliberately the smallest thing that
 * can. It boots on the LINK. On a plain left click it fetches the link's own
 * href, takes the elements matching data-fragment-select out of the answer,
 * puts them into the element named by data-fragment-target and hands that
 * subtree to the loader so the components inside it come alive. It does not
 * route, does not touch the history, does not submit anything and owns no
 * vocabulary of its own: it writes one state attribute,
 *   data-fragment-state="loading" | "error"
 * on the target (and "loading" on the link while its own request runs), and
 * that attribute is the whole styling hook. The one element it creates is the
 * live region it says those two states through — [data-fragment-status],
 * inside the target — because a state that is only drawn is a state half the
 * readers of a page never learn about.
 *
 * The link is the point. Without JavaScript, before the chunk has arrived and
 * on every failure this module can see coming, the click does what the markup
 * says it does: it opens the page the href names. So the URL has to be a real
 * page — which is also why the default lane fetches that page and picks a
 * region out of it, rather than asking the server for a partial that would be
 * broken to navigate to.
 *
 * What the platform already does, and is therefore not re-done here
 * ----------------------------------------------------------------------
 *   - The anchor stays an anchor. The href, the keyboard, the context menu,
 *     the status bar, "open in new tab" and a middle click are the browser's,
 *     and a modified click is never intercepted. Nothing here rebuilds a
 *     control that already exists (see the rule of least power); the module
 *     adds one behaviour to the plain left click and leaves the rest alone.
 *   - DOMParser gives an INERT document: no script in it runs, no <img>,
 *     <iframe> or stylesheet in it makes a request, and nothing is upgraded
 *     until the nodes are adopted into this page. Assigning the answer to
 *     innerHTML would start all of that while the markup is still being
 *     decided, which is why the answer is parsed and not assigned.
 *   - AbortController cancels a request that is no longer wanted, so there is
 *     no "ignore this answer when it comes" bookkeeping.
 *   - aria-busy is the platform's own "this region is not finished yet", and
 *     it is written around the EXCHANGE rather than around the request: a
 *     target the author made a live region therefore announces ONCE, when the
 *     content is complete and enhanced, instead of narrating a half-filled
 *     box. It deliberately does not span the whole request — a live region
 *     inside a busy one is a region whose updates may be held back, and this
 *     load has something to say while it is running (see 8 below). The window
 *     it does cover is not a formality either: initModulesInScope() imports
 *     the chunks of whatever arrived, so it is the longest part of the swap.
 *   - role="status" is the platform's polite live region: text written into it
 *     is read out once, in turn, without taking the focus anywhere.
 *   - boot.js already knows how to enhance and tear down a subtree:
 *     initModulesInScope() / destroyModulesInScope() exist for exactly this
 *     case and arrive through `services`. This module calls them; it does not
 *     carry its own idea of what a component is.
 *
 * What the script adds
 * --------------------
 *   1. One click, one region. The answer is parsed, data-fragment-select is
 *      resolved against it and every match is inserted, in document order —
 *      so the selector can name the wrapper to keep (".teaser") or the
 *      children to unwrap ("main > *"). Without it the whole answer body is
 *      taken, which is the lane for an endpoint that already returns exactly
 *      the fragment.
 *   2. Same-origin only, and it says so. A cross-origin href is not fetched
 *      at all: the click is left to the browser, which navigates. Foreign
 *      markup adopted into this document would run under this document's
 *      origin, and no selector makes that safe.
 *   3. The last click wins — per TARGET, not per link. Two links can fill one
 *      box (two tabs, a list of rows and one detail panel), so which load
 *      owns it is kept with the box; a new load calls the running one off,
 *      and the called-off one writes nothing.
 *   4. Loaded once. A target already showing this exact URL is not fetched
 *      again unless the link carries data-fragment-refresh — reopening the
 *      dialog costs nothing, and a volatile panel opts into the round trip.
 *      Such a click does clear an error state a load in between left on the
 *      box: what stands there is what was just asked for, so it must not go
 *      on being dressed as a failure.
 *   5. What arrives is enhanced, what leaves is torn down: every load calls
 *      destroyModulesInScope() on the target before replacing its content and
 *      initModulesInScope() on it afterwards. The busy state is held until
 *      that has finished, so nobody is shown the unenhanced markup of the
 *      fragment for a frame.
 *   6. <script> elements inside the selected fragment are removed and
 *      reported. They would not run — the HTML spec marks a parser-created
 *      script as already started — so leaving them in the page would mean
 *      shipping behaviour that looks present and is not. What the answer
 *      carries outside the selection is never touched.
 *   7. Every failure it can see before the fetch leaves the click to the
 *      browser (no target in the document, a cross-origin href): the reader
 *      gets the page the link promised. A failure after it — HTTP error,
 *      network, nothing matching the selector — writes the error state and
 *      changes nothing else, so whatever the box held is still there and the
 *      link can be clicked again.
 *   8. Both states are SAID, not only drawn. The two sentences a load can
 *      need — it is loading, it could not be loaded — ship in de and en, are
 *      overridable per link, and are written into a role="status" region
 *      inside the target. An outline is not a status message: a failed load
 *      that is only styled is a failed load nobody on a screen reader is told
 *      about, and a request that takes three seconds is three seconds of
 *      silence after activating a link that normally navigates.
 *   9. The answer's language comes along. The lang that stated it sits on the
 *      answer's <html> and stays behind there, so a fragment out of a
 *      document whose language differs from the target's gets that lang
 *      written onto the elements taken from it — otherwise an English
 *      fragment is read out in German by a German page.
 *  10. A focus that stood INSIDE the box survives the exchange. It is the one
 *      case where the module moves the focus, and the reason is the same one
 *      that keeps it still everywhere else (see below).
 *  11. An id the fragment brings that this page already has is reported. A
 *      duplicate id silently breaks every label and aria-* reference that
 *      points at it, and it is the failure a selector chosen around a wrapper
 *      walks into most easily.
 *
 * Accessibility
 * -------------
 * The focus stays where it is, with one exception. Where the fragment lands
 * in an overlay the host has already placed it (dialog moves focus in on
 * open, and a second jump would fight it); where it lands in the page, a
 * reader who clicked "details" asked for content, not for their place in the
 * document to be taken away from them.
 *
 * The exception is the same argument read the other way round: if the focus
 * stood inside the box, replacing that box's content destroys the element
 * holding it and the focus falls back to <body> — the reader's place in the
 * document is taken away by doing nothing, and the tab order starts from the
 * top of the page. That happens as soon as a loaded fragment contains a link
 * that fills the same box again (a paginated list in a detail panel), so the
 * module puts the focus on the target instead: the box the reader was already
 * in, holding the content they just asked for.
 *
 * What the module says about the region, it says twice over, because the two
 * channels answer different questions:
 *   - aria-busy on the target while the exchange runs — "not finished yet",
 *     so a live region announces the result once rather than in pieces.
 *   - a role="status" region inside the target, carrying the loading and the
 *     error sentence. This is the part a purely visual busy look cannot do:
 *     a turning ring and an outline are invisible to a screen reader, and
 *     WCAG 4.1.3 asks for the status, not for the styling of it.
 * Give the target aria-live="polite" as well where it is not an overlay: the
 * status region says that the load is running and whether it failed, the live
 * region is what announces the arrived CONTENT. A target that is neither a
 * live region nor inside an overlay is reported.
 *
 * Nothing is ever hidden to make room: the target keeps whatever it holds
 * until the replacement is in hand, and the shipped busy look dims that
 * content instead of removing it. A fragment that never arrives therefore
 * costs the reader nothing they had — and the link is still a link, so the
 * page it points at stays one click away.
 *
 * The fragment brings its own headings and landmarks with it. Pick the
 * selector accordingly: a <main> or a second <h1> lifted into a dialog is a
 * document outline nobody can read, and this module cannot know that for you.
 * What it can see it reports — an id that is now in the page twice.
 *
 * Configuration (attributes on the link)
 * --------------------------------------
 *   - data-fragment-target="..." REQUIRED. CSS selector for the element the
 *       fragment is put into, resolved against the whole document. A target
 *       that is not there when the link is clicked is reported, and the click
 *       navigates instead.
 *   - data-fragment-select="..." CSS selector resolved against the ANSWER;
 *       every match is inserted, in document order. Default: the whole body
 *       of the answer — for an endpoint that already returns the fragment.
 *   - data-fragment-refresh (presence) fetch again on every click, for a
 *       panel whose content can change. Default: a target already showing
 *       this URL is left alone.
 *   - data-fragment-loading-text="..." / data-fragment-error-text="..."
 *       what the status region says. Default: the built-in sentence in the
 *       page's language (see labels). An EMPTY value opts the announcement
 *       out — for a host that writes its own, not as a way to save two
 *       attributes.
 * ----------------------------------------------------------------------------
 */



import { resolveLocale } from './resolveLocale.js';



const defaults = {

  // Written on the LINK by init(), removed again by the cleanup function.
  // Only ever written, never read back. Unlike most ready attributes in this
  // collection it is set at the END of a successful construction rather than
  // as the first statement: nothing here is hidden before init(), so there is
  // no state a bail-out would have to lift — and an author who marks these
  // links in their CSS ("opens in place") is promised the truth. A link the
  // module bailed on stays a plain link and does not claim otherwise.
  readyAttr: 'data-loadfragment-ready',

  // Written on the target while a load runs and left there as "error" when
  // one failed; written on the link while its own request runs. Not
  // overridable from the markup: the shipped SCSS keys the busy look and the
  // error look off these exact names.
  stateAttr: 'data-fragment-state',
  loadingState: 'loading',
  errorState: 'error',

  // Marks the role="status" region the module puts inside the target. Not a
  // class, for the same reason nothing else here is one: the module owns no
  // vocabulary, and the shipped stylesheet addresses this attribute. It is
  // the target's own child so it travels with the box rather than with either
  // link, and it is the only DOM this module creates.
  statusAttr: 'data-fragment-status',

  // <html lang> matching none of the locales in `labels` falls back to this
  // one.
  fallbackLocale: 'en',

  // Sent with every request. Accept says what is wanted back; the second one
  // is the value that every server-side framework's "is this an in-page
  // request" helper tests for — interop, not a description of the transport,
  // which is fetch. A server that answers it with a partial instead of the
  // whole page owes a "Vary: X-Requested-With" with it, or a cache will hand
  // the fragment to a reader who asked for the page.
  headers: {
    'Accept': 'text/html',
    'X-Requested-With': 'XMLHttpRequest',
  },

  // Same-origin cookies ride along, which is what fetch does by default
  // anyway — it is stated so that "is the logged-in area readable this way"
  // is answered in this file. Cross-origin URLs never get as far as the
  // request (see handleClick).
  credentials: 'same-origin',
};



// What the status region says, keyed by locale. Two sentences, because there
// are two things a load can report that the reader cannot see otherwise: it
// is running, or it did not arrive. Success is not in here — the arrived
// content is its own announcement, which is what the target's aria-live is
// for, and a "loaded" sentence on top of it would be read out twice.
//
// Plain full sentences and no template tokens: this is read out, and neither
// the URL nor the HTTP status is anything to say to a reader. What failed is
// the reporter's business.
const labels = {

  de: {
    loading: 'Der Inhalt wird geladen.',
    error: 'Der Inhalt konnte nicht geladen werden.',
  },

  en: {
    loading: 'The content is loading.',
    error: 'The content could not be loaded.',
  },
};



// Which load owns which target. Two links can point at the same box — two
// tabs filling one panel, a table of rows filling one detail view — so the
// answer to "who is filling it now" cannot live on either link: it belongs to
// the box. Weakly keyed, so a target that leaves the document takes its entry
// with it.
//
// The record is { controller, loading, url }: the request in flight (null
// between loads), the URL that request is for, and the URL whose content is
// standing in the target right now. The last one is what makes "already
// loaded, nothing to do" a question about the box rather than about a link.
const loads = new WeakMap();



class LoadFragment {

  // The load this instance started and has not finished, or null. Read by
  // destroy() only — everyone else asks the registry, which is what knows
  // who owns a target.
  current = null;

  // The tabindex this instance lent a target in order to be able to focus it,
  // as { target, release }, or null. Kept because the reader's blur is not
  // the only way out: a link torn down while nobody is standing on the box
  // would never see that blur, and the attribute would stay behind (see
  // recoverFocus and destroy).
  borrowedTabindex = null;



  // Takes the whole services object and not just the reporter, because the
  // loader is the second collaborator here: enhancing what arrives is half
  // of what this module does (see swap).
  constructor(root, services) {
    this.root = root;
    this.reporter = services.reporter;
    this.initScope = services.initModulesInScope;
    this.destroyScope = services.destroyModulesInScope;

    // The trigger has to be a link, because the whole progressive-enhancement
    // story is that the same click still works without this module. A button
    // has nowhere to fall back to.
    if (!(root instanceof HTMLAnchorElement) || !root.getAttribute('href')) {
      this.reporter?.report(
        'loadFragment',
        'expects an <a> with an href — the trigger has to be a link, so the ' +
        'same click works before and without this module.', root
      );
      return;
    }

    this.targetSelector = (root.dataset.fragmentTarget || '').trim();

    if (!this.targetSelector) {
      this.reporter?.report(
        'loadFragment',
        'no data-fragment-target, so there is nowhere to put anything; the ' +
        'link is left as it is.', root
      );
      return;
    }

    this.select = (root.dataset.fragmentSelect || '').trim();
    this.refresh = root.hasAttribute('data-fragment-refresh');

    // resolveLocale: Intl knows every locale, this module knows two. An
    // author attribute wins over both — including an empty one, which is why
    // this reads ?? and not ||: "" is a decision (say nothing), a missing
    // attribute is not.
    const strings =
      labels[resolveLocale(Object.keys(labels), defaults.fallbackLocale)];

    this.texts = {
      loading: root.dataset.fragmentLoadingText ?? strings.loading,
      error: root.dataset.fragmentErrorText ?? strings.error,
    };

    // A live region has to be in the document BEFORE the text lands in it, or
    // the platform has nothing to notice a change against — so the region is
    // built now, at boot, whenever the target can already be found. A target
    // rendered later is caught on the first click instead (see handleClick),
    // which is a frame's worth of risk on that one load rather than on every
    // one of them.
    const target = document.querySelector(this.targetSelector);
    if (target) this.prepare(target);

    root.addEventListener('click', this.handleClick);
    root.setAttribute(defaults.readyAttr, '');
  }



  // Everything about the target that is worth doing once rather than per
  // click: the status region exists, and the way this box announces has been
  // looked at. Both are about the box, so both are done as soon as there is
  // one — whichever of the two moments that turns out to be.
  prepare = (target) => {
    if (this.prepared) return;
    this.prepared = true;

    if (this.texts.loading || this.texts.error) this.buildRegion(target);

    // aria-busy states that the box is not finished; it does not state that
    // it is finished NOW. What announces the arrived fragment is the target
    // being a live region — or the reader having been moved into it, which is
    // what an overlay host does on open. A box that is neither gets the
    // content in silence, and no attribute this module writes can fix that
    // from the inside.
    const announces = target.closest(
      '[aria-live], [role="status"], [role="alert"], [role="log"], ' +
      'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]'
    );

    if (announces) return;

    this.reporter?.report(
      'loadFragment',
      `the target ("${this.targetSelector}") is neither a live region nor ` +
      'inside an overlay, so the fragment arrives without being announced: ' +
      'give it aria-live="polite", or open it in something that moves the ' +
      'focus into it.', target
    );
  };



  // The status region: the module's one piece of own DOM, and the target's
  // child rather than the link's, because two links can fill one box and the
  // sentence belongs to the box. role="status" carries an implicit polite
  // aria-live; the explicit one is stated anyway, the way every announcing
  // component here states it.
  //
  // ":scope >" and not a plain descendant lookup: a fragment can arrive with
  // a region of its own in it (a page that itself loads fragments), and that
  // one is content, not this module's instrument.
  buildRegion = (target) => {
    const existing = target.querySelector(`:scope > [${defaults.statusAttr}]`);
    if (existing) return existing;

    const region = document.createElement('div');

    region.setAttribute(defaults.statusAttr, '');
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    target.append(region);

    // Remembered so destroy() can take back the DOM this instance added, and
    // only that: a region another link built is that link's to remove.
    this.ownRegion = region;

    return region;
  };



  // One sentence, or none. An empty text is an author opting out, so it
  // clears a region that exists and does not build one that does not.
  announce = (target, text) => {
    const existing = target.querySelector(`:scope > [${defaults.statusAttr}]`);

    if (!existing && !text) return;

    (existing || this.buildRegion(target)).textContent = text;
  };



  // One plain left click, and nothing else. Everything the browser means by
  // a modified click — a new tab, a new window, a download, a named target —
  // is the reader asking for the page somewhere else, and that is not this
  // module's to take away.
  handleClick = (event) => {
    if (event.defaultPrevented) return;
    if (event.button) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (this.root.target || this.root.hasAttribute('download')) return;

    // Cross-origin markup adopted into this document would run under this
    // document's origin. There is no selector that makes that safe, so the
    // click is handed back to the browser: navigating there is exactly what
    // the reader asked for, and the foreign page then stays a foreign page.
    const url = new URL(this.root.href, document.baseURI);

    if (url.origin !== window.location.origin) {
      this.reporter?.report(
        'loadFragment',
        `"${url.origin}" is not this page's origin; the click navigates ` +
        'instead of loading the answer into the page.', this.root
      );
      return;
    }

    // Resolved per click and not once at init: the target can be rendered
    // later than the link, and a box that is gone by now must not swallow the
    // click. Reported and left to the browser — the reader gets the page.
    const target = document.querySelector(this.targetSelector);

    if (!target) {
      this.reporter?.report(
        'loadFragment',
        `no element matches data-fragment-target ("${this.targetSelector}"); ` +
        'the click navigates instead.', this.root
      );
      return;
    }

    // No-op unless the target was rendered after this link was booted.
    this.prepare(target);

    event.preventDefault();
    this.load(target, url.href);
  };



  // Fetch, parse, swap. The three early returns above it are the ones that
  // still leave the browser its click; from here on the click is spent, so
  // every ending has to leave the reader with something — the new content,
  // or what was there plus the error state.
  load = async (target, url) => {
    const previous = loads.get(target);

    // The same link clicked again while its own request is running is a
    // double click, not a second instruction.
    if (previous?.controller && previous.loading === url) return;

    // Already showing exactly this. Reopening a dialog is free, and a panel
    // that must not be is the one that carries data-fragment-refresh.
    //
    // One thing this path still owes the reader. fail() deliberately leaves
    // `url` pointing at the content that is actually standing in the box, so
    // a load that failed IN BETWEEN left its error state behind on content
    // this click is asking for again — and the click is spent by now
    // (preventDefault has already been called). Answering it with nothing at
    // all would leave the box dressed as a failure while holding exactly what
    // was wanted. Taking the state back is the whole answer: nothing is
    // fetched, and the sentence about the load that failed goes with it.
    if (!previous?.controller && previous?.url === url && !this.refresh) {

      if (target.getAttribute(defaults.stateAttr) === defaults.errorState) {
        target.removeAttribute(defaults.stateAttr);
        this.announce(target, '');
      }

      return;
    }

    // The last click wins: whoever was filling this box is called off. Their
    // own handler then finds the abort and writes nothing.
    previous?.controller?.abort();

    const controller = new AbortController();
    const record = { controller, loading: url, url: previous?.url || '' };

    loads.set(target, record);
    this.current = { target, record };

    target.setAttribute(defaults.stateAttr, defaults.loadingState);
    this.root.setAttribute(defaults.stateAttr, defaults.loadingState);

    // Said before the request goes out, and NOT under aria-busy: the busy
    // window is the exchange (see swap), so this sentence is not written into
    // a region whose updates are being held back. The ring says the same
    // thing to whoever can see it.
    this.announce(target, this.texts.loading);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: defaults.credentials,
        headers: defaults.headers,
      });

      if (!response.ok) throw new Error(`the server answered HTTP ${response.status}`);

      const html = await response.text();

      // A newer load took the box over while this one was on the wire. It
      // owns the state attributes now, so this one leaves them alone.
      if (loads.get(target) !== record) return;

      const nodes = this.extract(html, target);

      await this.swap(target, nodes);

      // Asked a second time, and it has to be: swap() awaits the loader, and
      // that imports the chunks of whatever arrived — the longest await in
      // this method, and long enough for a second link to take the box over
      // in it. If one did, its "loading" is on the box now, and the
      // removeAttribute below would strip the busy look off a request that is
      // still running. Its content will arrive on top of this one's; the
      // record is not the registry's anymore either, so there is nothing left
      // here to write down.
      if (loads.get(target) !== record) return;

      record.controller = null;
      record.loading = '';
      record.url = url;

      target.removeAttribute(defaults.stateAttr);
    }

    catch (error) {

      // An aborted request is not a failure, and the load that aborted it is
      // already writing its own state onto the box.
      if (!controller.signal.aborted) this.fail(target, record, url, error);
    }

    finally {

      // Only this load's own bookkeeping: an href rewritten between two
      // clicks is the one way the same link can have a newer load running by
      // now, and that one's record is not this one's to clear.
      if (this.current?.record === record) this.current = null;

      // Always safe to take back: this one is on the link, and the link is
      // this instance's own element whatever happened to the box.
      this.root.removeAttribute(defaults.stateAttr);
    }
  };



  // The answer, as nodes. Parsed rather than assigned, so nothing in it loads
  // or runs before it has been decided what is taken (see the header).
  //
  // Every match, in document order: the selector can name the wrapper to keep
  // or the children to unwrap. Without one the whole body is taken —
  // childNodes and not children, so an endpoint answering with bare text does
  // not silently lose it.
  extract = (html, target) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const found = this.select
      ? [...doc.querySelectorAll(this.select)]
      : [...doc.body.childNodes];

    const nodes = this.dropScripts(found);

    if (!nodes.length) {
      throw new Error(this.select
        ? `nothing in the answer matched data-fragment-select ("${this.select}")`
        : 'the answer was empty');
    }

    this.carryLang(nodes, doc, target);

    return nodes;
  };



  // The one thing about the answer that does NOT come with the elements taken
  // out of it. Language is inherited down a document, so a page states it
  // once on <html> — and that element stays behind in the answer. Insert an
  // English fragment into a German page and every word of it is now declared
  // German: wrong pronunciation, wrong voice, wrong hyphenation, and WCAG
  // 3.1.2 unmet by a page that did everything right.
  //
  // Written only where the two actually differ, only on the top-level
  // elements taken (it inherits from there), and never over a lang the
  // fragment states itself. A bare text node cannot carry the attribute at
  // all — the one case this cannot fix, and a reason to select elements
  // rather than the naked body of an answer in another language.
  carryLang = (nodes, doc, target) => {
    const source = (doc.documentElement.getAttribute('lang') || '').trim();
    if (!source) return;

    const here = (target.closest('[lang]')?.getAttribute('lang') || '').trim();
    if (here.toLowerCase() === source.toLowerCase()) return;

    for (const node of nodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.hasAttribute('lang')) continue;

      node.setAttribute('lang', source);
    }
  };



  // A <script> that came with the selection is taken out of it, and said out
  // loud. It would not run — the HTML spec marks a parser-created script as
  // already started — so leaving it in the page would only look like
  // behaviour that is there. Everything the answer carries OUTSIDE the
  // selection is none of this module's business and is never touched: the
  // whole page was parsed, but only what was selected is adopted.
  dropScripts = (nodes) => {
    const kept = nodes.filter((node) => node.nodeName !== 'SCRIPT');
    let dropped = nodes.length - kept.length;

    for (const node of kept) {
      const inside = node.querySelectorAll?.('script') || [];

      dropped += inside.length;
      for (const script of inside) script.remove();
    }

    if (dropped) {
      this.reporter?.report(
        'loadFragment',
        `dropped ${dropped} <script> element(s) from the fragment: a script ` +
        'inserted this way never runs, so leaving it in the page would only ' +
        'look like behaviour. Boot the fragment through data-js-behavior ' +
        'instead.', this.root
      );
    }

    return kept;
  };



  // The exchange itself, and the two calls around it are the reason this
  // module is worth having as one: whatever the box held may have been
  // enhanced — by the page's own boot or by a previous load — so it is torn
  // down before it goes, and what arrives is enhanced before the busy state
  // is lifted. Both are one call each into the loader; neither is this
  // module's own idea of what a component is.
  //
  // Optional in the same way the reporter is: booted by boot.js they are
  // always there, and a host that builds its own services object gets a
  // fragment that is put in the page but not enhanced, rather than an error.
  swap = async (target, nodes) => {
    const region = target.querySelector(`:scope > [${defaults.statusAttr}]`);
    const focused = document.activeElement;
    const hadFocus = focused && focused !== target && target.contains(focused);

    // The busy window is exactly this: from the moment the box starts coming
    // apart to the moment the new content is enhanced. Not a formality —
    // initScope imports the chunks of whatever arrived.
    target.setAttribute('aria-busy', 'true');

    try {

      // Cleared before the exchange rather than after it: what stands in the
      // region is the loading sentence, and emptying it under aria-busy keeps
      // that from being read out again on the way past.
      if (region) region.textContent = '';

      this.destroyScope?.(target);

      // The region goes back in, last. It is the box's instrument and not its
      // content, so it survives the exchange — and putting it after the
      // fragment leaves the project's ":first-child" rules describing the
      // fragment.
      target.replaceChildren(...nodes, ...(region ? [region] : []));

      this.reportDuplicateIds(nodes);

      await this.initScope?.(target);

      // Only if it really was lost: a component in the fragment may have
      // placed the focus itself while it was being enhanced, and that
      // decision is a better one than this module's.
      if (hadFocus && !target.contains(document.activeElement)) {
        this.recoverFocus(target);
      }
    }

    finally {
      target.removeAttribute('aria-busy');
    }
  };



  // The focus stood in this box and the element holding it has just been
  // replaced, so it is on <body> now and the tab order starts from the top of
  // the page. The box is the nearest true thing to where the reader was, and
  // it holds what they asked for.
  //
  // tabindex="-1" only if the project has not put one there itself, and given
  // back on the reader's way out: an attribute this module added is not the
  // project's markup, and a container that stays focusable is a container
  // someone else has to explain. "On the way out" is two moments, not one —
  // the blur when the reader moves on, and destroy() for a teardown that
  // finds nobody standing on the box, where that blur would never come. A
  // teardown that does find somebody leaves both alone: see destroy().
  recoverFocus = (target) => {
    if (!target.getAttribute('aria-label') &&
        !target.getAttribute('aria-labelledby')) {
      this.reporter?.report(
        'loadFragment',
        'the focus was inside this box and had to be put on the box itself, ' +
        'which has no accessible name — give it one (role="region" with ' +
        'aria-label, or aria-labelledby pointing at its own heading) so the ' +
        'reader is told where they have landed.', target
      );
    }

    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');

      // The closure holds the element rather than reading it back off the
      // instance, so a target swapped out from under this link (the selector
      // is re-resolved on every click) still gets its own attribute back and
      // not somebody else's.
      const release = () => {
        target.removeAttribute('tabindex');

        if (this.borrowedTabindex?.release === release) {
          this.borrowedTabindex = null;
        }
      };

      this.borrowedTabindex = { target, release };
      target.addEventListener('blur', release, { once: true });
    }

    target.focus();
  };



  // A report and nothing else: an id is what the fragment's own labels and
  // aria-* references point at, so renaming one here would break the pair it
  // belongs to. Run after the insertion, because "already in this page" is a
  // question about the page as it is now — the content this load replaced was
  // the most likely holder of the same ids a moment ago.
  reportDuplicateIds = (nodes) => {
    if (!this.reporter) return;

    const clashes = new Set();

    for (const node of nodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const carriers = node.id ? [node] : [];
      carriers.push(...node.querySelectorAll('[id]'));

      for (const el of carriers) {
        if (!el.id) continue;
        if (document.querySelectorAll(`#${CSS.escape(el.id)}`).length > 1) {
          clashes.add(el.id);
        }
      }
    }

    if (!clashes.size) return;

    this.reporter.report(
      'loadFragment',
      `the fragment brought ${clashes.size} id(s) this page already has ` +
      `(${[...clashes].join(', ')}): a duplicate id quietly breaks every ` +
      'label and aria-* reference pointing at it. Select a region whose ids ' +
      'are unique here, or have the source page render them unique.', this.root
    );
  };



  // Nothing was replaced. That is the whole of the error state: the box still
  // holds what it held, the link still points at the page, and a second click
  // tries again.
  //
  // Said, though, and not only drawn. The outline is for whoever can see it;
  // the sentence in the status region is what makes a failed load a thing the
  // reader is told about at all, and it is the one channel that survives a
  // project styling the box itself. What failed — status code, network, an
  // empty selection — stays with the reporter: it is a sentence for the
  // developer, not for the reader.
  fail = (target, record, url, error) => {
    record.controller = null;
    record.loading = '';

    target.setAttribute(defaults.stateAttr, defaults.errorState);
    this.announce(target, this.texts.error);

    this.reporter?.report(
      'loadFragment',
      `${error.message}; nothing was replaced.`, { url, target }
    );
  };



  // Optional teardown for hosts that mount/unmount this subtree repeatedly —
  // see destroyModulesInScope() in boot.js. What really needs it is the
  // request: a fetch outlives the link it was started from. The content this
  // link loaded stays where it is, because it is the target's content now and
  // the target is somebody else's element.
  destroy = () => {
    this.root.removeEventListener('click', this.handleClick);

    if (this.current) {
      const { target, record } = this.current;

      record.controller?.abort();

      // Only if nobody else has taken the box over in the meantime: the state
      // on it would be theirs by then.
      if (loads.get(target) === record) {
        target.removeAttribute(defaults.stateAttr);
        target.removeAttribute('aria-busy');

        // A sentence about a load that will now never finish.
        this.announce(target, '');
      }
    }

    // The one piece of DOM this module adds, taken back by the instance that
    // added it. A second link sharing the box builds its own again on its
    // next click, so removing it cannot leave that link mute.
    this.ownRegion?.remove();

    // And the one attribute it lends — unless the reader is standing on the
    // box at this very moment. Taking a tabindex off a focused element drops
    // the focus to <body>, and that is the exact loss recoverFocus exists to
    // prevent; a teardown is not the reader's doing, so it must not cost them
    // their place. Then the blur listener stays registered instead: their next
    // move gives the attribute back, and until then it costs one closure on an
    // element that outlives this instance anyway.
    if (this.borrowedTabindex &&
        document.activeElement !== this.borrowedTabindex.target) {
      const { target, release } = this.borrowedTabindex;

      target.removeEventListener('blur', release);
      release();
    }

    this.root.removeAttribute(defaults.stateAttr);
    this.root.removeAttribute(defaults.readyAttr);
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'loadFragment',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new LoadFragment(el, services);
  return instance.destroy;
}
