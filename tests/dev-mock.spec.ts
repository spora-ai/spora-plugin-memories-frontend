/**
 * Dev-mock coverage for the memories fixtures.
 *
 * Verifies the in-memory mock honours the same CRUD surface the PHP
 * controllers expose, so the dev sandbox (`npm run dev`) reflects
 * realistic backend behaviour.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createMockApi, FIXTURE_AGENTS, FIXTURE_GLOBAL, FIXTURE_AGENT } from '../src/dev-mock'

describe('createMockApi', () => {
    let api: ReturnType<typeof createMockApi>

    beforeEach(() => {
        api = createMockApi()
    })

    describe('GET endpoints', () => {
        it('returns the full global list when /memories is called', async () => {
            const result = await api.get<{ memories: Array<{ id: number }> }>('/memories')
            expect(result.memories.length).toBe(FIXTURE_GLOBAL.length)
        })

        it('returns a single global memory by id', async () => {
            const result = await api.get<{ memory: { id: number; name: string } }>('/memories/1')
            expect(result.memory.id).toBe(1)
            expect(result.memory.name).toBeTruthy()
        })

        it('throws when fetching a missing global memory', async () => {
            await expect(api.get('/memories/99999')).rejects.toThrow('Not found: 99999')
        })

        it('lists per-agent memories via /agents/:id/memories', async () => {
            const result = await api.get<{ memories: Array<{ id: number; agent_id: number }> }>('/agents/7/memories')
            expect(result.memories.every((m) => m.agent_id === 7)).toBe(true)
        })

        it('returns empty list for an agent with no memories', async () => {
            const result = await api.get<{ memories: Array<{ id: number }> }>('/agents/999/memories')
            expect(result.memories).toEqual([])
        })

        it('returns a single agent memory by id', async () => {
            const result = await api.get<{ memory: { id: number; agent_id: number } }>('/agents/7/memories/4')
            expect(result.memory.id).toBe(4)
            expect(result.memory.agent_id).toBe(7)
        })

        it('throws when fetching a missing agent memory', async () => {
            await expect(api.get('/agents/7/memories/99999')).rejects.toThrow('Not found: 99999')
        })

        it('returns an envelope of agents for /agents', async () => {
            const result = await api.get<{ agents: Array<{ id: number; name: string }> }>('/agents')
            expect(result.agents.length).toBe(FIXTURE_AGENTS.length)
        })

        it('throws when given an unknown route', async () => {
            await expect(api.get('/nope')).rejects.toThrow('Mock API has no handler for /nope')
        })
    })

    describe('POST endpoints', () => {
        it('creates a global memory and appends to the list', async () => {
            const before = (await api.get<{ memories: unknown[] }>('/memories')).memories.length
            const created = await api.post<{ memory: { id: number; name: string; order: number } }>(
                '/memories',
                { name: 'fresh', content: 'c', summary: 's' },
            )
            const after = (await api.get<{ memories: unknown[] }>('/memories')).memories.length
            expect(created.memory.name).toBe('fresh')
            expect(created.memory.order).toBe(before)
            expect(after).toBe(before + 1)
        })

        it('falls back to defaults when POST /memories body fields are missing', async () => {
            const created = await api.post<{ memory: { name: string; summary: string | null; content: string | null } }>(
                '/memories',
                {},
            )
            expect(created.memory.name).toBe('untitled')
            expect(created.memory.summary).toBeNull()
            expect(created.memory.content).toBeNull()
        })

        it('creates an agent-scoped memory via POST /agents/:id/memories', async () => {
            const before = (await api.get<{ memories: Array<{ id: number }> }>('/agents/8/memories')).memories.length
            const created = await api.post<{ memory: { id: number; name: string; agent_id: number; order: number } }>(
                '/agents/8/memories',
                { name: 'agent-only', content: 'c' },
            )
            const after = (await api.get<{ memories: Array<{ id: number }> }>('/agents/8/memories')).memories.length
            expect(created.memory.agent_id).toBe(8)
            expect(created.memory.order).toBe(before)
            expect(after).toBe(before + 1)
        })

        it('throws when POSTing to an unknown path', async () => {
            await expect(api.post('/nope', {})).rejects.toThrow('Mock API has no handler for POST /nope')
        })
    })

    describe('PUT endpoints', () => {
        it('updates a global memory and bumps updated_at', async () => {
            const updated = await api.put<{ memory: { id: number; name: string } }>(
                '/memories/1',
                { name: 'renamed' },
            )
            expect(updated.memory.id).toBe(1)
            expect(updated.memory.name).toBe('renamed')
        })

        it('throws when updating a missing global memory', async () => {
            await expect(api.put('/memories/99999', { name: 'x' })).rejects.toThrow('Not found: 99999')
        })

        it('updates an agent-scoped memory', async () => {
            const updated = await api.put<{ memory: { id: number; name: string } }>(
                '/agents/7/memories/4',
                { name: 'updated-agent' },
            )
            expect(updated.memory.id).toBe(4)
            expect(updated.memory.name).toBe('updated-agent')
        })

        it('throws when updating a missing agent memory', async () => {
            await expect(api.put('/agents/7/memories/99999', { name: 'x' })).rejects.toThrow('Not found: 99999')
        })

        it('throws when PUTting to an unknown path', async () => {
            await expect(api.put('/nope', {})).rejects.toThrow('Mock API has no handler for PUT /nope')
        })
    })

    describe('PATCH (reorder) endpoints', () => {
        it('reorders global memories and persists the new order', async () => {
            const before = await api.get<{ memories: Array<{ id: number }> }>('/memories')
            const ids = before.memories.map((m) => m.id).reverse()
            await api.patch('/memories/reorder', { order: ids })
            const after = await api.get<{ memories: Array<{ id: number }> }>('/memories')
            expect(after.memories.map((m) => m.id)).toEqual(ids)
        })

        it('reorders agent-scoped memories without losing other agents', async () => {
            const distinctAgents = new Set(FIXTURE_AGENT.map((m) => m.agent_id))
            expect(distinctAgents.size).toBeGreaterThan(0)

            const before = await api.get<{ memories: Array<{ id: number; agent_id: number }> }>('/agents/7/memories')
            const ids = before.memories.map((m) => m.id).reverse()
            await api.patch('/agents/7/memories/reorder', { order: ids })

            const after = await api.get<{ memories: Array<{ id: number }> }>('/agents/7/memories')
            expect(after.memories.map((m) => m.id)).toEqual(ids)
        })

        it('throws when PATCHing an unknown path', async () => {
            await expect(api.patch('/nope', { order: [] })).rejects.toThrow('Mock API has no handler for PATCH /nope')
        })
    })

    describe('DELETE endpoints', () => {
        it('deletes a global memory', async () => {
            const before = (await api.get<{ memories: Array<{ id: number }> }>('/memories')).memories.length
            await api.delete('/memories/1')
            const after = (await api.get<{ memories: Array<{ id: number }> }>('/memories')).memories.length
            expect(after).toBe(before - 1)
        })

        it('deletes an agent-scoped memory', async () => {
            const before = (await api.get<{ memories: Array<{ id: number }> }>('/agents/7/memories')).memories.length
            await api.delete('/agents/7/memories/4')
            const after = (await api.get<{ memories: Array<{ id: number }> }>('/agents/7/memories')).memories.length
            expect(after).toBe(before - 1)
        })

        it('throws when DELETEing an unknown path', async () => {
            await expect(api.delete('/nope')).rejects.toThrow('Mock API has no handler for DELETE /nope')
        })
    })
})