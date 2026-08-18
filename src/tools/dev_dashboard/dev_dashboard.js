(function () {
  'use strict';

  const PROBE_NAME = 'devDashboardProbe';
  if (window.name === PROBE_NAME) return;

  const registry = (window.__devTools = window.__devTools || {});
  if (registry.dashboard) {
    registry.dashboard.open();
    return;
  }

  const STORE_KEY = 'devDashboard.collapsed';
  const HOST_ATTR = 'data-dev-dashboard-host';
  const SPACER_ATTR = 'data-dev-dashboard-spacer';
  const STYLE_ATTR = 'data-dev-dashboard-style';
  const FLAG_ATTR = 'data-dev-dashboard-flag';
  const FOCUS_ATTR = 'data-dev-dashboard-focus';
  const PICK_ATTR = 'data-dev-dashboard-pick';
  const HOVER_ATTR = 'data-dev-dashboard-hover';
  const PICKING_ATTR = 'data-dev-dashboard-picking';
  const FILL_ATTR = 'data-dev-dashboard-fill';
  const FLASH_MS = 1600;
  const EXCERPT = 42;

  const TOOLS = [];

  const q = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

  const escapeHtml = (value) => String(value).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );

  const cssEscape = (value) => (window.CSS && CSS.escape
    ? CSS.escape(value)
    : String(value).replace(/"/g, '\\"'));

  const debounce = (fn, ms) => {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  };

  const store = {
    read() {
      try { return localStorage.getItem(STORE_KEY); } catch (err) { return null; }
    },
    write(value) {
      try { localStorage.setItem(STORE_KEY, value); } catch (err) { return; }
    },
  };

  function describe(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      tag: `<${tag}>${id}${cls}`,
      excerpt: text.length > EXCERPT ? `${text.slice(0, EXCERPT)}…` : text,
    };
  }

  const ICONS = {
    a11y: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4" r="2"/>'
      + '<path d="M4 8.5h16M12 8.5v6m0 0-3.2 6.5m3.2-6.5 3.2 6.5"/></svg>',
    overflow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v16m11-16v16"/>'
      + '<path d="M8 12h13m0 0-3-3m3 3-3 3"/></svg>',
    qr: '<svg class="filled" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 2h6v6H2V2Zm2 2v2h2V4H4Zm8-2h6v6h-6V2Zm2 2v2h2V4h-2ZM2 12h6v6H2v-6Zm2 2v2h2v-2H4Zm9-4h2v2h-2v-2Zm3 0h2v3h-2v-3Zm-6 3h2v5h-2v-5Zm4 1h4v2h-4v-2Zm2 3h2v1h-2v-1Zm-3 0h2v1h-2v-1Z"/></svg>',
    srcset: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/>'
      + '<path d="m6 16.5 4-4 3 3 2.5-2.5L21 16"/><circle cx="9" cy="9.5" r="1.3"/></svg>',
    form: '<svg viewBox="0 0 24 24" aria-hidden="true">'
      + '<rect x="3" y="3" width="14" height="18" rx="2"/>'
      + '<path d="M7 8h6M7 12h6M7 16h3"/>'
      + '<path d="m14 17.5 2.5 2.5 5-5.5"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };

  const pageStyle = document.createElement('style');
  pageStyle.setAttribute(STYLE_ATTR, '');
  pageStyle.textContent = `
    [${FLAG_ATTR}] {
      position: relative;
      outline: 2px dotted #f87171 !important;
      outline-offset: 1px;
    }
    [${FLAG_ATTR}]::after {
      content: attr(${FLAG_ATTR});
      position: absolute;
      inset-block-start: -1.5em;
      inset-inline-start: 0;
      z-index: 2147483640;
      padding: 2px 5px;
      border-radius: 3px;
      background: #b91c1c;
      color: #fff;
      font: 600 10px/1.4 ui-monospace, Consolas, monospace;
      white-space: nowrap;
      pointer-events: none;
    }
    [${FOCUS_ATTR}] {
      outline: 3px solid #93c5fd !important;
      outline-offset: 2px;
    }
    [${PICK_ATTR}] {
      outline: 2px solid #38bdf8 !important;
      outline-offset: -2px !important;
    }
    [${HOVER_ATTR}] {
      outline: 2px dashed #fbbf24 !important;
      outline-offset: -2px !important;
    }
    [${FILL_ATTR}] {
      outline: 2px solid #22c55e !important;
      outline-offset: 1px !important;
    }
    [${PICKING_ATTR}],
    [${PICKING_ATTR}] *:not([${HOST_ATTR}]) { cursor: crosshair !important; }
  `;
  document.head.appendChild(pageStyle);

  let spacer = null;
  let spaceValue = -1;

  function setSpace(px) {
    if (px === spaceValue) return;
    spaceValue = px;
    if (px <= 0) {
      spacer?.remove();
      spacer = null;
      return;
    }
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.setAttribute(SPACER_ATTR, '');
      spacer.setAttribute('aria-hidden', 'true');
      spacer.style.cssText = 'flex: 0 0 auto; grid-column: 1 / -1; inline-size: 100%;';
    }
    spacer.style.blockSize = `${px}px`;
    if (spacer.parentNode !== document.body) document.body.appendChild(spacer);
  }

  let flashTimer = 0;
  let flashed = null;

  function flash(el) {
    if (!el) return;
    clearTimeout(flashTimer);
    if (flashed) flashed.removeAttribute(FOCUS_ATTR);
    flashed = el;
    el.setAttribute(FOCUS_ATTR, '');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    flashTimer = setTimeout(() => {
      el.removeAttribute(FOCUS_ATTR);
      flashed = null;
    }, FLASH_MS);
  }

  function setFlags(findings, on) {
    findings.forEach(({ el, label }) => {
      if (!el) return;
      if (on) el.setAttribute(FLAG_ATTR, label);
      else el.removeAttribute(FLAG_ATTR);
    });
  }

  function clearPage() {
    clearTimeout(flashTimer);
    flashed = null;
    q(`[${FLAG_ATTR}]`).forEach((el) => el.removeAttribute(FLAG_ATTR));
    q(`[${FOCUS_ATTR}]`).forEach((el) => el.removeAttribute(FOCUS_ATTR));
    q(`[${PICK_ATTR}]`).forEach((el) => el.removeAttribute(PICK_ATTR));
    q(`[${HOVER_ATTR}]`).forEach((el) => el.removeAttribute(HOVER_ATTR));
    q(`[${FILL_ATTR}]`).forEach((el) => el.removeAttribute(FILL_ATTR));
  }

  const host = document.createElement('div');
  host.setAttribute(HOST_ATTR, '');
  host.style.cssText = 'all: initial;';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    [hidden] { display: none !important; }

    .wrap { --bar-h: 34px; color: #e6e8ee; font-size: 12px; line-height: 1.5; }

    button {
      appearance: none; margin: 0; padding: 5px 10px;
      border: 1px solid #333a4a; border-radius: 7px;
      background: #232838; color: #dfe4ee;
      font: inherit; font-weight: 600; cursor: pointer;
      transition: background .12s, border-color .12s, color .12s;
    }
    button:not(:disabled):hover { background: #2c3346; border-color: #3d465c; color: #fff; }
    button:disabled { opacity: .45; cursor: not-allowed; }
    button:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
    button.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
    button.primary:not(:disabled):hover { background: #1d4ed8; border-color: #1d4ed8; }
    button.ghost { background: transparent; border-color: transparent; color: #9aa4b8; padding: 5px 7px; }
    button.ghost:not(:disabled):hover { background: #262b38; border-color: #333a4a; color: #e6e8ee; }
    button.bar-destroy:not(:disabled):hover { background: #7f1d1d; border-color: #b91c1c; color: #fecaca; }
    button[aria-pressed="true"] { background: #b91c1c; border-color: #b91c1c; color: #fff; }
    button[aria-pressed="true"]:not(:disabled):hover { background: #dc2626; border-color: #dc2626; }

    svg { display: block; inline-size: 17px; block-size: 17px;
      fill: none; stroke: currentColor; stroke-width: 1.7;
      stroke-linecap: round; stroke-linejoin: round; }
    svg.filled { fill: currentColor; stroke: none; }

    input[type="number"] {
      inline-size: 84px; padding: 5px 7px; border-radius: 6px;
      font: inherit; background: #0f1116; border: 1px solid #333a4a; color: #e6e8ee;
    }

    .bar {
      position: fixed; inset-inline: 0; inset-block-end: 0; z-index: 2147483646;
      display: flex; align-items: center; gap: 10px; padding: 4px 8px;
      background: #14161c; border-block-start: 1px solid #2a2e3a;
      box-shadow: 0 -6px 24px rgba(0, 0, 0, .35);
    }
    .bar.collapsed { justify-content: flex-end; padding: 0 8px; }
    .bar.collapsed .readout,
    .bar.collapsed .tools,
    .bar.collapsed .bar-destroy { display: none; }
    .bar.collapsed .chevron { transform: rotate(180deg); }

    @media (max-width: 640px) {
      .bar { flex-wrap: wrap; justify-content: center; row-gap: 7px; padding: 6px 8px; }
      .bar.collapsed { justify-content: flex-end; }
      .bar .spacer { display: none; }
      .bar .tools,
      .bar .chevron,
      .bar .bar-destroy { order: 1; }
      .bar .readout { order: 2; flex: 1 0 100%; justify-content: center; }
    }

    .readout { display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
      color: #cbd2e1; white-space: nowrap; }
    .readout .size { color: #93c5fd; font-variant-numeric: tabular-nums; }
    .readout .sep { color: #3b4252; }
    .readout .miss { color: #fbbf24; cursor: help; font-weight: 700;
      transition: color .12s; }
    .readout .miss:hover { color: #fde68a; }
    .spacer { flex: 1 1 auto; }
    .tools { display: flex; align-items: center; gap: 4px; }

    .tool { position: relative; padding: 5px 7px; }
    .tool[aria-expanded="true"] { background: #2563eb; border-color: #2563eb; color: #fff; }
    .tool[aria-expanded="true"]:hover { background: #1d4ed8; border-color: #1d4ed8; }
    .dot {
      position: absolute; inset-block-end: -3px; inset-inline-end: -3px;
      min-inline-size: 10px; block-size: 10px; padding: 0 2px;
      border: 1px solid #14161c; border-radius: 999px;
      font-size: 8px; line-height: 8px; font-weight: 700; text-align: center;
    }
    .dot.clean { background: #22c55e; color: #04210f; }
    .dot.hit { background: #ef4444; color: #fff; }
    .dot.busy { background: #fbbf24; color: #231a02; }

    .panel {
      position: fixed; inset-inline: 0; inset-block-end: var(--bar-h); z-index: 2147483645;
      display: flex; flex-direction: column; max-block-size: 60vh;
      background: #14161c; color: #e6e8ee;
      border-block-start: 1px solid #2a2e3a;
      box-shadow: 0 -8px 30px rgba(0, 0, 0, .4);
    }
    .panel-bar {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      flex: 0 0 auto; padding: 7px 10px; min-block-size: 40px;
      background: #1b1e27; border-block-end: 1px solid #2a2e3a;
    }
    .panel-title { font-weight: 700; color: #cbd2e1; white-space: nowrap; }
    .panel-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .panel-body { flex: 1 1 auto; overflow: auto; padding: 12px; }

    .badge { padding: 2px 8px; border-radius: 999px; background: #262b38;
      color: #9aa4b8; font-size: 11px; white-space: nowrap; }
    .badge.clean { background: #14532d; color: #bbf7d0; }
    .badge.hit { background: #7f1d1d; color: #fecaca; }

    .hint { margin: 0 0 12px; color: #6f7a8d; max-inline-size: 88ch; }
    .hint code { padding: 1px 5px; border-radius: 4px; background: #232838; color: #cbd2e1; }
    .hint b { color: #cbd2e1; }
    .clean-note { margin: 0; color: #bbf7d0; }
    .empty { padding: 20px; color: #9aa4b8; text-align: center; }
    .error { padding: 12px; border: 1px solid #7f1d1d; border-radius: 9px;
      background: #1d1113; color: #fecaca; }
    .error b { color: #fca5a5; }
    .note { margin: 0; max-inline-size: 34ch; color: #6f7a8d; font-size: 11px; line-height: 1.45; }

    .group { margin-block-end: 14px; }
    .group-head { display: flex; align-items: baseline; gap: 8px;
      padding-block-end: 4px; margin-block-end: 6px; border-block-end: 1px solid #262b38; }
    .group-head .kind { color: #fca5a5; font-weight: 700; }
    .group-head .count { color: #6f7a8d; }

    .row { display: flex; align-items: center; gap: 10px; inline-size: 100%;
      padding: 5px 8px; border: 1px solid transparent; border-radius: 6px;
      background: transparent; color: #cbd2e1; text-align: start; font-weight: 400;
      transition: background .12s, border-color .12s, color .12s; }
    button.row:not(:disabled):hover,
    .row.pick:hover { background: #1b1f28; border-color: #2a2e3a; color: #e6e8ee; }
    .row.pick { padding: 2px 4px 2px 8px; }
    .row .tag { flex: 0 0 auto; color: #93c5fd; }
    .row .num { flex: 0 0 auto; color: #fca5a5; font-variant-numeric: tabular-nums; }
    .row .idx { flex: 0 0 auto; min-inline-size: 2ch; color: #93c5fd; font-weight: 700;
      font-variant-numeric: tabular-nums; }
    .row .grow { display: flex; align-items: center; gap: 10px; flex: 1 1 auto;
      overflow: hidden; padding: 4px; border: 0; border-radius: 5px;
      background: transparent; color: inherit; text-align: start; font-weight: 400; }
    .row .grow:not(:disabled):hover { background: #262b38; color: #e6e8ee; }
    .row .excerpt { overflow: hidden; color: #8f99ad; text-overflow: ellipsis; white-space: nowrap; }
    .row .doc { flex: 0 0 auto; color: #6f7a8d; }
    .row .filled { color: #bbf7d0; }
    .row .warn { flex: 0 0 auto; color: #fbbf24; }
    button.mini { padding: 3px 8px; font-size: 11px; }

    .result { margin-block-end: 12px; border: 1px solid #2a2e3a; border-radius: 9px; overflow: hidden; }
    .result-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      background: #1b1e27; border-block-end: 1px solid #2a2e3a; }
    .result-head .idx { min-inline-size: 2ch; color: #cbd2e1; font-weight: 700;
      font-variant-numeric: tabular-nums; }
    .result-head .name { color: #93c5fd; font-weight: 700; }
    .result-head .meta { color: #9aa4b8; font-size: 11px; }
    .result-body { padding: 10px 12px; }
    .field { margin-block-end: 10px; }
    .field:last-child { margin-block-end: 0; }
    .field-label { margin-block-end: 4px; color: #9aa4b8; font-size: 11px;
      text-transform: uppercase; letter-spacing: .5px; }
    .field-note { margin-block-start: 4px; color: #9aa4b8; font-size: 11px; }
    .field-note b { color: #fbbf24; }
    .code { position: relative; padding: 8px 10px; border: 1px solid #262b38; border-radius: 7px;
      background: #0f1116; color: #d5dbe8; white-space: pre-wrap; word-break: break-word; }
    .code .copy { position: absolute; inset-block-start: 6px; inset-inline-end: 6px;
      padding: 3px 8px; font-size: 11px; }

    table { inline-size: 100%; margin-block-start: 2px; border-collapse: collapse; }
    th, td { padding: 3px 8px; border-block-end: 1px solid #232838;
      text-align: right; font-variant-numeric: tabular-nums; }
    th:first-child, td:first-child { text-align: left; }
    th { color: #9aa4b8; font-size: 11px; font-weight: 600; }

    .unit-toggle { display: inline-flex; border: 1px solid #333a4a; border-radius: 7px; overflow: hidden; }
    .unit-toggle button { border: 0; border-radius: 0; padding: 5px 11px;
      background: #232838; color: #9aa4b8; }
    .unit-toggle button:not(:disabled):hover { background: #2c3346; color: #e6e8ee; }
    .unit-toggle button.active { background: #2563eb; color: #fff; }
    .unit-toggle button.active:not(:disabled):hover { background: #1d4ed8; color: #fff; }
    .range { display: flex; align-items: center; gap: 8px; margin-block-end: 12px; color: #9aa4b8; }

    .overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; flex-direction: column; gap: 10px; padding: 14px;
      background: rgba(8, 9, 12, .9);
    }
    .stage { position: relative; flex: 1 1 auto; overflow: hidden;
      border: 1px solid #2a2e3a; border-radius: 10px; background: #0f1116; }
    .probe { position: absolute; inset-block-start: 0; inset-inline-start: 0;
      border: 0; transform-origin: 0 0; background: #fff; pointer-events: none; }
    .progress { flex: 0 0 auto; display: flex; flex-direction: column; gap: 8px; }
    .track { position: relative; block-size: 6px; border-radius: 999px;
      background: #232838; overflow: hidden; }
    .track i { position: absolute; inset-block: 0; inset-inline-start: 0;
      inline-size: 0; background: #2563eb; border-radius: inherit; transition: inline-size .1s linear; }
    .track.indeterminate i { inline-size: 28%; animation: slide 1.1s linear infinite; }
    @keyframes slide { from { inset-inline-start: -28%; } to { inset-inline-start: 100%; } }
    .progress-row { display: flex; align-items: center; gap: 12px; color: #cbd2e1; }
    .progress-row b { color: #93c5fd; font-variant-numeric: tabular-nums; }

    .pins { position: fixed; inset: 0; z-index: 2147483644; pointer-events: none; }
    .pin { position: absolute; inset-block-start: 0; inset-inline-start: 0;
      padding: 1px 7px; border-radius: 999px; background: #2563eb; color: #fff;
      font: 700 10px/1.6 ui-monospace, Consolas, monospace;
      box-shadow: 0 1px 4px rgba(0, 0, 0, .45); }

    .picker { position: fixed; inset-block-end: calc(var(--bar-h) + 12px);
      inset-inline-start: 50%; transform: translateX(-50%); z-index: 2147483647;
      display: flex; align-items: center; gap: 12px; max-inline-size: calc(100vw - 24px);
      padding: 7px 10px; border: 1px solid #2a2e3a; border-radius: 10px;
      background: #14161c; color: #cbd2e1;
      box-shadow: 0 6px 26px rgba(0, 0, 0, .45); }
    .picker b { color: #93c5fd; white-space: nowrap; }

    .toast { position: fixed; inset-block-end: calc(var(--bar-h) + 12px);
      inset-inline-start: 50%; transform: translateX(-50%); z-index: 2147483647;
      padding: 6px 14px; border-radius: 8px; background: #22c55e; color: #04210f;
      font-weight: 700; opacity: 0; transition: opacity .2s; pointer-events: none; }
    .toast.show { opacity: 1; }
  `;

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.innerHTML = `
    <section class="panel" id="panel" hidden aria-label="Dev dashboard panel">
      <header class="panel-bar">
        <span class="panel-title" id="panelTitle"></span>
        <span class="panel-controls" id="panelControls"></span>
        <span class="spacer"></span>
        <button class="ghost" id="panelClose" type="button" title="Close panel" aria-label="Close panel">${ICONS.close}</button>
      </header>
      <div class="panel-body" id="panelBody"></div>
    </section>

    <div class="bar" id="bar">
      <div class="readout" id="readout"></div>
      <span class="spacer"></span>
      <div class="tools" id="toolButtons"></div>
      <button class="ghost chevron" id="collapseBtn" type="button" aria-expanded="true" title="Collapse dashboard" aria-label="Collapse dashboard">${ICONS.chevron}</button>
      <button class="ghost bar-destroy" id="destroyBtn" type="button" title="Remove dev dashboard" aria-label="Remove dev dashboard">${ICONS.close}</button>
    </div>

    <div class="overlay" id="overlay" hidden>
      <div class="stage" id="stage"></div>
      <div class="progress">
        <div class="track" id="track"><i id="trackFill"></i></div>
        <div class="progress-row">
          <span id="progressText"></span>
          <span class="spacer"></span>
          <button id="abortBtn" type="button">Abort (Esc)</button>
        </div>
      </div>
    </div>

    <div class="pins" id="pins" hidden aria-hidden="true"></div>

    <div class="picker" id="picker" hidden role="group" aria-label="Image selection">
      <span>Click an image to select it, click it again to drop it.
        <b id="pickCount">0 selected</b></span>
      <span class="spacer"></span>
      <button id="pickClear" type="button">clear</button>
      <button class="primary" id="pickDone" type="button">done (Esc)</button>
    </div>

    <div class="toast" id="toast">copied</div>
  `;

  shadow.append(style, wrap);

  const $ = (id) => shadow.getElementById(id);
  const bar = $('bar');
  const panel = $('panel');
  const panelTitle = $('panelTitle');
  const panelControls = $('panelControls');
  const panelBody = $('panelBody');
  const toolButtons = $('toolButtons');
  const readout = $('readout');
  const toast = $('toast');

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1200);
  }

  function copyButton(text, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.textContent = label || 'copy';
    button.addEventListener('click', () => {
      navigator.clipboard?.writeText(text).then(
        () => showToast('copied'),
        () => showToast('copying failed')
      );
    });
    return button;
  }

  function wireCopyButtons(root) {
    q('.copy[data-copy]', root).forEach((button) => {
      button.type = 'button';
      button.addEventListener('click', () => {
        navigator.clipboard?.writeText(button.getAttribute('data-copy')).then(
          () => showToast('copied'),
          () => showToast('copying failed')
        );
      });
    });
  }

  let openTool = null;
  let collapsed = store.read() === 'true';

  function syncSpace() {
    wrap.style.setProperty('--bar-h', `${bar.offsetHeight}px`);
    setSpace(bar.offsetHeight);
  }

  function syncToolButtons() {
    TOOLS.forEach((tool) => {
      if (!tool.button) return;
      tool.button.setAttribute('aria-expanded', String(openTool === tool));
    });
  }

  function closePanel() {
    if (openTool && openTool.onClose) openTool.onClose();
    openTool = null;
    panel.hidden = true;
    panelControls.replaceChildren();
    panelBody.replaceChildren();
    syncToolButtons();
  }

  function openPanel(tool) {
    if (openTool === tool) {
      closePanel();
      return;
    }
    if (openTool) closePanel();
    openTool = tool;
    panelTitle.textContent = tool.label;
    panelControls.replaceChildren(...(tool.controls ? tool.controls() : []));
    panelBody.replaceChildren();
    panel.hidden = false;
    tool.onOpen(panelBody);
    syncToolButtons();
    syncSpace();
  }

  function refreshPanel() {
    if (!openTool) return;
    panelBody.replaceChildren();
    openTool.onOpen(panelBody);
  }

  function showTool(tool) {
    if (openTool === tool) refreshPanel();
    else openPanel(tool);
  }

  function refreshBadge(tool) {
    if (!tool.button) return;
    const dot = tool.button.querySelector('.dot');
    if (!dot) return;
    const badge = tool.badge || {};
    dot.className = `dot ${badge.kind || ''}`.trim();
    dot.textContent = badge.text || '';
    dot.hidden = !badge.kind;
    tool.button.title = badge.title || tool.title;
    tool.button.setAttribute('aria-label', badge.title || tool.title);
  }

  function setBadge(tool, kind, text, title) {
    tool.badge = { kind, text, title };
    refreshBadge(tool);
  }

  function setCollapsed(next) {
    collapsed = next;
    bar.classList.toggle('collapsed', collapsed);
    $('collapseBtn').setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Expand dashboard' : 'Collapse dashboard';
    $('collapseBtn').title = label;
    $('collapseBtn').setAttribute('aria-label', label);
    if (collapsed) closePanel();
    store.write(String(collapsed));
    syncSpace();
  }

  const PAGE_TOKENS = ['--viewportName', '--navstate', '--density', '--input'];

  function renderReadout() {
    const styles = getComputedStyle(document.body);
    const nodes = [];

    const size = document.createElement('span');
    size.className = 'size';
    size.textContent = `${window.innerWidth}×${window.innerHeight}`;
    nodes.push(size);

    PAGE_TOKENS.forEach((name) => {
      const separator = document.createElement('span');
      separator.className = 'sep';
      separator.textContent = '|';
      nodes.push(separator);

      const value = styles.getPropertyValue(name).trim().replace(/^["']|["']$/g, '');
      const chip = document.createElement('span');
      if (value) {
        chip.textContent = value;
      } else {
        chip.className = 'miss';
        chip.textContent = '?';
        chip.title = `${name} is not set on <body> by this page`;
      }
      nodes.push(chip);
    });

    readout.replaceChildren(...nodes);
  }

  document.addEventListener('focusin', () => {
    const active = document.activeElement;
    if (active && active.hasAttribute && active.hasAttribute(HOST_ATTR)) return;
    console.log('Focused:', active);
  });

  const A11Y_CONFIG = {
    iconPattern: /(^|[\s-])(icon|fa|fas|far|fab|material-icons|mdi)([\s-]|$)/,
  };

  function accessibleName(el) {
    const own = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (own) return own;
    const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
    if (aria) return aria;
    if (el.getAttribute('aria-labelledby')) return 'aria-labelledby';
    const named = q('img', el).some((img) => (img.getAttribute('alt') || '').trim() !== '');
    return named ? 'img alt' : '';
  }

  const A11Y_CHECKS = [
    {
      kind: 'Layout table',
      run: () => q('table')
        .filter((el) => !el.querySelector('th') && !el.querySelector('caption'))
        .map((el) => ({ label: 'table without th/caption', el })),
    },
    {
      kind: 'SVG without semantics',
      run: () => q('svg')
        .filter((el) => !el.querySelector('title, desc')
          && !el.hasAttribute('aria-hidden') && !el.hasAttribute('role'))
        .map((el) => ({ label: 'svg without aria-hidden/role/title', el })),
    },
    {
      kind: 'Image without alt',
      run: () => q('img')
        .filter((el) => !el.hasAttribute('alt'))
        .map((el) => ({ label: 'img without an alt attribute', el })),
    },
    {
      kind: 'Icon without semantics',
      run: () => q('i, span, div')
        .filter((el) => A11Y_CONFIG.iconPattern.test(el.className || '')
          || el.classList.contains('c-icon'))
        .filter((el) => !el.hasAttribute('aria-hidden') && !el.hasAttribute('role'))
        .map((el) => ({ label: 'icon without aria-hidden/role', el })),
    },
    {
      kind: 'Field without a label',
      run: () => q('input, textarea, select')
        .filter((el) => el.type !== 'hidden')
        .filter((el) => !(el.id && document.querySelector(`label[for="${cssEscape(el.id)}"]`))
          && !el.closest('label')
          && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')
          && !el.hasAttribute('title'))
        .map((el) => ({ label: 'field without label/aria-label', el })),
    },
    {
      kind: 'Control without a name',
      run: () => q('button, a[href], [role="button"]')
        .filter((el) => accessibleName(el) === '')
        .map((el) => ({ label: `${el.tagName.toLowerCase()} with no accessible name`, el })),
    },
    {
      kind: 'Empty heading',
      run: () => q('h1, h2, h3, h4, h5, h6')
        .filter((el) => (el.textContent || '').trim() === '')
        .map((el) => ({ label: 'empty heading', el })),
    },
    {
      kind: 'Missing landmark',
      run: () => (document.querySelector('main, [role="main"]')
        ? []
        : [{ label: 'the document has no <main>', el: null }]),
    },
    {
      kind: 'Positive tabindex',
      run: () => q('[tabindex]')
        .filter((el) => parseInt(el.getAttribute('tabindex'), 10) > 0)
        .map((el) => ({ label: `tabindex="${el.getAttribute('tabindex')}"`, el })),
    },
  ];

  let a11yFindings = [];
  let a11yMarked = false;
  let a11yControls = null;

  const a11yTool = {
    id: 'a11y',
    label: 'a11y inspector',
    title: 'a11y inspector',
    icon: ICONS.a11y,
    badge: null,
    controls: () => a11yControlNodes(),
    onOpen: (body) => renderA11y(body),
    onClose: () => setA11yMarks(false),
  };

  function setA11yMarks(on) {
    a11yMarked = on;
    setFlags(a11yFindings, on);
    if (a11yControls) a11yControls[1].setAttribute('aria-pressed', String(on));
  }

  function logA11y() {
    if (!a11yFindings.length) {
      console.log('a11y inspector: no findings.');
      return;
    }
    console.group(`a11y inspector: ${a11yFindings.length} finding(s)`);
    a11yFindings.forEach(({ kind, label, el }, i) => {
      const args = [`%c[${i + 1}] ${kind} — ${label}`, 'color: #f87171; font-weight: bold;'];
      if (el) args.push(el);
      console.log(...args);
    });
    console.groupEnd();
  }

  function a11yScan(log) {
    const wasMarked = a11yMarked;
    setA11yMarks(false);
    a11yFindings = A11Y_CHECKS.flatMap((check) =>
      check.run().map((finding) => ({ kind: check.kind, ...finding })));

    const count = a11yFindings.length;
    setBadge(
      a11yTool,
      count ? 'hit' : 'clean',
      count ? (count > 99 ? '99' : String(count)) : '',
      count ? `a11y inspector — ${count} finding(s)` : 'a11y inspector — nothing found'
    );

    if (log) logA11y();
    if (wasMarked) setA11yMarks(true);
    if (openTool === a11yTool) refreshPanel();
    return a11yFindings;
  }

  function a11yControlNodes() {
    if (a11yControls) return a11yControls;

    const badge = document.createElement('span');
    badge.className = 'badge';

    const mark = document.createElement('button');
    mark.type = 'button';
    mark.textContent = 'mark in page';
    mark.title = 'Outline every finding in the page';
    mark.setAttribute('aria-pressed', 'false');
    mark.addEventListener('click', () => setA11yMarks(!a11yMarked));

    const again = document.createElement('button');
    again.type = 'button';
    again.textContent = 'scan again';
    again.addEventListener('click', () => a11yScan(true));

    a11yControls = [badge, mark, again];
    return a11yControls;
  }

  function renderA11y(body) {
    const count = a11yFindings.length;
    const badge = a11yControlNodes()[0];
    badge.textContent = count ? `${count} finding(s)` : 'nothing found';
    badge.className = `badge ${count ? 'hit' : 'clean'}`;

    if (!count) {
      body.innerHTML = '<p class="clean-note">No findings — nothing this tool can see from '
        + 'the DOM. It says nothing about contrast, focus order or reading order; that '
        + 'still wants axe and a screen reader.</p>';
      return;
    }

    body.innerHTML = '<p class="hint">A click on a row scrolls that element into view and '
      + 'flashes it. <b>mark in page</b> outlines every finding at once — until then the '
      + 'page is untouched. The console carries the same list with live element '
      + 'references.</p>';

    const kinds = [...new Set(a11yFindings.map((finding) => finding.kind))];
    kinds.forEach((kind) => {
      const group = a11yFindings.filter((finding) => finding.kind === kind);
      const el = document.createElement('div');
      el.className = 'group';
      el.innerHTML = `
        <div class="group-head">
          <span class="kind">${escapeHtml(kind)}</span>
          <span class="count">${group.length}×</span>
        </div>`;

      group.forEach((finding) => {
        if (!finding.el) {
          const note = document.createElement('div');
          note.className = 'row';
          note.innerHTML = `<span class="doc">${escapeHtml(finding.label)}</span>`;
          el.appendChild(note);
          return;
        }
        const { tag, excerpt } = describe(finding.el);
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'row';
        row.innerHTML = `<span class="tag">${escapeHtml(tag)}</span>`
          + `<span class="excerpt">${escapeHtml(excerpt)}</span>`;
        row.addEventListener('click', () => flash(finding.el));
        el.appendChild(row);
      });

      body.appendChild(el);
    });
  }

  TOOLS.push(a11yTool);

  let overflowFindings = [];
  let overflowMarked = false;
  let overflowControls = null;

  const overflowTool = {
    id: 'overflow',
    label: 'horizontal overflow',
    title: 'horizontal overflow',
    icon: ICONS.overflow,
    badge: null,
    controls: () => overflowControlNodes(),
    onOpen: (body) => renderOverflow(body),
    onClose: () => setOverflowMarks(false),
  };

  function setOverflowMarks(on) {
    overflowMarked = on;
    setFlags(overflowFindings, on);
    if (overflowControls) overflowControls[1].setAttribute('aria-pressed', String(on));
  }

  function logOverflow() {
    if (!overflowFindings.length) {
      console.log('✅ Element widths ok');
      return;
    }
    console.group(`horizontal overflow: ${overflowFindings.length} element(s)`);
    overflowFindings.forEach(({ el, excess }) => {
      console.log(`Element ${excess}px too wide:`, el);
    });
    console.groupEnd();
  }

  function overflowScan(log) {
    const wasMarked = overflowMarked;
    setOverflowMarks(false);

    const limit = document.documentElement.offsetWidth;
    overflowFindings = q('*')
      .filter((el) => !el.hasAttribute(HOST_ATTR) && !el.hasAttribute(SPACER_ATTR))
      .filter((el) => el.offsetWidth > limit)
      .map((el) => ({ el, excess: el.offsetWidth - limit }))
      .sort((a, b) => b.excess - a.excess)
      .map((finding) => ({ ...finding, label: `${finding.excess}px too wide` }));

    const count = overflowFindings.length;
    setBadge(
      overflowTool,
      count ? 'hit' : 'clean',
      count ? (count > 99 ? '99' : String(count)) : '',
      count
        ? `horizontal overflow — ${count} element(s) wider than ${limit}px`
        : 'horizontal overflow — nothing sticks out'
    );

    if (log) logOverflow();
    if (wasMarked) setOverflowMarks(true);
    if (openTool === overflowTool) refreshPanel();
    return overflowFindings;
  }

  function overflowControlNodes() {
    if (overflowControls) return overflowControls;

    const badge = document.createElement('span');
    badge.className = 'badge';

    const mark = document.createElement('button');
    mark.type = 'button';
    mark.textContent = 'mark in page';
    mark.title = 'Outline every element that sticks out';
    mark.setAttribute('aria-pressed', 'false');
    mark.addEventListener('click', () => setOverflowMarks(!overflowMarked));

    const again = document.createElement('button');
    again.type = 'button';
    again.textContent = 'scan again';
    again.addEventListener('click', () => overflowScan(true));

    overflowControls = [badge, mark, again];
    return overflowControls;
  }

  function renderOverflow(body) {
    const count = overflowFindings.length;
    const badge = overflowControlNodes()[0];
    badge.textContent = count ? `${count} element(s)` : 'nothing sticks out';
    badge.className = `badge ${count ? 'hit' : 'clean'}`;

    if (!count) {
      body.innerHTML = '<p class="clean-note">Nothing is wider than the document — no '
        + 'element is pushing a horizontal scrollbar at this viewport width.</p>';
      return;
    }

    body.innerHTML = '<p class="hint">Every element wider than '
      + `<b>${document.documentElement.offsetWidth}px</b>, widest first. An ancestor `
      + 'usually appears alongside the child that stretches it — the innermost row is '
      + 'the one to look at. The list is measured again whenever the window is '
      + 'resized.</p>';

    const group = document.createElement('div');
    group.className = 'group';
    overflowFindings.forEach(({ el, excess }) => {
      const { tag, excerpt } = describe(el);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'row';
      row.innerHTML = `<span class="num">+${excess}px</span>`
        + `<span class="tag">${escapeHtml(tag)}</span>`
        + `<span class="excerpt">${escapeHtml(excerpt)}</span>`;
      row.addEventListener('click', () => flash(el));
      group.appendChild(row);
    });
    body.appendChild(group);
  }

  TOOLS.push(overflowTool);

  const QR_TOTAL_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
    404, 466, 532, 581, 655, 733, 815, 901, 991];
  const QR_EC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26,
    30, 22, 22, 24, 24, 28, 28, 26, 26];
  const QR_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5,
    5, 8, 9, 9, 10, 10, 11, 13, 14];
  const QR_ALIGN = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
    [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
    [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
    [6, 30, 56, 82], [6, 30, 58, 86],
  ];

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];

  const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

  function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLength) {
    const generator = rsGenerator(ecLength);
    const buffer = new Uint8Array(data.length + ecLength);
    buffer.set(data);
    for (let i = 0; i < data.length; i++) {
      const factor = buffer[i];
      if (factor === 0) continue;
      for (let j = 1; j < generator.length; j++) {
        buffer[i + j] ^= gfMul(generator[j], factor);
      }
    }
    return buffer.slice(data.length);
  }

  const qrDataCodewords = (version) =>
    QR_TOTAL_CODEWORDS[version - 1] - QR_EC_PER_BLOCK[version - 1] * QR_BLOCKS[version - 1];

  function qrCodewords(text) {
    const bytes = new TextEncoder().encode(text);

    let version = 0;
    for (let v = 1; v <= QR_TOTAL_CODEWORDS.length; v++) {
      const capacity = qrDataCodewords(v) * 8 - 4 - (v < 10 ? 8 : 16);
      if (capacity >= bytes.length * 8) {
        version = v;
        break;
      }
    }
    if (!version) return null;

    const bits = [];
    const push = (value, length) => {
      for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    };

    push(4, 4);
    push(bytes.length, version < 10 ? 8 : 16);
    bytes.forEach((byte) => push(byte, 8));

    const dataCount = qrDataCodewords(version);
    push(0, Math.min(4, dataCount * 8 - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      codewords.push(byte);
    }
    for (let i = 0; codewords.length < dataCount; i++) codewords.push(i % 2 === 0 ? 0xec : 0x11);

    const ecLength = QR_EC_PER_BLOCK[version - 1];
    const blockCount = QR_BLOCKS[version - 1];
    const shortLength = Math.floor(dataCount / blockCount);
    const longBlocks = dataCount % blockCount;

    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;
    for (let i = 0; i < blockCount; i++) {
      const length = shortLength + (i >= blockCount - longBlocks ? 1 : 0);
      const block = Uint8Array.from(codewords.slice(offset, offset + length));
      offset += length;
      dataBlocks.push(block);
      ecBlocks.push(rsEncode(block, ecLength));
    }

    const result = [];
    for (let i = 0; i < shortLength + (longBlocks ? 1 : 0); i++) {
      dataBlocks.forEach((block) => {
        if (i < block.length) result.push(block[i]);
      });
    }
    for (let i = 0; i < ecLength; i++) {
      ecBlocks.forEach((block) => result.push(block[i]));
    }

    return { version, codewords: result };
  }

  const QR_MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  function qrFormatBits(mask) {
    const data = mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  }

  function qrVersionBits(version) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return (version << 12) | rem;
  }

  function qrCountRuns(line) {
    const text = line.join('');
    let score = 0;
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) {
        run += 1;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
    ['10111010000', '00001011101'].forEach((pattern) => {
      let at = text.indexOf(pattern);
      while (at !== -1) {
        score += 40;
        at = text.indexOf(pattern, at + 1);
      }
    });
    return score;
  }

  function qrPenalty(grid) {
    const size = grid.length;
    let score = 0;
    let dark = 0;

    for (let r = 0; r < size; r++) score += qrCountRuns(grid[r]);
    for (let c = 0; c < size; c++) score += qrCountRuns(grid.map((row) => row[c]));

    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const value = grid[r][c];
        if (value === grid[r][c + 1] && value === grid[r + 1][c] && value === grid[r + 1][c + 1]) {
          score += 3;
        }
      }
    }

    grid.forEach((row) => row.forEach((value) => { dark += value; }));
    const percent = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;

    return score;
  }

  function qrGrid(text) {
    const encoded = qrCodewords(text);
    if (!encoded) return null;

    const { version, codewords } = encoded;
    const size = version * 4 + 17;
    const modules = [];
    const reserved = [];
    for (let r = 0; r < size; r++) {
      modules.push(new Array(size).fill(0));
      reserved.push(new Array(size).fill(false));
    }

    const setFunction = (row, col, dark) => {
      if (row < 0 || col < 0 || row >= size || col >= size) return;
      modules[row][col] = dark ? 1 : 0;
      reserved[row][col] = true;
    };

    const placeFinder = (row, col) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6
            && (r === 0 || r === 6 || c === 0 || c === 6
              || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          setFunction(row + r, col + c, inner);
        }
      }
    };

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    for (let i = 8; i < size - 8; i++) {
      setFunction(6, i, i % 2 === 0);
      setFunction(i, 6, i % 2 === 0);
    }

    const centers = QR_ALIGN[version - 1];
    centers.forEach((row) => centers.forEach((col) => {
      if ((row <= 8 && col <= 8)
        || (row <= 8 && col >= size - 9)
        || (row >= size - 9 && col <= 8)) return;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          setFunction(row + dr, col + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }));

    for (let i = 0; i < 9; i++) {
      if (i === 6) continue;
      setFunction(8, i, false);
      setFunction(i, 8, false);
    }
    for (let i = 0; i < 8; i++) {
      setFunction(8, size - 1 - i, false);
      setFunction(size - 1 - i, 8, false);
    }

    if (version >= 7) {
      const bits = qrVersionBits(version);
      for (let i = 0; i < 18; i++) {
        const bit = (bits >>> i) & 1;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunction(b, a, bit);
        setFunction(a, b, bit);
      }
    }

    const bitStream = [];
    codewords.forEach((byte) => {
      for (let i = 7; i >= 0; i--) bitStream.push((byte >>> i) & 1);
    });

    let index = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1;
      for (let i = 0; i < size; i++) {
        const row = upward ? size - 1 - i : i;
        for (let k = 0; k < 2; k++) {
          const target = col - k;
          if (reserved[row][target]) continue;
          modules[row][target] = index < bitStream.length ? bitStream[index] : 0;
          index += 1;
        }
      }
      upward = !upward;
    }

    let best = null;
    for (let mask = 0; mask < 8; mask++) {
      const candidate = modules.map((row, r) => row.map((value, c) =>
        (reserved[r][c] ? value : value ^ (QR_MASKS[mask](r, c) ? 1 : 0))));

      const bits = qrFormatBits(mask);
      const bit = (i) => (bits >>> i) & 1;
      const place = (row, col, value) => { candidate[row][col] = value; };

      for (let i = 0; i <= 5; i++) place(i, 8, bit(i));
      place(7, 8, bit(6));
      place(8, 8, bit(7));
      place(8, 7, bit(8));
      for (let i = 9; i < 15; i++) place(8, 14 - i, bit(i));
      for (let i = 0; i < 8; i++) place(8, size - 1 - i, bit(i));
      for (let i = 8; i < 15; i++) place(size - 15 + i, 8, bit(i));
      place(size - 8, 8, 1);

      const score = qrPenalty(candidate);
      if (!best || score < best.score) best = { score, grid: candidate };
    }

    return { grid: best.grid, reserved, version, size };
  }

  let qrControls = null;

  const qrTool = {
    id: 'qr',
    label: 'QR code',
    title: 'QR code for this URL',
    icon: ICONS.qr,
    badge: null,
    controls: () => qrControlNodes(),
    onOpen: (body) => renderQr(body),
  };

  function qrControlNodes() {
    if (qrControls) return qrControls;
    const copy = copyButton(location.href, 'copy URL');
    copy.className = '';
    qrControls = [copy];
    return qrControls;
  }

  function renderQr(body) {
    const url = location.href;
    const result = qrGrid(url);

    if (!result) {
      body.innerHTML = '<div class="error"><p><b>URL too long.</b> This encoder covers '
        + 'QR versions 1–19 at error correction level M, which ends at 624 characters.</p></div>';
      return;
    }

    const quiet = 4;
    const scale = Math.max(2, Math.floor(260 / (result.size + quiet * 2)));
    const dimension = (result.size + quiet * 2) * scale;

    const canvas = document.createElement('canvas');
    canvas.width = dimension;
    canvas.height = dimension;
    canvas.style.cssText = `display: block; inline-size: ${dimension}px; block-size: ${dimension}px;`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `QR code for ${url}`);

    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, dimension, dimension);
    context.fillStyle = '#000000';
    result.grid.forEach((row, r) => row.forEach((value, c) => {
      if (value) context.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    }));

    const box = document.createElement('div');
    box.className = 'result';

    const head = document.createElement('div');
    head.className = 'result-head';
    head.innerHTML = `<span class="name">${escapeHtml(url)}</span>`
      + `<span class="meta">version ${result.version} · level M</span>`;

    const inner = document.createElement('div');
    inner.className = 'result-body';
    inner.appendChild(canvas);

    box.append(head, inner);
    body.appendChild(box);

    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.innerHTML = local
      ? 'The code is generated in the page — nothing is sent anywhere. '
        + `<b>${escapeHtml(location.hostname)}</b> means this machine, though: a phone `
        + 'scanning it lands on its own localhost. Serve the page on the LAN address of '
        + 'this machine to open it on a device.'
      : 'The code is generated in the page — nothing is sent anywhere.';
    body.appendChild(hint);
  }

  TOOLS.push(qrTool);

  const SRCSET_CONFIG = {
    markedSelector: '[data-dev-srcset]',
    mediaSelector: 'img, video, canvas, svg',
    targetDPRs: [1, 2, 3],
    minViewport: 320,
    maxViewport: 1920,
    coarseStep: 40,
    refineMinGap: 4,
    refineMinDelta: 3,
    refineRatio: 0.02,
    maxSamples: 240,
    stepSettle: 40,
    frameHeight: 0,
    stableScrollbar: true,
    loadTimeout: 15000,
    maxSrcsetEntries: 6,
    minWidthRatio: 1.5,
    maxImageWidth: 3840,
    maxSizesRules: 4,
    sizesTolerance: 0.12,
    sizesMinTolerance: 24,
    vwTolerance: 3,
    roundSteps: [
      { upTo: 400, step: 20 },
      { upTo: 1000, step: 50 },
      { upTo: Infinity, step: 100 },
    ],
    filenamePattern: 'image-{w}.jpg',
  };

  const picks = [];
  const measurements = new Map();
  const sampled = new Set();
  const srcsetRange = { from: SRCSET_CONFIG.minViewport, to: SRCSET_CONFIG.maxViewport };

  let picking = false;
  let marksOn = false;
  let hovered = null;
  let pinFrame = 0;
  let missing = [];
  let sweeping = false;
  let aborted = false;
  let srcsetHasResults = false;
  let srcsetError = null;
  let unitMode = 'px';
  let lastRun = null;
  let probeFrame = null;
  let probeDoc = null;
  let srcsetControls = null;
  let pickButton = null;
  let clearButton = null;
  let measureButton = null;
  let srcsetBadge = null;

  const pins = $('pins');
  const picker = $('picker');
  const pickCount = $('pickCount');
  const overlay = $('overlay');
  const stage = $('stage');
  const track = $('track');
  const trackFill = $('trackFill');
  const progressText = $('progressText');

  const fmtVw = (value) => `${Math.round(value * 10) / 10}vw`;

  function roundUpNice(width) {
    const rule = SRCSET_CONFIG.roundSteps.find((step) => width < step.upTo)
      || SRCSET_CONFIG.roundSteps[SRCSET_CONFIG.roundSteps.length - 1];
    return Math.ceil(width / rule.step) * rule.step;
  }

  function structuralPath(el, useIds) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      if (useIds && node.id
        && document.querySelectorAll(`#${cssEscape(node.id)}`).length === 1) {
        parts.unshift(`#${cssEscape(node.id)}`);
        return parts.join(' > ');
      }
      const parent = node.parentElement;
      const tag = node.tagName.toLowerCase();
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const twins = Array.from(parent.children)
        .filter((child) => child.tagName === node.tagName);
      parts.unshift(twins.length > 1
        ? `${tag}:nth-of-type(${twins.indexOf(node) + 1})`
        : tag);
      node = parent;
    }
    return parts.join(' > ');
  }

  function pathsFor(el) {
    const anchored = structuralPath(el, true);
    const plain = structuralPath(el, false);
    return anchored === plain ? [plain] : [anchored, plain];
  }

  function labelFor(el) {
    const marked = (el.getAttribute('data-dev-srcset') || '').trim();
    if (marked) return marked;
    const file = (el.currentSrc || el.getAttribute('src') || '')
      .split(/[?#]/)[0].split('/').pop();
    if (file && file.includes('.')) return decodeURIComponent(file);
    const alt = (el.getAttribute('alt') || '').trim();
    if (alt) return alt.length > EXCERPT ? `${alt.slice(0, EXCERPT)}…` : alt;
    if (file) return decodeURIComponent(file);
    return describe(el).tag;
  }

  function pickTarget(node) {
    if (!node || node.nodeType !== 1) return null;
    if (node === document.documentElement || node === document.body) return null;
    if (node.closest(`[${HOST_ATTR}], [${SPACER_ATTR}]`)) return null;
    const media = node.closest(SRCSET_CONFIG.mediaSelector);
    if (media) return media;
    const inside = q(SRCSET_CONFIG.mediaSelector, node);
    return inside.length === 1 ? inside[0] : node;
  }

  function makePick(el) {
    return { el, paths: pathsFor(el), label: labelFor(el), probeEl: null };
  }

  function pinsWanted() {
    return marksOn && picks.length > 0;
  }

  function syncPins() {
    pinFrame = 0;
    pins.hidden = !pinsWanted();
    if (pins.hidden) return;
    while (pins.children.length > picks.length) pins.lastElementChild.remove();
    while (pins.children.length < picks.length) {
      const pin = document.createElement('span');
      pin.className = 'pin';
      pins.appendChild(pin);
    }
    picks.forEach((pick, i) => {
      const pin = pins.children[i];
      const box = pick.el.getBoundingClientRect();
      pin.hidden = !pick.el.isConnected
        || (box.width === 0 && box.height === 0)
        || box.bottom < 0 || box.top > window.innerHeight
        || box.right < 0 || box.left > window.innerWidth;
      if (pin.hidden) return;
      pin.textContent = String(i + 1);
      const x = Math.min(Math.max(0, Math.round(box.left)), window.innerWidth - 30);
      const y = Math.max(0, Math.round(box.top) - 17);
      pin.style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  function queuePins() {
    if (pinFrame || !pinsWanted()) return;
    pinFrame = requestAnimationFrame(syncPins);
  }

  function setPickMarks(on) {
    marksOn = on;
    q(`[${PICK_ATTR}]`).forEach((el) => el.removeAttribute(PICK_ATTR));
    if (on) {
      picks.forEach((pick, i) => {
        if (pick.el.isConnected) pick.el.setAttribute(PICK_ATTR, String(i + 1));
      });
    }
    syncPins();
  }

  function syncPicks() {
    setPickMarks(marksOn);
    pickCount.textContent = picks.length === 1 ? '1 selected' : `${picks.length} selected`;
    $('pickClear').disabled = picks.length === 0;
    if (clearButton) clearButton.disabled = picks.length === 0;
    if (measureButton) measureButton.disabled = picks.length === 0;
    if (pickButton) pickButton.setAttribute('aria-pressed', String(picking));
    if (openTool === srcsetTool) refreshPanel();
  }

  function togglePick(el) {
    const at = picks.findIndex((pick) => pick.el === el);
    if (at > -1) {
      measurements.delete(picks[at]);
      picks.splice(at, 1);
      srcsetHasResults = measurements.size > 0;
    } else {
      picks.push(makePick(el));
    }
    syncPicks();
  }

  function clearPicks() {
    picks.length = 0;
    measurements.clear();
    srcsetHasResults = false;
    syncPicks();
  }

  function adoptMarked() {
    q(SRCSET_CONFIG.markedSelector)
      .filter((el) => !picks.some((pick) => pick.el === el))
      .forEach((el) => picks.push(makePick(el)));
    if (picks.length) syncPicks();
  }

  function onPickOver(event) {
    const target = pickTarget(event.target);
    if (target === hovered) return;
    hovered?.removeAttribute(HOVER_ATTR);
    hovered = target;
    hovered?.setAttribute(HOVER_ATTR, '');
  }

  function onPickDown(event) {
    if (!pickTarget(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onPickClick(event) {
    const target = pickTarget(event.target);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    togglePick(target);
  }

  function setPicking(on) {
    if (picking === on) return;
    picking = on;
    const method = on ? 'addEventListener' : 'removeEventListener';
    document[method]('pointerover', onPickOver, true);
    document[method]('mousedown', onPickDown, true);
    document[method]('click', onPickClick, true);
    if (on) {
      document.documentElement.setAttribute(PICKING_ATTR, '');
      marksOn = true;
    } else {
      document.documentElement.removeAttribute(PICKING_ATTR);
      hovered?.removeAttribute(HOVER_ATTR);
      hovered = null;
    }
    picker.hidden = !on;
    syncPicks();
  }

  function startPicking() {
    setCollapsed(false);
    closePanel();
    setPicking(true);
  }

  function stopPicking() {
    setPicking(false);
    showTool(srcsetTool);
  }

  function resolveInProbe(pick) {
    if (pick.probeEl && pick.probeEl.isConnected) return pick.probeEl;
    pick.probeEl = null;
    if (!probeDoc) return null;
    for (const path of pick.paths) {
      let found = null;
      try { found = probeDoc.querySelector(path); } catch (err) { found = null; }
      if (found && found.tagName === pick.el.tagName) {
        pick.probeEl = found;
        break;
      }
    }
    return pick.probeEl;
  }

  function collectSample(viewport) {
    const dpr = window.devicePixelRatio || 1;
    picks.forEach((pick) => {
      const el = resolveInProbe(pick);
      if (!el) return;
      const renderW = Math.round(el.getBoundingClientRect().width);
      if (renderW <= 0) return;
      if (!measurements.has(pick)) {
        measurements.set(pick, { key: pick.label, samples: [], byVw: new Map() });
      }
      const entry = measurements.get(pick);
      const existing = entry.byVw.get(viewport);
      if (existing) {
        existing.renderW = Math.max(existing.renderW, renderW);
        existing.dpr = dpr;
      } else {
        const sample = { vw: viewport, dpr, renderW };
        entry.samples.push(sample);
        entry.byVw.set(viewport, sample);
      }
    });
    sampled.add(viewport);
  }

  function changesBetween(a, b) {
    for (const entry of measurements.values()) {
      const sa = entry.byVw.get(a);
      const sb = entry.byVw.get(b);
      if (!sa || !sb) continue;
      const delta = Math.abs(sa.renderW - sb.renderW);
      const scale = Math.max(sa.renderW, sb.renderW, 1);
      if (delta > Math.max(SRCSET_CONFIG.refineMinDelta, scale * SRCSET_CONFIG.refineRatio)) {
        return true;
      }
    }
    return false;
  }

  function srcsetLadder(samples) {
    const renderWs = samples.map((sample) => sample.renderW);
    const minDpr = Math.min(...SRCSET_CONFIG.targetDPRs);
    const maxDpr = Math.max(...SRCSET_CONFIG.targetDPRs);
    const needed = Math.max(...renderWs) * maxDpr;

    const lo = roundUpNice(Math.min(...renderWs) * minDpr);
    const hi = Math.max(
      needed > SRCSET_CONFIG.maxImageWidth ? SRCSET_CONFIG.maxImageWidth : roundUpNice(needed),
      lo
    );

    const span = hi / lo;
    const steps = Math.min(
      SRCSET_CONFIG.maxSrcsetEntries,
      Math.max(1, Math.round(Math.log(span) / Math.log(SRCSET_CONFIG.minWidthRatio)) + 1)
    );
    const ratio = steps > 1 ? Math.pow(span, 1 / (steps - 1)) : 1;

    const widths = [];
    for (let i = 0; i < steps; i++) {
      const width = i === steps - 1 ? hi : roundUpNice(lo * Math.pow(ratio, i));
      if (!widths.includes(width)) widths.push(width);
    }
    return { widths, capped: needed > SRCSET_CONFIG.maxImageWidth, needed: Math.round(needed) };
  }

  function segmentSamples(samplesAsc, metricFn, isSame) {
    if (samplesAsc.length === 0) return [];
    const segments = [];
    let segment = {
      minVw: samplesAsc[0].vw,
      maxVw: samplesAsc[0].vw,
      metric: metricFn(samplesAsc[0]),
      samples: [samplesAsc[0]],
    };
    for (let i = 1; i < samplesAsc.length; i++) {
      const sample = samplesAsc[i];
      const metric = metricFn(sample);
      if (isSame(metric, segment.metric)) {
        segment.maxVw = sample.vw;
        segment.samples.push(sample);
        segment.metric = Math.max(segment.metric, metric);
      } else {
        segments.push(segment);
        segment = { minVw: sample.vw, maxVw: sample.vw, metric, samples: [sample] };
      }
    }
    segments.push(segment);
    return segments;
  }

  function mergeSegments(segments, max) {
    const list = segments.slice();
    while (list.length > max) {
      let at = 0;
      let best = Infinity;
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i].metric;
        const b = list[i + 1].metric;
        const distance = Math.abs(b - a) / Math.max(a, b, 1);
        if (distance < best) {
          best = distance;
          at = i;
        }
      }
      const a = list[at];
      const b = list[at + 1];
      list.splice(at, 2, {
        minVw: a.minVw,
        maxVw: b.maxVw,
        metric: Math.max(a.metric, b.metric),
        samples: a.samples.concat(b.samples),
      });
    }
    return list;
  }

  function rulesFromSegments(segments, formatValue) {
    const rules = [];
    segments.forEach((segment, i) => {
      const value = formatValue(segment);
      const isLast = i === segments.length - 1;
      const previous = rules[rules.length - 1];
      if (previous && previous.value === value) {
        previous.maxVw = isLast ? null : segment.maxVw;
        return;
      }
      rules.push({ value, maxVw: isLast ? null : segment.maxVw });
    });
    return rules.map((rule) =>
      (rule.maxVw === null ? rule.value : `(max-width: ${rule.maxVw}px) ${rule.value}`));
  }

  function analyze(entry) {
    const samples = entry.samples.slice().sort((a, b) => a.vw - b.vw);

    const pxSegments = mergeSegments(
      segmentSamples(samples, (sample) => sample.renderW, (metric, reference) =>
        Math.abs(metric - reference)
          <= Math.max(reference * SRCSET_CONFIG.sizesTolerance, SRCSET_CONFIG.sizesMinTolerance)),
      SRCSET_CONFIG.maxSizesRules
    );
    const vwSegments = mergeSegments(
      segmentSamples(samples, (sample) => (sample.renderW / sample.vw) * 100, (metric, reference) =>
        Math.abs(metric - reference) <= SRCSET_CONFIG.vwTolerance),
      SRCSET_CONFIG.maxSizesRules
    );

    const sizesPx = rulesFromSegments(pxSegments, (segment) => `${Math.round(segment.metric)}px`);
    const sizesVw = rulesFromSegments(vwSegments, (segment) => fmtVw(segment.metric));
    const { widths: srcsetWidths, capped, needed } = srcsetLadder(samples);

    const renderWs = samples.map((sample) => sample.renderW);
    const preferVw = vwSegments.length === 1
      && Math.max(...renderWs) / Math.max(Math.min(...renderWs), 1) > 1.2;

    return {
      key: entry.key, samples, pxSegments, sizesPx, sizesVw,
      srcsetWidths, capped, needed, preferVw,
    };
  }

  function buildMarkup(result, sizesAttr) {
    const srcsetAttr = result.srcsetWidths
      .map((width) => `${SRCSET_CONFIG.filenamePattern.replace('{w}', width)} ${width}w`)
      .join(',\n        ');
    const mid = result.srcsetWidths[Math.floor(result.srcsetWidths.length / 2)]
      || result.srcsetWidths[0];
    return `<img\n  src="${SRCSET_CONFIG.filenamePattern.replace('{w}', mid)}"\n`
      + `  srcset="\n        ${srcsetAttr}"\n`
      + `  sizes="${sizesAttr}"\n  alt="">`;
  }

  function setProgress(text, ratio) {
    progressText.innerHTML = text;
    if (ratio === null) {
      track.classList.add('indeterminate');
    } else {
      track.classList.remove('indeterminate');
      trackFill.style.inlineSize = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
    }
  }

  function frameHeight() {
    return SRCSET_CONFIG.frameHeight || Math.max(600, window.innerHeight);
  }

  function createProbe(startWidth) {
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.name = PROBE_NAME;
      frame.className = 'probe';
      frame.title = 'srcset probe frame';
      frame.setAttribute('aria-hidden', 'true');
      frame.style.inlineSize = `${startWidth}px`;
      frame.style.blockSize = `${frameHeight()}px`;

      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('timeout'));
      }, SRCSET_CONFIG.loadTimeout);

      frame.addEventListener('load', () => {
        if (settled) return;
        try {
          if (!frame.contentDocument || !frame.contentWindow) throw new Error('blocked');
          if (frame.contentWindow.location.href === 'about:blank') return;
          settled = true;
          clearTimeout(timer);
          probeDoc = frame.contentDocument;
          resolve(frame);
        } catch (err) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });

      frame.src = location.href;
      stage.appendChild(frame);
      probeFrame = frame;
    });
  }

  function destroyProbe() {
    probeFrame?.remove();
    probeFrame = null;
    probeDoc = null;
  }

  function layoutStage(width) {
    const availableW = stage.clientWidth;
    const availableH = stage.clientHeight;
    const height = frameHeight();
    const scale = Math.min(availableW / width, availableH / height, 1);
    probeFrame.style.inlineSize = `${width}px`;
    probeFrame.style.blockSize = `${height}px`;
    probeFrame.style.transform = `translate(${(availableW - width * scale) / 2}px, `
      + `${(availableH - height * scale) / 2}px) scale(${scale})`;
  }

  async function settle() {
    await nextFrame();
    await nextFrame();
    await wait(SRCSET_CONFIG.stepSettle);
  }

  async function measureAt(width) {
    layoutStage(width);
    await settle();
    if (aborted) return;
    collectSample(width);
  }

  function coarseWidths(from, to) {
    const widths = [];
    for (let width = from; width < to; width += SRCSET_CONFIG.coarseStep) widths.push(width);
    widths.push(to);
    return widths;
  }

  async function runSweep(from, to) {
    const coarse = coarseWidths(from, to);

    for (let i = 0; i < coarse.length; i++) {
      if (aborted) return;
      setProgress(
        `Pass 1 of 2 · <b>${coarse[i]}px</b> · ${i + 1}/${coarse.length}`,
        (i + 1) / coarse.length
      );
      await measureAt(coarse[i]);
    }

    let guard = 0;
    while (!aborted && sampled.size < SRCSET_CONFIG.maxSamples && guard++ < 30) {
      const widths = Array.from(sampled).sort((a, b) => a - b);
      const targets = [];
      for (let i = 0; i < widths.length - 1; i++) {
        const a = widths[i];
        const b = widths[i + 1];
        if (b - a <= SRCSET_CONFIG.refineMinGap) continue;
        if (!changesBetween(a, b)) continue;
        targets.push(Math.round((a + b) / 2));
      }
      if (targets.length === 0) break;

      for (let i = 0; i < targets.length; i++) {
        if (aborted || sampled.size >= SRCSET_CONFIG.maxSamples) break;
        setProgress(
          `Pass 2 of 2 · pinning breakpoints · <b>${targets[i]}px</b> · ${sampled.size} samples`,
          null
        );
        await measureAt(targets[i]);
      }
    }
  }

  function currentRange() {
    const a = Math.max(120, Math.round(Number(srcsetRange.from) || SRCSET_CONFIG.minViewport));
    const b = Math.max(120, Math.round(Number(srcsetRange.to) || SRCSET_CONFIG.maxViewport));
    return { from: Math.min(a, b), to: Math.max(a, b) };
  }

  async function startSweep() {
    if (sweeping) return;
    if (!picks.length) {
      startPicking();
      return;
    }
    sweeping = true;
    aborted = false;
    srcsetHasResults = false;
    srcsetError = null;
    measurements.clear();
    sampled.clear();
    picks.forEach((pick) => { pick.probeEl = null; });
    missing = [];

    setPicking(false);
    setPickMarks(false);
    closePanel();
    overlay.hidden = false;
    setBadge(srcsetTool, 'busy', '', 'srcset — measuring');
    setProgress('Loading the probe frame …', null);

    const { from, to } = currentRange();
    lastRun = null;
    try {
      await createProbe(from);
      if (aborted) throw new Error('aborted');

      if (SRCSET_CONFIG.stableScrollbar) {
        const probeStyle = probeDoc.createElement('style');
        probeStyle.textContent = 'html { overflow-y: scroll !important; }';
        probeDoc.head.appendChild(probeStyle);
      }
      if (probeDoc.fonts) await probeDoc.fonts.ready.catch(() => null);

      layoutStage(from);
      await settle();
      missing = picks.filter((pick) => !resolveInProbe(pick));
      await runSweep(from, to);
    } catch (err) {
      finishSweep(err, to);
      return;
    }
    finishSweep(null, to);
  }

  function finishSweep(error, planned) {
    const widths = Array.from(sampled).sort((a, b) => a - b);
    if (widths.length) {
      lastRun = {
        from: widths[0],
        to: widths[widths.length - 1],
        planned,
        samples: widths.length,
        gap: SRCSET_CONFIG.refineMinGap,
        aborted,
      };
    }

    destroyProbe();
    sweeping = false;
    overlay.hidden = true;
    setBadge(srcsetTool, null, '', srcsetTool.title);

    if (error && !aborted) {
      srcsetError = error;
      srcsetHasResults = false;
    } else {
      srcsetError = null;
      srcsetHasResults = measurements.size > 0;
    }

    if (aborted && measurements.size === 0 && !error) closePanel();
    else showTool(srcsetTool);
  }

  function abortSweep() {
    if (!sweeping) return;
    aborted = true;
  }

  function srcsetControlNodes() {
    if (srcsetControls) return srcsetControls;

    const badge = document.createElement('span');
    badge.className = 'badge';
    srcsetBadge = badge;

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.textContent = 'pick images';
    pick.title = 'Click images in the page to select them for the measurement';
    pick.setAttribute('aria-pressed', 'false');
    pick.addEventListener('click', () => (picking ? stopPicking() : startPicking()));
    pickButton = pick;

    const drop = document.createElement('button');
    drop.type = 'button';
    drop.textContent = 'clear';
    drop.title = 'Drop the whole selection';
    drop.disabled = picks.length === 0;
    drop.addEventListener('click', clearPicks);
    clearButton = drop;

    const label = document.createElement('span');
    label.className = 'hint';
    label.style.margin = '0';
    label.textContent = 'sizes:';

    const toggle = document.createElement('span');
    toggle.className = 'unit-toggle';
    ['px', 'vw'].forEach((mode) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = mode;
      button.className = mode === unitMode ? 'active' : '';
      button.addEventListener('click', () => {
        unitMode = mode;
        toggle.querySelectorAll('button').forEach((other) => {
          other.classList.toggle('active', other.textContent === unitMode);
        });
        if (srcsetHasResults) refreshPanel();
      });
      toggle.appendChild(button);
    });

    const measure = document.createElement('button');
    measure.type = 'button';
    measure.className = 'primary';
    measure.textContent = 'measure';
    measure.disabled = picks.length === 0;
    measure.addEventListener('click', startSweep);
    measureButton = measure;

    srcsetControls = [badge, pick, drop, label, toggle, measure];
    return srcsetControls;
  }

  function renderSelection(body) {
    const block = document.createElement('div');
    block.className = 'group';
    block.innerHTML = `
      <div class="group-head">
        <span class="kind">Selection</span>
        <span class="count">${picks.length}×</span>
      </div>`;

    if (!picks.length) {
      const note = document.createElement('div');
      note.className = 'row';
      note.innerHTML = '<span class="doc">Nothing selected. Press <b>pick images</b> and '
        + 'click the images in the page — one per distinct layout behaviour.</span>';
      block.appendChild(note);
      body.appendChild(block);
      return;
    }

    picks.forEach((pick, i) => {
      const row = document.createElement('div');
      row.className = 'row pick';

      const show = document.createElement('button');
      show.type = 'button';
      show.className = 'grow';
      show.title = pick.paths[0];
      show.innerHTML = `<span class="idx">${i + 1}</span>`
        + `<span class="tag">${escapeHtml(describe(pick.el).tag)}</span>`
        + `<span class="excerpt">${escapeHtml(pick.label)}</span>`;
      show.addEventListener('click', () => flash(pick.el));

      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'ghost';
      drop.title = 'Drop this image from the selection';
      drop.setAttribute('aria-label', `Drop image ${i + 1} from the selection`);
      drop.innerHTML = ICONS.close;
      drop.addEventListener('click', () => togglePick(pick.el));

      row.append(show, drop);
      block.appendChild(row);
    });

    body.appendChild(block);
  }

  function renderSrcset(body) {
    srcsetControlNodes();
    srcsetBadge.textContent = lastRun
      ? `${lastRun.from}–${lastRun.to}px · ${lastRun.samples} samples${lastRun.aborted ? ' · aborted' : ''}`
      : 'not measured yet';
    srcsetBadge.className = 'badge';
    measureButton.textContent = srcsetHasResults ? 'measure again' : 'measure';
    measureButton.disabled = picks.length === 0;
    clearButton.disabled = picks.length === 0;
    pickButton.setAttribute('aria-pressed', String(picking));
    setPickMarks(true);

    renderSelection(body);

    const range = document.createElement('div');
    range.className = 'range';
    range.innerHTML = '<span>sweep range</span>';
    ['from', 'to'].forEach((key) => {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '200';
      input.max = '4000';
      input.step = '10';
      input.value = String(srcsetRange[key]);
      input.setAttribute('aria-label', `sweep ${key}`);
      input.addEventListener('change', () => { srcsetRange[key] = Number(input.value); });
      range.append(input, Object.assign(document.createElement('span'), { textContent: 'px' }));
    });
    body.appendChild(range);

    if (srcsetError) {
      const reason = srcsetError.message === 'timeout'
        ? `The probe frame did not load within ${Math.round(SRCSET_CONFIG.loadTimeout / 1000)} seconds.`
        : 'The probe frame cannot be read.';
      const error = document.createElement('div');
      error.className = 'error';
      error.innerHTML = `<p><b>Cannot measure.</b> ${reason}</p>
        <p>The page has to run inside a same-origin <code>&lt;iframe&gt;</code> for this.
        Two things break that: it is opened over <code>file://</code>, where every file
        counts as its own origin, or a header forbids the embedding
        (<code>X-Frame-Options</code>, <code>frame-ancestors</code>).</p>`;
      body.appendChild(error);
      return;
    }

    if (missing.length) {
      const note = document.createElement('div');
      note.className = 'error';
      note.innerHTML = `<p><b>${missing.length} of the selected elements were not found in `
        + 'the probe frame</b>, so they carry no measurement. The selection is remembered '
        + 'as a CSS path, and the probe is a fresh load of the page: an element that only '
        + 'appears after an interaction, or one a script moves, sits elsewhere there.</p>'
        + `<p>${missing.map((pick) => `<code>${escapeHtml(pick.paths[0])}</code>`).join('<br>')}</p>`;
      body.appendChild(note);
    }

    const results = picks
      .map((pick, i) => ({ index: i + 1, entry: measurements.get(pick) }))
      .filter((item) => item.entry)
      .map((item) => ({ index: item.index, ...analyze(item.entry) }));

    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = picks.length
        ? 'Nothing measured yet. Press <b>measure</b>: the sweep runs on its own in a '
          + 'probe frame and reports the <code>sizes</code> and <code>srcset</code> the '
          + 'selected images need.'
        : 'Press <b>pick images</b> and click the images you want measured — as many as '
          + 'you like. <b>measure</b> then sweeps the viewport range in a probe frame.';
      body.appendChild(empty);
      return;
    }

    if (lastRun) {
      const summary = document.createElement('p');
      summary.className = 'hint';
      summary.innerHTML = `Measured from <b>${lastRun.from}px</b> to <b>${lastRun.to}px</b> `
        + `in <b>${lastRun.samples}</b> steps; breakpoints pinned to ±${lastRun.gap}px.`
        + (lastRun.aborted
          ? ` <b>Aborted</b> — the planned range went up to ${lastRun.planned}px. Everything `
            + 'above that is unmeasured, so the recommendation does not cover it.'
          : '');
      body.appendChild(summary);
    }

    results.forEach((result) => {
      const sizesAttr = (unitMode === 'px' ? result.sizesPx : result.sizesVw).join(', ');
      const markup = buildMarkup(result, sizesAttr);

      const rows = result.pxSegments.map((segment) => {
        const label = segment.minVw === segment.maxVw
          ? `${segment.minVw}px`
          : `${segment.minVw}–${segment.maxVw}px`;
        const renderW = Math.round(segment.metric);
        const dpr = segment.samples.reduce((max, sample) => Math.max(max, sample.dpr), 1);
        return `<tr><td>${label}</td><td>${renderW}px</td><td>${dpr}×</td>`
          + `<td>${Math.round(renderW * dpr)}px</td></tr>`;
      }).join('');

      const card = document.createElement('div');
      card.className = 'result';
      card.innerHTML = `
        <div class="result-head">
          <span class="idx">${result.index}</span>
          <span class="name">${escapeHtml(result.key)}</span>
          <span class="meta">${result.samples.length} sample(s)</span>
        </div>
        <div class="result-body">
          <div class="field">
            <div class="field-label">Measured progression</div>
            <table>
              <thead><tr><th>Viewport range</th><th>Render width</th><th>DPR</th><th>needed physically</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div class="field">
            <div class="field-label">sizes (${unitMode})</div>
            <div class="code"><button class="copy" data-copy="${escapeHtml(sizesAttr)}">copy</button>${escapeHtml(sizesAttr)}</div>
            ${result.preferVw && unitMode === 'px'
              ? '<div class="field-note">This image scales continuously with the viewport — '
                + '<b>vw</b> states it exactly in a single rule, px only as a staircase rounded upwards.</div>'
              : ''}
          </div>
          <div class="field">
            <div class="field-label">srcset widths (to generate)</div>
            <div class="code"><button class="copy" data-copy="${result.srcsetWidths.join(', ')}">copy</button>${result.srcsetWidths.map((width) => `${width}w`).join(', ')}</div>
            ${result.capped
              ? `<div class="field-note">At DPR ${Math.max(...SRCSET_CONFIG.targetDPRs)} the arithmetic asks for `
                + `<b>${result.needed}px</b>; capped at ${SRCSET_CONFIG.maxImageWidth}px.</div>`
              : ''}
          </div>
          <div class="field">
            <div class="field-label">Example markup</div>
            <div class="code"><button class="copy" data-copy="${escapeHtml(markup)}">copy</button>${escapeHtml(markup)}</div>
          </div>
        </div>`;
      body.appendChild(card);
    });

    wireCopyButtons(body);
  }

  const srcsetTool = {
    id: 'srcset',
    label: 'srcset measurement',
    title: 'srcset measurement',
    icon: ICONS.srcset,
    badge: null,
    controls: () => srcsetControlNodes(),
    onOpen: (body) => renderSrcset(body),
    onClose: () => setPickMarks(false),
  };

  $('abortBtn').addEventListener('click', abortSweep);
  $('pickDone').addEventListener('click', stopPicking);
  $('pickClear').addEventListener('click', clearPicks);

  window.addEventListener('resize', () => {
    if (sweeping && probeFrame) {
      layoutStage(parseInt(probeFrame.style.inlineSize, 10) || currentRange().from);
    }
  }, { passive: true });

  window.addEventListener('scroll', queuePins, { passive: true, capture: true });

  TOOLS.push(srcsetTool);

  function ibanCheckDigits(country, bban) {
    const rearranged = `${bban}${country}00`;
    const digits = rearranged.replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 55);
    let rest = 0;
    for (const digit of digits) rest = (rest * 10 + Number(digit)) % 97;
    return String(98 - rest).padStart(2, '0');
  }

  function iban(country, bban) {
    const full = `${country}${ibanCheckDigits(country, bban)}${bban}`;
    return full.replace(/(.{4})/g, '$1 ').trim();
  }

  const GANDALF = {
    salutation: 'Mr',
    firstName: 'Gandalf',
    middleName: 'Olórin',
    lastName: 'the Grey',
    fullName: 'Gandalf the Grey',
    nickname: 'Mithrandir',
    username: 'mithrandir',
    password: 'Mellon-Speak-Friend-3019!',
    pin: '3019',
    gender: 'male',
    language: 'Westron',
    email: 'mithrandir@aman.ea',
    website: 'https://you-shall-not-pass.aman.ea',
    phone: '+49 1954 1955',
    company: 'The Fellowship of the Ring',
    department: 'Order of the Istari',
    jobTitle: 'Servant of the Secret Fire',
    street: 'Mithlond Quay',
    houseNumber: '3',
    addressLine2: 'Last pier before the Straight Road',
    postalCode: '03019',
    city: 'Grey Havens',
    region: 'Lindon',
    country: 'Middle-earth',
    birthDate: '1000-09-22',
    date: '1000-09-22',
    week: '1000-W38',
    time: '11:11',
    accountHolder: 'Gandalf the Grey',
    bank: 'Michel Delving Savings',
    iban: iban('DE', '301900003019195400'),
    bic: 'SHIRDEFFXXX',
    cardNumber: '4111 1111 1111 1111',
    cardExpiry: '12/30',
    cardCvc: '319',
    taxId: 'DE301919543',
    subject: 'Concerning a certain ring',
    message: 'All we have to decide is what to do with the time that is given '
      + 'us. This is a test entry placed by Gandalf the Grey, '
      + 'Servant of the Secret Fire, wielder of the flame of Anor.',
    search: 'the One Ring',
    age: '2021',
    quantity: '1',
    amount: '19.54',
    number: '3',
    code: 'MELLON',
    color: '#8b8b8b',
    text: 'Gandalf the Grey',
  };

  const FILL_RULES = [
    { kind: 'pin', re: /\bpin\b|\btan\b|\botp\b/ },
    { kind: 'email', types: ['email'], auto: ['email'], re: /e-?mail/ },
    { kind: 'password', types: ['password'], auto: ['new-password', 'current-password'] },
    { kind: 'phone', types: ['tel'], auto: ['tel', 'tel-national', 'tel-local'], re: /phone|telefon|telephone|\btel\b|mobile|handy|fax/ },
    { kind: 'website', types: ['url'], auto: ['url'], re: /website|webseite|homepage|\burl\b|\blink\b/ },
    { kind: 'search', types: ['search'], re: /search|suche|\bquery\b/ },
    { kind: 'cardNumber', auto: ['cc-number'], re: /card-?number|kartennummer|kreditkarte/ },
    { kind: 'cardExpiry', auto: ['cc-exp', 'cc-exp-month', 'cc-exp-year'], re: /expir|ablauf|gültig|valid-?thru/ },
    { kind: 'cardCvc', auto: ['cc-csc'], re: /\bcvc\b|\bcvv\b|\bcsc\b|prüfziffer|security-?code/ },
    { kind: 'iban', re: /\biban\b|kontonummer|account-?number/ },
    { kind: 'bic', re: /\bbic\b|\bswift\b|\bblz\b|bankleitzahl/ },
    { kind: 'accountHolder', re: /kontoinhaber|account-?holder|karteninhaber|cardholder/ },
    { kind: 'bank', re: /\bbank\b/ },
    { kind: 'taxId', re: /\bvat\b|\bust\b|steuer|tax-?(id|number)/ },
    { kind: 'salutation', auto: ['honorific-prefix'], re: /salutation|anrede|honorific/ },
    { kind: 'gender', re: /gender|geschlecht|\bsex\b/ },
    { kind: 'firstName', auto: ['given-name'], re: /first-?name|vorname|given-?name|forename|\bfname\b/ },
    { kind: 'lastName', auto: ['family-name'], re: /last-?name|nachname|surname|family-?name|\blname\b/ },
    { kind: 'middleName', auto: ['additional-name'], re: /middle-?name|zweiter-?vorname/ },
    { kind: 'nickname', auto: ['nickname'], re: /nick-?name|spitzname|display-?name/ },
    { kind: 'username', auto: ['username'], re: /user-?name|benutzer|\buser\b|\blogin\b|\bkennung\b/ },
    { kind: 'company', auto: ['organization'], re: /company|firma|organi[sz]ation|unternehmen|employer|arbeitgeber/ },
    { kind: 'department', re: /department|abteilung|\bteam\b/ },
    { kind: 'jobTitle', auto: ['organization-title'], re: /job-?title|position|\bberuf\b|\brole\b|funktion/ },
    { kind: 'addressLine2', auto: ['address-line2'], re: /address-?(line-?)?2|adresszusatz|\bzusatz\b|apartment|\bapt\b|\bsuite\b|\bc\/o\b/ },
    { kind: 'houseNumber', re: /house-?(number|no)|hausnummer|\bhausnr\b|street-?number/ },
    { kind: 'street', auto: ['street-address', 'address-line1'], re: /street|stra(ss|ß)e|address-?(line-?)?1?|anschrift|adresse/ },
    { kind: 'postalCode', auto: ['postal-code'], re: /post(al)?-?code|\bzip\b|\bplz\b|postleitzahl/ },
    { kind: 'city', auto: ['address-level2'], re: /\bcity\b|\btown\b|\bort\b|\bstadt\b|wohnort/ },
    { kind: 'region', auto: ['address-level1'], re: /\bstate\b|region|province|bundesland|kanton|county/ },
    { kind: 'country', auto: ['country', 'country-name'], re: /country|\bland\b|\bstaat\b/ },
    { kind: 'birthDate', auto: ['bday'], re: /birth|geburt|\bdob\b|\bbday\b/ },
    { kind: 'date', re: /\bdate\b|\bdatum\b|anreise|abreise|termin|deadline|\bfrist\b|(tt|dd|mm)[./-](mm|tt|dd)[./-](jjjj|yyyy)/ },
    { kind: 'language', auto: ['language'], re: /language|sprache|locale/ },
    { kind: 'subject', re: /subject|betreff|\btopic\b|\bthema\b|\breason\b|anliegen|\btitle\b|\btitel\b|überschrift|headline/ },
    { kind: 'message', re: /message|nachricht|comment|kommentar|bemerkung|\bnote\b|feedback|\bbody\b|beschreibung|description/ },
    { kind: 'age', re: /\bage\b|\balter\b/ },
    { kind: 'quantity', re: /quantity|\bmenge\b|\banzahl\b|st(ü|ue)ck|\bnumber\b|\bzahl\b|\bguests?\b|g(ä|ae)ste|\bpersons?\b|personen|teilnehmer/ },
    { kind: 'amount', re: /\bamount\b|\bbetrag\b|\bprice\b|\bpreis|\bsumme\b|\bbudget\b|\bkosten\b/ },
    { kind: 'code', re: /\bcode\b|gutschein|coupon|voucher|\bpromo/ },
  ];

  const TYPE_KIND = {
    date: 'birthDate',
    'datetime-local': 'birthDate',
    month: 'birthDate',
    week: 'week',
    time: 'time',
    color: 'color',
    number: 'number',
    range: 'number',
    file: 'file',
  };

  const SELECT_HINTS = {
    salutation: ['mr', 'herr', 'mister', 'm'],
    gender: ['male', 'männlich', 'mann', 'm', 'herr'],
    country: ['middle-earth', 'mittelerde', 'germany', 'deutschland', 'de'],
    region: ['lindon'],
    language: ['english', 'englisch', 'en', 'deutsch', 'german', 'de'],
    subject: ['other', 'sonstiges', 'allgemein', 'general'],
  };

  const CONSENT_RE = /agree|accept|consent|terms|privacy|datenschutz|akzept|einverstanden|zustimm|\bagb\b|bestätig/;
  const PLACEHOLDER_RE = /^\s*(-+|…|\.{3}|bitte\s|please\s|choose|select|auswähl|wähl|keine|none)/i;
  const SKIP_TYPES = ['hidden', 'submit', 'reset', 'button', 'image'];
  const FILL_TAGS = ['INPUT', 'SELECT', 'TEXTAREA'];
  const FORM_HOOK = 'data-dev-form';

  const FILE_TEXT = 'The Red Book of Westmarch\n'
    + '=========================\n\n'
    + 'A test file placed by the dev dashboard.\n\n'
    + '"All we have to decide is what to do with the time that is given us."\n'
    + '                                            — Gandalf the Grey\n';

  const FILE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" '
    + 'width="64" height="64" role="img" aria-label="Gandalf\'s rune">'
    + '<rect width="64" height="64" fill="#8b8b8b"/>'
    + '<path d="M18 18 46 46M46 18 18 46" fill="none" stroke="#e6e8ee" '
    + 'stroke-width="6" stroke-linecap="round"/>'
    + '<circle cx="32" cy="9" r="3.5" fill="#e6e8ee"/>'
    + '<circle cx="32" cy="55" r="3.5" fill="#e6e8ee"/></svg>';

  const FILE_NAMES = [
    { text: 'the-red-book-of-westmarch.txt', image: 'gandalfs-rune' },
    { text: 'a-short-cut-to-mushrooms.txt', image: 'the-doors-of-durin' },
  ];

  const formRecords = new Map();

  let formList = [];
  let formMarked = false;
  let formControls = null;
  let formFillAll = null;
  let formResetAll = null;

  const formTool = {
    id: 'form',
    label: 'form filler',
    title: 'form filler',
    icon: ICONS.form,
    badge: null,
    controls: () => formControlNodes(),
    onOpen: (body) => renderForm(body),
    onClose: () => setFillMarks(false),
  };

  function nativeSet(el, prop, value) {
    let node = Object.getPrototypeOf(el);
    let desc = null;
    while (node && !desc) {
      desc = Object.getOwnPropertyDescriptor(node, prop);
      if (!desc) node = Object.getPrototypeOf(node);
    }
    if (desc && desc.set) desc.set.call(el, value);
    else el[prop] = value;
  }

  function fire(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function formKey(entry) {
    return entry.el || 'loose';
  }

  function isControl(el) {
    return FILL_TAGS.includes(el.tagName)
      && !SKIP_TYPES.includes((el.type || '').toLowerCase())
      && !el.closest(`[${HOST_ATTR}]`);
  }

  function skipReason(el) {
    const own = (el.getAttribute(FORM_HOOK) || '').trim().toLowerCase();
    if (own === 'skip') return `${FORM_HOOK}="skip"`;
    if (el.closest(`[${FORM_HOOK}="skip"]`)) return `${FORM_HOOK}="skip" on an ancestor`;
    if (el.disabled) return 'disabled';
    if (el.readOnly) return 'readonly';
    return '';
  }

  function scanForms() {
    const forms = q('form')
      .filter((el) => !el.closest(`[${HOST_ATTR}]`))
      .map((el) => ({ el, fields: Array.from(el.elements).filter(isControl) }));
    const loose = q('input, select, textarea')
      .filter((el) => !el.form && isControl(el));
    if (loose.length) forms.push({ el: null, fields: loose });
    formList = forms.filter((entry) => entry.fields.length);
    formList.forEach((entry, i) => { entry.index = i + 1; });
    Array.from(formRecords.keys())
      .filter((key) => key !== 'loose' && !key.isConnected)
      .forEach((key) => formRecords.delete(key));
    return formList;
  }

  function labelWords(el) {
    const parts = [el.name, el.id, el.getAttribute('placeholder'),
      el.getAttribute('aria-label'), el.getAttribute('data-name')];
    if (el.labels) parts.push(...Array.from(el.labels).map((l) => l.textContent));
    const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    by.forEach((id) => parts.push(document.getElementById(id)?.textContent));
    const legend = el.closest('fieldset')?.querySelector('legend');
    if (legend) parts.push(legend.textContent);
    return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').toLowerCase();
  }

  function groupKind(el) {
    const parts = [el.name, el.id];
    const legend = el.closest('fieldset')?.querySelector('legend');
    if (legend) parts.push(legend.textContent);
    const words = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').toLowerCase();
    const hit = FILL_RULES.find((rule) => rule.re && rule.re.test(words));
    return hit ? hit.kind : '';
  }

  function kindOf(el) {
    const forced = (el.getAttribute(FORM_HOOK) || '').trim();
    if (forced && forced.toLowerCase() !== 'skip') return forced;
    const type = (el.type || '').toLowerCase();
    if (type === 'checkbox' || type === 'radio') return type;
    const auto = (el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/);
    const words = labelWords(el);
    const hit = FILL_RULES.find((rule) => (rule.types && rule.types.includes(type))
      || (rule.auto && rule.auto.some((token) => auto.includes(token)))
      || (rule.re && rule.re.test(words)));
    if (hit) return hit.kind;
    if (TYPE_KIND[type]) return TYPE_KIND[type];
    return el.tagName === 'TEXTAREA' ? 'message' : 'text';
  }

  function lookup(kind) {
    return Object.prototype.hasOwnProperty.call(GANDALF, kind) ? GANDALF[kind] : kind;
  }

  function clampDate(el, value) {
    const min = el.getAttribute('min');
    const max = el.getAttribute('max');
    if (min && value < min) return min;
    if (max && value > max) return max;
    return value;
  }

  function stepOf(el) {
    const raw = (el.getAttribute('step') || '').trim().toLowerCase();
    if (raw === 'any') return 0;
    const step = Number.parseFloat(raw);
    return Number.isFinite(step) && step > 0 ? step : 1;
  }

  function numberValue(el, kind, record) {
    const raw = String(lookup(kind)).replace(/[^\d.-]/g, '');
    let value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) value = Number.parseFloat(GANDALF.number);
    const min = Number.parseFloat(el.getAttribute('min'));
    const max = Number.parseFloat(el.getAttribute('max'));
    if ((el.type || '').toLowerCase() === 'range') {
      const low = Number.isFinite(min) ? min : 0;
      const high = Number.isFinite(max) ? max : 100;
      value = low + (high - low) / 2;
    }
    const wanted = value;
    if (Number.isFinite(min) && value < min) value = min;
    if (Number.isFinite(max) && value > max) value = max;
    const step = stepOf(el);
    if (step > 0) {
      const base = Number.isFinite(min) ? min : 0;
      value = Number((base + Math.round((value - base) / step) * step).toFixed(10));
      if (Number.isFinite(max) && value > max) value = Number((value - step).toFixed(10));
      if (Number.isFinite(min) && value < min) value = Number((value + step).toFixed(10));
    }
    if (record && value !== wanted) {
      record.note = "moved to what the field's min, max and step allow";
    }
    return String(value);
  }

  function dateValue(el, wanted, record) {
    const moved = clampDate(el, wanted);
    if (moved !== wanted) {
      record.note = `moved to the field's ${moved > wanted ? 'min' : 'max'}`;
    }
    return moved;
  }

  function dateMask(el) {
    const hint = `${el.getAttribute('placeholder') || ''} ${el.getAttribute('pattern') || ''}`
      .toLowerCase();
    const [year, month, day] = GANDALF.birthDate.split('-');
    const sep = (hint.match(/[./-]/) || ['-'])[0];
    if (/(dd|tt)\s*[./-]\s*mm/.test(hint)) return [day, month, year].join(sep);
    if (/mm\s*[./-]\s*(dd|tt)/.test(hint)) return [month, day, year].join(sep);
    return GANDALF.birthDate;
  }

  function textValue(el, kind, record) {
    const type = (el.type || '').toLowerCase();
    if (type === 'date') return dateValue(el, GANDALF.birthDate, record);
    if (type === 'datetime-local') {
      return `${dateValue(el, GANDALF.birthDate, record)}T${GANDALF.time}`;
    }
    if (type === 'month') return GANDALF.birthDate.slice(0, 7);
    if (type === 'week') return GANDALF.week;
    if (type === 'time') return GANDALF.time;
    if (type === 'color') return GANDALF.color;
    if (type === 'number' || type === 'range') return numberValue(el, kind, record);
    if (kind === 'birthDate' || kind === 'date') return dateMask(el);
    let value = String(lookup(kind));
    const max = Number.parseInt(el.getAttribute('maxlength'), 10);
    if (max > 0 && value.length > max) {
      value = `${value.slice(0, Math.max(0, max - 1))}…`;
      record.note = `cut to the field's maxlength of ${max}`;
    }
    return value;
  }

  function optionScore(option, hints) {
    const value = (option.value || '').trim().toLowerCase();
    const text = (option.textContent || '').trim().toLowerCase();
    const at = hints.findIndex((hint) => value === hint || text === hint);
    if (at > -1) return at;
    const loose = hints.findIndex((hint) => text.startsWith(hint) || value.startsWith(hint));
    return loose > -1 ? loose + hints.length : -1;
  }

  function pickOption(el, kind) {
    const options = Array.from(el.options).filter((option) => !option.disabled);
    const real = options.filter((option) => option.value !== ''
      && !PLACEHOLDER_RE.test(option.textContent || ''));
    const pool = real.length ? real : options;
    if (!pool.length) return null;
    const hints = SELECT_HINTS[kind];
    if (hints) {
      const scored = pool
        .map((option) => ({ option, score: optionScore(option, hints) }))
        .filter((entry) => entry.score > -1)
        .sort((a, b) => a.score - b.score);
      if (scored.length) return scored[0].option;
    }
    return pool[0];
  }

  function imageFile(mime, name, extension) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#8b8b8b';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#e6e8ee';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18, 18);
    ctx.lineTo(46, 46);
    ctx.moveTo(46, 18);
    ctx.lineTo(18, 46);
    ctx.stroke();
    const url = canvas.toDataURL(mime);
    if (url.indexOf(`data:${mime}`) !== 0) return null;
    const binary = atob(url.split(',')[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], `${name}.${extension}`, { type: mime });
  }

  function fileForAccept(token, index) {
    const names = FILE_NAMES[index % FILE_NAMES.length];
    if (/^(\*\/\*|text\/plain|text\/\*|\.txt)$/.test(token)) {
      return new File([FILE_TEXT], names.text, { type: 'text/plain' });
    }
    if (/^(image\/svg\+xml|\.svg)$/.test(token)) {
      return new File([FILE_SVG], `${names.image}.svg`, { type: 'image/svg+xml' });
    }
    if (/^(image\/\*|image\/png|\.png)$/.test(token)) {
      return imageFile('image/png', names.image, 'png');
    }
    if (/^(image\/jpe?g|\.jpe?g)$/.test(token)) {
      return imageFile('image/jpeg', names.image, 'jpg');
    }
    if (/^(image\/webp|\.webp)$/.test(token)) {
      return imageFile('image/webp', names.image, 'webp');
    }
    return null;
  }

  function fileFor(el, index) {
    const accept = (el.getAttribute('accept') || '').trim().toLowerCase();
    if (!accept) return fileForAccept('*/*', index);
    const tokens = accept.split(',').map((token) => token.trim()).filter(Boolean);
    for (const token of tokens) {
      const made = fileForAccept(token, index);
      if (made) return made;
    }
    return null;
  }

  function fillFile(el, record) {
    if (!window.DataTransfer || !window.File) {
      record.note = 'this browser will not let a script build a FileList';
      return;
    }
    const wanted = el.multiple ? 2 : 1;
    const files = [];
    for (let i = 0; i < wanted; i++) {
      const made = fileFor(el, i);
      if (made) files.push(made);
    }
    if (!files.length) {
      record.note = `no test file matches accept="${el.getAttribute('accept')}"`;
      return;
    }
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    el.files = transfer.files;
    fire(el);
    record.value = files.map((file) => file.name).join(', ');
  }

  function snapshot(el) {
    return {
      value: el.value,
      checked: el.checked,
      files: el.files || null,
      selected: el.tagName === 'SELECT'
        ? Array.from(el.options).map((option) => option.selected)
        : null,
    };
  }

  function restore(el, before) {
    if (!el.isConnected || !before) return;
    const type = (el.type || '').toLowerCase();
    if (type === 'file') {
      try { el.files = before.files; } catch (err) { el.value = ''; }
    } else if (type === 'checkbox' || type === 'radio') {
      nativeSet(el, 'checked', before.checked);
    } else if (before.selected) {
      Array.from(el.options).forEach((option, i) => {
        option.selected = Boolean(before.selected[i]);
      });
    } else {
      nativeSet(el, 'value', before.value);
    }
    fire(el);
  }

  function wantsCheck(el, group) {
    if (el.required || CONSENT_RE.test(labelWords(el))) return true;
    return group.length < 2 || el === group[0];
  }

  function fillOne(el, group) {
    const kind = kindOf(el);
    const type = (el.type || '').toLowerCase();
    const record = { el, kind, value: '', note: '', before: snapshot(el), skipped: '' };

    const reason = skipReason(el);
    if (reason) {
      record.skipped = reason;
      return record;
    }

    if (el.tagName === 'SELECT') {
      const option = pickOption(el, kind);
      if (!option) {
        record.skipped = 'no option to choose';
        return record;
      }
      if (el.multiple) {
        Array.from(el.options).forEach((entry) => { entry.selected = false; });
        option.selected = true;
        const second = Array.from(el.options).find((entry) => entry !== option
          && !entry.disabled && entry.value !== '');
        if (second) second.selected = true;
        record.value = Array.from(el.selectedOptions)
          .map((entry) => entry.textContent.trim()).join(', ');
      } else {
        nativeSet(el, 'value', option.value);
        record.value = (option.textContent || option.value).trim();
      }
      fire(el);
    } else if (type === 'checkbox') {
      if (!wantsCheck(el, group)) {
        record.skipped = 'one box per group is enough';
        return record;
      }
      nativeSet(el, 'checked', true);
      fire(el);
      record.value = 'checked';
    } else if (type === 'radio') {
      nativeSet(el, 'checked', true);
      fire(el);
      record.value = 'selected';
    } else if (type === 'file') {
      fillFile(el, record);
      if (!record.value) {
        record.skipped = record.note || 'no file could be built';
        return record;
      }
    } else {
      const value = textValue(el, kind, record);
      if (!Object.prototype.hasOwnProperty.call(GANDALF, kind)) record.kind = 'literal';
      nativeSet(el, 'value', value);
      fire(el);
      record.value = el.value;
      if (el.value !== value) {
        const said = el.value
          ? `the control rewrote it, asked for ${value}`
          : `the control refused ${value}`;
        record.note = record.note ? `${record.note}; ${said}` : said;
      }
      if (!el.value) {
        record.skipped = record.note;
        return record;
      }
    }

    if (el.validity && !el.validity.valid) {
      record.invalid = el.validationMessage || 'the browser rejects this value';
    }
    return record;
  }

  function groupOf(entry, el) {
    if (!el.name) return [el];
    const type = (el.type || '').toLowerCase();
    return entry.fields.filter((other) => other.name === el.name
      && (other.type || '').toLowerCase() === type);
  }

  function radioLabel(el) {
    const labels = el.labels
      ? Array.from(el.labels).map((label) => label.textContent).join(' ')
      : '';
    return (labels || el.getAttribute('aria-label') || el.value || '').trim();
  }

  function radioChoice(entry, el) {
    const group = groupOf(entry, el);
    const usable = group.filter((option) => !skipReason(option));
    if (!usable.length) return group[0];
    const hints = SELECT_HINTS[groupKind(el)];
    if (!hints) return usable[0];
    const scored = usable
      .map((option) => ({
        option,
        score: optionScore({ value: option.value, textContent: radioLabel(option) }, hints),
      }))
      .filter((item) => item.score > -1)
      .sort((a, b) => a.score - b.score);
    return scored.length ? scored[0].option : usable[0];
  }

  function fillForm(entry, log) {
    const seen = new Set();
    const records = [];

    entry.fields.filter((el) => el.isConnected).forEach((el) => {
      const type = (el.type || '').toLowerCase();
      if (type === 'radio') {
        const key = `radio:${el.name || el.id || records.length}`;
        if (seen.has(key)) return;
        seen.add(key);
        const chosen = radioChoice(entry, el);
        records.push(fillOne(chosen, groupOf(entry, chosen)));
        return;
      }
      records.push(fillOne(el, type === 'checkbox' ? groupOf(entry, el) : [el]));
    });

    formRecords.set(formKey(entry), records);
    setFillMarks(formMarked);
    refreshFormBadge();
    if (log) logForm(entry, records);
    if (openTool === formTool) refreshPanel();
    return records;
  }

  function resetForm(entry) {
    const records = formRecords.get(formKey(entry));
    if (!records) return;
    records.forEach((record) => {
      if (record.skipped) return;
      restore(record.el, record.before);
    });
    formRecords.delete(formKey(entry));
    setFillMarks(formMarked);
    refreshFormBadge();
    if (openTool === formTool) refreshPanel();
  }

  function fillAllForms(log) {
    scanForms();
    formList.forEach((entry) => fillForm(entry, log));
    return formList.length;
  }

  function resetAllForms() {
    formList.slice().forEach((entry) => resetForm(entry));
  }

  function allRecords() {
    return formList.flatMap((entry) => formRecords.get(formKey(entry)) || []);
  }

  function refreshFormBadge() {
    const records = allRecords();
    const written = records.filter((record) => !record.skipped);
    const bad = written.filter((record) => record.invalid);
    if (!written.length) {
      setBadge(formTool, null, '', 'form filler');
      return;
    }
    setBadge(
      formTool,
      bad.length ? 'hit' : 'clean',
      (bad.length || written.length) > 99 ? '99' : String(bad.length || written.length),
      bad.length
        ? `form filler — ${written.length} field(s) filled, ${bad.length} still rejected`
        : `form filler — ${written.length} field(s) filled with Gandalf the Grey`
    );
  }

  function setFillMarks(on) {
    formMarked = on;
    q(`[${FILL_ATTR}]`).forEach((el) => el.removeAttribute(FILL_ATTR));
    if (on) {
      allRecords()
        .filter((record) => !record.skipped && record.el.isConnected)
        .forEach((record) => record.el.setAttribute(FILL_ATTR, record.kind));
    }
    if (formControls) formControls[2].setAttribute('aria-pressed', String(on));
  }

  function logForm(entry, records) {
    const written = records.filter((record) => !record.skipped);
    console.group(`form filler: ${formTitle(entry)} — ${written.length} field(s)`);
    records.forEach((record) => {
      const head = record.skipped
        ? `%c[skipped] ${fieldName(record.el)} — ${record.skipped}`
        : `%c${fieldName(record.el)} → ${record.value}`;
      const tone = record.skipped
        ? 'color: #9aa4b8;'
        : `color: ${record.invalid ? '#f87171' : '#86efac'}; font-weight: bold;`;
      console.log(head, tone, record.el);
      if (record.invalid) console.log(`   ↳ ${record.invalid}`);
    });
    console.groupEnd();
  }

  function fieldName(el) {
    const name = el.getAttribute('name') || el.id;
    const tag = el.tagName.toLowerCase();
    const type = el.tagName === 'INPUT' ? `[${(el.type || 'text').toLowerCase()}]` : '';
    return name ? `${name} ${tag}${type}` : `${tag}${type}`;
  }

  function formTitle(entry) {
    if (!entry.el) return 'fields outside any <form>';
    const id = entry.el.id ? `#${entry.el.id}` : '';
    const name = entry.el.getAttribute('name') ? `[name="${entry.el.getAttribute('name')}"]` : '';
    return `<form>${id || name}`;
  }

  function formMeta(entry) {
    const bits = [`${entry.fields.length} control(s)`];
    if (entry.el) {
      const action = entry.el.getAttribute('action');
      bits.push(`${(entry.el.getAttribute('method') || 'get').toUpperCase()} ${action || '(this page)'}`);
    } else {
      bits.push('no <form> element — filled one by one');
    }
    return bits.join(' · ');
  }

  function formControlNodes() {
    if (formControls) return formControls;

    const badge = document.createElement('span');
    badge.className = 'badge';

    formFillAll = document.createElement('button');
    formFillAll.type = 'button';
    formFillAll.className = 'primary';
    formFillAll.textContent = 'fill all';
    formFillAll.title = 'Write Gandalf the Grey into every form on the page';
    formFillAll.addEventListener('click', () => fillAllForms(true));

    const mark = document.createElement('button');
    mark.type = 'button';
    mark.textContent = 'mark in page';
    mark.title = 'Outline every field that was filled';
    mark.setAttribute('aria-pressed', 'false');
    mark.addEventListener('click', () => setFillMarks(!formMarked));

    formResetAll = document.createElement('button');
    formResetAll.type = 'button';
    formResetAll.textContent = 'reset all';
    formResetAll.title = 'Put every field back the way it was';
    formResetAll.addEventListener('click', () => resetAllForms());

    const again = document.createElement('button');
    again.type = 'button';
    again.textContent = 'scan again';
    again.addEventListener('click', () => { scanForms(); refreshPanel(); });

    formControls = [badge, formFillAll, mark, formResetAll, again];
    return formControls;
  }

  function fieldRow(record) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row';
    const value = record.skipped
      ? record.skipped
      : `${record.value}${record.note ? ` — ${record.note}` : ''}`;
    row.innerHTML = `<span class="tag">${escapeHtml(fieldName(record.el))}</span>`
      + `<span class="doc">${escapeHtml(record.skipped ? 'not filled' : record.kind)}</span>`
      + `<span class="excerpt${record.skipped ? '' : ' filled'}">${escapeHtml(value)}</span>`
      + (record.invalid ? `<span class="warn">${escapeHtml(record.invalid)}</span>` : '');
    row.addEventListener('click', () => flash(record.el));
    return row;
  }

  function formCard(entry) {
    const records = formRecords.get(formKey(entry)) || null;
    const written = records ? records.filter((record) => !record.skipped) : [];

    const card = document.createElement('div');
    card.className = 'result';

    const head = document.createElement('div');
    head.className = 'result-head';
    head.innerHTML = `<span class="idx">${entry.index}</span>`
      + `<span class="name">${escapeHtml(formTitle(entry))}</span>`
      + `<span class="meta">${escapeHtml(formMeta(entry))}</span>`
      + '<span class="spacer"></span>';

    const fill = document.createElement('button');
    fill.type = 'button';
    fill.className = 'mini primary';
    fill.textContent = records ? 'fill again' : 'fill';
    fill.addEventListener('click', () => fillForm(entry, true));
    head.appendChild(fill);

    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'mini';
    undo.textContent = 'reset';
    undo.disabled = !records;
    undo.addEventListener('click', () => resetForm(entry));
    head.appendChild(undo);

    if (entry.el) {
      const show = document.createElement('button');
      show.type = 'button';
      show.className = 'mini';
      show.textContent = 'show';
      show.addEventListener('click', () => flash(entry.el));
      head.appendChild(show);
    }

    card.appendChild(head);

    const body = document.createElement('div');
    body.className = 'result-body';
    if (!records) {
      body.innerHTML = '<p class="note">Not filled yet.</p>';
    } else {
      const summary = document.createElement('p');
      summary.className = 'hint';
      const bad = written.filter((record) => record.invalid).length;
      const left = records.length - written.length;
      summary.innerHTML = `<b>${written.length}</b> field(s) written`
        + (left ? `, ${left} left alone` : '')
        + (bad ? `, <b>${bad}</b> still rejected by the browser` : '')
        + '. A click on a row scrolls to the field and flashes it.';
      body.appendChild(summary);
      records.forEach((record) => body.appendChild(fieldRow(record)));
    }
    card.appendChild(body);
    return card;
  }

  function renderForm(body) {
    const entries = scanForms();
    const badge = formControlNodes()[0];
    const written = allRecords().filter((record) => !record.skipped).length;
    badge.textContent = entries.length
      ? `${entries.length} form(s)${written ? ` · ${written} field(s) filled` : ''}`
      : 'no form';
    badge.className = `badge${written ? ' clean' : ''}`;
    formFillAll.disabled = !entries.length;
    formResetAll.disabled = !written;

    if (!entries.length) {
      body.innerHTML = '<p class="empty">No form and no free-standing field on this page.</p>';
      return;
    }

    body.innerHTML = '<p class="hint">Every form on the page, with the fields it '
      + 'would be filled with. <b>fill</b> writes <b>Gandalf the Grey</b> into one form, '
      + '<b>fill all</b> into all of them, and <b>reset</b> puts every field back the way '
      + 'it was. Each field is matched by its <code>autocomplete</code>, its type and its '
      + 'name or label; <code>data-dev-form="skip"</code> keeps a field out and '
      + '<code>data-dev-form="&lt;kind&gt;"</code> forces one. Nothing is submitted — the '
      + 'submit button is yours to press.</p>';
    entries.forEach((entry) => body.appendChild(formCard(entry)));
  }

  function targetEntry(target) {
    scanForms();
    if (typeof target === 'number') return formList[target - 1] || null;
    if (typeof target === 'string') {
      const el = document.querySelector(target);
      if (!el) return null;
      return formList.find((entry) => entry.el === el
        || entry.fields.includes(el)) || null;
    }
    if (target && target.nodeType === 1) {
      return formList.find((entry) => entry.el === target
        || entry.fields.includes(target)
        || (entry.el && entry.el.contains(target))) || null;
    }
    return null;
  }

  function fillTarget(target, log) {
    if (target === undefined || target === null) return fillAllForms(log);
    const entry = targetEntry(target);
    if (!entry) {
      console.warn('form filler: no form found for', target);
      return null;
    }
    return fillForm(entry, log);
  }

  function resetTarget(target) {
    if (target === undefined || target === null) {
      resetAllForms();
      return;
    }
    const entry = targetEntry(target);
    if (entry) resetForm(entry);
  }

  TOOLS.push(formTool);

  function removeSelf() {
    abortSweep();
    setPicking(false);
    closePanel();
    clearPage();
    setSpace(0);
    pageStyle.remove();
    host.remove();
    delete registry.dashboard;
  }

  TOOLS.forEach((tool) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tool';
    button.title = tool.title;
    button.setAttribute('aria-label', tool.title);
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = `${tool.icon}<span class="dot" hidden></span>`;
    button.addEventListener('click', () => openPanel(tool));
    tool.button = button;
    toolButtons.appendChild(button);
    refreshBadge(tool);
  });

  $('collapseBtn').addEventListener('click', () => setCollapsed(!collapsed));
  $('destroyBtn').addEventListener('click', removeSelf);
  $('panelClose').addEventListener('click', closePanel);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (sweeping) {
      abortSweep();
      return;
    }
    if (picking) {
      stopPicking();
      return;
    }
    if (!panel.hidden) closePanel();
  });

  const rescanOverflow = debounce(() => overflowScan(false), 300);
  window.addEventListener('resize', () => {
    renderReadout();
    syncSpace();
    queuePins();
    rescanOverflow();
  }, { passive: true });

  function mount() {
    document.documentElement.appendChild(host);
    renderReadout();
    setCollapsed(collapsed);
    syncSpace();
    if (window.ResizeObserver) new ResizeObserver(() => syncSpace()).observe(bar);
  }

  function firstScan() {
    a11yScan(true);
    overflowScan(true);
    adoptMarked();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  if (document.readyState === 'complete') {
    setTimeout(firstScan, 300);
  } else {
    window.addEventListener('load', () => setTimeout(firstScan, 300), { once: true });
  }

  registry.dashboard = {
    open: () => setCollapsed(false),
    close: closePanel,
    destroy: removeSelf,
    collapse: () => setCollapsed(true),
    expand: () => setCollapsed(false),
    show: (id) => {
      const tool = TOOLS.find((entry) => entry.id === id);
      if (tool) showTool(tool);
    },
    a11y: {
      scan: () => a11yScan(true),
      findings: () => a11yFindings,
      mark: (on) => setA11yMarks(on !== false),
      config: A11Y_CONFIG,
    },
    overflow: {
      scan: () => overflowScan(true),
      findings: () => overflowFindings,
      mark: (on) => setOverflowMarks(on !== false),
    },
    srcset: {
      measure: startSweep,
      abort: abortSweep,
      pick: () => startPicking(),
      done: () => stopPicking(),
      select: (el) => { if (el && el.nodeType === 1) togglePick(el); },
      selected: () => picks.slice(),
      clear: clearPicks,
      data: measurements,
      config: SRCSET_CONFIG,
    },
    form: {
      forms: () => scanForms().map((entry) => entry.el),
      fill: (target) => fillTarget(target, true),
      reset: (target) => resetTarget(target),
      mark: (on) => setFillMarks(on !== false),
      records: () => allRecords(),
      data: GANDALF,
      rules: FILL_RULES,
    },
    qr: {
      grid: (text) => qrGrid(text || location.href),
    },
  };
})();
