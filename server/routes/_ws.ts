import type { Peer } from 'crossws'
import { onBroadcast } from '../utils/websocket'

interface UserInfo {
  id: string
  name: string
  avatar?: string | null
}

interface PeerData {
  user: UserInfo | null
  channels: Set<string>
  workspaces: Set<string>
  typing: Map<string, NodeJS.Timeout> // channelId -> timeout
}

// Track all connected peers
const peers = new Map<Peer, PeerData>()

// Track presence per channel: channelId -> Set of user ids
const channelPresence = new Map<string, Set<string>>()

// Track typing per channel: channelId -> Set of user ids
const channelTyping = new Map<string, Set<string>>()

// Broadcast to all peers in a workspace
function broadcastToWorkspace(workspaceId: string, message: object, excludePeer?: Peer) {
  const payload = JSON.stringify(message)
  for (const [peer, data] of peers) {
    if (data.workspaces.has(workspaceId) && peer !== excludePeer) {
      peer.send(payload)
    }
  }
}

// Broadcast to all peers in a channel
function broadcastToChannel(channelId: string, message: object, excludePeer?: Peer) {
  const payload = JSON.stringify(message)
  let sentCount = 0
  for (const [peer, data] of peers) {
    if (data.channels.has(channelId) && peer !== excludePeer) {
      peer.send(payload)
      sentCount++
    }
  }
  console.log('[WS] broadcastToChannel:', channelId, 'sent to', sentCount, 'peers')
}

// Broadcast to a specific user across all their connections
function broadcastToUser(userId: string, message: object) {
  const payload = JSON.stringify(message)
  for (const [peer, data] of peers) {
    if (data.user?.id === userId) {
      peer.send(payload)
    }
  }
}

// Get presence list for a channel
function getChannelPresence(channelId: string): UserInfo[] {
  const userIds = channelPresence.get(channelId)
  if (!userIds) return []
  
  const users: UserInfo[] = []
  const seenIds = new Set<string>()
  
  for (const [, data] of peers) {
    if (data.user && data.channels.has(channelId) && !seenIds.has(data.user.id)) {
      users.push(data.user)
      seenIds.add(data.user.id)
    }
  }
  
  return users
}

// Get typing users for a channel
function getChannelTyping(channelId: string): UserInfo[] {
  const userIds = channelTyping.get(channelId)
  if (!userIds) return []
  
  const users: UserInfo[] = []
  const seenIds = new Set<string>()
  
  for (const [, data] of peers) {
    if (data.user && userIds.has(data.user.id) && !seenIds.has(data.user.id)) {
      users.push(data.user)
      seenIds.add(data.user.id)
    }
  }
  
  return users
}

