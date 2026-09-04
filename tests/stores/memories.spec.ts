/**
 * memories store — covers CRUD + reorder actions for global and
 * agent-scoped memories.
 *
 * Plug-side port of `spora-frontend/tests/apps/memories/stores/memories.spec.ts`.
 *
 * Notable diffs:
 *   - `vi.mock('@/api/client', ...)` → `vi.mock('../../src/api/client', ...)`
 *     since `ApiError` is now plugin-local (mirrors the host's shape).
 *   - `vi.mock('@/apps/memories/api/memories', ...)` →
 *     `vi.mock('../../src/api/memories', ...)`
 *   - The import path for `useMemoriesStore` matches the plugin layout.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const {
    getGlobalMemoriesMock,
    createGlobalMemoryMock,
    updateGlobalMemoryMock,
    deleteGlobalMemoryMock,
    reorderGlobalMemoriesMock,
    getAgentMemoriesMock,
    createAgentMemoryMock,
    updateAgentMemoryMock,
    deleteAgentMemoryMock,
    reorderAgentMemoriesMock,
} = vi.hoisted(() => ({
    getGlobalMemoriesMock: vi.fn(),
    createGlobalMemoryMock: vi.fn(),
    updateGlobalMemoryMock: vi.fn(),
    deleteGlobalMemoryMock: vi.fn(),
    reorderGlobalMemoriesMock: vi.fn(),
    getAgentMemoriesMock: vi.fn(),
    createAgentMemoryMock: vi.fn(),
    updateAgentMemoryMock: vi.fn(),
    deleteAgentMemoryMock: vi.fn(),
    reorderAgentMemoriesMock: vi.fn(),
}))

vi.mock('../../src/api/client', () => ({
    ApiError: class ApiError extends Error {
        constructor(message: string) { super(message); this.name = 'ApiError' }
    },
}))

vi.mock('../../src/api/memories', () => ({
    getGlobalMemories: getGlobalMemoriesMock,
    createGlobalMemory: createGlobalMemoryMock,
    updateGlobalMemory: updateGlobalMemoryMock,
    deleteGlobalMemory: deleteGlobalMemoryMock,
    replaceGlobalMemory: vi.fn(),
    reorderGlobalMemories: reorderGlobalMemoriesMock,
    getAgentMemories: getAgentMemoriesMock,
    createAgentMemory: createAgentMemoryMock,
    updateAgentMemory: updateAgentMemoryMock,
    deleteAgentMemory: deleteAgentMemoryMock,
    replaceAgentMemory: vi.fn(),
    reorderAgentMemories: reorderAgentMemoriesMock,
}))

import { ApiError } from '../../src/api/client'
import { useMemoriesStore } from '../../src/stores/memories'

const sampleMem = (over: Record<string, unknown> = {}) => ({
    id: '11111111-1111-7111-b012-111111111111',
    name: 'M',
    content: 'C',
    summary: null,
    order: 0,
    agent_id: null,
    principal_id: 42,
    scope: 'global' as const,
    type: 'context' as const,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
})

beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
})

describe('memories store', () => {
    describe('initial state', () => {
        it('exposes empty lists and null state initially', () => {
            const store = useMemoriesStore()
            expect(store.globalMemories).toEqual([])
            expect(store.agentMemories).toEqual([])
            expect(store.loadingGlobal).toBe(false)
            expect(store.loadingAgent).toBe(false)
            expect(store.saving).toBe(false)
            expect(store.error).toBeNull()
        })
    })

    describe('global memories', () => {
        it('loadGlobalMemories sets loading then globalMemories', async () => {
            const id = '11111111-1111-7111-b012-111111111111'
            getGlobalMemoriesMock.mockResolvedValueOnce([sampleMem({ id, name: 'G1' })])
            const store = useMemoriesStore()
            await store.loadGlobalMemories()
            expect(store.globalMemories).toHaveLength(1)
            expect(store.globalMemories[0]?.name).toBe('G1')
            expect(store.loadingGlobal).toBe(false)
        })

        it('loadGlobalMemories passes the optional type argument to the API', async () => {
            getGlobalMemoriesMock.mockResolvedValueOnce([])
            const store = useMemoriesStore()
            await store.loadGlobalMemories('plan')
            expect(getGlobalMemoriesMock).toHaveBeenCalledWith('plan')
        })

        it('loadGlobalMemories sets error on ApiError', async () => {
            getGlobalMemoriesMock.mockRejectedValueOnce(new ApiError('boom', 'BOOM', 500))
            const store = useMemoriesStore()
            await store.loadGlobalMemories()
            expect(store.error).toBe('boom')
        })

        it('loadGlobalMemories sets generic error on non-ApiError', async () => {
            getGlobalMemoriesMock.mockRejectedValueOnce(new Error('nope'))
            const store = useMemoriesStore()
            await store.loadGlobalMemories()
            expect(store.error).toBe('Failed to load memories.')
        })

        it('createGlobalMemory appends to the list and returns the new memory', async () => {
            const newMem = sampleMem({ id: '11111111-1111-7111-b012-111111111112', name: 'new' })
            createGlobalMemoryMock.mockResolvedValueOnce(newMem)
            const store = useMemoriesStore()
            const result = await store.createGlobalMemory({ name: 'new', type: 'context', content: 'c' })
            expect(result).toEqual(newMem)
            expect(store.globalMemories).toHaveLength(1)
        })

        it('createGlobalMemory throws and sets error on failure', async () => {
            createGlobalMemoryMock.mockRejectedValueOnce(new ApiError('dup', 'DUPLICATE_NAME', 409))
            const store = useMemoriesStore()
            await expect(store.createGlobalMemory({ name: 'n', type: 'context', content: 'c' })).rejects.toThrow(ApiError)
            expect(store.error).toBe('dup')
        })

        it('updateGlobalMemory replaces the memory at the matching index', async () => {
            const id = '11111111-1111-7111-b012-111111111111'
            updateGlobalMemoryMock.mockResolvedValueOnce(sampleMem({ id, name: 'updated' }))
            const store = useMemoriesStore()
            store.globalMemories.push(sampleMem({ id, name: 'orig' }))
            await store.updateGlobalMemory(id, { name: 'updated' })
            expect(store.globalMemories[0]?.name).toBe('updated')
        })

        it('updateGlobalMemory throws and sets error on non-ApiError', async () => {
            const id = '11111111-1111-7111-b012-111111111111'
            updateGlobalMemoryMock.mockRejectedValueOnce(new Error('nope'))
            const store = useMemoriesStore()
            await expect(store.updateGlobalMemory(id, { name: 'x' })).rejects.toThrow()
            expect(store.error).toBe('Failed to update memory.')
        })

        it('deleteGlobalMemory removes from the list', async () => {
            const idA = '11111111-1111-7111-b012-111111111111'
            const idB = '22222222-2222-7222-b012-222222222222'
            deleteGlobalMemoryMock.mockResolvedValueOnce(undefined)
            const store = useMemoriesStore()
            store.globalMemories.push(sampleMem({ id: idA }), sampleMem({ id: idB }))
            await store.deleteGlobalMemory(idA)
            expect(store.globalMemories).toHaveLength(1)
            expect(store.globalMemories[0]?.id).toBe(idB)
        })

        it('deleteGlobalMemory throws and sets error on non-ApiError', async () => {
            const id = '11111111-1111-7111-b012-111111111111'
            deleteGlobalMemoryMock.mockRejectedValueOnce(new Error('nope'))
            const store = useMemoriesStore()
            await expect(store.deleteGlobalMemory(id)).rejects.toThrow()
            expect(store.error).toBe('Failed to delete memory.')
        })

        it('reorderGlobalMemories reorders the list in place', async () => {
            const a = '11111111-1111-7111-b012-111111111111'
            const b = '22222222-2222-7222-b012-222222222222'
            const c = '33333333-3333-7333-b012-333333333333'
            reorderGlobalMemoriesMock.mockResolvedValueOnce(undefined)
            const store = useMemoriesStore()
            store.globalMemories.push(
                sampleMem({ id: a, order: 0 }),
                sampleMem({ id: b, order: 1 }),
                sampleMem({ id: c, order: 2 }),
            )
            await store.reorderGlobalMemories([c, a, b])
            expect(store.globalMemories.map((m) => m.id)).toEqual([c, a, b])
        })

        it('reorderGlobalMemories throws on non-ApiError', async () => {
            reorderGlobalMemoriesMock.mockRejectedValueOnce(new Error('nope'))
            const store = useMemoriesStore()
            await expect(store.reorderGlobalMemories(['1'])).rejects.toThrow()
            expect(store.error).toBe('Failed to reorder memories.')
        })
    })

    describe('agent memories', () => {
        it('loadAgentMemories sets agentMemories', async () => {
            getAgentMemoriesMock.mockResolvedValueOnce([sampleMem({ id: '11111111-1111-7111-b012-111111111111', agent_id: 7 })])
            const store = useMemoriesStore()
            await store.loadAgentMemories(7)
            expect(store.agentMemories).toHaveLength(1)
        })

        it('loadAgentMemories forwards the optional type filter', async () => {
            getAgentMemoriesMock.mockResolvedValueOnce([])
            const store = useMemoriesStore()
            await store.loadAgentMemories(7, 'plan')
            expect(getAgentMemoriesMock).toHaveBeenCalledWith(7, 'plan')
        })

        it('loadAgentMemories sets error on ApiError', async () => {
            getAgentMemoriesMock.mockRejectedValueOnce(new ApiError('err', 'ERR', 500))
            const store = useMemoriesStore()
            await store.loadAgentMemories(7)
            expect(store.error).toBe('err')
        })

        it('createAgentMemory appends and returns the new memory', async () => {
            const newMem = sampleMem({ id: '11111111-1111-7111-b012-11111111111b', agent_id: 7 })
            createAgentMemoryMock.mockResolvedValueOnce(newMem)
            const store = useMemoriesStore()
            const result = await store.createAgentMemory(7, { name: 'n', type: 'context', content: 'c' })
            expect(result).toEqual(newMem)
            expect(store.agentMemories).toHaveLength(1)
        })

        it('updateAgentMemory replaces at the matching index', async () => {
            const id = '11111111-1111-7111-b012-111111111111'
            updateAgentMemoryMock.mockResolvedValueOnce(sampleMem({ id, name: 'up' }))
            const store = useMemoriesStore()
            store.agentMemories.push(sampleMem({ id, name: 'orig' }))
            await store.updateAgentMemory(7, id, { name: 'up' })
            expect(store.agentMemories[0]?.name).toBe('up')
        })

        it('deleteAgentMemory removes from the list', async () => {
            const idA = '11111111-1111-7111-b012-111111111111'
            const idB = '22222222-2222-7222-b012-222222222222'
            deleteAgentMemoryMock.mockResolvedValueOnce(undefined)
            const store = useMemoriesStore()
            store.agentMemories.push(sampleMem({ id: idA }), sampleMem({ id: idB }))
            await store.deleteAgentMemory(7, idA)
            expect(store.agentMemories).toHaveLength(1)
        })

        it('reorderAgentMemories reorders the list', async () => {
            const a = '11111111-1111-7111-b012-111111111111'
            const b = '22222222-2222-7222-b012-222222222222'
            const c = '33333333-3333-7333-b012-333333333333'
            reorderAgentMemoriesMock.mockResolvedValueOnce(undefined)
            const store = useMemoriesStore()
            store.agentMemories.push(
                sampleMem({ id: a }),
                sampleMem({ id: b }),
                sampleMem({ id: c }),
            )
            await store.reorderAgentMemories(7, [c, a, b])
            expect(store.agentMemories.map((m) => m.id)).toEqual([c, a, b])
        })

        it('reorderAgentMemories throws on non-ApiError', async () => {
            reorderAgentMemoriesMock.mockRejectedValueOnce(new Error('nope'))
            const store = useMemoriesStore()
            await expect(store.reorderAgentMemories(7, ['1'])).rejects.toThrow()
            expect(store.error).toBe('Failed to reorder memories.')
        })
    })
})
