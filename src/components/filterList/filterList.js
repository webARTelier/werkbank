/**
 * filterList.js
 * ----------------------------------------------------------------------------
 * Filters a group of items that is already in the page — a card grid, a list
 * of people, a set of downloads — by what somebody types and by the facets
 * they tick. `dataTable` does the same job for a <table> and can only do it
 * for a table; this one asks nothing of the markup but "here is an item".
 *
 * It boots on the region that holds both the controls and the items, and it
 * owns no vocabulary at all: what a card looks like, how the grid is laid
 * out and what the filter bar looks like are the project's, in the project's
 * own CSS. What the module writes is one attribute on the region
 * (data-filterlist-state), the `hidden` attribute on the items that are
 * out, and one sentence in a live region saying how many are left.
 *
 * What the platform already does
 * -----------------------------
 * - <input type="search"> is the field, with its own clear control, its own
 *   keyboard and its own autocomplete. <select>, checkbox and radio are the
 *   facets, and a <fieldset><legend> names a group of them. None of that is
 *   rebuilt here.
 * - `hidden` is the platform's "not relevant right now": it takes an element
 *   out of the layout AND out of the accessibility tree, which is exactly
 *   what a filtered-out item is. A rule that only dimmed it would leave a
 *   screen reader reading items the filter has excluded.
 * - `disabled` on the reset button says "there is nothing to reset" in a way
 *   every assistive technology already announces.
 * - Intl-grade folding is in the platform too: String.normalize("NFD") plus a
 *   \p{Mn} strip is what makes "zurich" find "Zürich" (foldText.js).
 * What HTML and CSS cannot express is the test itself — no selector asks
 * whether an element's text contains a string somebody is still typing — and
 * that is the whole of what this script adds.
 *
 * What the script adds
 * --------------------
 * 1. The query lane: the field's value is folded, split on whitespace, and
 *    EVERY term has to be found in an item for it to stay. So "red chair"
 *    finds a red chair whichever order the two words stand in, and the
 *    accents do not have to be typed. An item's haystack is its own visible
 *    text unless data-filterlist-text names one instead.
 * 2. The facet lane: each control carries data-filterlist-facet="<group>"
 *    and its value is a token matched against the item's
 *    data-filterlist-tags. OR inside a group, AND across groups — what
 *    every faceted filter on the web does, and what a reader expects when
 *    they tick two colours and one size.
 * 3. The result, in three channels that never disagree: `hidden` on the items
 *    that are out, data-filterlist-state="filtered" | "empty" on the
 *    region for the project's own rules, and the count — visibly in an
 *    element the author marks, spoken through a polite live region this
 *    module injects.
 * 4. The way back: a reset control that clears the query and every facet,
 *    and is `disabled` while there is nothing to clear. Neither pressing it
 *    nor Enter in the field submits anything where the bar sits in a form:
 *    the filtering is instant once the module runs, so a round trip would
 *    only throw away the result the page already has.
 * 5. Items that arrive later are picked up. A MutationObserver watches the
 *    region for children, so a page that appends a second batch — a "load
 *    more" through loadFragment, a rendered template — is filtered as it
 *    stands without re-initialising anything.
 * 6. One event: "filterlist:changed" bubbles off the region on every pass,
 *    with detail { shown, total, query, facets }. It is what a project acts
 *    on where the result has to leave this region — a URL, a history entry,
 *    a request — none of which is this module's job.
 *
 * Progressive enhancement
 * -----------------------
 * Nothing in HTML or CSS filters a list, so the controls are a bar that does
 * nothing until this chunk arrives. They therefore ship with the `hidden`
 * attribute in the markup and init() removes it as its LAST step — video's
 * approach, and copyToClipboard's: no ready attribute, no media query, and a
 * chunk that never arrives leaves the page exactly as authored, which is the
 * full list. Every bail-out below simply returns before that line, so an
 * empty region, a region with no controls and a broken option all end the
 * same way: the complete list, and no dead controls above it.
 *
 * `hidden` needs help to hide, though, and the stylesheet is where it gets
 * it — see filterList.scss. It is a UA rule at specificity (0,0,0), so the
 * first `.filterBar { display: flex }` a project writes would put the dead
 * bar back on screen.
 *
 * Accessibility
 * -------------
 * - The count is SAID, not only drawn. A filter that only shows and hides is
 *   a change nobody who cannot see the grid is told about (WCAG 4.1.3), so
 *   the module injects one polite region and writes the count into it,
 *   debounced so a screen reader is not reciting a number per keystroke.
 * - That region is also the query field's description (aria-describedby), so
 *   the current count is read when the field takes focus rather than only
 *   when it changes.
 * - It is inserted AFTER the controls and before the items, which is where a
 *   sighted reader finds the count. A live region is announced from wherever
 *   it sits; somebody reading the page linearly is not being announced at,
 *   and at the end of the region they would meet the count after the whole
 *   list.
 * - Nothing-found is announced in the AUTHOR'S words where there are any:
 *   [data-filterlist-empty] is what a sighted reader is looking at in
 *   that state and usually the only place the way out is written down. Two
 *   channels saying different things about one state is the fault this
 *   avoids.
 * - The reset moves the focus, and only then. paint() disables the button as
 *   part of the same pass, and an element disabled while it has the focus
 *   hands it to <body> — so a press on "clear" would put the reader back at
 *   the top of the document (WCAG 2.4.3). The focus goes to the query field
 *   instead. Nothing else in this module ever moves it.
 * - Every announcement is a NEW node in the region. Assigning the same text
 *   to the same node is not a mutation, so the second "No entries found."
 *   in a row would be silent — the same finding copyToClipboard's live
 *   region rests on.
 * - The region is built with its first sentence already in it and inserted
 *   complete, so the initial count is a description from the start and not
 *   an announcement fired at a reader who has not touched anything.
 * - Filtered-out items get `hidden`, so they leave the accessibility tree
 *   with the layout. Do not make the item container itself a live region:
 *   twelve cards leaving at once is not a message.
 * - The focus is not moved by filtering. A reader typing in the field stays
 *   in the field; a reader who ticked a facet stays on the facet. There are
 *   two exceptions, and both are one fault avoided: the reset above, and an
 *   item that goes out while the focus is inside it — which can only happen
 *   when a later render, not a control, started the pass. `hidden` on an
 *   element holding the focus would hand it to <body>, so it goes to the
 *   query field instead (WCAG 2.4.3).
 * - Where the built-in wording is not the page's language, the announced
 *   line carries its own lang, so a screen reader pronounces it with the
 *   right voice (WCAG 3.1.2). An author's own wording is in the page's
 *   language by definition and is left alone.
 *
 * Configuration (data-js-behavior="filterList" on the region that holds the
 * controls AND the items; everything below is optional except the items and
 * at least one control)
 * ----------------------------------------------------------------------------
 * On the region:
 * - data-filterlist-match="…"           "any" or "word": where a term may
 *                                       match. "any" is a substring ("art"
 *                                       finds "Stuttgart"), "word" only at
 *                                       the start of a word. Default: "any"
 * - data-filterlist-count-text="…"      the VISIBLE count template. Tokens
 *                                       {shown} {total}
 * - data-filterlist-status-text="…"     the SPOKEN counting sentence. Same
 *                                       tokens. An empty value opts it out
 * - data-filterlist-none-text="…"       the SPOKEN nothing-found sentence.
 *                                       Defaults to
 *                                       [data-filterlist-empty]'s own text
 *                                       where there is one. An empty value
 *                                       opts it out
 *
 * Inside it:
 * - data-filterlist-item                an item. At least one is required
 * - data-filterlist-text="…"            on an item: the text to search
 *                                       INSTEAD of the item's own
 * - data-filterlist-tags="a b"          on an item: the tokens a facet
 *                                       matches
 * - data-filterlist-query               the text field
 * - data-filterlist-facet="<group>"     a <select>, checkbox or radio.
 *                                       Empty value: the control's `name`
 *                                       names the group; failing that it
 *                                       stands alone
 * - data-filterlist-reset               a <button> that clears everything
 * - data-filterlist-count               where the visible count is written
 * - data-filterlist-empty               the nothing-found message. Ships
 *                                       `hidden`; shown while nothing
 *                                       matches, and announced in those
 *                                       words
 * - data-filterlist-controls            a wrapper that ships `hidden` and
 *                                       is revealed once the module runs
 * ----------------------------------------------------------------------------
 */



