/**
 * Wire shape for a single Memory row — one field per column on the
 * PHP `Memory` model.
 */

export type MemoryType = 'plan' | 'documentation' | 'examples' | 'context'
export type MemoryScope = 'global' | 'agent'

export interface MemoryResource {
    id: string
    principal_id: number | null
    agent_id: number | null
    scope: MemoryScope
    type: MemoryType
    name: string
    summary: string | null
    content: string | null
    order: number
    created_at: string
    updated_at: string
}

export interface CreateMemoryDto {
    name: string
    type: MemoryType
    summary?: string
    content?: string
}

export interface UpdateMemoryDto {
    name?: string
    type?: MemoryType
    summary?: string | null
    content?: string | null
}

export interface ReplaceMemoryDto {
    name: string
    type: MemoryType
    find: string
    new_text: string
}

export interface MediaPickerOptions {
    multi?: boolean
    mediaKind?: 'image' | 'image+document'
    title?: string
}

/**
 * Media asset as handed back by the host's media picker. Diverges from
 * `spora-frontend/src/types/media.ts → MediaAsset`: the plugin omits the
 * host's `is_temporary` retention flag and adds `has_markdown`.
 */
export interface MediaAsset {
    id: string
    filename: string | null
    media_type: string | null
    mime_type: string | null
    byte_size: number | null
    asset_url: string | null
    has_markdown: boolean
}

export interface AgentSummary {
    id: number
    name: string
}