<script setup lang="ts">
import { ref, computed, useId, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import type { MemoryResource, CreateMemoryDto, UpdateMemoryDto } from '../types'

/**
 * Memory editor — used by both Global and Agent memories to create or
 * edit a memory.
 *
 * Differs from the host-side `spora-frontend/src/apps/memories/components/MemoryEditor.vue`
 * in three places:
 *   - Drops the `@/components/MarkdownEditor.vue` wrapper and uses
 *     `md-editor-v3` directly. The wrapper is a host SPA concern
 *     (theme store integration, bubble-mode popover); here the editor
 *     is mounted in the plugin slot with the host's `hsl(var(--foreground))`
 *     tokens already in scope.
 *   - Theme prop is fixed to `'light'`/`'dark'` based on the snapshot
 *     `hostContext.theme`. Plugins don't get the live theme store; the
 *     host unmounts and remounts the slot on theme change.
 *   - `toolbars` mirrors the host's `MarkdownEditor.vue` `full` mode set
 *     minus `github`/`mermaid`/`formula` (we don't ship diagrams/LaTeX
 *     in memories content). Locale is pinned to `en-US`.
 *
 * Action buttons emit `save(data)` / `delete()` / `cancel()` — the caller
 * decides whether `save()` is a create or an update based on whether
 * the `memory` prop is set.
 */

const MEMORY_EDITOR_TOOLBARS: Array<'bold' | 'underline' | 'italic' | 'strikeThrough' | '-' | 'title' | 'sub' | 'sup' | 'quote' | '-' | 'unorderedList' | 'orderedList' | 'task' | '-' | 'code' | 'codeRow' | 'link' | 'image' | 'table' | '-' | 'preview' | 'pageFullscreen'> = [
    'bold', 'underline', 'italic', 'strikeThrough',
    '-',
    'title', 'sub', 'sup', 'quote',
    '-',
    'unorderedList', 'orderedList', 'task',
    '-',
    'code', 'codeRow', 'link', 'image', 'table',
    '-',
    'preview',
    'pageFullscreen',
]

const MEMORY_LOCALE = 'en-US'

const props = defineProps<{
    memory?: MemoryResource | null
    saving?: boolean
    scope?: 'global' | 'agent'
    agentName?: string
    theme?: 'light' | 'dark'
}>()

const emit = defineEmits<{
    save: [data: CreateMemoryDto | UpdateMemoryDto]
    delete: []
    cancel: []
}>()

const name = ref('')
const summary = ref('')
const content = ref('')

watch(
    () => props.memory,
    (m) => {
        name.value = m?.name ?? ''
        summary.value = m?.summary ?? ''
        content.value = m?.content ?? ''
    },
    { immediate: true },
)

const isEditing = computed(() => props.memory != null)

// Per-instance id scope so multiple MemoryEditor instances never collide
// on `memory-name` / `memory-summary` / `memory-content` (web:S1117).
const idScope = useId()
const nameId = `${idScope}-memory-name`
const summaryId = `${idScope}-memory-summary`
const contentId = `${idScope}-memory-content`

async function handleSubmit(): Promise<void> {
    const data = {
        name: name.value.trim(),
        summary: summary.value.trim() || undefined,
        content: content.value || undefined,
    }
    emit('save', data)
}
</script>

<template>
    <div class="max-w-2xl">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold">{{ isEditing ? 'Edit Memory' : 'New Memory' }}{{ agentName ? ` for ${agentName}` : '' }}</h2>
            <button
                class="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                type="button"
                @click="$emit('cancel')"
            >
                <X class="w-4 h-4" />
            </button>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
            <div>
                <label :for="nameId" class="block text-sm font-medium mb-1.5">Name <span class="text-destructive">*</span></label>
                <input
                    :id="nameId"
                    v-model="name"
                    type="text"
                    required
                    placeholder="e.g. user_preferences, project_context"
                    class="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>

            <div>
                <label :for="summaryId" class="block text-sm font-medium mb-1.5">Summary</label>
                <input
                    :id="summaryId"
                    v-model="summary"
                    type="text"
                    maxlength="500"
                    placeholder="Brief one-line description (auto-derived if empty)"
                    class="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>

            <div>
                <label :for="contentId" class="block text-sm font-medium mb-1.5">Content <span class="text-muted-foreground text-xs">(Markdown)</span></label>
                <MdEditor
                    :id="contentId"
                    :model-value="content"
                    :rows="12"
                    :placeholder="'Memory content in Markdown format...'"
                    :theme="theme ?? 'light'"
                    :language="MEMORY_LOCALE"
                    :toolbars="MEMORY_EDITOR_TOOLBARS"
                    :preview="true"
                    @update:model-value="content = $event"
                />
            </div>

            <div class="flex items-center gap-3 pt-2">
                <button
                    type="submit"
                    :disabled="saving || !name.trim()"
                    class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {{ saving ? 'Saving…' : (isEditing ? 'Save Changes' : 'Create Memory') }}
                </button>

                <button
                    v-if="isEditing"
                    type="button"
                    :disabled="saving"
                    class="inline-flex h-9 items-center justify-center rounded-lg border border-destructive/30 px-4 text-sm font-medium text-destructive shadow-sm transition-colors hover:bg-destructive/10 disabled:opacity-50"
                    @click="$emit('delete')"
                >
                    Delete
                </button>

                <button
                    type="button"
                    class="inline-flex h-9 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
                    @click="$emit('cancel')"
                >
                    Cancel
                </button>
            </div>
        </form>
    </div>
</template>