import { rafThrottle } from './rafThrottle.js';
import { debounceThenExecute } from './debounce.js';
import { foldText } from './foldText.js';
import { resolveLocale } from './resolveLocale.js';
import { formatTemplate } from './formatTemplate.js';
import { uniqueId } from './uniqueId.js';
import { addDescribedBy, removeDescribedBy } from './describedBy.js';



const defaults = {

  // The items and what is searched in them. `textAttr` REPLACES an item's own
  // text as the haystack — for a card whose body copy would otherwise match
  // everything, or for keywords that are not on screen.
  itemAttr: 'data-filterlist-item',
  textAttr: 'data-filterlist-text',
  tagsAttr: 'data-filterlist-tags',

  // The controls. All behavioural data attributes, never style classes, so
  // the project's own filter-bar design is free of this module.
  queryAttr: 'data-filterlist-query',
  facetAttr: 'data-filterlist-facet',
  resetAttr: 'data-filterlist-reset',
  controlsAttr: 'data-filterlist-controls',

  // Where the result is written for the reader to see.
  countAttr: 'data-filterlist-count',
  emptyAttr: 'data-filterlist-empty',

  // The one state hook on the region: "filtered" while something is
  // filtering and items are left, "empty" while nothing matches. Absent
  // means the whole list is showing.
  stateAttr: 'data-filterlist-state',

  // Options on the region.
  matchAttr: 'data-filterlist-match',
  countTextAttr: 'data-filterlist-count-text',
  statusTextAttr: 'data-filterlist-status-text',
  noneTextAttr: 'data-filterlist-none-text',

  // The injected live region: the class carries its one shipped style (being
  // visually hidden, see filterList.scss), the attribute is there for an
  // inspector and for a project selector that prefers one.
  statusClass: 'filterlist-srStatus',
  statusAttr: 'data-filterlist-status',
  statusIdPrefix: 'filterlist-status',

  // What the region fires on every pass, for the project that has to act on
  // the result. Named after the module rather than after the job, the way
  // copyToClipboard's two events are.
  changedEvent: 'filterlist:changed',

  // How long typing has to pause before the polite region is updated. The
  // items move instantly; only the announcement waits, so a screen reader
  // hears one count rather than one per keystroke.
  announceDelay: 500,

  // <html lang> matching none of the locales in `labels` falls back to this.
  fallbackLocale: 'en',
};



