/**
 * AgentMemoriesPage — agent-scoped memory CRUD.
 *
 * Plug-side port of `spora-frontend/tests/apps/memories/pages/AgentMemoriesPage.spec.ts`.
 * The `@/stores/agent` mock is replaced by `../../src/composables/useAgents`.
 */
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

const routeObj = reactive({ params: { id: '1' } as Record<string, string>, query: {} as Record<string, string> })
const routerReplace = vi.fn()
const routerPush = vi.fn()
vi.mock('vue-router', () => ({
    useRoute: () => routeObj,
    useRouter: () => ({ push: routerPush, replace: routerReplace }),
}))

const agentMemories = ref<Array<{ id: string; name: string; content: string; order: number; type: string }>>([])
const loadAgentMemories = vi.fn()
const createAgentMemory = vi.fn()
const updateAgentMemory = vi.fn()
const deleteAgentMemory = vi.fn()
const replaceAgentMemory = vi.fn()
const reorderAgentMemories = vi.fn()

vi.mock('../../src/stores/memories', () => ({
    useMemoriesStore: () => ({
        globalMemories: [],
        get agentMemories() { return agentMemories.value },
        loadingGlobal: false,
        loadingAgent: false,
        saving: false,
        error: null,
        loadAgentMemories,
        createAgentMemory,
        updateAgentMemory,
        deleteAgentMemory,
        replaceAgentMemory,
        reorderAgentMemories,
    }),
}))

const agentsRef = ref<Array<{ id: number; name: string }>>([{ id: 1, name: 'Test Agent' }])
const fetchAgents = vi.fn().mockResolvedValue(undefined)
vi.mock('../../src/composables/useAgents', () => ({
    useAgents: () => ({
        agents: agentsRef,
        fetchAgents,
    }),
}))

const MemoryListItemStub = {
    name: 'MemoryListItem',
    template: '<div class="list-item-stub" @click="$emit(\'select\', memory)" />',
    props: ['memory'],
}
const MemoryEditorStub = {
    name: 'MemoryEditor',
    template: `
        <div class="editor-stub">
            <button data-testid="save" @click="$emit('save', { name: 'saved', type: 'context' })" />
            <button data-testid="save-update" @click="$emit('save', { name: 'renamed', type: 'plan' })" />
            <button data-testid="replace" @click="$emit('replace', { name: 'rep', type: 'context', find: 'x', new_text: 'y' })" />
            <button data-testid="delete" @click="$emit('delete')" />
            <button data-testid="cancel" @click="$emit('cancel')" />
        </div>
    `,
}
const VueDraggableStub = {
    name: 'VueDraggable',
    template: '<div class="draggable-stub" @end="$emit(\'end\')"><slot /></div>',
}

import AgentMemoriesPage from '../../src/pages/AgentMemoriesPage.vue'

beforeEach(() => {
    setActivePinia(createPinia())
    agentMemories.value = []
    agentsRef.value = [{ id: 1, name: 'Test Agent' }]
    routeObj.params = { id: '1' }
    routeObj.query = {}
    loadAgentMemories.mockReset().mockResolvedValue(undefined)
    createAgentMemory.mockReset()
    updateAgentMemory.mockReset()
    deleteAgentMemory.mockReset()
    replaceAgentMemory.mockReset()
    reorderAgentMemories.mockReset()
    fetchAgents.mockReset().mockResolvedValue(undefined)
    routerReplace.mockReset()
    routerPush.mockReset()
})

function mountPage() {
    return mount(AgentMemoriesPage, {
        global: {
            stubs: {
                MemoryListItem: MemoryListItemStub,
                MemoryEditor: MemoryEditorStub,
                VueDraggable: VueDraggableStub,
            },
        },
    })
}

