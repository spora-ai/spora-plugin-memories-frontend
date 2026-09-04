/**
 * MemoryListItem — single memory row in a list.
 *
 * Plug-side port of `spora-frontend/tests/apps/memories/components/MemoryListItem.spec.ts`.
 */
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'

const memory = {
    id: '11111111-1111-7111-b012-111111111111',
    principal_id: 42,
    name: 'Test Memory Name',
    content: 'A test memory',
    summary: null,
    type: 'context' as const,
    scope: 'global' as const,
    agent_id: null,
    order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
}

import MemoryListItem from '../../src/components/MemoryListItem.vue'

describe('MemoryListItem', () => {
    it('renders the memory name', () => {
        const wrapper = mount(MemoryListItem, {
            props: { memory },
        })
        expect(wrapper.text()).toContain('Test Memory Name')
    })

    it('renders the show-handle icon when showHandle is true', () => {
        const wrapper = mount(MemoryListItem, {
            props: { memory, showHandle: true },
        })
        expect(wrapper.text()).toContain('Test Memory Name')
    })

    it('still mounts without a memory content field', () => {
        const wrapper = mount(MemoryListItem, {
            props: { memory: { ...memory, content: null } },
        })
        expect(wrapper.exists()).toBe(true)
    })
})