// What the live region says, keyed by locale. Natural sentences, because
// they are read out: "3 of 12 entries are shown." and not "3/12". {shown}
// and {total} are interpolated from the live count by formatTemplate.
const labels = {

  de: {
    all: 'Alle {total} Einträge werden angezeigt.',
    one: 'Ein von {total} Einträgen wird angezeigt.',
    some: '{shown} von {total} Einträgen werden angezeigt.',
    none: 'Keine Einträge gefunden.',
    count: '{shown} von {total}',
  },

  en: {
    all: 'All {total} entries are shown.',
    one: 'One of {total} entries is shown.',
    some: '{shown} of {total} entries are shown.',
    none: 'No entries found.',
    count: '{shown} of {total}',
  },
};



// The words of a folded string, for the "word" match mode. Split on
// everything that is neither a letter nor a number, so a hyphenated name, a
// slash and a comma all end a word — which is what somebody typing "art"
// and not wanting "Stuttgart" means by one.
function wordsOf(folded) {
  return folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}



// Is `term` in this item's text under the given mode? "any" is a plain
// substring test; "word" asks whether any word STARTS with the term, which
// is the useful half of a word-boundary rule — a reader types the beginning
// of a word, not the end of one.
function hasTerm(item, term, mode) {
  if (mode !== 'word') return item.text.includes(term);
  return item.words.some((word) => word.startsWith(term));
}



// Every term has to be found, in any order: "red chair" and "chair red" are
// the same query. An empty term list matches everything, which is what an
// empty field means.
function matchesQuery(item, terms, mode) {
  return terms.every((term) => hasTerm(item, term, mode));
}



// OR inside a group, AND across groups. `groups` is a Map of group name to
// the set of tokens currently active in it; a group with nothing active is
// not in the Map at all, so it constrains nothing.
function matchesFacets(item, groups) {
  for (const tokens of groups.values()) {
    const hit = Array.from(tokens).some((token) => item.tags.has(token));
    if (!hit) return false;
  }

  return true;
}



// The group a facet control belongs to: the attribute's own value, or the
// control's `name` (which is what a checkbox group already shares), or — for
// a lone control with neither — the element itself, so it cannot silently
// join another group's OR.
function facetGroup(control, config) {
  const named = (control.getAttribute(config.facetAttr) || '').trim();
  if (named) return named;
  if (control.name) return control.name;
  return control;
}



// The tokens a single control contributes while it stands as it does. An
// empty value is the "any" option of a select and contributes nothing, which
// is why it is filtered out rather than matched as an empty tag.
function facetTokens(control) {
  if (control instanceof HTMLSelectElement) {
    return Array.from(control.selectedOptions)
      .map((option) => foldText(option.value.trim()))
      .filter(Boolean);
  }

  if (!control.checked) return [];

  const value = foldText(control.value.trim());
  return value ? [value] : [];
}



