<script setup lang="ts">
import MemoriesPage from './pages/MemoriesPage.vue'
import './style.css'

/**
 * Entry component.
 *
 * The plugin-local router (created with `createMemoryHistory` so URLs
 * stay in JavaScript rather than the browser address bar) is built and
 * installed in `main.ts → mount()` and mirrored in `dev-main.ts` for the
 * dev sandbox. This file deliberately creates no router of its own: a
 * second `createRouter()` here would never be `app.use()`'d, leaving
 * `useRoute()`/`useRouter()` in the descendants unbound and silently
 * swallowing navigation.
 *
 * `hostContext` is provided via `provide(...)` in `main.ts → mount()`
 * so descendants can inject it without prop-drilling.
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