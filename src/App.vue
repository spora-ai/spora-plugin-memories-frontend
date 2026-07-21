<script setup lang="ts">
import { createRouter, createMemoryHistory } from 'vue-router'
import MemoriesPage from './pages/MemoriesPage.vue'
import GlobalMemoriesPage from './pages/GlobalMemoriesPage.vue'
import AgentMemoriesPage from './pages/AgentMemoriesPage.vue'
import './style.css'

/**
 * App.vue — plugin-local router setup + entry component.
 *
 * The plugin-local router resolves:
 *   `/`                        → GlobalMemoriesPage  (name: 'global-memories')
 *   `/agents/:id`              → AgentMemoriesPage   (name: 'agent-memories')
 *   `/agents/:id/:memoryId`    → AgentMemoriesPage   (edit mode when the
 *                               matching `memoryId` corresponds to a row
 *                               in `agentMemories`)
 *
 * `createMemoryHistory` keeps the URLs in JavaScript rather than the
 * browser address bar. The host SPA renders this bundle under
 * `/apps/memories`; clicking the sidebar's internal deep-links only
 * updates our in-app route state. The `MemorySidebar` and the two
 * page components read their state from `useRoute()`/`useRouter()`,
 * which `app.use(localRouter)` activates.
 *
 * `MountContract` (declared in `main.ts → const SporaApp`) installs
 * the router via `app.use(localRouter)` before mounting the app, so
 * `useRoute()`/`useRouter()` resolve to the local router for the
 * duration of the slot.
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
            component: GlobalMemoriesPage,
        },
        {
            path: '/agents/:id',
            name: 'agent-memories',
            component: AgentMemoriesPage,
        },
        {
            path: '/agents/:id/:memoryId',
            name: 'agent-memories-detail',
            component: AgentMemoriesPage,
        },
    ],
})

// Expose router + hostContext to descendants so `MemoriesPage`/
// `MemorySidebar` can reach them via `useRouter()`/`inject()`.
defineExpose({ router, hostContext: props.hostContext })
</script>

<template>
    <MemoriesPage />
</template>
