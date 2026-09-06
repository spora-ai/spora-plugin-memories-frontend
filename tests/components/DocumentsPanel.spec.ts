/**
 * DocumentsPanel — sidebar with `All` / `Plans` / `Docs` / `Examples`
 * / `Context` filter chips, a draggable memory list, and a footer
 * "New document" button.
 */
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import DocumentsPanel from '../../src/components/DocumentsPanel.vue'
import type { MemoryResource, MemoryType } from '../../src/types'

const baseMemory: Omit<MemoryResource, 'type'> = {
    id: '11111111-1111-7111-b012-111111111111',
    principal_id: 1,
    agent_id: null,
    scope: 'global',
    name: 'tone_of_voice',
    summary: 'How the agent should sound',
    content: 'Be polite and concise.',
    order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
}

const mk = (overrides: Partial<MemoryResource> = {}): MemoryResource => ({
    ...baseMemory,
    type: 'context',
    ...overrides,
} as MemoryResource)

function mountPanel(props: Partial<InstanceType<typeof DocumentsPanel>['$props']> = {}) {
    return mount(DocumentsPanel, {
        props: {
            documents: props.documents ?? [],
            typeFilter: props.typeFilter ?? null,
            activeMemoryId: props.activeMemoryId ?? null,
            loading: props.loading ?? false,
            mode: props.mode ?? 'global',
        },
    })
}

describe('DocumentsPanel', () => {
    it('renders the Documents heading and the empty-state copy when there are no documents', () => {
        const wrapper = mountPanel()
        expect(wrapper.text()).toContain('Documents')
        expect(wrapper.text()).toContain('No documents yet.')
        expect(wrapper.find('[data-test="documents-empty"]').exists()).toBe(true)
    })

    it('shows "No documents match this type." when type filter excludes everything', () => {
        const wrapper = mountPanel({ documents: [], typeFilter: 'plan' })
        expect(wrapper.text()).toContain('No documents match this type.')
    })

    it('renders `All` plus one chip per memory type', () => {
        const wrapper = mountPanel()
        const chipTypes = wrapper
            .findAll('button[data-type]')
            .map((b) => b.attributes('data-type'))
        expect(chipTypes).toEqual(['all', 'plan', 'documentation', 'examples', 'context'])
    })

    it('marks `All` as the default selected chip (aria-pressed=true) and others as pressed=false', () => {
        const wrapper = mountPanel()
        const all = wrapper.find('[data-type="all"]')
        expect(all.attributes('aria-pressed')).toBe('true')
        for (const t of ['plan', 'documentation', 'examples', 'context'] as MemoryType[]) {
            expect(wrapper.find(`[data-type="${t}"]`).attributes('aria-pressed')).toBe('false')
        }
    })

    it('marks the active type chip as pressed and `All` as unpressed', () => {
        const wrapper = mountPanel({ typeFilter: 'plan' })
        expect(wrapper.find('[data-type="plan"]').attributes('aria-pressed')).toBe('true')
        expect(wrapper.find('[data-type="all"]').attributes('aria-pressed')).toBe('false')
    })

    it('emits select-type with the clicked type when a type chip is clicked', async () => {
        const wrapper = mountPanel()
        await wrapper.find('[data-type="documentation"]').trigger('click')
        expect(wrapper.emitted('select-type')).toEqual([['documentation']])
    })

    it('emits select-type with `null` when the active type chip is clicked again (toggle off)', async () => {
        const wrapper = mountPanel({ typeFilter: 'plan' })
        await wrapper.find('[data-type="plan"]').trigger('click')
        expect(wrapper.emitted('select-type')).toEqual([[null]])
    })

    it('emits select-type with `null` when `All` is clicked', async () => {
        const wrapper = mountPanel({ typeFilter: 'plan' })
        await wrapper.find('[data-type="all"]').trigger('click')
        expect(wrapper.emitted('select-type')).toEqual([[null]])
    })

    it('renders one row per memory and marks the active memory with the `data-memory-id` attribute', () => {
        const documents = [
            mk({ id: 'a', name: 'alpha' }),
            mk({ id: 'b', name: 'beta' }),
        ]
        const wrapper = mountPanel({ documents, activeMemoryId: 'b' })
        const rows = wrapper.findAll('[data-memory-id]')
        expect(rows.length).toBe(2)
        expect(rows[0]?.attributes('data-memory-id')).toBe('a')
        expect(rows[1]?.attributes('data-memory-id')).toBe('b')
        // The active row gets the highlighted border-primary class:
        expect(rows[1]?.classes().join(' ')).toContain('border-primary')
        expect(rows[0]?.classes().join(' ')).not.toContain('border-primary')
    })

    it('emits select-document with the id when a row is clicked', async () => {
        const documents = [mk({ id: 'a' }), mk({ id: 'b' })]
        const wrapper = mountPanel({ documents })
        await wrapper.find('[data-memory-id="b"]').trigger('click')
        expect(wrapper.emitted('select-document')).toEqual([['b']])
    })

    it('emits `new` when the "New document" footer button is clicked', async () => {
        const wrapper = mountPanel()
        await wrapper.find('[data-test="new-document"]').trigger('click')
        expect(wrapper.emitted('new')).toBeTruthy()
    })

    it('renders a type badge per memory row (Plan, Doc, Ex., Ctx)', () => {
        const documents = [
            mk({ id: 'a', name: 'a', type: 'plan' }),
            mk({ id: 'b', name: 'b', type: 'documentation' }),
            mk({ id: 'c', name: 'c', type: 'examples' }),
            mk({ id: 'd', name: 'd', type: 'context' }),
        ]
        const wrapper = mountPanel({ documents })
        const text = wrapper.text()
        expect(text).toContain('Plan')
        expect(text).toContain('Doc')
        expect(text).toContain('Ex.')
        expect(text).toContain('Ctx')
    })

    it('shows a loading placeholder while `loading` is true', () => {
        const wrapper = mountPanel({ loading: true })
        expect(wrapper.text()).toContain('Loading…')
    })

    it('exposes the active mode via `data-mode` on the panel root for layout scoping', () => {
        const wrapper = mountPanel({ mode: 'agent' })
        expect(wrapper.find('aside').attributes('data-mode')).toBe('agent')
    })
})