class FilterList {

  // Read by the debounced announcement: a queued one cannot be cancelled
  // from the outside (debounceThenExecute hands back no handle), so it has to
  // find out for itself that there is nothing left to write. The same guard
  // inputCharCount and scrollSpy carry for their debounced work.
  destroyed = false;

  // Controls this instance has already complained about. index() runs again
  // on every subtree change, so without it one mis-marked control would file
  // a warning per appended batch — and a console nobody can read is a
  // console nobody reads.
  reported = new WeakSet();



  constructor(root, config, reporter) {
    this.root = root;
    this.config = config;
    this.reporter = reporter;

    const locale = resolveLocale(Object.keys(labels), config.fallbackLocale);
    this.locale = labels[locale] ? locale : config.fallbackLocale;
    this.labels = labels[this.locale];

    // The language to mark this module's own sentences with — but only where
    // it is not the page's already: <html lang="fr"> gets the English
    // wording, and English text inside a French page has to say so (WCAG
    // 3.1.2), while lang="de" inside a German page is noise. Read backwards
    // through resolveLocale's matching, so lang="de-CH" resolving to "de"
    // counts as the page's language and adds nothing.
    const pageLocale = (document.documentElement.lang || '').toLowerCase();
    this.labelsLang =
      pageLocale === this.locale || pageLocale.split('-')[0] === this.locale
        ? null
        : this.locale;

    this.mode = this.readMode();

    this.countText =
      root.getAttribute(config.countTextAttr) || this.labels.count;

    // Author wording for the two spoken sentences, PRESENT-not-truthy: an
    // empty value is an author saying "something else announces this", which
    // is a real configuration (a toast, a router) and not a mistake.
    this.statusText = root.getAttribute(config.statusTextAttr);
    this.noneText = root.getAttribute(config.noneTextAttr);

    // Both sentences opted out is the one configuration in which this
    // component can be wired up correctly and still leave a screen-reader
    // user with no result at all. It is a real setting — something else (a
    // toast, a router) may be announcing the count — so the region is simply
    // not built, and the console says so for the project that meant to have
    // that something else and forgot it.
    this.mute = this.statusText === '' && this.noneText === '';
    if (this.mute) {
      reporter?.report(
        'filterList',
        `both ${config.statusTextAttr} and ${config.noneTextAttr} are empty, so nothing announces the count; make sure something else does.`,
        root
      );
    }

    this.announce = debounceThenExecute(this.speak, config.announceDelay);
    this.reindex = rafThrottle(this.handleMutation);

    this.setup();
  }



  // "any" unless the region asks for "word". An unknown value is reported
  // rather than guessed at: silently filtering by the wrong rule looks like
  // the data is wrong, which is a much longer bug to find.
  readMode = () => {
    const raw = (this.root.getAttribute(this.config.matchAttr) || '').trim();
    if (raw === '' || raw === 'any' || raw === 'word') return raw || 'any';

    this.reporter?.report(
      'filterList',
      `${this.config.matchAttr}="${raw}" is not one of "any" or "word"; matching anywhere in the text.`,
      this.root
    );
    return 'any';
  };



  setup = () => {
    this.index();

    // Two bail-outs, and both leave the page as authored: the controls keep
    // the `hidden` they ship with, because a filter over nothing and a
    // filter with nothing to filter by are both a dead bar.
    if (!this.items.length) {
      this.reporter?.report(
        'filterList',
        `no ${this.config.itemAttr} elements in this region; there is nothing to filter.`,
        this.root
      );
      return;
    }

    if (!this.field && !this.facets.length) {
      this.reporter?.report(
        'filterList',
        `no ${this.config.queryAttr} field and no ${this.config.facetAttr} control in this region; nothing can filter it.`,
        this.root
      );
      return;
    }

    const result = this.compute();
    this.paint(result);

    this.buildStatus(result);
    this.observe();
    this.listen();

    // Last, so the bar is never on screen in a state where it does nothing.
    this.reveal();
  };



  // Reads the region: what the items are, what is searched in them, and
  // which controls filter them. Run again whenever the subtree changes, so
  // the index is never a stale copy of the page.
  index = () => {
    const config = this.config;

    this.items = Array.from(
      this.root.querySelectorAll(`[${config.itemAttr}]`)
    ).map((el) => this.indexItem(el));

    this.field = this.root.querySelector(`[${config.queryAttr}]`);
    this.counts = Array.from(this.root.querySelectorAll(`[${config.countAttr}]`));
    this.empties = Array.from(this.root.querySelectorAll(`[${config.emptyAttr}]`));

    this.resets = Array.from(
      this.root.querySelectorAll(`[${config.resetAttr}]`)
    ).filter((control) => this.usableReset(control));

    this.facets = Array.from(
      this.root.querySelectorAll(`[${config.facetAttr}]`)
    ).filter((control) => this.usableFacet(control));
  };



