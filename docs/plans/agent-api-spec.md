# Agent API Specification

## Overview

AI agents are first-class team members in Context. An agent is a regular `User` with `isAgent: true`. They authenticate via API key, see only what they're assigned to, and interact through a dedicated `/api/agents/` REST surface. The same RBAC and permission model applies to agents and humans.

## Data Model Changes

### User model additions

```prisma
model User {
  // ... existing fields ...
  isAgent       Boolean  @default(false)
  apiKeyHash    String?  @unique  // bcrypt hash of API key
  agentProvider String?  // "openclaw", "cursor", "codex", "custom"
}
```

- `isAgent`: Distinguishes agent users from human users. UI shows bot badge.
- `apiKeyHash`: Hashed API key for authentication. Only agents use this.
- `agentProvider`: Optional label for what system powers this agent.

### Item model additions

```prisma
model Item {
  // ... existing fields ...
  agentMode            AgentMode?  // null = not an agent task
  planDocId            String?     // FK to the designated plan document
  acceptedPlanVersion  Int?        // Which DocumentVersion was accepted
}

enum AgentMode {
  PLAN      // Agent should research and create a plan doc
  EXECUTE   // Agent is cleared to do the work
}
```

- `agentMode`: Set when assigning a task to an agent. `null` for non-agent tasks.
  - `PLAN`: Agent creates a plan doc, then waits for human acceptance.
  - `EXECUTE`: Agent is cleared to execute (either after plan acceptance, or set directly by a human for well-defined tasks).
- `planDocId`: Points to the Document that serves as the official plan for this task.
- `acceptedPlanVersion`: The `DocumentVersion.id` (or version number) that was accepted by a human. Records exactly which version was approved.

### Task lifecycle for agents

**Plan mode flow:**
1. Human creates task, assigns to agent, sets `agentMode: PLAN`
2. Agent picks up task, researches, creates a plan Document on the task
3. Agent designates the document as the plan doc (`planDocId` set on task)
4. Human reviews the plan doc:
   - **Accepts**: Sets `acceptedPlanVersion` to the current version, flips `agentMode` to `EXECUTE`
   - **Requests changes**: Adds a comment explaining what to fix. Agent sees the comment and creates a new version of the plan doc. Uses existing `DocumentVersion` system for revisions.
5. Once in `EXECUTE` mode, agent works on the task
6. Agent posts status updates as comments
7. Agent optionally creates a "review" Document summarizing what was accomplished
8. Agent sets task `subStatus` to `"review"` (within `IN_PROGRESS` status), signaling human should review
9. Human reviews: moves to `DONE` or sends back with comments

**Direct execute flow:**
1. Human creates task with description, assigns to agent, sets `agentMode: EXECUTE`
2. No plan required. The task description IS the spec.
3. Agent works, posts status updates as comments
4. Agent sets `subStatus` to `"review"` when complete
5. Human reviews and moves to `DONE` or sends back

## Authentication

### API Key format

Keys are prefixed for easy identification: `ctx_<random_40_chars>`

Example: `ctx_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0`

### Auth flow

1. Request includes `Authorization: Bearer ctx_...` header
2. Middleware hashes the provided key
3. Looks up `User` by `apiKeyHash`
4. If found and `isAgent: true`, request proceeds as that user
5. Standard RBAC applies from there (workspace membership, project assignment, etc.)

### Key management

Admins can manage agent API keys:

```
POST /api/admin/agents/:userId/regenerate-key
```

- Only callable by org admins
- Generates new key, returns plaintext ONCE: `{ apiKey: "ctx_..." }`
- Hashes and stores. Old key immediately invalidated.
- UI: "Regenerate API Key" button on agent's profile in admin panel. Shows key once in a modal with copy button.

## API Endpoints

All under `/api/agents/`. All require `Authorization: Bearer ctx_...` header.

### Projects

```
GET /api/agents/projects
```

Returns projects the agent is assigned to (via `ItemAssignment` on root items where `parentId` is null).

Response:
```json
[
  {
    "id": "clx...",
    "title": "Context",
    "description": "Open-source project management",
    "status": "IN_PROGRESS",
    "progress": 45,
    "taskCount": { "todo": 12, "inProgress": 5, "done": 34 }
  }
]
```

### Tasks

```
GET /api/agents/tasks
```

Query params:
- `projectId` - filter by project
- `status` - filter by ItemStatus (TODO, IN_PROGRESS, etc.)
- `agentMode` - filter by PLAN or EXECUTE
- `subStatus` - filter by subStatus (e.g., "review")

Returns tasks assigned to the authenticated agent.

Response:
```json
[
  {
    "id": "clx...",
    "title": "Implement payment webhooks",
    "description": "Set up Stripe webhook handlers for...",
    "status": "TODO",
    "subStatus": null,
    "agentMode": "EXECUTE",
    "priority": "HIGH",
    "planDocId": null,
    "acceptedPlanVersion": null,
    "parentId": "clx...",
    "projectId": "clx..."
  }
]
```

```
GET /api/agents/tasks/:id
```

Full task detail including subtasks, documents, and recent comments.

Response:
```json
{
  "id": "clx...",
  "title": "Implement payment webhooks",
  "description": "...",
  "status": "IN_PROGRESS",
  "subStatus": null,
  "agentMode": "EXECUTE",
  "planDocId": "clx...",
  "acceptedPlanVersion": 3,
  "parent": { "id": "clx...", "title": "Payments" },
  "project": { "id": "clx...", "title": "Context" },
  "subtasks": [...],
  "documents": [...],
  "comments": [...]  // Last 20, most recent first
}
```

```
PATCH /api/agents/tasks/:id
```

