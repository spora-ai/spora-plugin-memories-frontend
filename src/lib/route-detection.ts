/**
 * Helper functions for detecting the active route within the
 * `/apps/memories` plugin slot from the host's URL.
 *
 * The plugin-internal router uses `createMemoryHistory()` so URLs
 * stay in JS memory — the browser address bar shows the host path
 * (`/apps/memories` or subpaths). To support deep-linking + browser
 * back/forward across real URLs (e.g. an operator shares
 * `/apps/memories/agents/42` with a colleague), the bundle can read
 * `hostContext.router.currentRoute.value.path` via these helpers and
 * route accordingly.
 *
 * Today the bundle never calls these (the in-memory router covers
 * all internal UX). They live here so future "deep-link to edit
 * mode" features have a single helper instead of growing path
 * literals across components.
 */

/**
 * Recognised paths under `/apps/memories/`:
 *   ''                → global memories (root)
 *   'agents'          → agent scope, no id resolved yet
 *   'agents/:id'      → agent memories for agent `:id`
 *   'agents/:id/:n'   → agent scope plus a numeric trailing segment
 *
 * Both ids are parsed as numbers, and only a run of digits counts as one:
 * a non-numeric agent id fails the whole match (the agent scope is
 * unusable without one), a non-numeric memory id yields `memoryId: null`
 * (the memory half is optional).
 */
const PLUGIN_PREFIX = '/apps/memories'

export interface PluginRouteMatch {
    scope: 'global' | 'agent'
    agentId: number | null
    memoryId: number | null
}

export function matchPluginPath(path: string): PluginRouteMatch | null {
    if (!path.startsWith(PLUGIN_PREFIX)) {
        return null
    }
    const residual = path.slice(PLUGIN_PREFIX.length).replace(/^\/+/, '').replace(/\/+$/, '')
    const segments = residual === '' ? [] : residual.split('/')

    if (segments.length === 0) {
        return { scope: 'global', agentId: null, memoryId: null }
    }
    if (segments[0] !== 'agents') {
        return null
    }
    if (segments.length === 1) {
        return { scope: 'agent', agentId: null, memoryId: null }
    }
    const agentId = parseId(segments[1])
    if (agentId === null) {
        return null
    }
    if (segments.length === 2) {
        return { scope: 'agent', agentId, memoryId: null }
    }
    const memoryId = parseId(segments[2])
    if (memoryId === null) {
        return { scope: 'agent', agentId, memoryId: null }
    }
    return { scope: 'agent', agentId, memoryId }
}

/**
 * Only a run of digits counts as an id: `Number('')` is `0` and
 * `Number(' 12 ')` is `12`, so a plain coercion reads an empty segment as
 * the id `0` — an agent the server would never route to.
 */
function parseId(segment: string): number | null {
    if (!/^\d+$/.test(segment)) return null
    return Number(segment)
}

export function isPluginPath(path: string): boolean {
    return path === PLUGIN_PREFIX || path.startsWith(`${PLUGIN_PREFIX}/`)
}
