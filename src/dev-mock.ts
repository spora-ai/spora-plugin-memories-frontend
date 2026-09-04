/**
 * Dev-only mock API + fixture data used by `src/dev-main.ts` to render
 * the UI without a backend. Pure data and pure functions live here so
 * they're unit-testable; the side-effecting Vue bootstrap stays in
 * `dev-main.ts`.
 *
 * The mock honors the same endpoints the PHP controllers expose
 * (`/memories`, `/memories/:id`, `/agents/:id/memories`, etc.) so
 * the UI is exercisable end-to-end without a database. For real DB-
 * backed testing, run the host SPA + this plugin's dev server + PHP
 * together (see `spora-workspace/plans/memories-v2.md` PR-3, and
 * `spora-frontend/vite.config.ts → SPORA_PLUGIN_DEV_PORTS`).
 */
import type { MemoryResource, AgentSummary, MemoryType, MediaPickerOptions, MediaAsset } from './types'
import type { PluginHostContext } from './shims'

let nextId = 100

function makeId(): string {
    nextId++
    // Hex-shaped UUIDv7 stand-in; the real backend uses
    // `Ramsey\Uuid\Uuid::uuid7()`. The shape matters because the
    // editor's id-derived DOM ids collide on hex boundaries, so we
    // keep the dev mock deterministic.
    const hex = nextId.toString(16).padStart(12, '0')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${nextId.toString(16).padStart(3, '0').slice(-3)}-b012-${hex}${hex}`.slice(0, 36)
}

function uid(seed: number): string {
    const hex = seed.toString(16).padStart(12, '0')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${seed.toString(16).padStart(3, '0').slice(-3)}-b012-${hex}${hex}`.slice(0, 36)
}

function fixtures(): MemoryResource[] {
    return [
        {
            id: uid(1),
            principal_id: 42,
            agent_id: null,
            scope: 'global',
            type: 'context',
            name: 'user_preferences',
            summary: 'User likes concise responses',
            content: '# Preferences\n\n- Likes bullet points\n- Prefers concise answers',
            order: 0,
            created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
            updated_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        },
        {
            id: uid(2),
            principal_id: 42,
            agent_id: null,
            scope: 'global',
            type: 'documentation',
            name: 'project_context',
            summary: 'Current project background',
            content: '## Project\n\nA Spora-based orchestration platform.',
            order: 1,
            created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
            updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
            id: uid(3),
            principal_id: 99,
            agent_id: null,
            scope: 'global',
            type: 'examples',
            name: 'team_roster',
            summary: null,
            content: 'Backend: 3 engineers\nFrontend: 2 engineers',
            order: 2,
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
            id: uid(4),
            principal_id: 42,
            agent_id: 7,
            scope: 'agent',
            type: 'context',
            name: 'oncall_rotation',
            summary: 'Current on-call engineer',
            content: 'This week: Alice',
            order: 0,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            updated_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
            id: uid(5),
            principal_id: 42,
            agent_id: 7,
            scope: 'agent',
            type: 'plan',
            name: 'escalation_path',
            summary: 'Who to call when the primary is unreachable',
            content: 'Primary: Alice. Secondary: Bob. Manager: Carol.',
            order: 1,
            created_at: new Date(Date.now() - 3600000).toISOString(),
            updated_at: new Date(Date.now() - 3600000).toISOString(),
        },
    ]
}

const AGENTS: AgentSummary[] = [
    { id: 7, name: 'Oncall Bot' },
    { id: 8, name: 'Triage Helper' },
    { id: 9, name: 'Release Manager' },
]

export const CURRENT_USER_ID = 42

