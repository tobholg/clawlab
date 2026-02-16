<script setup lang="ts">
const { notifications, dismissNotification } = useWebSocket()

const router = useRouter()

const handleClick = (channelId: string, notificationId: string) => {
  dismissNotification(notificationId)
  router.push(`/workspace/channels/${channelId}`)
}

// Truncate text to ~2 lines
const truncate = (text: string, maxLength = 80) => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-8"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-8"
      >
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="pointer-events-auto w-80 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/[0.06] dark:bg-dm-card shadow-lg dark:shadow-black/50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl dark:hover:shadow-black/60"
          @click="handleClick(notification.channelId, notification.id)"
        >
          <div class="p-3 flex items-start gap-3">
            <!-- Avatar -->
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <span class="text-sm text-white font-medium">
                {{ notification.message.user?.name?.[0] || 'U' }}
              </span>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-medium text-slate-900 dark:text-zinc-100">
                  {{ notification.message.user?.name || 'Unknown' }}
                </span>
                <span v-if="notification.channelName" class="text-xs text-slate-400 dark:text-zinc-500">
                  in #{{ notification.channelName }}
                </span>
              </div>
              <p class="mt-0.5 line-clamp-2 text-sm text-slate-600 dark:text-zinc-300">
                {{ truncate(notification.message.content) }}
              </p>
            </div>

            <!-- Close button -->
            <button
              class="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md leading-none text-slate-400 dark:text-zinc-500 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-600 dark:hover:text-zinc-300"
              @click.stop="dismissNotification(notification.id)"
            >
              <Icon name="heroicons:x-mark" class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
