/**
 * MemorySidebar — left navigation for the memories app.
 *
 * Plug-side port of `spora-frontend/tests/apps/memories/components/MemorySidebar.spec.ts`.
 * The only meaningful diff: the `@/stores/agent` mock is replaced by
 * a `../composables/useAgents` mock that exposes the same
 * `{ agents, fetchAgents }` shape.
 */
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

const pushMock = vi.fn()
const routeObj = reactive<{ name: string; params: Record<string, string>; query: Record<string, string> }>({
    name: 'agent-memories',
    params: { id: '7' },
    query: {},
})

vi.mock('vue-router', () => ({
    useRoute: () => routeObj,
    useRouter: () => ({ push: pushMock }),
}))

const agentsRef = ref<Array<{ id: number; name: string }>>([])
const fetchAgentsMock = vi.fn()
const loadGlobalMemoriesMock = vi.fn()
const loadAgentMemoriesMock = vi.fn()
const globalMemoriesRef = ref<Array<{ id: string; name: string }>>([])
const agentMemoriesRef = ref<Array<{ id: string; name: string }>>([])

vi.mock('../../src/stores/memories', () => ({
    useMemoriesStore: () => ({
        get globalMemories() { return globalMemoriesRef.value },
        get agentMemories() { return agentMemoriesRef.value },
        loadGlobalMemories: loadGlobalMemoriesMock,
        loadAgentMemories: loadAgentMemoriesMock,
    }),
}))

const principalsRef = ref<Array<{ id: number; type: string; name: string }>>([])
const selectedPrincipalId = ref<number | null>(null)
const loadPrincipalsMock = vi.fn()
const selectPrincipalMock = vi.fn()

vi.mock('../../src/stores/principals', () => ({
    usePrincipalsStore: () => ({
        get principals() { return principalsRef.value },
        get selectedPrincipalId() { return selectedPrincipalId.value },
        loadPrincipals: loadPrincipalsMock,
        selectPrincipal: selectPrincipalMock,
        currentPrincipal: null,
    }),
}))

vi.mock('../../src/components/PrincipalChipRow.vue', () => ({
    default: {
        name: 'PrincipalChipRow',
        template: '<div data-testid="principal-chip-row-stub" />',
    },
}))

vi.mock('../../src/composables/useAgents', () => ({
    useAgents: () => ({
        // The production `useAgents()` returns a Pinia-style object
        // whose `agents` is a `Ref<AgentSummary[]>`. Consumers do
        // `const { agents } = useAgents(); agents.value.find(...)`,
        // so the mock has to hand back the ref itself, not its
        // current value. Returning the unwrapped array would make
        // `agents.value` be `undefined` and the sidebar's
        // computed (`selectedAgentName`) blow up at render time.
        agents: agentsRef,
        fetchAgents: fetchAgentsMock,
    }),
}))

import MemorySidebar from '../../src/components/MemorySidebar.vue'

beforeEach(() => {
    setActivePinia(createPinia())
    agentsRef.value = []
    principalsRef.value = []
    selectedPrincipalId.value = null
    globalMemoriesRef.value = []
    agentMemoriesRef.value = []
    routeObj.name = 'agent-memories'
    routeObj.params = { id: '7' }
    routeObj.query = {}
    fetchAgentsMock.mockReset().mockResolvedValue(undefined)
    loadGlobalMemoriesMock.mockReset().mockResolvedValue(undefined)
    loadAgentMemoriesMock.mockReset().mockResolvedValue(undefined)
    loadPrincipalsMock.mockReset().mockResolvedValue(undefined)
    selectPrincipalMock.mockReset()
    pushMock.mockReset()
})

function mountSidebar(props: { mobileOpen?: boolean } = {}) {
    return mount(MemorySidebar, { props })
}

