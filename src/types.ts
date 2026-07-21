/**
 * Wire shape for a single Memory row.
 *
 * Fields documented here are the ones the UI actually renders. The PHP
 * model carries a few additional columns (metadata, etc.) that the v1
 * panel exposes only in the detail drawer.
 */

export interface MemoryResource {
    id: number
    user_id: number | null
    agent_id: number | null
    name: string
    summary: string | null
    content: string | null
    order: number
    created_at: string
    updated_at: string
}

export interface CreateMemoryDto {
    name: string
    summary?: string
    content?: string
}

export interface UpdateMemoryDto {
    name?: string
    summary?: string | null
    content?: string | null
}

export interface AgentSummary {
    id: number
    name: string
}
