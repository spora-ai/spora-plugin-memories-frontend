/**
 * MemoriesPage — unified memories shell.
 *
 * Cover the layout surface that the new design introduces:
 *   - Scope bar (PrincipalChipRow)
 *   - Mode row (Global / Agent: X segmented control + New button)
 *   - Agent dropdown toggle + selection
 *   - DocumentsPanel type filter dispatch (plan / docs / examples / context)
 *   - Editor state machine (empty / create / edit driven by ?create / ?memory)
 *   - Save / delete / cancel handlers wired to the correct store
 *     action based on the active route
 *   - Drag-to-reorder handler dispatch (global vs agent mode)
 *   - Route transitions (Global <-> Agent)
 *
 * Composition matches what `spora-frontend/tests/apps/memories/pages/MemoriesPage.spec.ts`
 * tests: we stub sub-components (`DocumentsPanel`, `PrincipalChipRow`,
 * `MemoryEditor`, `AlertBanner`) and let the page own the
 * orchestration logic.
 */
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_CONTEXT_KEY, type PluginHostContext } from '../../src/shims'

const routeObj = reactive<{ name: string; params: Record<string, string>; query: Record<string, string> }>({
    name: 'global-memories',
    params: {},
    query: {},
})
const pushMock = vi.fn()

vi.mock('vue-router', () => ({
    useRoute: () => routeObj,
    useRouter: () => ({ push: pushMock }),
}))

// Store actions
const globalMemories = ref<Array<{ id: string; name: string; content: string; summary?: string | null; order: number; type: 'plan' | 'documentation' | 'examples' | 'context' }>>([])
const agentMemories = ref<Array<{ id: string; name: string; content: string; summary?: string | null; order: number; type: 'plan' | 'documentation' | 'examples' | 'context' }>>([])
const loadGlobalMemories = vi.fn().mockResolvedValue(undefined)
const loadAgentMemories = vi.fn().mockResolvedValue(undefined)
const createGlobalMemory = vi.fn()
const updateGlobalMemory = vi.fn()
const deleteGlobalMemory = vi.fn()
const reorderGlobalMemories = vi.fn().mockResolvedValue(undefined)
const createAgentMemory = vi.fn()
const updateAgentMemory = vi.fn()
const deleteAgentMemory = vi.fn()
const reorderAgentMemories = vi.fn().mockResolvedValue(undefined)
const storeError = ref<string | null>(null)
const storeSaving = ref(false)

vi.mock('../../src/stores/memories', () => ({
    useMemoriesStore: () => ({
        get globalMemories() { return globalMemories.value },
        get agentMemories() { return agentMemories.value },
        loadingGlobal: false,
        loadingAgent: false,
        get saving() { return storeSaving.value },
        get error() { return storeError.value },
        loadGlobalMemories,
        loadAgentMemories,
        createGlobalMemory,
        updateGlobalMemory,
        deleteGlobalMemory,
        reorderGlobalMemories,
        createAgentMemory,
        updateAgentMemory,
        deleteAgentMemory,
        reorderAgentMemories,
    }),
}))

// Principals store
const principalsRef = ref<Array<{ id: number; type: string; name: string }>>([])
const selectedPrincipalId = ref<number | null>(null)
const loadPrincipals = vi.fn().mockResolvedValue(undefined)
vi.mock('../../src/stores/principals', () => ({
    usePrincipalsStore: () => ({
        get principals() { return principalsRef.value },
        get selectedPrincipalId() { return selectedPrincipalId.value },
        loadPrincipals,
        selectPrincipal: vi.fn(),
        currentPrincipal: null,
    }),
}))

// useAgents — use the real composable so we can populate `agents` directly
// via `__resetAgentsForTesting`. The mock below is redundant, but we
// keep it minimal in case the page reaches into the composable for
// fields beyond `agents` and `fetchAgents`.

import { __resetAgentsForTesting } from '../../src/composables/useAgents'
const agentsRef = ref<Array<{ id: number; name: string }>>([])
const fetchAgentsMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../src/composables/useAgents', async () => {
    const actual = await vi.importActual<typeof import('../../src/composables/useAgents')>('../../src/composables/useAgents')
    return {
        ...actual,
        useAgents: () => ({ agents: agentsRef, fetchAgents: fetchAgentsMock }),
    }
})

const hostContext: PluginHostContext = {
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    pinia: null,
    theme: 'light',
    route: null,
    router: null,
}

