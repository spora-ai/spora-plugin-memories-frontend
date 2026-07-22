/**
 * Helper functions for detecting the active route within the
 * `/apps/memories` plugin slot from the host's URL.
 *
 * The plugin-internal router uses `createMemoryHistory()` so URLs
 * stay in JS memory — the browser address bar shows the host path
 * (`/apps/memories` or subpaths). To support deep-linking + browser
 * back/forward across real URLs (e.g. an operator shares
 * `/apps/memories/agents/42?memory=7` with a colleague), the bundle
 * can read `hostContext.router.currentRoute.value.path` via these
 * helpers and route accordingly.
 *
 * Today the bundle never calls these (the in-memory router covers
 * all internal UX). They live here so future "deep-link to edit
 * mode" features have a single helper instead of growing path
 * literals across components.
 */

/**
 * Recognised paths under `/apps/memories/`.
 *   ''          → global memories (root)
 *   'agents'    → first agent (no specific id — falls back to sidebar
 *                 default)
 *   'agents/:id'      → agent memories for agent `:id`
 *   'agents/:id/:memoryId' → deep-link into edit mode (memoryId query
 *                              param is preserved for the page's
 *                              `applyQueryParams()` to detect)
 */
// Three different "memories" path prefixes coexist in this plugin:
//   1. `/apps/memories`      — the host's URL prefix (this file).
//   2. `/plugins/memories/`  — the installer's source dir and Vite
//                              dev-server base (see vite.config.ts).
//   3. `/api/v1/memories`    — the backend's REST root
//                              (spora-plugin-memories, MemoriesPlugin::routes).
// This module only handles (1). Don't use it to parse the API or
// the installer/dev paths — those have their own helpers.
const PLUGIN_PREFIX = '/apps/memories'

export interface PluginRouteMatch {
    scope: 'global' | 'agent'
    agentId: number | null
    memoryId: number | null
}

export function matchPluginPath(path: string): PluginRouteMatch | null {
    // Strip leading `/apps/memories` and any trailing slash so we can
    // split the residual into segments without accidental double-slash
    // edge cases.
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
    const agentId = Number(segments[1])
    if (!Number.isFinite(agentId)) {
        return null
    }
    if (segments.length === 2) {
        return { scope: 'agent', agentId, memoryId: null }
    }
    const memoryId = Number(segments[2])
    if (!Number.isFinite(memoryId)) {
        return { scope: 'agent', agentId, memoryId: null }
    }
    return { scope: 'agent', agentId, memoryId }
}

export function isPluginPath(path: string): boolean {
    return path === PLUGIN_PREFIX || path.startsWith(`${PLUGIN_PREFIX}/`)
}
