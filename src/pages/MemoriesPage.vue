<script setup lang="ts">
/**
 * MemoriesPage — root shell for the plugin's `/apps/memories` route tree.
 *
 * Plug-side equivalent of `spora-frontend/src/apps/memories/pages/MemoriesPage.vue`.
 *
 * Differs from the host in two places:
 *   - The `<GlobalNavbar />` line is dropped. The host's `PluginAppPage.vue`
 *     already renders the top navbar; mounting a second one inside the
 *     slot would render a doubled bar.
 *   - The host's `<Icon name="menu">` is replaced with a direct
 *     lucide-vue-next `Menu` import.
 *
 * Everything else — the mobile overlay + desktop sidebar layout, the
 * mobile toggle button, the `<RouterView>` for sub-routes — is the
 * same so the sidebar's specs in the plugin can reach into identical
 * DOM data attributes.
 */
import { ref } from 'vue'
import { Brain, Menu } from 'lucide-vue-next'
import MemorySidebar from '../components/MemorySidebar.vue'

const sidebarOpen = ref(false)
</script>

<template>
    <div class="h-screen bg-background flex flex-col overflow-hidden">
        <div class="flex-1 flex">
            <!-- Mobile sidebar overlay -->
            <div
                v-if="sidebarOpen"
                class="fixed inset-0 z-40 md:hidden"
                @click="sidebarOpen = false"
            >
                <div class="absolute inset-0 bg-black/50" />
                <MemorySidebar
                    mobile-open
                    class="absolute left-0 top-0 h-full bg-background"
                    @close="sidebarOpen = false"
                />
            </div>

            <!-- Desktop sidebar -->
            <MemorySidebar class="hidden md:flex" />

            <!-- Main content -->
            <main class="flex-1 w-full overflow-y-auto">
                <!-- Mobile sidebar toggle + app header -->
                <div class="flex items-center gap-3 px-4 py-3 border-b border-border md:hidden">
                    <button
                        class="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Show memories menu"
                        type="button"
                        @click="sidebarOpen = true"
                    >
                        <Menu class="w-4 h-4" />
                    </button>
                    <div class="flex items-center gap-2">
                        <Brain class="w-5 h-5 text-primary" />
                        <span class="font-semibold text-sm">Memories</span>
                    </div>
                </div>

                <!-- Page content -->
                <div class="px-4 py-8">
                    <RouterView />
                </div>
            </main>
        </div>
    </div>
</template>
