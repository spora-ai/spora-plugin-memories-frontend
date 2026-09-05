<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import type { MemoryResource, MemoryType } from '../types'

/**
 * DocumentsPanel — the documents sidebar for the unified memories page.
 *
 * Renders a single list of documents for whatever scope the page is
 * currently in (`global` or `agent`). The type filter chips live above
 * the list because they filter this list — placing them at the top of
 * the sidebar keeps them adjacent to the rows they affect.
 *
 * `All` is the default selected chip (no type filter active). Clicking
 * a specific chip filters to that type; clicking it again clears the
 * filter, mirroring the GitHub / Linear chip-toggle idiom.
 *
 * Drag-to-reorder is delegated to `vue-draggable-plus`; on drop the
 * panel emits `reorder` with the new id list and the page forwards it
 * into `useMemoriesStore().reorderGlobalMemories` /
 * `reorderAgentMemories` based on the active scope.
 */

const TYPES: ReadonlyArray<{ value: MemoryType; label: string }> = [
    { value: 'plan', label: 'Plans' },
    { value: 'documentation', label: 'Docs' },
    { value: 'examples', label: 'Examples' },
    { value: 'context', label: 'Context' },
]

const TYPE_BADGE_LABEL: Readonly<Record<MemoryType, string>> = {
    plan: 'Plan',
    documentation: 'Doc',
    examples: 'Ex.',
    context: 'Ctx',
}

const TYPE_ICON_PATH: Readonly<Record<MemoryType, string>> = {
    plan: 'M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z',
    documentation: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
    examples: 'M7 8h10 M7 12h6 M9 16l-2 4 4-2 2 2 4-2-2-4 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    context: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
}

const props = defineProps<{
    documents: MemoryResource[]
    typeFilter: MemoryType | null
    activeMemoryId: string | null
    loading: boolean
    mode: 'global' | 'agent'
}>()

const emit = defineEmits<{
    'select-type': [type: MemoryType | null]
    'select-document': [id: string]
    'reorder': [orderedIds: string[]]
    'new': []
}>()

const totalCount = computed(() => props.documents.length)
const isFiltered = computed(() => props.typeFilter !== null)

const localDocs = computed<MemoryResource[]>({
    get: () => props.documents,
    set: (next) => {
        emit('reorder', next.map((m) => m.id))
    },
})

function chipClass(value: MemoryType | null): string {
    const active = props.typeFilter === value
    return [
        'inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border transition-colors',
        active
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-primary',
    ].join(' ')
}

function onChipClick(value: MemoryType | null): void {
    // Toggle behaviour lives here, not in the page — the page holds
    // the active filter as a ref, but the panel already knows
    // `props.typeFilter` so it can decide whether this click is
    // "set to {value}" or "clear the active filter". The page treats
    // a `null` payload as a clear.
    const next = props.typeFilter === value ? null : value
    emit('select-type', next)
}
</script>

<template>
    <aside
        class="flex h-full flex-col rounded-xl border border-border bg-card"
        :data-mode="mode"
    >
        <div class="flex items-center justify-between border-b border-border px-3 py-2">
            <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Documents</span>
            <span class="text-xs text-muted-foreground">
                {{ totalCount }}{{ isFiltered ? ` · ${props.typeFilter}` : '' }}
            </span>
        </div>

        <div class="flex flex-wrap gap-1.5 border-b border-border bg-muted/20 px-3 py-2">
            <button
                type="button"
                :class="chipClass(null)"
                :aria-pressed="typeFilter === null"
                data-type="all"
                @click="onChipClick(null)"
            >
                All
            </button>
            <button
                v-for="t in TYPES"
                :key="t.value"
                type="button"
                :class="chipClass(t.value)"
                :aria-pressed="typeFilter === t.value"
                :data-type="t.value"
                @click="onChipClick(t.value)"
            >
                {{ t.label }}
            </button>
        </div>

        <div class="flex-1 overflow-y-auto">
            <div v-if="loading" class="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</div>
            <div
                v-else-if="totalCount === 0"
                class="px-3 py-6 text-center text-sm text-muted-foreground"
                data-test="documents-empty"
            >
                <p>{{ isFiltered ? 'No documents match this type.' : 'No documents yet.' }}</p>
            </div>
            <VueDraggable
                v-else
                v-model="localDocs"
                item-key="id"
                class="divide-y divide-border"
                :animation="180"
                ghost-class="bg-muted/40"
                handle=".drag-handle"
                @end="emit('reorder', localDocs.map((m) => m.id))"
            >
                <button
                    v-for="memory in localDocs"
                    :key="memory.id"
                    type="button"
                    class="group flex w-full items-start gap-2 border-l-2 px-3 py-2.5 text-left transition-colors"
                    :class="activeMemoryId === memory.id
                        ? 'border-primary bg-muted/40'
                        : 'border-transparent hover:bg-muted/40'"
                    :data-memory-id="memory.id"
                    @click="emit('select-document', memory.id)"
                >
                    <svg
                        class="drag-handle mt-1 h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="9" cy="6" r="1" />
                        <circle cx="9" cy="12" r="1" />
                        <circle cx="9" cy="18" r="1" />
                        <circle cx="15" cy="6" r="1" />
                        <circle cx="15" cy="12" r="1" />
                        <circle cx="15" cy="18" r="1" />
                    </svg>
                    <svg
                        class="mt-0.5 h-4 w-4 shrink-0"
                        :class="activeMemoryId === memory.id ? 'text-primary' : 'text-muted-foreground'"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        :data-type-icon="memory.type"
                    >
                        <path :d="TYPE_ICON_PATH[memory.type]" />
                    </svg>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            <span class="truncate text-sm font-medium">{{ memory.name }}</span>
                            <span class="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                {{ TYPE_BADGE_LABEL[memory.type] }}
                            </span>
                        </div>
                        <p v-if="memory.summary" class="mt-0.5 truncate text-xs text-muted-foreground">
                            {{ memory.summary }}
                        </p>
                    </div>
                </button>
            </VueDraggable>
        </div>

        <button
            type="button"
            class="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            data-test="new-document"
            @click="emit('new')"
        >
            <Plus class="h-3.5 w-3.5" />
            New document
        </button>
    </aside>
</template>
