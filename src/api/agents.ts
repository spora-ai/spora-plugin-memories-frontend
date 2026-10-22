/**
 * Surfaces `/agents` with optional `?principal_id=` filtering so the
 * `PrincipalChipRow` can narrow the agent dropdown to the agents owned
 * by the active principal.
 *
 * Multiple ids go on as repeatable query keys — Symfony reads
 * `query->all()['principal_id']` as an array when more than one is
 * present — matching the host's `useAgentStore.fetchAgents(principalIds)`
 * convention.
 */
import { getApi } from './client'
import type { AgentSummary } from '../types'

export async function listAgents(principalIds?: number[] | null): Promise<AgentSummary[]> {
    const api = getApi()
    const query: Record<string, number[]> = {}
    if (principalIds !== undefined && principalIds !== null && principalIds.length > 0) {
        query['principal_id'] = principalIds
    }
    const result = await api.get<{ agents: AgentSummary[] } | AgentSummary[]>('/agents', query)
    return Array.isArray(result) ? result : result.agents
}
