# Agent API v2 Improvements

## 1. Expand Task PATCH Endpoint

**File:** `server/api/agents/tasks/[id].patch.ts`

Currently only allows: `status`, `subStatus`, `progress`

Add these writable fields (for agent-owned tasks only — where agent is the assignee):
- `title` (string)
- `description` (string, markdown)
- `category` (string, free-form — maps to `category` column on Item)
- `priority` (enum: LOW, MEDIUM, HIGH, URGENT)

**Guard:** For tasks the agent doesn't own (assigned by human), keep the current restricted set. For agent-created subtasks (where `assigneeId === agent.id` AND the task was created by the agent), allow the expanded fields.

Simplification: since we can't easily track "created by agent" right now, use ownership heuristic: if the task's `assigneeId` matches the authenticated agent AND the task has a `parentId` (it's a subtask), allow expanded fields. Top-level tasks assigned by humans stay restricted.

**Validation:**
- `title`: string, 1-200 chars
- `description`: string, max 10000 chars  
- `category`: string, max 100 chars
- `priority`: must be one of the enum values

## 2. Restructure Discovery Endpoint

**File:** `server/api/agents/index.get.ts`

Current behavior: dumps ALL endpoint schemas in one giant response. This is wasteful — agents should discover what's available, then fetch details for what they need.

### New behavior:

**`GET /api/agents/`** — Returns lightweight action list:
```json
{
  "name": "Context Agent API",
  "version": "1.0",
  "baseUrl": "/api/agents",
  "endpoints": [
    {
      "id": "me",
      "method": "GET",
      "path": "/api/agents/me",
      "description": "Agent profile and assignment summary",
      "auth": true
    },
    {
      "id": "tasks-list",
      "method": "GET", 
      "path": "/api/agents/tasks",
      "description": "List tasks assigned to the authenticated agent with optional filters",
      "auth": true
    }
    // ... etc, one-liners only, NO schemas
  ]
}
```

**`GET /api/agents/index/:endpointId`** — Returns full schema for one endpoint:

New file: `server/api/agents/index/[endpointId].get.ts`

```json
{
  "id": "tasks-update",
  "method": "PATCH",
  "path": "/api/agents/tasks/:id",
  "description": "Update allowed task fields...",
  "auth": true,
  "params": { ... },
  "response": { ... }
}
```

### Endpoint IDs (derive from current):
- `me` — GET /api/agents/me
- `projects` — GET /api/agents/projects
- `tasks-list` — GET /api/agents/tasks
- `tasks-get` — GET /api/agents/tasks/:id
- `tasks-update` — PATCH /api/agents/tasks/:id
- `tasks-delete` — DELETE /api/agents/tasks/:id
- `subtasks-create` — POST /api/agents/tasks/:id/subtasks
- `comments-list` — GET /api/agents/tasks/:id/comments
- `comments-create` — POST /api/agents/tasks/:id/comments
- `docs-list` — GET /api/agents/tasks/:id/docs
- `docs-create` — POST /api/agents/tasks/:id/docs
- `docs-get` — GET /api/agents/tasks/:id/docs/:docId
- `docs-update` — PATCH /api/agents/tasks/:id/docs/:docId

If an invalid `endpointId` is requested, return 404 with `{ "error": "Unknown endpoint", "available": ["me", "projects", ...] }`.

## 3. Also expand subtask creation

**File:** `server/api/agents/tasks/[id]/subtasks.post.ts`

Make sure the POST body accepts:
- `title` (required)
- `description` (string, markdown)
- `category` (string)
- `priority` (enum, default MEDIUM)

These should already be mostly there but verify description and category are included.

## Implementation Notes

- Category is a free-form `String?` on the Item model (prisma schema) — no enum, no separate table
- Priority is an enum: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- Keep the existing discovery endpoint working during transition (don't break agents mid-session)
- No auth required on `GET /api/agents/` or `GET /api/agents/index/:endpointId` (discovery should be unauthenticated)
