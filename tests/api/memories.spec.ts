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
 * mocked out by the store spec) to 100% — each of the 12 exports is
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

describe('api/memories → global CRUD', () => {
    it('getGlobalMemories unwraps the { memories: T[] } envelope', async () => {
        api.get.mockResolvedValueOnce({ memories: [{ id: 1, name: 'g' }] })
        const result = await memories.getGlobalMemories()
        expect(api.get).toHaveBeenCalledWith('/memories')
        expect(result).toEqual([{ id: 1, name: 'g' }])
    })

    it('getGlobalMemory unwraps the { memory: T } envelope', async () => {
        api.get.mockResolvedValueOnce({ memory: { id: 7, name: 'single' } })
        const result = await memories.getGlobalMemory(7)
        expect(api.get).toHaveBeenCalledWith('/memories/7')
        expect(result).toEqual({ id: 7, name: 'single' })
    })

    it('createGlobalMemory POSTs to /memories and unwraps { memory: T }', async () => {
        api.post.mockResolvedValueOnce({ memory: { id: 9, name: 'new' } })
        const result = await memories.createGlobalMemory({ name: 'new', content: 'c' })
        expect(api.post).toHaveBeenCalledWith('/memories', { name: 'new', content: 'c' })
        expect(result).toEqual({ id: 9, name: 'new' })
    })

    it('updateGlobalMemory PUTs to /memories/:id and unwraps { memory: T }', async () => {
        api.put.mockResolvedValueOnce({ memory: { id: 4, name: 'updated' } })
        const result = await memories.updateGlobalMemory(4, { name: 'updated' })
        expect(api.put).toHaveBeenCalledWith('/memories/4', { name: 'updated' })
        expect(result).toEqual({ id: 4, name: 'updated' })
    })

    it('deleteGlobalMemory DELETEs /memories/:id', async () => {
        api.delete.mockResolvedValueOnce(undefined)
        await memories.deleteGlobalMemory(4)
        expect(api.delete).toHaveBeenCalledWith('/memories/4')
    })
})

describe('api/memories → agent CRUD', () => {
    it('getAgentMemories routes through /agents/:id/memories', async () => {
        api.get.mockResolvedValueOnce({ memories: [{ id: 1, agent_id: 7 }] })
        const result = await memories.getAgentMemories(7)
        expect(api.get).toHaveBeenCalledWith('/agents/7/memories')
        expect(result).toEqual([{ id: 1, agent_id: 7 }])
    })

    it('getAgentMemory routes through /agents/:id/memories/:memoryId', async () => {
        api.get.mockResolvedValueOnce({ memory: { id: 5, agent_id: 7 } })
        const result = await memories.getAgentMemory(7, 5)
        expect(api.get).toHaveBeenCalledWith('/agents/7/memories/5')
        expect(result).toEqual({ id: 5, agent_id: 7 })
    })

    it('createAgentMemory POSTs to /agents/:id/memories', async () => {
        api.post.mockResolvedValueOnce({ memory: { id: 11, agent_id: 7 } })
        const result = await memories.createAgentMemory(7, { name: 'new', content: 'c' })
        expect(api.post).toHaveBeenCalledWith('/agents/7/memories', { name: 'new', content: 'c' })
        expect(result).toEqual({ id: 11, agent_id: 7 })
    })

    it('updateAgentMemory PUTs to /agents/:id/memories/:memoryId', async () => {
        api.put.mockResolvedValueOnce({ memory: { id: 5, name: 'updated' } })
        const result = await memories.updateAgentMemory(7, 5, { name: 'updated' })
        expect(api.put).toHaveBeenCalledWith('/agents/7/memories/5', { name: 'updated' })
        expect(result).toEqual({ id: 5, name: 'updated' })
    })

    it('deleteAgentMemory DELETEs /agents/:id/memories/:memoryId', async () => {
        api.delete.mockResolvedValueOnce(undefined)
        await memories.deleteAgentMemory(7, 5)
        expect(api.delete).toHaveBeenCalledWith('/agents/7/memories/5')
    })
})

describe('api/memories → reorder', () => {
    it('reorderGlobalMemories PATCHes /memories/reorder with { order }', async () => {
        api.patch.mockResolvedValueOnce(undefined)
        await memories.reorderGlobalMemories([3, 1, 2])
        expect(api.patch).toHaveBeenCalledWith('/memories/reorder', { order: [3, 1, 2] })
    })

    it('reorderAgentMemories PATCHes /agents/:id/memories/reorder with { order }', async () => {
        api.patch.mockResolvedValueOnce(undefined)
        await memories.reorderAgentMemories(7, [3, 1, 2])
        expect(api.patch).toHaveBeenCalledWith('/agents/7/memories/reorder', { order: [3, 1, 2] })
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