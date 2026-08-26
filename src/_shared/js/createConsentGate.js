/**
 * createConsentGate.js
 * ----------------------------------------------------------------------------
 * Creates the service that answers ONE question for the whole page: has this
 * visitor already allowed content from a given third party? It is the seam
 * between a project's consent-management platform (CMP) and the components
 * that must not load anything until it says yes — today embedConsent.
 *
 * Why this is a service and not a component's own business
 * -------------------------------------------------------
 * Every CMP answers the question differently, and the signatures drift with
 * major versions:
 *
 *   Cookiebot            window.Cookiebot.consent.marketing
 *   Usercentrics         window.UC_UI.getServicesBaseInfo() -> consent.status
 *   Klaro!               window.klaro.getManager().consents[name]
 *   Borlabs Cookie       a different call in v2 than in v3
 *   Complianz            window.cmplz_has_consent('marketing')
 *   TCF v2.2             window.__tcfapi('addEventListener', 2, cb)
 *
 * A component that shipped six sniffers would be a maintenance promise this
 * collection cannot keep, and it would still be wrong about the last two:
 * TCF and Google Consent Mode know advertising purposes and vendor ids, not
 * "an embedded YouTube player is allowed". Which of a project's categories
 * or services covers a map is a decision only that project can make. So the
 * translation lives at the composition root (boot.js), the components ask,
 * and nothing in dist/js/modules/ knows a single CMP name.
 *
 * Two ways to answer, and the first one is the one to prefer
 * ---------------------------------------------------------
 * 1. An ATTRIBUTE holding the granted tokens, by default
 *    `<html data-consent="youtube maps">`. Every CMP in the table above can
 *    write that from its own callback in about five lines of project code,
 *    and it has one property no JavaScript answer has: a render-blocking
 *    stylesheet can read it. That is what lets a project kill the flash of
 *    a consent notice shown to somebody who consented long ago (see
 *    embedConsent's readme).
 * 2. A `resolve` callback, for a project that would rather ask its CMP
 *    directly. It is called with one token and may return anything truthy.
 *    A throw counts as "not granted" — `Cookiebot.consent.marketing` is a
 *    TypeError until Cookiebot has loaded, and a gate that broke on that
 *    would be a gate that loads embeds on a page whose CMP is still on its
 *    way.
 *
 * Both lanes stay live at once, so a project can answer through the
 * callback and still flip the attribute for the CSS.
 *
 * Handing a decision BACK: grant / revoke
 * ---------------------------------------
 * The two above only ever read. `grant` and `revoke` are the other
 * direction: a visitor who decides inside the page — "always allow YouTube",
 * at the box itself rather than in a banner — and a project that wants that
 * decision to outlive the page view. The gate does not store it. It hands
 * the token to the project's CMP, the CMP stores it, documents it and writes
 * its own answer back, and the change arrives through `subscribe()` like any
 * other. Nothing here is faked locally: a caller that grants and then asks
 * `has()` gets whatever the CMP says, which is the only answer worth having.
 *
 * That is the whole reason this is a callback and not a few lines writing the
 * attribute. A consent is a record with an obligation to PROVE it attached,
 * and a record that never reached the platform's own consent log is a
 * consent nobody can prove. So the grant goes THROUGH the CMP or it does not
 * happen.
 *
 * Four things to know before wiring them:
 *
 * 1. BOTH OR NEITHER. `canGrant()` is false unless both are functions, and
 *    callers are expected to hide their control on it. Withdrawal has to be
 *    as easy as consent (GDPR Art. 7(3)); a page that can grant with one
 *    press and only take it back through a dialog somewhere else has made
 *    the easy direction the permanent one.
 * 2. THE TOKEN IS THE SPECIFIC ONE. Callers pass what they are about — a
 *    service ("youtube"), not the category a category-only CMP would file it
 *    under. Mapping one to the other is a decision this file must not make:
 *    granting "marketing" from a video box grants more than the box
 *    explained, and what the box explained is the entire justification for
 *    the press. Do it in your callback, deliberately, or do not offer the
 *    lane at all.
 * 3. TCF HAS NO WRITE API. `__tcfapi` can be asked and listened to; there is
 *    no command that sets a consent, because in that framework only the CMP's
 *    own UI may. A TCF project therefore passes no `grant`, `canGrant()`
 *    stays false, and the control simply never appears. Same for any
 *    platform whose only per-service granularity is a category.
 * 4. A THROW IS A FAILURE, NOT AN EXCEPTION. Same reasoning as `resolve`:
 *    the CMP may not have loaded, or a content blocker may have removed it.
 *    Both return false, and it is the caller's business what to do with a
 *    decision that did not arrive anywhere.
 *
 * Known per-service calls, as a starting point — check the signature against
 * the version you actually run, they drift:
 *
 *   Usercentrics        UC_UI.acceptService(id) / denyService(id)
 *   Klaro!              manager.updateConsent(name, true|false),
 *                       then manager.saveAndApplyConsents()
 *   Borlabs Cookie 3    the Consents object, a different call than in v2
 *   Cookiebot           submitCustomConsent(pref, stat, mark) — CATEGORIES
 *                       only, so read point 2 before using it
 *
 * Watching for changes, and only when somebody is watching
 * -------------------------------------------------------
 * `subscribe()` is what makes the two cases this exists for work: consent
 * granted in the banner AFTER the page was built, and consent withdrawn
 * again. The MutationObserver and the event listeners are created on the
 * first subscription and torn down with the last, so a page with no embed on
 * it pays nothing for the service being in boot.min.js — which is where it
 * has to be, because only the composition root knows the project's CMP.
 *
 * Configuration
 * -------------
 *   element     the element carrying the token list (default <html>)
 *   attribute   its attribute name (default "data-consent")
 *   events      event names that mean "ask again" (default ["consentchange"])
 *   eventTarget where those are listened for (default window, which also
 *               sees anything dispatched on document)
 *   resolve     optional (token) => boolean, asked instead of nothing else
 *   grant       optional (token) => void, hands ONE token to your CMP
 *   revoke      optional (token) => void, takes it back. Both or neither.
 * ----------------------------------------------------------------------------
 */



