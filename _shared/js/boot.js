// boot.js

/**
 * minimal module loader:
 * - loads global modules on demand for every page
 * - loads page modules on demand based on data-js-module
 *
 * markup example:
 * <section data-js-module="accordion,slider"></section>
 */

// module registries (lazy-loaded modules)
import { globalRegistry, registry } from "./registry.js"

// shared services (dependency injection)
import { createReporter } from "./createReporter.js"



// composition root: build shared services once, on module load.
// kept at module scope so the exported initModulesInScope() can reach
// the same services when called for dynamically inserted markup.
const reporter = createReporter({ level: "warn" })

const services = {
  reporter,
  // add further shared functions here (debounce, readCssProp, ...)
}



function parseModuleNames(el) {
  return (el.dataset.jsModule || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}



async function initModulesInScope(scope = document) {
  const nodes = scope.querySelectorAll("[data-js-module]")

  for (const el of nodes) {
    const names = parseModuleNames(el)

    for (const name of names) {
      const load = registry[name]

      // warn if module is not registered
      if (!load) {
        services.reporter.report(
          "loader",
          `module "${name}" not found in registry.`, { el }
        )
        continue
      }

      // prevent double init
      const key = `jsInit_${name}`
      if (el.dataset[key] === "1") continue
      el.dataset[key] = "1"

      try {
        const mod = await load()

        if (typeof mod.init !== "function") {
          services.reporter.report(
            "loader",
            `module "${name}" init failed.`, { el, mod }
          )
          continue
        }

        await Promise.resolve(mod.init(el, services))
      }

      catch (err) {
        services.reporter.report(
          "loader",
          `failed to load module "${name}".`, { el, err }
        )
      }
    }
  }
}


async function initGlobalModules() {
  for (const [name, load] of Object.entries(globalRegistry)) {
    try {
      const mod = await load()

      if (typeof mod.init !== "function") {
        services.reporter.report(
          "loader",
          `global module "${name}" init failed.`, { mod }
        )
        continue
      }

      await Promise.resolve(mod.init(services))
    }

    catch (err) {
      services.reporter.report(
        "loader",
        `failed to load global module "${name}".`, { err }
      )
    }
  }
}


async function boot() {
  await initGlobalModules()
  await initModulesInScope()
}



// run once on initial page load
boot()



// expose scoped init for dynamically loaded content
export { initModulesInScope }