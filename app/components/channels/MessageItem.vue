<script setup lang="ts">
import type { ChannelMessage } from '~/composables/useChannels'

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

// Format timestamp
const formattedTime = computed(() => {
  const date = new Date(props.message.createdAt)
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
})

// User initials for avatar
const initials = computed(() => {
  const name = props.message.user?.name || 'U'
  return name.split(' ').map(n => n?.[0] || '').join('').toUpperCase().slice(0, 2) || 'U'
})

// Avatar background color (deterministic based on user id)
const avatarColor = computed(() => {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500', 
    'bg-violet-500',
    'bg-rose-500',
    'bg-amber-500',
    'bg-cyan-500',
    'bg-pink-500',
    'bg-indigo-500',
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
</script>

<template>
  <div 
    :class="[
      'group relative px-4 py-0.5',
      showAuthor ? 'pt-2' : '',
      'hover:bg-slate-50/50 transition-colors'
    ]"
    @mouseenter="showActions = true"
    @mouseleave="showActions = false"
  >
    <div :class="['flex gap-3', showAuthor ? 'items-start' : 'items-start']">
      <!-- Avatar (only if showing author) -->
      <div v-if="showAuthor" class="flex-shrink-0 w-9">
        <div 
          :class="[
            'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium',
            avatarColor
          ]"
        >
          {{ initials }}
        </div>
      </div>
      
      <!-- Spacer when no avatar (grouped messages) -->
      <div v-else class="flex-shrink-0 w-9">
        <!-- Timestamp on hover for grouped messages -->
        <span 
          class="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity leading-5 block text-right pr-1"
        >
          {{ formattedTime }}
        </span>
      </div>

      <!-- Message content -->
      <div class="flex-1 min-w-0">
        <!-- Author + timestamp + inline actions (only if showing author) -->
        <div v-if="showAuthor" class="flex items-center gap-2 mb-0.5">
          <span class="font-medium text-sm text-slate-900">
            {{ message.user?.name || 'Unknown User' }}
          </span>
          <span class="text-xs text-slate-400">
            {{ formattedTime }}
          </span>
          <span 
            v-if="message.editedAt" 
            class="text-xs text-slate-400"
            title="Edited"
          >
            (edited)
          </span>
          <!-- Inline actions (right of timestamp) -->
          <div 
            v-if="!isThread"
            :class="[
              'flex items-center gap-0.5 ml-1 transition-opacity duration-150',
              showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
            ]"
          >
            <button 
              class="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
              title="Reply in thread"
              @click="emit('reply', message)"
            >
              <Icon name="heroicons:chat-bubble-left" class="w-4 h-4" />
            </button>
            <div class="relative">
              <button 
                class="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                title="Add reaction"
                @click.stop="showEmojiPicker = !showEmojiPicker"
              >
                <Icon name="heroicons:face-smile" class="w-4 h-4" />
              </button>
              <!-- Emoji picker (with author) -->
              <div v-if="showEmojiPicker" class="absolute top-6 left-0 z-20">
                <ChannelsEmojiPicker 
                  @select="handleReaction" 
                  @close="showEmojiPicker = false" 
                />
              </div>
            </div>
            <button 
              class="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
              title="More options"
            >
              <Icon name="heroicons:ellipsis-horizontal" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Message text + inline actions for grouped messages -->
        <div class="flex items-start gap-2">
          <p class="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed flex-1">
            {{ message.content }}
          </p>
          <!-- Inline actions for grouped messages (no author row) -->
          <div 
            v-if="!showAuthor && !isThread"
            :class="[
              'flex items-center gap-0.5 flex-shrink-0 transition-opacity duration-150',
              showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
            ]"
          >
            <button 
              class="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
              title="Reply in thread"
              @click="emit('reply', message)"
            >
              <Icon name="heroicons:chat-bubble-left" class="w-4 h-4" />
            </button>
            <div class="relative">
              <button 
                class="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                title="Add reaction"
                @click.stop="showEmojiPicker = !showEmojiPicker"
              >
                <Icon name="heroicons:face-smile" class="w-4 h-4" />
              </button>
              <!-- Emoji picker (grouped) -->
              <div v-if="showEmojiPicker" class="absolute top-6 right-0 z-20">
                <ChannelsEmojiPicker 
                  @select="handleReaction" 
                  @close="showEmojiPicker = false" 
                />
              </div>
            </div>
            <button 
              class="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
              title="More options"
            >
              <Icon name="heroicons:ellipsis-horizontal" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Reactions display -->
        <ChannelsMessageReactions
          v-if="message.reactions && message.reactions.length > 0"
          :reactions="message.reactions"
          :current-user-id="currentUserId"
          @toggle="(emoji) => emit('react', message.id, emoji)"
        />

        <!-- Thread reply count -->
        <button 
          v-if="message.replyCount > 0 && !isThread"
          class="mt-1 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline"
          @click="emit('reply', message)"
        >
          <Icon name="heroicons:chat-bubble-left" class="w-3.5 h-3.5" />
          {{ message.replyCount }} {{ message.replyCount === 1 ? 'reply' : 'replies' }}
        </button>

      </div>
    </div>

  </div>
</template>