export function createConsentGate({
  element = document.documentElement,
  attribute = 'data-consent',
  events = ['consentchange'],
  eventTarget = window,
  resolve = null,
  grant = null,
  revoke = null,
} = {}) {

  const listeners = new Set();
  let observer = null;

  const grantedTokens = () => (element?.getAttribute(attribute) || '')
    .split(/\s+/)
    .filter(Boolean);

  // A callback that throws is a CMP that has not arrived yet, which is the
  // same answer as "no" and must not become an exception in a caller.
  const askResolve = (token) => {
    try {
      return Boolean(resolve(token));
    } catch {

      // Nothing to report to: the gate has no reporter, and a CMP loading
      // late is not an author error.
      return false;
    }
  };

  // Both or neither, and the reason is not symmetry for its own sake: a
  // caller hides its control on this, so a project that could only grant
  // would put a one-press consent into a page whose only way back is
  // somewhere else entirely (Art. 7(3)). See the header.
  const canGrant = () => typeof grant === 'function'
    && typeof revoke === 'function';

  // Hands one token over and says whether that happened. Deliberately no
  // local bookkeeping: what is granted is whatever the CMP says next time it
  // is asked, and it will say so through notify() on its own.
  const push = (fn, token) => {
    try {
      fn(token);
      return true;
    } catch {

      // A CMP that is not there, or a project callback that is wrong about
      // the version it is talking to. The gate has no reporter; the caller
      // knows what it was trying to do and can say so.
      return false;
    }
  };

  const handOver = (token) => canGrant() && !!token && push(grant, token);
  const takeBack = (token) => canGrant() && !!token && push(revoke, token);

  const notify = () => {

    // Copied, because a listener may unsubscribe from inside the callback
    // (embedConsent's cleanup does, when a consent change tears its subtree
    // down).
    for (const listener of [...listeners]) listener();
  };

  const start = () => {
    for (const name of events) eventTarget?.addEventListener(name, notify);

    if (!element) return;

    observer = new MutationObserver(notify);
    observer.observe(element, {
      attributes: true,
      attributeFilter: [attribute],
    });
  };

  const stop = () => {
    for (const name of events) eventTarget?.removeEventListener(name, notify);

    observer?.disconnect();
    observer = null;
  };

  return {

    // Several tokens, one answer: a caller asks with everything that would
    // cover it — the exact service ("youtube") and the category a
    // category-only CMP would have granted ("marketing") — and any one of
    // them is enough. That is what lets one markup contract serve both
    // granularities without the component knowing which kind of CMP is
    // running.
    has(...tokens) {
      const asked = tokens.filter(Boolean);
      if (!asked.length) return false;

      if (typeof resolve === 'function') {
        return asked.some((token) => askResolve(token));
      }

      const granted = grantedTokens();
      return asked.some((token) => granted.includes(token));
    },

    // Is there a way to hand a decision to the platform from inside the page
    // at all? A caller with a "always allow" control asks this FIRST and
    // ships nothing where the answer is no — which is every project that
    // wired no callbacks, and every TCF project (see the header).
    canGrant,

    // One token, the specific one (see point 2 in the header). Returns
    // whether the CMP was actually reached; false also for a token-less call
    // and for a project that wired nothing, so a caller needs no second
    // check.
    //
    // Named apart from the callbacks they hand the token to, so that neither
    // body has to be read twice to see that it is not calling itself.
    grant: handOver,
    revoke: takeBack,

    // Returns the unsubscribe function. The watchers exist only while at
    // least one listener does.
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};

      listeners.add(listener);
      if (listeners.size === 1) start();

      return () => {
        listeners.delete(listener);
        if (!listeners.size) stop();
      };
    },
  };
}
