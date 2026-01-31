import { ref, computed } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface QuickChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton state - shared across all components
// ─────────────────────────────────────────────────────────────────────────────

const isOpen = ref(false)
const messages = ref<QuickChatMessage[]>([])
const sending = ref(false)
const error = ref('')

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export const useQuickChat = () => {
  // Computed
  const hasMessages = computed(() => messages.value.length > 0)

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  const open = () => {
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
  }

  const toggle = () => {
    isOpen.value = !isOpen.value
  }

  const clear = () => {
    messages.value = []
    error.value = ''
  }

  /**
   * Send a message with streaming response
   */
  const sendMessage = async (content: string, onChunk?: () => void) => {
    sending.value = true
    error.value = ''

    // Add user message
    const userMsg: QuickChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
    }
    messages.value.push(userMsg)

    // Add placeholder AI message
    const aiMsgId = `ai_${Date.now()}`
    const aiMsg: QuickChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
    }
    messages.value.push(aiMsg)

    try {
      // Build history from previous messages (excluding the ones we just added)
      const history = messages.value
        .slice(0, -2)
        .map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('/api/chat/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, history }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        
        // Find the AI message and append content
        const currentMsg = messages.value.find(m => m.id === aiMsgId)
        if (currentMsg) {
          currentMsg.content += chunk
          onChunk?.()
        }
      }
    } catch (e: any) {
      // Remove placeholder messages on error
      messages.value = messages.value.filter(m => m.id !== aiMsgId && m.id !== userMsg.id)
      error.value = e.message || 'Failed to send message'
      throw e
    } finally {
      sending.value = false
    }
  }

  return {
    // State
    isOpen,
    messages,
    sending,
    error,

    // Computed
    hasMessages,

    // Actions
    open,
    close,
    toggle,
    clear,
    sendMessage,
  }
}
