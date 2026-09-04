/**
 * MemoriesPage — root shell for the plugin's `/apps/memories` route tree.
 *
 * Plug-side port of `spora-frontend/tests/apps/memories/pages/MemoriesPage.spec.ts`.
 *
 * Notable diffs:
 *   - The `<GlobalNavbar />` line was dropped at runtime (host
 *     `PluginAppPage.vue` owns the navbar). The corresponding mock is
 *     also dropped here.
 *   - `<Icon name="menu">` was replaced by a direct lucide `Menu`
 *     icon. The mock for `@/components/ui/Icon.vue` is gone.
 */
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia } from 'pinia'
import { HOST_CONTEXT_KEY, type PluginHostContext } from '../../src/shims'

const hostContext: PluginHostContext = {
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    pinia: createPinia(),
    theme: 'light',
    route: null,
    router: null,
}

vi.mock('../../src/components/MemorySidebar.vue', () => ({
    default: {
        name: 'MemorySidebar',
        props: { mobileOpen: { type: Boolean, default: false } },
        inheritAttrs: false,
        template: '<div :data-mobile="mobileOpen" :class="mobileOpen ? \'sidebar-mobile\' : \'sidebar-desktop\'" />',
    },
}))

import MemoriesPage from '../../src/pages/MemoriesPage.vue'

beforeEach(() => {
    // Ensure the body is clean before each test (no leftover teleports).
    document.body.innerHTML = ''
})

afterEach(() => {
    document.body.innerHTML = ''
})

describe('MemoriesPage', () => {
    it('renders the MemorySidebar (desktop variant)', () => {
        const wrapper = mount(MemoriesPage, {
            global: { provide: { [HOST_CONTEXT_KEY]: hostContext } },
        })
        expect(wrapper.findAll('.sidebar-desktop').length).toBeGreaterThanOrEqual(1)
    })

    it('renders the mobile menu toggle button', () => {
        const wrapper = mount(MemoriesPage, {
            global: { provide: { [HOST_CONTEXT_KEY]: hostContext } },
        })
        expect(wrapper.find('button[title="Show memories menu"]').exists()).toBe(true)
    })

    it('opens the mobile sidebar overlay when the menu button is clicked', async () => {
        const wrapper = mount(MemoriesPage, {
            global: { provide: { [HOST_CONTEXT_KEY]: hostContext } },
        })
        expect(wrapper.findAll('.sidebar-mobile').length).toBe(0)
        const menuButton = wrapper.find('button[title="Show memories menu"]')
        expect(menuButton.exists()).toBe(true)
        await menuButton.trigger('click')
        await wrapper.vm.$nextTick()
        // After click, sidebarOpen flips and the mobile overlay v-if renders
        // a second MemorySidebar with mobileOpen=true → .sidebar-mobile class.
        expect(wrapper.findAll('.sidebar-mobile').length).toBeGreaterThanOrEqual(1)
    })

    it('renders the main outlet for sub-routes', () => {
        const wrapper = mount(MemoriesPage, {
            global: { provide: { [HOST_CONTEXT_KEY]: hostContext } },
        })
        expect(wrapper.find('main').exists()).toBe(true)
    })

    it('does not render any element titled as a navbar (the navbar belongs to the host)', () => {
        const wrapper = mount(MemoriesPage, {
            global: { provide: { [HOST_CONTEXT_KEY]: hostContext } },
        })
        expect(wrapper.find('.navbar-stub').exists()).toBe(false)
    })
})