import MemoriesPage from '../../src/pages/MemoriesPage.vue'

const DocumentsPanelStub = {
    name: 'DocumentsPanel',
    props: ['documents', 'typeFilter', 'activeMemoryId', 'loading', 'mode'],
    template: `
        <div data-test="documents-panel-stub"
             :data-mode="mode"
             :data-filter="typeFilter"
             :data-active="activeMemoryId"
             :data-doc-count="documents.length">
            <button data-testid="dp-chip-plan" @click="$emit('select-type', 'plan')">Plan</button>
            <button data-testid="dp-chip-docs" @click="$emit('select-type', 'documentation')">Docs</button>
            <button data-testid="dp-chip-all" @click="$emit('select-type', null)">All</button>
            <button data-testid="dp-row-a" @click="$emit('select-document', 'mem-a')">Row A</button>
            <button data-testid="dp-row-b" @click="$emit('select-document', 'mem-b')">Row B</button>
            <button data-testid="dp-reorder" @click="$emit('reorder', ['mem-b', 'mem-a'])">Reorder</button>
            <button data-testid="dp-new" @click="$emit('new')">New</button>
        </div>
    `,
}

const PrincipalChipRowStub = {
    name: 'PrincipalChipRow',
    template: '<div data-test="principal-chip-row-stub" />',
}

const AlertBannerStub = {
    name: 'AlertBanner',
    props: ['type', 'message'],
    template: '<div data-test="alert-banner-stub">{{ message }}</div>',
}

const MemoryEditorStub = {
    name: 'MemoryEditor',
    props: ['memory', 'saving', 'scope', 'agentName'],
    emits: ['save', 'delete', 'cancel'],
    template: `
        <div class="editor-stub"
             :data-scope="scope"
             :data-agent-name="agentName"
             :data-memory-id="memory ? memory.id : ''"
             :data-is-edit="memory !== null">
            <button data-testid="ed-save"
                    @click="$emit('save', { name: 'saved', type: 'context' })" />
            <button data-testid="ed-save-update"
                    @click="$emit('save', { name: 'renamed', type: 'plan', summary: 'x', content: 'y' })" />
            <button data-testid="ed-delete"
                    @click="$emit('delete')" />
            <button data-testid="ed-cancel"
                    @click="$emit('cancel')" />
        </div>
    `,
}

function mountPage() {
    return mount(MemoriesPage, {
        global: {
            provide: { [HOST_CONTEXT_KEY]: hostContext },
            stubs: {
                DocumentsPanel: DocumentsPanelStub,
                PrincipalChipRow: PrincipalChipRowStub,
                AlertBanner: AlertBannerStub,
                MemoryEditor: MemoryEditorStub,
            },
        },
        attachTo: document.body,
    })
}

beforeEach(() => {
    setActivePinia(createPinia())
    document.body.innerHTML = ''
    agentsRef.value = []
    principalsRef.value = []
    selectedPrincipalId.value = null
    globalMemories.value = []
    agentMemories.value = []
    storeError.value = null
    storeSaving.value = false
    routeObj.name = 'global-memories'
    routeObj.params = {}
    routeObj.query = {}
    __resetAgentsForTesting()
    pushMock.mockReset()
    loadGlobalMemories.mockReset().mockResolvedValue(undefined)
    loadAgentMemories.mockReset().mockResolvedValue(undefined)
    loadPrincipals.mockReset().mockResolvedValue(undefined)
    fetchAgentsMock.mockReset().mockResolvedValue(undefined)
    createGlobalMemory.mockReset()
    updateGlobalMemory.mockReset()
    deleteGlobalMemory.mockReset()
    reorderGlobalMemories.mockReset()
    createAgentMemory.mockReset()
    updateAgentMemory.mockReset()
    deleteAgentMemory.mockReset()
    reorderAgentMemories.mockReset()
})

afterEach(() => {
    document.body.innerHTML = ''
})

