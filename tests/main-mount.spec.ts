/**
 * Mount/unmount contract — exercises `src/main.ts → SporaApp`.
 *
 * `main.ts` is the plugin bootstrap: it builds the Vue app, installs
 * Pinia + the local router, and exposes `mount()` / `unmount()` for the
 * host's `apps/registry.ts` to call. We test that contract end-to-end
 * against a fake DOM target.
 *
 * `window.SporaAppMemories` is installed by the explicit assignment in
 * `main.ts`; the IIFE lib wrapper does the same at build time.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { PluginHostContext } from '../src/shims'

function makeHostContext(): PluginHostContext {
    // The plugin's `useAgents()` composable runs on mount and calls
    // `api.get('/agents')` — return an empty envelope so the fetch
    // resolves cleanly instead of the composable blowing up with
    // `Cannot read properties of undefined (reading 'agents')`.
    const get = vi.fn().mockImplementation((path: string) => {
        if (path === '/agents') {
            return Promise.resolve({ agents: [] })
        }
        if (path === '/memories') {
            return Promise.resolve({ memories: [] })
        }
        return Promise.resolve(undefined)
    })
    return {
        api: {
            get,
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
        },
        pinia: null,
        theme: 'light',
        locale: 'en',
        route: null,
        router: null,
    }
}

function makeTarget(): HTMLElement {
    const target = document.createElement('div')
    target.id = 'app-mount-target'
    document.body.appendChild(target)
    return target
}

beforeEach(() => {
    document.body.innerHTML = ''
    // Reset module cache so each test re-evaluates `main.ts` and the
    // `window.SporaAppMemories` assignment lands fresh.
    vi.resetModules()
    delete (window as unknown as { SporaAppMemories?: unknown }).SporaAppMemories
})

afterEach(() => {
    document.body.innerHTML = ''
    delete (window as unknown as { SporaAppMemories?: unknown }).SporaAppMemories
})

describe('SporaApp (main.ts mount contract)', () => {
    it('exposes mount + unmount via window.SporaAppMemories', async () => {
        const main = await import('../src/main')
        expect(main.default).toBeDefined()
        expect(typeof main.default.mount).toBe('function')
        expect(typeof main.default.unmount).toBe('function')
        expect((window as unknown as { SporaAppMemories: unknown }).SporaAppMemories).toBe(main.default)
    })

    it('mount() renders the plugin root into the target element', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostContext = makeHostContext()
        await main.default.mount(target, hostContext)
        await new Promise((r) => setTimeout(r, 0))
        expect(target.querySelector('#spora-plugin-memories')).not.toBeNull()
        expect(target.querySelector('main')).not.toBeNull()
    })

    it('mount() wires hostContext.api into the plugin-local api/client bridge', async () => {
        const main = await import('../src/main')
        const client = await import('../src/api/client')
        const target = makeTarget()
        const hostContext = makeHostContext()
        await main.default.mount(target, hostContext)
        expect(client.getApi()).toBe(hostContext.api)
    })

    it('mount() provides HOST_CONTEXT_KEY without emitting injection-not-found warnings', async () => {
        // Regression guard for the `Symbol(spora-memories-host-context)
        // injection not found` warning. Without `app.provide(...)` the
        // page silently lost access to hostContext, disabling
        // "Attach media" and other host-only contracts.
        const warnings: string[] = []
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
            warnings.push(args.map((a) => String(a)).join(' '))
        })

        const main = await import('../src/main')
        const target = makeTarget()
        const hostContext = makeHostContext()
        await main.default.mount(target, hostContext)
        await new Promise((r) => setTimeout(r, 0))
        warnSpy.mockRestore()

        const injectionWarnings = warnings.filter((m) => /\[Vue warn\]: injection /.test(m))
        expect(injectionWarnings).toEqual([])
    })

    it('unmount() removes the mounted Vue app from the DOM', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostContext = makeHostContext()
        await main.default.mount(target, hostContext)
        await new Promise((r) => setTimeout(r, 0))
        expect(target.querySelector('main')).not.toBeNull()
        main.default.unmount(target)
        expect(target.querySelector('main')).toBeNull()
    })

    it('unmount() is a no-op when no app is mounted on the target', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        expect(() => main.default.unmount(target)).not.toThrow()
    })

    it('unmount() can be called repeatedly without error', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostContext = makeHostContext()
        await main.default.mount(target, hostContext)
        main.default.unmount(target)
        expect(() => main.default.unmount(target)).not.toThrow()
    })

    it('remounting the same target replaces the prior app', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostContext = makeHostContext()
        await main.default.mount(target, hostContext)
        await new Promise((r) => setTimeout(r, 0))
        const firstMain = target.querySelector('main')
        expect(firstMain).not.toBeNull()
        await main.default.mount(target, hostContext)
        await new Promise((r) => setTimeout(r, 0))
        const secondMain = target.querySelector('main')
        expect(secondMain).not.toBeNull()
        expect(secondMain).not.toBe(firstMain)
    })
})