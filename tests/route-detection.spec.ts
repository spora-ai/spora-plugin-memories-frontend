/**
 * route-detection helper coverage.
 *
 * The plugin-local router uses `createMemoryHistory()` so the active
 * route state lives in JS memory; these helpers exist for future
 * deep-linking scenarios where the host's URL needs to drive the
 * plugin's view. Asserting them now pins down the helper before
 * feature work lands on top.
 */
import { describe, expect, it } from 'vitest'
import { isPluginPath, matchPluginPath } from '../src/lib/route-detection'

describe('route-detection', () => {
    describe('matchPluginPath', () => {
        it('returns global scope for /apps/memories', () => {
            expect(matchPluginPath('/apps/memories')).toEqual({
                scope: 'global',
                agentId: null,
                memoryId: null,
            })
        })

        it('returns global scope for /apps/memories/ (trailing slash)', () => {
            expect(matchPluginPath('/apps/memories/')).toEqual({
                scope: 'global',
                agentId: null,
                memoryId: null,
            })
        })

        it('returns agent scope for /apps/memories/agents/42', () => {
            expect(matchPluginPath('/apps/memories/agents/42')).toEqual({
                scope: 'agent',
                agentId: 42,
                memoryId: null,
            })
        })

        it('returns memory id for /apps/memories/agents/42/7', () => {
            expect(matchPluginPath('/apps/memories/agents/42/7')).toEqual({
                scope: 'agent',
                agentId: 42,
                memoryId: 7,
            })
        })

        it('returns null for an unrelated app', () => {
            expect(matchPluginPath('/apps/media-archive')).toBeNull()
        })

        it('returns null when agents path has a non-numeric id', () => {
            expect(matchPluginPath('/apps/memories/agents/notanumber')).toBeNull()
        })
    })

    describe('isPluginPath', () => {
        it('returns true for /apps/memories', () => {
            expect(isPluginPath('/apps/memories')).toBe(true)
        })
        it('returns true for /apps/memories/...', () => {
            expect(isPluginPath('/apps/memories/agents/42')).toBe(true)
        })
        it('returns false for other apps', () => {
            expect(isPluginPath('/apps/media-archive')).toBe(false)
        })
    })
})
