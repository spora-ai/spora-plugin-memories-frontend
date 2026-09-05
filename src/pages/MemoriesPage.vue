<script setup lang="ts">
import { computed, inject, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Brain, Globe, Bot, ChevronDown, Plus, Menu, X } from 'lucide-vue-next'
import PrincipalChipRow from '../components/PrincipalChipRow.vue'
import DocumentsPanel from '../components/DocumentsPanel.vue'
import MemoryEditor from '../components/MemoryEditor.vue'
import AlertBanner from '../components/AlertBanner.vue'
import { useMemoriesStore } from '../stores/memories'
import { useAgents } from '../composables/useAgents'
import { usePrincipalsStore } from '../stores/principals'
import type {
    MemoryResource,
    MemoryType,
    CreateMemoryDto,
    UpdateMemoryDto,
} from '../types'
import { HOST_CONTEXT_KEY, type PluginHostContext } from '../shims'

/**
 * MemoriesPage — the unified memories UI.
 *
 * Structure (top → bottom):
 *   1. **Scope bar** — `PrincipalChipRow` lets the operator pick which
 *      principal's memories to view.
 *   2. **Mode row** — segmented `Global` / `Agent: <name>` control +
 *      a global `New` button.
 *   3. **2-column body** — `DocumentsPanel` (with `All` default
 *      type-filter chips that live with the list they filter) and a
 *      `MemoryEditor` pane. The editor swaps to a "pick a document or
 *      create one" empty state when no document is selected.
 *
 * The two routes (`global-memories` and `agent-memories/:id`) both
 * resolve to this component; mode is derived from `route.name`, the
 * active agent from `route.params.id`, and the active memory from
 * `?memory=<id>` or `?create=1`. Sidebar-internal navigation
 * (`MemorySidebar`) is gone — its pieces (type chips, memory list,
 * principal chip row, agent dropdown) are now here and in
 * `DocumentsPanel`.
 *
 * Diff from host `pages/MemoriesPage.vue`: this plugin renders an
 * inline `Brain` button for mobile menu instead of the host's
 * `<Icon name="menu">`, since plugins don't share the host's icon
 * registry.
 */
const route = useRoute()
const router = useRouter()
const store = useMemoriesStore()
const principalsStore = usePrincipalsStore()
const { agents, fetchAgents } = useAgents()
const hostContext = inject<PluginHostContext>(HOST_CONTEXT_KEY)

const sidebarOpen = ref(false)
const showAgentDropdown = ref(false)
const selectedType = ref<MemoryType | null>(null)

const isAgentMode = computed(() => route.name === 'agent-memories')
const agentId = computed(() => Number(route.params.id))
const validAgentId = computed(() => (Number.isNaN(agentId.value) ? null : agentId.value))

const selectedMemory = ref<MemoryResource | null>(null)
const showCreateForm = computed(() => route.query.create === '1')

function pushRouteWithQuery(query: Record<string, string>): void {
    if (isAgentMode.value && validAgentId.value !== null) {
        void router.push({ name: 'agent-memories', params: { id: String(validAgentId.value) }, query })
    } else {
        void router.push({ name: 'global-memories', query })
    }
}

function loadActiveList(type: MemoryType | null): void {
    if (isAgentMode.value) {
        if (validAgentId.value === null) return
        void store.loadAgentMemories(validAgentId.value, type ?? undefined)
        return
    }
    void store.loadGlobalMemories(type ?? undefined)
}

function selectTypeFilter(type: MemoryType | null): void {
    selectedType.value = selectedType.value === type ? null : type
    loadActiveList(selectedType.value)
}

function selectGlobalMode(): void {
    showAgentDropdown.value = false
    void router.push({ name: 'global-memories' })
}

function selectAgent(targetAgentId: number): void {
    showAgentDropdown.value = false
    void router.push({ name: 'agent-memories', params: { id: String(targetAgentId) } })
}

function handleAgentButtonClick(): void {
    if (isAgentMode.value) {
        showAgentDropdown.value = !showAgentDropdown.value
        return
    }
    const first = agents.value[0]
    if (first) selectAgent(first.id)
}

const selectedAgent = computed(() => {
    if (validAgentId.value === null) return null
    return agents.value.find((a) => a.id === validAgentId.value) ?? null
})

const activeList = computed<MemoryResource[]>(() =>
    isAgentMode.value ? store.agentMemories : store.globalMemories,
)
const activeLoading = computed(() =>
    isAgentMode.value ? store.loadingAgent : store.loadingGlobal,
)

