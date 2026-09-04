<script setup lang="ts">
import { inject, ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { useMemoriesStore } from '../stores/memories'
import { useAgents } from '../composables/useAgents'
import MemoryListItem from '../components/MemoryListItem.vue'
import MemoryEditor from '../components/MemoryEditor.vue'
import AlertBanner from '../components/AlertBanner.vue'
import type {
    MemoryResource,
    MemoryType,
    CreateMemoryDto,
    UpdateMemoryDto,
    ReplaceMemoryDto,
} from '../types'
import { HOST_CONTEXT_KEY, type PluginHostContext } from '../shims'

/**
 * AgentMemoriesPage — agent-scoped memory CRUD with type-filter chips.
 *
 * Plug-side equivalent of `spora-frontend/src/apps/memories/pages/AgentMemoriesPage.vue`.
 *
 * Diff from the host:
 *   - `useAgentStore` is replaced by the plugin-local `useAgents`
 *     composable (see `composables/useAgents.ts`). Same shape
 *     (`{ agents, fetchAgents }`), same fields, just reachable via a
 *     fetch-through-`hostContext.api` singleton.
 *   - `@/components/ui/AlertBanner.vue` becomes the plugin-local
 *     `components/AlertBanner.vue`.
 *   - Memories stay scoped to the *agent*; the principal selector
 *     is intentionally not rendered here. Agent-transfer semantics
 *     guarantee the memory row follows the agent, not its principal.
 */
const route = useRoute()
const router = useRouter()
const store = useMemoriesStore()
const { agents, fetchAgents } = useAgents()
const hostContext = inject<PluginHostContext>(HOST_CONTEXT_KEY)

const TYPES: ReadonlyArray<{ value: MemoryType; label: string }> = [
    { value: 'plan', label: 'Plans' },
    { value: 'documentation', label: 'Docs' },
    { value: 'examples', label: 'Examples' },
    { value: 'context', label: 'Context' },
]

const agentId = computed(() => Number(route.params.id))
const agentName = computed(() => agents.value.find((a) => a.id === agentId.value)?.name)
type ViewMode = 'list' | 'create' | 'edit'
const viewMode = ref<ViewMode>('list')
const selectedMemory = ref<MemoryResource | null>(null)
const selectedType = ref<MemoryType | null>(null)

function applyQueryParams(): void {
    const createParam = route.query.create
    const memoryParam = route.query.memory

    if (createParam === '1') {
        viewMode.value = 'create'
        selectedMemory.value = null
    } else if (memoryParam) {
        const memoryId = String(memoryParam)
        const found = store.agentMemories.find((m) => m.id === memoryId)
        if (found) {
            selectedMemory.value = found
            viewMode.value = 'edit'
        }
    } else {
        viewMode.value = 'list'
        selectedMemory.value = null
    }
}

onMounted(async () => {
    const validAgentId = Number.isNaN(agentId.value) ? null : agentId.value
    await Promise.all([
        fetchAgents(),
        validAgentId === null ? Promise.resolve() : store.loadAgentMemories(validAgentId, selectedType.value ?? undefined),
    ])
    applyQueryParams()
})

watch(() => [route.query.create, route.query.memory], applyQueryParams)

function selectType(type: MemoryType | null): void {
    selectedType.value = type
    if (!Number.isNaN(agentId.value)) {
        void store.loadAgentMemories(agentId.value, type ?? undefined)
    }
}

async function handleSave(data: CreateMemoryDto | UpdateMemoryDto): Promise<void> {
    if (viewMode.value === 'edit' && selectedMemory.value) {
        const updated = await store.updateAgentMemory(agentId.value, selectedMemory.value.id, data as UpdateMemoryDto)
        selectedMemory.value = updated
        router.replace({ query: { memory: updated.id } })
    } else {
        const created = await store.createAgentMemory(agentId.value, data as CreateMemoryDto)
        selectedMemory.value = created
        viewMode.value = 'edit'
        router.replace({ query: { memory: created.id } })
    }
}

async function handleReplace(data: ReplaceMemoryDto): Promise<void> {
    if (!selectedMemory.value) return
    const updated = await store.replaceAgentMemory(agentId.value, selectedMemory.value.id, data)
    selectedMemory.value = updated
    router.replace({ query: { memory: updated.id } })
}

async function handleDelete(): Promise<void> {
    if (!selectedMemory.value) return
    await store.deleteAgentMemory(agentId.value, selectedMemory.value.id)
    handleCancel()
}

function handleCancel(): void {
    selectedMemory.value = null
    viewMode.value = 'list'
    router.replace({ query: {} })
}

async function handleDragEnd(): Promise<void> {
    const orderedIds = store.agentMemories.map((m) => m.id)
    await store.reorderAgentMemories(agentId.value, orderedIds)
}
</script>

<template>
    <div class="flex-1 flex flex-col">
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold">Agent Memories</h1>
                <p class="text-sm text-muted-foreground mt-1">Persistent memories scoped to this agent.</p>
            </div>
        </div>

        <div v-if="viewMode === 'list'" class="flex flex-wrap gap-1.5 mb-4">
            <button
                v-for="t in TYPES"
                :key="t.value"
                type="button"
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                :class="selectedType === t.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-primary'"
                @click="selectType(selectedType === t.value ? null : t.value)"
            >
                {{ t.label }}
            </button>
        </div>

        <AlertBanner v-if="store.error" type="error" :message="store.error" class="mb-4" />

        <template v-if="viewMode === 'list'">
            <div v-if="store.loadingAgent" class="text-sm text-muted-foreground">Loading…</div>
            <div v-else-if="store.agentMemories.length === 0" class="rounded-xl border border-border bg-card p-8 text-center">
                <p class="text-sm text-muted-foreground mb-4">No agent memories yet.</p>
                <button
                    class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                    type="button"
                    @click="router.push({ query: { create: '1' } })"
                >
                    Create your first memory
                </button>
            </div>
            <div v-else class="rounded-xl border border-border bg-card divide-y divide-border">
                <VueDraggable
                    v-model="store.agentMemories"
                    item-key="id"
                    @end="handleDragEnd"
                >
                    <MemoryListItem
                        v-for="memory in store.agentMemories"
                        :key="memory.id"
                        :memory="memory"
                        show-handle
                        @select="router.push({ query: { memory: memory.id } })"
                    />
                </VueDraggable>
            </div>
        </template>

        <template v-else>
            <MemoryEditor
                :memory="selectedMemory"
                :saving="store.saving"
                :host-context="hostContext"
                scope="agent"
                :agent-name="agentName"
                @save="handleSave"
                @replace="handleReplace"
                @delete="handleDelete"
                @cancel="handleCancel"
            />
        </template>
    </div>
</template>