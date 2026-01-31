<script setup lang="ts">
const props = defineProps<{
  channelId: string
  parentId?: string
  placeholder?: string
  disabled?: boolean
  hideHelper?: boolean
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
const TYPING_THROTTLE = 1000 // Send typing at most once per second

// Auto-resize textarea
const adjustHeight = () => {
  if (!textareaRef.value) return
  textareaRef.value.style.height = 'auto'
  textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px'
}

watch(content, (newVal) => {
  nextTick(adjustHeight)
  
  // Typing detection (throttled)
  if (newVal && newVal.length > 0) {
    const now = Date.now()
    
    // Emit typing if we haven't recently (throttled to prevent spam)
    if (now - lastTypingEmit.value > TYPING_THROTTLE) {
      lastTypingEmit.value = now
      emit('typing')
    }
    
    // Reset stop-typing timeout
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
    }
    typingTimeout.value = setTimeout(() => {
      lastTypingEmit.value = 0
      emit('stopTyping')
    }, 2000)
  } else {
    // Content cleared - stop typing immediately
    lastTypingEmit.value = 0
    emit('stopTyping')
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
      typingTimeout.value = null
    }
  }
})

// Handle keyboard shortcuts
const handleKeydown = (e: KeyboardEvent) => {
  // Send on Enter (without Shift)
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// Send the message
const sendMessage = async () => {
  const trimmed = content.value.trim()
  if (!trimmed || sending.value || props.disabled) return

  sending.value = true
  try {
    // Stop typing indicator
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

// Focus input
const focus = () => {
  textareaRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="border-t border-slate-200 bg-white px-4 py-3">
    <div class="max-w-3xl mx-auto flex items-center gap-2">
      <!-- Attachment button -->
      <button
        class="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center"
        title="Attach file (coming soon)"
        disabled
      >
        <Icon name="heroicons:paper-clip" class="w-5 h-5" />
      </button>

      <!-- Input area -->
      <div class="flex-1 relative flex items-center">
        <textarea
          ref="textareaRef"
          v-model="content"
          :placeholder="placeholder || 'Type a message...'"
          :disabled="disabled || sending"
          rows="1"
          class="w-full py-2 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          @keydown="handleKeydown"
        />
      </div>

      <!-- Send button -->
      <button
        :disabled="!content.trim() || sending || disabled"
        class="flex-shrink-0 p-2 text-slate-900 hover:text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
        title="Send message"
        @click="sendMessage"
      >
        <Icon
          :name="sending ? 'heroicons:arrow-path' : 'heroicons:paper-airplane'"
          :class="['w-5 h-5', sending ? 'animate-spin' : '']"
        />
      </button>
    </div>

    <!-- Helper text -->
    <p v-if="!hideHelper" class="mt-1.5 text-xs text-slate-400 max-w-3xl mx-auto px-12">
      Type <kbd class="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">@ai</kbd> to get AI assistance
    </p>
  </div>
</template>