function syncSelectionFromRoute(): void {
    const memoryParam = route.query.memory
    if (!memoryParam) {
        selectedMemory.value = null
        return
    }
    selectedMemory.value = activeList.value.find((m) => m.id === memoryParam) ?? null
}

function selectDocument(id: string): void {
    pushRouteWithQuery({ memory: id })
}

function startCreate(): void {
    pushRouteWithQuery({ create: '1' })
}

function handleReorder(orderedIds: string[]): void {
    if (isAgentMode.value && validAgentId.value !== null) {
        void store.reorderAgentMemories(validAgentId.value, orderedIds)
    } else {
        void store.reorderGlobalMemories(orderedIds)
    }
}

async function handleSave(data: CreateMemoryDto | UpdateMemoryDto): Promise<void> {
    const isAgent = isAgentMode.value && validAgentId.value !== null
    if (selectedMemory.value) {
        const updated = isAgent
            ? await store.updateAgentMemory(validAgentId.value as number, selectedMemory.value.id, data as UpdateMemoryDto)
            : await store.updateGlobalMemory(selectedMemory.value.id, data as UpdateMemoryDto)
        selectedMemory.value = updated
        pushRouteWithQuery({ memory: updated.id })
        return
    }
    const created = isAgent
        ? await store.createAgentMemory(validAgentId.value as number, data as CreateMemoryDto)
        : await store.createGlobalMemory(data as CreateMemoryDto)
    selectedMemory.value = created
    pushRouteWithQuery({ memory: created.id })
}

async function handleDelete(): Promise<void> {
    if (!selectedMemory.value) return
    const isAgent = isAgentMode.value && validAgentId.value !== null
    if (isAgent) {
        await store.deleteAgentMemory(validAgentId.value as number, selectedMemory.value.id)
    } else {
        await store.deleteGlobalMemory(selectedMemory.value.id)
    }
    selectedMemory.value = null
    pushRouteWithQuery({})
}

function handleCancel(): void {
    selectedMemory.value = null
    pushRouteWithQuery({})
}

watch(
    () => [route.name, route.params.id, route.query.memory, activeList.value],
    () => syncSelectionFromRoute(),
    { immediate: true, deep: true },
)

watch(
    () => [route.name, route.params.id],
    async ([newName], [prevName]) => {
        if (newName === prevName) return
        selectedType.value = null
        await fetchAgents()
        loadActiveList(null)
    },
)

onMounted(async () => {
    if (principalsStore.principals.length === 0) {
        await principalsStore.loadPrincipals()
    }
    await fetchAgents()
    if (isAgentMode.value && validAgentId.value !== null) {
        await store.loadAgentMemories(validAgentId.value)
    } else if (!isAgentMode.value) {
        await store.loadGlobalMemories()
    }
})

