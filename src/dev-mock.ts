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
 * together (see `spora-frontend/vite.config.ts →
 * SPORA_PLUGIN_DEV_PORTS`).
 */
import type { MemoryResource, AgentSummary } from './types'
import type { PluginHostContext } from './shims'

let nextId = 100

function makeId(): number {
    nextId++
    return nextId
}

const FIXTURE: MemoryResource[] = [
    {
        id: 1,
        user_id: 42,
        agent_id: null,
        name: 'user_preferences',
        summary: 'User likes concise responses',
        content: '# Preferences\n\n- Likes bullet points\n- Prefers concise answers',
        order: 0,
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    {
        id: 2,
        user_id: 42,
        agent_id: null,
        name: 'project_context',
        summary: 'Current project background',
        content: '## Project\n\nA Spora-based orchestration platform.',
        order: 1,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
        id: 3,
        user_id: 99,
        agent_id: null,
        name: 'team_roster',
        summary: null,
        content: 'Backend: 3 engineers\nFrontend: 2 engineers',
        order: 2,
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
        id: 4,
        user_id: 42,
        agent_id: 7,
        name: 'oncall_rotation',
        summary: 'Current on-call engineer',
        content: 'This week: Alice',
        order: 0,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
        id: 5,
        user_id: 42,
        agent_id: 7,
        name: 'escalation_path',
        summary: 'Who to call when the primary is unreachable',
        content: 'Primary: Alice. Secondary: Bob. Manager: Carol.',
        order: 1,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
        id: 6,
        user_id: 42,
        agent_id: 8,
        name: 'triage_checklist',
        summary: 'Steps the triage agent follows on every page',
        content: '1. Read the request\n2. Decide severity\n3. Reply or escalate',
        order: 0,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
    },
]

const AGENTS: AgentSummary[] = [
    { id: 7, name: 'Oncall Bot' },
    { id: 8, name: 'Triage Helper' },
    { id: 9, name: 'Release Manager' },
]

export const CURRENT_USER_ID = 42

export function createMockApi(): PluginHostContext['api'] {
    let globalMemories = [...FIXTURE.filter((m) => m.agent_id === null)]
    let agentMemories = [...FIXTURE.filter((m) => m.agent_id !== null)]

    return {
        async get<T>(path: string): Promise<T> {
            // /agents — used by useAgents composable
            if (path === '/agents') {
                return { agents: AGENTS } as unknown as T
            }
            // /memories — global list
            if (path === '/memories') {
                return { memories: globalMemories } as unknown as T
            }
            // /memories/:id
            const globalById = /^\/memories\/(\d+)$/.exec(path)
            if (globalById) {
                const id = Number(globalById[1])
                const found = globalMemories.find((m) => m.id === id)
                if (!found) throw new Error(`Not found: ${id}`)
                return { memory: found } as unknown as T
            }
            // /agents/:id/memories — agent list
            const agentList = /^\/agents\/(\d+)\/memories$/.exec(path)
            if (agentList) {
                const agentId = Number(agentList[1])
                const list = agentMemories.filter((m) => m.agent_id === agentId)
                return { memories: list } as unknown as T
            }
            // /agents/:id/memories/:memoryId
            const agentOne = /^\/agents\/(\d+)\/memories\/(\d+)$/.exec(path)
            if (agentOne) {
                const memoryId = Number(agentOne[2])
                const found = agentMemories.find((m) => m.id === memoryId)
                if (!found) throw new Error(`Not found: ${memoryId}`)
                return { memory: found } as unknown as T
            }
            throw new Error(`Mock API has no handler for ${path}`)
        },

        async post<T>(path: string, body: unknown): Promise<T> {
            const input = (body ?? {}) as { name?: string; summary?: string; content?: string }
            // /memories
            if (path === '/memories') {
                const memory: MemoryResource = {
                    id: makeId(),
                    user_id: CURRENT_USER_ID,
                    agent_id: null,
                    name: input.name ?? 'untitled',
                    summary: input.summary ?? null,
                    content: input.content ?? null,
                    order: globalMemories.length,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }
                globalMemories.push(memory)
                return { memory } as unknown as T
            }
            // /agents/:id/memories
            const agentList = /^\/agents\/(\d+)\/memories$/.exec(path)
            if (agentList) {
                const agentId = Number(agentList[1])
                const memory: MemoryResource = {
                    id: makeId(),
                    user_id: CURRENT_USER_ID,
                    agent_id: agentId,
                    name: input.name ?? 'untitled',
                    summary: input.summary ?? null,
                    content: input.content ?? null,
                    order: agentMemories.filter((m) => m.agent_id === agentId).length,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }
                agentMemories.push(memory)
                return { memory } as unknown as T
            }
            throw new Error(`Mock API has no handler for POST ${path}`)
        },

        async put<T>(path: string, body: unknown): Promise<T> {
            const input = (body ?? {}) as Partial<MemoryResource>
            // /memories/:id
            const globalById = /^\/memories\/(\d+)$/.exec(path)
            if (globalById) {
                const id = Number(globalById[1])
                const idx = globalMemories.findIndex((m) => m.id === id)
                if (idx === -1) throw new Error(`Not found: ${id}`)
                globalMemories[idx] = {
                    ...globalMemories[idx],
                    ...input,
                    updated_at: new Date().toISOString(),
                }
                return { memory: globalMemories[idx] } as unknown as T
            }
            // /agents/:id/memories/:memoryId
            const agentOne = /^\/agents\/(\d+)\/memories\/(\d+)$/.exec(path)
            if (agentOne) {
                const memoryId = Number(agentOne[2])
                const idx = agentMemories.findIndex((m) => m.id === memoryId)
                if (idx === -1) throw new Error(`Not found: ${memoryId}`)
                agentMemories[idx] = {
                    ...agentMemories[idx],
                    ...input,
                    updated_at: new Date().toISOString(),
                }
                return { memory: agentMemories[idx] } as unknown as T
            }
            throw new Error(`Mock API has no handler for PUT ${path}`)
        },

        async patch<T>(path: string, body: unknown): Promise<T> {
            const input = (body ?? {}) as { order?: number[] }
            // /memories/reorder
            if (path === '/memories/reorder' && Array.isArray(input.order)) {
                const ordered = input.order
                    .map((id) => globalMemories.find((m) => m.id === id))
                    .filter((m): m is MemoryResource => m !== undefined)
                globalMemories = ordered
                return undefined as unknown as T
            }
            // /agents/:id/memories/reorder
            const agentReorder = /^\/agents\/(\d+)\/memories\/reorder$/.exec(path)
            if (agentReorder && Array.isArray(input.order)) {
                const agentId = Number(agentReorder[1])
                // Keep memories for other agents untouched so a single
                // agent's reorder doesn't wipe out unrelated memories.
                const others = agentMemories.filter((m) => m.agent_id !== agentId)
                // Build the new ordered list for this agent, updating
                // each entry's `order` field to match its position in
                // the new sequence.
                const ordered = input.order
                    .map((id, index) => {
                        const found = agentMemories.find((m) => m.id === id)
                        return found ? { ...found, order: index } : undefined
                    })
                    .filter((m): m is MemoryResource => m !== undefined)
                agentMemories = [...others, ...ordered]
                return undefined as unknown as T
            }
            throw new Error(`Mock API has no handler for PATCH ${path}`)
        },

        async delete<T>(path: string): Promise<T> {
            // /memories/:id
            const globalById = /^\/memories\/(\d+)$/.exec(path)
            if (globalById) {
                const id = Number(globalById[1])
                globalMemories = globalMemories.filter((m) => m.id !== id)
                return undefined as unknown as T
            }
            // /agents/:id/memories/:memoryId
            const agentOne = /^\/agents\/(\d+)\/memories\/(\d+)$/.exec(path)
            if (agentOne) {
                const memoryId = Number(agentOne[2])
                agentMemories = agentMemories.filter((m) => m.id !== memoryId)
                return undefined as unknown as T
            }
            throw new Error(`Mock API has no handler for DELETE ${path}`)
        },
    }
}

// Expose the fixture arrays so tests can assert on known seed data.
export const FIXTURE_AGENTS = AGENTS
export const FIXTURE_GLOBAL = FIXTURE.filter((m) => m.agent_id === null)
export const FIXTURE_AGENT = FIXTURE.filter((m) => m.agent_id !== null)
