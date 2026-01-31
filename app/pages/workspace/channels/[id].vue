<script setup lang="ts">
definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const channelId = computed(() => route.params.id as string)

// Get workspace ID from the items composable (shared state)
const { workspaceId } = useItems()

// Channel state
const {
  currentChannel,
  messages,
  loading,
  messagesLoading,
  hasMoreMessages,
  fetchChannel,
  loadMoreMessages,
  sendMessage,
} = useChannels(workspaceId)

const AI_TRIGGER = /\B@ai\b/i
const extractAiPrompt = (content: string) => {
  const withoutTag = content.replace(/\B@ai\b/gi, ' ')
  const cleaned = withoutTag.replace(/\s+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : 'Respond to the conversation so far.'
}

const aiPending = ref(false)

watch(aiPending, () => {
  nextTick(() => messageListRef.value?.scrollToBottom())
})

// Fetch channel on mount/route change
watch(channelId, async (id) => {
  if (id) {
    await fetchChannel(id)
  }
}, { immediate: true })

// Handle sending message
const handleSendMessage = async (content: string) => {
  if (!channelId.value) return
  try {
    await sendMessage(channelId.value, content)
    nextTick(() => messageListRef.value?.scrollToBottom())
    if (AI_TRIGGER.test(content)) {
      const prompt = extractAiPrompt(content)
      aiPending.value = true
      try {
        await $fetch(`/api/channels/${channelId.value}/ai`, {
          method: 'POST',
          body: { prompt },
        })
      } finally {
        aiPending.value = false
      }
    }
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

// Handle load more
const handleLoadMore = async () => {
  if (!channelId.value) return
  await loadMoreMessages(channelId.value)
}

// Message list ref
const messageListRef = ref<{ scrollToBottom: (smooth?: boolean) => void } | null>(null)

// Thread state
const activeThread = ref<import('~/composables/useChannels').ChannelMessage | null>(null)

// Handle opening a thread
const handleOpenThread = (message: import('~/composables/useChannels').ChannelMessage) => {
  activeThread.value = message
}

// Handle closing thread
const handleCloseThread = () => {
  activeThread.value = null
}

// Handle reply sent - update reply count on parent message
const handleThreadReplySent = (parentId: string) => {
  const parentMessage = messages.value.find(m => m.id === parentId)
  if (parentMessage) {
    parentMessage.replyCount = (parentMessage.replyCount || 0) + 1
  }
  if (activeThread.value?.id === parentId) {
    activeThread.value.replyCount = (activeThread.value.replyCount || 0) + 1
  }
}

// Channel icon based on type/visibility
const channelIcon = computed(() => {
  if (!currentChannel.value) return 'heroicons:hashtag'
  if (currentChannel.value.visibility === 'private') return 'heroicons:lock-closed'
  if (currentChannel.value.type === 'external') return 'heroicons:globe-alt'
  return 'heroicons:hashtag'
})

// WebSocket setup
const {
  authenticate,
  subscribe,
  unsubscribe,
  sendTyping,
  sendStopTyping,
  getPresence,
  getTyping,
} = useWebSocket()

// Get current user from auth
const { user: currentUser } = useAuth()

// Authenticate WebSocket on mount
onMounted(() => {
  if (currentUser.value) {
    authenticate({
      id: currentUser.value.id,
      name: currentUser.value.name || 'Anonymous',
      avatar: currentUser.value.avatar,
    })
  }
})

// Subscribe to channel WebSocket when channel changes
watch([channelId, currentChannel], ([id, channel], [oldId]) => {
  // Unsubscribe from old channel
  if (oldId && oldId !== id) {
    unsubscribe(oldId)
  }

  // Subscribe to new channel
  if (id && channel) {
    subscribe(id, {
      channelName: channel.displayName,
      onMessage: (message) => {
        if (message.userId !== currentUser.value?.id && !message.parentId) {
          messages.value = [...messages.value, message]
          nextTick(() => messageListRef.value?.scrollToBottom())
        }
      },
      onReaction: (messageId, reactions) => {
        const message = messages.value.find(m => m.id === messageId)
        if (message) {
          message.reactions = reactions
        }
      },
    })
  }
}, { immediate: true })

// Cleanup on unmount
onUnmounted(() => {
  if (channelId.value) {
    unsubscribe(channelId.value)
  }
})

// Presence for current channel
const channelPresence = computed(() => getPresence(channelId.value))

// Typing for current channel (excluding self)
const channelTyping = computed(() => getTyping(channelId.value))

// Handle typing events from input
const handleTyping = () => {
  if (channelId.value) {
    sendTyping(channelId.value)
  }
}

const handleStopTyping = () => {
  if (channelId.value) {
    sendStopTyping(channelId.value)
  }
}

// Handle reactions
const handleReaction = async (messageId: string, emoji: string) => {
  try {
    await $fetch(`/api/messages/${messageId}/reactions`, {
      method: 'POST',
      body: { emoji },
    })
  } catch (error) {
    console.error('Failed to toggle reaction:', error)
  }
}
</script>

<template>
  <!-- Main Content - Channel View (uses full width since layout provides sidebar) -->
  <div :class="['flex-1 flex min-w-0 min-h-0', activeThread ? 'flex-row' : 'flex-col']">
    <!-- Channel content -->
    <div :class="['flex flex-col relative min-h-0', activeThread ? 'flex-1 min-w-0' : 'flex-1']">

      <!-- Channel Header -->
      <header class="relative z-10 border-b border-slate-200 px-6 py-3 flex items-center justify-between bg-white">
        <div class="flex items-center gap-2.5">
          <Icon :name="channelIcon" class="w-4 h-4 text-slate-400" />
          <div class="flex items-center gap-2">
            <h1 class="text-sm font-medium text-slate-900">
              {{ currentChannel?.displayName || 'Loading...' }}
            </h1>
            <span v-if="currentChannel?.description" class="text-sm text-slate-400">
              {{ currentChannel.description }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <!-- Online presence -->
          <ChannelsPresenceIndicator :users="channelPresence" />

          <!-- Settings -->
          <button class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center">
            <Icon name="heroicons:cog-6-tooth" class="w-5 h-5" />
          </button>
        </div>
      </header>

      <!-- Messages Area -->
      <ChannelsMessageList
        ref="messageListRef"
        :messages="messages"
        :loading="messagesLoading"
        :has-more="hasMoreMessages"
        :current-user-id="currentUser?.id"
        @load-more="handleLoadMore"
        @reply="handleOpenThread"
        @react="handleReaction"
      />

      <!-- Typing indicator -->
      <ChannelsTypingIndicator :users="channelTyping" />

      <!-- AI waiting state -->
      <ChannelsAiWaitingIndicator :pending="aiPending" />

      <!-- Message Input -->
      <div class="relative z-10">
        <ChannelsMessageInput
          v-if="currentChannel"
          :channel-id="currentChannel.id"
          :placeholder="`Message #${currentChannel.displayName}`"
          @message-sent="handleSendMessage"
          @typing="handleTyping"
          @stop-typing="handleStopTyping"
        />
      </div>
    </div>

    <!-- Thread Panel -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 translate-x-4"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 translate-x-4"
    >
      <div v-if="activeThread && currentChannel" class="w-96 2xl:w-[480px] flex-shrink-0">
        <ChannelsThreadPanel
          :parent-message="activeThread"
          :channel-id="currentChannel.id"
          :channel-name="currentChannel.displayName"
          @close="handleCloseThread"
          @reply-sent="handleThreadReplySent"
        />
      </div>
    </Transition>
  </div>
</template>
