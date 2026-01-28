import type { ChannelMessage, ChannelUser } from './useChannels'

interface WebSocketState {
  connected: boolean
  authenticated: boolean
}

interface Notification {
  id: string
  channelId: string
  channelName?: string
  message: ChannelMessage
  timestamp: number
}

// Singleton WebSocket connection
let ws: WebSocket | null = null
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 2000

// Reactive state
const state = reactive<WebSocketState>({
  connected: false,
  authenticated: false,
})

// Presence per channel: channelId -> users
const presence = reactive<Map<string, ChannelUser[]>>(new Map())

// Typing per channel: channelId -> users
const typing = reactive<Map<string, ChannelUser[]>>(new Map())

// Notifications queue
const notifications = ref<Notification[]>([])

// Message handlers per channel
const messageHandlers = new Map<string, (message: ChannelMessage) => void>()

// Current user
let currentUser: { id: string; name: string; avatar?: string | null } | null = null

// Subscribed channels
const subscribedChannels = new Set<string>()

// Channel name cache for notifications
const channelNameCache = new Map<string, string>()

function getWebSocketUrl(): string {
  if (import.meta.client) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/_ws`
  }
  return ''
}

function connect() {
  if (!import.meta.client) return
  if (ws?.readyState === WebSocket.OPEN) return

  const url = getWebSocketUrl()
  ws = new WebSocket(url)

  ws.onopen = () => {
    state.connected = true
    reconnectAttempts = 0

    // Re-authenticate if we have user info
    if (currentUser) {
      send({ type: 'auth', user: currentUser })
    }

    // Re-subscribe to channels
    for (const channelId of subscribedChannels) {
      send({ type: 'subscribe', channelId })
    }
  }

  ws.onclose = () => {
    state.connected = false
    state.authenticated = false

    // Attempt reconnect
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectTimeout = setTimeout(() => {
        reconnectAttempts++
        connect()
      }, RECONNECT_DELAY * Math.pow(2, reconnectAttempts))
    }
  }

  ws.onerror = () => {
    // Error handling - close will be called after this
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      handleMessage(data)
    } catch {
      // Ignore parse errors
    }
  }
}

function disconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
  state.connected = false
  state.authenticated = false
}

function send(data: object) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

function handleMessage(data: any) {
  switch (data.type) {
    case 'auth':
      state.authenticated = data.success
      break

    case 'presence':
      presence.set(data.channelId, data.users || [])
      break

    case 'typing':
      typing.set(data.channelId, data.users || [])
      break

    case 'message': {
      const handler = messageHandlers.get(data.channelId)
      if (handler) {
        handler(data.message)
      }
      break
    }

    case 'notification': {
      // Add to notifications queue
      const notification: Notification = {
        id: `${data.channelId}-${data.message.id}`,
        channelId: data.channelId,
        channelName: channelNameCache.get(data.channelId),
        message: data.message,
        timestamp: Date.now(),
      }
      notifications.value = [notification, ...notifications.value].slice(0, 5)
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        dismissNotification(notification.id)
      }, 5000)
      break
    }
  }
}

function authenticate(user: { id: string; name: string; avatar?: string | null }) {
  currentUser = user
  send({ type: 'auth', user })
}

function subscribe(channelId: string, channelName?: string, onMessage?: (message: ChannelMessage) => void) {
  subscribedChannels.add(channelId)
  if (channelName) {
    channelNameCache.set(channelId, channelName)
  }
  if (onMessage) {
    messageHandlers.set(channelId, onMessage)
  }
  send({ type: 'subscribe', channelId })
}

function unsubscribe(channelId: string) {
  subscribedChannels.delete(channelId)
  messageHandlers.delete(channelId)
  send({ type: 'unsubscribe', channelId })
}

function sendTyping(channelId: string) {
  send({ type: 'typing', channelId })
}

function sendStopTyping(channelId: string) {
  send({ type: 'stop_typing', channelId })
}

function dismissNotification(id: string) {
  notifications.value = notifications.value.filter(n => n.id !== id)
}

function getPresence(channelId: string): ChannelUser[] {
  return presence.get(channelId) || []
}

function getTyping(channelId: string): ChannelUser[] {
  // Filter out current user from typing
  const users = typing.get(channelId) || []
  return currentUser ? users.filter(u => u.id !== currentUser!.id) : users
}

export function useWebSocket() {
  // Auto-connect on client
  if (import.meta.client && !ws) {
    connect()
  }

  return {
    // State
    state: readonly(state),
    notifications: readonly(notifications),

    // Methods
    connect,
    disconnect,
    authenticate,
    subscribe,
    unsubscribe,
    sendTyping,
    sendStopTyping,
    dismissNotification,
    getPresence,
    getTyping,

    // Reactive getters (for use in templates)
    presence,
    typing,
  }
}
