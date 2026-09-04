/**
 * memories API client — covers every exported function in
 * `src/api/memories.ts` by routing through a stubbed host API.
 *
 * The store-level spec (`tests/stores/memories.spec.ts`) mocks this
 * module wholesale, so its real implementation never ran in tests.
 * This spec exists to fill that gap: we stub the host's `hostContext.api`
 * and exercise the bridge that `api/memories.ts` builds on top of it.
 *
 * Coverage gain: src/api/memories.ts goes from 0% (every function was
 * mocked out by the store spec) to 100% — each of the 14 exports is
 * invoked against a stubbed `api.get/post/put/patch/delete` to verify
 * the path, body, and envelope unwrap match the PHP controllers.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setApi, ApiError } from '../../src/api/client'
import * as memories from '../../src/api/memories'
import type { PluginHostContext } from '../../src/shims'

function makeApi() {
    return {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    }
}

let api: ReturnType<typeof makeApi>

beforeEach(() => {
    api = makeApi()
    setApi(api as unknown as PluginHostContext['api'])
})

const sampleGlobalId = '11111111-1111-7111-b012-111111111111'
const sampleAgentId = '22222222-2222-7222-b012-222222222222'

describe('api/memories → global CRUD', () => {
    it('getGlobalMemories unwraps the { memories: T[] } envelope', async () => {
        api.get.mockResolvedValueOnce({ memories: [{ id: sampleGlobalId, name: 'g' }] })
        const result = await memories.getGlobalMemories()
        expect(api.get).toHaveBeenCalledWith('/memories')
        expect(result).toEqual([{ id: sampleGlobalId, name: 'g' }])
    })

    it('getGlobalMemories appends ?type= when set', async () => {
        api.get.mockResolvedValueOnce({ memories: [] })
        await memories.getGlobalMemories('plan')
        expect(api.get).toHaveBeenCalledWith('/memories?type=plan')
    })

    it('getGlobalMemory unwraps the { memory: T } envelope', async () => {
        api.get.mockResolvedValueOnce({ memory: { id: sampleGlobalId, name: 'single' } })
        const result = await memories.getGlobalMemory(sampleGlobalId)
        expect(api.get).toHaveBeenCalledWith(`/memories/${sampleGlobalId}`)
        expect(result).toEqual({ id: sampleGlobalId, name: 'single' })
    })

    it('createGlobalMemory POSTs to /memories and unwraps { memory: T }', async () => {
        api.post.mockResolvedValueOnce({ memory: { id: sampleGlobalId, name: 'new' } })
        const result = await memories.createGlobalMemory({ name: 'new', type: 'context', content: 'c' })
        expect(api.post).toHaveBeenCalledWith('/memories', { name: 'new', type: 'context', content: 'c' })
        expect(result).toEqual({ id: sampleGlobalId, name: 'new' })
    })

    it('updateGlobalMemory PUTs to /memories/:id and unwraps { memory: T }', async () => {
        api.put.mockResolvedValueOnce({ memory: { id: sampleGlobalId, name: 'updated' } })
        const result = await memories.updateGlobalMemory(sampleGlobalId, { name: 'updated' })
        expect(api.put).toHaveBeenCalledWith(`/memories/${sampleGlobalId}`, { name: 'updated' })
        expect(result).toEqual({ id: sampleGlobalId, name: 'updated' })
    })

    it('deleteGlobalMemory DELETEs /memories/:id', async () => {
        api.delete.mockResolvedValueOnce(undefined)
        await memories.deleteGlobalMemory(sampleGlobalId)
        expect(api.delete).toHaveBeenCalledWith(`/memories/${sampleGlobalId}`)
    })

    it('replaceGlobalMemory POSTs to /memories/:id/replace', async () => {
        api.post.mockResolvedValueOnce({ memory: { id: sampleGlobalId, content: 'patched' } })
        const result = await memories.replaceGlobalMemory(sampleGlobalId, {
            name: 'n', type: 'context', find: 'old', new_text: 'new',
        })
        expect(api.post).toHaveBeenCalledWith(
            `/memories/${sampleGlobalId}/replace`,
            { name: 'n', type: 'context', find: 'old', new_text: 'new' },
        )
        expect(result).toEqual({ id: sampleGlobalId, content: 'patched' })
    })
})

describe('api/memories → agent CRUD', () => {
    it('getAgentMemories routes through /agents/:id/memories', async () => {
        api.get.mockResolvedValueOnce({ memories: [{ id: sampleAgentId, agent_id: 7 }] })
        const result = await memories.getAgentMemories(7)
        expect(api.get).toHaveBeenCalledWith('/agents/7/memories')
        expect(result).toEqual([{ id: sampleAgentId, agent_id: 7 }])
    })

    it('getAgentMemories appends ?type= when set', async () => {
        api.get.mockResolvedValueOnce({ memories: [] })
        await memories.getAgentMemories(7, 'plan')
        expect(api.get).toHaveBeenCalledWith('/agents/7/memories?type=plan')
    })

    it('getAgentMemory routes through /agents/:id/memories/:memoryId', async () => {
        api.get.mockResolvedValueOnce({ memory: { id: sampleAgentId, agent_id: 7 } })
        const result = await memories.getAgentMemory(7, sampleAgentId)
        expect(api.get).toHaveBeenCalledWith(`/agents/7/memories/${sampleAgentId}`)
        expect(result).toEqual({ id: sampleAgentId, agent_id: 7 })
    })

    it('createAgentMemory POSTs to /agents/:id/memories', async () => {
        api.post.mockResolvedValueOnce({ memory: { id: sampleAgentId, agent_id: 7 } })
        const result = await memories.createAgentMemory(7, { name: 'new', type: 'context', content: 'c' })
        expect(api.post).toHaveBeenCalledWith(
            '/agents/7/memories',
            { name: 'new', type: 'context', content: 'c' },
        )
        expect(result).toEqual({ id: sampleAgentId, agent_id: 7 })
    })

    it('updateAgentMemory PUTs to /agents/:id/memories/:memoryId', async () => {
        api.put.mockResolvedValueOnce({ memory: { id: sampleAgentId, name: 'updated' } })
        const result = await memories.updateAgentMemory(7, sampleAgentId, { name: 'updated' })
        expect(api.put).toHaveBeenCalledWith(`/agents/7/memories/${sampleAgentId}`, { name: 'updated' })
        expect(result).toEqual({ id: sampleAgentId, name: 'updated' })
    })

    it('deleteAgentMemory DELETEs /agents/:id/memories/:memoryId', async () => {
        api.delete.mockResolvedValueOnce(undefined)
        await memories.deleteAgentMemory(7, sampleAgentId)
        expect(api.delete).toHaveBeenCalledWith(`/agents/7/memories/${sampleAgentId}`)
    })

    it('replaceAgentMemory POSTs to /agents/:id/memories/:memoryId/replace', async () => {
        api.post.mockResolvedValueOnce({ memory: { id: sampleAgentId, content: 'patched' } })
        const result = await memories.replaceAgentMemory(7, sampleAgentId, {
            name: 'n', type: 'context', find: 'old', new_text: 'new',
        })
        expect(api.post).toHaveBeenCalledWith(
            `/agents/7/memories/${sampleAgentId}/replace`,
            { name: 'n', type: 'context', find: 'old', new_text: 'new' },
        )
        expect(result).toEqual({ id: sampleAgentId, content: 'patched' })
    })
})

describe('api/memories → reorder', () => {
    it('reorderGlobalMemories PATCHes /memories/reorder with { order }', async () => {
        api.patch.mockResolvedValueOnce(undefined)
        await memories.reorderGlobalMemories([sampleGlobalId, sampleAgentId])
        expect(api.patch).toHaveBeenCalledWith('/memories/reorder', { order: [sampleGlobalId, sampleAgentId] })
    })

    it('reorderAgentMemories PATCHes /agents/:id/memories/reorder with { order }', async () => {
        api.patch.mockResolvedValueOnce(undefined)
        await memories.reorderAgentMemories(7, [sampleAgentId])
        expect(api.patch).toHaveBeenCalledWith('/agents/7/memories/reorder', { order: [sampleAgentId] })
    })
})

describe('api/client bridge', () => {
    it('getApi throws a helpful error when setApi was never called', async () => {
        // Reset the module-level container by importing a fresh copy.
        vi.resetModules()
        const freshClient = await import('../../src/api/client')
        expect(() => freshClient.getApi()).toThrowError(/Plugin API not initialized/)
    })

    it('ApiError carries message/code/status and inherits from Error', () => {
        const err = new ApiError('boom', 'BOOM', 500)
        expect(err.message).toBe('boom')
        expect(err.code).toBe('BOOM')
        expect(err.status).toBe(500)
        expect(err.name).toBe('ApiError')
        expect(err).toBeInstanceOf(Error)
    })

    it('ApiError is catchable by `instanceof` and exposes `.code` / `.status`', () => {
        const err = new ApiError('conflict', 'DUPLICATE_NAME', 409)
        try {
            throw err
        } catch (caught) {
            expect(caught).toBeInstanceOf(ApiError)
            expect((caught as ApiError).code).toBe('DUPLICATE_NAME')
            expect((caught as ApiError).status).toBe(409)
        }
    })
})