# Mentions System + Agent Channel Access + Catch-up Endpoint

## Overview

Add a mentions system (humans + agents), give agents read/write access to channels, render agent messages with markdown, fire toasts on agent channel replies, and provide a catch-up endpoint for agents to get everything they missed.

## Chunk 1: Mentions + Agent Channels + Markdown

### 1. Database: MessageMention model

Add to `prisma/schema.prisma`:

```prisma
model MessageMention {
  id        String @id @default(cuid())
  messageId String
  userId    String

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id])

  @@unique([messageId, userId])
  @@index([userId, messageId])
  @@map("message_mentions")
}
```

Add relations to existing models:

```prisma
// On Message model, add:
mentions  MessageMention[]

// On User model, add:
mentions  MessageMention[]
```

Run `npx prisma migrate diff` to generate the migration (PGlite auto-applies on start).

### 2. Mention parsing utility

Create `server/utils/mentions.ts`:

```typescript
import { prisma } from './prisma'

// Pattern: <@userId> in message content
const MENTION_PATTERN = /<@([a-zA-Z0-9_-]+)>/g

export function extractMentionIds(content: string): string[] {
  const ids: string[] = []
  let match
  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    ids.push(match[1])
  }
  return [...new Set(ids)]
}

export async function createMentions(messageId: string, content: string): Promise<void> {
  const userIds = extractMentionIds(content)
  if (userIds.length === 0) return

  // Verify users exist
  const validUsers = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true },
  })

  const validIds = validUsers.map(u => u.id)

  if (validIds.length > 0) {
    await prisma.messageMention.createMany({
      data: validIds.map(userId => ({ messageId, userId })),
      skipDuplicates: true,
    })
  }
}

// For display: replace <@userId> with @DisplayName
export function renderMentionsForDisplay(content: string, userMap: Map<string, string>): string {
  return content.replace(MENTION_PATTERN, (_match, userId) => {
    const name = userMap.get(userId)
    return name ? `@${name}` : '@unknown'
  })
}
```

### 3. Update message creation to parse mentions

In `server/api/channels/[id]/messages.post.ts`, after creating the message:

```typescript
import { createMentions } from '../../../utils/mentions'

// After the message is created:
await createMentions(message.id, body.content)

// Also check if any mentioned users are agents — if so, fire agent activity toast
const mentionedAgents = await prisma.user.findMany({
  where: {
    id: { in: extractMentionIds(body.content) },
    isAgent: true,
  },
  select: { id: true, name: true, agentProvider: true },
})

for (const agent of mentionedAgents) {
  // Broadcast a channel_mention event via WebSocket
  broadcast({
    type: 'agent_channel_mention',
    workspaceId: channel.workspaceId,
    channelId,
    messageId: message.id,
    agent: { id: agent.id, name: agent.name, provider: agent.agentProvider },
    author: { id: user.id, name: user.name },
    content: body.content.slice(0, 200),
    threadId: body.parentId || null,
    timestamp: new Date().toISOString(),
  })
}
```

### 4. Frontend: @mention autocomplete in MessageInput

Update `app/components/channels/MessageInput.vue`:

**New props:**
```typescript
const props = defineProps<{
  channelId: string
  parentId?: string
  placeholder?: string
  disabled?: boolean
  hideHelper?: boolean
  members?: { id: string; name: string; isAgent: boolean; avatar?: string }[]
}>()
```

**Autocomplete logic:**
- Watch for `@` typed in the textarea
- When `@` is detected and followed by 0+ chars, show a dropdown of matching members
- Filter `props.members` by the partial text after `@`
- On selection, replace `@partial` with `<@userId>` in the raw content
- Display the mention as a highlighted span (use a contenteditable div, or keep it simple: store raw `<@id>` in content, render visually on display only)

**Simple approach (recommended):** Keep the textarea as-is. User types `@har` and sees a floating dropdown. On select, insert `<@userId>` into the textarea. The raw text has `<@userId>` tokens. The message display layer resolves these to pretty `@Name` pills.

The autocomplete dropdown:
- Position it above the textarea (like Slack)
- Show member name, avatar, and an "Agent" badge for `isAgent` users
- Arrow keys to navigate, Enter/Tab to select, Escape to dismiss
- Max 6 results shown

### 5. Frontend: Render mentions as pills in messages

Update `app/components/channels/MessageItem.vue`:

- The message GET endpoint should include mentioned user data (or the frontend resolves from the member list)
- In the `renderInline` function, add a step to replace `<@userId>` with styled mention pills:

