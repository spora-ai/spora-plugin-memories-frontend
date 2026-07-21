/**
 * Component-level smoke tests for the new plugin-local modules.
 *
 * - `AlertBanner` renders the right color class per type.
 * - `useAgents` composable returns the same ref across calls and
 *   caches the fetch.
 * - `MemoryEditor` emits the right shape on save (re-asserts the
 *   spec — covered here for self-containedness; the dedicated
 *   `components/MemoryEditor.spec.ts` has the full set).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AlertBanner from '../src/components/AlertBanner.vue'
import { useAgents, __resetAgentsForTesting } from '../src/composables/useAgents'
import MemoryEditor from '../src/components/MemoryEditor.vue'
import type { PluginHostContext } from '../src/shims'

beforeEach(() => {
    setActivePinia(createPinia())
    __resetAgentsForTesting()
})

describe('AlertBanner', () => {
    it('renders an error banner with destructive styling', () => {
        const wrapper = mount(AlertBanner, { props: { type: 'error', message: 'boom' } })
        expect(wrapper.text()).toBe('boom')
        expect(wrapper.classes().join(' ')).toMatch(/destructive/)
    })

    it('renders a success banner with green styling', () => {
        const wrapper = mount(AlertBanner, { props: { type: 'success', message: 'ok' } })
        expect(wrapper.text()).toBe('ok')
        expect(wrapper.classes().join(' ')).toMatch(/green/)
    })

    it('renders a warning banner with yellow styling', () => {
        const wrapper = mount(AlertBanner, { props: { type: 'warning', message: 'careful' } })
        expect(wrapper.text()).toBe('careful')
        expect(wrapper.classes().join(' ')).toMatch(/yellow/)
    })
})

describe('useAgents composable', () => {
    function mockApi(value: unknown): PluginHostContext['api'] {
        return {
            get: vi.fn().mockResolvedValue(value),
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
        } as unknown as PluginHostContext['api']
    }

    it('returns the same agents ref on subsequent calls (singleton)', async () => {
        const { setApi } = await import('../src/api/client')
        setApi(mockApi([{ id: 1, name: 'Bot' }]))
        const first = useAgents()
        const second = useAgents()
        expect(first.agents).toBe(second.agents)
    })

    it('fetches agents via hostContext.api', async () => {
        const { setApi } = await import('../src/api/client')
        const api = mockApi([{ id: 7, name: 'Oncall Bot' }])
        setApi(api)
        const { agents, fetchAgents } = useAgents()
        await fetchAgents()
        expect(agents.value).toEqual([{ id: 7, name: 'Oncall Bot' }])
    })

    it('only issues one fetch for repeated callers (caching)', async () => {
        const { setApi } = await import('../src/api/client')
        const get = vi.fn().mockResolvedValue([{ id: 1, name: 'X' }])
        const api = { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as PluginHostContext['api']
        setApi(api)
        const { fetchAgents } = useAgents()
        await Promise.all([fetchAgents(), fetchAgents(), fetchAgents()])
        // The composable's in-flight de-dupes; the host-side `api.get`
        // should still only be called once even though three callers
        // raced through `fetchAgents()`.
        expect(get).toHaveBeenCalledTimes(1)
    })
})

describe('MemoryEditor (smoke)', () => {
    it('emits save with the entered name', async () => {
        const wrapper = mount(MemoryEditor, { props: { scope: 'global' } })
        await wrapper.find('input[type="text"]').setValue('greeting')
        await wrapper.find('form').trigger('submit')
        expect((wrapper.emitted('save') as unknown[][])[0]?.[0]).toMatchObject({ name: 'greeting' })
    })
})
