<script setup lang="ts">
import type { ChannelMessage } from '~/composables/useChannels'

const props = defineProps<{
  messages: ChannelMessage[]
  loading?: boolean
  hasMore?: boolean
}>()

const emit = defineEmits<{
  loadMore: []
  reply: [message: ChannelMessage]
}>()

// Group messages by date and consecutive author
interface MessageGroup {
  type: 'date' | 'message'
  date?: string
  message?: ChannelMessage
  showAuthor?: boolean
}

const groupedMessages = computed((): MessageGroup[] => {
  const groups: MessageGroup[] = []
  let currentDate: string | null = null
  let lastAuthorId: string | null = null
  let lastMessageTime: number | null = null

  for (const message of props.messages) {
    const messageDate = new Date(message.createdAt)
    const dateKey = messageDate.toDateString()
    
    // Add date separator if new day
    if (dateKey !== currentDate) {
      currentDate = dateKey
      lastAuthorId = null
      lastMessageTime = null
      
      groups.push({
        type: 'date',
        date: formatDateSeparator(messageDate),
      })
    }

    // Check if we should group with previous message (same author within 5 min)
    const messageTime = messageDate.getTime()
    const timeDiff = lastMessageTime ? (messageTime - lastMessageTime) / 1000 / 60 : Infinity
    const sameAuthor = lastAuthorId === message.userId
    const shouldGroup = sameAuthor && timeDiff < 5

    groups.push({
      type: 'message',
      message,
      showAuthor: !shouldGroup,
    })

    lastAuthorId = message.userId
    lastMessageTime = messageTime
  }

  return groups
})

// Format date for separator
function formatDateSeparator(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDay.getTime() === today.getTime()) {
    return 'Today'
  }
  if (messageDay.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  }
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

// Scroll container ref
const scrollContainer = ref<HTMLElement | null>(null)
const isAtBottom = ref(true)
const isAtTop = ref(false)

// Handle scroll
const handleScroll = () => {
  if (!scrollContainer.value) return
  
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value
  
  // Check if at bottom (with small threshold)
  isAtBottom.value = scrollHeight - scrollTop - clientHeight < 50
  
  // Check if at top (for loading more)
  isAtTop.value = scrollTop < 100
  
  // Load more when scrolling near top
  if (isAtTop.value && props.hasMore && !props.loading) {
    emit('loadMore')
  }
}

// Scroll to bottom
const scrollToBottom = (smooth = false) => {
  if (!scrollContainer.value) return
  scrollContainer.value.scrollTo({
    top: scrollContainer.value.scrollHeight,
    behavior: smooth ? 'smooth' : 'instant',
  })
}

// Auto-scroll when new messages arrive (if already at bottom)
watch(() => props.messages.length, (newLen, oldLen) => {
  if (newLen > oldLen && isAtBottom.value) {
    nextTick(() => scrollToBottom(true))
  }
})

// Initial scroll to bottom
onMounted(() => {
  nextTick(() => scrollToBottom())
})

// Expose scroll method
defineExpose({ scrollToBottom })
</script>

<template>
  <div 
    ref="scrollContainer"
    class="flex-1 overflow-y-auto"
    @scroll="handleScroll"
  >
    <!-- Load more indicator -->
    <div v-if="hasMore" class="py-4 text-center">
      <button 
        v-if="!loading"
        class="text-sm text-slate-500 hover:text-slate-700"
        @click="emit('loadMore')"
      >
        Load older messages
      </button>
      <div v-else class="flex items-center justify-center gap-2 text-sm text-slate-400">
        <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
        Loading...
      </div>
    </div>

    <!-- Messages -->
    <TransitionGroup 
      tag="div" 
      class="py-4"
      enter-active-class="message-enter-active"
      enter-from-class="message-enter-from"
      enter-to-class="message-enter-to"
      move-class="message-move"
    >
      <template v-for="group in groupedMessages" :key="group.type === 'date' ? group.date : group.message?.id">
        <!-- Date separator -->
        <div v-if="group.type === 'date'" class="flex items-center px-4 py-3">
          <div class="flex-1 h-px bg-slate-200" />
          <span class="px-4 text-xs font-medium text-slate-500">
            {{ group.date }}
          </span>
          <div class="flex-1 h-px bg-slate-200" />
        </div>

        <!-- Message -->
        <ChannelsMessageItem 
          v-else-if="group.message"
          :message="group.message"
          :show-author="group.showAuthor"
          @reply="(msg) => emit('reply', msg)"
        />
      </template>
    </TransitionGroup>

    <!-- Empty state -->
    <div 
      v-if="messages.length === 0 && !loading" 
      class="flex flex-col items-center justify-center h-full text-slate-400"
    >
      <Icon name="heroicons:chat-bubble-left-right" class="w-12 h-12 mb-3" />
      <p class="text-sm">No messages yet</p>
      <p class="text-xs mt-1">Be the first to say something!</p>
    </div>
  </div>
</template>

<style scoped>
.message-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.message-enter-from {
  opacity: 0;
  transform: translateY(12px);
  filter: blur(4px);
}

.message-enter-to {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

.message-move {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
