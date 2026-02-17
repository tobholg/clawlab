<script setup lang="ts">
import type { ChannelMessage } from '~/composables/useChannels'
import type { TaskProposal } from '~/types/ai'

interface MentionMember {
  id: string
  name: string
  isAgent: boolean
  avatar?: string | null
}

const props = defineProps<{
  message: ChannelMessage
  showAuthor?: boolean
  isThread?: boolean
  currentUserId?: string
  members?: MentionMember[]
}>()

const emit = defineEmits<{
  reply: [message: ChannelMessage]
  react: [messageId: string, emoji: string]
}>()

const isOwnMessage = computed(() => props.message.userId === props.currentUserId)

const formattedTime = computed(() => {
  const date = new Date(props.message.createdAt)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
})

const isAiMessage = computed(() => props.message.user?.isAgent === true)

const bubbleColor = computed(() => {
  if (isOwnMessage.value) {
    return 'bg-[linear-gradient(90deg,rgba(167,243,208,0.75)_0%,rgba(209,250,229,0.55)_50%,rgba(220,252,237,0.35)_100%)] dark:bg-[linear-gradient(90deg,rgba(6,78,59,0.5)_0%,rgba(6,78,59,0.3)_50%,rgba(6,78,59,0.15)_100%)] text-slate-800 dark:text-zinc-200 border border-emerald-200/60 dark:border-emerald-800/40 shadow-sm'
  }
  return 'bg-white dark:bg-white/[0.06] text-slate-800 dark:text-zinc-200 shadow-sm border border-slate-100 dark:border-white/[0.08]'
})

const usernameColor = computed(() => {
  if (isOwnMessage.value) {
    return 'text-emerald-600 dark:text-emerald-400'
  }
  if (isAiMessage.value) {
    return 'text-violet-600 dark:text-violet-400'
  }
  const colors = [
    'text-blue-600 dark:text-blue-400',
    'text-rose-600 dark:text-rose-400',
    'text-amber-600 dark:text-amber-400',
    'text-cyan-600 dark:text-cyan-400',
    'text-pink-600 dark:text-pink-400',
    'text-indigo-600 dark:text-indigo-400',
    'text-teal-600 dark:text-teal-400',
    'text-orange-600 dark:text-orange-400',
  ]
  const id = props.message.userId || props.message.id || 'default'
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
})

const showActions = ref(false)
const showEmojiPicker = ref(false)

const handleReaction = (emoji: string) => {
  emit('react', props.message.id, emoji)
  showEmojiPicker.value = false
}

const taskProposal = computed<TaskProposal | null>(() => {
  const embeds = Array.isArray(props.message.embeds) ? props.message.embeds : []
  const match = embeds.find((entry: any) => entry?.type === 'task_proposal' && entry?.proposal)
  return (match?.proposal as TaskProposal) || null
})

const imageAttachments = computed(() => {
  return props.message.attachments.filter((attachment) => attachment.mimeType.startsWith('image/'))
})

const fileAttachments = computed(() => {
  return props.message.attachments.filter((attachment) => !attachment.mimeType.startsWith('image/'))
})

const attachmentUrl = (attachmentId: string) => `/api/files/${attachmentId}`

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const fileIcon = (mimeType: string) => {
  if (mimeType.includes('pdf')) return 'heroicons:document-text'
  if (mimeType.includes('zip') || mimeType.includes('tar')) return 'heroicons:archive-box'
  if (mimeType.includes('audio')) return 'heroicons:musical-note'
  if (mimeType.includes('video')) return 'heroicons:film'
  return 'heroicons:document'
}

const mentionMemberMap = computed(() => {
  const map = new Map<string, MentionMember>()

  for (const member of props.members || []) {
    map.set(member.id, member)
  }

  for (const mention of props.message.mentions || []) {
    if (!mention?.user?.id) continue
    map.set(mention.user.id, {
      id: mention.user.id,
      name: mention.user.name || 'unknown',
      isAgent: mention.user.isAgent === true,
      avatar: mention.user.avatar,
    })
  }

  if (props.message.user?.id) {
    map.set(props.message.user.id, {
      id: props.message.user.id,
      name: props.message.user.name || 'unknown',
      isAgent: props.message.user.isAgent === true,
      avatar: props.message.user.avatar,
    })
  }

  return map
})

const markdownMentions = computed(() => Array.from(mentionMemberMap.value.values()))

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const mentionPill = (userId: string) => {
  const member = mentionMemberMap.value.get(userId)
  if (!member) {
    return '<span class="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/[0.08] px-1.5 py-0.5 text-xs font-medium text-slate-700 dark:text-zinc-300">@unknown</span>'
  }

  const colorClasses = member.isAgent
    ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
    : 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400'

  return `<span class="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${colorClasses}">@${escapeHtml(member.name)}</span>`
}

