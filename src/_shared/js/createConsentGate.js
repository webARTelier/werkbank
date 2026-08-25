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
 * ----------------------------------------------------------------------------
 */



export function createConsentGate({
  element = document.documentElement,
  attribute = 'data-consent',
  events = ['consentchange'],
  eventTarget = window,
  resolve = null,
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