describe('MemorySidebar', () => {
    it('renders the Memories app header', () => {
        const wrapper = mountSidebar()
        expect(wrapper.text()).toContain('Memories')
    })

    it('loads agents and global memories on mount', async () => {
        mountSidebar()
        await flushPromises()
        expect(fetchAgentsMock).toHaveBeenCalled()
        expect(loadGlobalMemoriesMock).toHaveBeenCalled()
    })

    it('shows the "No global memories." placeholder when empty', async () => {
        const wrapper = mountSidebar()
        await flushPromises()
        expect(wrapper.text()).toContain('No global memories.')
    })

    it('renders up to 5 global memories and a "View all" link', async () => {
        globalMemoriesRef.value = [
            { id: 'g1', name: 'g1' },
            { id: 'g2', name: 'g2' },
            { id: 'g3', name: 'g3' },
        ]
        const wrapper = mountSidebar()
        await flushPromises()
        expect(wrapper.text()).toContain('g1')
        expect(wrapper.text()).toContain('g2')
        expect(wrapper.text()).toContain('g3')
        expect(wrapper.text()).toContain('View all')
    })

    it('does not initialize an agent when route has no id and there are no agents', async () => {
        routeObj.params = {}
        agentsRef.value = []
        const wrapper = mountSidebar()
        await flushPromises()
        expect(wrapper.text()).toContain('Select an agent')
        expect(loadAgentMemoriesMock).not.toHaveBeenCalled()
    })

    it('initializes selectedAgentId from route params', async () => {
        routeObj.params = { id: '42' }
        agentsRef.value = [{ id: 42, name: 'A' }]
        mountSidebar()
        await flushPromises()
        expect(loadAgentMemoriesMock).toHaveBeenCalledWith(42, undefined)
    })

    it('falls back to first agent when no route id is set', async () => {
        routeObj.params = {}
        agentsRef.value = [
            { id: 1, name: 'First' },
            { id: 2, name: 'Second' },
        ]
        const wrapper = mountSidebar()
        await flushPromises()
        expect(loadAgentMemoriesMock).toHaveBeenCalledWith(1, undefined)
        expect(wrapper.text()).toContain('First')
    })

    it('shows "No memories for this agent." when agent has none', async () => {
        routeObj.params = { id: '5' }
        agentsRef.value = [{ id: 5, name: 'X' }]
        const wrapper = mountSidebar()
        await flushPromises()
        expect(wrapper.text()).toContain('No memories for this agent.')
    })

    it('shows the agent selector button with the selected agent name', async () => {
        routeObj.params = { id: '3' }
        agentsRef.value = [{ id: 3, name: 'Pickle' }]
        const wrapper = mountSidebar()
        await flushPromises()
        expect(wrapper.text()).toContain('Pickle')
    })

    it('shows "Unknown" when selected agent id has no matching agent', async () => {
        routeObj.params = { id: '99' }
        agentsRef.value = [{ id: 1, name: 'Other' }]
        const wrapper = mountSidebar()
        await flushPromises()
        expect(wrapper.text()).toContain('Unknown')
    })

    it('navigates to global-memories when "View all" is clicked', async () => {
        globalMemoriesRef.value = [{ id: 'g1', name: 'g1' }]
        const wrapper = mountSidebar()
        await flushPromises()
        const viewAll = wrapper.findAll('button').find((b) => (b.text() ?? '').includes('View all'))
        expect(viewAll).toBeDefined()
        viewAll?.trigger('click')
        expect(pushMock).toHaveBeenCalledWith({ name: 'global-memories' })
    })

    it('navigates to global-memories with create=1 when "New" is clicked', async () => {
        const wrapper = mountSidebar()
        await flushPromises()
        const newBtns = wrapper.findAll('button').filter((b) => (b.text() ?? '').trim() === '+New' || (b.text() ?? '').includes('New'))
        expect(newBtns.length).toBeGreaterThan(0)
        newBtns[0]?.trigger('click')
        expect(pushMock).toHaveBeenCalledWith({ name: 'global-memories', query: { create: '1' } })
    })

    it('emits close when the mobile close button is clicked', async () => {
        const wrapper = mountSidebar({ mobileOpen: true })
        await flushPromises()
        const closeBtn = wrapper.findAll('button').find((b) => b.html().includes('lucide-x'))
        if (closeBtn) {
            await closeBtn.trigger('click')
            expect(wrapper.emitted('close')).toBeTruthy()
        } else {
            const buttons = wrapper.findAll('button')
            await buttons[0]?.trigger('click')
        }
    })

    it('reloads global memories when the selected principal changes on the global route', async () => {
        routeObj.name = 'global-memories'
        routeObj.params = {}
        mountSidebar()
        await flushPromises()
        loadGlobalMemoriesMock.mockClear()
        selectedPrincipalId.value = 7
        await flushPromises()
        expect(loadGlobalMemoriesMock).toHaveBeenCalled()
    })

    it('does not reload memories when the selected principal changes on the agent route', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        mountSidebar()
        await flushPromises()
        loadGlobalMemoriesMock.mockClear()
        selectedPrincipalId.value = 9
        await flushPromises()
        expect(loadGlobalMemoriesMock).not.toHaveBeenCalled()
    })

    it('opens and closes the agent dropdown', async () => {
        agentsRef.value = [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }]
        routeObj.params = { id: '1' }
        const wrapper = mountSidebar()
        await flushPromises()
        // The selector button is the only one in the agent section that
        // contains a chevron-down icon. Use that as the toggle.
        const selector = wrapper.findAll('button').find((b) => (b.html() ?? '').includes('lucide-chevron-down'))
        expect(selector).toBeDefined()
        const buttonsBefore = wrapper.findAll('button').length
        await selector?.trigger('click')
        await flushPromises()
        const buttonsAfterOpen = wrapper.findAll('button').length
        expect(buttonsAfterOpen).toBeGreaterThan(buttonsBefore)
        await selector?.trigger('click')
        await flushPromises()
        const buttonsAfterClose = wrapper.findAll('button').length
        expect(buttonsAfterClose).toBe(buttonsBefore)
    })

    it('selects an agent from the dropdown and routes to its memories', async () => {
        agentsRef.value = [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }]
        routeObj.params = { id: '1' }
        const wrapper = mountSidebar()
        await flushPromises()
        const selector = wrapper.findAll('button').find((b) => (b.html() ?? '').includes('lucide-chevron-down'))
        await selector?.trigger('click')
        await flushPromises()
        const twoBtn = wrapper.findAll('button').find((b) => (b.text() ?? '').includes('Two'))
        expect(twoBtn).toBeDefined()
        await twoBtn?.trigger('click')
        await flushPromises()
        expect(loadAgentMemoriesMock).toHaveBeenCalledWith(2, undefined)
        expect(pushMock).toHaveBeenCalledWith({ name: 'agent-memories', params: { id: '2' } })
    })

    it('passes the active type filter through selectAgent to loadAgentMemories', async () => {
        agentsRef.value = [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }]
        routeObj.params = { id: '1' }
        const wrapper = mountSidebar()
        await flushPromises()
        // Click the Plans chip in the agent sidebar
        const planChip = wrapper.findAll('button').filter((b) => (b.text() ?? '').includes('Plans'))
        expect(planChip.length).toBeGreaterThan(0)
        await planChip[planChip.length - 1]?.trigger('click')
        await flushPromises()
        expect(loadAgentMemoriesMock).toHaveBeenLastCalledWith(1, 'plan')
        // Open the dropdown and pick agent 2 — should preserve the plan filter
        const selector = wrapper.findAll('button').find((b) => (b.html() ?? '').includes('lucide-chevron-down'))
        await selector?.trigger('click')
        await flushPromises()
        const twoBtn = wrapper.findAll('button').find((b) => (b.text() ?? '').includes('Two'))
        await twoBtn?.trigger('click')
        await flushPromises()
        expect(loadAgentMemoriesMock).toHaveBeenLastCalledWith(2, 'plan')
    })

    it('selectType on the global route reloads global memories with the chosen type', async () => {
        routeObj.name = 'global-memories'
        routeObj.params = {}
        const wrapper = mountSidebar()
        await flushPromises()
        loadGlobalMemoriesMock.mockClear()
        const planChip = wrapper.findAll('button').find((b) => (b.text() ?? '').trim() === 'Plans')
        await planChip?.trigger('click')
        await flushPromises()
        expect(loadGlobalMemoriesMock).toHaveBeenLastCalledWith('plan')
    })

    it('renders up to 5 agent memories and a "View all" link when on an agent route', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        agentMemoriesRef.value = [
            { id: 'm1', name: 'm1' },
            { id: 'm2', name: 'm2' },
        ]
        const wrapper = mountSidebar()
        await flushPromises()
        expect(wrapper.text()).toContain('m1')
        expect(wrapper.text()).toContain('m2')
    })

    it('navigates to a specific agent memory when the memory row is clicked', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        agentMemoriesRef.value = [{ id: 'm1', name: 'm1' }]
        const wrapper = mountSidebar()
        await flushPromises()
        const memoryRow = wrapper.findAll('li').find((li) => (li.text() ?? '').includes('m1'))
        expect(memoryRow).toBeDefined()
        await memoryRow?.trigger('click')
        await flushPromises()
        expect(pushMock).toHaveBeenCalledWith({
            name: 'agent-memories',
            params: { id: '7' },
            query: { memory: 'm1' },
        })
    })

    it('highlights the global-memories link when on the global route', async () => {
        routeObj.name = 'global-memories'
        routeObj.params = {}
        const wrapper = mountSidebar()
        await flushPromises()
        const globalLink = wrapper.findAll('button').find((b) => (b.text() ?? '').includes('Global') && (b.text() ?? '').length <= 8)
        expect(globalLink).toBeDefined()
        expect(globalLink?.classes().join(' ')).toContain('text-primary')
    })

    it('highlights the agent-memories link when on the agent route', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        const wrapper = mountSidebar()
        await flushPromises()
        const agentLink = wrapper.findAll('button').find((b) => (b.text() ?? '').includes('Agent') && (b.text() ?? '').length <= 8)
        expect(agentLink).toBeDefined()
        expect(agentLink?.classes().join(' ')).toContain('text-primary')
    })

    it('renders the agent-type filter chips when on an agent route', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        const wrapper = mountSidebar()
        await flushPromises()
        // The agent section has its own type filter chips too
        const planChips = wrapper.findAll('button').filter((b) => (b.text() ?? '').includes('Plans'))
        // Expect at least 2 'Plans' buttons (one for global, one for agent section)
        expect(planChips.length).toBeGreaterThanOrEqual(2)
    })

    it('navigates to the agent memories for the selected agent when the agent-section "View all" is clicked', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        const wrapper = mountSidebar()
        await flushPromises()
        // Pick the second "View all" (the agent section one)
        const viewAlls = wrapper.findAll('button').filter((b) => (b.text() ?? '').includes('View all'))
        expect(viewAlls.length).toBeGreaterThanOrEqual(1)
        await viewAlls[viewAlls.length - 1]?.trigger('click')
        await flushPromises()
        expect(pushMock).toHaveBeenCalledWith({ name: 'agent-memories', params: { id: '7' } })
    })
})
