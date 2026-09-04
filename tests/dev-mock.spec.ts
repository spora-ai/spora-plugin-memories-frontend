/**
 * Dev-mock coverage for the memories fixtures.
 *
 * Verifies the in-memory mock honours the same CRUD surface the PHP
 * controllers expose, so the dev sandbox (`npm run dev`) reflects
 * realistic backend behaviour — UUID path vars, `principal_id` /
 * `scope` / `type` on every row, the new `replace` endpoints, and
 * the `?type=` filter on both global and agent lists.
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
            const result = await api.get<{ memories: Array<{ id: string }> }>('/memories')
            expect(result.memories.length).toBe(FIXTURE_GLOBAL.length)
        })

        it('returns a single global memory by id', async () => {
            const target = FIXTURE_GLOBAL[0]
            expect(target).toBeDefined()
            const result = await api.get<{ memory: { id: string; name: string } }>(`/memories/${target!.id}`)
            expect(result.memory.id).toBe(target!.id)
            expect(result.memory.name).toBeTruthy()
        })

        it('throws when fetching a missing global memory', async () => {
            await expect(api.get('/memories/00000000-0000-7000-b000-000000000000')).rejects.toThrow('Not found:')
        })

        it('filters global memories by ?type=', async () => {
            const result = await api.get<{ memories: Array<{ type: string }> }>('/memories?type=documentation')
            expect(result.memories.length).toBeGreaterThan(0)
            expect(result.memories.every((m) => m.type === 'documentation')).toBe(true)
        })

        it('lists per-agent memories via /agents/:id/memories', async () => {
            const result = await api.get<{ memories: Array<{ id: string; agent_id: number }> }>('/agents/7/memories')
            expect(result.memories.every((m) => m.agent_id === 7)).toBe(true)
        })

        it('filters agent memories by ?type=', async () => {
            const result = await api.get<{ memories: Array<{ agent_id: number; type: string }> }>('/agents/7/memories?type=plan')
            expect(result.memories.every((m) => m.agent_id === 7 && m.type === 'plan')).toBe(true)
        })

        it('returns empty list for an agent with no memories', async () => {
            const result = await api.get<{ memories: Array<{ id: string }> }>('/agents/999/memories')
            expect(result.memories).toEqual([])
        })

        it('returns a single agent memory by id', async () => {
            const target = FIXTURE_AGENT[0]
            expect(target).toBeDefined()
            const result = await api.get<{ memory: { id: string; agent_id: number } }>(`/agents/7/memories/${target!.id}`)
            expect(result.memory.id).toBe(target!.id)
            expect(result.memory.agent_id).toBe(7)
        })

        it('throws when fetching a missing agent memory', async () => {
            await expect(api.get('/agents/7/memories/00000000-0000-7000-b000-000000000000')).rejects.toThrow('Not found:')
        })

        it('returns an envelope of agents for /agents', async () => {
            const result = await api.get<{ agents: Array<{ id: number; name: string }> }>('/agents')
            expect(result.agents.length).toBe(FIXTURE_AGENTS.length)
        })

        it('returns the principal envelope for /principals/me', async () => {
            const result = await api.get<{ principals: Array<{ id: number; type: string }> }>('/principals/me')
            expect(result.principals.length).toBeGreaterThan(0)
            expect(result.principals[0]?.type).toBe('user')
        })

        it('throws when given an unknown route', async () => {
            await expect(api.get('/nope')).rejects.toThrow('Mock API has no handler for /nope')
        })
    })

    describe('POST endpoints', () => {
        it('creates a global memory with the given type and appends to the list', async () => {
            const before = (await api.get<{ memories: unknown[] }>('/memories')).memories.length
            const created = await api.post<{ memory: { id: string; name: string; type: string; order: number } }>(
                '/memories',
                { name: 'fresh', type: 'plan', content: 'c', summary: 's' },
            )
            const after = (await api.get<{ memories: unknown[] }>('/memories')).memories.length
            expect(created.memory.name).toBe('fresh')
            expect(created.memory.type).toBe('plan')
            expect(created.memory.order).toBe(before)
            expect(after).toBe(before + 1)
        })

        it('falls back to defaults when POST /memories body fields are missing', async () => {
            const created = await api.post<{ memory: { name: string; type: string; summary: string | null; content: string | null } }>(
                '/memories',
                {},
            )
            expect(created.memory.name).toBe('untitled')
            expect(created.memory.type).toBe('context')
            expect(created.memory.summary).toBeNull()
            expect(created.memory.content).toBeNull()
        })

        it('creates an agent-scoped memory via POST /agents/:id/memories', async () => {
            const before = (await api.get<{ memories: Array<{ id: string }> }>('/agents/8/memories')).memories.length
            const created = await api.post<{ memory: { id: string; name: string; agent_id: number; order: number } }>(
                '/agents/8/memories',
                { name: 'agent-only', type: 'context', content: 'c' },
            )
            const after = (await api.get<{ memories: Array<{ id: string }> }>('/agents/8/memories')).memories.length
            expect(created.memory.agent_id).toBe(8)
            expect(created.memory.order).toBe(before)
            expect(after).toBe(before + 1)
        })

        it('replaces a single global substring when the anchor is unique', async () => {
            const target = FIXTURE_GLOBAL[0]
            expect(target).toBeDefined()
            const created = await api.post<{ memory: { content: string } }>(
                `/memories/${target!.id}/replace`,
                { name: target!.name, type: 'context', find: 'Likes bullet points', new_text: 'LISTS THINGS' },
            )
            expect(created.memory.content).toContain('LISTS THINGS')
            expect(created.memory.content).not.toContain('Likes bullet points')
        })

        it('throws when the global replace anchor matches zero times', async () => {
            const target = FIXTURE_GLOBAL[0]
            expect(target).toBeDefined()
            await expect(
                api.post(`/memories/${target!.id}/replace`, {
                    name: target!.name, type: 'context', find: 'no-such-substring', new_text: 'x',
                }),
            ).rejects.toThrow('0 occurrences')
        })

        it('throws when the global replace anchor matches more than once', async () => {
            const target = FIXTURE_GLOBAL[1]
            expect(target).toBeDefined()
            // 'a' appears multiple times in any non-trivial string.
            await expect(
                api.post(`/memories/${target!.id}/replace`, {
                    name: target!.name, type: 'context', find: 'a', new_text: 'b',
                }),
            ).rejects.toThrow(/occurrences/)
        })

        it('replaces a single agent substring when the anchor is unique', async () => {
            const target = FIXTURE_AGENT[0]
            expect(target).toBeDefined()
            const created = await api.post<{ memory: { content: string } }>(
                `/agents/7/memories/${target!.id}/replace`,
                { name: target!.name, type: 'context', find: 'This week: Alice', new_text: 'This week: Bob' },
            )
            expect(created.memory.content).toContain('Bob')
        })

        it('throws when POSTing to an unknown path', async () => {
            await expect(api.post('/nope', {})).rejects.toThrow('Mock API has no handler for POST /nope')
        })
    })

    describe('PUT endpoints', () => {
        it('updates a global memory and bumps updated_at', async () => {
            const target = FIXTURE_GLOBAL[0]
            expect(target).toBeDefined()
            const updated = await api.put<{ memory: { id: string; name: string } }>(
                `/memories/${target!.id}`,
                { name: 'renamed' },
            )
            expect(updated.memory.id).toBe(target!.id)
            expect(updated.memory.name).toBe('renamed')
        })

        it('throws when updating a missing global memory', async () => {
            await expect(api.put('/memories/00000000-0000-7000-b000-000000000000', { name: 'x' })).rejects.toThrow('Not found:')
        })

        it('updates an agent-scoped memory', async () => {
            const target = FIXTURE_AGENT[0]
            expect(target).toBeDefined()
            const updated = await api.put<{ memory: { id: string; name: string } }>(
                `/agents/7/memories/${target!.id}`,
                { name: 'updated-agent' },
            )
            expect(updated.memory.id).toBe(target!.id)
            expect(updated.memory.name).toBe('updated-agent')
        })

        it('throws when updating a missing agent memory', async () => {
            await expect(api.put('/agents/7/memories/00000000-0000-7000-b000-000000000000', { name: 'x' })).rejects.toThrow('Not found:')
        })

        it('throws when PUTting to an unknown path', async () => {
            await expect(api.put('/nope', { name: 'x' })).rejects.toThrow('Mock API has no handler for PUT /nope')
        })
    })

    describe('PATCH (reorder) endpoints', () => {
        it('reorders global memories and persists the new order', async () => {
            const before = await api.get<{ memories: Array<{ id: string }> }>('/memories')
            const ids = before.memories.map((m) => m.id).reverse()
            await api.patch('/memories/reorder', { order: ids })
            const after = await api.get<{ memories: Array<{ id: string }> }>('/memories')
            expect(after.memories.map((m) => m.id)).toEqual(ids)
        })

        it('reorders agent-scoped memories without losing other agents', async () => {
            const distinctAgents = new Set(FIXTURE_AGENT.map((m) => m.agent_id))
            expect(distinctAgents.size).toBeGreaterThan(0)

            const before = await api.get<{ memories: Array<{ id: string; agent_id: number }> }>('/agents/7/memories')
            const ids = before.memories.map((m) => m.id).reverse()
            await api.patch('/agents/7/memories/reorder', { order: ids })

            const after = await api.get<{ memories: Array<{ id: string }> }>('/agents/7/memories')
            expect(after.memories.map((m) => m.id)).toEqual(ids)
        })

        it('throws when PATCHing an unknown path', async () => {
            await expect(api.patch('/nope', { order: [] })).rejects.toThrow('Mock API has no handler for PATCH /nope')
        })
    })

    describe('DELETE endpoints', () => {
        it('deletes a global memory', async () => {
            const target = FIXTURE_GLOBAL[0]
            expect(target).toBeDefined()
            const before = (await api.get<{ memories: Array<{ id: string }> }>('/memories')).memories.length
            await api.delete(`/memories/${target!.id}`)
            const after = (await api.get<{ memories: Array<{ id: string }> }>('/memories')).memories.length
            expect(after).toBe(before - 1)
        })

        it('deletes an agent-scoped memory', async () => {
            const target = FIXTURE_AGENT[0]
            expect(target).toBeDefined()
            const before = (await api.get<{ memories: Array<{ id: string }> }>('/agents/7/memories')).memories.length
            await api.delete(`/agents/7/memories/${target!.id}`)
            const after = (await api.get<{ memories: Array<{ id: string }> }>('/agents/7/memories')).memories.length
            expect(after).toBe(before - 1)
        })

        it('throws when DELETEing an unknown path', async () => {
            await expect(api.delete('/nope')).rejects.toThrow('Mock API has no handler for DELETE /nope')
        })
    })
})