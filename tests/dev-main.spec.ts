/**
 * Dev sandbox bootstrap — `src/dev-main.ts`.
 *
 * Mirrors the production slot exactly so the standalone `npm run dev`
 * sandbox doesn't drift from `src/main.ts`. The original entry
 * mounted the app, but never called `app.provide(HOST_CONTEXT_KEY,
 * hostContext)` and never `app.use(router)` — that surfaced as
 * `[Vue warn]: injection "Symbol(spora-memories-host-context)" not
 * found` (and a sibling `Symbol(route location)` not found) and
 * silently disabled the `<MemoryEditor :host-context>` prop, so
 * clicking "Attach media" was a no-op.
 *
 * The contract under test is the one-paragraph boot path: importing
 * dev-main from a clean DOM:
 *   - does not install anything on `window` (production does);
 *   - mounts the app under `#app`;
 *   - does NOT emit any of the `injection ... not found` Vue
 *     warnings that the user's bug report called out. This is the
 *     regression guard that prevents re-introducing either of the
 *     two missing `app.use(...)` / `app.provide(...)` calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
    document.body.innerHTML = ''
    vi.resetModules()
})

afterEach(() => {
    document.body.innerHTML = ''
})

describe('dev-main bootstrap', () => {
    it('imports without installing anything on window', async () => {
        // Production installs `window.SporaAppMemories`; the dev entry
        // is the `npm run dev` entry point and intentionally does not.
        await import('../src/dev-main')
        expect((window as unknown as { SporaAppMemories?: unknown }).SporaAppMemories).toBeUndefined()
    })

    it('mounts the app under #app without emitting injection-not-found warnings', async () => {
        // Capture every Vue warning emitted during mount. The two the
        // user reported were:
        //   [Vue warn]: injection "Symbol(spora-memories-host-context)" not found.
        //   [Vue warn]: injection "Symbol(route location)" not found.
        // We assert both keys are now resolved by `app.use(router)` +
        // `app.provide(HOST_CONTEXT_KEY, ...)`.
        const warnings: string[] = []
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
            warnings.push(args.map((a) => String(a)).join(' '))
        })

        const target = document.createElement('div')
        target.id = 'app'
        document.body.appendChild(target)

        await import('../src/dev-main')
        // Let the synchronous mount + `onMounted` watchers flush.
        await new Promise((r) => setTimeout(r, 0))
        warnSpy.mockRestore()

        const injectionWarnings = warnings.filter((m) => /\[Vue warn\]: injection /.test(m))
        expect(injectionWarnings).toEqual([])
    })

    it('wires the mock API into the plugin-local api/client bridge', async () => {
        const target = document.createElement('div')
        target.id = 'app'
        document.body.appendChild(target)

        await import('../src/dev-main')
        await new Promise((r) => setTimeout(r, 0))

        const client = await import('../src/api/client')
        // The bridge must already have an API installed (no "Plugin
        // API not initialized"); we don't assert on the concrete
        // instance because the mock rebuilds its closure per module
        // load.
        expect(client.getApi()).toBeDefined()
    })
})
