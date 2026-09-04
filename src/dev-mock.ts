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

const CURRENT_USER_ID = 42

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

const VALID_MEMORY_TYPES: MemoryType[] = ['plan', 'documentation', 'examples', 'context']

/**
 * Coerce an unknown `?type=` query value into a known `MemoryType`,
 * falling back to `'context'` for unknown / missing values. Hoisted to
 * module scope so it isn't reallocated per `createMockApi()` call
 * (typescript:S7721).
 */
function matchType(memoryType: string | undefined): MemoryType {
    return memoryType !== undefined && (VALID_MEMORY_TYPES as string[]).includes(memoryType)
        ? memoryType as MemoryType
        : 'context'
}

interface ReplaceableBody {
    name?: string
    type?: MemoryType
    summary?: string
    content?: string
    find?: string
    new_text?: string
}

/**
 * `null` → path matched but no `?type=` filter supplied.
 * `undefined` → path did not match the route, dispatcher should
 *                fall through to the next candidate.
 */
function parseGlobalListQuery(path: string): { type: MemoryType | null } | undefined {
    const match = /^\/memories(?:\?type=([^&]+))?$/.exec(path)
    if (!match) return undefined
    const rawType = match[1] !== undefined ? decodeURIComponent(match[1]) : undefined
    return { type: rawType === undefined ? null : matchType(rawType) }
}

function parseGlobalMemoryId(path: string): string | undefined {
    const match = /^\/memories\/([^/]+)$/.exec(path)
    if (!match) return undefined
    return match[1] ?? ''
}

function parseAgentListQuery(path: string): { agentId: number; type: MemoryType | null } | undefined {
    const match = /^\/agents\/(\d+)\/memories(?:\?type=([^&]+))?$/.exec(path)
    if (!match) return undefined
    const agentId = Number(match[1])
    const rawType = match[2] !== undefined ? decodeURIComponent(match[2]) : undefined
    return { agentId, type: rawType === undefined ? null : matchType(rawType) }
}

function parseAgentMemoryPath(path: string): { agentId: number; memoryId: string } | undefined {
    const match = /^\/agents\/(\d+)\/memories\/([^/]+)$/.exec(path)
    if (!match) return undefined
    return { agentId: Number(match[1]), memoryId: match[2] ?? '' }
}

function parseGlobalReplacePath(path: string): string | undefined {
    const match = /^\/memories\/([^/]+)\/replace$/.exec(path)
    if (!match) return undefined
    return match[1] ?? ''
}

function parseCreateAgentMemoryPath(path: string): number | undefined {
    const match = /^\/agents\/(\d+)\/memories$/.exec(path)
    if (!match) return undefined
    return Number(match[1])
}

function parseAgentReplacePath(path: string): { agentId: number; memoryId: string } | undefined {
    const match = /^\/agents\/(\d+)\/memories\/([^/]+)\/replace$/.exec(path)
    if (!match) return undefined
    return { agentId: Number(match[1]), memoryId: match[2] ?? '' }
}

function buildMemory(
    input: ReplaceableBody,
    scope: 'global' | 'agent',
    agentId: number | null,
    order: number,
): MemoryResource {
    return {
        id: makeId(),
        principal_id: CURRENT_USER_ID,
        agent_id: scope === 'agent' ? agentId : null,
        scope,
        type: input.type ?? 'context',
        name: input.name ?? 'untitled',
        summary: input.summary ?? null,
        content: input.content ?? null,
        order,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }
}

/**
 * Apply a surgical replace on `current`, throwing on missing or
 * ambiguous anchors. Centralised so the global and agent replace
 * branches share the exact-match contract.
 */