const renderedMessageContent = computed(() => {
  let html = escapeHtml(props.message.content || '')
  html = html.replace(/&lt;@([a-zA-Z0-9_-]+)&gt;/g, (_match, userId: string) => mentionPill(userId))
  return html.replace(/\n/g, '<br />')
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
    <div :class="['flex flex-col', isOwnMessage ? 'items-end' : 'items-start']">
      <div
        v-if="showAuthor"
        :class="[
          'flex items-center gap-2 mb-1',
          isOwnMessage ? 'flex-row-reverse mr-3' : 'ml-3',
        ]"
      >
        <span :class="['text-xs font-medium', usernameColor]">
          {{ isOwnMessage ? 'You' : (message.user?.name || 'Unknown User') }}
        </span>

        <div
          v-if="!isThread"
          :class="[
            'flex items-center gap-0.5 transition-opacity duration-150',
            showActions ? 'opacity-100' : 'opacity-0 pointer-events-none',
          ]"
        >
          <button
            class="p-1 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] rounded transition-colors"
            title="Reply in thread"
            @click="emit('reply', message)"
          >
            <Icon name="heroicons:chat-bubble-left" class="w-3.5 h-3.5" />
          </button>
          <div class="relative flex items-center">
            <button
              class="p-1 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] rounded transition-colors"
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
            class="p-1 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] rounded transition-colors"
            title="More options"
          >
            <Icon name="heroicons:ellipsis-horizontal" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div class="max-w-[75%] min-w-[140px]">
        <div
          :class="[
            'relative px-3.5 py-2 rounded-2xl',
            bubbleColor,
            isOwnMessage ? 'rounded-br-md' : 'rounded-bl-md',
          ]"
        >
          <div v-if="isAiMessage" class="text-sm leading-relaxed max-w-none">
            <MarkdownRenderer
              v-if="message.content"
              :content="message.content"
              :mentions="markdownMentions"
              class="text-sm leading-relaxed text-slate-700 dark:text-zinc-200"
            />
          </div>
          <p
            v-else
            class="text-sm break-words leading-relaxed"
            v-html="renderedMessageContent"
          />

          <div :class="[
            'flex items-center gap-1 mt-1',
            isOwnMessage ? 'justify-end' : 'justify-start',
          ]">
            <span class="text-[10px] text-slate-400 dark:text-zinc-500">
              {{ formattedTime }}
            </span>
            <span
              v-if="message.editedAt"
              class="text-[10px] text-slate-400 dark:text-zinc-500"
            >
              · edited
            </span>
          </div>
        </div>

        <div
          v-if="imageAttachments.length > 0 || fileAttachments.length > 0"
          :class="['mt-2 space-y-2', isOwnMessage ? 'ml-auto' : '']"
        >
          <a
            v-if="imageAttachments.length === 1"
            :href="attachmentUrl(imageAttachments[0].id)"
            target="_blank"
            rel="noopener noreferrer"
            class="block max-w-sm"
          >
            <img
              :src="attachmentUrl(imageAttachments[0].id)"
              :alt="imageAttachments[0].name"
              class="w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-white/[0.04]"
            >
          </a>

          <div
            v-else-if="imageAttachments.length > 1"
            class="grid grid-cols-2 gap-2 max-w-sm"
          >
            <a
              v-for="attachment in imageAttachments"
              :key="attachment.id"
              :href="attachmentUrl(attachment.id)"
              target="_blank"
              rel="noopener noreferrer"
              class="block"
            >
              <img
                :src="attachmentUrl(attachment.id)"
                :alt="attachment.name"
                class="w-full h-28 object-cover rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-white/[0.04]"
              >
            </a>
          </div>

          <div v-if="fileAttachments.length > 0" class="space-y-1.5 max-w-sm">
            <article
              v-for="attachment in fileAttachments"
              :key="attachment.id"
              class="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-dm-card px-2.5 py-2"
            >
              <div class="flex items-center gap-2">
                <div class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-zinc-400">
                  <Icon :name="fileIcon(attachment.mimeType)" class="w-4 h-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-medium text-slate-700 dark:text-zinc-200 truncate">{{ attachment.name }}</p>
                  <p class="text-[11px] text-slate-400 dark:text-zinc-500">{{ formatBytes(attachment.sizeBytes) }}</p>
                </div>
                <a
                  :href="attachmentUrl(attachment.id)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors"
                >
                  <Icon name="heroicons:arrow-down-tray" class="w-3 h-3" />
                  Download
                </a>
              </div>
            </article>
          </div>
        </div>

        <ChannelsMessageTaskProposal
          v-if="taskProposal && !isThread"
          :proposal="taskProposal"
          :channel-id="message.channelId"
          class="mt-2"
        />

        <div :class="['mt-1', isOwnMessage ? 'flex justify-end' : '']">
          <ChannelsMessageReactions
            v-if="message.reactions && message.reactions.length > 0"
            :reactions="message.reactions"
            :current-user-id="currentUserId"
            @toggle="(emoji) => emit('react', message.id, emoji)"
          />
        </div>

        <button
          v-if="message.replyCount > 0 && !isThread"
          :class="[
            'mt-1 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline',
            isOwnMessage ? 'ml-auto' : '',
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
