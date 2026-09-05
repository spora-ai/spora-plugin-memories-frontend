/**
 * Memory API client for global and agent-scoped memory operations.
 *
 * The original Spora frontend had these functions reach for the host's
 * `@/api/client` import. In the plugin we route through our local
 * `getApi()` container so the host's `hostContext.api` is used verbatim —
 * preserving CSRF tokens, base URL, and envelope unwrap. Tests can mock
 * either this module (preferred) or `api/client.ts`.
 *
 * Every function accepts an optional `principalId` — the principal the
 * operator currently has selected in `PrincipalChipRow`. When set, it's
 * threaded onto the URL as `?principal_id=N`; the controller layer
 * honours it when the caller controls that principal (own user-
 * principal or any group-principal they belong to, regardless of role)
 * and 403s otherwise. When the operator's user-principal is the active
 * scope the value is null and the param is omitted entirely.
 *
 * `?principal_id=` is a single-id query string (not repeatable) — the
 * plugin's UI only ever switches between two principals at a time
 * (the user's own + one of their groups), so a single id is enough.
 * The host's `/agents` endpoint accepts repeatable ids because the
 * sidebar shows the union of many principals; for memories we keep the
 * surface minimal.
 */
import { getApi } from './client'
import type {
    MemoryResource,
    MemoryType,
    CreateMemoryDto,
    UpdateMemoryDto,
    ReplaceMemoryDto,
} from '../types'

/**
 * Build a path with optional `?principal_id=` and `?type=` query
 * string entries. Encoded once so every API call looks identical.
 */
function withQuery(path: string, principalId: number | null, type?: MemoryType): string {
    const params: string[] = []
    if (principalId !== null) {
        params.push(`principal_id=${principalId}`)
    }
    if (type !== undefined) {
        params.push(`type=${encodeURIComponent(type)}`)
    }
    return params.length === 0 ? path : `${path}?${params.join('&')}`
}

export async function getGlobalMemories(
    principalId: number | null,
    type?: MemoryType,
): Promise<MemoryResource[]> {
    const api = getApi()
    const result = await api.get<{ memories: MemoryResource[] }>(
        withQuery('/memories', principalId, type),
    )
    return result.memories
}

export async function getGlobalMemory(
    id: string,
    principalId: number | null,
): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.get<{ memory: MemoryResource }>(
        withQuery(`/memories/${id}`, principalId),
    )
    return result.memory
}

export async function createGlobalMemory(
    principalId: number | null,
    data: CreateMemoryDto,
): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.post<{ memory: MemoryResource }>(
        withQuery('/memories', principalId),
        data,
    )
    return result.memory
}

export async function updateGlobalMemory(
    id: string,
    principalId: number | null,
    data: UpdateMemoryDto,
): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.put<{ memory: MemoryResource }>(
        withQuery(`/memories/${id}`, principalId),
        data,
    )
    return result.memory
}

export async function deleteGlobalMemory(
    id: string,
    principalId: number | null,
): Promise<void> {
    const api = getApi()
    await api.delete(withQuery(`/memories/${id}`, principalId))
}

export async function replaceGlobalMemory(
    id: string,
    principalId: number | null,
    data: ReplaceMemoryDto,
): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.post<{ memory: MemoryResource }>(
        withQuery(`/memories/${id}/replace`, principalId),
        data,
    )
    return result.memory
}

export async function getAgentMemories(
    agentId: number,
    principalId: number | null,
    type?: MemoryType,
): Promise<MemoryResource[]> {
    const api = getApi()
    const result = await api.get<{ memories: MemoryResource[] }>(
        withQuery(`/agents/${agentId}/memories`, principalId, type),
    )
    return result.memories
}

export async function getAgentMemory(
    agentId: number,
    memoryId: string,
    principalId: number | null,
): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.get<{ memory: MemoryResource }>(
        withQuery(`/agents/${agentId}/memories/${memoryId}`, principalId),
    )
    return result.memory
}

export async function createAgentMemory(
    agentId: number,
    principalId: number | null,
    data: CreateMemoryDto,
): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.post<{ memory: MemoryResource }>(
        withQuery(`/agents/${agentId}/memories`, principalId),
        data,
    )
    return result.memory
}

export async function updateAgentMemory(
    agentId: number,
    memoryId: string,
    principalId: number | null,
    data: UpdateMemoryDto,
): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.put<{ memory: MemoryResource }>(
        withQuery(`/agents/${agentId}/memories/${memoryId}`, principalId),
        data,
    )
    return result.memory
}

export async function deleteAgentMemory(
    agentId: number,
    memoryId: string,
    principalId: number | null,
): Promise<void> {
    const api = getApi()
    await api.delete(withQuery(`/agents/${agentId}/memories/${memoryId}`, principalId))
}

export async function replaceAgentMemory(
    agentId: number,
    memoryId: string,
    principalId: number | null,
    data: ReplaceMemoryDto,
): Promise<MemoryResource> {
    const api = getApi()
    const result = await api.post<{ memory: MemoryResource }>(
        withQuery(`/agents/${agentId}/memories/${memoryId}/replace`, principalId),
        data,
    )
    return result.memory
}

export async function reorderGlobalMemories(
    principalId: number | null,
    orderedIds: string[],
): Promise<void> {
    const api = getApi()
    await api.patch(withQuery('/memories/reorder', principalId), { order: orderedIds })
}

export async function reorderAgentMemories(
    agentId: number,
    principalId: number | null,
    orderedIds: string[],
): Promise<void> {
    const api = getApi()
    await api.patch(
        withQuery(`/agents/${agentId}/memories/reorder`, principalId),
        { order: orderedIds },
    )
}
