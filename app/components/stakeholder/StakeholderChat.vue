<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300 ease-out"
      leave-active-class="transition-opacity duration-200 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[60] bg-slate-900/20 backdrop-blur-[2px]"
        @click="$emit('close')"
      />
    </Transition>
  </Teleport>

  <!-- Slide-out Panel -->
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    leave-active-class="transition-transform duration-200 ease-in"
    enter-from-class="translate-x-full"
    leave-to-class="translate-x-full"
  >
    <div
      v-if="isOpen"
      class="fixed right-0 top-0 bottom-0 z-[61] w-full max-w-md lg:max-w-lg xl:max-w-xl flex flex-col bg-white shadow-2xl shadow-slate-900/10"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
        <div class="flex items-center gap-2">
          <Icon name="heroicons:sparkles" class="w-5 h-5 text-violet-500" />
          <div>
            <span class="text-sm font-semibold text-slate-900">AI Assistant</span>
            <p class="text-[11px] text-slate-400 leading-tight">Ask anything about this project</p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <!-- Menu Button -->
          <div ref="menuRef" class="relative">
            <button
              class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Menu"
              @click.stop="menuOpen = !menuOpen"
            >
              <Icon name="heroicons:ellipsis-vertical" class="w-4 h-4" />
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
                  <span class="text-slate-700">Clear Chat</span>
                </button>
              </div>
            </Transition>
          </div>

          <!-- Close Button -->
          <button
            class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Close"
            @click="$emit('close')"
          >
            <Icon name="heroicons:x-mark" class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto px-5 py-4">
        <!-- Empty state -->
        <div v-if="!hasMessages && !sending" class="h-full flex items-center justify-center">
          <div class="text-center px-6 max-w-sm">
            <Icon name="heroicons:sparkles" class="w-10 h-10 text-violet-500 mx-auto mb-5" />

            <h3 class="text-base font-semibold text-slate-900 mb-2">How can I help?</h3>
            <p class="text-sm text-slate-500 leading-relaxed mb-6">
              I can answer questions about this project, help you submit requests, or share feedback with the team.
            </p>

            <!-- Suggestion chips -->
            <div class="space-y-2">
              <button
                v-for="suggestion in suggestions"
                :key="suggestion.text"
                @click="handleSuggestionClick(suggestion.text)"
                class="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-violet-50 border border-slate-100 hover:border-violet-200 rounded-xl text-left transition-all group"
              >
                <Icon :name="suggestion.icon" class="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition-colors shrink-0" />
                <span class="text-sm text-slate-600 group-hover:text-violet-700 transition-colors">{{ suggestion.text }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Message list -->
        <div v-else class="space-y-3">
          <StakeholderChatMessage
            v-for="message in messages"
            :key="message.id"
            :message="message"
          />

          <!-- Thinking indicator -->
          <div v-if="sending && messages.length > 0 && !messages[messages.length - 1]?.content" class="flex justify-start">
            <div class="px-4 py-3 rounded-2xl rounded-tl-sm bg-violet-50">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 bg-violet-400 rounded-full chat-dot" style="animation-delay: 0ms" />
                <span class="w-1.5 h-1.5 bg-violet-400 rounded-full chat-dot" style="animation-delay: 200ms" />
                <span class="w-1.5 h-1.5 bg-violet-400 rounded-full chat-dot" style="animation-delay: 400ms" />
              </span>
            </div>
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
      <div class="flex items-center gap-3 p-6 shrink-0 border-t border-slate-100 bg-white">
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
  </Transition>

</template>

<script setup lang="ts">
import { useStakeholderChat } from '~/composables/useStakeholderChat'
import StakeholderChatMessage from './StakeholderChatMessage.vue'

const props = defineProps<{
  spaceId: string
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
} = useStakeholderChat(props.spaceId, props.spaceSlug)

// Suggestion prompts for empty state
const suggestions = [
  { text: 'What is the current project status?', icon: 'heroicons:chart-bar' },
  { text: 'Are there any blockers or risks?', icon: 'heroicons:exclamation-triangle' },
  { text: 'What was completed recently?', icon: 'heroicons:check-circle' },
]

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

// Handle suggestion chip click
const handleSuggestionClick = (text: string) => {
  inputMessage.value = text
  nextTick(() => handleSend())
}

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
    messages.value.push({
      id: `error_${Date.now()}`,
      role: 'assistant',
      content: `Failed to submit: ${e.data?.message || e.message || 'Unknown error'}`
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
      content: `You don't have permission to submit tasks in this space. You can submit it as a suggestion instead.`
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
    messages.value.push({
      id: `error_${Date.now()}`,
      role: 'assistant',
      content: `Failed to submit task: ${e.data?.message || e.message || 'Unknown error'}`
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

@keyframes chat-dot-pulse {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.chat-dot {
  animation: chat-dot-pulse 1.4s ease-in-out infinite;
}
</style>
