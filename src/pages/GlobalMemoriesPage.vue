<script setup lang="ts">
import { inject, ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { useMemoriesStore } from '../stores/memories'
import { usePrincipalsStore } from '../stores/principals'
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
 * GlobalMemoriesPage — global memory CRUD with drag-to-reorder,
 * type-filter chips, and a per-scope principal scope selector that
 * lives in the sidebar.
 *
 * Plug-side equivalent of the host's `pages/GlobalMemoriesPage.vue`.
 * Diff from the host: `@/components/ui/AlertBanner.vue` is replaced
 * by the plugin-local `components/AlertBanner.vue`. The principal
 * selector itself lives in the sidebar (PrincipalChipRow), so this
 * page only filters by `type` and forwards it into the store action.
 */
const route = useRoute()
const router = useRouter()
const store = useMemoriesStore()
const principalsStore = usePrincipalsStore()
const hostContext = inject<PluginHostContext>(HOST_CONTEXT_KEY)

const TYPES: ReadonlyArray<{ value: MemoryType; label: string }> = [
    { value: 'plan', label: 'Plans' },
    { value: 'documentation', label: 'Docs' },
    { value: 'examples', label: 'Examples' },
    { value: 'context', label: 'Context' },
]

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
        const found = store.globalMemories.find((m) => m.id === memoryId)
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
    if (principalsStore.principals.length === 0) {
        await principalsStore.loadPrincipals()
    }
    await store.loadGlobalMemories()
    applyQueryParams()
})

watch(() => [route.query.create, route.query.memory], applyQueryParams)
watch(() => principalsStore.selectedPrincipalId, () => {
    void store.loadGlobalMemories(selectedType.value ?? undefined)
})

function selectType(type: MemoryType | null): void {
    selectedType.value = type
    void store.loadGlobalMemories(type ?? undefined)
}

async function handleSave(data: CreateMemoryDto | UpdateMemoryDto): Promise<void> {
    if (viewMode.value === 'edit' && selectedMemory.value) {
        const updated = await store.updateGlobalMemory(selectedMemory.value.id, data as UpdateMemoryDto)
        selectedMemory.value = updated
        router.replace({ name: 'global-memories', query: { memory: updated.id } })
    } else {
        const created = await store.createGlobalMemory(data as CreateMemoryDto)
        selectedMemory.value = created
        viewMode.value = 'edit'
        router.replace({ name: 'global-memories', query: { memory: created.id } })
    }
}

async function handleReplace(data: ReplaceMemoryDto): Promise<void> {
    if (!selectedMemory.value) return
    const updated = await store.replaceGlobalMemory(selectedMemory.value.id, data)
    selectedMemory.value = updated
    router.replace({ name: 'global-memories', query: { memory: updated.id } })
}

async function handleDelete(): Promise<void> {
    if (!selectedMemory.value) return
    await store.deleteGlobalMemory(selectedMemory.value.id)
    handleCancel()
}

function handleCancel(): void {
    selectedMemory.value = null
    viewMode.value = 'list'
    router.replace({ name: 'global-memories' })
}

async function handleDragEnd(): Promise<void> {
    const orderedIds = store.globalMemories.map((m) => m.id)
    await store.reorderGlobalMemories(orderedIds)
}

const headerLabel = computed(() => {
    const principal = principalsStore.currentPrincipal
    if (!principal) return 'Global Memories'
    if (principal.type === 'user') {
        return principal.name.startsWith('User #') ? 'My Memories' : `${principal.name} Memories`
    }
    return `${principal.name} Memories`
})
</script>

<template>
    <div class="flex-1 flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold">{{ headerLabel }}</h1>
                <p class="text-sm text-muted-foreground mt-1">Persistent memories shared across all your agents.</p>
            </div>
        </div>

        <!-- Type filter chips (global only — sidebar carries the principal chip row) -->
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

        <!-- Error -->
        <AlertBanner v-if="store.error" type="error" :message="store.error" class="mb-4" />

        <!-- List view -->
        <template v-if="viewMode === 'list'">
            <div v-if="store.loadingGlobal" class="text-sm text-muted-foreground">Loading…</div>
            <div v-else-if="store.globalMemories.length === 0" class="rounded-xl border border-border bg-card p-8 text-center">
                <p class="text-sm text-muted-foreground mb-4">No global memories yet.</p>
                <button
                    class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                    type="button"
                    @click="router.push({ name: 'global-memories', query: { create: '1' } })"
                >
                    Create your first memory
                </button>
            </div>
            <div v-else class="rounded-xl border border-border bg-card divide-y divide-border">
                <VueDraggable
                    v-model="store.globalMemories"
                    item-key="id"
                    @end="handleDragEnd"
                >
                    <MemoryListItem
                        v-for="memory in store.globalMemories"
                        :key="memory.id"
                        :memory="memory"
                        show-handle
                        @select="router.push({ name: 'global-memories', query: { memory: memory.id } })"
                    />
                </VueDraggable>
            </div>
        </template>

        <!-- Create / Edit -->
        <template v-else>
            <MemoryEditor
                :memory="selectedMemory"
                :saving="store.saving"
                :host-context="hostContext"
                scope="global"
                @save="handleSave"
                @replace="handleReplace"
                @delete="handleDelete"
                @cancel="handleCancel"
            />
        </template>
    </div>
</template>