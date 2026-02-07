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
    // Soft green-to-white gradient for own messages
    return 'bg-gradient-to-r from-emerald-50 via-emerald-50 to-white text-slate-800 border border-emerald-100/60 shadow-sm'
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const renderInline = (value: string) => {
  let content = value
  // Inline code (`...`)
  content = content.replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-xs">$1</code>')
  // Bold (**...**)
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // Italic (*...*)
  content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // Links [text](url)
  content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-emerald-700 hover:underline">$1</a>')
  return content
}

// Simple markdown-like rendering for AI messages (basic)
const renderedAiContent = computed(() => {
  let content = props.message.content || ''
  content = content.replace(/\r\n/g, '\n')

  const codeBlocks: string[] = []
  content = content.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    const escaped = escapeHtml(code.trim())
    const html = `<pre class="bg-slate-100 rounded-lg p-2 my-2 overflow-x-auto text-xs"><code>${escaped}</code></pre>`
    const index = codeBlocks.length
    codeBlocks.push(html)
    return `__CODEBLOCK_${index}__`
  })

  content = escapeHtml(content)

  const lines = content.split('\n')
  const parts: string[] = []
  let listType: 'ul' | 'ol' | null = null
  const paragraphLines: string[] = []

  const flushParagraph = () => {
    if (!paragraphLines.length) return
    parts.push(`<p>${paragraphLines.join('<br>')}</p>`)
    paragraphLines.length = 0
  }

  const closeList = () => {
    if (!listType) return
    parts.push(listType === 'ul' ? '</ul>' : '</ol>')
    listType = null
  }

  const pushListItem = (type: 'ul' | 'ol', item: string) => {
    if (listType && listType !== type) {
      closeList()
    }
    if (!listType) {
      parts.push(type === 'ul' ? '<ul class="list-disc pl-5 my-2">' : '<ol class="list-decimal pl-5 my-2">')
      listType = type
    }
    parts.push(`<li>${renderInline(item)}</li>`)
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('__CODEBLOCK_') && trimmed.endsWith('__')) {
      flushParagraph()
      closeList()
      parts.push(trimmed)
      continue
    }

    if (!trimmed) {
      flushParagraph()
      closeList()
      parts.push('<div class="h-2"></div>')
      continue
    }

    const ulMatch = line.match(/^\s*-\s+(.*)$/)
    if (ulMatch) {
      flushParagraph()
      pushListItem('ul', ulMatch[1])
      continue
    }

    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/)
    if (olMatch) {
      flushParagraph()
      pushListItem('ol', olMatch[1])
      continue
    }

    closeList()
    paragraphLines.push(renderInline(line))
  }

  flushParagraph()
  closeList()

  let html = parts.join('')
  html = html.replace(/__CODEBLOCK_(\d+)__/g, (_, index) => codeBlocks[Number(index)] ?? '')
  return html
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
          <div v-if="isAiMessage" class="text-sm leading-relaxed prose prose-sm prose-slate max-w-none">
            <div v-if="message.content" v-html="renderedAiContent" />
          </div>
          <p v-else class="text-sm whitespace-pre-wrap break-words leading-relaxed">
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