describe('MemoriesPage — mount + initial load', () => {
    it('renders the PrincipalChipRow scope bar', async () => {
        const wrapper = mountPage()
        await flushPromises()
        expect(wrapper.find('[data-test="principal-chip-row-stub"]').exists()).toBe(true)
    })

    it('renders the documents panel and the empty editor state on a fresh global mount', async () => {
        const wrapper = mountPage()
        await flushPromises()
        expect(wrapper.find('[data-test="documents-panel-stub"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="editor-empty"]').exists()).toBe(true)
    })

    it('calls loadGlobalMemories on the global route', async () => {
        routeObj.name = 'global-memories'
        mountPage()
        await flushPromises()
        expect(loadGlobalMemories).toHaveBeenCalled()
        expect(loadAgentMemories).not.toHaveBeenCalled()
    })

    it('calls loadAgentMemories when the agent route has a numeric id', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        mountPage()
        await flushPromises()
        expect(loadAgentMemories).toHaveBeenCalledWith(7, undefined)
        expect(loadGlobalMemories).not.toHaveBeenCalled()
    })

    it('skips loadAgentMemories when the agent route id is not numeric', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: 'abc' }
        mountPage()
        await flushPromises()
        expect(loadAgentMemories).not.toHaveBeenCalled()
    })

    it('loads agents and principals on mount', async () => {
        mountPage()
        await flushPromises()
        expect(fetchAgentsMock).toHaveBeenCalled()
        expect(loadPrincipals).toHaveBeenCalled()
    })
})

describe('MemoriesPage — mode row', () => {
    it('highlights the Global segment when on global mode', async () => {
        const wrapper = mountPage()
        await flushPromises()
        const globalBtn = wrapper.find('[data-test="mode-global"]')
        expect(globalBtn.classes().join(' ')).toContain('bg-primary')
    })

    it('highlights the Agent segment when on agent mode', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'Pickle' }]
        const wrapper = mountPage()
        await flushPromises()
        const agentBtn = wrapper.find('[data-test="mode-agent"]')
        expect(agentBtn.classes().join(' ')).toContain('bg-primary')
    })

    it('navigates to global-memories when the Global segment is clicked', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-test="mode-global"]').trigger('click')
        expect(pushMock).toHaveBeenCalledWith({ name: 'global-memories' })
    })

    it('navigates to agent-memories with the first agent id when the Agent segment is clicked from global mode', async () => {
        agentsRef.value = [{ id: 11, name: 'Alpha' }, { id: 22, name: 'Beta' }]
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-test="mode-agent"]').trigger('click')
        expect(pushMock).toHaveBeenCalledWith({ name: 'agent-memories', params: { id: '11' } })
    })

    it('opens the agent dropdown when on agent mode and the Agent segment is clicked again', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '1' }
        agentsRef.value = [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }]
        const wrapper = mountPage()
        await flushPromises()
        expect(wrapper.find('[data-test="agent-dropdown"]').exists()).toBe(false)
        await wrapper.find('[data-test="mode-agent"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-test="agent-dropdown"]').exists()).toBe(true)
    })

    it('renders one menu row per agent inside the dropdown and routes to the picked agent', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '1' }
        agentsRef.value = [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }]
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-test="mode-agent"]').trigger('click')
        await flushPromises()
        const two = wrapper.findAll('[data-test="agent-dropdown"] button').find((b) => b.text().includes('Two'))
        expect(two).toBeDefined()
        await two!.trigger('click')
        expect(pushMock).toHaveBeenCalledWith({ name: 'agent-memories', params: { id: '2' } })
    })
})

describe('MemoriesPage — type filter dispatch', () => {
    it('reloads global memories with the chosen type when a chip is selected', async () => {
        const wrapper = mountPage()
        await flushPromises()
        loadGlobalMemories.mockClear()
        await wrapper.find('[data-testid="dp-chip-plan"]').trigger('click')
        await flushPromises()
        expect(loadGlobalMemories).toHaveBeenLastCalledWith('plan')
    })

    it('clears the global type filter when the same chip is clicked twice', async () => {
        const wrapper = mountPage()
        await flushPromises()
        loadGlobalMemories.mockClear()
        await wrapper.find('[data-testid="dp-chip-docs"]').trigger('click')
        await flushPromises()
        expect(loadGlobalMemories).toHaveBeenLastCalledWith('documentation')
        await wrapper.find('[data-testid="dp-chip-docs"]').trigger('click')
        await flushPromises()
        expect(loadGlobalMemories).toHaveBeenLastCalledWith(undefined)
    })

    it('reloads agent memories when a chip is selected in agent mode', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        const wrapper = mountPage()
        await flushPromises()
        loadAgentMemories.mockClear()
        await wrapper.find('[data-testid="dp-chip-plan"]').trigger('click')
        await flushPromises()
        expect(loadAgentMemories).toHaveBeenLastCalledWith(7, 'plan')
    })
})

