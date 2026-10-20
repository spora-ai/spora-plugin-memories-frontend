/**
 * The German catalogue, rendered.
 *
 * `en.json` is an identity map, so the English assertions elsewhere in
 * the suite cannot tell a translated component from an untranslated
 * one. This spec mounts the components with a `de` instance and reads
 * what an operator would actually see — the catalogue, the wiring and
 * the component template are three separate things, and only the
 * rendered output proves all three line up.
 */
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import DocumentsPanel from '../src/components/DocumentsPanel.vue'
import MemoryEditor from '../src/components/MemoryEditor.vue'
import { createPluginI18n } from '../src/i18n'

const german = () => ({ global: { plugins: [createPluginI18n('de')] } })

describe('German catalogue', () => {
    it('renders the sidebar in German', () => {
        const wrapper = mount(DocumentsPanel, {
            ...german(),
            props: {
                documents: [],
                typeFilter: null,
                activeMemoryId: null,
                loading: false,
                mode: 'global',
            },
        })
        const text = wrapper.text()
        expect(text).toContain('Dokumente')
        expect(text).toContain('Alle')
        expect(text).toContain('Pläne')
        expect(text).toContain('Beispiele')
        expect(text).toContain('Kontext')
        expect(text).toContain('Noch keine Dokumente.')
        expect(text).toContain('Neues Dokument')
    })

    it('renders the type badge in German', () => {
        const wrapper = mount(DocumentsPanel, {
            ...german(),
            props: {
                documents: [
                    {
                        id: 'a',
                        principal_id: 1,
                        agent_id: null,
                        scope: 'global',
                        name: 'alpha',
                        summary: null,
                        content: null,
                        type: 'documentation',
                        order: 0,
                        created_at: '2026-01-01T00:00:00Z',
                        updated_at: '2026-01-01T00:00:00Z',
                    },
                ],
                typeFilter: null,
                activeMemoryId: null,
                loading: false,
                mode: 'global',
            },
        })
        expect(wrapper.text()).toContain('Dok.')
    })

    it('renders the editor in German', () => {
        const wrapper = mount(MemoryEditor, { ...german(), props: {} })
        const text = wrapper.text()
        expect(text).toContain('Neue Erinnerung')
        expect(text).toContain('Bezeichnung')
        expect(text).toContain('Typ')
        expect(text).toContain('Kurzbeschreibung')
        expect(text).toContain('Inhalt')
        expect(text).toContain('Erinnerung erstellen')
        expect(text).toContain('Abbrechen')
        expect(wrapper.find('input[placeholder]').attributes('placeholder')).toContain('z. B.')
    })

    it('falls back to the English source for a locale it has no catalogue for', () => {
        const wrapper = mount(DocumentsPanel, {
            global: { plugins: [createPluginI18n('fr')] },
            props: {
                documents: [],
                typeFilter: null,
                activeMemoryId: null,
                loading: false,
                mode: 'global',
            },
        })
        expect(wrapper.text()).toContain('Documents')
    })
})
