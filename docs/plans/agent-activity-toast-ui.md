# Agent Activity Toast — Client UI Spec

## Overview

Real-time floating notification cards that appear top-right when AI agents perform actions via the API. Shows what the agent did, on which task, with old→new values. Clickable to navigate to the task. Auto-dismisses after 10 seconds.

## Server Side (already done)

The WebSocket server already emits `agent_activity` events to workspace subscribers. The client needs to:
1. Subscribe to the workspace on connect
2. Handle `agent_activity` messages
3. Display beautiful toast notifications

## WebSocket Event Shape

```ts
{
  type: 'agent_activity',
  workspaceId: string,
  agent: { id: string, name: string, provider: string | null },
  project: { id: string, title: string } | null,
  task: { id: string, title: string },
  action: 'status_change' | 'progress_update' | 'substatus_change' | 'field_updated' | 'subtask_created' | 'subtask_deleted' | 'comment_added' | 'doc_created' | 'doc_updated',
  detail: {
    field?: string,         // "Status", "Progress", "Stage", "Category", "Priority", "Title"
    oldValue?: string,      // "10%", "Scoping", "Todo"
    newValue?: string,      // "40%", "Active", "In Progress"
    title?: string,         // for subtask/doc creation: the name of what was created
  },
  timestamp: string         // ISO 8601
}
```

## What to Build

### 1. Extend `app/composables/useWebSocket.ts`

Add:
- `agentActivities` ref — array of agent activity notifications (max 5)
- `subscribeWorkspace(workspaceId: string)` method — sends `{ type: 'subscribe_workspace', workspaceId }` to WS
- `unsubscribeWorkspace(workspaceId: string)` method
- `dismissAgentActivity(id: string)` method
- Handle `agent_activity` in `handleMessage`:
  - Create notification with unique id (e.g. `agent-${timestamp}-${Math.random()}`)
  - Add to `agentActivities` array (prepend, cap at 5)
  - Auto-dismiss after 10 seconds
- Handle `workspace_subscribed` message type (just log for debugging)
- Track subscribed workspaces in a Set (similar to `subscribedChannels`) for re-subscribe on reconnect

### 2. Create `app/components/ui/AgentActivityToast.vue`

A beautiful floating notification card. Design reference: the existing `NotificationToast.vue` but with a different style that says "agent activity" not "chat message".

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  🤖  Harriet                              ✕  3s │
│  AI/ML Research → Compression Task               │
│                                                   │
│  Progress updated: 45% → 80%                    │
└──────────────────────────────────────────────────┘
```

**Design details:**
- Fixed position: `top-4 right-4`, z-50
- Width: `w-80` (same as existing toasts)
- Background: subtle gradient or tinted background to distinguish from chat notifications
  - Light mode: white bg with a left accent border (2-3px) colored by agent provider
  - Dark mode: dark card with same accent
- Agent provider accent colors:
  - openclaw: amber/yellow (#f59e0b)
  - codex: emerald (#10b981)
  - cursor: blue (#3b82f6)
  - custom: slate (#64748b)
- Agent avatar: circular, first letter of agent name, gradient background matching provider color
- Breadcrumb: `Project → Task` in small muted text
- Action description: human-readable, formatted from the event data:
  - status_change: "Status changed: {old} → {new}"
  - progress_update: "Progress updated: {old} → {new}"
  - substatus_change: "Stage changed: {old} → {new}"
  - field_updated: "{field} updated: {old} → {new}"
  - subtask_created: "Created subtask: {title}"
  - subtask_deleted: "Removed subtask: {title}"
  - comment_added: "Commented: {title}" (title is the comment preview)
  - doc_created: "Created document: {title}"
  - doc_updated: "Updated document: {title} ({newValue})" (newValue is version like "v3")
- Relative timestamp: "2s", "5s", "1m" — update reactively
- **Transitions**: TransitionGroup with:
  - Enter: fade in + slide from right (opacity 0→1, translateX 2rem→0), 300ms ease-out
  - Leave: fade out + slide right (opacity 1→0, translateX 0→2rem), 200ms ease-in
- Stack downward for multiple notifications
- Click anywhere on card (except X) → navigate to task: `/workspace/projects/${project.id}?task=${task.id}`
  - If no project, just dismiss
- X button → immediate dismiss
- Hover pauses the auto-dismiss timer (restart on mouse leave)

**Accessibility:**
- `role="alert"` on the container
- Semantic structure

### 3. Auto-subscribe in workspace layout

Find where the workspace layout is (`app/layouts/` or `app/pages/workspace/`). After the user is authenticated and WebSocket is connected:

- Get the current workspace ID (check how it's available — likely from a composable, store, or route)
- Call `subscribeWorkspace(workspaceId)` once
- Mount `<AgentActivityToast />` in the layout template (just include it, it teleports to body)

**Important:** Don't subscribe multiple times on navigation. The workspace subscription should persist as long as the user is in the workspace. Use `onMounted` / `onUnmounted` or a flag to track.

### 4. Positioning with existing NotificationToast

The existing `NotificationToast.vue` is also positioned `top-4 right-4`. Agent activity toasts should stack below chat notifications. Options:
- Give agent toasts `top-16` or calculate offset
- OR: combine both into a single notification stream (simpler)
- OR: put agent toasts on the left side (`top-4 left-4`)
- Best option: keep both top-right but agent toasts offset below with `top-20` or use a wrapper that manages both stacks

Use your judgment here — the goal is both notification types visible without overlapping.

## Files to Create/Modify

| File | Action |
|------|--------|
| `app/composables/useWebSocket.ts` | Modify: add workspace subscription + agent activity handling |
| `app/components/ui/AgentActivityToast.vue` | Create: the notification component |
| Workspace layout (find it) | Modify: mount toast + auto-subscribe |

## Testing

After implementation, I can test by running CLI commands:
```bash
clawlab task <id> --status in_progress --progress 50
clawlab subtask <id> "New task" --category Test
clawlab comment <id> "Hello from the CLI"
```

Each should trigger a real-time toast in the browser.

## Notes

- Keep it beautiful — smooth animations, thoughtful colors, clean typography
- The existing `NotificationToast.vue` is a good reference but agent toasts should feel distinct
- Don't break existing chat notification functionality
- Use Tailwind dark mode classes (`dark:`) for dark mode support
- Use the existing `Icon` component from the project for icons (heroicons)