function applyReplace(input: ReplaceableBody, current: string): string {
    const anchor = input.find ?? ''
    const occurrences = anchor !== '' ? current.split(anchor).length - 1 : 0
    if (occurrences === 0) throw new Error('find matches 0 occurrences.')
    if (occurrences > 1) throw new Error(`find matches ${occurrences} occurrences; provide a unique substring.`)
    return current.replace(anchor, input.new_text ?? '')
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

    function findById(id: string): MemoryResource {
        const found = memories.find((m) => m.id === id)
        if (!found) throw new Error(`Not found: ${id}`)
        return found
    }

    function replaceMemoryContent(idx: number, input: ReplaceableBody): void {
        const current = memories[idx]?.content ?? ''
        const content = applyReplace(input, current)
        memories[idx] = {
            ...memories[idx]!,
            content,
            updated_at: new Date().toISOString(),
        }
    }

    return {
        async get<T>(path: string): Promise<T> {
            if (path === '/agents') {
                return { agents: AGENTS } as unknown as T
            }
            if (path === '/principals/me') {
                return {
                    principals: [
                        { id: CURRENT_USER_ID, type: 'user', name: `User #${CURRENT_USER_ID}`, user_id: CURRENT_USER_ID, group_id: null },
                    ],
                } as unknown as T
            }
            const globalList = parseGlobalListQuery(path)
            if (globalList !== undefined) {
                return { memories: listGlobal(globalList.type ?? undefined) } as unknown as T
            }
            const globalId = parseGlobalMemoryId(path)
            if (globalId !== undefined) {
                return { memory: findById(globalId) } as unknown as T
            }
            const agentList = parseAgentListQuery(path)
            if (agentList !== undefined) {
                return { memories: listAgent(agentList.agentId, agentList.type ?? undefined) } as unknown as T
            }
            const agentMemory = parseAgentMemoryPath(path)
            if (agentMemory !== undefined) {
                return { memory: findById(agentMemory.memoryId) } as unknown as T
            }
            throw new Error(`Mock API has no handler for ${path}`)
        },

        async post<T>(path: string, body: unknown): Promise<T> {
            const input = (body ?? {}) as ReplaceableBody
            if (path === '/memories') {
                const memory = buildMemory(input, 'global', null, listGlobal().length)
                memories.push(memory)
                return { memory } as unknown as T
            }
            const replaceGlobalId = parseGlobalReplacePath(path)
            if (replaceGlobalId !== undefined) {
                const idx = memories.findIndex((m) => m.id === replaceGlobalId && m.scope === 'global')
                if (idx === -1) throw new Error(`Not found: ${replaceGlobalId}`)
                replaceMemoryContent(idx, input)
                return { memory: memories[idx] } as unknown as T
            }
            const createAgentId = parseCreateAgentMemoryPath(path)
            if (createAgentId !== undefined) {
                const memory = buildMemory(input, 'agent', createAgentId, listAgent(createAgentId).length)
                memories.push(memory)
                return { memory } as unknown as T
            }
            const replaceAgent = parseAgentReplacePath(path)
            if (replaceAgent !== undefined) {
                const idx = memories.findIndex((m) => m.id === replaceAgent.memoryId && m.scope === 'agent')
                if (idx === -1) throw new Error(`Not found: ${replaceAgent.memoryId}`)
                replaceMemoryContent(idx, input)
                return { memory: memories[idx] } as unknown as T
            }
            throw new Error(`Mock API has no handler for POST ${path}`)
        },

        async put<T>(path: string, body: unknown): Promise<T> {
            const input = (body ?? {}) as Partial<MemoryResource>
            const globalId = parseGlobalMemoryId(path)
            if (globalId !== undefined) {
                const idx = memories.findIndex((m) => m.id === globalId && m.scope === 'global')
                if (idx === -1) throw new Error(`Not found: ${globalId}`)
                memories[idx] = {
                    ...memories[idx]!,
                    ...input,
                    updated_at: new Date().toISOString(),
                }
                return { memory: memories[idx] } as unknown as T
            }
            const agentMemory = parseAgentMemoryPath(path)
            if (agentMemory !== undefined) {
                const idx = memories.findIndex((m) => m.id === agentMemory.memoryId && m.scope === 'agent')
                if (idx === -1) throw new Error(`Not found: ${agentMemory.memoryId}`)
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
            if (path === '/memories/reorder' && Array.isArray(input.order)) {
                const ordered = input.order
                    .map((id) => memories.find((m) => m.id === id && m.scope === 'global'))
                    .filter((m): m is MemoryResource => m !== undefined)
                const others = memories.filter((m) => m.scope !== 'global')
                memories = [...others, ...ordered]
                return undefined as unknown as T
            }
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
            const globalId = parseGlobalMemoryId(path)
            if (globalId !== undefined) {
                memories = memories.filter((m) => m.id !== globalId)
                return undefined as unknown as T
            }
            const agentMemory = parseAgentMemoryPath(path)
            if (agentMemory !== undefined) {
                memories = memories.filter((m) => m.id !== agentMemory.memoryId)
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