  // One item, folded once so a keystroke costs a comparison rather than a
  // pass over the DOM. `textAttr` replaces the item's own text; the tags are
  // folded too, so a facet value may be written with or without its accents.
  indexItem = (el) => {
    const override = el.getAttribute(this.config.textAttr);
    const source = override === null ? el.textContent : override;
    const folded = foldText(source.replace(/\s+/g, ' ').trim());

    const tags = (el.getAttribute(this.config.tagsAttr) || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((tag) => foldText(tag));

    return {
      el,
      text: folded,

      // Only the "word" mode ever reads these, and index() runs again on
      // every subtree change — so in the default mode this would be one
      // split per item per render, thrown away unread.
      words: this.mode === 'word' ? wordsOf(folded) : null,

      tags: new Set(tags),
    };
  };



  // A facet has to be a control whose value this module can read as a state.
  // A text field carrying the attribute is an author mistake worth naming:
  // it would contribute its raw content as one token and match nothing.
  usableFacet = (control) => {
    if (control instanceof HTMLSelectElement) return true;

    if (
      control instanceof HTMLInputElement &&
      (control.type === 'checkbox' || control.type === 'radio')
    ) {
      return true;
    }

    this.complain(
      control,
      `${this.config.facetAttr} works on a <select>, a checkbox or a radio; this control is ignored.`
    );
    return false;
  };



  // One warning per control, however often the region is re-indexed.
  complain = (control, message) => {
    if (this.reported.has(control)) return;

    this.reported.add(control);
    this.reporter?.report('filterList', message, control);
  };



  // A reset has to be a control the platform can actually disable AND one a
  // reader can press: `disabled` is the whole of how this module says
  // "nothing to clear", and a press is the whole of how it is used. An <a>
  // carrying the attribute would take the state silently and go on offering
  // a reset that is not there — and a text field carrying it can be
  // disabled, so it would pass a test that only asked about that, while
  // still being nothing anybody presses.
  usableReset = (control) => {
    if (control instanceof HTMLButtonElement) return true;

    if (
      control instanceof HTMLInputElement &&
      ['button', 'reset', 'submit'].includes(control.type)
    ) {
      return true;
    }

    this.complain(
      control,
      `${this.config.resetAttr} needs a <button>, or an <input> that can be pressed (button, reset, submit); this element is ignored.`
    );
    return false;
  };



  // The query as terms, folded. Split on whitespace, so a reader may type
  // two words and mean both of them.
  terms = () => {
    if (!this.field) return [];

    const folded = foldText(this.field.value.trim());
    return folded.split(/\s+/).filter(Boolean);
  };



  // The active facet tokens, grouped. A group whose controls are all at rest
  // is left out of the Map entirely, so it constrains nothing.
  groups = () => {
    const map = new Map();

    this.facets.forEach((control) => {
      const tokens = facetTokens(control);
      if (!tokens.length) return;

      const key = facetGroup(control, this.config);
      const set = map.get(key) || new Set();
      tokens.forEach((token) => set.add(token));
      map.set(key, set);
    });

    return map;
  };



  // The whole decision, in one pass and with no writes in it: read the live
  // controls, test every item, hand back what paint() and speak() need. Read
  // then write, never interleaved.
  compute = () => {
    const terms = this.terms();
    const groups = this.groups();
    const filtering = terms.length > 0 || groups.size > 0;

    const matches = this.items.map(
      (item) =>
        matchesQuery(item, terms, this.mode) && matchesFacets(item, groups)
    );

    return {
      matches,
      filtering,
      total: this.items.length,
      shown: matches.filter(Boolean).length,
      terms,
      groups,
    };
  };



  // Everything the reader sees, and nothing else. All writes are idempotent
  // (toggleAttribute with a force flag, an assignment guarded against its
  // own value), so a pass that changes nothing writes nothing.
  paint = (result) => {
    const config = this.config;

    this.items.forEach((item, i) => {
      item.el.toggleAttribute('hidden', !result.matches[i]);
    });

    // Absent means "the whole list is showing", which is the state a project
    // most often has nothing to say about — so it is the absence rather than
    // a third value to write rules against.
    const state = result.filtering && (result.shown ? 'filtered' : 'empty');
    if (!state) this.root.removeAttribute(config.stateAttr);
    if (state) this.root.setAttribute(config.stateAttr, state);

    const text = formatTemplate(this.countText, result);
    this.write(() => {
      this.counts.forEach((el) => {
        if (el.textContent !== text) el.textContent = text;
      });
    });

    this.empties.forEach((el) => {
      el.toggleAttribute('hidden', !(result.filtering && !result.shown));
    });

    // The platform's own way of saying "nothing to undo here", announced by
    // every assistive technology without a line of ARIA.
    this.resets.forEach((el) => {
      el.disabled = !result.filtering;
    });
  };



  // The author's own nothing-found message as one line, or '' where there is
  // none. It is what a sighted reader is looking at while nothing matches,
  // and it is usually the only place the way out is written down ("press
  // Clear to start again") — so announcing something else would leave the
  // two channels telling a reader different things about the same state.
  emptyMessage = () => {
    const el = this.empties[0];
    if (!el) return '';

    return el.textContent.replace(/\s+/g, ' ').trim();
  };



  // The sentence for a result, and whether it is this module's own wording —
  // which is what decides the lang on it. Three shapes rather than one,
  // because "1 of 12 entries are shown" is not a sentence and a reader hears
  // every one of these.
  //
  // Nothing-found has one source more than the count does, and it is the
  // page's own: data-filterlist-none-text first, because an author who
  // wrote one meant it; then [data-filterlist-empty]'s text; then the
  // built-in sentence. The empty value keeps opting out, which is why the
  // first test is against null rather than for truth.
  sentence = (result) => {
    if (result.filtering && !result.shown) {
      if (this.noneText !== null) return { text: this.noneText, builtIn: false };

      const authored = this.emptyMessage();
      if (authored) return { text: authored, builtIn: false };

      return { text: this.labels.none, builtIn: true };
    }

    if (this.statusText !== null) {
      return { text: formatTemplate(this.statusText, result), builtIn: false };
    }

    if (!result.filtering) {
      return { text: formatTemplate(this.labels.all, result), builtIn: true };
    }

    const template = result.shown === 1 ? this.labels.one : this.labels.some;
    return { text: formatTemplate(template, result), builtIn: true };
  };



  // Where the announcement belongs in the READING order: after the controls
  // and before the items, which is where a sighted reader finds the count.
  // A live region is announced from wherever it sits, but somebody reading
  // the page linearly is not being announced at — they arrive at it, and at
  // the end of the region they arrive at it after the whole list.
  //
  // The anchor is the controls wrapper where there is one, and otherwise the
  // outermost element of the region that holds the last control, so the
  // status clears the whole bar however it is nested. Note that the wrapper
  // is still `hidden` at this point — reveal() is the last step of setup() —
  // which is exactly why the region goes AFTER it and not inside it: a live
  // region in a hidden subtree announces nothing.
  statusAnchor = () => {
    const config = this.config;

    const controls = this.root.querySelector(`[${config.controlsAttr}]`);
    if (controls?.parentNode) return controls;

    const all = this.root.querySelectorAll(
      `[${config.queryAttr}], [${config.facetAttr}], [${config.resetAttr}]`
    );
    let node = all[all.length - 1];
    if (!node) return null;

    while (node.parentElement && node.parentElement !== this.root) {
      node = node.parentElement;
    }

    return node.parentElement === this.root ? node : null;
  };



  // The polite live region, built COMPLETE and only then inserted. A region
  // inserted empty and filled a moment later announces its first sentence
  // at a reader who has not touched anything — and this module arrives after
  // the first paint, so that moment is real. Arriving with its content in
  // place makes the initial count a description instead.
  buildStatus = (result) => {
    if (this.mute) return;

    const config = this.config;

    this.status = document.createElement('div');
    this.status.className = config.statusClass;
    this.status.setAttribute(config.statusAttr, '');
    this.status.id = uniqueId(config.statusIdPrefix);
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.status.append(this.line(result));

    const anchor = this.statusAnchor();
    this.write(() => {
      if (anchor) anchor.after(this.status);
      if (!anchor) this.root.append(this.status);
    });

    // So the field is described by the current count on focus, not only when
    // it changes. An author's own ids are kept.
    if (this.field) addDescribedBy(this.field, this.status.id);
  };



  // One announcement, as its own node. Assigning the same text to the same
  // node is not a mutation, so a second "No entries found." would be silent
  // — two different queries finding nothing is exactly the case that has to
  // be announced twice.
  line = (result) => {
    const { text, builtIn } = this.sentence(result);

    const line = document.createElement('div');
    line.textContent = text;

    // Only this module's own wording can be in a language the page is not.
    // The author's is the page's by definition — the empty message included,
    // which is markup out of the page — and a lang on it would claim
    // otherwise.
    if (builtIn && this.labelsLang) line.lang = this.labelsLang;

    return line;
  };



  speak = () => {
    if (this.destroyed || !this.status) return;

    const result = this.compute();
    this.write(() => this.status.replaceChildren(this.line(result)));
  };



  // Items may arrive after init — a batch appended by loadFragment, a
  // rendered template — so the region is re-read and filtered as it stands.
  // childList only: the module's own work on the items is `hidden`, an
  // attribute, which this observer never sees in the first place.
  observe = () => {
    this.observer = new MutationObserver(this.reindex);
    this.connect();
  };



  connect = () => {
    this.observer?.observe(this.root, { childList: true, subtree: true });
  };



  // The two writes this module makes that ARE childList mutations — the
  // visible count and the announcement — go through here, so the observer is
  // not handed the module's own work back as a page change. disconnect()
  // empties the record queue per spec, and nothing else can run in between:
  // the callback is synchronous.
  write = (fn) => {
    this.observer?.disconnect();
    fn();
    this.connect();
  };



  handleMutation = () => {
    if (this.destroyed) return;

    this.index();
    this.run();
  };



  listen = () => {

    // `input` alone, and deliberately: the platform fires it on a checkbox,
    // a radio and a <select> as well as on a text field (before `change` in
    // each case), so one delegated listener covers every control in the
    // region — including the ones a later render brings.
    this.root.addEventListener('input', this.handleInput);
    this.root.addEventListener('keydown', this.handleKeydown);
    this.root.addEventListener('click', this.handleClick);
  };



  handleInput = (event) => {
    const config = this.config;
    const target = event.target;

    if (!(target instanceof Element)) return;
    if (
      !target.matches(`[${config.queryAttr}], [${config.facetAttr}]`)
    ) return;

    this.run();
  };



  // Enter in the query field must not submit anything. Once the module is
  // running the filtering is instant and a round trip would only throw the
  // result away — and where the field sits in a form as a server-side
  // fallback, that fallback is precisely what is no longer needed.
  handleKeydown = (event) => {
    if (event.key !== 'Enter') return;
    if (event.target !== this.field) return;

    event.preventDefault();
  };



  // The press must not submit anything either, and for the reason Enter in
  // the field must not: a <button> with no type is a submit button, and the
  // bar sitting in a form is real wiring rather than a mistake — that is
  // where a server-side fallback lives. Once the module runs, the round trip
  // would only throw away the result the page already has. This also stops
  // an <input type="reset"> resetting the form behind the module's back: a
  // native form reset writes the controls without firing `input`, so the
  // painted result and the controls would disagree until the next keystroke.
  handleClick = (event) => {
    const reset = event.target.closest?.(`[${this.config.resetAttr}]`);
    if (!reset || !this.root.contains(reset)) return;

    event.preventDefault();
    this.clear();
  };



  // The way back. Every control is put back to nothing and the region is
  // filtered again — one pass, from the live controls, like any other.
  //
  // With one thing to settle first. This pass ends with paint() disabling the
  // reset, and an element that is disabled WHILE IT HAS THE FOCUS hands the
  // focus to <body>: the reader who just pressed "clear" is put back at the
  // top of the document (WCAG 2.4.3), which is the one place they were not.
  // So where the press came from a control this pass makes inert, the focus
  // is moved on purpose — to the query field, or to the first facet where
  // there is no field. One of the two exists; setup() bails out where
  // neither does.
  //
  // Read `document.activeElement` BEFORE anything changes, and only move the
  // focus when it really was on a reset: a click does not focus a button in
  // every engine, and taking the focus off whatever else a reader was on
  // would be the same fault in the other direction.
  clear = () => {
    const losing = this.resets.includes(document.activeElement);

    if (this.field) this.field.value = '';

    this.facets.forEach((control) => {
      if (control instanceof HTMLSelectElement) {
        this.clearSelect(control);
        return;
      }

      if (control.type === 'radio') {
        this.clearRadio(control);
        return;
      }

      control.checked = false;
    });

    this.run();

    if (losing) (this.field || this.facets[0])?.focus();
  };



  // A radio group is cleared to its own "any" option, for the reason a
  // select is: a radio group is single-choice, so unchecking every one of
  // them leaves it in a state the author never shipped and a reader cannot
  // click their way back into. Setting the neutral one is enough — the
  // platform unchecks its siblings.
  //
  // The group is read from the DOM by `name` rather than from this.facets,
  // because the neutral radio often carries no facet attribute at all: an
  // empty value contributes no token, so there is nothing for the attribute
  // to do on it. A radio with no name is in no group and is simply
  // unchecked.
  clearRadio = (control) => {
    if (!control.name) {
      control.checked = false;
      return;
    }

    const any = Array.from(
      this.root.querySelectorAll('input[type="radio"]')
    ).find((radio) => radio.name === control.name && radio.value === '');

    if (!any) {
      control.checked = false;
      return;
    }

    any.checked = true;
  };



  // A select is cleared to its own "any" option — the one with an empty
  // value, which is what contributes no token. Where the author shipped
  // none, the first option is the closest thing to a neutral state there is.
  clearSelect = (select) => {
    const any = Array.from(select.options).find((option) => option.value === '');
    select.selectedIndex = any ? any.index : 0;
  };



  // Is the focus inside one of the items? It normally is not — a pass is
  // started from a control, which is where the reader then is — so this
  // answers one case: a later render changes an item's text, the observer
  // re-runs the pass, and the item holding the focus goes out. `hidden` on
  // an element that has the focus hands the focus to <body>, which puts the
  // reader at the top of the document (WCAG 2.4.3) — the same fault clear()
  // avoids by hand. One closest() per pass is what the answer costs.
  focusedItem = () => {
    const active = document.activeElement;
    if (!active || !this.root.contains(active)) return null;

    return active.closest(`[${this.config.itemAttr}]`);
  };



  // One pass: read, write, announce, tell the page. The announcement is
  // debounced and the event is not — a project listening for it wants the
  // result it can act on, not the one a reader has stopped typing at.
  //
  // The focus is read BEFORE the writes and moved only where the item it was
  // in has just gone out; setup() does not go through here, so a pass that
  // filters on load can never take the focus off whatever the page gave it.
  run = () => {
    const focused = this.focusedItem();
    const result = this.compute();

    this.paint(result);
    if (focused?.hasAttribute('hidden')) (this.field || this.facets[0])?.focus();

    this.announce();

    this.root.dispatchEvent(new CustomEvent(this.config.changedEvent, {
      bubbles: true,
      detail: {
        shown: result.shown,
        total: result.total,
        query: this.field ? this.field.value : '',
        // Only the NAMED groups: a lone control with neither a group name
        // nor a `name` is keyed by the element itself, which has no place in
        // an event detail. Name the group to see it here.
        facets: Object.fromEntries(
          Array.from(result.groups)
            .filter(([key]) => typeof key === 'string')
            .map(([key, tokens]) => [key, Array.from(tokens)])
        ),
      },
    }));
  };



  // The last step of init(), so a bail-out above leaves the bar hidden and
  // the full list showing. See filterList.scss for why `hidden` needs a rule
  // of this component's own to actually hide anything.
  reveal = () => {
    this.root
      .querySelectorAll(`[${this.config.controlsAttr}]`)
      .forEach((el) => el.removeAttribute('hidden'));
  };



  // Optional teardown for hosts that mount and unmount this subtree — see
  // destroyModulesInScope() in boot.js. Everything is handed back as
  // authored, and that includes re-hiding the controls: without the module
  // they are again a bar that does nothing.
  destroy = () => {
    this.destroyed = true;

    this.observer?.disconnect();

    this.root.removeEventListener('input', this.handleInput);
    this.root.removeEventListener('keydown', this.handleKeydown);
    this.root.removeEventListener('click', this.handleClick);

    if (this.field && this.status) removeDescribedBy(this.field, this.status.id);
    this.status?.remove();

    this.items.forEach((item) => item.el.removeAttribute('hidden'));
    this.empties.forEach((el) => el.setAttribute('hidden', ''));
    this.resets.forEach((el) => {
      el.disabled = false;
    });

    this.root.removeAttribute(this.config.stateAttr);

    this.root
      .querySelectorAll(`[${this.config.controlsAttr}]`)
      .forEach((el) => el.setAttribute('hidden', ''));
  };
}



// loader-compatible entry point (boot.js -> mod.init(el, services))
export function init(el, services = {}) {
  const reporter = services.reporter;

  if (!(el instanceof HTMLElement)) {
    reporter?.report(
      'filterList',
      'module was initialized on a non-element node.', el
    );
    return;
  }

  // Double-init is prevented by the loader (boot.js sets a per-element,
  // per-module flag before calling init), so no extra guard is needed here.
  const instance = new FilterList(el, defaults, reporter);
  return instance.destroy;
}
