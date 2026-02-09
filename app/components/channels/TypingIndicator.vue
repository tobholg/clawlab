<script setup lang="ts">
import type { ChannelUser } from '~/composables/useChannels'

const props = defineProps<{
  users: ChannelUser[]
}>()

const typingText = computed(() => {
  const names = props.users.map(u => u.name || 'Someone')
  
  if (names.length === 0) return ''
  if (names.length === 1) return `${names[0]} is typing...`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`
  return `${names[0]}, ${names[1]}, and ${names.length - 2} more are typing...`
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-1"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-1"
  >
    <div v-if="users.length > 0" class="px-4 py-2 max-w-3xl mx-auto flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
      <!-- Animated dots -->
      <div class="flex items-center gap-0.5">
        <span class="w-1.5 h-1.5 bg-slate-400 dark:bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 0ms" />
        <span class="w-1.5 h-1.5 bg-slate-400 dark:bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 150ms" />
        <span class="w-1.5 h-1.5 bg-slate-400 dark:bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 300ms" />
      </div>
      <span>{{ typingText }}</span>
    </div>
  </Transition>
</template>

<style scoped>
@keyframes bounce {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-4px);
  }
}

.animate-bounce {
  animation: bounce 1s infinite;
}
</style>
