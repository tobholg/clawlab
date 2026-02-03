import { ref, computed } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StakeholderChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface ParsedAction {
  type: 'CREATE_IR' | 'CREATE_TASK'
  irType?: 'question' | 'suggestion'
  content?: string
  title?: string
  description?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Parsing
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_REGEX = /\[ACTION:(\w+)\]([\s\S]*?)\[\/ACTION\]/g

export const parseActions = (content: string): ParsedAction[] => {
  const actions: ParsedAction[] = []
  let match

  while ((match = ACTION_REGEX.exec(content)) !== null) {
    const actionType = match[1]
    const actionBody = match[2].trim()

    if (actionType === 'CREATE_IR') {
      const typeMatch = actionBody.match(/type:\s*(question|suggestion)/i)
      const contentMatch = actionBody.match(/content:\s*([\s\S]+?)(?=\n\w+:|$)/i)
      
      actions.push({
        type: 'CREATE_IR',
        irType: (typeMatch?.[1]?.toLowerCase() as 'question' | 'suggestion') || 'question',
        content: contentMatch?.[1]?.trim() || actionBody
      })
    } else if (actionType === 'CREATE_TASK') {
      const titleMatch = actionBody.match(/title:\s*(.+?)(?=\n|$)/i)
      const descMatch = actionBody.match(/description:\s*([\s\S]+?)(?=\n\w+:|$)/i)
      
      actions.push({
        type: 'CREATE_TASK',
        title: titleMatch?.[1]?.trim() || 'New Task',
        description: descMatch?.[1]?.trim() || actionBody
      })
    }
  }

  // Reset regex lastIndex for future calls
  ACTION_REGEX.lastIndex = 0

  return actions
}

export const stripActions = (content: string): string => {
  return content.replace(ACTION_REGEX, '').trim()
}

export const hasActions = (content: string): boolean => {
  const result = ACTION_REGEX.test(content)
  ACTION_REGEX.lastIndex = 0
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable Factory - creates instance per space
// ─────────────────────────────────────────────────────────────────────────────

// Store instances by spaceSlug to allow multiple spaces
const instances = new Map<string, ReturnType<typeof createStakeholderChat>>()

const createStakeholderChat = (spaceSlug: string) => {
  const messages = ref<StakeholderChatMessage[]>([])
  const sending = ref(false)
  const error = ref('')
  const pendingAction = ref<ParsedAction | null>(null)

  // Computed
  const hasMessages = computed(() => messages.value.length > 0)
  const lastMessage = computed(() => messages.value[messages.value.length - 1])

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  const clear = () => {
    messages.value = []
    error.value = ''
    pendingAction.value = null
  }

  const clearPendingAction = () => {
    pendingAction.value = null
  }

  /**
   * Send a message with streaming response
   */
  const sendMessage = async (content: string, onChunk?: () => void) => {
    sending.value = true
    error.value = ''
    pendingAction.value = null

    // Add user message
    const userMsg: StakeholderChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
    }
    messages.value.push(userMsg)

    // Add placeholder AI message
    const aiMsgId = `ai_${Date.now()}`
    const aiMsg: StakeholderChatMessage = {
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

      const response = await fetch(`/api/s/${spaceSlug}/chat`, {
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

      // Check for actions in the final response
      const finalMsg = messages.value.find(m => m.id === aiMsgId)
      if (finalMsg && hasActions(finalMsg.content)) {
        const actions = parseActions(finalMsg.content)
        if (actions.length > 0) {
          pendingAction.value = actions[0] // Handle first action
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

  /**
   * Create an Information Request
   */
  const createIR = async (type: 'question' | 'suggestion', content: string) => {
    const response = await $fetch(`/api/s/${spaceSlug}/ir`, {
      method: 'POST',
      body: { type, content }
    })
    
    pendingAction.value = null
    
    // Add confirmation message
    messages.value.push({
      id: `system_${Date.now()}`,
      role: 'assistant',
      content: `✓ Your ${type} has been submitted successfully. You can track it in the "My Requests" tab.`
    })

    return response
  }

  /**
   * Create an External Task
   */
  const createTask = async (title: string, description: string) => {
    const response = await $fetch(`/api/s/${spaceSlug}/task`, {
      method: 'POST',
      body: { title, description }
    })
    
    pendingAction.value = null
    
    // Add confirmation message
    messages.value.push({
      id: `system_${Date.now()}`,
      role: 'assistant',
      content: `✓ Your task "${title}" has been submitted for review. You can track it in the "My Requests" tab.`
    })

    return response
  }

  return {
    // State
    messages,
    sending,
    error,
    pendingAction,

    // Computed
    hasMessages,
    lastMessage,

    // Actions
    clear,
    clearPendingAction,
    sendMessage,
    createIR,
    createTask,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export composable
// ─────────────────────────────────────────────────────────────────────────────

export const useStakeholderChat = (spaceSlug: string) => {
  if (!instances.has(spaceSlug)) {
    instances.set(spaceSlug, createStakeholderChat(spaceSlug))
  }
  return instances.get(spaceSlug)!
}

// Clear instance when navigating away (optional, called from component)
export const clearStakeholderChatInstance = (spaceSlug: string) => {
  instances.delete(spaceSlug)
}
