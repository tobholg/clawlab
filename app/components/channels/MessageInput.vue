<script setup lang="ts">
const props = defineProps<{
  channelId: string
  parentId?: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  messageSent: [content: string]
}>()

const content = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const sending = ref(false)

// Auto-resize textarea
const adjustHeight = () => {
  if (!textareaRef.value) return
  textareaRef.value.style.height = 'auto'
  textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px'
}

watch(content, () => {
  nextTick(adjustHeight)
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
    <div class="flex items-end gap-2">
      <!-- Attachment button -->
      <button 
        class="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        title="Attach file (coming soon)"
        disabled
      >
        <Icon name="heroicons:paper-clip" class="w-5 h-5" />
      </button>

      <!-- Input area -->
      <div class="flex-1 relative">
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
        class="flex-shrink-0 p-1 text-slate-900 hover:text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
    <p class="mt-1.5 text-xs text-slate-400 px-12">
      Press <kbd class="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Enter</kbd> to send, 
      <kbd class="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Shift+Enter</kbd> for new line
    </p>
  </div>
</template>
