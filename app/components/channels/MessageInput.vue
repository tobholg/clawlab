<script setup lang="ts">
interface MentionMember {
  id: string
  name: string
  isAgent: boolean
  avatar?: string | null
}

const props = defineProps<{
  channelId: string
  parentId?: string
  placeholder?: string
  disabled?: boolean
  hideHelper?: boolean
  members?: MentionMember[]
}>()

const emit = defineEmits<{
  messageSent: [content: string]
  typing: []
  stopTyping: []
}>()

const content = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const sending = ref(false)
const typingTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const lastTypingEmit = ref(0)
const mentionQuery = ref('')
const mentionStart = ref<number | null>(null)
const mentionCursor = ref<number | null>(null)
const selectedMentionIndex = ref(0)

const TYPING_THROTTLE = 1000

const filteredMentions = computed(() => {
  if (mentionStart.value === null) return []

  const query = mentionQuery.value.trim().toLowerCase()
  const allMembers = props.members || []
  const matches = query.length === 0
    ? allMembers
    : allMembers.filter((member) => member.name.toLowerCase().includes(query))

  return matches
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(query)
      const bStarts = b.name.toLowerCase().startsWith(query)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return a.name.localeCompare(b.name)
    })
    .slice(0, 6)
})

const showMentions = computed(() => filteredMentions.value.length > 0 && mentionStart.value !== null)

const resetMentionState = () => {
  mentionQuery.value = ''
  mentionStart.value = null
  mentionCursor.value = null
  selectedMentionIndex.value = 0
}

const adjustHeight = () => {
  if (!textareaRef.value) return
  textareaRef.value.style.height = 'auto'
  textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px'
}

const updateMentionState = () => {
  if (!textareaRef.value) {
    resetMentionState()
    return
  }

  const cursor = textareaRef.value.selectionStart ?? content.value.length
  mentionCursor.value = cursor

  const beforeCursor = content.value.slice(0, cursor)
  const atIndex = beforeCursor.lastIndexOf('@')

  if (atIndex === -1) {
    resetMentionState()
    return
  }

  const prefixChar = atIndex > 0 ? beforeCursor[atIndex - 1] : ''
  if (prefixChar && !/\s/.test(prefixChar)) {
    resetMentionState()
    return
  }

  const candidate = beforeCursor.slice(atIndex)
  if (!/^@[a-zA-Z0-9_-]*$/.test(candidate)) {
    resetMentionState()
    return
  }

  mentionStart.value = atIndex
  mentionQuery.value = candidate.slice(1)
  if (selectedMentionIndex.value >= filteredMentions.value.length) {
    selectedMentionIndex.value = 0
  }
}

watch(content, (newVal) => {
  nextTick(adjustHeight)
  updateMentionState()

  if (newVal && newVal.length > 0) {
    const now = Date.now()
    if (now - lastTypingEmit.value > TYPING_THROTTLE) {
      lastTypingEmit.value = now
      emit('typing')
    }

    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
    }

    typingTimeout.value = setTimeout(() => {
      lastTypingEmit.value = 0
      emit('stopTyping')
    }, 2000)
  } else {
    lastTypingEmit.value = 0
    emit('stopTyping')
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
      typingTimeout.value = null
    }
    resetMentionState()
  }
})

const applyMention = (member: MentionMember) => {
  if (mentionStart.value === null || mentionCursor.value === null) return

  const token = `<@${member.id}> `
  const before = content.value.slice(0, mentionStart.value)
  const after = content.value.slice(mentionCursor.value)
  const nextValue = `${before}${token}${after}`
  const nextCursor = before.length + token.length

  content.value = nextValue

  nextTick(() => {
    if (!textareaRef.value) return
    textareaRef.value.focus()
    textareaRef.value.setSelectionRange(nextCursor, nextCursor)
    updateMentionState()
  })

  resetMentionState()
}

const moveMentionSelection = (direction: 1 | -1) => {
  if (!showMentions.value) return
  const count = filteredMentions.value.length
  if (!count) return
  selectedMentionIndex.value = (selectedMentionIndex.value + direction + count) % count
}

const handleKeydown = (e: KeyboardEvent) => {
  if (showMentions.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveMentionSelection(1)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveMentionSelection(-1)
      return
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      const member = filteredMentions.value[selectedMentionIndex.value]
      if (member) {
        e.preventDefault()
        applyMention(member)
        return
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      resetMentionState()
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

const sendMessage = async () => {
  const trimmed = content.value.trim()
  if (!trimmed || sending.value || props.disabled) return

  sending.value = true
  try {
    lastTypingEmit.value = 0
    emit('stopTyping')
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
      typingTimeout.value = null
    }

    emit('messageSent', trimmed)
    content.value = ''
    nextTick(adjustHeight)
  } finally {
    sending.value = false
  }
}

const focus = () => {
  textareaRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="border-t border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-surface px-4 py-3">
    <div class="max-w-3xl mx-auto flex items-center gap-2">
      <div class="flex-1 relative flex items-center">
        <Transition
          enter-active-class="transition-all duration-150 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-1"
        >
          <div
            v-if="showMentions"
            class="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/[0.08] dark:bg-dm-card"
          >
            <button
              v-for="(member, index) in filteredMentions"
              :key="member.id"
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
              :class="index === selectedMentionIndex ? 'bg-slate-100 dark:bg-white/[0.08]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.05]'"
              @mousedown.prevent
              @click="applyMention(member)"
            >
              <div class="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-medium text-slate-700 dark:bg-white/[0.08] dark:text-zinc-200">
                <img v-if="member.avatar" :src="member.avatar" :alt="member.name" class="h-full w-full object-cover" />
                <span v-else>{{ member.name.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-slate-800 dark:text-zinc-100">{{ member.name }}</p>
              </div>
              <span
                v-if="member.isAgent"
                class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
              >
                Agent
              </span>
            </button>
          </div>
        </Transition>

        <textarea
          ref="textareaRef"
          v-model="content"
          :placeholder="placeholder || 'Type a message...'"
          :disabled="disabled || sending"
          rows="1"
          class="w-full py-2 text-sm text-slate-900 dark:text-zinc-100 bg-transparent placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          @keydown="handleKeydown"
          @input="updateMentionState"
          @click="updateMentionState"
          @keyup="updateMentionState"
        />
      </div>

      <button
        :disabled="!content.trim() || sending || disabled"
        class="flex-shrink-0 p-2 text-slate-900 dark:text-zinc-100 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
        title="Send message"
        @click="sendMessage"
      >
        <Icon
          :name="sending ? 'heroicons:arrow-path' : 'heroicons:paper-airplane'"
          :class="['w-5 h-5', sending ? 'animate-spin' : '']"
        />
      </button>
    </div>

    <p v-if="!hideHelper" class="mt-1.5 text-xs text-slate-400 dark:text-zinc-500 max-w-3xl mx-auto">
      Type <kbd class="px-1 py-0.5 bg-slate-100 dark:bg-dm-card rounded text-[10px] font-mono">@ai</kbd> to get AI assistance
    </p>
  </div>
</template>
