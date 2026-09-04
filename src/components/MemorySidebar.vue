<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Brain, Globe, Bot, ChevronDown, X, ChevronRight } from 'lucide-vue-next'
import { useMemoriesStore } from '../stores/memories'
import { useAgents } from '../composables/useAgents'
import { usePrincipalsStore } from '../stores/principals'
import PrincipalChipRow from './PrincipalChipRow.vue'
import type { MemoryType } from '../types'

/**
 * MemorySidebar — left navigation for the memories app (global +
 * agent-scoped). Plug-side equivalent of the host's
 * `spora-frontend/src/apps/memories/components/MemorySidebar.vue`.
 *
 * Differs from the host in exactly two places:
 *   - `useAgentStore` is swapped for the plugin-local `useAgents`
 *     composable. The composable fetches `/agents` through
 *     `hostContext.api` (see `composables/useAgents.ts`), keeps a
 *     cached ref so the sidebar sees a stable list, and exposes the
 *     same `{ agents, fetchAgents }` shape.
 *   - A `PrincipalChipRow` is rendered above the global list. When
 *     the operator switches principal, `memoriesStore.loadGlobalMemories()`
 *     is called so the visible list reflects the new principal scope.
 *
 * Everything else — the route-driven header, the agent dropdown, the
 * deep-link query params — is the same.
 */
const route = useRoute()
const router = useRouter()
const memoriesStore = useMemoriesStore()
const principalsStore = usePrincipalsStore()
const { agents, fetchAgents } = useAgents()

defineProps<{
    mobileOpen?: boolean
}>()

const emit = defineEmits<{
    close: []
}>()

const selectedAgentId = ref<number | null>(null)
const showAgentDropdown = ref(false)
const selectedType = ref<MemoryType | null>(null)

const isGlobalRoute = computed(() => route.name === 'global-memories')
const isAgentRoute = computed(() => route.name === 'agent-memories')

const TYPES: ReadonlyArray<{ value: MemoryType; label: string }> = [
    { value: 'plan', label: 'Plans' },
    { value: 'documentation', label: 'Docs' },
    { value: 'examples', label: 'Examples' },
    { value: 'context', label: 'Context' },
]

function selectAgent(agentId: number): void {
    selectedAgentId.value = agentId
    showAgentDropdown.value = false
    void memoriesStore.loadAgentMemories(agentId, selectedType.value ?? undefined)
    router.push({ name: 'agent-memories', params: { id: String(agentId) } })
}

function selectType(type: MemoryType | null): void {
    selectedType.value = type
    if (isGlobalRoute.value) {
        void memoriesStore.loadGlobalMemories(type ?? undefined)
    } else if (selectedAgentId.value !== null) {
        void memoriesStore.loadAgentMemories(selectedAgentId.value, type ?? undefined)
    }
}

watch(
    () => principalsStore.selectedPrincipalId,
    () => {
        if (isGlobalRoute.value) {
            void memoriesStore.loadGlobalMemories(selectedType.value ?? undefined)
        }
    },
)

onMounted(async () => {
    await Promise.all([
        fetchAgents(),
        memoriesStore.loadGlobalMemories(selectedType.value ?? undefined),
    ])

    // Initialize selectedAgentId from URL or default to first agent
    const routeId = Number(route.params.id)
    if (!Number.isNaN(routeId)) {
        selectedAgentId.value = routeId
    } else if (agents.value.length > 0 && selectedAgentId.value === null) {
        selectedAgentId.value = agents.value[0]?.id ?? null
    }

    if (selectedAgentId.value !== null) {
        await memoriesStore.loadAgentMemories(selectedAgentId.value, selectedType.value ?? undefined)
    }
})

const selectedAgentName = computed(() => {
    if (selectedAgentId.value === null) return 'Select agent'
    return agents.value.find((a) => a.id === selectedAgentId.value)?.name ?? 'Unknown'
})

function navigateToMemory(memoryId: string): void {
    router.push({
        name: 'agent-memories',
        params: { id: String(selectedAgentId.value ?? '') },
        query: { memory: memoryId },
    })
}
</script>

