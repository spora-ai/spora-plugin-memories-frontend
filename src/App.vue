<script setup lang="ts">
import MemoriesPage from './pages/MemoriesPage.vue'
import './style.css'

/**
 * App.vue — entry component.
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
 * The plugin-local router (with `createMemoryHistory` so URLs stay
 * in JavaScript rather than the browser address bar) is built and
 * installed in `main.ts → mount()` (and mirrored in `dev-main.ts`
 * for the dev sandbox). This file intentionally does not create a
 * router of its own: a second `createRouter()` instance here would
 * never be `app.use()`'d, leaving `useRoute()`/`useRouter()` in the
 * descendants unbound and silently swallowing navigation.
 *
 * `hostContext` is provided via `provide(...)` in `main.ts → mount()`
 * so descendants (`MemoryEditor`, the pages) can inject it without
 * prop-drilling.
 */

const props = defineProps<{
    hostContext: import('./shims').PluginHostContext
}>()

defineExpose({ hostContext: props.hostContext })
</script>

<template>
    <div id="spora-plugin-memories">
        <MemoriesPage />
    </div>
</template>