<script setup lang="ts">
import type { ChannelMessage } from '~/composables/useChannels'

const props = defineProps<{
  parentMessage: ChannelMessage
  channelId: string
  channelName: string
  members?: { id: string; name: string; isAgent: boolean; avatar?: string | null }[]
}>()

const emit = defineEmits<{
  close: []
  replySent: [parentId: string]
}>()

// Get current user
const { user: currentUser } = useAuth()

// Thread state
const replies = ref<ChannelMessage[]>([])
const loading = ref(true)

// Fetch thread replies
const fetchReplies = async () => {
  loading.value = true
  try {
    const data = await $fetch<{ parent: ChannelMessage; replies: ChannelMessage[] }>(
      `/api/messages/${props.parentMessage.id}/replies`
    )
    replies.value = data.replies
  } catch (error) {
    console.error('Failed to fetch thread:', error)
  } finally {
    loading.value = false
  }
}

// Send reply
const handleSendReply = async (content: string) => {
  try {
    const message = await $fetch<ChannelMessage>(`/api/channels/${props.channelId}/messages`, {
      method: 'POST',
      body: { content, parentId: props.parentMessage.id },
    })
    replies.value = [...replies.value, message]
    emit('replySent', props.parentMessage.id)
  } catch (error) {
    console.error('Failed to send reply:', error)
  }
}

// Fetch on mount
onMounted(fetchReplies)

// Refetch when parent changes
watch(() => props.parentMessage.id, fetchReplies)

// Scroll container
const scrollContainer = ref<HTMLElement | null>(null)

// Scroll to bottom when new replies
watch(() => replies.value.length, () => {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
    }
  })
})

// Group consecutive messages from same author (within 5 min)
const shouldShowAuthor = (reply: ChannelMessage, index: number): boolean => {
  if (index === 0) return true
  
  const prevReply = replies.value[index - 1]
  if (prevReply.userId !== reply.userId) return true
  
  const prevTime = new Date(prevReply.createdAt).getTime()
  const currTime = new Date(reply.createdAt).getTime()
  const diffMinutes = (currTime - prevTime) / 1000 / 60
  
  return diffMinutes >= 5
}
</script>

<template>
  <div class="flex flex-col h-full bg-white dark:bg-dm-surface border-l border-slate-200 dark:border-white/[0.06] w-full">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/[0.06]">
      <div>
        <h2 class="text-sm font-medium text-slate-900 dark:text-zinc-100">Thread</h2>
        <p class="text-xs text-slate-500 dark:text-zinc-400">#{{ channelName }}</p>
      </div>
      <button 
        class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] rounded-lg transition-colors flex items-center justify-center"
        @click="emit('close')"
      >
        <Icon name="heroicons:x-mark" class="w-5 h-5" />
      </button>
    </header>

    <!-- Thread content -->
    <div ref="scrollContainer" class="flex-1 overflow-y-auto">
      <!-- Parent message -->
      <div class="py-3 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.04]">
        <ChannelsMessageItem
          :message="parentMessage"
          :show-author="true"
          :is-thread="true"
          :current-user-id="currentUser?.id"
          :members="members"
        />
      </div>

      <!-- Replies section header -->
      <div class="px-4 py-2 border-b border-slate-200 dark:border-white/[0.06]">
        <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
          {{ replies.length }} {{ replies.length === 1 ? 'reply' : 'replies' }}
        </span>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center py-8">
        <Icon name="heroicons:arrow-path" class="w-5 h-5 text-slate-400 animate-spin" />
      </div>

      <!-- Replies -->
      <div v-else class="py-2">
        <ChannelsMessageItem
          v-for="(reply, index) in replies"
          :key="reply.id"
          :message="reply"
          :show-author="shouldShowAuthor(reply, index)"
          :is-thread="true"
          :current-user-id="currentUser?.id"
          :members="members"
        />
        
        <!-- Empty state -->
        <div 
          v-if="replies.length === 0" 
          class="px-4 py-8 text-center text-sm text-slate-400 dark:text-zinc-500"
        >
          No replies yet. Start the conversation!
        </div>
      </div>
    </div>

    <!-- Reply input -->
    <ChannelsMessageInput
      :channel-id="channelId"
      :parent-id="parentMessage.id"
      :members="members"
      placeholder="Reply to thread..."
      hide-helper
      @message-sent="handleSendReply"
    />
  </div>
</template>