<template>
    <aside class="w-64 flex-shrink-0 flex flex-col border-r border-border bg-card h-full">
        <!-- App header -->
        <div class="px-4 py-4 border-b border-border flex items-center justify-between">
            <div class="flex items-center gap-2">
                <Brain class="w-5 h-5 text-primary" />
                <span class="font-semibold text-sm">Memories</span>
            </div>
            <button
                v-if="mobileOpen"
                class="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                type="button"
                @click="emit('close')"
            >
                <X class="w-4 h-4" />
            </button>
        </div>

        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto">
            <!-- Global Memories -->
            <div class="px-3 py-3">
                <div class="flex items-center justify-between mb-2">
                    <button
                        class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                        :class="isGlobalRoute ? 'text-primary' : ''"
                        type="button"
                        @click="router.push({ name: 'global-memories' })"
                    >
                        <Globe class="w-3.5 h-3.5" />
                        Global
                    </button>
                    <button
                        class="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        type="button"
                        @click="router.push({ name: 'global-memories' })"
                    >
                        View all
                        <ChevronRight class="w-3 h-3" />
                    </button>
                </div>

                <div class="mb-2">
                    <PrincipalChipRow />
                </div>

                <div class="flex flex-wrap gap-1 mb-2">
                    <button
                        v-for="t in TYPES"
                        :key="t.value"
                        type="button"
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors"
                        :class="selectedType === t.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-primary'"
                        @click="selectType(selectedType === t.value ? null : t.value)"
                    >
                        {{ t.label }}
                    </button>
                </div>

                <div v-if="memoriesStore.globalMemories.length === 0" class="text-xs text-muted-foreground py-1">
                    No global memories.
                </div>
                <ul v-else class="space-y-0.5">
                    <li
                        v-for="memory in memoriesStore.globalMemories.slice(0, 5)"
                        :key="memory.id"
                        class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 cursor-pointer transition-colors"
                        :class="route.query.memory === memory.id ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'"
                        @click="router.push({ name: 'global-memories', query: { memory: memory.id } })"
                    >
                        <span class="truncate flex-1 text-xs">{{ memory.name }}</span>
                    </li>
                </ul>

                <button
                    class="w-full flex items-center gap-2 h-7 px-2 mt-1 rounded-md border border-dashed border-border text-muted-foreground text-xs hover:bg-muted transition-colors"
                    type="button"
                    @click="router.push({ name: 'global-memories', query: { create: '1' } })"
                >
                    <span class="w-3 text-center">+</span>
                    <span class="truncate">New</span>
                </button>
            </div>

            <div class="border-t border-border mx-3" />

            <!-- Agent Memories -->
            <div class="px-3 py-3">
                <div class="flex items-center justify-between mb-2">
                    <button
                        class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                        :class="isAgentRoute ? 'text-primary' : ''"
                        type="button"
                        @click="selectedAgentId !== null && router.push({ name: 'agent-memories', params: { id: String(selectedAgentId) } })"
                    >
                        <Bot class="w-3.5 h-3.5" />
                        Agent
                    </button>
                    <button
                        v-if="selectedAgentId !== null"
                        class="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        type="button"
                        @click="router.push({ name: 'agent-memories', params: { id: String(selectedAgentId) } })"
                    >
                        View all
                        <ChevronRight class="w-3 h-3" />
                    </button>
                </div>

                <!-- Agent selector -->
                <div class="relative mb-2">
                    <button
                        class="w-full flex items-center justify-between h-8 px-2.5 rounded-lg border border-input bg-background text-xs hover:bg-muted transition-colors"
                        type="button"
                        @click="showAgentDropdown = !showAgentDropdown"
                    >
                        <span class="truncate flex items-center gap-1.5">
                            <Bot class="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            <span class="truncate text-muted-foreground">{{ selectedAgentName }}</span>
                        </span>
                        <ChevronDown class="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    </button>
                    <div
                        v-if="showAgentDropdown"
                        class="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-background shadow-md z-10"
                    >
                        <button
                            v-for="agent in agents"
                            :key="agent.id"
                            class="w-full flex items-center gap-2 px-2.5 py-2 text-xs hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg"
                            :class="agent.id === selectedAgentId ? 'bg-muted' : ''"
                            type="button"
                            @click="selectAgent(agent.id)"
                        >
                            <Bot class="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            {{ agent.name }}
                        </button>
                    </div>
                </div>

                <div class="flex flex-wrap gap-1 mb-2">
                    <button
                        v-for="t in TYPES"
                        :key="t.value"
                        type="button"
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors"
                        :class="selectedType === t.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-primary'"
                        @click="selectType(selectedType === t.value ? null : t.value)"
                    >
                        {{ t.label }}
                    </button>
                </div>

                <div v-if="selectedAgentId === null" class="text-xs text-muted-foreground py-1">
                    Select an agent.
                </div>
                <div v-else-if="memoriesStore.agentMemories.length === 0" class="text-xs text-muted-foreground py-1">
                    No memories for this agent.
                </div>
                <ul v-else class="space-y-0.5">
                    <li
                        v-for="memory in memoriesStore.agentMemories.slice(0, 5)"
                        :key="memory.id"
                        class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 cursor-pointer transition-colors"
                        :class="route.query.memory === memory.id ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'"
                        @click="navigateToMemory(memory.id)"
                    >
                        <span class="truncate flex-1 text-xs">{{ memory.name }}</span>
                    </li>
                </ul>

                <button
                    class="w-full flex items-center gap-2 h-7 px-2 mt-1 rounded-md border border-dashed border-border text-muted-foreground text-xs hover:bg-muted transition-colors"
                    type="button"
                    @click="router.push({ name: 'agent-memories', params: { id: String(selectedAgentId ?? '') }, query: { create: '1' } })"
                >
                    <span class="w-3 text-center">+</span>
                    <span class="truncate">New</span>
                </button>
            </div>
        </div>
    </aside>
</template>