export interface ChannelUser {
  id: string
  name: string | null
  avatar: string | null
  isAgent?: boolean
  agentProvider?: string | null
}

export interface ChannelMessageMention {
  userId: string
  user: ChannelUser
}

export interface MessageReaction {
  emoji: string
  count: number
  users: { id: string; name: string | null }[]
}

export interface ChannelMessage {
  id: string
  channelId: string
  userId: string
  parentId: string | null
  content: string
  attachments: unknown[] | null
  createdAt: string
  updatedAt: string
  editedAt: string | null
  user: ChannelUser
  mentions?: ChannelMessageMention[]
  replyCount: number
  reactions?: MessageReaction[]
}

export interface ChannelMember {
  id: string
  userId: string
  role: string
  isExternal: boolean
  muted: boolean
  joinedAt: string
  user: ChannelUser & { email: string }
}

export interface Channel {
  id: string
  workspaceId: string
  parentId: string | null
  projectId: string | null
  name: string
  displayName: string
  description: string | null
  type: 'workspace' | 'project' | 'external'
  visibility: 'public' | 'private'
  inheritMembers: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
  memberCount?: number
  messageCount?: number
  unreadCount?: number
  hasUnread?: boolean
  parent?: { id: string; name: string; displayName: string } | null
  project?: { id: string; title: string } | null
  members?: ChannelMember[]
  messages?: ChannelMessage[]
  children?: { id: string; name: string; displayName: string; type: string }[]
  readState?: {
    lastSeenAt: string | null
    missedCount: number
    missedBoundaryMessageId: string | null
  }
}

export interface MessagesResponse {
  messages: ChannelMessage[]
  hasMore: boolean
  nextCursor: string | null
}

export function useChannels(workspaceId: MaybeRef<string | null>) {
  // Channel list (local ref - will refetch on mount)
  const channels = ref<Channel[]>([])
  
  // Per-channel state
  const currentChannel = ref<Channel | null>(null)
  const messages = ref<ChannelMessage[]>([])
  const loading = ref(false)
  const messagesLoading = ref(false)
  const hasMoreMessages = ref(false)
  const nextCursor = ref<string | null>(null)

  // Fetch all channels for a workspace
  const fetchChannels = async () => {
    const wsId = toValue(workspaceId)
    if (!wsId || loading.value) return

    loading.value = true
    try {
      const data = await $fetch<Channel[]>('/api/channels', {
        query: { workspaceId: wsId },
      })
      channels.value = data
    } catch (error) {
      console.error('Failed to fetch channels:', error)
    } finally {
      loading.value = false
    }
  }

  // Fetch a single channel with details
  const fetchChannel = async (id: string) => {
    loading.value = true
    try {
      const data = await $fetch<Channel>(`/api/channels/${id}`)
      currentChannel.value = data
      // Initialize messages from channel response
      if (data.messages) {
        messages.value = data.messages
        hasMoreMessages.value = data.messages.length >= 50
        nextCursor.value = data.messages.length > 0 ? data.messages[0].id : null
      }
      return data
    } catch (error) {
      console.error('Failed to fetch channel:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Fetch messages with pagination
  const fetchMessages = async (channelId: string, before?: string) => {
    messagesLoading.value = true
    try {
      const data = await $fetch<MessagesResponse>(`/api/channels/${channelId}/messages`, {
        query: { limit: 50, before },
      })
      return data
    } catch (error) {
      console.error('Failed to fetch messages:', error)
      throw error
    } finally {
      messagesLoading.value = false
    }
  }

  // Load more (older) messages
  const loadMoreMessages = async (channelId: string) => {
    if (!hasMoreMessages.value || messagesLoading.value) return

    const oldestMessage = messages.value[0]
    if (!oldestMessage) return

    const data = await fetchMessages(channelId, oldestMessage.id)
    
    // Prepend older messages
    messages.value = [...data.messages, ...messages.value]
    hasMoreMessages.value = data.hasMore
    nextCursor.value = data.nextCursor
  }

  // Send a new message
  const sendMessage = async (channelId: string, content: string, parentId?: string) => {
    try {
      const message = await $fetch<ChannelMessage>(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        body: { content, parentId },
      })
      
      // Add to messages if this is the current channel
      if (currentChannel.value?.id === channelId && !parentId) {
        messages.value = [...messages.value, message]
      }
      
      return message
    } catch (error) {
      console.error('Failed to send message:', error)
      throw error
    }
  }

  // Organize channels into tree structure (parent/child)
  const channelTree = computed(() => {
    const rootChannels: (Channel & { children: Channel[] })[] = []
    const childMap = new Map<string, Channel[]>()

    // First pass: group by parent
    for (const channel of channels.value) {
      if (channel.parentId) {
        const children = childMap.get(channel.parentId) || []
        children.push(channel)
        childMap.set(channel.parentId, children)
      }
    }

    // Second pass: build tree
    for (const channel of channels.value) {
      if (!channel.parentId) {
        rootChannels.push({
          ...channel,
          children: childMap.get(channel.id) || [],
        })
      }
    }

    return rootChannels
  })

  // Watch workspace changes and refetch
  watch(() => toValue(workspaceId), (wsId) => {
    if (wsId) {
      fetchChannels()
    }
  }, { immediate: true })

  return {
    channels,
    channelTree,
    currentChannel,
    messages,
    loading,
    messagesLoading,
    hasMoreMessages,
    fetchChannels,
    fetchChannel,
    fetchMessages,
    loadMoreMessages,
    sendMessage,
  }
}