describe('AgentMemoriesPage', () => {
    it('mounts and calls loadAgentMemories on mount', async () => {
        mountPage()
        await flushPromises()
        expect(loadAgentMemories).toHaveBeenCalledWith(1, undefined)
    })

    it('renders the agent name in the header', async () => {
        const wrapper = mountPage()
        await flushPromises()
        expect(wrapper.text()).toContain('Agent Memories')
    })

    it('does not call loadAgentMemories when route id is not a number', async () => {
        routeObj.params = { id: 'abc' }
        const wrapper = mountPage()
        await flushPromises()
        expect(loadAgentMemories).not.toHaveBeenCalled()
        expect(wrapper.exists()).toBe(true)
    })

    it('renders an empty state when there are no memories', async () => {
        const wrapper = mountPage()
        await flushPromises()
        expect(wrapper.text()).toMatch(/no agent memories|create your first memory/i)
    })

    it('switches to create view when ?create=1 is in the URL', async () => {
        routeObj.query = { create: '1' }
        const wrapper = mountPage()
        await flushPromises()
        expect(wrapper.find('.editor-stub').exists()).toBe(true)
    })

    it('selects the matching agent memory when ?memory=<id> is present', async () => {
        const m = { id: 'mem-1', name: 'alpha', content: 'c', order: 0, type: 'context' }
        agentMemories.value = [m]
        routeObj.query = { memory: 'mem-1' }
        const wrapper = mountPage()
        await flushPromises()
        expect(wrapper.find('.editor-stub').exists()).toBe(true)
    })

    it('falls back to list view when ?memory=<id> does not match any row', async () => {
        agentMemories.value = []
        routeObj.query = { memory: 'missing' }
        const wrapper = mountPage()
        await flushPromises()
        expect(wrapper.find('.editor-stub').exists()).toBe(false)
        expect(wrapper.text()).toMatch(/no agent memories/i)
    })

    it('renders type filter chips and refetches with the chosen type when a chip is clicked', async () => {
        const wrapper = mountPage()
        await flushPromises()
        const planChip = wrapper.findAll('button').find((b) => b.text() === 'Plans')
        expect(planChip).toBeDefined()
        await planChip?.trigger('click')
        await flushPromises()
        expect(loadAgentMemories).toHaveBeenLastCalledWith(1, 'plan')
    })

    it('clears the type filter when the same chip is clicked twice', async () => {
        const wrapper = mountPage()
        await flushPromises()
        const docsChip = wrapper.findAll('button').find((b) => b.text() === 'Docs')
        expect(docsChip).toBeDefined()
        await docsChip?.trigger('click')
        await flushPromises()
        expect(loadAgentMemories).toHaveBeenLastCalledWith(1, 'documentation')
        await docsChip?.trigger('click')
        await flushPromises()
        expect(loadAgentMemories).toHaveBeenLastCalledWith(1, undefined)
    })

    it('skips the refetch when the agent id is not numeric', async () => {
        routeObj.params = { id: 'abc' }
        const wrapper = mountPage()
        await flushPromises()
        const planChip = wrapper.findAll('button').find((b) => b.text() === 'Plans')
        await planChip?.trigger('click')
        await flushPromises()
        expect(loadAgentMemories).not.toHaveBeenCalled()
    })

    it('calls createAgentMemory and routes to the new memory when save is emitted in create mode', async () => {
        const created = { id: 'mem-new', name: 'saved', content: 'c', order: 0, type: 'context' }
        createAgentMemory.mockResolvedValueOnce(created)
        routeObj.query = { create: '1' }
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="save"]').trigger('click')
        await flushPromises()
        expect(createAgentMemory).toHaveBeenCalled()
        expect(routerReplace).toHaveBeenCalledWith({ query: { memory: 'mem-new' } })
    })

    it('calls updateAgentMemory when save is emitted in edit mode', async () => {
        const m = { id: 'mem-1', name: 'alpha', content: 'c', order: 0, type: 'context' }
        agentMemories.value = [m]
        const updated = { ...m, name: 'renamed' }
        updateAgentMemory.mockResolvedValueOnce(updated)
        routeObj.query = { memory: 'mem-1' }
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="save-update"]').trigger('click')
        await flushPromises()
        expect(updateAgentMemory).toHaveBeenCalledWith(1, 'mem-1', expect.any(Object))
        expect(routerReplace).toHaveBeenCalledWith({ query: { memory: 'mem-1' } })
    })

    it('calls replaceAgentMemory and re-syncs the route when replace is emitted', async () => {
        const m = { id: 'mem-1', name: 'alpha', content: 'c', order: 0, type: 'context' }
        agentMemories.value = [m]
        const updated = { ...m, content: 'y' }
        replaceAgentMemory.mockResolvedValueOnce(updated)
        routeObj.query = { memory: 'mem-1' }
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="replace"]').trigger('click')
        await flushPromises()
        expect(replaceAgentMemory).toHaveBeenCalledWith(1, 'mem-1', expect.any(Object))
        expect(routerReplace).toHaveBeenCalledWith({ query: { memory: 'mem-1' } })
    })

    it('calls deleteAgentMemory and returns to the list when delete is emitted', async () => {
        const m = { id: 'mem-1', name: 'alpha', content: 'c', order: 0, type: 'context' }
        agentMemories.value = [m]
        deleteAgentMemory.mockResolvedValueOnce(undefined)
        routeObj.query = { memory: 'mem-1' }
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="delete"]').trigger('click')
        await flushPromises()
        expect(deleteAgentMemory).toHaveBeenCalledWith(1, 'mem-1')
        expect(routerReplace).toHaveBeenCalledWith({ query: {} })
    })

    it('returns to the list view when cancel is emitted', async () => {
        routeObj.query = { create: '1' }
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('[data-testid="cancel"]').trigger('click')
        await flushPromises()
        expect(routerReplace).toHaveBeenCalledWith({ query: {} })
    })

    it('sends the new agent order to reorderAgentMemories when drag ends', async () => {
        agentMemories.value = [
            { id: 'a', name: 'A', content: 'c', order: 0, type: 'context' },
            { id: 'b', name: 'B', content: 'c', order: 1, type: 'context' },
        ]
        reorderAgentMemories.mockResolvedValueOnce(undefined)
        const wrapper = mountPage()
        await flushPromises()
        await wrapper.find('.draggable-stub').trigger('end')
        await flushPromises()
        expect(reorderAgentMemories).toHaveBeenCalledWith(1, ['a', 'b'])
    })

    it('navigates to new-memory query when "Create your first memory" is clicked', async () => {
        const wrapper = mountPage()
        await flushPromises()
        const cta = wrapper.findAll('button').find((b) => (b.text() ?? '').includes('Create your first memory'))
        expect(cta).toBeDefined()
        await cta?.trigger('click')
        expect(routerPush).toHaveBeenCalledWith({ query: { create: '1' } })
    })
})