watch(() => principalsStore.selectedPrincipalId, () => {
    if (!isAgentMode.value) {
        void store.loadGlobalMemories(selectedType.value ?? undefined)
    }
})
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
                <dialog
                    open
                    class="absolute left-0 top-0 m-0 h-full w-72 border-r border-border bg-background p-3 backdrop:bg-transparent"
                    aria-label="Documents sidebar"
                >
                    <div class="mb-2 flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <Brain class="h-5 w-5 text-primary" />
                            <span class="font-semibold text-sm">Memories</span>
                        </div>
                        <button
                            type="button"
                            class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            @click="sidebarOpen = false"
                        >
                            <X class="h-4 w-4" />
                        </button>
                    </div>
                    <DocumentsPanel
                        :documents="activeList"
                        :type-filter="selectedType"
                        :active-memory-id="selectedMemory?.id ?? null"
                        :loading="activeLoading"
                        :mode="isAgentMode ? 'agent' : 'global'"
                        @select-type="selectTypeFilter"
                        @select-document="selectDocument"
                        @reorder="handleReorder"
                        @new="startCreate"
                    />
                </dialog>
            </div>

            <!-- Main column -->
            <main class="flex-1 w-full overflow-y-auto">
                <!-- Mobile sidebar toggle + app header -->
                <div class="flex items-center gap-3 px-4 py-3 border-b border-border md:hidden">
                    <button
                        type="button"
                        class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Show documents"
                        @click="sidebarOpen = true"
                    >
                        <Menu class="h-4 w-4" />
                    </button>
                    <div class="flex items-center gap-2">
                        <Brain class="h-5 w-5 text-primary" />
                        <span class="font-semibold text-sm">Memories</span>
                    </div>
                </div>

                <div class="mx-auto max-w-6xl space-y-4 px-4 py-6 md:px-6">
                    <!-- (1) Scope bar -->
                    <div class="flex flex-wrap items-center gap-2">
                        <PrincipalChipRow />
                    </div>

                    <!-- (2) Mode row -->
                    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                        <nav class="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
                            <button
                                type="button"
                                class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors"
                                :class="!isAgentMode
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'"
                                data-test="mode-global"
                                @click="selectGlobalMode"
                            >
                                <Globe class="h-3.5 w-3.5" />
                                Global
                            </button>
                            <div class="relative">
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors"
                                    :class="isAgentMode
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'"
                                    data-test="mode-agent"
                                    @click="handleAgentButtonClick"
                                >
                                    <Bot class="h-3.5 w-3.5" />
                                    <span>Agent: {{ selectedAgent?.name ?? agents[0]?.name ?? 'Select' }}</span>
                                    <ChevronDown class="h-3 w-3 opacity-60" />
                                </button>
                                <div
                                    v-if="isAgentMode && showAgentDropdown"
                                    class="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border border-border bg-background shadow-md"
                                    data-test="agent-dropdown"
                                >
                                    <button
                                        v-for="agent in agents"
                                        :key="agent.id"
                                        type="button"
                                        class="flex w-full items-center gap-2 px-2.5 py-2 text-xs transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-muted"
                                        :class="agent.id === validAgentId ? 'bg-muted' : ''"
                                        @click="selectAgent(agent.id)"
                                    >
                                        <Bot class="h-3.5 w-3.5 text-muted-foreground" />
                                        {{ agent.name }}
                                    </button>
                                </div>
                            </div>
                        </nav>
                        <button
                            type="button"
                            class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
                            data-test="new-memory"
                            @click="startCreate"
                        >
                            <Plus class="h-3.5 w-3.5" />
                            New
                        </button>
                    </div>

                    <!-- Error -->
                    <AlertBanner
                        v-if="store.error"
                        type="error"
                        :message="store.error"
                    />

                    <!-- (3) Body: documents + editor -->
                    <div class="grid grid-cols-1 gap-4 md:grid-cols-[16rem_1fr]">
                        <div class="hidden md:block" style="height: 70vh;">
                            <DocumentsPanel
                                :documents="activeList"
                                :type-filter="selectedType"
                                :active-memory-id="selectedMemory?.id ?? null"
                                :loading="activeLoading"
                                :mode="isAgentMode ? 'agent' : 'global'"
                                @select-type="selectTypeFilter"
                                @select-document="selectDocument"
                                @reorder="handleReorder"
                                @new="startCreate"
                            />
                        </div>

                        <section
                            class="rounded-xl border border-border bg-card"
                            data-test="editor-pane"
                        >
                            <div
                                v-if="selectedMemory"
                                class="p-5"
                                data-test="editor-view-edit"
                            >
                                <MemoryEditor
                                    :memory="selectedMemory"
                                    :saving="store.saving"
                                    :host-context="hostContext"
                                    :scope="isAgentMode ? 'agent' : 'global'"
                                    :agent-name="selectedAgent?.name"
                                    @save="handleSave"
                                    @delete="handleDelete"
                                    @cancel="handleCancel"
                                />
                            </div>
                            <div
                                v-else-if="showCreateForm"
                                class="p-5"
                                data-test="editor-view-create"
                            >
                                <MemoryEditor
                                    :saving="store.saving"
                                    :host-context="hostContext"
                                    :scope="isAgentMode ? 'agent' : 'global'"
                                    :agent-name="selectedAgent?.name"
                                    @save="handleSave"
                                    @cancel="handleCancel"
                                />
                            </div>
                            <div
                                v-else
                                class="flex min-h-[18rem] flex-col items-center justify-center gap-2 p-10 text-center"
                                data-test="editor-empty"
                            >
                                <Brain class="h-8 w-8 text-muted-foreground" />
                                <p class="text-sm text-muted-foreground">
                                    Pick a document on the left, or create a new one.
                                </p>
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
                                    @click="startCreate"
                                >
                                    <Plus class="h-3.5 w-3.5" />
                                    New
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    </div>
</template>
