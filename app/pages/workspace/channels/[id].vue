<script setup lang="ts">
definePageMeta({
  layout: false,
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
  channelTree,
} = useChannels(workspaceId)

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
  // Also update activeThread if it matches
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
  presence,
  typing,
} = useWebSocket()

// Get current user from auth (for now using a mock - integrate with actual auth later)
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
        // Only add to messages if not from current user (they already see their own)
        // and if it's a top-level message (not a thread reply)
        if (message.userId !== currentUser.value?.id && !message.parentId) {
          messages.value = [...messages.value, message]
          // Scroll to bottom
          nextTick(() => messageListRef.value?.scrollToBottom(true))
        }
      },
      onReaction: (messageId, reactions) => {
        // Update reactions on the message
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
  <div class="flex h-screen bg-[#FAFAFA] font-sans text-slate-900 overflow-hidden">
    
    <!-- Shared Sidebar -->
    <WorkspaceSidebar 
      :workspace-id="workspaceId" 
      :current-channel-id="channelId"
    />

    <!-- Main Content - Channel View -->
    <main :class="['flex-1 flex min-w-0 min-h-0', activeThread ? 'flex-row' : 'flex-col']">
      <!-- Channel content -->
      <div :class="['flex flex-col relative min-h-0', activeThread ? 'flex-1 min-w-0' : 'flex-1']">
      
      <!-- Channel Header -->
      <header class="relative z-10 border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-white">
        <div class="flex items-center gap-3">
          <Icon :name="channelIcon" class="w-5 h-5 text-slate-400" />
          <div>
            <h1 class="text-lg font-medium text-slate-900">
              {{ currentChannel?.displayName || 'Loading...' }}
            </h1>
            <p v-if="currentChannel?.description" class="text-sm text-slate-500">
              {{ currentChannel.description }}
            </p>
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
    </main>
  </div>
</template>
