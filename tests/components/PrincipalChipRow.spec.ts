/**
 * PrincipalChipRow — one chip per principal, single-select.
 *
 * Mirrors the typst plugin's chip-row coverage; asserts one chip per
 * principal, click-to-select behaviour, and the `aria-selected`
 * toggling that downstream tests rely on.
 */
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

const principalsRef = ref<Array<{ id: number; type: string; name: string }>>([])
const selectedPrincipalId = ref<number | null>(null)
const loadingRef = ref(false)
const errorRef = ref<string | null>(null)
const loadPrincipalsMock = vi.fn()
const selectPrincipalMock = vi.fn()
const clearErrorMock = vi.fn()

vi.mock('../../src/stores/principals', () => ({
    usePrincipalsStore: () => ({
        get principals() { return principalsRef.value },
        get selectedPrincipalId() { return selectedPrincipalId.value },
        get loading() { return loadingRef.value },
        get error() { return errorRef.value },
        loadPrincipals: loadPrincipalsMock,
        selectPrincipal: selectPrincipalMock,
        clearError: clearErrorMock,
    }),
}))

import PrincipalChipRow from '../../src/components/PrincipalChipRow.vue'

beforeEach(() => {
    setActivePinia(createPinia())
    principalsRef.value = []
    selectedPrincipalId.value = null
    loadingRef.value = false
    errorRef.value = null
    loadPrincipalsMock.mockReset().mockResolvedValue(undefined)
    selectPrincipalMock.mockReset()
})

describe('PrincipalChipRow', () => {
    it('renders one chip per principal', async () => {
        principalsRef.value = [
            { id: 42, type: 'user', name: 'User #42' },
            { id: 7, type: 'group', name: 'Engineering' },
        ]
        const wrapper = mount(PrincipalChipRow)
        await flushPromises()
        const buttons = wrapper.findAll('button[role="tab"]')
        expect(buttons.length).toBe(2)
        expect(buttons[0]?.text()).toContain('My Memories')
        expect(buttons[1]?.text()).toContain('Engineering')
    })

    it('uses the display name for non-default user-principal labels', () => {
        principalsRef.value = [
            { id: 42, type: 'user', name: 'Alice' },
        ]
        const wrapper = mount(PrincipalChipRow)
        const buttons = wrapper.findAll('button[role="tab"]')
        expect(buttons[0]?.text()).toContain('Alice')
    })

    it('clicking a chip calls selectPrincipal with that id', async () => {
        principalsRef.value = [
            { id: 42, type: 'user', name: 'User #42' },
            { id: 7, type: 'group', name: 'Engineering' },
        ]
        const wrapper = mount(PrincipalChipRow)
        await flushPromises()
        const buttons = wrapper.findAll('button[role="tab"]')
        await buttons[1]?.trigger('click')
        expect(selectPrincipalMock).toHaveBeenCalledWith(7)
    })

    it('marks the selected chip with aria-selected=true', () => {
        principalsRef.value = [
            { id: 42, type: 'user', name: 'User #42' },
            { id: 7, type: 'group', name: 'Engineering' },
        ]
        selectedPrincipalId.value = 7
        const wrapper = mount(PrincipalChipRow)
        const buttons = wrapper.findAll('button[role="tab"]')
        expect(buttons[0]?.attributes('aria-selected')).toBe('false')
        expect(buttons[1]?.attributes('aria-selected')).toBe('true')
    })

    it('calls loadPrincipals on mount when the principals list is empty', async () => {
        principalsRef.value = []
        mount(PrincipalChipRow)
        await flushPromises()
        expect(loadPrincipalsMock).toHaveBeenCalled()
    })

    it('renders skeletons while loading with no principals yet', () => {
        principalsRef.value = []
        loadingRef.value = true
        const wrapper = mount(PrincipalChipRow)
        expect(wrapper.findAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
    })

    it('renders an error chip when the store carries an error', () => {
        errorRef.value = 'forbidden'
        const wrapper = mount(PrincipalChipRow)
        expect(wrapper.text()).toContain('forbidden')
        expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    })
})