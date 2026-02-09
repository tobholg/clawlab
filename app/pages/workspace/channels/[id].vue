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
const MISSED_PROMPT_THRESHOLD = 5
const SEEN_HEARTBEAT_MS = 10000

const parseTimestamp = (value?: string | null) => {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatTimestamp = (ms: number) => new Date(ms).toISOString()

const extractAiPrompt = (content: string) => {
  const withoutTag = content.replace(/\B@ai\b/gi, ' ')
  const cleaned = withoutTag.replace(/\s+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : 'Respond to the conversation so far.'
}

const aiPending = ref(false)
const pageVisible = ref(import.meta.client ? document.visibilityState === 'visible' : true)
const lastServerSeenAtMs = ref<number>(0)
const pendingSeenAtMs = ref<number | null>(null)
const seenFlushInFlight = ref(false)
const seenHeartbeat = ref<ReturnType<typeof setInterval> | null>(null)
const dismissedMissedPromptChannelId = ref<string | null>(null)

const missedCount = computed(() => currentChannel.value?.readState?.missedCount ?? 0)
const missedBoundaryMessageId = computed(() => currentChannel.value?.readState?.missedBoundaryMessageId ?? null)
const showMissedPrompt = computed(() => {
  if (!channelId.value || dismissedMissedPromptChannelId.value === channelId.value) return false
  if (!missedBoundaryMessageId.value) return false
  return missedCount.value > MISSED_PROMPT_THRESHOLD
})

const isTrackingSeenEligible = () => import.meta.client && pageVisible.value && !!channelId.value

const queueSeenAt = (timestamp: string | null | undefined) => {
  if (!isTrackingSeenEligible() || !timestamp) return
  const seenAtMs = parseTimestamp(timestamp)
  if (!seenAtMs) return
  if (seenAtMs <= lastServerSeenAtMs.value) return
  if (!pendingSeenAtMs.value || seenAtMs > pendingSeenAtMs.value) {
    pendingSeenAtMs.value = seenAtMs
  }
}

const flushSeen = async (force = false) => {
  if (!channelId.value || pendingSeenAtMs.value === null || seenFlushInFlight.value) return
  if (!force && !isTrackingSeenEligible()) return

  const seenAtMs = pendingSeenAtMs.value
  seenFlushInFlight.value = true
  try {
    const data = await $fetch<{ lastSeenAt: string }>(`/api/channels/${channelId.value}/seen`, {
      method: 'POST',
      body: { seenAt: formatTimestamp(seenAtMs) },
    })
    const persistedMs = parseTimestamp(data.lastSeenAt)
    if (persistedMs > lastServerSeenAtMs.value) {
      lastServerSeenAtMs.value = persistedMs
    }
    if (pendingSeenAtMs.value !== null && pendingSeenAtMs.value <= seenAtMs) {
      pendingSeenAtMs.value = null
    }
  } catch (error) {
    console.error('Failed to update channel seen state:', error)
  } finally {
    seenFlushInFlight.value = false
  }
}

const handleMissedPromptDismiss = () => {
  dismissedMissedPromptChannelId.value = channelId.value || null
}

const handleVisibilityChange = () => {
  if (!import.meta.client) return
  pageVisible.value = document.visibilityState === 'visible'
  if (!pageVisible.value) return
  const latestMessageAt = messages.value[messages.value.length - 1]?.createdAt
  queueSeenAt(latestMessageAt)
  void flushSeen()
}

watch(aiPending, () => {
  nextTick(() => messageListRef.value?.scrollToBottom())
})

// Fetch channel on mount/route change
watch(channelId, async (id) => {
  if (id) {
    await fetchChannel(id)
    lastServerSeenAtMs.value = parseTimestamp(currentChannel.value?.readState?.lastSeenAt)
    pendingSeenAtMs.value = null
    dismissedMissedPromptChannelId.value = null
    const latestMessageAt = messages.value[messages.value.length - 1]?.createdAt
    queueSeenAt(latestMessageAt)
    void flushSeen()
  }
}, { immediate: true })

// Handle sending message
const handleSendMessage = async (content: string) => {
  if (!channelId.value) return
  try {
    const sentMessage = await sendMessage(channelId.value, content)
    nextTick(() => messageListRef.value?.scrollToBottom())
    if (sentMessage?.createdAt) {
      queueSeenAt(sentMessage.createdAt)
      void flushSeen()
    }
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

// Message input ref for focus-on-type
const messageInputRef = ref<{ focus: () => void } | null>(null)

// Message list ref
const messageListRef = ref<{
  scrollToBottom: (smooth?: boolean) => void
  scrollToMessage: (messageId: string, smooth?: boolean) => boolean
  scrollToMissedDivider: (smooth?: boolean) => boolean
} | null>(null)

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

// Focus chat input when user starts typing anywhere on the page
const handleGlobalKeydown = (e: KeyboardEvent) => {
  // Skip if already in an input, textarea, or contenteditable
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return

  // Skip modifier-only keys, navigation, and function keys
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key.length !== 1) return

  messageInputRef.value?.focus()
}

// Authenticate WebSocket on mount
onMounted(() => {
  if (currentUser.value) {
    authenticate({
      id: currentUser.value.id,
      name: currentUser.value.name || 'Anonymous',
      avatar: currentUser.value.avatar,
    })
  }

  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  seenHeartbeat.value = setInterval(() => {
    const latestMessageAt = messages.value[messages.value.length - 1]?.createdAt
    queueSeenAt(latestMessageAt)
    void flushSeen()
  }, SEEN_HEARTBEAT_MS)
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
          queueSeenAt(message.createdAt)
          void flushSeen()
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
  const latestMessageAt = messages.value[messages.value.length - 1]?.createdAt
  queueSeenAt(latestMessageAt)
  if (seenHeartbeat.value) {
    clearInterval(seenHeartbeat.value)
    seenHeartbeat.value = null
  }
  if (import.meta.client) {
    document.removeEventListener('keydown', handleGlobalKeydown)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
  void flushSeen(true)
})

onBeforeRouteLeave(() => {
  const latestMessageAt = messages.value[messages.value.length - 1]?.createdAt
  queueSeenAt(latestMessageAt)
  void flushSeen(true)
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

const handleWhatDidIMiss = () => {
  const didScrollToDivider = messageListRef.value?.scrollToMissedDivider(true)
  if (!didScrollToDivider && missedBoundaryMessageId.value) {
    messageListRef.value?.scrollToMessage(missedBoundaryMessageId.value, true)
  }
  handleMissedPromptDismiss()
}
</script>

<template>
  <!-- Main Content - Channel View (uses full width since layout provides sidebar) -->
  <div :class="['flex-1 flex min-w-0 min-h-0', activeThread ? 'flex-row' : 'flex-col']">
    <!-- Channel content -->
    <div :class="['flex flex-col relative min-h-0', activeThread ? 'flex-1 min-w-0' : 'flex-1']">

      <!-- Channel Header -->
      <header class="relative z-10 border-b border-slate-200 dark:border-white/[0.06] px-6 py-3 flex items-center justify-between bg-white dark:bg-dm-surface">
        <div class="flex items-center gap-2.5">
          <Icon :name="channelIcon" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
          <div class="flex items-center gap-2">
            <h1 class="text-sm font-medium text-slate-900 dark:text-zinc-100">
              {{ currentChannel?.displayName || 'Loading...' }}
            </h1>
            <span v-if="currentChannel?.description" class="text-sm text-slate-400 dark:text-zinc-500">
              {{ currentChannel.description }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <!-- Online presence -->
          <ChannelsPresenceIndicator :users="channelPresence" />

          <!-- Settings -->
          <button class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] rounded-lg transition-colors flex items-center justify-center">
            <Icon name="heroicons:cog-6-tooth" class="w-5 h-5" />
          </button>
        </div>
      </header>

      <!-- Messages Area -->
      <ChannelsMessageList
        ref="messageListRef"
        :channel-id="channelId"
        :missed-boundary-message-id="missedBoundaryMessageId"
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
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-2"
        >
          <div
            v-if="showMissedPrompt"
            class="absolute left-0 right-0 -top-12 z-20 flex justify-center pointer-events-none"
          >
            <div class="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/[0.06] bg-white/95 dark:bg-dm-card/95 px-3 py-1.5 shadow-sm backdrop-blur">
              <button
                class="text-sm font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
                @click="handleWhatDidIMiss"
              >
                What did I miss?
              </button>
              <button
                class="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 leading-none hover:text-slate-600 hover:bg-slate-100 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] transition-colors"
                aria-label="Dismiss missed messages prompt"
                @click="handleMissedPromptDismiss"
              >
                <Icon name="heroicons:x-mark" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </Transition>
        <ChannelsMessageInput
          ref="messageInputRef"
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
