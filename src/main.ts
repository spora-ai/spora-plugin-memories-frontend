import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from './App.vue'
import MemoriesPage from './pages/MemoriesPage.vue'
import { setApi } from './api/client'
import { createPluginI18n } from './i18n'
import { HOST_CONTEXT_KEY, type PluginHostContext } from './shims'

/**
 * Plugin mount/unmount contract.
 *
 * The IIFE lib wrapper installs this on `window.SporaAppMemories`.
 * The host's `apps/registry.ts` reads `window.SporaAppMemories.mount`
 * and `unmount` and calls them when `/apps/memories` is mounted/
 * unmounted.
 *
 * Important: the plugin uses a *local* Pinia instance and a *local*
 * Vue Router instance (with `createMemoryHistory`, since we never
 * own the browser address bar). Plugin-only state (the memories and
 * principals stores) lives here so it doesn't pollute the host's
 * stores. Host services (auth, theme) are reached through the host's
 * Pinia instance on `hostContext.pinia`; `setApi(...)` wires the
 * host's REST client into the plugin's own bridge.
 *
 * The i18n instance is local too: the host does not publish its own,
 * so the plugin builds one from its own catalogue and seeds it with
 * `hostContext.locale`.
 *
 * `mount()` may be sync or async. The registry awaits the return
 * value when it looks like a thenable, so plugins can do async setup
 * (config fetch, initial data load) before returning.
 */

interface MountContract {
    mount: (target: HTMLElement, hostContext: PluginHostContext) => void | Promise<void>
    unmount: (target: HTMLElement) => void
}

interface MountTarget extends HTMLElement {
    __sporaApp?: { unmount: () => void; app: import('vue').App }
}

const SporaApp: MountContract = {
    mount(target: HTMLElement, hostContext: PluginHostContext): void {
        // Wire the host's typed REST client into the plugin-local
        // `getApi()` container so `api/memories.ts` and
        // `composables/useAgents.ts` can reach it.
        setApi(hostContext.api)

        const app = createApp(App, { hostContext })

        // Provide hostContext via Vue's inject API so `<script setup>`
        // descendants (MemoryEditor, MemoriesPage) can
        // `inject(HOST_CONTEXT_KEY)` without prop-drilling through
        // every layer.
        app.provide(HOST_CONTEXT_KEY, hostContext)

        app.use(createPinia())

        // The plugin builds its own i18n instance from its own
        // catalogue; the host only tells us which language is active.
        app.use(createPluginI18n(hostContext.locale))

        // Plugin-local router. `App.vue` deliberately creates no router
        // of its own — this is the one `app.use(...)` installs. Both
        // route names resolve to `MemoriesPage`; the page branches on
        // `route.name` to switch between global and agent modes, and on
        // `route.params.id` to pick the active agent.
        const router = createRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', name: 'global-memories', component: MemoriesPage },
                { path: '/agents/:id', name: 'agent-memories', component: MemoriesPage },
            ],
        })
        app.use(router)

        // Stash the whole host context on `globalProperties` so any
        // component can reach it via `this.$host` without polluting
        // `provide`/`inject` keys that the host also uses.
        app.config.globalProperties.$host = hostContext
        app.mount(target)

        // Keep a back-reference so `unmount` can find the right app
        // even if the host mounts the same bundle into multiple slots.
        const typedTarget = target as MountTarget
        typedTarget.__sporaApp = {
            app,
            unmount: () => {
                app.unmount()
            },
        }
    },

    unmount(target: HTMLElement): void {
        const typedTarget = target as MountTarget
        if (typedTarget.__sporaApp) {
            typedTarget.__sporaApp.unmount()
            delete typedTarget.__sporaApp
        }
    },
}

// Vite's IIFE lib wrapper installs the value at `window.<lib.name>`
// when `build.lib.name = 'SporaAppMemories'`. The explicit assignment
// covers the cases where this module is evaluated directly instead of
// through the built IIFE bundle.
window.SporaAppMemories = SporaApp

export default SporaApp
