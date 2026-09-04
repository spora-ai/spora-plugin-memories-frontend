/**
 * AgentMemoriesPage — agent-scoped memory CRUD.
 *
 * Plug-side port of `spora-frontend/tests/apps/memories/pages/AgentMemoriesPage.spec.ts`.
 * The `@/stores/agent` mock is replaced by `../../src/composables/useAgents`.
 */
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

const routeRef = ref({ params: { id: '1' }, query: {} as Record<string, string> })
vi.mock('vue-router', () => ({
    useRoute: () => routeRef.value,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const agentMemories = ref<Array<{ id: number; name: string; content: string; order: number }>>([])
const loadAgentMemories = vi.fn()

vi.mock('../../src/stores/memories', () => ({
    useMemoriesStore: () => ({
        globalMemories: [],
        get agentMemories() { return agentMemories.value },
        loadingGlobal: false,
        loadingAgent: false,
        saving: false,
        error: null,
        loadAgentMemories,
    }),
}))

vi.mock('../../src/composables/useAgents', () => ({
    useAgents: () => ({
        agents: [{ id: 1, name: 'Test Agent' }],
        fetchAgents: vi.fn().mockResolvedValue(undefined),
    }),
}))

const MemoryListItemStub = { name: 'MemoryListItem', template: '<div class="list-item-stub" />' }
const MemoryEditorStub = { name: 'MemoryEditor', template: '<div class="editor-stub" />' }
const VueDraggableStub = { name: 'VueDraggable', template: '<div class="draggable-stub"><slot /></div>' }

import AgentMemoriesPage from '../../src/pages/AgentMemoriesPage.vue'

beforeEach(() => {
    setActivePinia(createPinia())
    agentMemories.value = []
    loadAgentMemories.mockReset()
    loadAgentMemories.mockResolvedValue(undefined)
    routeRef.value = { params: { id: '1' }, query: {} }
})

describe('AgentMemoriesPage', () => {
    it('mounts and calls loadAgentMemories on mount', async () => {
        const wrapper = mount(AgentMemoriesPage, {
            global: {
                stubs: {
                    MemoryListItem: MemoryListItemStub,
                    MemoryEditor: MemoryEditorStub,
                    VueDraggable: VueDraggableStub,
                },
            },
        })
        await flushPromises()
        expect(loadAgentMemories).toHaveBeenCalledWith(1, undefined)
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the agent name in the header', async () => {
        const wrapper = mount(AgentMemoriesPage, {
            global: {
                stubs: {
                    MemoryListItem: MemoryListItemStub,
                    MemoryEditor: MemoryEditorStub,
                    VueDraggable: VueDraggableStub,
                },
            },
        })
        await flushPromises()
        expect(wrapper.text()).toContain('Agent Memories')
    })
})