Update task fields the agent is allowed to modify:
- `status`: Can set to `IN_PROGRESS`. Cannot set to `DONE` (humans only).
- `subStatus`: Can set to `"review"` to signal work is complete and needs human review. Can set to `null` to clear.
- `progress`: 0-100

Body:
```json
{
  "status": "IN_PROGRESS",
  "subStatus": "review",
  "progress": 80
}
```

Constraints:
- Agent cannot change `agentMode` (human only)
- Agent cannot set status to `DONE` (human only)
- Agent cannot modify tasks they're not assigned to

### Subtasks

```
POST /api/agents/tasks/:id/subtasks
```

Create a subtask under the given task. Agent is set as **owner** (not just assignee), giving full privileges over the subtask (edit, delete, reassign, create further sub-subtasks). The agent is also auto-assigned.

This is important: a human creates a task and assigns it to an agent, but the human remains owner of that parent task. When the agent breaks it down into subtasks, the agent owns those subtasks. This gives agents autonomy over their own work breakdown while humans retain control over the top-level task.

Body:
```json
{
  "title": "Set up webhook endpoint",
  "description": "Create POST /api/webhooks/stripe handler",
  "priority": "MEDIUM"
}
```

```
DELETE /api/agents/tasks/:id
```

Delete a subtask. Only allowed if the agent is the **owner** of the task. Cannot delete tasks owned by humans. This lets agents manage their own work breakdown freely.

### Comments

```
POST /api/agents/tasks/:id/comments
```

Add a comment. Used for status updates, questions, progress notes.

Body:
```json
{
  "content": "Webhook endpoint is set up. Moving on to event type handling."
}
```

```
GET /api/agents/tasks/:id/comments
```

Query params:
- `limit` (default 20)
- `before` (cursor, comment ID for pagination)

### Documents

```
POST /api/agents/tasks/:id/docs
```

Create a document on the task. Used for plan docs and review docs.

Body:
```json
{
  "title": "Implementation Plan",
  "content": "## Approach\n\n...",
  "setAsPlan": true  // Optional: designates this as the task's plan doc
}
```

If `setAsPlan: true`, sets `item.planDocId` to this document's ID. Only valid when `agentMode` is `PLAN`.

```
PATCH /api/agents/tasks/:id/docs/:docId
```

Update a document. Creates a new `DocumentVersion` automatically (uses existing versioning system).

Body:
```json
{
  "title": "Implementation Plan v2",
  "content": "## Revised Approach\n\n...",
  "versionLabel": "Addressed feedback on error handling",
  "versionType": "MAJOR"
}
```

```
GET /api/agents/tasks/:id/docs
```

List all documents on a task.

```
GET /api/agents/tasks/:id/docs/:docId
```

Get a specific document with its version history.

### Agent status

```
GET /api/agents/me
```

Returns the agent's own profile and current assignments summary.

Response:
```json
{
  "id": "clx...",
  "name": "Harriet",
  "agentProvider": "openclaw",
  "projects": 2,
  "tasks": {
    "plan": 1,
    "execute": 3,
    "review": 1
  }
}
```

## Human-Only Actions (Existing UI)

These are NOT exposed in the agent API. They happen in the regular app UI:

1. **Accept a plan**: Human views plan doc, clicks "Accept Plan"
   - Sets `item.acceptedPlanVersion` to current doc version
   - Flips `item.agentMode` from `PLAN` to `EXECUTE`
   - Creates activity log entry

2. **Request plan changes**: Human adds a comment on the task explaining what to change. Agent sees the comment next time it checks.

3. **Review completed work**: Human sees task in `subStatus: "review"`, reviews the work:
   - Approves: Sets `status: DONE`
   - Sends back: Adds comment, clears `subStatus` to `null`, sets `status` back to `IN_PROGRESS`

4. **Create agent user**: Admin panel, "Add Agent" button.
   - Creates User with `isAgent: true`
   - Generates and displays API key once

5. **Regenerate API key**: Admin panel, agent profile, "Regenerate Key" button.

6. **Assign task to agent**: Same as assigning to any user, but with `agentMode` selector (Plan or Execute).

## Middleware

### Agent auth middleware

File: `server/middleware/agent-auth.ts`

Only applies to `/api/agents/**` routes:

```typescript
// Pseudocode
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/agents')) return

  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ctx_')) {
    throw createError({ statusCode: 401, message: 'Missing or invalid API key' })
  }

  const key = authHeader.slice(7)
  const hash = await bcryptHash(key)
  const user = await prisma.user.findFirst({
    where: { apiKeyHash: hash, isAgent: true }
  })

  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid API key' })
  }

  event.context.agentUser = user
})
```

### Permission checks

Every endpoint verifies the agent is assigned to the task/project they're accessing. Uses existing `ItemAssignment` records. No new permission system needed.

## CLI (Future)

The CLI wraps these endpoints. Not part of this implementation phase.

```bash
context login --token ctx_...       # Store key in ~/.config/context/credentials.json
context tasks list --mine --mode plan
context tasks get TASK-42
context tasks comment TASK-42 "Starting work"
context tasks doc create TASK-42 --title "Plan" --plan --file plan.md
context tasks stage TASK-42 review
context projects list
```

## Migration Checklist

1. Add `isAgent`, `apiKeyHash`, `agentProvider` fields to `User` model
2. Add `agentMode`, `planDocId`, `acceptedPlanVersion` fields to `Item` model
3. Add `AgentMode` enum
4. Run `prisma migrate dev`
5. Create `/server/api/agents/` directory with all endpoints
6. Create `/server/middleware/agent-auth.ts`
7. Add "Accept Plan" / agent mode UI to task detail modal
8. Add agent management section to admin/settings
9. Add bot badge to user avatars where `isAgent: true`