describe('MemoriesPage — drag reorder dispatch', () => {
    it('forwards a reorder event into the global store on the global route', async () => {
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="dp-reorder"]').trigger('click')
        await flushPromises()
        expect(reorderGlobalMemories).toHaveBeenCalledWith(['mem-b', 'mem-a'])
        expect(reorderAgentMemories).not.toHaveBeenCalled()
    })

    it('forwards a reorder event into the agent store on the agent route', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="dp-reorder"]').trigger('click')
        await flushPromises()
        expect(reorderAgentMemories).toHaveBeenCalledWith(7, ['mem-b', 'mem-a'])
    })
})

describe('MemoriesPage — editor routing', () => {
    it('renders the create view when ?create=1 is in the URL', async () => {
        routeObj.query = { create: '1' }
        const wrapper = mountPage()
        await flushPromises()
        expect(wrapper.find('[data-test="editor-view-create"]').exists()).toBe(true)
    })

    it('calls createGlobalMemory and routes to the new memory on save in global mode', async () => {
        routeObj.query = { create: '1' }
        const created = { id: 'mem-new', name: 'saved', content: 'c', order: 0, type: 'context' as const }
        createGlobalMemory.mockResolvedValueOnce(created)
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="ed-save"]').trigger('click')
        await flushPromises()
        expect(createGlobalMemory).toHaveBeenCalled()
        expect(pushMock).toHaveBeenCalledWith({ name: 'global-memories', query: { memory: 'mem-new' } })
    })

    it('selects a memory from the list and renders the edit view', async () => {
        globalMemories.value = [
            { id: 'mem-a', name: 'A', content: '', summary: null, order: 0, type: 'context' },
        ]
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="dp-row-a"]').trigger('click')
        await flushPromises()
        expect(pushMock).toHaveBeenCalledWith({ name: 'global-memories', query: { memory: 'mem-a' } })
    })

    it('hydrates the selected memory and shows the edit view when ?memory=<id> matches', async () => {
        globalMemories.value = [
            { id: 'mem-a', name: 'A', content: '', summary: null, order: 0, type: 'context' },
        ]
        routeObj.query = { memory: 'mem-a' }
        const wrapper = mountPage()
        await flushPromises()
        const editor = wrapper.find('[data-test="editor-view-edit"]')
        expect(editor.exists()).toBe(true)
        expect(editor.find('.editor-stub').attributes('data-memory-id')).toBe('mem-a')
    })

    it('falls back to the empty view when ?memory=<id> does not match any row', async () => {
        globalMemories.value = []
        routeObj.query = { memory: 'missing' }
        const wrapper = mountPage()
        await flushPromises()
        expect(wrapper.find('[data-test="editor-empty"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="editor-view-edit"]').exists()).toBe(false)
    })

    it('calls updateGlobalMemory and routes back to the memory on save in edit mode', async () => {
        const m = { id: 'mem-a', name: 'A', content: '', summary: null, order: 0, type: 'context' as const }
        globalMemories.value = [m]
        const updated = { ...m, name: 'renamed' }
        updateGlobalMemory.mockResolvedValueOnce(updated)
        routeObj.query = { memory: 'mem-a' }
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="ed-save-update"]').trigger('click')
        await flushPromises()
        expect(updateGlobalMemory).toHaveBeenCalledWith('mem-a', expect.any(Object))
        expect(pushMock).toHaveBeenCalledWith({ name: 'global-memories', query: { memory: 'mem-a' } })
    })

    it('calls deleteGlobalMemory and goes back to the list when the editor emits delete', async () => {
        const m = { id: 'mem-a', name: 'A', content: '', summary: null, order: 0, type: 'context' as const }
        globalMemories.value = [m]
        deleteGlobalMemory.mockResolvedValueOnce(undefined)
        routeObj.query = { memory: 'mem-a' }
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="ed-delete"]').trigger('click')
        await flushPromises()
        expect(deleteGlobalMemory).toHaveBeenCalledWith('mem-a')
        expect(pushMock).toHaveBeenCalledWith({ name: 'global-memories', query: {} })
    })

    it('routes back to the list when the editor emits cancel', async () => {
        routeObj.query = { create: '1' }
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="ed-cancel"]').trigger('click')
        await flushPromises()
        expect(pushMock).toHaveBeenCalledWith({ name: 'global-memories', query: {} })
    })

    it('passes the agent id when calling agent-side save/update/delete', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        const m = { id: 'mem-x', name: 'X', content: '', summary: null, order: 0, type: 'context' as const }
        agentMemories.value = [m]
        const created = { ...m, id: 'mem-new' }
        const updated = { ...m, name: 'renamed' }
        createAgentMemory.mockResolvedValueOnce(created)
        updateAgentMemory.mockResolvedValueOnce(updated)
        const wrapper = mountPage()

        // Create
        routeObj.query = { create: '1' }
        await flushPromises()
        await wrapper.find('[data-testid="ed-save"]').trigger('click')
        await flushPromises()
        expect(createAgentMemory).toHaveBeenCalledWith(7, expect.any(Object))
        expect(pushMock).toHaveBeenCalledWith({ name: 'agent-memories', params: { id: '7' }, query: { memory: 'mem-new' } })

        // Edit
        routeObj.query = { memory: 'mem-x' }
        await flushPromises()
        await wrapper.find('[data-testid="ed-save-update"]').trigger('click')
        await flushPromises()
        expect(updateAgentMemory).toHaveBeenCalledWith(7, 'mem-x', expect.any(Object))

        // Delete
        deleteAgentMemory.mockResolvedValueOnce(undefined)
        await wrapper.find('[data-testid="ed-delete"]').trigger('click')
        await flushPromises()
        expect(deleteAgentMemory).toHaveBeenCalledWith(7, 'mem-x')
        expect(pushMock).toHaveBeenCalledWith({ name: 'agent-memories', params: { id: '7' }, query: {} })
    })
})

