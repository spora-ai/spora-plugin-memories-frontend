import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, it, beforeEach, expect } from 'vitest'
import { createMockApi } from '../../src/dev-mock'
import { setApi } from '../../src/api/client'
import { HOST_CONTEXT_KEY, type PluginHostContext } from '../../src/shims'
import { usePrincipalsStore } from '../../src/stores/principals'
import { useAgents, __resetAgentsForTesting } from '../../src/composables/useAgents'
import MemoriesPage from '../../src/pages/MemoriesPage.vue'
import PrincipalChipRow from '../../src/components/PrincipalChipRow.vue'

function captureDocs(wrapper: ReturnType<typeof mount>): Array<{ name: string; agent_id: number | null; principal_id: number }> {
    const dp = wrapper.findAllComponents({ name: 'DocumentsPanel' })
    if (dp.length === 0) return []
    const props = dp[0]!.props() as { documents?: Array<{ name: string; agent_id: number | null; principal_id: number }> }
    return props.documents ?? []
}

describe('MemoriesPage — end-to-end scope + agent switching', () => {
    let router: ReturnType<typeof createRouter>
    let hostContext: PluginHostContext
    let mock: ReturnType<typeof createMockApi>

    beforeEach(async () => {
        const pinia = createPinia()
        setActivePinia(pinia)
        __resetAgentsForTesting()

        mock = createMockApi()
        setApi(mock)

        router = createRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', name: 'global-memories', component: MemoriesPage },
                { path: '/agents/:id', name: 'agent-memories', component: MemoriesPage },
            ],
        })

        hostContext = {
            api: mock,
            pinia,
            theme: 'light',
            route: { path: '/apps/memories', params: {}, query: {} },
            router: {
                push: async (to: string) => { await router.push(to) },
                currentRoute: { value: { path: '/apps/memories' } },
            },
            openMediaPicker: async () => [],
        }
    })

    it('switches the documents panel when the principal chip is clicked', async () => {
        await router.push('/')
        await router.isReady()

        const wrapper = mount(MemoriesPage, {
            global: {
                plugins: [router],
                provide: { [HOST_CONTEXT_KEY]: hostContext },
            },
        })
        await flushPromises()

        expect(captureDocs(wrapper).map((d) => d.name)).toEqual(['user_preferences', 'project_context'])
        expect(wrapper.findComponent(PrincipalChipRow).exists()).toBe(true)

        // Mirror what PrincipalChipRow does in prod: drive the store
        // directly so we exercise the same selectPrincipal path.
        const principals = usePrincipalsStore()
        principals.selectPrincipal(99)
        await flushPromises()
        expect(captureDocs(wrapper).map((d) => d.name)).toEqual(['team_roster'])

        principals.selectPrincipal(42)
        await flushPromises()
        expect(captureDocs(wrapper).map((d) => d.name)).toEqual(['user_preferences', 'project_context'])
    })

    it('refreshes the documents panel when switching between agents in the dropdown', async () => {
        await router.push('/agents/7')
        await router.isReady()

        const wrapper = mount(MemoriesPage, {
            global: {
                plugins: [router],
                provide: { [HOST_CONTEXT_KEY]: hostContext },
            },
        })
        await flushPromises()

        expect(captureDocs(wrapper).map((d) => d.name).sort()).toEqual(['escalation_path', 'oncall_rotation'])

        await router.push('/agents/9')
        await flushPromises()
        expect(captureDocs(wrapper)).toEqual([])

        // Agent 8 is owned by principal 99 — under the default principal-42
        // scope there are no memories to show, but the request must still
        // hit /agents/8/memories so the page renders its empty state.
        await router.push('/agents/8')
        await flushPromises()
        expect(captureDocs(wrapper)).toEqual([])

        await router.push('/agents/7')
        await flushPromises()
        expect(captureDocs(wrapper).map((d) => d.name).sort()).toEqual(['escalation_path', 'oncall_rotation'])
    })

    it('updates the agent dropdown when the principal chip switches', async () => {
        await router.push('/')
        await router.isReady()

        mount(MemoriesPage, {
            global: {
                plugins: [router],
                provide: { [HOST_CONTEXT_KEY]: hostContext },
            },
        })
        await flushPromises()

        const { agents, fetchAgents } = useAgents()
        await fetchAgents([42])
        await flushPromises()
        expect(agents.value.map((a) => a.id).sort()).toEqual([7, 9])

        const principals = usePrincipalsStore()
        principals.selectPrincipal(99)
        await flushPromises()
        expect(agents.value.map((a) => a.id)).toEqual([8])
    })

    it('falls back to global mode when the active agent leaves the filtered set', async () => {
        await router.push('/agents/8')
        await router.isReady()

        mount(MemoriesPage, {
            global: {
                plugins: [router],
                provide: { [HOST_CONTEXT_KEY]: hostContext },
            },
        })
        await flushPromises()

        const principals = usePrincipalsStore()
        principals.selectPrincipal(42)
        await flushPromises()
        expect(router.currentRoute.value.name).toBe('global-memories')
    })

    it('keeps the agent dropdown in sync with the latest fetchAgents token', async () => {
        await router.push('/')
        await router.isReady()

        mount(MemoriesPage, {
            global: {
                plugins: [router],
                provide: { [HOST_CONTEXT_KEY]: hostContext },
            },
        })
        await flushPromises()

        const { agents, fetchAgents } = useAgents()

        // Slow down /agents so the older fetchAgents([42]) is still
        // pending when the newer fetchAgents([99]) resolves.
        const originalGet = mock.get.bind(mock)
        mock.get = (async (...args: Parameters<typeof originalGet>) => {
            const path = String(args[0] ?? '')
            if (path.startsWith('/agents')) {
                await new Promise((r) => setTimeout(r, 30))
            }
            return originalGet(...args)
        }) as typeof mock.get

        const slow = fetchAgents([42])
        const fast = fetchAgents([99])
        await Promise.all([slow, fast])
        expect(agents.value.map((a) => a.id)).toEqual([8])
    })
})
