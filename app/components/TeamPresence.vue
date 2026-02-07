<script setup lang="ts">
const props = defineProps<{
  workspaceId?: string | null
}>()

const { data: users, pending, refresh } = useFetch('/api/users', {
  query: computed(() => ({ workspaceId: props.workspaceId })),
  immediate: false,
})

watch(
  () => props.workspaceId,
  (id) => {
    if (id) refresh()
  },
  { immediate: true }
)

const visibleUsers = computed(() => (users.value ?? []).slice(0, 6))
const extraCount = computed(() => Math.max(0, (users.value?.length ?? 0) - visibleUsers.value.length))

const initialsFor = (name?: string | null, email?: string | null) => {
  const base = (name || email || '').trim()
  if (!base) return '?'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}
</script>

<template>
  <div v-if="workspaceId" class="px-3 mb-4">
    <div class="mb-2 flex items-center justify-between text-[10px] font-medium text-slate-500 uppercase tracking-wider">
      <span>Team</span>
      <span v-if="users?.length" class="text-[10px] text-slate-400">{{ users.length }}</span>
    </div>

    <div v-if="pending" class="text-xs text-slate-400 px-2 py-1">
      Loading…
    </div>

    <div v-else class="flex items-center gap-2 flex-wrap">
      <div
        v-for="user in visibleUsers"
        :key="user.id"
        class="relative"
        :title="user.name || user.email"
      >
        <img
          v-if="user.avatar"
          :src="user.avatar"
          :alt="user.name || user.email"
          class="w-7 h-7 rounded-full object-cover border border-slate-200"
        />
        <div
          v-else
          class="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-semibold border border-slate-200"
        >
          {{ initialsFor(user.name, user.email) }}
        </div>
        <span
          class="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
          :class="user.hasFocus ? 'bg-emerald-400' : 'bg-slate-300'"
        />
      </div>

      <div
        v-if="extraCount > 0"
        class="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-1"
      >
        +{{ extraCount }}
      </div>

      <div v-if="!users?.length" class="text-xs text-slate-400 italic px-2 py-1">
        No team members yet
      </div>
    </div>
  </div>
</template>
