/**
 * boot.js
 * ----------------------------------------------------------------------------
 * Minimal module loader:
 * - loads global modules on demand for every page
 * - loads page modules on demand based on data-js-behavior
 * - optionally tears modules back down again via destroyModulesInScope()
 *
 * markup example:
 * <section data-js-behavior="accordion,slider"></section>
 *
 * Teardown contract: init(el, services) may optionally return a cleanup
 * function (`() => { ... }`). This is for hosts that mount/unmount the same
 * DOM subtree repeatedly (a JS framework re-rendering, an SPA route change)
 * rather than a classic full-page load. A component with no listeners/
 * observers/timers outside its own subtree does not need one; the loader
 * only stores what init() actually returns.
 * ----------------------------------------------------------------------------
 */



// module registries (lazy-loaded modules)
import { globalRegistry, registry } from './registry.js';

// shared services (dependency injection)
import { createReporter } from './createReporter.js';



// composition root: build shared services once, on module load.
// kept at module scope so the exported initModulesInScope() can reach
// the same services when called for dynamically inserted markup.
const reporter = createReporter({ level: 'warn' });

const services = {
  reporter,
  // add further shared functions here (debounce, readCssProp, ...)
};

// per-element, per-module cleanup functions returned by init(). Only
// populated when a module actually returns one (see destroyModulesInScope).
const cleanups = new WeakMap();



function parseModuleNames(el) {
  return (el.dataset.jsBehavior || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}



// Load and init one module on one element. The double-init flag is set
// synchronously, before the first await, so two initModulesInScope() calls
// racing over the same element cannot both get past it.
async function initModule(el, name) {
  const load = registry[name];

  // warn if module is not registered
  if (!load) {
    services.reporter.report(
      'loader',
      `module "${name}" not found in registry.`, { el }
    );
    return;
  }

  // prevent double init
  const key = `jsInit_${name}`;
  if (el.dataset[key] === '1') return;
  el.dataset[key] = '1';

  try {
    const mod = await load();

    if (typeof mod.init !== 'function') {
      services.reporter.report(
        'loader',
        `module "${name}" init failed.`, { el, mod }
      );
      return;
    }

    const cleanup = await Promise.resolve(mod.init(el, services));

    if (typeof cleanup === 'function') {
      if (!cleanups.has(el)) cleanups.set(el, new Map());
      cleanups.get(el).set(name, cleanup);
    }
  }

  catch (err) {
    services.reporter.report(
      'loader',
      `failed to load module "${name}".`, { el, err }
    );
  }
}



// The modules ON one element run in source order: "a,b" may well mean that
// b expects the markup a produced, and only the author of that attribute
// knows. Between elements there is no such relationship, so they do not
// wait for each other — see initModulesInScope.
async function initElement(el) {
  for (const name of parseModuleNames(el)) {
    await initModule(el, name);
  }
}



async function initModulesInScope(scope = document) {
  const nodes = scope.querySelectorAll('[data-js-behavior]');

  // Concurrently, and that is not a micro-optimisation: every module is a
  // separate lazily imported chunk, so awaiting one element before starting
  // the next turns n independent fetches into n round trips laid end to end.
  // The last component on the page would then be enhanced n round trips
  // after the first paint, which is exactly the window the pre-enhancement
  // state in the stylesheets exists to cover (see
  // _shared/scss/_progressiveEnhancement.scss). Shortening it is the other
  // half of the same job.
  //
  // initElement never rejects — initModule catches per module and reports —
  // so one broken module still cannot abort the rest of the page.
  await Promise.all(Array.from(nodes, (el) => initElement(el)));
}



// tear modules in scope back down: calls each stored cleanup, then clears
// the double-init flag so a later initModulesInScope() over the same
// element can run init() again. For hosts that mount/unmount the same
// subtree repeatedly instead of doing a full page (re)load.
function destroyModulesInScope(scope = document) {
  const nodes = scope.querySelectorAll('[data-js-behavior]');

  for (const el of nodes) {
    const stored = cleanups.get(el);
    if (!stored) continue;

    for (const [name, cleanup] of stored) {
      try {
        cleanup();
      }

      catch (err) {
        services.reporter.report(
          'loader',
          `module "${name}" destroy failed.`, { el, err }
        );
      }

      delete el.dataset[`jsInit_${name}`];
    }

    cleanups.delete(el);
  }
}


async function initGlobalModules() {
  for (const [name, load] of Object.entries(globalRegistry)) {
    try {
      const mod = await load();

      if (typeof mod.init !== 'function') {
        services.reporter.report(
          'loader',
          `global module "${name}" init failed.`, { mod }
        );
        continue;
      }

      await Promise.resolve(mod.init(services));
    }

    catch (err) {
      services.reporter.report(
        'loader',
        `failed to load global module "${name}".`, { err }
      );
    }
  }
}


async function boot() {
  await initGlobalModules();
  await initModulesInScope();
}



// run once on initial page load
boot();



// expose scoped init/destroy for dynamically loaded content
export { initModulesInScope, destroyModulesInScope };