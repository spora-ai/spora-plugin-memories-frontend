<script setup lang="ts">
/**
 * Principal chip row — sits between the sidebar header and the
 * global memories list.
 *
 * Renders one chip per principal the caller can see (their own
 * user-principal + every group-principal they're a member of).
 * No "ALL" / combined chip — the user's stated permission model is
 * "see one principal's memories at a time, not the union".
 *
 * Loading state: skeletons until the principals store resolves
 * `/principals/me`. Error state: a single chip showing the error
 * message.
 */
import { onMounted } from 'vue'
import { usePrincipalsStore } from '../stores/principals'

const principals = usePrincipalsStore()

onMounted(() => {
    if (principals.principals.length === 0) {
        principals.loadPrincipals()
    }
})

function chipClass(id: number): string {
    const active = principals.selectedPrincipalId === id
    return [
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
        active
            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
            : 'bg-background text-foreground border-border hover:border-primary hover:text-primary',
    ].join(' ')
}

function chipLabel(p: { name: string; type: string }): string {
    if (p.type === 'user') {
        return p.name.startsWith('User #') ? 'My Memories' : p.name
    }
    return p.name
}
</script>

<template>
    <div class="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Principal scope">
        <span class="text-xs text-muted-foreground uppercase tracking-wide">Scope</span>
        <div v-if="principals.loading && principals.principals.length === 0" class="flex items-center gap-2">
            <span
                v-for="i in 3"
                :key="i"
                class="inline-block h-7 w-24 rounded-full bg-muted animate-pulse"
                aria-hidden="true"
            />
        </div>
        <button
            v-for="p in principals.principals"
            :key="p.id"
            type="button"
            role="tab"
            :aria-selected="principals.selectedPrincipalId === p.id"
            :class="chipClass(p.id)"
            @click="principals.selectPrincipal(p.id)"
        >
            <svg
                v-if="p.type === 'user'"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
            <svg
                v-else
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {{ chipLabel(p) }}
        </button>
        <div
            v-if="principals.error"
            class="text-sm text-destructive"
            role="alert"
        >
            {{ principals.error }}
        </div>
    </div>
</template>