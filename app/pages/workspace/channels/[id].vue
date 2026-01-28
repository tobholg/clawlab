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

// Fetch all channels for sidebar
const { data: allProjects } = useFetch('/api/items', {
  query: { workspaceId: 'default' },
  default: () => []
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

// Sidebar state
const sidebarCollapsed = ref(false)

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
    
    <!-- Sidebar (shared with workspace) -->
    <aside 
      :class="[
        'border-r border-slate-100 bg-white flex flex-col py-5 transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-56'
      ]"
    >
      <!-- Logo + Toggle -->
      <div :class="['mb-8 flex items-center', sidebarCollapsed ? 'flex-col gap-3' : 'px-5 justify-between']">
        <NuxtLink to="/workspace" :class="['flex items-center gap-2.5', sidebarCollapsed ? 'justify-center w-full' : '']">
          <div class="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <span class="text-white text-sm font-medium">R</span>
          </div>
          <span 
            :class="[
              'text-base font-medium tracking-tight transition-all duration-300 overflow-hidden whitespace-nowrap',
              sidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
            ]"
          >
            Relai
          </span>
        </NuxtLink>
        <button 
          @click="sidebarCollapsed = !sidebarCollapsed"
          class="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center"
        >
          <Icon :name="sidebarCollapsed ? 'heroicons:chevron-right' : 'heroicons:chevron-left'" class="w-4 h-4" />
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 overflow-y-auto">
        <div class="space-y-0.5">
          <!-- Projects link -->
          <NuxtLink
            to="/workspace"
            :class="[
              'w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200',
              'text-slate-500 hover:text-slate-700 hover:bg-slate-50',
              sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'
            ]"
          >
            <Icon name="heroicons:folder" class="w-4 h-4 flex-shrink-0" />
            <span :class="['transition-all duration-300 overflow-hidden whitespace-nowrap', sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100']">Projects</span>
          </NuxtLink>
        </div>
        
        <!-- Channels Section -->
        <div class="mt-6">
          <h3 
            :class="[
              'mb-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider transition-all duration-300 overflow-hidden whitespace-nowrap',
              sidebarCollapsed ? 'px-0 text-center opacity-0 h-0' : 'px-3 opacity-100 h-auto'
            ]"
          >
            Channels
          </h3>
          <div class="space-y-0.5">
            <template v-for="channel in channelTree" :key="channel.id">
              <!-- Parent channel -->
              <NuxtLink 
                :to="`/workspace/channels/${channel.id}`"
                :class="[
                  'w-full flex items-center rounded-lg text-sm font-normal transition-all duration-200',
                  channelId === channel.id
                    ? 'text-slate-900 bg-slate-100 font-medium'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50',
                  sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'
                ]"
                :title="sidebarCollapsed ? channel.displayName : undefined"
              >
                <Icon 
                  :name="channel.visibility === 'private' ? 'heroicons:lock-closed' : 'heroicons:hashtag'" 
                  class="w-4 h-4 flex-shrink-0" 
                />
                <span :class="['transition-all duration-300 overflow-hidden whitespace-nowrap truncate', sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100']">
                  {{ channel.displayName }}
                </span>
                <span 
                  v-if="channel.unreadCount && channel.unreadCount > 0 && !sidebarCollapsed"
                  class="ml-auto text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full"
                >
                  {{ channel.unreadCount }}
                </span>
              </NuxtLink>
              
              <!-- Child channels (nested) -->
              <div v-if="!sidebarCollapsed && channel.children?.length" class="ml-3 pl-3 border-l border-slate-200 space-y-0.5">
                <NuxtLink 
                  v-for="child in channel.children"
                  :key="child.id"
                  :to="`/workspace/channels/${child.id}`"
                  :class="[
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all duration-200',
                    channelId === child.id
                      ? 'text-slate-900 bg-slate-100 font-medium'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  ]"
                >
                  <Icon 
                    :name="child.visibility === 'private' ? 'heroicons:lock-closed' : 'heroicons:hashtag'" 
                    class="w-3 h-3 flex-shrink-0" 
                  />
                  <span class="truncate">{{ child.displayName }}</span>
                </NuxtLink>
              </div>
            </template>
            
            <!-- Empty state for channels -->
            <div v-if="channelTree.length === 0 && !loading" class="px-3 py-4 text-xs text-slate-400 text-center">
              No channels yet
            </div>
          </div>
        </div>
        
        <!-- Team Section -->
        <div class="mt-6">
          <h3 
            :class="[
              'mb-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider transition-all duration-300 overflow-hidden whitespace-nowrap',
              sidebarCollapsed ? 'px-0 text-center opacity-0 h-0' : 'px-3 opacity-100 h-auto'
            ]"
          >
            Team
          </h3>
          <div class="space-y-0.5">
            <button 
              :class="[
                'w-full flex items-center rounded-lg text-sm font-normal text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all duration-200',
                sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'
              ]"
            >
              <Icon name="heroicons:users" class="w-4 h-4 flex-shrink-0" />
              <span :class="['transition-all duration-300 overflow-hidden whitespace-nowrap', sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100']">Members</span>
            </button>
            <button 
              :class="[
                'w-full flex items-center rounded-lg text-sm font-normal text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all duration-200',
                sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'
              ]"
            >
              <Icon name="heroicons:cog-6-tooth" class="w-4 h-4 flex-shrink-0" />
              <span :class="['transition-all duration-300 overflow-hidden whitespace-nowrap', sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100']">Settings</span>
            </button>
          </div>
        </div>
      </nav>

      <!-- User -->
      <div class="px-3 mt-auto">
        <div 
          :class="[
            'flex items-center rounded-lg hover:bg-slate-50 cursor-pointer transition-all duration-200',
            sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'
          ]"
        >
          <div class="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
            <span class="text-xs font-medium text-slate-600">T</span>
          </div>
          <div :class="['flex-1 min-w-0 transition-all duration-300 overflow-hidden', sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100']">
            <div class="text-sm font-normal text-slate-800 truncate">Tobias</div>
          </div>
          <Icon 
            v-if="!sidebarCollapsed"
            name="heroicons:chevron-up-down" 
            class="w-4 h-4 text-slate-400 flex-shrink-0" 
          />
        </div>
      </div>
    </aside>

    <!-- Main Content - Channel View -->
    <main :class="['flex-1 flex min-w-0 min-h-0', activeThread ? 'flex-row' : 'flex-col']">
      <!-- Channel content -->
      <div :class="['flex flex-col relative min-h-0', activeThread ? 'flex-1 min-w-0' : 'flex-1']">
      
      <!-- Subtle vibrant gradient background (messages area only) -->
      <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div class="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-br from-violet-200/30 via-fuchsia-200/20 to-transparent rounded-full blur-3xl" />
        <div class="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-tr from-sky-200/30 via-cyan-200/20 to-transparent rounded-full blur-3xl" />
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-1/3 bg-gradient-to-r from-amber-200/10 via-rose-200/10 to-transparent rounded-full blur-3xl" />
      </div>
      
      <!-- Channel Header -->
      <header class="relative z-10 border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-white">
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
          <button class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
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
