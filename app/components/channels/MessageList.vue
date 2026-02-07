<script setup lang="ts">
import type { ChannelMessage } from '~/composables/useChannels'

const props = defineProps<{
  messages: ChannelMessage[]
  loading?: boolean
  hasMore?: boolean
  currentUserId?: string
  channelId?: string
  missedBoundaryMessageId?: string | null
}>()

const emit = defineEmits<{
  loadMore: []
  reply: [message: ChannelMessage]
  react: [messageId: string, emoji: string]
}>()

// Group messages by date and consecutive author
interface MessageGroup {
  type: 'date' | 'missed' | 'message'
  date?: string
  missedLabel?: string
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

    if (props.missedBoundaryMessageId && message.id === props.missedBoundaryMessageId) {
      groups.push({
        type: 'missed',
        missedLabel: 'New since your last visit',
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
const isNearBottom = ref(true)
const isAtTop = ref(false)
const showScrollButton = ref(false)
const animateEntries = ref(true)

// Handle scroll
const handleScroll = () => {
  if (!scrollContainer.value) return
  
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight
  
  // Check if near bottom (within 64px) - for auto-scroll on new messages
  isNearBottom.value = distanceFromBottom < 64
  
  // Show scroll button when scrolled up more than 256px
  showScrollButton.value = distanceFromBottom > 256
  
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
  if (smooth) {
    scrollContainer.value.scrollTo({
      top: scrollContainer.value.scrollHeight,
      behavior: 'smooth',
    })
    return
  }
  scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
}

const scrollToMessage = (messageId: string, smooth = true): boolean => {
  if (!scrollContainer.value || !messageId) return false
  const messageEls = scrollContainer.value.querySelectorAll<HTMLElement>('[data-message-id]')
  const target = Array.from(messageEls).find(el => el.dataset.messageId === messageId)
  if (!target) return false

  const top = Math.max(target.offsetTop - 14, 0)
  if (smooth) {
    scrollContainer.value.scrollTo({
      top,
      behavior: 'smooth',
    })
    return true
  }

  scrollContainer.value.scrollTop = top
  return true
}

const scrollToMissedDivider = (smooth = true): boolean => {
  if (!scrollContainer.value) return false
  const divider = scrollContainer.value.querySelector<HTMLElement>('[data-missed-divider="true"]')
  if (!divider) {
    if (props.missedBoundaryMessageId) {
      return scrollToMessage(props.missedBoundaryMessageId, smooth)
    }
    return false
  }

  const top = Math.max(divider.offsetTop - 8, 0)
  if (smooth) {
    scrollContainer.value.scrollTo({
      top,
      behavior: 'smooth',
    })
    return true
  }

  scrollContainer.value.scrollTop = top
  return true
}

// Auto-scroll when new messages arrive (if near bottom)
watch(() => props.messages.length, (newLen, oldLen) => {
  if (newLen <= oldLen || !isNearBottom.value) return
  nextTick(() => scrollToBottom(false))
})

// Channel switch: always snap to bottom and skip initial list-enter animations.
watch(() => props.channelId, (newId, oldId) => {
  if (!newId || newId === oldId) return
  animateEntries.value = false
  nextTick(() => scrollToBottom(false))
  if (import.meta.client) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        animateEntries.value = true
      })
    })
    return
  }
  animateEntries.value = true
}, { immediate: true })

// Initial scroll to bottom
onMounted(() => {
  nextTick(() => scrollToBottom())
})

// Expose scroll method
defineExpose({ scrollToBottom, scrollToMessage, scrollToMissedDivider })
</script>

<template>
  <div class="flex-1 min-h-0 relative">
    <div 
      ref="scrollContainer"
      class="absolute inset-0 overflow-y-auto"
      @scroll="handleScroll"
    >
    <!-- Load more indicator -->
    <div v-if="hasMore" class="py-4 text-center max-w-3xl mx-auto">
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

    <!-- Messages - centered container -->
    <div class="max-w-3xl mx-auto">
      <TransitionGroup
        :css="animateEntries"
        tag="div"
        class="py-4"
        enter-active-class="message-enter-active"
        enter-from-class="message-enter-from"
        enter-to-class="message-enter-to"
        move-class="message-move"
      >
        <template
          v-for="(group, index) in groupedMessages"
          :key="group.type === 'date' ? `date-${group.date}` : group.type === 'missed' ? `missed-${index}` : group.message?.id"
        >
          <!-- Date separator -->
          <div v-if="group.type === 'date'" class="flex items-center px-4 py-3">
            <div class="flex-1 h-px bg-slate-200" />
            <span class="px-4 text-xs font-medium text-slate-500">
              {{ group.date }}
            </span>
            <div class="flex-1 h-px bg-slate-200" />
          </div>

          <!-- Missed divider -->
          <div v-else-if="group.type === 'missed'" data-missed-divider="true" class="flex items-center px-4 py-3">
            <div class="flex-1 h-px bg-amber-200/80" />
            <span class="px-4 text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">
              {{ group.missedLabel }}
            </span>
            <div class="flex-1 h-px bg-amber-200/80" />
          </div>

          <!-- Message -->
          <div v-else-if="group.message" :data-message-id="group.message.id">
            <ChannelsMessageItem
              :message="group.message"
              :show-author="group.showAuthor"
              :current-user-id="currentUserId"
              @reply="(msg) => emit('reply', msg)"
              @react="(msgId, emoji) => emit('react', msgId, emoji)"
            />
          </div>
        </template>
      </TransitionGroup>
    </div>

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

    <!-- Scroll to bottom button -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-90 translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-90 translate-y-2"
    >
      <button
        v-if="showScrollButton"
        class="absolute bottom-4 right-4 w-10 h-10 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:shadow-xl transition-all"
        @click="scrollToBottom(true)"
      >
        <Icon name="heroicons:chevron-down" class="w-5 h-5" />
      </button>
    </Transition>
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