describe('MemoriesPage — principal change', () => {
    it('reloads global memories when the principal changes on the global route', async () => {
        principalsRef.value = [{ id: 1, type: 'user', name: 'User #1' }]
        mountPage()
        await flushPromises()
        loadGlobalMemories.mockClear()
        selectedPrincipalId.value = 2
        await flushPromises()
        expect(loadGlobalMemories).toHaveBeenCalled()
    })

    it('reloads agent memories when the principal changes on the agent route', async () => {
        // Mock keeps agent 7 visible regardless of principal — the
        // active agent stays in the dropdown after the change, so the
        // page reloads its memories under the new principal scope.
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        principalsRef.value = [{ id: 1, type: 'user', name: 'User #1' }]
        mountPage()
        await flushPromises()
        loadAgentMemories.mockClear()
        loadGlobalMemories.mockClear()
        selectedPrincipalId.value = 2
        await flushPromises()
        expect(loadAgentMemories).toHaveBeenCalled()
        expect(loadGlobalMemories).not.toHaveBeenCalled()
    })

    it('falls back to global memories when the active agent is no longer visible after the principal change', async () => {
        routeObj.name = 'agent-memories'
        routeObj.params = { id: '7' }
        agentsRef.value = [{ id: 7, name: 'A' }]
        principalsRef.value = [{ id: 1, type: 'user', name: 'User #1' }]
        mountPage()
        await flushPromises()
        loadAgentMemories.mockClear()
        loadGlobalMemories.mockClear()
        // Simulate the principal change kicking the agent out of the
        // filtered list — that's the invariant that drives the route
        // nudge to global-memories.
        agentsRef.value = []
        selectedPrincipalId.value = 2
        await flushPromises()
        expect(pushMock).toHaveBeenCalledWith({ name: 'global-memories' })
    })
})

describe('MemoriesPage — sidebar new + error banner', () => {
    it('pushes ?create=1 when the documents-panel footer `New document` button is clicked', async () => {
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="dp-new"]').trigger('click')
        await flushPromises()
        expect(pushMock).toHaveBeenCalledWith({ name: 'global-memories', query: { create: '1' } })
    })

    it('pushes ?create=1 when the mode-row top-right `New` button is clicked', async () => {
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-test="new-memory"]').trigger('click')
        await flushPromises()
        expect(pushMock).toHaveBeenCalledWith({ name: 'global-memories', query: { create: '1' } })
    })

    it('renders the AlertBanner when the store has an error', async () => {
        storeError.value = 'Could not load memories.'
        const wrapper = mountPage()
        await flushPromises()
        expect(wrapper.find('[data-test="alert-banner-stub"]').exists()).toBe(true)
        expect(wrapper.text()).toContain('Could not load memories.')
    })
})

describe('MemoriesPage — mobile menu toggle', () => {
    it('does not render the mobile overlay on a fresh mount', () => {
        const wrapper = mountPage()
        expect(wrapper.find('dialog').exists()).toBe(false)
    })
})
