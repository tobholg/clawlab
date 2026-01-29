<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
}>()

const { teamFocus, loadTeamFocus, currentUserId, LANE_LABELS, LANE_ICONS, formatDuration } = useFocus()

// Load on mount and set up polling
onMounted(async () => {
  await loadTeamFocus(props.workspaceId)
})

// Poll every 30 seconds for presence updates
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

// Get activity color classes
const getActivityClasses = (member: typeof teamFocus.value[0]) => {
  if (member.task) return 'bg-amber-100 text-amber-600'
  if (member.lane) {
    if (member.lane.type === 'MEETING') return 'bg-purple-100 text-purple-600'
    if (member.lane.type === 'BREAK') return 'bg-sky-100 text-sky-600'
    return 'bg-gray-100 text-gray-500'
  }
  return 'bg-gray-50 text-gray-400'
}
</script>

<template>
  <div class="px-4 py-3 border-b border-gray-200">
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Team</span>
      <span class="text-xs text-gray-400">{{ otherMembers.filter(m => m.isFocused).length }} active</span>
    </div>

    <div class="space-y-1.5">
      <div
        v-for="member in otherMembers"
        :key="member.userId"
        class="flex items-center gap-2 py-1"
      >
        <!-- Avatar with status dot -->
        <div class="relative flex-shrink-0">
          <div 
            class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
            :class="member.avatar ? '' : 'bg-gray-200 text-gray-600'"
          >
            <img 
              v-if="member.avatar" 
              :src="member.avatar" 
              :alt="member.name"
              class="w-full h-full rounded-full object-cover"
            />
            <span v-else>{{ member.name.charAt(0) }}</span>
          </div>
          <!-- Online indicator -->
          <span 
            v-if="member.isFocused"
            class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
            :class="member.task ? 'bg-amber-400' : member.lane?.type === 'MEETING' ? 'bg-purple-400' : 'bg-green-400'"
          ></span>
        </div>

        <!-- Name and activity -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-sm text-gray-700 truncate">{{ member.name }}</span>
          </div>
          <div 
            v-if="member.activityLabel"
            class="text-xs text-gray-500 truncate"
          >
            {{ member.activityLabel }}
          </div>
          <div 
            v-else
            class="text-xs text-gray-400 italic"
          >
            No focus
          </div>
        </div>

        <!-- Activity icon badge -->
        <div 
          v-if="member.isFocused"
          class="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          :class="getActivityClasses(member)"
        >
          <Icon :name="getActivityIcon(member)" class="w-3 h-3" />
        </div>
      </div>

      <div v-if="!otherMembers.length" class="text-xs text-gray-400 py-2 text-center">
        No team members
      </div>
    </div>
  </div>
</template>
