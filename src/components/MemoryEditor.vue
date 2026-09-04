<script setup lang="ts">
import { ref, computed, useId, watch } from 'vue'
import { X, ImageIcon } from 'lucide-vue-next'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import type {
    MemoryResource,
    CreateMemoryDto,
    UpdateMemoryDto,
    ReplaceMemoryDto,
    MemoryType,
} from '../types'
import type { PluginHostContext } from '../shims'

/**
 * Memory editor — used by both Global and Agent memories to create,
 * edit, or surgical-replace a memory body.
 *
 * Differs from the host-side
 * `spora-frontend/src/apps/memories/components/MemoryEditor.vue`:
 *   - Drops the `@/components/MarkdownEditor.vue` wrapper and uses
 *     `md-editor-v3` directly. The wrapper is a host SPA concern
 *     (theme store integration, bubble-mode popover); here the editor
 *     is mounted in the plugin slot with the host's
 *     `hsl(var(--foreground))` tokens already in scope.
 *   - Theme prop is fixed to `'light'`/`'dark'` based on the snapshot
 *     `hostContext.theme`. Plugins don't get the live theme store; the
 *     host unmounts and remounts the slot on theme change.
 *   - `toolbars` mirrors the host's `MarkdownEditor.vue` `full` mode set
 *     minus `github`/`mermaid`/`formula` (we don't ship diagrams/LaTeX
 *     in memories content). Locale is pinned to `en-US`.
 *
 * Action buttons emit `save(data)` / `delete()` / `cancel()` /
 * `replace(data)` — the caller decides which path to wire based on
 * the form's mode (full save vs surgical edit).
 */

// Hoisted to a named alias so the `'-'` separator is declared once instead of
// inlined four times in the literal union (typescript:S4621).
type MemoryEditorToolbarItem =
    | 'bold' | 'underline' | 'italic' | 'strikeThrough'
    | 'title' | 'sub' | 'sup' | 'quote'
    | 'unorderedList' | 'orderedList' | 'task'
    | 'code' | 'codeRow' | 'link' | 'image' | 'table'
    | 'preview' | 'pageFullscreen' | 'catalog' | 'fullscreen'
    | '-'

const MEMORY_EDITOR_TOOLBARS: MemoryEditorToolbarItem[] = [
    'bold', 'underline', 'italic', 'strikeThrough',
    '-',
    'title', 'sub', 'sup', 'quote',
    '-',
    'unorderedList', 'orderedList', 'task',
    '-',
    'code', 'codeRow', 'link', 'image', 'table',
    '-',
    'preview',
    'pageFullscreen', 'fullscreen', 'catalog',
]

const MEMORY_LOCALE = 'en-US'

const TYPES: ReadonlyArray<{ value: MemoryType; label: string }> = [
    { value: 'plan', label: 'Plan' },
    { value: 'documentation', label: 'Documentation' },
    { value: 'examples', label: 'Examples' },
    { value: 'context', label: 'Context' },
]

const props = defineProps<{
    memory?: MemoryResource | null
    saving?: boolean
    scope?: 'global' | 'agent'
    agentName?: string
    theme?: 'light' | 'dark'
    hostContext?: PluginHostContext
}>()

const emit = defineEmits<{
    save: [data: CreateMemoryDto | UpdateMemoryDto]
    replace: [data: ReplaceMemoryDto]
    delete: []
    cancel: []
}>()

const name = ref('')
const type = ref<MemoryType>('context')
const summary = ref('')
const content = ref('')

const showSurgicalEdit = ref(false)
const findText = ref('')
const newText = ref('')

const insertingMedia = ref(false)
const mediaError = ref<string | null>(null)

watch(
    () => props.memory,
    (m) => {
        name.value = m?.name ?? ''
        type.value = m?.type ?? 'context'
        summary.value = m?.summary ?? ''
        content.value = m?.content ?? ''
        showSurgicalEdit.value = false
        findText.value = ''
        newText.value = ''
        mediaError.value = null
    },
    { immediate: true },
)

const isEditing = computed(() => props.memory != null)
const canSubmitSave = computed(() => !props.saving && name.value.trim().length > 0)
const canSubmitReplace = computed(() => !props.saving && findText.value.length > 0 && newText.value.length > 0)

// Per-instance id scope so multiple MemoryEditor instances never collide
// on `memory-name` / `memory-summary` / `memory-content` (web:S1117).
const idScope = useId()
const nameId = `${idScope}-memory-name`
const typeId = `${idScope}-memory-type`
const summaryId = `${idScope}-memory-summary`
const contentId = `${idScope}-memory-content`
const findId = `${idScope}-memory-find`
const newTextId = `${idScope}-memory-newtext`

