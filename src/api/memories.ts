/**
 * Memory API client for global and agent-scoped memory operations.
 *
 * The original Spora frontend had these functions reach for the host's
 * `@/api/client` import. In the plugin we route through our local
 * `getApi()` container so the host's `hostContext.api` is used verbatim —
 * preserving CSRF tokens, base URL, and envelope unwrap. Tests can mock
 * either this module (preferred) or `api/client.ts`.
 */
import { getApi } from './client'
import type { MemoryResource, CreateMemoryDto, UpdateMemoryDto } from '../types'

export async function getGlobalMemories(): Promise<MemoryResource[]> {
    const api = getApi()
    const result = await api.get<{ memories: MemoryResource[] }>('/memories')
    return result.memories
}

export async function getGlobalMemory(id: number): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.get<{ memory: MemoryResource }>(`/memories/${id}`)
    return result.memory
}

export async function createGlobalMemory(data: CreateMemoryDto): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.post<{ memory: MemoryResource }>('/memories', data)
    return result.memory
}

export async function updateGlobalMemory(id: number, data: UpdateMemoryDto): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.put<{ memory: MemoryResource }>(`/memories/${id}`, data)
    return result.memory
}

export async function deleteGlobalMemory(id: number): Promise<void> {
    const api = getApi()
    await api.delete(`/memories/${id}`)
}

export async function getAgentMemories(agentId: number): Promise<MemoryResource[]> {
    const api = getApi()
    const result = await api.get<{ memories: MemoryResource[] }>(`/agents/${agentId}/memories`)
    return result.memories
}

export async function getAgentMemory(agentId: number, memoryId: number): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.get<{ memory: MemoryResource }>(`/agents/${agentId}/memories/${memoryId}`)
    return result.memory
}

export async function createAgentMemory(agentId: number, data: CreateMemoryDto): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.post<{ memory: MemoryResource }>(`/agents/${agentId}/memories`, data)
    return result.memory
}

export async function updateAgentMemory(agentId: number, memoryId: number, data: UpdateMemoryDto): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.put<{ memory: MemoryResource }>(`/agents/${agentId}/memories/${memoryId}`, data)
    return result.memory
}

export async function deleteAgentMemory(agentId: number, memoryId: number): Promise<void> {
    const api = getApi()
    await api.delete(`/agents/${agentId}/memories/${memoryId}`)
}

export async function reorderGlobalMemories(orderedIds: number[]): Promise<void> {
    const api = getApi()
    await api.patch('/memories/reorder', { order: orderedIds })
}

export async function reorderAgentMemories(agentId: number, orderedIds: number[]): Promise<void> {
    const api = getApi()
    await api.patch(`/agents/${agentId}/memories/reorder`, { order: orderedIds })
}
