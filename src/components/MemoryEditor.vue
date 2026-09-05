<script setup lang="ts">
import { ref, computed, useId, watch } from 'vue'
import { X, ImageIcon } from 'lucide-vue-next'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import type {
    MemoryResource,
    CreateMemoryDto,
    UpdateMemoryDto,
    MemoryType,
} from '../types'
import type { PluginHostContext } from '../shims'

/**
 * Memory editor — used by both Global and Agent memories to create or
 * edit a memory body. The header (Name, Type, Summary) sits above a
 * `md-editor-v3` Markdown pane; Save / Delete / Cancel buttons live
 * below it.
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
 *   - `:preview="false"` opens the editor in edit-only mode by default;
 *     the toolbar's `preview` button still toggles between edit-only,
 *     split and preview-only — operators opt into the preview pane
 *     instead of getting it for free. md-editor-v3 stores the user's
 *     choice within the session via the toolbar, so toggling it back
 *     on once keeps it on across reopens until the page reloads.
 *
 * Action buttons emit `save(data)` / `delete()` / `cancel()`. The
 * earlier `replace` emit (surgical-edit substring replacement) was
 * removed as part of the Idea 1 redesign; the editor is now strictly
 * a save-or-cancel surface.
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
    delete: []
    cancel: []
}>()

const name = ref('')
const type = ref<MemoryType>('context')
const summary = ref('')
const content = ref('')

const insertingMedia = ref(false)
const mediaError = ref<string | null>(null)

watch(
    () => props.memory,
    (m) => {
        name.value = m?.name ?? ''
        type.value = m?.type ?? 'context'
        summary.value = m?.summary ?? ''
        content.value = m?.content ?? ''
        mediaError.value = null
    },
    { immediate: true },
)

const isEditing = computed(() => props.memory != null)
const canSubmitSave = computed(() => !props.saving && name.value.trim().length > 0)

// Per-instance id scope so multiple MemoryEditor instances never collide
// on `memory-name` / `memory-summary` / `memory-content` (web:S1117).
const idScope = useId()
const nameId = `${idScope}-memory-name`
const typeId = `${idScope}-memory-type`
const summaryId = `${idScope}-memory-summary`
const contentId = `${idScope}-memory-content`

async function handleSubmit(): Promise<void> {
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
    <div class="max-w-3xl">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold">{{ isEditing ? 'Edit Memory' : 'New Memory' }}{{ agentName ? ` for ${agentName}` : '' }}</h2>
            <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                @click="$emit('cancel')"
            >
                <X class="h-4 w-4" />
            </button>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
            <div class="grid grid-cols-[3fr_1fr] gap-3">
                <div>
                    <label :for="nameId" class="mb-1.5 block text-sm font-medium">Name <span class="text-destructive">*</span></label>
                    <input
                        :id="nameId"
                        v-model="name"
                        type="text"
                        required
                        placeholder="e.g. user_preferences, project_context"
                        class="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                    />
                </div>
                <div>
                    <label :for="typeId" class="mb-1.5 block text-sm font-medium">Type <span class="text-destructive">*</span></label>
                    <select
                        :id="typeId"
                        v-model="type"
                        required
                        class="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
                    </select>
                </div>
            </div>

            <div>
                <label :for="summaryId" class="mb-1.5 block text-sm font-medium">Summary</label>
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
                <div class="mb-1.5 flex items-center justify-between">
                    <label :for="contentId" class="block text-sm font-medium">Content <span class="text-xs text-muted-foreground">(Markdown)</span></label>
                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
                        :disabled="insertingMedia"
                        @click="handleAttachMedia"
                    >
                        <ImageIcon class="h-3.5 w-3.5" />
                        {{ insertingMedia ? 'Opening…' : 'Attach media' }}
                    </button>
                </div>
                <MdEditor
                    :id="contentId"
                    :model-value="content"
                    :rows="16"
                    :placeholder="'Memory content in Markdown format...'"
                    :theme="theme ?? 'light'"
                    :language="MEMORY_LOCALE"
                    :toolbars="MEMORY_EDITOR_TOOLBARS"
                    :preview="false"
                    mode="full"
                    @update:model-value="content = $event"
                />
                <p v-if="mediaError" class="mt-1 text-xs text-destructive">{{ mediaError }}</p>
            </div>

            <div class="flex items-center gap-3 border-t border-border pt-4">
                <button
                    type="submit"
                    :disabled="!canSubmitSave"
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
                <span class="ml-auto text-xs text-muted-foreground">Saved locally · press ⌘S</span>
            </div>
        </form>
    </div>
</template>