async function handleSubmit(): Promise<void> {
    if (showSurgicalEdit.value && isEditing.value) {
        const data: ReplaceMemoryDto = {
            name: name.value.trim(),
            type: type.value,
            find: findText.value,
            new_text: newText.value,
        }
        emit('replace', data)
        return
    }
    const data: CreateMemoryDto | UpdateMemoryDto = {
        name: name.value.trim(),
        type: type.value,
        summary: summary.value.trim() || undefined,
        content: content.value || undefined,
    }
    emit('save', data)
}

/**
 * Open the host's media picker and insert `![](<asset_url>)` at the
 * editor cursor. The host serves a controlled
 * `/api/v1/assets/<uuid>.<ext>` URL — we don't sanitise because the
 * picker only returns server-managed assets, and operators viewing
 * the body expect to see the same URL the picker would render.
 *
 * `md-editor-v3` doesn't expose `insertText()` in the version we ship
 * (^6.5.4), so we fall back to appending at end-of-content. Future
 * versions may add cursor-position insertion; the fallback is the
 * correct behaviour today and avoids touching library internals.
 */
async function handleAttachMedia(): Promise<void> {
    if (!props.hostContext || typeof props.hostContext.openMediaPicker !== 'function') return
    if (insertingMedia.value) return
    insertingMedia.value = true
    mediaError.value = null
    try {
        const assets = await props.hostContext.openMediaPicker({ mediaKind: 'image', multi: false })
        const first = assets[0]
        if (!first || !first.asset_url) return
        const insertion = `![](${first.asset_url})`
        content.value = content.value.length > 0
            ? `${content.value}\n${insertion}\n`
            : `${insertion}\n`
    } catch (e) {
        mediaError.value = e instanceof Error ? e.message : 'Failed to open media picker.'
    } finally {
        insertingMedia.value = false
    }
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
                <label :for="typeId" class="block text-sm font-medium mb-1.5">Type <span class="text-destructive">*</span></label>
                <select
                    :id="typeId"
                    v-model="type"
                    required
                    class="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
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
                <div class="flex items-center justify-between mb-1.5">
                    <label :for="contentId" class="block text-sm font-medium">Content <span class="text-muted-foreground text-xs">(Markdown)</span></label>
                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
                        :disabled="insertingMedia"
                        @click="handleAttachMedia"
                    >
                        <ImageIcon class="w-3.5 h-3.5" />
                        {{ insertingMedia ? 'Opening…' : 'Attach media' }}
                    </button>
                </div>
                <MdEditor
                    :id="contentId"
                    :model-value="content"
                    :rows="12"
                    :placeholder="'Memory content in Markdown format...'"
                    :theme="theme ?? 'light'"
                    :language="MEMORY_LOCALE"
                    :toolbars="MEMORY_EDITOR_TOOLBARS"
                    :preview="true"
                    mode="full"
                    @update:model-value="content = $event"
                />
                <p v-if="mediaError" class="text-xs text-destructive mt-1">{{ mediaError }}</p>
            </div>

            <div v-if="isEditing" class="rounded-lg border border-border bg-card p-3">
                <button
                    type="button"
                    class="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    @click="showSurgicalEdit = !showSurgicalEdit"
                >
                    <span>{{ showSurgicalEdit ? '▾' : '▸' }}</span>
                    Surgical edit
                </button>
                <p v-if="!showSurgicalEdit" class="text-xs text-muted-foreground mt-1 ml-5">
                    Replace a single substring inside the body without rewriting the whole document.
                </p>
                <div v-else class="mt-3 space-y-3">
                    <div>
                        <label :for="findId" class="block text-xs font-medium mb-1">Find</label>
                        <input
                            :id="findId"
                            v-model="findText"
                            type="text"
                            placeholder="Exact substring to replace"
                            class="w-full h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                        />
                    </div>
                    <div>
                        <label :for="newTextId" class="block text-xs font-medium mb-1">New text</label>
                        <textarea
                            :id="newTextId"
                            v-model="newText"
                            rows="3"
                            placeholder="Replacement text"
                            class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                        />
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-3 pt-2">
                <button
                    type="submit"
                    :disabled="showSurgicalEdit ? !canSubmitReplace : !canSubmitSave"
                    class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {{ saving
                        ? 'Saving…'
                        : (showSurgicalEdit
                            ? 'Replace'
                            : (isEditing ? 'Save Changes' : 'Create Memory')) }}
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