import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAgents, __resetAgentsForTesting } from '../../src/composables/useAgents'

const listAgentsMock = vi.fn()

vi.mock('../../src/api/agents', () => ({
    listAgents: (principalIds: number[] | null) => listAgentsMock(principalIds),
}))

beforeEach(() => {
    __resetAgentsForTesting()
    listAgentsMock.mockReset()
})

describe('useAgents', () => {
    it('returns the same agents ref on every useAgents() call', () => {
        const a = useAgents()
        const b = useAgents()
        expect(a.agents).toBe(b.agents)
    })

    it('calls listAgents with the resolved principal filter', async () => {
        listAgentsMock.mockResolvedValueOnce([{ id: 8, name: 'Triage Helper' }])
        const { fetchAgents, agents } = useAgents()
        await fetchAgents([99])
        expect(listAgentsMock).toHaveBeenCalledWith([99])
        expect(agents.value).toEqual([{ id: 8, name: 'Triage Helper' }])
    })

    it('passes null when no principal filter is supplied', async () => {
        listAgentsMock.mockResolvedValueOnce([])
        const { fetchAgents } = useAgents()
        await fetchAgents(null)
        expect(listAgentsMock).toHaveBeenCalledWith(null)
    })

    it('does not commit a stale response from a slow earlier call', async () => {
        let resolveSlow!: (value: Array<{ id: number; name: string }>) => void
        let resolveFast!: (value: Array<{ id: number; name: string }>) => void
        listAgentsMock
            .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r }))
            .mockImplementationOnce(() => new Promise((r) => { resolveFast = r }))

        const { fetchAgents, agents } = useAgents()
        const slowCall = fetchAgents([42])
        const fastCall = fetchAgents([99])

        resolveFast([{ id: 8, name: 'Triage Helper' }])
        await fastCall
        expect(agents.value).toEqual([{ id: 8, name: 'Triage Helper' }])

        resolveSlow([{ id: 7, name: 'Oncall Bot' }, { id: 9, name: 'Release Manager' }])
        await slowCall
        expect(agents.value).toEqual([{ id: 8, name: 'Triage Helper' }])
    })

    it('commits the latest result when concurrent calls resolve in reverse order', async () => {
        let resolveSlow!: (value: Array<{ id: number; name: string }>) => void
        let resolveFast!: (value: Array<{ id: number; name: string }>) => void
        listAgentsMock
            .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r }))
            .mockImplementationOnce(() => new Promise((r) => { resolveFast = r }))

        const { fetchAgents, agents } = useAgents()
        const slowCall = fetchAgents([42])
        const fastCall = fetchAgents([99])

        resolveFast([{ id: 8, name: 'Triage Helper' }])
        await fastCall
        resolveSlow([{ id: 7, name: 'Oncall Bot' }])
        await slowCall
        expect(agents.value).toEqual([{ id: 8, name: 'Triage Helper' }])
    })

    it('serial same-id calls each fetch (no de-dup across separate awaits)', async () => {
        listAgentsMock.mockResolvedValue([{ id: 7, name: 'Oncall Bot' }])
        const { fetchAgents } = useAgents()
        await fetchAgents([42])
        await fetchAgents([42])
        expect(listAgentsMock).toHaveBeenCalledTimes(2)
    })

    it('de-dupes concurrent identical-filter calls into one network round-trip', async () => {
        let resolve!: (value: Array<{ id: number; name: string }>) => void
        listAgentsMock.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
        const { fetchAgents, agents } = useAgents()
        const a = fetchAgents([42])
        const b = fetchAgents([42])
        const c = fetchAgents([42])
        expect(listAgentsMock).toHaveBeenCalledTimes(1)
        resolve([{ id: 7, name: 'Oncall Bot' }])
        await Promise.all([a, b, c])
        expect(agents.value).toEqual([{ id: 7, name: 'Oncall Bot' }])
    })

    it('keeps identical-filter de-dup isolated from different-filter requests', async () => {
        let resolve42!: (value: Array<{ id: number; name: string }>) => void
        let resolve99!: (value: Array<{ id: number; name: string }>) => void
        listAgentsMock
            .mockImplementationOnce(() => new Promise((r) => { resolve42 = r }))
            .mockImplementationOnce(() => new Promise((r) => { resolve99 = r }))
        const { fetchAgents, agents } = useAgents()
        const p42a = fetchAgents([42])
        const p42b = fetchAgents([42])
        const p99 = fetchAgents([99])
        expect(listAgentsMock).toHaveBeenCalledTimes(2)
        resolve99([{ id: 8, name: 'Triage Helper' }])
        await p99
        expect(agents.value).toEqual([{ id: 8, name: 'Triage Helper' }])
        resolve42([{ id: 7, name: 'Oncall Bot' }, { id: 9, name: 'Release Manager' }])
        await Promise.all([p42a, p42b])
        expect(agents.value).toEqual([{ id: 8, name: 'Triage Helper' }])
    })
})
