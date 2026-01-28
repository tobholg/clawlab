// WebSocket broadcast utilities
// This uses Nitro's global storage to share state with the WebSocket handler

import type { H3Event } from 'h3'

interface BroadcastMessage {
  type: string
  channelId: string
  message?: any
  [key: string]: any
}

// Get the WebSocket peers from the global Nitro context
// In Nitro with experimental websocket, we need to use a shared broadcast mechanism

// For now, we'll use a simple in-memory event bus that the WebSocket handler subscribes to
type BroadcastHandler = (data: BroadcastMessage) => void
const handlers: Set<BroadcastHandler> = new Set()

export function onBroadcast(handler: BroadcastHandler) {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export function broadcast(data: BroadcastMessage) {
  for (const handler of handlers) {
    handler(data)
  }
}

export function broadcastNewMessage(channelId: string, message: any, senderId: string) {
  broadcast({
    type: 'new_message',
    channelId,
    message,
    senderId,
  })
}

export function broadcastMessageUpdate(channelId: string, messageId: string, updates: any) {
  broadcast({
    type: 'message_update',
    channelId,
    messageId,
    updates,
  })
}

export function broadcastMessageDelete(channelId: string, messageId: string) {
  broadcast({
    type: 'message_delete',
    channelId,
    messageId,
  })
}
