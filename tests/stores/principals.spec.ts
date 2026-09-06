/**
 * Principals store — covers `loadPrincipals`, `selectPrincipal`,
 * default selection to the caller's user-principal, and the
 * no-localStorage invariant.
 *
 * Mirrors `spora-plugin-typst-frontend/tests/stores/principals.spec.ts`
 * for the new memories plugin. The wire shape is the host's
 * `/api/v1/principals/me` envelope — see `api/principals.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { setApi, ApiError } from '../../src/api/client'
import type { PluginHostContext } from '../../src/shims'

const { listMyPrincipalsMock } = vi.hoisted(() => ({
    listMyPrincipalsMock: vi.fn(),
}))

vi.mock('../../src/api/principals', () => ({
    listMyPrincipals: listMyPrincipalsMock,
}))

import { usePrincipalsStore } from '../../src/stores/principals'

function makeApi(): PluginHostContext['api'] {
    return {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    }
}

beforeEach(() => {
    listMyPrincipalsMock.mockReset()
    setActivePinia(createPinia())
    setApi(makeApi())
})

describe('usePrincipalsStore', () => {
    describe('initial state', () => {
        it('starts with empty principals and no selection', () => {
            const store = usePrincipalsStore()
            expect(store.principals).toEqual([])
            expect(store.selectedPrincipalId).toBeNull()
            expect(store.loading).toBe(false)
            expect(store.error).toBeNull()
        })

        it('does not persist anything to localStorage on selection', () => {
            const store = usePrincipalsStore()
            store.selectPrincipal(99)
            expect(localStorage.getItem('memories:selectedPrincipalId')).toBeNull()
            expect(sessionStorage.getItem('memories:selectedPrincipalId')).toBeNull()
        })
    })

    describe('loadPrincipals', () => {
        it('stores the principal list and defaults to the user-principal', async () => {
            listMyPrincipalsMock.mockResolvedValueOnce([
                { id: 7, type: 'group', name: 'Engineering', user_id: null, group_id: 1 },
                { id: 42, type: 'user', name: 'User #42', user_id: 42, group_id: null },
            ])
            const store = usePrincipalsStore()
            await store.loadPrincipals()
            expect(store.principals).toHaveLength(2)
            expect(store.selectedPrincipalId).toBe(42)
        })

        it('falls back to the first principal when no user-principal is present', async () => {
            listMyPrincipalsMock.mockResolvedValueOnce([
                { id: 1, type: 'group', name: 'Only Group', user_id: null, group_id: 1 },
            ])
            const store = usePrincipalsStore()
            await store.loadPrincipals()
            expect(store.selectedPrincipalId).toBe(1)
        })

        it('keeps the existing selection across reloads when the user previously picked one', async () => {
            const store = usePrincipalsStore()
            store.selectPrincipal(7)
            listMyPrincipalsMock.mockResolvedValueOnce([
                { id: 7, type: 'group', name: 'Engineering', user_id: null, group_id: 1 },
                { id: 42, type: 'user', name: 'User #42', user_id: 42, group_id: null },
            ])
            await store.loadPrincipals()
            expect(store.selectedPrincipalId).toBe(7)
        })

        it('surfaces ApiError messages verbatim', async () => {
            listMyPrincipalsMock.mockRejectedValueOnce(new ApiError('forbidden', 'FORBIDDEN', 403))
            const store = usePrincipalsStore()
            await store.loadPrincipals()
            expect(store.error).toBe('forbidden')
        })

        it('falls back to a generic message on non-ApiError failures', async () => {
            listMyPrincipalsMock.mockRejectedValueOnce(new Error('boom'))
            const store = usePrincipalsStore()
            await store.loadPrincipals()
            expect(store.error).toBe('Failed to load principals.')
        })

        it('flips loading on and off around the fetch', async () => {
            let resolveFn: ((value: unknown) => void) = () => undefined
            listMyPrincipalsMock.mockReturnValueOnce(new Promise<unknown>((r) => { resolveFn = r }))
            const store = usePrincipalsStore()
            const promise = store.loadPrincipals()
            expect(store.loading).toBe(true)
            resolveFn([])
            await promise
            expect(store.loading).toBe(false)
        })
    })

    describe('selectPrincipal', () => {
        it('sets selectedPrincipalId to the given id', () => {
            const store = usePrincipalsStore()
            store.selectPrincipal(7)
            expect(store.selectedPrincipalId).toBe(7)
        })
    })

    describe('clearError', () => {
        it('clears the error string', async () => {
            listMyPrincipalsMock.mockRejectedValueOnce(new ApiError('nope', 'NOPE', 400))
            const store = usePrincipalsStore()
            await store.loadPrincipals()
            expect(store.error).toBe('nope')
            store.clearError()
            expect(store.error).toBeNull()
        })
    })

    describe('currentPrincipal', () => {
        it('returns the matching principal object', async () => {
            listMyPrincipalsMock.mockResolvedValueOnce([
                { id: 42, type: 'user', name: 'User #42', user_id: 42, group_id: null },
            ])
            const store = usePrincipalsStore()
            await store.loadPrincipals()
            expect(store.currentPrincipal).toMatchObject({ id: 42, type: 'user' })
        })

        it('returns null when nothing is selected', () => {
            const store = usePrincipalsStore()
            expect(store.currentPrincipal).toBeNull()
        })
    })
})