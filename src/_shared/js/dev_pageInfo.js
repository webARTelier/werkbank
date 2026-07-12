
/**
 * dev_pageInfo.js
 * ----------------------------------------------------------------------------
 * Development-only page/viewport diagnostics overlay.
 *
 * Adds a small fixed badge (bottom-right) that reflects the current
 * environment as reported by CSS custom properties on <body>:
 *   --viewportName | --navstate | --density | --input
 * The badge updates live on window resize.
 *
 * On load — and again (debounced) on every resize — it also scans every
 * element for horizontal overflow (offsetWidth wider than the document) and
 * logs each offender plus the excess px to the console, which helps track
 * down unwanted horizontal scrollbars. A focusin listener additionally logs
 * the currently focused element to aid keyboard/focus debugging.
 *
 * Development aid only; it appends DOM and installs global handlers. Load as
 * a module in dev builds exclusively.
 * ----------------------------------------------------------------------------
 */



const getCssCustomProperty = (scope, name) => {
  const styles = getComputedStyle(scope);
  return styles.getPropertyValue(name).trim();
};



const debounceThenExecute = (func, delay) => {
  let timerId;

  return function () {
    const context = this;
    const args = arguments;

    clearTimeout(timerId);

    timerId = setTimeout(function () {
      func.apply(context, args);
    }, delay);
  };
};



document.addEventListener('DOMContentLoaded', function () {

  function getInfos() {
    let scope = document.body;
    let vpName = getCssCustomProperty(scope, '--viewportName');
    let navState = getCssCustomProperty(scope, '--navstate');
    let device = getCssCustomProperty(scope, '--input');
    let resolution = getCssCustomProperty(scope, '--density');
    return `${vpName} | ${navState} | ${resolution} | ${device}`;
  }

  const newElement = document.createElement('div');
  newElement.classList.add('devPageInfo');
  newElement.textContent = getInfos();
  document.querySelector('body').appendChild(newElement);

  const devPageInfo = document.querySelector('.devPageInfo');
  devPageInfo.style.cssText = 'position: fixed; right: 0; bottom: 0; z-index: 99999; padding: 0.2em 0.5em; font-size: 0.8em; color: white; background-color: black; opacity: 0.6';



  function checkWidth() {
    let i = 0;

    document.querySelectorAll('*').forEach(el => {
      if (el.offsetWidth > document.documentElement.offsetWidth) {
        const excess = el.offsetWidth - document.documentElement.offsetWidth;
        console.log(`Element ${excess}px too wide:`, el);
        i++;
      }
    });

    if (i == 0) console.log('✅ Element widths ok');
  }

  checkWidth();

  document.addEventListener('focusin', (event) => {
    console.log('Focused:', document.activeElement);
  });

  const debouncedCheckWidth = debounceThenExecute(checkWidth, 300);

  window.onresize = (e) => {
    devPageInfo.textContent = getInfos();
    debouncedCheckWidth();
  };
});
