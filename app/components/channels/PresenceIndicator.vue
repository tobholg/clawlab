<script setup lang="ts">
import type { ChannelUser } from '~/composables/useChannels'

const props = defineProps<{
  users: ChannelUser[]
  maxDisplay?: number
}>()

const maxShow = computed(() => props.maxDisplay ?? 4)

const displayUsers = computed(() => props.users.slice(0, maxShow.value))
const remainingCount = computed(() => Math.max(0, props.users.length - maxShow.value))

// Avatar background color (deterministic based on user id)
const getAvatarColor = (userId: string) => {
  const colors = [
    'from-blue-400 to-blue-500',
    'from-emerald-400 to-emerald-500',
    'from-violet-400 to-violet-500',
    'from-rose-400 to-rose-500',
    'from-amber-400 to-amber-500',
    'from-cyan-400 to-cyan-500',
    'from-pink-400 to-pink-500',
    'from-indigo-400 to-indigo-500',
  ]
  const hash = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}
</script>

<template>
  <div v-if="users.length > 0" class="flex items-center gap-2">
    <!-- Avatars stack -->
    <div class="flex -space-x-2">
      <div
        v-for="user in displayUsers"
        :key="user.id"
        class="w-7 h-7 rounded-full border-2 border-white dark:border-dm-surface bg-gradient-to-br flex items-center justify-center relative"
        :class="getAvatarColor(user.id)"
        :title="user.name || 'Unknown'"
      >
        <span class="text-[10px] text-white font-medium">
          {{ (user.name || 'U')[0].toUpperCase() }}
        </span>
        <!-- Online dot -->
        <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white dark:border-dm-surface rounded-full" />
      </div>
      
      <!-- Overflow count -->
      <div
        v-if="remainingCount > 0"
        class="w-7 h-7 rounded-full border-2 border-white dark:border-dm-surface bg-slate-200 dark:bg-white/[0.08] flex items-center justify-center"
      >
        <span class="text-[10px] text-slate-600 dark:text-zinc-300 font-medium">+{{ remainingCount }}</span>
      </div>
    </div>
    
    <!-- Text label -->
    <span class="text-xs text-slate-500 dark:text-zinc-400">
      {{ users.length }} online
    </span>
  </div>
</template>
