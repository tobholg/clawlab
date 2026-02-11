<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
}>()

const { teamFocus, loadTeamFocus, currentUserId, LANE_LABELS, LANE_ICONS } = useFocus()

// Load on mount and poll
onMounted(async () => {
  await loadTeamFocus(props.workspaceId)
})

let pollInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  pollInterval = setInterval(() => {
    loadTeamFocus(props.workspaceId)
  }, 30000)
})
onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

// Filter out current user
const otherMembers = computed(() =>
  teamFocus.value.filter(m => m.userId !== currentUserId.value)
)

// Get activity icon
const getActivityIcon = (member: typeof teamFocus.value[0]) => {
  if (member.task) return 'heroicons:bolt'
  if (member.lane) return LANE_ICONS[member.lane.type]
  return 'heroicons:minus'
}
</script>

<template>
  <div class="px-3 mb-4">
    <!-- Section Title -->
    <h3 class="mb-2 text-[10px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-0 flex items-center justify-between">
      <span>Team</span>
      <span class="text-slate-300 dark:text-zinc-600">{{ otherMembers.filter(m => m.isFocused).length }}</span>
    </h3>

    <div class="space-y-0.5">
      <div
        v-for="member in otherMembers"
        :key="member.userId"
        class="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs"
        :class="member.isFocused ? 'text-slate-700 dark:text-zinc-300' : 'text-slate-400 dark:text-zinc-500'"
      >
        <!-- Avatar -->
        <div class="relative flex-shrink-0">
          <div
            class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium"
            :class="member.avatar ? '' : 'bg-slate-200 dark:bg-white/[0.08] text-slate-600 dark:text-zinc-400'"
          >
            <img
              v-if="member.avatar"
              :src="member.avatar"
              :alt="member.name"
              class="w-full h-full rounded-full object-cover"
            />
            <span v-else>{{ member.name.charAt(0) }}</span>
          </div>
          <!-- Online dot -->
          <span
            v-if="member.isFocused"
            class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-dm-surface bg-emerald-400"
          ></span>
        </div>

        <!-- Name -->
        <span class="flex-1 truncate">{{ member.name }}</span>

        <!-- Activity icon -->
        <div
          v-if="member.isFocused"
          class="w-4 h-4 flex items-center justify-center text-slate-400 dark:text-zinc-500 flex-shrink-0"
        >
          <Icon :name="getActivityIcon(member)" class="w-3.5 h-3.5" />
        </div>
      </div>

      <div v-if="!otherMembers.length" class="px-3 py-2 text-[10px] text-slate-400 dark:text-zinc-500 italic">
        No team members
      </div>
    </div>
  </div>
</template>
