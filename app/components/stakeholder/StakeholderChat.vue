<template>
  <div 
    :class="[
      'fixed right-0 top-14 bottom-0 z-40 flex flex-col bg-white border-l border-slate-200 transition-all duration-300',
      isOpen ? 'w-96' : 'w-0'
    ]"
  >
    <!-- Chat content (only visible when open) -->
    <div v-if="isOpen" class="flex flex-col h-full">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white shrink-0">
        <div class="flex items-center gap-2">
          <Icon name="heroicons:chat-bubble-left-ellipsis" class="w-4 h-4 text-violet-500" />
          <span class="text-sm font-medium text-slate-700">Chat</span>
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
              </div>
            </Transition>
          </div>

          <!-- Close Button -->
          <button
            class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            title="Close Chat"
            @click="$emit('close')"
          >
            <Icon name="heroicons:x-mark" class="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <!-- Empty state -->
        <div v-if="!hasMessages && !sending" class="h-full flex items-center justify-center">
          <div class="text-center px-4">
            <Icon name="heroicons:chat-bubble-left-right" class="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p class="text-sm text-slate-500 font-medium">How can I help?</p>
            <p class="text-xs text-slate-400 mt-1">
              Ask questions about the project, submit requests, or share feedback
            </p>
          </div>
        </div>

        <!-- Message list -->
        <StakeholderChatMessage
          v-for="message in messages"
          :key="message.id"
          :message="message"
        />
        
        <!-- Thinking indicator -->
        <div v-if="sending && messages.length > 0 && !messages[messages.length - 1]?.content" class="flex justify-start">
          <div class="px-3 py-2 rounded-2xl rounded-tl-sm bg-violet-50 text-slate-500 text-sm">
            <span class="inline-flex items-center gap-1">
              <span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style="animation-delay: 0ms" />
              <span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style="animation-delay: 150ms" />
              <span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style="animation-delay: 300ms" />
            </span>
          </div>
        </div>
      </div>

      <!-- Action Card (when AI proposes an action) -->
      <Transition name="slide-up">
        <div v-if="pendingAction" class="shrink-0 border-t border-slate-100 bg-violet-50/50 p-4">
          <!-- IR Action -->
          <template v-if="pendingAction.type === 'CREATE_IR'">
            <div class="flex items-start gap-2 mb-3">
              <Icon 
                :name="pendingAction.irType === 'suggestion' ? 'heroicons:light-bulb' : 'heroicons:question-mark-circle'" 
                class="w-5 h-5 text-violet-500 shrink-0 mt-0.5" 
              />
              <div>
                <p class="text-sm font-medium text-slate-700">
                  {{ pendingAction.irType === 'suggestion' ? 'Send Suggestion' : 'Send Question' }}
                </p>
                <p class="text-xs text-slate-500 mt-0.5">This will be sent to the team</p>
              </div>
            </div>
            
            <textarea
              v-model="editableContent"
              rows="5"
              class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-y min-h-[100px]"
            />

            <div class="flex items-center gap-2 mt-3">
              <button
                @click="handleSubmitIR"
                :disabled="submitting"
                class="flex-1 px-3 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                <span v-if="submitting">Sending...</span>
                <span v-else>Send {{ pendingAction.irType === 'suggestion' ? 'Suggestion' : 'Request' }}</span>
              </button>
              <button
                @click="clearPendingAction"
                :disabled="submitting"
                class="px-3 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </template>

          <!-- Task Action -->
          <template v-else-if="pendingAction.type === 'CREATE_TASK'">
            <div class="flex items-start gap-2 mb-3">
              <Icon name="heroicons:clipboard-document-list" class="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p class="text-sm font-medium text-slate-700">Submit Task</p>
                <p class="text-xs text-slate-500 mt-0.5">This will be reviewed by the team</p>
              </div>
            </div>
            
            <input
              v-model="editableTitle"
              type="text"
              placeholder="Task title"
              class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent mb-2"
            />
            
            <textarea
              v-model="editableDescription"
              rows="5"
              placeholder="Description"
              class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-y min-h-[100px]"
            />

            <div class="flex items-center gap-2 mt-3">
              <button
                @click="handleSubmitTask"
                :disabled="submitting || !editableTitle.trim()"
                class="flex-1 px-3 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                <span v-if="submitting">Submitting...</span>
                <span v-else>Submit Task</span>
              </button>
              <button
                @click="clearPendingAction"
                :disabled="submitting"
                class="px-3 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </template>
        </div>
      </Transition>

      <!-- Input -->
      <div class="flex items-center gap-2 px-4 py-3 shrink-0 border-t border-slate-100 bg-white">
        <textarea
          ref="inputRef"
          v-model="inputMessage"
          rows="1"
          placeholder="Ask anything..."
          :disabled="sending || !!pendingAction"
          class="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 resize-none max-h-32"
          @keydown.enter.exact.prevent="handleSend"
          @input="autoResize"
        />
        <button
          @click="handleSend"
          :disabled="!inputMessage.trim() || sending || !!pendingAction"
          class="w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center hover:bg-violet-600 transition-colors disabled:opacity-30 disabled:hover:bg-violet-500 shrink-0"
        >
          <Icon v-if="sending" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
          <Icon v-else name="heroicons:arrow-up" class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>

  <!-- Toggle Button (fixed position) -->
  <button
    v-if="!isOpen"
    @click="$emit('open')"
    class="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 hover:scale-105 transition-all duration-300 flex items-center justify-center z-50"
    title="Open Chat"
  >
    <Icon name="heroicons:chat-bubble-left-ellipsis" class="w-6 h-6" />
  </button>
