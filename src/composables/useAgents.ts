/**
 * Plugin-local equivalent of the host's `@/stores/agent` Pinia store.
 *
 * The host's `useAgentStore` reaches for a global Pinia instance the
 * plugin can't safely share. We replace it with this singleton-style
 * composable that:
 *   - lazily fetches the `/agents` list once on first `fetchAgents()` call
 *   - caches the result in a module-level `ref`, matching the host's
 *     behavior (so `MemorySidebar` keeps seeing the same `agents`
 *     between renders)
 *   - routes requests through the host's typed REST client
 *
 * The composable's signature (`{ agents, fetchAgents }`) mirrors
 * `useAgentStore` so the page components can swap stores with a
 * one-line import change.
 */
import { ref, type Ref } from 'vue'
import type { AgentSummary } from '../types'
import { getApi } from '../api/client'

const _agents: Ref<AgentSummary[]> = ref<AgentSummary[]>([])
let _fetched = false
let _inFlight: Promise<void> | null = null

export interface UseAgentsComposable {
    agents: Ref<AgentSummary[]>
    fetchAgents: () => Promise<void>
}

export function useAgents(): UseAgentsComposable {
    return {
        agents: _agents,
        fetchAgents: async (): Promise<void> => {
            if (_fetched) return
            if (_inFlight !== null) return _inFlight
            _inFlight = (async () => {
                try {
                    const api = getApi()
                    // The host's `/agents` endpoint returns either the bare
                    // array (`Agent[]`) or a `{ agents: Agent[] }` envelope,
                    // depending on the controller version. Accept both.
                    const response = await api.get<AgentSummary[] | { agents: AgentSummary[] }>('/agents')
                    _agents.value = Array.isArray(response)
                        ? response
                        : response.agents
                    _fetched = true
                } finally {
                    _inFlight = null
                }
            })()
            return _inFlight
        },
    }
}

/**
 * Drop the cached agent list and reset the in-flight de-duplication guard.
 *
 * Exposed for plugin extensions and test setup. NOT currently called from
 * the public mount contract (`window.SporaAppMemories`) — the plugin
 * bundle has no hook into host auth-state changes, so on logout/login
 * the cached list WILL leak across users in the same JS context. If
 * the host SPA grows an auth-state channel, the right fix is to wire
 * `resetAgents()` to that channel (or move agent fetching to a host
 * Pinia store so it follows the active user automatically).
 */
export function resetAgents(): void {
    _agents.value = []
    _fetched = false
    _inFlight = null
}

/**
 * Test-only alias for `resetAgents`. Same implementation, different name
 * to keep test cleanup visually distinct from production reset calls.
 */
export function __resetAgentsForTesting(): void {
    resetAgents()
}
