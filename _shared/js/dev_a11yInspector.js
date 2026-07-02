document.addEventListener('DOMContentLoaded', () => {

  setTimeout(() => {

    const findings = [];

    const highlightElement = (el, label) => {
      el.style.outline = '2px dotted red';
      el.setAttribute('data-a11y-flag', label);
      el.title = `A11y warning: ${label}`;
    }



    // layout tables
    document.querySelectorAll('table').forEach((el) => {
      if (!el.querySelector('th') && !el.querySelector('caption')) {
        highlightElement(el, 'Layout table missing th/caption');
        findings.push({ type: 'table (layout)', element: el });
      }
    })



    // non-semantic SVGs
    document.querySelectorAll('svg').forEach((el) => {
      const hasDescOrTitle = el.querySelector('title, desc');
      const hasAriaOrRole = el.hasAttribute('aria-hidden') || el.hasAttribute('role');
      if (!hasDescOrTitle && !hasAriaOrRole) {
        highlightElement(el, 'SVG missing aria/role/title/desc');
        findings.push({ type: 'svg (non-semantic)', element: el });
      }
    })



    // images with empty or missing alt
    document.querySelectorAll('img').forEach((el) => {
      const alt = el.getAttribute('alt');
      if (alt === null || alt.trim() === '') {
        highlightElement(el, 'Image missing or empty alt attribute');
        findings.push({ type: 'img (missing alt)', element: el });
      }
    })



    // icon elements without semantics
    document.querySelectorAll('i').forEach((el) => {
      const classNames = el.className;
      if (
        /(icon|fa|material-icons|mdi)/.test(classNames) &&
        !el.hasAttribute('aria-hidden') &&
        !el.hasAttribute('role')
      ) {
        highlightElement(el, 'Icon element missing aria-hidden/role');
        findings.push({ type: 'icon (non-semantic)', element: el });
      }
    })

    document.querySelectorAll('div.c-icon').forEach((el) => {
      if (!el.hasAttribute('aria-hidden') && !el.hasAttribute('role')) {
        highlightElement(el, 'Icon element missing aria-hidden/role');
        findings.push({ type: 'div.c-icon (missing aria-hidden/role)', element: el });
      }
    })



    // form elements missing label or ARIA label
    document.querySelectorAll('input, textarea, select').forEach((el) => {
      const id = el.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAria = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
      if (!hasLabel && !hasAria) {
        highlightElement(el, 'Form element missing label or aria-label');
        findings.push({ type: 'form (missing label)', element: el });
      }
    })



    // buttons and links with no accessible name
    document.querySelectorAll('button, a').forEach((el) => {
      const text = el.textContent.trim();
      const hasLabel = el.getAttribute('aria-label') || el.getAttribute('title');
      if (text === '' && !hasLabel) {
        highlightElement(el, 'Interactive element with no accessible name');
        findings.push({ type: `${el.tagName.toLowerCase()} (missing label)`, element: el });
      }
    })



    // headings that are empty
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
      if (el.textContent.trim() === '') {
        highlightElement(el, 'Empty heading tag');
        findings.push({ type: 'heading (empty)', element: el });
      }
    })



    // check for missing <main> landmark without marking <body>
    const hasMain = document.querySelector('main, [role="main"]');
    if (!hasMain) {
      findings.push({ type: 'landmark (missing main)', element: null });
    }



    // elements with tabindex > 0
    document.querySelectorAll('[tabindex]').forEach((el) => {
      const tabindex = parseInt(el.getAttribute('tabindex'), 10);
      if (tabindex > 0) {
        highlightElement(el, 'Element has tabindex > 0');
        findings.push({ type: 'tabindex (positive)', element: el });
      }
    })



    // visual flag style
    const style = document.createElement('style');
    style.textContent = `
      [data-a11y-flag] {
        position: relative;
      }
      [data-a11y-flag]::after {
        content: attr(data-a11y-flag);
        position: absolute;
        top: -1.5em;
        left: 0;
        background: red;
        color: white;
        font-size: 10px;
        padding: 2px 4px;
        z-index: 10000;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);



    // output results to the console
    if (findings.length) {
      console.group(`Accessibility findings (${findings.length})`);
      findings.forEach(({ type, element }, i) => {
        if (element) {
          console.log(`%c[${i + 1}] ${type}`, 'color: orange; font-weight: bold;', element);
        } else {
          console.log(`%c[${i + 1}] ${type}`, 'color: orange; font-weight: bold;');
        }
      })
      console.groupEnd();
      return;
    }

    console.log('✅ No accessibility issues detected in visual and interactive elements.');

  }, 500)

});
