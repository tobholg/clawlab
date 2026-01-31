<template>
  <Transition name="bubble">
    <div
      v-if="isOpen"
      ref="bubbleRef"
      class="fixed z-40 w-[400px] h-[min(70vh,600px)] rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-2xl flex flex-col overflow-hidden"
      :style="bubbleStyle"
    >
      <!-- Header (drag handle) -->
      <div
        ref="headerRef"
        class="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/80 cursor-move select-none shrink-0"
        @mousedown="startDrag"
      >
        <div class="flex items-center gap-2">
          <Icon name="heroicons:chat-bubble-left-ellipsis" class="w-4 h-4 text-relai-500" />
          <span class="text-sm font-medium text-slate-700">Quick Chat</span>
        </div>
        <div class="flex items-center gap-1">
          <!-- Menu Button -->
          <div ref="menuRef" class="relative">
            <button
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
              title="Menu"
              @click.stop="menuOpen = !menuOpen"
            >
              <Icon name="heroicons:ellipsis-vertical" class="w-4 h-4 text-slate-500" />
            </button>

            <!-- Menu Dropdown -->
            <Transition name="menu">
              <div
                v-if="menuOpen"
                class="absolute right-0 top-full mt-1 w-40 rounded-xl bg-white border border-slate-200 shadow-lg py-1 z-10"
              >
                <button
                  class="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors"
                  :class="{ 'opacity-50 cursor-not-allowed': !hasMessages }"
                  :disabled="!hasMessages"
                  @click="handleClear"
                >
                  <Icon name="heroicons:trash" class="w-4 h-4 text-slate-400" />
                  <span>Clear Chat</span>
                </button>

                <div v-if="hasCustomPosition" class="border-t border-slate-100 mt-1 pt-1">
                  <button
                    class="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors"
                    @click="handleResetPosition"
                  >
                    <Icon name="heroicons:arrows-pointing-out" class="w-4 h-4 text-slate-400" />
                    <span>Reset Position</span>
                  </button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Close Button -->
          <button
            class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            title="Close"
            @click="close"
          >
            <Icon name="heroicons:x-mark" class="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <!-- Empty state -->
        <div v-if="!hasMessages && !sending" class="h-full flex items-center justify-center">
          <div class="text-center">
            <Icon name="heroicons:chat-bubble-left-right" class="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p class="text-sm text-slate-400">Start a quick conversation</p>
            <p class="text-xs text-slate-300 mt-1">Ask anything about your projects</p>
          </div>
        </div>

        <!-- Message list -->
        <QuickChatMessage
          v-for="message in messages"
          :key="message.id"
          :message="message"
        />
        
        <!-- Thinking indicator -->
        <div v-if="sending && messages.length > 0 && !messages[messages.length - 1]?.content" class="flex justify-start">
          <div class="px-3 py-2 rounded-2xl rounded-tl-sm bg-relai-50 text-slate-500 text-sm">
            <span class="inline-flex items-center gap-1">
              <span class="w-1.5 h-1.5 bg-relai-400 rounded-full animate-bounce" style="animation-delay: 0ms" />
              <span class="w-1.5 h-1.5 bg-relai-400 rounded-full animate-bounce" style="animation-delay: 150ms" />
              <span class="w-1.5 h-1.5 bg-relai-400 rounded-full animate-bounce" style="animation-delay: 300ms" />
            </span>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="flex items-center gap-2 px-4 py-3 shrink-0 border-t border-slate-100 bg-white">
        <textarea
          ref="inputRef"
          v-model="inputMessage"
          rows="1"
          placeholder="Ask anything..."
          :disabled="sending"
          class="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 resize-none max-h-32"
          @keydown.enter.exact.prevent="handleSend"
          @input="autoResize"
        />
        <button
          @click="handleSend"
          :disabled="!inputMessage.trim() || sending"
          class="w-8 h-8 rounded-full bg-relai-500 text-white flex items-center justify-center hover:bg-relai-600 transition-colors disabled:opacity-30 disabled:hover:bg-relai-500 shrink-0"
        >
          <Icon v-if="sending" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
          <Icon v-else name="heroicons:arrow-up" class="w-4 h-4" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useQuickChat } from '~/composables/useQuickChat'
import QuickChatMessage from './QuickChatMessage.vue'

const {
  isOpen,
  messages,
  sending,
  hasMessages,
  sendMessage,
  clear,
  close,
} = useQuickChat()

// Position state
const position = ref<{ x: number; y: number } | null>(null)
const bubbleRef = ref<HTMLElement | null>(null)
const headerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const inputMessage = ref('')
const menuOpen = ref(false)

// Computed
const hasCustomPosition = computed(() => position.value !== null)

const bubbleStyle = computed(() => {
  if (position.value) {
    return {
      left: `${position.value.x}px`,
      top: `${position.value.y}px`,
      right: 'auto',
      bottom: 'auto',
    }
  }
  // Default position: bottom-right, above the orb
  return {
    right: '24px',
    bottom: '96px',
  }
})

// Auto-resize textarea
const autoResize = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement
  textarea.style.height = ''
  textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px'
}

// Drag handling
let isDragging = false
let dragOffset = { x: 0, y: 0 }

const startDrag = (e: MouseEvent) => {
  if (!bubbleRef.value) return
  isDragging = true
  const rect = bubbleRef.value.getBoundingClientRect()
  dragOffset = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (e: MouseEvent) => {
  if (!isDragging || !bubbleRef.value) return

  const bubbleRect = bubbleRef.value.getBoundingClientRect()

  let newX = e.clientX - dragOffset.x
  let newY = e.clientY - dragOffset.y

  // Constrain to viewport bounds
  const maxX = window.innerWidth - bubbleRect.width
  const maxY = window.innerHeight - bubbleRect.height
  newX = Math.max(0, Math.min(newX, maxX))
  newY = Math.max(0, Math.min(newY, maxY))

  position.value = { x: newX, y: newY }
}

const stopDrag = () => {
  isDragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// Close menu when clicking outside
const handleClickOutside = (e: MouseEvent) => {
  if (menuOpen.value && menuRef.value && !menuRef.value.contains(e.target as Node)) {
    menuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})

// Focus input when opened
watch(isOpen, (open) => {
  if (open) {
    nextTick(() => inputRef.value?.focus())
  }
})

// Scroll to bottom when messages change
watch(
  () => messages.value.length,
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }
)

// Also scroll on content updates (for streaming)
watch(
  () => messages.value[messages.value.length - 1]?.content,
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }
)

// Handlers
const handleSend = async () => {
  if (!inputMessage.value.trim() || sending.value) return

  const content = inputMessage.value.trim()
  inputMessage.value = ''

  // Reset textarea height
  if (inputRef.value) {
    inputRef.value.style.height = ''
  }

  try {
    await sendMessage(content, () => {
      // Scroll on each chunk
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    })
  } catch (e) {
    console.error('Failed to send message:', e)
  }

  // Refocus input after sending
  nextTick(() => inputRef.value?.focus())
}

const handleClear = () => {
  clear()
  menuOpen.value = false
}

const handleResetPosition = () => {
  position.value = null
  menuOpen.value = false
}
</script>

<style scoped>
.bubble-enter-active {
  animation: bubbleIn 0.2s ease-out both;
}

.bubble-leave-active {
  animation: bubbleOut 0.15s ease-in both;
}

@keyframes bubbleIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes bubbleOut {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
}

.menu-enter-active,
.menu-leave-active {
  transition: all 0.15s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
