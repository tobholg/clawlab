<script setup lang="ts">
import type { ChannelMessage } from '~/composables/useChannels'
import type { TaskProposal } from '~/types/ai'

const props = defineProps<{
  message: ChannelMessage
  showAuthor?: boolean
  isThread?: boolean
  currentUserId?: string
}>()

const emit = defineEmits<{
  reply: [message: ChannelMessage]
  react: [messageId: string, emoji: string]
}>()

// Check if this is the current user's message
const isOwnMessage = computed(() => props.message.userId === props.currentUserId)

// Format timestamp
const formattedTime = computed(() => {
  const date = new Date(props.message.createdAt)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
})

const isAiMessage = computed(() => {
  const name = props.message.user?.name?.trim().toLowerCase()
  return name === 'relai ai'
})

// Bubble background color - Telegram style
const bubbleColor = computed(() => {
  if (isOwnMessage.value) {
    // Green for own messages (like Telegram)
    return 'bg-emerald-100 text-slate-800'
  }
  // White for everyone else
  return 'bg-white text-slate-800 shadow-sm border border-slate-100'
})

// Username colors for other users (hash-based)
const usernameColor = computed(() => {
  if (isOwnMessage.value) {
    return 'text-emerald-600'
  }
  if (isAiMessage.value) {
    return 'text-violet-600'
  }
  const colors = [
    'text-blue-600',
    'text-rose-600',
    'text-amber-600',
    'text-cyan-600',
    'text-pink-600',
    'text-indigo-600',
    'text-teal-600',
    'text-orange-600',
  ]
  const id = props.message.userId || props.message.id || 'default'
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
})

// Show hover actions
const showActions = ref(false)

// Emoji picker state
const showEmojiPicker = ref(false)

const handleReaction = (emoji: string) => {
  emit('react', props.message.id, emoji)
  showEmojiPicker.value = false
}

const taskProposal = computed<TaskProposal | null>(() => {
  const attachments = Array.isArray(props.message.attachments) ? props.message.attachments : []
  const match = attachments.find((attachment: any) => attachment?.type === 'task_proposal' && attachment?.proposal)
  return (match?.proposal as TaskProposal) || null
})
</script>

<template>
  <div
    :class="[
      'group relative px-4 py-1',
      showAuthor ? 'pt-3' : '',
    ]"
    @mouseenter="showActions = true"
    @mouseleave="showActions = false"
  >
    <!-- Message container - aligned based on own/other -->
    <div :class="['flex flex-col', isOwnMessage ? 'items-end' : 'items-start']">
      <!-- Author row with actions -->
      <div
        v-if="showAuthor"
        :class="[
          'flex items-center gap-2 mb-1',
          isOwnMessage ? 'flex-row-reverse mr-3' : 'ml-3'
        ]"
      >
        <span :class="['text-xs font-medium', usernameColor]">
          {{ isOwnMessage ? 'You' : (message.user?.name || 'Unknown User') }}
        </span>

        <!-- Hover actions (next to username) -->
        <div
          v-if="!isThread"
          :class="[
            'flex items-center gap-0.5 transition-opacity duration-150',
            showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
          ]"
        >
          <button
            class="p-1 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            title="Reply in thread"
            @click="emit('reply', message)"
          >
            <Icon name="heroicons:chat-bubble-left" class="w-3.5 h-3.5" />
          </button>
          <div class="relative flex items-center">
            <button
              class="p-1 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              title="Add reaction"
              @click.stop="showEmojiPicker = !showEmojiPicker"
            >
              <Icon name="heroicons:face-smile" class="w-3.5 h-3.5" />
            </button>
            <div v-if="showEmojiPicker" :class="['absolute top-6 z-20', isOwnMessage ? 'right-0' : 'left-0']">
              <ChannelsEmojiPicker
                @select="handleReaction"
                @close="showEmojiPicker = false"
              />
            </div>
          </div>
          <button
            class="p-1 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            title="More options"
          >
            <Icon name="heroicons:ellipsis-horizontal" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Bubble -->
      <div class="max-w-[75%] min-w-0">
        <div
          :class="[
            'relative px-3.5 py-2 rounded-2xl',
            bubbleColor,
            isOwnMessage ? 'rounded-br-md' : 'rounded-bl-md',
          ]"
        >
          <!-- Message text -->
          <p class="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {{ message.content }}
          </p>

          <!-- Timestamp inside bubble -->
          <div :class="[
            'flex items-center gap-1 mt-1',
            isOwnMessage ? 'justify-end' : 'justify-start'
          ]">
            <span class="text-[10px] text-slate-400">
              {{ formattedTime }}
            </span>
            <span
              v-if="message.editedAt"
              class="text-[10px] text-slate-400"
            >
              · edited
            </span>
          </div>
        </div>

        <!-- Task proposal (outside bubble) -->
        <ChannelsMessageTaskProposal
          v-if="taskProposal && !isThread"
          :proposal="taskProposal"
          :channel-id="message.channelId"
          class="mt-2"
        />

        <!-- Reactions display -->
        <div :class="['mt-1', isOwnMessage ? 'flex justify-end' : '']">
          <ChannelsMessageReactions
            v-if="message.reactions && message.reactions.length > 0"
            :reactions="message.reactions"
            :current-user-id="currentUserId"
            @toggle="(emoji) => emit('react', message.id, emoji)"
          />
        </div>

        <!-- Thread reply count -->
        <button
          v-if="message.replyCount > 0 && !isThread"
          :class="[
            'mt-1 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline',
            isOwnMessage ? 'ml-auto' : ''
          ]"
          @click="emit('reply', message)"
        >
          <Icon name="heroicons:chat-bubble-left" class="w-3.5 h-3.5" />
          {{ message.replyCount }} {{ message.replyCount === 1 ? 'reply' : 'replies' }}
        </button>
      </div>
    </div>
  </div>
</template>