</template>

<script setup lang="ts">
import { useStakeholderChat } from '~/composables/useStakeholderChat'
import StakeholderChatMessage from './StakeholderChatMessage.vue'

const props = defineProps<{
  spaceSlug: string
  isOpen: boolean
  canSubmitTasks?: boolean
}>()

const emit = defineEmits<{
  open: []
  close: []
}>()

const {
  messages,
  sending,
  hasMessages,
  pendingAction,
  sendMessage,
  clear,
  clearPendingAction,
  createIR,
  createTask,
} = useStakeholderChat(props.spaceSlug)

// Local state
const menuRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const inputMessage = ref('')
const menuOpen = ref(false)
const submitting = ref(false)

// Editable fields for actions
const editableContent = ref('')
const editableTitle = ref('')
const editableDescription = ref('')

// Watch pending action to populate editable fields
watch(pendingAction, (action) => {
  if (action) {
    if (action.type === 'CREATE_IR') {
      editableContent.value = action.content || ''
    } else if (action.type === 'CREATE_TASK') {
      editableTitle.value = action.title || ''
      editableDescription.value = action.description || ''
    }
  }
}, { immediate: true })

// Auto-resize textarea
const autoResize = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement
  textarea.style.height = ''
  textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px'
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
})

// Focus input when opened
watch(() => props.isOpen, (open) => {
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
  if (!inputMessage.value.trim() || sending.value || pendingAction.value) return

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

const handleSubmitIR = async () => {
  if (!pendingAction.value || !editableContent.value.trim()) return
  
  submitting.value = true
  try {
    await createIR(
      pendingAction.value.irType || 'question',
      editableContent.value.trim()
    )
  } catch (e: any) {
    console.error('Failed to create IR:', e)
    // Show error in chat
    messages.value.push({
      id: `error_${Date.now()}`,
      role: 'assistant',
      content: `⚠️ Failed to submit: ${e.data?.message || e.message || 'Unknown error'}`
    })
  } finally {
    submitting.value = false
    editableContent.value = ''
  }
}

const handleSubmitTask = async () => {
  if (!pendingAction.value || !editableTitle.value.trim()) return
  
  // Check if user has permission
  if (!props.canSubmitTasks) {
    messages.value.push({
      id: `error_${Date.now()}`,
      role: 'assistant',
      content: `⚠️ You don't have permission to submit tasks in this space. You can submit it as a suggestion instead.`
    })
    clearPendingAction()
    return
  }
  
  submitting.value = true
  try {
    await createTask(
      editableTitle.value.trim(),
      editableDescription.value.trim()
    )
  } catch (e: any) {
    console.error('Failed to create task:', e)
    // Show error in chat
    messages.value.push({
      id: `error_${Date.now()}`,
      role: 'assistant',
      content: `⚠️ Failed to submit task: ${e.data?.message || e.message || 'Unknown error'}`
    })
  } finally {
    submitting.value = false
    editableTitle.value = ''
    editableDescription.value = ''
  }
}
</script>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition: all 0.15s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
