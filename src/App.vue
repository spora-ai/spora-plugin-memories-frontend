<script setup lang="ts">
import { createRouter, createMemoryHistory } from 'vue-router'
import MemoriesPage from './pages/MemoriesPage.vue'
import './style.css'

/**
 * App.vue — plugin-local router setup + entry component.
 *
 * Both route names resolve to the same `MemoriesPage` component.
 * `MemoriesPage` branches on `route.name` to switch between the
 * `global` and `agent` modes, and on `route.params.id` to pick the
 * active agent. This consolidation replaces the old
 * `MemorySidebar` + `GlobalMemoriesPage` + `AgentMemoriesPage`
 * tree — type-filter chips now live inside the page's
 * `DocumentsPanel`, so a router-children layout was no longer
 * needed.
 *
 * `createMemoryHistory` keeps the URLs in JavaScript rather than the
 * browser address bar. The host SPA renders this bundle under
 * `/apps/memories`; clicking the sidebar's internal deep-links only
 * updates our in-app route state.
 *
 * `main.ts → SporaApp` calls `app.use(localRouter)` before mounting, so
 * `useRoute()`/`useRouter()` resolve to the local router for the
 * duration of the slot. `hostContext` is provided via `provide(...)`
 * so descendants (`MemoryEditor`, the pages) can inject it without
 * prop-drilling.
 *
 * Defining the router here (not in `main.ts`) keeps the entry's only
 * job to plugin mounting/unmounting.
 */

const props = defineProps<{
    hostContext: import('./shims').PluginHostContext
}>()

const router = createRouter({
    history: createMemoryHistory(),
    routes: [
        {
            path: '/',
            name: 'global-memories',
            component: MemoriesPage,
        },
        {
            path: '/agents/:id',
            name: 'agent-memories',
            component: MemoriesPage,
        },
    ],
})

defineExpose({ router, hostContext: props.hostContext })
</script>

<template>
    <div id="spora-plugin-memories">
        <MemoriesPage />
    </div>
</template>