export default defineWebSocketHandler({
  open(peer) {
    console.log('[WS] Peer connected, total peers:', peers.size + 1)
    peers.set(peer, {
      user: null,
      channels: new Set(),
      workspaces: new Set(),
      typing: new Map(),
    })
  },

  close(peer) {
    const data = peers.get(peer)
    if (!data) return

    // Clear typing timeouts
    for (const timeout of data.typing.values()) {
      clearTimeout(timeout)
    }

    // Remove from all channels and broadcast leave
    for (const channelId of data.channels) {
      // Remove from presence
      const presence = channelPresence.get(channelId)
      if (presence && data.user) {
        presence.delete(data.user.id)
        
        // Only broadcast leave if user has no other connections in this channel
        let hasOtherConnection = false
        for (const [otherPeer, otherData] of peers) {
          if (otherPeer !== peer && otherData.user?.id === data.user.id && otherData.channels.has(channelId)) {
            hasOtherConnection = true
            break
          }
        }
        
        if (!hasOtherConnection) {
          broadcastToChannel(channelId, {
            type: 'presence',
            channelId,
            users: getChannelPresence(channelId),
          })
        }
      }

      // Remove from typing
      const typing = channelTyping.get(channelId)
      if (typing && data.user) {
        typing.delete(data.user.id)
        broadcastToChannel(channelId, {
          type: 'typing',
          channelId,
          users: getChannelTyping(channelId),
        })
      }
    }

    peers.delete(peer)
  },

  message(peer, message) {
    const data = peers.get(peer)
    if (!data) return

    let parsed: any
    try {
      parsed = JSON.parse(message.text())
    } catch {
      return
    }

    switch (parsed.type) {
      case 'auth': {
        // Authenticate and set user info
        console.log('[WS] Auth request for user:', parsed.user?.name || 'unknown')
        data.user = {
          id: parsed.user.id,
          name: parsed.user.name,
          avatar: parsed.user.avatar,
        }
        peer.send(JSON.stringify({ type: 'auth', success: true }))
        console.log('[WS] User authenticated:', data.user.name)
        break
      }

      case 'subscribe': {
        // Subscribe to a channel
        const channelId = parsed.channelId
        console.log('[WS] Subscribe request for channel:', channelId, 'user:', data.user?.name || 'NOT AUTHENTICATED')
        if (!channelId || !data.user) return

        data.channels.add(channelId)
        console.log('[WS] User', data.user.name, 'subscribed to channel:', channelId)

        // Add to presence
        if (!channelPresence.has(channelId)) {
          channelPresence.set(channelId, new Set())
        }
        const presence = channelPresence.get(channelId)!
        const wasAlreadyPresent = presence.has(data.user.id)
        presence.add(data.user.id)

        // Send current presence to the new subscriber
        peer.send(JSON.stringify({
          type: 'presence',
          channelId,
          users: getChannelPresence(channelId),
        }))

        // Send current typing to the new subscriber
        peer.send(JSON.stringify({
          type: 'typing',
          channelId,
          users: getChannelTyping(channelId),
        }))

        // Broadcast updated presence to others (only if user wasn't already present)
        if (!wasAlreadyPresent) {
          broadcastToChannel(channelId, {
            type: 'presence',
            channelId,
            users: getChannelPresence(channelId),
          }, peer)
        }
        break
      }

      case 'unsubscribe': {
        // Unsubscribe from a channel
        const channelId = parsed.channelId
        if (!channelId || !data.user) return

        data.channels.delete(channelId)

        // Clear typing timeout for this channel
        const typingTimeout = data.typing.get(channelId)
        if (typingTimeout) {
          clearTimeout(typingTimeout)
          data.typing.delete(channelId)
        }

        // Remove from presence (only if no other connections)
        const presence = channelPresence.get(channelId)
        if (presence) {
          let hasOtherConnection = false
          for (const [otherPeer, otherData] of peers) {
            if (otherPeer !== peer && otherData.user?.id === data.user.id && otherData.channels.has(channelId)) {
              hasOtherConnection = true
              break
            }
          }

          if (!hasOtherConnection) {
            presence.delete(data.user.id)
            broadcastToChannel(channelId, {
              type: 'presence',
              channelId,
              users: getChannelPresence(channelId),
            })
          }
        }

        // Remove from typing
        const typing = channelTyping.get(channelId)
        if (typing) {
          typing.delete(data.user.id)
          broadcastToChannel(channelId, {
            type: 'typing',
            channelId,
            users: getChannelTyping(channelId),
          })
        }
        break
      }

      case 'subscribe_workspace': {
        const workspaceId = parsed.workspaceId
        if (!workspaceId || !data.user) return
        data.workspaces.add(workspaceId)
        peer.send(JSON.stringify({ type: 'workspace_subscribed', workspaceId }))
        break
      }

      case 'unsubscribe_workspace': {
        const workspaceId = parsed.workspaceId
        if (!workspaceId) return
        data.workspaces.delete(workspaceId)
        break
      }

      case 'typing': {
        // User started typing
        const channelId = parsed.channelId
        if (!channelId || !data.user) return

        if (!channelTyping.has(channelId)) {
          channelTyping.set(channelId, new Set())
        }
        const typing = channelTyping.get(channelId)!
        typing.add(data.user.id)

        // Clear existing timeout
        const existingTimeout = data.typing.get(channelId)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
        }

        // Set timeout to clear typing after 3 seconds
        const timeout = setTimeout(() => {
          typing.delete(data.user!.id)
          data.typing.delete(channelId)
          broadcastToChannel(channelId, {
            type: 'typing',
            channelId,
            users: getChannelTyping(channelId),
          })
        }, 3000)
        data.typing.set(channelId, timeout)

        // Broadcast typing status
        broadcastToChannel(channelId, {
          type: 'typing',
          channelId,
          users: getChannelTyping(channelId),
        }, peer)
        break
      }

      case 'stop_typing': {
        // User stopped typing
        const channelId = parsed.channelId
        if (!channelId || !data.user) return

        // Clear timeout
        const existingTimeout = data.typing.get(channelId)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
          data.typing.delete(channelId)
        }

        // Remove from typing
        const typing = channelTyping.get(channelId)
        if (typing) {
          typing.delete(data.user.id)
          broadcastToChannel(channelId, {
            type: 'typing',
            channelId,
            users: getChannelTyping(channelId),
          })
        }
        break
      }
    }
  },
})

// Export helper for broadcasting new messages from API routes
export function broadcastMessage(channelId: string, message: any, senderId: string) {
  // Broadcast to channel subscribers
  broadcastToChannel(channelId, {
    type: 'message',
    channelId,
    message,
  })

  // Send notification to users not in the channel
  for (const [peer, data] of peers) {
    if (data.user && data.user.id !== senderId && !data.channels.has(channelId)) {
      peer.send(JSON.stringify({
        type: 'notification',
        channelId,
        message,
      }))
    }
  }
}

// Subscribe to broadcasts from API routes
onBroadcast((data) => {
  if (data.type === 'new_message') {
    // Broadcast to channel subscribers
    broadcastToChannel(data.channelId, {
      type: 'message',
      channelId: data.channelId,
      message: data.message,
    })

    // Send notification to connected users not in the channel
    for (const [peer, peerData] of peers) {
      if (peerData.user && peerData.user.id !== data.senderId && !peerData.channels.has(data.channelId)) {
        peer.send(JSON.stringify({
          type: 'notification',
          channelId: data.channelId,
          message: data.message,
        }))
      }
    }
  } else if (data.type === 'agent_activity') {
    // Broadcast agent activity to all workspace subscribers
    if (data.workspaceId) {
      broadcastToWorkspace(data.workspaceId, data)
    }
  } else if (data.type === 'reaction_update') {
    // Broadcast reaction update to channel subscribers
    console.log('[WS] Broadcasting reaction_update to channel:', data.channelId)
    broadcastToChannel(data.channelId, {
      type: 'reaction',
      channelId: data.channelId,
      messageId: data.messageId,
      reactions: data.reactions,
    })
  }
})

// Export for use in API routes
export { broadcastToChannel, broadcastToUser }