export function createMockApi(): PluginHostContext['api'] {
    let memories = fixtures()

    function listGlobal(type?: MemoryType): MemoryResource[] {
        return memories.filter((m) => m.scope === 'global').filter((m) => type === undefined || m.type === type)
    }

    function listAgent(agentId: number, type?: MemoryType): MemoryResource[] {
        return memories
            .filter((m) => m.scope === 'agent' && m.agent_id === agentId)
            .filter((m) => type === undefined || m.type === type)
    }

    function matchType(memoryType: string | undefined): MemoryType {
        const valid: MemoryType[] = ['plan', 'documentation', 'examples', 'context']
        if (memoryType && (valid as string[]).includes(memoryType)) return memoryType as MemoryType
        return 'context'
    }

    return {
        async get<T>(path: string): Promise<T> {
            // /agents — used by useAgents composable
            if (path === '/agents') {
                return { agents: AGENTS } as unknown as T
            }
            // /principals/me — used by usePrincipalsStore
            if (path === '/principals/me') {
                return {
                    principals: [
                        { id: 42, type: 'user', name: `User #${CURRENT_USER_ID}`, user_id: CURRENT_USER_ID, group_id: null },
                    ],
                } as unknown as T
            }
            // /memories?type=…
            const globalMatch = /^\/memories(?:\?type=([^&]+))?$/.exec(path)
            if (globalMatch) {
                const rawType = globalMatch[1] !== undefined ? decodeURIComponent(globalMatch[1]) : undefined
                const t = rawType === undefined ? undefined : matchType(rawType)
                return { memories: listGlobal(t) } as unknown as T
            }
            // /memories/:id
            const globalById = /^\/memories\/([^/]+)$/.exec(path)
            if (globalById) {
                const id = globalById[1] ?? ''
                const found = memories.find((m) => m.id === id)
                if (!found) throw new Error(`Not found: ${id}`)
                return { memory: found } as unknown as T
            }
            // /agents/:id/memories?type=…
            const agentListMatch = /^\/agents\/(\d+)\/memories(?:\?type=([^&]+))?$/.exec(path)
            if (agentListMatch) {
                const agentId = Number(agentListMatch[1])
                const rawType = agentListMatch[2] !== undefined ? decodeURIComponent(agentListMatch[2]) : undefined
                const t = rawType === undefined ? undefined : matchType(rawType)
                return { memories: listAgent(agentId, t) } as unknown as T
            }
            // /agents/:id/memories/:memoryId
            const agentOne = /^\/agents\/(\d+)\/memories\/([^/]+)$/.exec(path)
            if (agentOne) {
                const memoryId = agentOne[2] ?? ''
                const found = memories.find((m) => m.id === memoryId)
                if (!found) throw new Error(`Not found: ${memoryId}`)
                return { memory: found } as unknown as T
            }
            throw new Error(`Mock API has no handler for ${path}`)
        },

        async post<T>(path: string, body: unknown): Promise<T> {
            const input = (body ?? {}) as {
                name?: string
                type?: MemoryType
                summary?: string
                content?: string
                find?: string
                new_text?: string
            }
            // /memories
            if (path === '/memories') {
                const memory: MemoryResource = {
                    id: makeId(),
                    principal_id: CURRENT_USER_ID,
                    agent_id: null,
                    scope: 'global',
                    type: input.type ?? 'context',
                    name: input.name ?? 'untitled',
                    summary: input.summary ?? null,
                    content: input.content ?? null,
                    order: listGlobal().length,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }
                memories.push(memory)
                return { memory } as unknown as T
            }
            // /memories/:id/replace
            const replaceGlobal = /^\/memories\/([^/]+)\/replace$/.exec(path)
            if (replaceGlobal) {
                const id = replaceGlobal[1] ?? ''
                const idx = memories.findIndex((m) => m.id === id && m.scope === 'global')
                if (idx === -1) throw new Error(`Not found: ${id}`)
                const current = memories[idx]?.content ?? ''
                const occurrences = input.find ? current.split(input.find).length - 1 : 0
                if (occurrences === 0) throw new Error('find matches 0 occurrences.')
                if (occurrences > 1) throw new Error(`find matches ${occurrences} occurrences; provide a unique substring.`)
                const updated: MemoryResource = {
                    ...memories[idx]!,
                    content: current.replace(input.find ?? '', input.new_text ?? ''),
                    updated_at: new Date().toISOString(),
                }
                memories[idx] = updated
                return { memory: updated } as unknown as T
            }
            // /agents/:id/memories
            const agentList = /^\/agents\/(\d+)\/memories$/.exec(path)
            if (agentList) {
                const agentId = Number(agentList[1])
                const memory: MemoryResource = {
                    id: makeId(),
                    principal_id: CURRENT_USER_ID,
                    agent_id: agentId,
                    scope: 'agent',
                    type: input.type ?? 'context',
                    name: input.name ?? 'untitled',
                    summary: input.summary ?? null,
                    content: input.content ?? null,
                    order: listAgent(agentId).length,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }
                memories.push(memory)
                return { memory } as unknown as T
            }
            // /agents/:id/memories/:memoryId/replace
            const replaceAgent = /^\/agents\/(\d+)\/memories\/([^/]+)\/replace$/.exec(path)
            if (replaceAgent) {
                const memoryId = replaceAgent[2] ?? ''
                const idx = memories.findIndex((m) => m.id === memoryId && m.scope === 'agent')
                if (idx === -1) throw new Error(`Not found: ${memoryId}`)
                const current = memories[idx]?.content ?? ''
                const occurrences = input.find ? current.split(input.find).length - 1 : 0
                if (occurrences === 0) throw new Error('find matches 0 occurrences.')
                if (occurrences > 1) throw new Error(`find matches ${occurrences} occurrences; provide a unique substring.`)
                const updated: MemoryResource = {
                    ...memories[idx]!,
                    content: current.replace(input.find ?? '', input.new_text ?? ''),
                    updated_at: new Date().toISOString(),
                }
                memories[idx] = updated
                return { memory: updated } as unknown as T
            }
            throw new Error(`Mock API has no handler for POST ${path}`)
        },

        async put<T>(path: string, body: unknown): Promise<T> {
            const input = (body ?? {}) as Partial<MemoryResource>
            // /memories/:id
            const globalById = /^\/memories\/([^/]+)$/.exec(path)
            if (globalById) {
                const id = globalById[1] ?? ''
                const idx = memories.findIndex((m) => m.id === id && m.scope === 'global')
                if (idx === -1) throw new Error(`Not found: ${id}`)
                memories[idx] = {
                    ...memories[idx]!,
                    ...input,
                    updated_at: new Date().toISOString(),
                }
                return { memory: memories[idx] } as unknown as T
            }
            // /agents/:id/memories/:memoryId
            const agentOne = /^\/agents\/(\d+)\/memories\/([^/]+)$/.exec(path)
            if (agentOne) {
                const memoryId = agentOne[2] ?? ''
                const idx = memories.findIndex((m) => m.id === memoryId && m.scope === 'agent')
                if (idx === -1) throw new Error(`Not found: ${memoryId}`)
                memories[idx] = {
                    ...memories[idx]!,
                    ...input,
                    updated_at: new Date().toISOString(),
                }
                return { memory: memories[idx] } as unknown as T
            }
            throw new Error(`Mock API has no handler for PUT ${path}`)
        },

        async patch<T>(path: string, body: unknown): Promise<T> {
            const input = (body ?? {}) as { order?: string[] }
            // /memories/reorder
            if (path === '/memories/reorder' && Array.isArray(input.order)) {
                const ordered = input.order
                    .map((id) => memories.find((m) => m.id === id && m.scope === 'global'))
                    .filter((m): m is MemoryResource => m !== undefined)
                const others = memories.filter((m) => m.scope !== 'global')
                memories = [...others, ...ordered]
                return undefined as unknown as T
            }
            // /agents/:id/memories/reorder
            const agentReorder = /^\/agents\/(\d+)\/memories\/reorder$/.exec(path)
            if (agentReorder && Array.isArray(input.order)) {
                const agentId = Number(agentReorder[1])
                const others = memories.filter((m) => m.scope !== 'agent' || m.agent_id !== agentId)
                const ordered = input.order
                    .map((id, index) => {
                        const found = memories.find((m) => m.id === id)
                        return found ? { ...found, order: index } : undefined
                    })
                    .filter((m): m is MemoryResource => m !== undefined)
                memories = [...others, ...ordered]
                return undefined as unknown as T
            }
            throw new Error(`Mock API has no handler for PATCH ${path}`)
        },

        async delete<T>(path: string): Promise<T> {
            // /memories/:id
            const globalById = /^\/memories\/([^/]+)$/.exec(path)
            if (globalById) {
                const id = globalById[1] ?? ''
                memories = memories.filter((m) => m.id !== id)
                return undefined as unknown as T
            }
            // /agents/:id/memories/:memoryId
            const agentOne = /^\/agents\/(\d+)\/memories\/([^/]+)$/.exec(path)
            if (agentOne) {
                const memoryId = agentOne[2] ?? ''
                memories = memories.filter((m) => m.id !== memoryId)
                return undefined as unknown as T
            }
            throw new Error(`Mock API has no handler for DELETE ${path}`)
        },
    } as PluginHostContext['api']
}

/**
 * Dev-only stub for `hostContext.openMediaPicker`. Returns a single
 * sample asset so the editor's `![](<asset_url>)` insertion path is
 * exercisable end-to-end without the host SPA. The shape mirrors
 * `spora-frontend/src/types/media.ts → MediaAsset`.
 */
export function createMockOpenMediaPicker(): (options?: MediaPickerOptions) => Promise<MediaAsset[]> {
    return async (_options?: MediaPickerOptions): Promise<MediaAsset[]> => {
        return [{
            id: 'mock-asset-1',
            filename: 'sample.png',
            media_type: 'image',
            mime_type: 'image/png',
            byte_size: 12345,
            asset_url: '/api/v1/assets/mock-asset-1.png',
            has_markdown: false,
        }]
    }
}

// Expose the fixture arrays so tests can assert on known seed data.
export const FIXTURE_AGENTS = AGENTS
export const FIXTURE_GLOBAL = fixtures().filter((m) => m.scope === 'global')
export const FIXTURE_AGENT = fixtures().filter((m) => m.scope === 'agent')