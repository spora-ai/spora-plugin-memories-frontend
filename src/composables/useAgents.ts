/**
 * Plugin-local equivalent of the host's `@/stores/agent` Pinia store. The
 * host's `useAgentStore` reaches for a global Pinia instance the plugin
 * can't safely share, so we replace it with this singleton composable
 * that mirrors the same `{ agents, fetchAgents }` shape.
 */
import { ref, type Ref } from 'vue'
import type { AgentSummary } from '../types'
import { listAgents } from '../api/agents'

const _agents: Ref<AgentSummary[]> = ref<AgentSummary[]>([])

// Monotonic request token: a slow earlier response whose token no longer
// matches the latest call must not commit, otherwise rapid principal
// switches surface the previous principal's agents.
let _requestToken = 0
// Per-filter in-flight map so identical concurrent calls share one
// network round-trip, while different filters stay independent.
const _inFlight = new Map<string, Promise<AgentSummary[]>>()

function keyFor(principalIds: number[] | null | undefined): string {
    if (principalIds === null || principalIds === undefined) return 'all'
    return principalIds.slice().sort((a, b) => a - b).join(',')
}

export interface UseAgentsComposable {
    agents: Ref<AgentSummary[]>
    /** `null`/`undefined` requests the full visible-agent list. */
    fetchAgents: (principalIds?: number[] | null) => Promise<void>
}

export function useAgents(): UseAgentsComposable {
    return {
        agents: _agents,
        fetchAgents: async (principalIds?: number[] | null): Promise<void> => {
            const token = ++_requestToken
            const key = keyFor(principalIds)
            let promise = _inFlight.get(key)
            if (promise === undefined) {
                promise = listAgents(principalIds ?? null)
                _inFlight.set(key, promise)
                void promise.finally(() => {
                    if (_inFlight.get(key) === promise) {
                        _inFlight.delete(key)
                    }
                })
            }
            const result = await promise
            if (token === _requestToken) {
                _agents.value = result
            }
        },
    }
}

export function __resetAgentsForTesting(): void {
    _agents.value = []
    _requestToken = 0
    _inFlight.clear()
}
