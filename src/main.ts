import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from './App.vue'
import GlobalMemoriesPage from './pages/GlobalMemoriesPage.vue'
import AgentMemoriesPage from './pages/AgentMemoriesPage.vue'
import { setApi } from './api/client'
import type { PluginHostContext } from './shims'

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
 * own the browser address bar). Plugin-only state (currently the
 * `useMemoriesStore` reordering + view mode) lives here so it doesn't
 * pollute the host's stores. Host services (auth, theme) are reached
 * via the passed-in `hostContext.api` and `setApi(...)` initializes
 * the bridge.
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

const HOST_CONTEXT_KEY = Symbol('spora-memories-host-context') as unknown as import('vue').InjectionKey<PluginHostContext>

const SporaApp: MountContract = {
    mount(target: HTMLElement, hostContext: PluginHostContext): void {
        // Wire the host's typed REST client into the plugin-local
        // `getApi()` container so `api/memories.ts` and
        // `composables/useAgents.ts` can reach it without a global Pinia.
        setApi(hostContext.api)

        const app = createApp(App, { hostContext })

        // Provide hostContext via Vue's inject API so `<script setup>`
        // descendants (MemoryEditor, GlobalMemoriesPage,
        // AgentMemoriesPage) can `inject(HOST_CONTEXT_KEY)` without
        // prop-drilling through every layer.
        app.provide(HOST_CONTEXT_KEY, hostContext)

        // Plugin-local Pinia for plugin-only state.
        app.use(createPinia())

        // Plugin-local router. We re-declare the routes here (App.vue
        // builds its own copy of the same router; this one is the one
        // `app.use(...)` installs). Mounting and unmounting a second
        // instance of the same plugin under the same target re-creates
        // the router — fine, because `createMemoryHistory()` keeps state
        // in memory and the new slot starts blank.
        const router = createRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', name: 'global-memories', component: GlobalMemoriesPage },
                { path: '/agents/:id', name: 'agent-memories', component: AgentMemoriesPage },
                { path: '/agents/:id/:memoryId', name: 'agent-memories-detail', component: AgentMemoriesPage },
            ],
        })
        app.use(router)

        // Stash the host's Pinia on `globalProperties` so any component
        // can reach it via `this.$host` without polluting `provide`/
        // `inject` keys that the host also uses.
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
// when `build.lib.name = 'SporaAppMemories'`. We additionally assign
// here for the dev-mode entry (which doesn't go through
// `vite build --lib`).
window.SporaAppMemories = SporaApp

export default SporaApp
