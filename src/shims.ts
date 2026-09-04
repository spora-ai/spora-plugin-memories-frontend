/**
 * Vue `InjectionKey` for the host context. Components deep in the
 * plugin tree (the editor, the pages) `inject(HOST_CONTEXT_KEY)` to
 * reach the host's `openMediaPicker` and other host-only contracts
 * without prop-drilling.
 */
import type { MediaAsset, MediaPickerOptions } from './types'

export const HOST_CONTEXT_KEY: import('vue').InjectionKey<PluginHostContext> = Symbol('spora-memories-host-context') as unknown as import('vue').InjectionKey<PluginHostContext>

/**
 * The Memories SPA is mounted into a slot owned by the host's
 * `PluginAppPage.vue`. The host passes a deliberately small context:
 *   - `api`           — the host's typed REST client. We use it directly
 *                       rather than rebuilding a copy so request/response
 *                       shapes stay in sync with the host's `/api/v1`
 *                       envelope.
 *   - `pinia`         — the host's Pinia instance. Plugins may install a
 *                       *local* Pinia (for plugin-only state) but should
 *                       NOT call `setActivePinia(host.pinia)` — that
 *                       would collide with the host's stores.
 *   - `theme`         — `'light' | 'dark'` snapshot at mount time.
 *                       Plugins read this once and trust it; if the host
 *                       re-themes, the slot is unmounted and remounted,
 *                       so we get a fresh value.
 *   - `route`         — the host's current route. Plugins render under
 *                       `/apps/<slug>` already; this is for breadcrumbs
 *                       and back-links.
 *   - `router`        — the host's Vue Router instance. Plugins that
 *                       need client-side navigation call
 *                       `router.push(...)`.
 *   - `openMediaPicker` — the host's `useMediaPicker` composable
 *                        (see `spora-frontend/src/composables/useMediaPicker.ts`).
 *                        Resolves with the operator's selection, or `[]`
 *                        on cancel. **Purely additive** — plugins that
 *                        predate PR-1 simply omit the call. The picker
 *                        mounts a fresh Vue app at body level per
 *                        invocation, so concurrent callers don't collide.
 *
 * Anything else (auth, runtime config, etc.) is reachable via the host's
 * Pinia stores — use `useSomeHostStore(host.pinia)` rather than reaching
 * for `useSomeHostStore()` directly, which would attach to whatever Pinia
 * is currently active in the slot.
 */
export interface PluginHostContext {
    /**
     * The host's `spora-frontend/src/api/client.ts → request<T>()` unwraps
     * the standard `{ data: T }` envelope before handing the value to the
     * caller (see line 117: `body.data ?? body`). Plugins receive `T`
     * directly — for the Memories list endpoints that's `MemoryResource[]`
     * or the unwrapped subfield (`{ memories }`/`{ memory }` envelopes
     * still need to be opened here, as the PHP controllers return them).
     */
    api: {
        get: <T = unknown>(path: string) => Promise<T>
        post: <T = unknown>(path: string, body: unknown) => Promise<T>
        put: <T = unknown>(path: string, body: unknown) => Promise<T>
        patch: <T = unknown>(path: string, body: unknown) => Promise<T>
        delete: <T = unknown>(path: string) => Promise<T>
    }
    pinia: unknown
    theme: 'light' | 'dark'
    route: { path: string; params: Record<string, unknown>; query: Record<string, unknown> } | null
    /**
     * Host's Vue Router instance. Plugins read `currentRoute` (a
     * `shallowRef`) for reactive URL tracking, and call `push(to)` for
     * client-side navigation. The host already exposes the full Router
     * — see `spora-frontend/src/apps/registry.ts → PluginHostContext`
     * — but plugins only see the surface they actually use.
     */
    router: {
        push: (to: string) => Promise<unknown>
        currentRoute: { value: { path: string; params?: Record<string, unknown>; query?: Record<string, unknown> } }
    } | null
    /**
     * Imperatively open the host's `MediaPickerOverlay` modal. Resolves
     * with the operator's selection, or `[]` on cancel. The host owns
     * the picker UI; plugins only need to await the selection.
     */
    openMediaPicker?: (options?: MediaPickerOptions) => Promise<MediaAsset[]>
}

declare global {
    interface Window {
        SporaAppMemories?: {
            mount: (target: HTMLElement, ctx: PluginHostContext) => void | Promise<void>
            unmount?: (target: HTMLElement) => void
        }
    }
}