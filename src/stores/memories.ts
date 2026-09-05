import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError } from '../api/client'
import type {
    MemoryResource,
    MemoryType,
    CreateMemoryDto,
    UpdateMemoryDto,
    ReplaceMemoryDto,
} from '../types'
import * as api from '../api/memories'
import { usePrincipalsStore } from './principals'

/**
 * Resolve the active principal id lazily from the principals store.
 * Lives at module scope so SonarCloud's S7721 doesn't ask us to
 * hoist it out of every action — it's a closure-free one-liner
 * and the stateful binding happens through Pinia at call time.
 */
function currentPrincipalId(): number | null {
    return usePrincipalsStore().selectedPrincipalId
}

/**
 * Manages global and agent-scoped memories with CRUD, reorder, and
 * surgical-edit operations.
 *
 * Mirrors `spora-frontend/src/apps/memories/stores/memories.ts` (the
 * host-side store this plugin replaces).
 *
 * **Principal scoping:** every action reads `selectedPrincipalId` from
 * `usePrincipalsStore()` at call time and threads it to the API as
 * `?principal_id=N`. The `PrincipalChipRow` is the single source of
 * truth — the store doesn't take a separate principal arg, so callers
 * can't forget to forward it. Pages that already have an active
 * principal in scope (e.g. the MemoriesPage after `selectPrincipal()`)
 * get the right id automatically.
 *
 * Delta vs. host store:
 *   - The `@/api/client` import is rerouted to our local `api/client.ts`
 *     so the catch blocks stay byte-identical.
 *   - `../api/memories` now accepts an optional `principalId` and
 *     appends `?principal_id=` when set.
 */
export const useMemoriesStore = defineStore('memories', () => {
    // State
    const globalMemories = ref<MemoryResource[]>([])
    const agentMemories = ref<MemoryResource[]>([])
    const loadingGlobal = ref(false)
    const loadingAgent = ref(false)
    const saving = ref(false)
    const error = ref<string | null>(null)

    // Global memories

    async function loadGlobalMemories(type?: MemoryType): Promise<void> {
        loadingGlobal.value = true
        error.value = null
        try {
            globalMemories.value = await api.getGlobalMemories(currentPrincipalId(), type)
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to load memories.'
        } finally {
            loadingGlobal.value = false
        }
    }

    async function createGlobalMemory(data: CreateMemoryDto): Promise<MemoryResource> {
        saving.value = true
        error.value = null
        try {
            const memory = await api.createGlobalMemory(currentPrincipalId(), data)
            globalMemories.value.push(memory)
            return memory
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to create memory.'
            throw e
        } finally {
            saving.value = false
        }
    }

    async function updateGlobalMemory(id: string, data: UpdateMemoryDto): Promise<MemoryResource> {
        saving.value = true
        error.value = null
        try {
            const memory = await api.updateGlobalMemory(id, currentPrincipalId(), data)
            const idx = globalMemories.value.findIndex((m) => m.id === id)
            if (idx !== -1) globalMemories.value[idx] = memory
            return memory
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to update memory.'
            throw e
        } finally {
            saving.value = false
        }
    }

    async function deleteGlobalMemory(id: string): Promise<void> {
        saving.value = true
        error.value = null
        try {
            await api.deleteGlobalMemory(id, currentPrincipalId())
            globalMemories.value = globalMemories.value.filter((m) => m.id !== id)
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to delete memory.'
            throw e
        } finally {
            saving.value = false
        }
    }

    async function replaceGlobalMemory(id: string, data: ReplaceMemoryDto): Promise<MemoryResource> {
        saving.value = true
        error.value = null
        try {
            const memory = await api.replaceGlobalMemory(id, currentPrincipalId(), data)
            const idx = globalMemories.value.findIndex((m) => m.id === id)
            if (idx !== -1) globalMemories.value[idx] = memory
            return memory
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to replace memory.'
            throw e
        } finally {
            saving.value = false
        }
    }

    // Agent memories

    async function loadAgentMemories(agentId: number, type?: MemoryType): Promise<void> {
        loadingAgent.value = true
        error.value = null
        try {
            agentMemories.value = await api.getAgentMemories(agentId, currentPrincipalId(), type)
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to load agent memories.'
        } finally {
            loadingAgent.value = false
        }
    }

    async function createAgentMemory(agentId: number, data: CreateMemoryDto): Promise<MemoryResource> {
        saving.value = true
        error.value = null
        try {
            const memory = await api.createAgentMemory(agentId, currentPrincipalId(), data)
            agentMemories.value.push(memory)
            return memory
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to create agent memory.'
            throw e
        } finally {
            saving.value = false
        }
    }

    async function updateAgentMemory(
        agentId: number,
        memoryId: string,
        data: UpdateMemoryDto,
    ): Promise<MemoryResource> {
        saving.value = true
        error.value = null
        try {
            const memory = await api.updateAgentMemory(agentId, memoryId, currentPrincipalId(), data)
            const idx = agentMemories.value.findIndex((m) => m.id === memoryId)
            if (idx !== -1) agentMemories.value[idx] = memory
            return memory
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to update agent memory.'
            throw e
        } finally {
            saving.value = false
        }
    }

    async function deleteAgentMemory(agentId: number, memoryId: string): Promise<void> {
        saving.value = true
        error.value = null
        try {
            await api.deleteAgentMemory(agentId, memoryId, currentPrincipalId())
            agentMemories.value = agentMemories.value.filter((m) => m.id !== memoryId)
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to delete agent memory.'
            throw e
        } finally {
            saving.value = false
        }
    }

    async function replaceAgentMemory(
        agentId: number,
        memoryId: string,
        data: ReplaceMemoryDto,
    ): Promise<MemoryResource> {
        saving.value = true
        error.value = null
        try {
            const memory = await api.replaceAgentMemory(agentId, memoryId, currentPrincipalId(), data)
            const idx = agentMemories.value.findIndex((m) => m.id === memoryId)
            if (idx !== -1) agentMemories.value[idx] = memory
            return memory
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to replace memory.'
            throw e
        } finally {
            saving.value = false
        }
    }

    async function reorderGlobalMemories(orderedIds: string[]): Promise<void> {
        error.value = null
        try {
            await api.reorderGlobalMemories(currentPrincipalId(), orderedIds)
            const ordered = orderedIds
                .map((id) => globalMemories.value.find((m) => m.id === id))
                .filter((m): m is MemoryResource => m !== undefined)
            globalMemories.value = ordered
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to reorder memories.'
            throw e
        }
    }

    async function reorderAgentMemories(agentId: number, orderedIds: string[]): Promise<void> {
        error.value = null
        try {
            await api.reorderAgentMemories(agentId, currentPrincipalId(), orderedIds)
            const ordered = orderedIds
                .map((id) => agentMemories.value.find((m) => m.id === id))
                .filter((m): m is MemoryResource => m !== undefined)
            agentMemories.value = ordered
        } catch (e) {
            error.value = e instanceof ApiError ? e.message : 'Failed to reorder memories.'
            throw e
        }
    }

    return {
        globalMemories,
        agentMemories,
        loadingGlobal,
        loadingAgent,
        saving,
        error,
        loadGlobalMemories,
        createGlobalMemory,
        updateGlobalMemory,
        deleteGlobalMemory,
        replaceGlobalMemory,
        reorderGlobalMemories,
        loadAgentMemories,
        createAgentMemory,
        updateAgentMemory,
        deleteAgentMemory,
        replaceAgentMemory,
        reorderAgentMemories,
    }
})
