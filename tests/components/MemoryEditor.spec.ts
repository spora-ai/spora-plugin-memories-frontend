/**
 * MemoryEditor — single memory create/edit form.
 *
 * Plug-side port of `spora-frontend/tests/apps/memories/components/MemoryEditor.spec.ts`.
 * All `@/...` paths rerouted to plugin-local imports (single-level
 * up to `../...`). The `md-editor-v3` library is stubbed in
 * `tests/setup.ts` so happy-dom doesn't try to load CodeMirror 6.
 *
 * Covers the v2 surface: type select, attach-media via the host's
 * `openMediaPicker`. The earlier `find` / `new_text` surgical-edit
 * disclosure has been removed as part of the Idea 1 redesign.
 */
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import MemoryEditor from '../../src/components/MemoryEditor.vue'
import type { PluginHostContext } from '../../src/shims'

const SAMPLE_UUID_A = '11111111-1111-7111-b012-111111111111'

const createMemory = (overrides = {}) => ({
    id: SAMPLE_UUID_A,
    principal_id: 1,
    agent_id: 3,
    scope: 'agent' as const,
    type: 'context' as const,
    name: 'Test Memory',
    summary: 'A test summary',
    content: 'Test content',
    order: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
})

function makeHostContext(openMediaPicker?: PluginHostContext['openMediaPicker']): PluginHostContext {
    return {
        api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
        pinia: null,
        theme: 'light',
        route: null,
        router: null,
        openMediaPicker,
    }
}

describe('MemoryEditor', () => {
    it('renders "New Memory" heading when no memory prop', () => {
        const wrapper = mount(MemoryEditor, { props: {} })
        expect(wrapper.find('h2').text()).toContain('New Memory')
    })

    it('renders "Edit Memory" heading when memory prop is set', () => {
        const wrapper = mount(MemoryEditor, {
            props: { memory: createMemory() },
        })
        expect(wrapper.find('h2').text()).toContain('Edit Memory')
    })

    it('does NOT render order input field', () => {
        const wrapper = mount(MemoryEditor, { props: {} })
        expect(wrapper.find('input[type="number"]').exists()).toBe(false)
    })

    it('renders "New Memory for {name}" when agentName prop is provided in create mode', () => {
        const wrapper = mount(MemoryEditor, {
            props: { agentName: 'My Agent' },
        })
        expect(wrapper.find('h2').text()).toContain('New Memory for My Agent')
    })

    it('renders "Edit Memory for {name}" when agentName prop is provided in edit mode', () => {
        const wrapper = mount(MemoryEditor, {
            props: { memory: createMemory(), agentName: 'My Agent' },
        })
        expect(wrapper.find('h2').text()).toContain('Edit Memory for My Agent')
    })

    it('emits save with correct data on submit (including type)', async () => {
        const wrapper = mount(MemoryEditor, {
            props: { onSave: (_data: unknown) => {} },
        })
        await wrapper.find('input[type="text"]').setValue('my_memory')
        await wrapper.find('form').trigger('submit')
        const saveEvents = (wrapper.emitted('save') as unknown[][])
        expect(saveEvents.length).toBe(1)
        expect(saveEvents[0]?.[0]).toMatchObject({ name: 'my_memory', type: 'context' })
    })

    it('does not include order in save payload', async () => {
        const wrapper = mount(MemoryEditor, {
            props: { onSave: (_data: unknown) => {} },
        })
        await wrapper.find('input[type="text"]').setValue('my_memory')
        await wrapper.find('form').trigger('submit')
        const saveEvents = (wrapper.emitted('save') as unknown[][])
        expect(saveEvents[0]?.[0]).not.toHaveProperty('order')
    })

    it('hydrates the type select from the memory prop in edit mode', () => {
        const wrapper = mount(MemoryEditor, {
            props: { memory: createMemory({ type: 'plan' }) },
        })
        const select = wrapper.find('select')
        expect((select.element as HTMLSelectElement).value).toBe('plan')
    })

    it('layouts the Name input wider than the Type select (3fr _ 1fr)', () => {
        const wrapper = mount(MemoryEditor, { props: {} })
        const grid = wrapper.find('div.grid.grid-cols-\\[3fr_1fr\\]')
        expect(grid.exists()).toBe(true)
        const children = grid.element.children
        expect(children.length).toBeGreaterThanOrEqual(2)
    })

    it('exposes submit + delete + cancel buttons in edit mode and emits each when clicked', async () => {
        const memory = createMemory()
        const onDelete = vi.fn()
        const onCancel = vi.fn()
        const wrapper = mount(MemoryEditor, {
            props: { memory, onDelete, onCancel },
        })
        await wrapper.find('button[type="submit"]').trigger('click')
        await wrapper.findAll('button').find((b) => b.text() === 'Delete')!.trigger('click')
        await wrapper.findAll('button').find((b) => b.text() === 'Cancel')!.trigger('click')
        expect(onDelete).toHaveBeenCalled()
        expect(onCancel).toHaveBeenCalled()
    })
})

describe('MemoryEditor — media picker integration', () => {
    it('opens the host picker and forwards the { mediaKind: image, multi: false } options', async () => {
        const openMediaPicker = vi.fn().mockResolvedValue([
            { id: 'a1', filename: 'a.png', media_type: 'image', mime_type: 'image/png', byte_size: 1, asset_url: '/api/v1/assets/a1.png', has_markdown: false },
        ])
        const wrapper = mount(MemoryEditor, {
            props: {
                memory: createMemory({ content: 'Existing body' }),
                hostContext: makeHostContext(openMediaPicker),
            },
        })
        const attachBtn = wrapper.findAll('button').find((b) => (b.text() ?? '').includes('Attach media'))
        expect(attachBtn).toBeDefined()
        await attachBtn!.trigger('click')
        await flushPromises()
        expect(openMediaPicker).toHaveBeenCalledWith({ mediaKind: 'image', multi: false })
        // The picker resolves but the editor only mutates its `content`
        // ref (the spec wires the openMediaPicker through the same path
        // the production editor uses); the assertion is that the
        // picker was called and no `save` was emitted as a side effect.
        expect(wrapper.emitted('save') ?? []).toHaveLength(0)
    })

    it('renders the attach-media button', () => {
        const wrapper = mount(MemoryEditor, { props: {} })
        const attachBtn = wrapper.findAll('button').find((b) => (b.text() ?? '').includes('Attach media'))
        expect(attachBtn).toBeDefined()
    })

    it('survives a missing openMediaPicker (older host) without throwing', async () => {
        const wrapper = mount(MemoryEditor, {
            props: {
                memory: createMemory(),
                hostContext: makeHostContext(undefined),
            },
        })
        const attachBtn = wrapper.findAll('button').find((b) => (b.text() ?? '').includes('Attach media'))
        expect(attachBtn).toBeDefined()
        await expect(attachBtn!.trigger('click')).resolves.not.toThrow()
    })
})
