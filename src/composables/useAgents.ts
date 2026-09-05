/**
 * Plugin-local equivalent of the host's `@/stores/agent` Pinia store.
 *
 * The host's `useAgentStore` reaches for a global Pinia instance the
 * plugin can't safely share. We replace it with this singleton-style
 * composable that:
 *   - fetches the `/agents` list, optionally filtered by one or more
 *     principal ids (`fetchAgents([myPrincipal, groupPrincipal])`
 *     returns the union of agents owned by either principal). The
 *     filter is forwarded as `?principal_id=N&principal_id=M` exactly
 *     the way the host's `useAgentStore` does it (per
 *     `AgentFilterParser::parsePrincipalIds` in spora-core).
 *   - caches the LAST fetched list in a module-level ref so the page
 *     keeps seeing the same `agents` value across renders and between
 *     principal switches until a fresh fetch lands.
 *   - routes requests through the host's typed REST client.
 *
 * The composable's signature (`{ agents, fetchAgents }`) mirrors
 * `useAgentStore` so the page components can swap stores with a
 * one-line import change. Passing a `null` reset re-fetches without
 * a filter — useful when the operator switches back to "show every
 * agent I'm entitled to".
 */
import { ref, type Ref } from 'vue'
import type { AgentSummary } from '../types'
import { listAgents } from '../api/agents'

const _agents: Ref<AgentSummary[]> = ref<AgentSummary[]>([])
let _inFlight: Promise<void> | null = null

export interface UseAgentsComposable {
    agents: Ref<AgentSummary[]>
    /**
     * @param principalIds Single-id filter or array of principal ids to
     *     intersect with `/agents` on. `null`/`undefined` requests the
     *     full visible-agent list. Re-fetches even when the same id is
     *     passed twice — the caller drives freshness, not us.
     */
    fetchAgents: (principalIds?: number[] | null) => Promise<void>
}

export function useAgents(): UseAgentsComposable {
    return {
        agents: _agents,
        fetchAgents: async (principalIds?: number[] | null): Promise<void> => {
            if (_inFlight !== null) return _inFlight
            _inFlight = (async () => {
                try {
                    _agents.value = await listAgents(principalIds ?? null)
                } finally {
                    _inFlight = null
                }
            })()
            return _inFlight
        },
    }
}

/**
 * Test-only reset. Production code never calls this. Useful for
 * vitest's `beforeEach()` so the cache doesn't leak across tests.
 */
export function __resetAgentsForTesting(): void {
    _agents.value = []
    _inFlight = null
}
