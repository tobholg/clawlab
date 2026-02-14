<script setup lang="ts">
import type { ChannelUser } from '~/composables/useChannels'

const props = defineProps<{
  users: ChannelUser[]
  maxDisplay?: number
}>()

const maxShow = computed(() => props.maxDisplay ?? 5)

const displayUsers = computed(() => props.users.slice(0, maxShow.value))
const remainingCount = computed(() => Math.max(0, props.users.length - maxShow.value))

// Hover tooltip
const tooltipUser = ref<ChannelUser | null>(null)
const tooltipPos = ref({ top: 0, left: 0 })

const onEnter = (user: ChannelUser, e: MouseEvent) => {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  tooltipPos.value = {
    top: rect.bottom + 8,
    left: rect.left + rect.width / 2,
  }
  tooltipUser.value = user
}

const onLeave = () => {
  tooltipUser.value = null
}
</script>

<template>
  <div v-if="users.length > 0" class="flex items-center gap-2.5">
    <!-- Text label -->
    <span class="text-xs text-slate-500 dark:text-zinc-400">
      {{ users.length }} online
    </span>

    <!-- Avatars stack -->
    <div class="flex -space-x-2">
      <div
        v-for="user in displayUsers"
        :key="user.id"
        class="w-8 h-8 rounded-full border-2 border-white dark:border-dm bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center relative cursor-default"
        @mouseenter="onEnter(user, $event)"
        @mouseleave="onLeave"
      >
        <span class="text-xs text-white font-medium">
          {{ (user.name || 'U')[0].toUpperCase() }}
        </span>
        <!-- Online dot — bottom left -->
        <span class="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white dark:border-dm rounded-full" />
      </div>

      <!-- Overflow count -->
      <div
        v-if="remainingCount > 0"
        class="w-8 h-8 rounded-full border-2 border-white dark:border-dm bg-slate-200 dark:bg-white/[0.08] flex items-center justify-center"
      >
        <span class="text-xs text-slate-600 dark:text-zinc-400 font-medium">+{{ remainingCount }}</span>
      </div>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="tooltipUser"
          class="fixed z-[100] pointer-events-none"
          :style="{ top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px`, transform: 'translateX(-50%)' }"
        >
          <div class="flex justify-center -mb-px">
            <div class="w-2 h-2 bg-white dark:bg-zinc-800 border-t border-l border-slate-200/80 dark:border-zinc-700 rotate-45 translate-y-1" />
          </div>
          <div class="px-2.5 py-1.5 bg-white dark:bg-zinc-800 rounded-lg shadow-lg shadow-black/10 dark:shadow-black/50 border border-slate-200/80 dark:border-zinc-700 whitespace-nowrap">
            <span class="text-xs font-medium text-slate-700 dark:text-zinc-200">{{ tooltipUser.name || 'Unknown' }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