```typescript
// Before other inline rendering:
content = content.replace(/<@([a-zA-Z0-9_-]+)>/g, (_match, userId) => {
  const member = memberMap.get(userId)
  if (!member) return '@unknown'
  const isAgent = member.isAgent
  return `<span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${
    isAgent
      ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
      : 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400'
  }">@${member.name}</span>`
})
```

- Pass the workspace member list (or channel member list) to MessageItem for resolution
- Agent mention pills get a different color (amber) vs human (blue)

### 6. Agent messages: full markdown rendering

Update `isAiMessage` detection in `MessageItem.vue`:

```typescript
// Replace the name-based check:
const isAiMessage = computed(() => {
  return props.message.user?.isAgent === true
})
```

This requires the message GET endpoint to include `isAgent` on the user select. Update `server/api/channels/[id]/messages.get.ts`:

```typescript
user: {
  select: { id: true, name: true, avatar: true, isAgent: true },
},
```

Use the existing `MarkdownRenderer` component for agent messages instead of the basic `renderedAiContent` inline renderer. Or, improve the existing inline renderer to handle full markdown (headers, lists, code blocks). The `MarkdownRenderer` component is already available and battle-tested — use it.

### 7. Agent Channel API endpoints

Create under `server/api/agents/`:

**`channels.get.ts`** — List channels the agent is a member of:
```typescript
// GET /api/agents/channels
// Returns channels where agent has a ChannelMember record
// Response: { channels: [{ id, name, displayName, projectId, type, unreadMentions }] }
```

**`channels/[id]/messages.get.ts`** — Read messages from a channel:
```typescript
// GET /api/agents/channels/:id/messages
// Query params: limit (default 50), before (cursor), since (ISO date), mentionsMe (boolean)
// Agent must be a ChannelMember
// Response: same format as existing messages.get but through agent auth
```

**`channels/[id]/messages.post.ts`** — Post a message or thread reply:
```typescript
// POST /api/agents/channels/:id/messages
// Body: { content: string, parentId?: string }
// Agent must be a ChannelMember
// Creates the message with agent's userId
// Fires createMentions() for any mentions in the content
// Broadcasts via WebSocket (same as human messages)
// Also fires agent_activity toast for the channel reply
```

For the agent toast on channel reply, add a new broadcast type in the message creation:

```typescript
// In the agent's messages.post.ts, after creating the message:
broadcast({
  type: 'agent_channel_message',
  workspaceId: channel.workspaceId,
  channelId,
  agent: { id: agent.id, name: agent.name, provider: agent.agentProvider },
  messagePreview: body.content.slice(0, 200),
  threadId: body.parentId || null,
  channelName: channel.displayName || channel.name,
  timestamp: new Date().toISOString(),
})
```

The frontend's `useWebSocket.ts` composable handles this event type and shows an `AgentActivityToast`.

### 8. Workspace members endpoint for mention resolution

If not already available, add:

**`GET /api/workspace/members`** — returns all workspace members (humans + agents) with `{ id, name, avatar, isAgent, agentProvider }`.

This is needed by the MessageInput autocomplete and MessageItem mention rendering. The frontend should fetch this once and cache it.

### 9. CLI commands

Add to `cli/bin/clawlab.mjs`:

```
clawlab channels                              # List my channels
clawlab channels <id>                         # Read recent messages (default 20)
clawlab channels <id> --since 2h              # Messages from last 2 hours
clawlab channels <id> --mentions-only         # Only messages mentioning me
clawlab channels <id> --reply "message"       # Post a message
clawlab channels <id> --reply "msg" --thread <parentId>  # Reply to a thread
```

## Chunk 2: Catch-up Endpoint (implement after chunk 1)

**`GET /api/agents/catchup?since=4h`**

Returns everything the agent should know about since the given time:

```json
{
  "since": "2026-02-16T17:00:00Z",
  "tasks": {
    "assigned": [],          // New tasks assigned to agent since `since`
    "updated": [],           // Tasks agent is assigned to that were updated
    "commented": []          // New comments on agent's tasks
  },
  "channels": {
    "mentions": [],          // Channel messages where agent was @mentioned
    "threadReplies": []      // Replies to threads agent participated in
  },
  "summary": {
    "newTaskCount": 0,
    "mentionCount": 0,
    "commentCount": 0
  }
}
```

Query is scoped to: tasks the agent is assigned to, channels the agent is a member of.

## Implementation Notes

- **PGlite**: Schema changes auto-apply via `prisma migrate diff` on start. No manual migration needed.
- **Agent auth**: All `/api/agents/*` endpoints use existing Bearer token middleware.
- **WebSocket**: Agent channel messages use existing broadcast infrastructure. Toast handling in `useWebSocket.ts`.
- **Mention format**: Raw `<@userId>` in stored content. Resolved at render time. Same pattern as Discord/Slack.
- **Thread support**: Already exists via `parentId` on Message. Agent can reply to threads by passing `parentId`.
- **No channel creation**: Agents can only read/write channels they're already members of. Humans manage membership.
- **Markdown in agent messages**: Use `isAgent` flag on user, not name-matching. Apply `MarkdownRenderer` component.

## File Changes Summary

### New files:
- `server/utils/mentions.ts` — mention parsing + creation
- `server/api/agents/channels.get.ts` — list agent's channels
- `server/api/agents/channels/[id]/messages.get.ts` — read channel messages
- `server/api/agents/channels/[id]/messages.post.ts` — post/reply in channel

### Modified files:
- `prisma/schema.prisma` — add MessageMention model + relations
- `server/api/channels/[id]/messages.post.ts` — call createMentions(), broadcast agent mentions
- `server/api/channels/[id]/messages.get.ts` — include `isAgent` on user select, include mention data
- `app/components/channels/MessageInput.vue` — @mention autocomplete dropdown
- `app/components/channels/MessageItem.vue` — render mention pills, use isAgent for markdown, use MarkdownRenderer for agent messages
- `app/composables/useWebSocket.ts` — handle `agent_channel_message` event type
- `app/components/ui/AgentActivityToast.vue` — handle channel message toast variant
- `cli/bin/clawlab.mjs` — add channels subcommands

### Existing patterns to follow:
- Agent auth: `server/middleware/agent-auth.ts` + `requireAgentUser()`
- Agent API style: see `server/api/agents/tasks.get.ts` for pagination pattern
- Toast events: see `server/utils/agentNotify.ts` for broadcast pattern
- WebSocket handling: see `app/composables/useWebSocket.ts` for event dispatch
