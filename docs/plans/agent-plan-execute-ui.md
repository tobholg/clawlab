# Agent Plan/Execute UI

## Overview

Add UI for the agent plan/execute lifecycle to the task detail modal and task cards. Agents can be assigned to tasks in PLAN or EXECUTE mode. In PLAN mode, the agent writes a plan document which the human reviews before the agent starts executing.

## Database Fields (already exist)

On the `Item` model:
- `agentMode: AgentMode?` — enum: `PLAN`, `EXECUTE`, or null (not an agent task)
- `planDocId: String?` — references a `Document` attached to the task
- `acceptedPlanVersion: Int?` — which version of the plan doc was accepted

On the `User` model:
- `isAgent: Boolean` — true for agent users

## API (already working)

- `PATCH /api/items/[id]` — accepts `agentMode` (PLAN/EXECUTE/null) and `acceptedPlanVersion` (positive int or null)
- `GET /api/agents/tasks/[id]/docs` — list docs on a task
- `POST /api/agents/tasks/[id]/docs` — create doc with `setAsPlan: true`
- `PATCH /api/agents/tasks/[id]/docs/[docId]` — update doc with versioning

## What to Build

### 1. Task Detail Modal — Agent Section

**Location:** The task detail modal component (find where task details are rendered with title, description, status, assignees, etc.)

**When to show:** When any assignee on the task has `isAgent: true`

**Agent Mode Selector:**
- Dropdown or segmented control: `Planning` / `Executing` / `None`
- Maps to `agentMode`: PLAN, EXECUTE, null
- Calls `PATCH /api/items/[id]` with `{ agentMode: value }`
- Only visible/editable by human users (not in the agent API)

**Plan Review Panel (visible when `agentMode === 'PLAN'` and task has a plan doc):**

```
┌─────────────────────────────────────────────┐
│ 📋 Agent Plan                    v3 (latest)│
│─────────────────────────────────────────────│
│                                             │
│  [Rendered markdown of plan document]       │
│                                             │
│─────────────────────────────────────────────│
│  ✅ Accept Plan    ✏️ Request Changes       │
└─────────────────────────────────────────────┘
```

- Fetch the plan document: the task's `planDocId` references a document. Load it via the existing document API.
- Render the document `content` as markdown
- Show version number in the header
- **Accept Plan** button:
  1. `PATCH /api/items/[id]` with `{ acceptedPlanVersion: <current version number>, agentMode: 'EXECUTE' }`
  2. Optimistically update UI: hide plan review, show "Executing plan (v{N})" badge
- **Request Changes** button:
  1. Opens a comment input/textarea inline or as a modal
  2. On submit, posts comment to `POST /api/items/[id]/comments` (the regular human comments endpoint)
  3. The agent will see this comment and revise the plan

**Executing State (visible when `agentMode === 'EXECUTE'`):**
- Show a subtle banner: "⚡ Agent executing plan (v{acceptedPlanVersion})"
- Link to view the accepted plan doc
- No special controls needed — the normal task progress/subtasks view handles this

**No Plan Yet State (visible when `agentMode === 'PLAN'` and no `planDocId`):**
- Show: "⏳ Waiting for agent to submit a plan"
- No actions available yet

### 2. Task Cards — Agent Badges

**Location:** Task card components used in kanban, list view, etc.

Add a small badge/chip to task cards when `agentMode` is set:

| State | Badge |
|-------|-------|
| `agentMode === 'PLAN'` && no `planDocId` | `⏳ Awaiting Plan` (gray) |
| `agentMode === 'PLAN'` && has `planDocId` | `📋 Plan Ready` (amber/yellow) |
| `agentMode === 'EXECUTE'` | `⚡ Executing` (blue) |
| `agentMode === null` | No badge |

The badge should be small, positioned near the assignee avatar or status indicator. Use the existing badge/chip component style if one exists.

### 3. Task Assignment — Default Mode

**Location:** Wherever assignees are selected for a task (task creation form, assignee picker in task modal)

When an agent user is selected as assignee:
- Auto-set `agentMode` to `PLAN` (default)
- Show a small toggle/option: "Skip planning → Execute directly"
- If toggled, set `agentMode` to `EXECUTE` instead

When a human user is selected (or agent is removed):
- Set `agentMode` to null

### 4. Data Fetching

The task detail and task list endpoints need to include `agentMode`, `planDocId`, and `acceptedPlanVersion` in their responses. Check these endpoints and add the fields if missing:

- `GET /api/items/[id]` — task detail
- `GET /api/items` or whatever the task list endpoint is
- Any kanban/board data endpoints

Also need to include `isAgent` on assignee user objects so the UI can detect agent assignees.

## Design Notes

- Use the existing design system (Tailwind, existing component patterns)
- The plan review panel should feel like a document reader, not a code editor
- Use an existing markdown renderer if one is in the project (check for `@nuxtjs/mdc`, `markdown-it`, or similar)
- Keep the agent section collapsed/hidden for tasks with no agent assignee — don't add visual noise to normal tasks
- The amber/yellow "Plan Ready" badge is the most important visual cue — it tells the human "you need to review something"

## Files to Check

- Task detail modal component
- Task card component (kanban + list views)
- Task creation/edit form
- Assignee picker component
- Item API endpoints (GET) for missing fields
- Any composables/stores that fetch task data

## Testing

1. Assign Harriet (agent) to a task → should see mode selector default to PLAN
2. Agent creates a plan doc via CLI/API → "Plan Ready" badge appears, plan renders in modal
3. Human clicks "Accept Plan" → mode flips to EXECUTE, badge changes
4. Human clicks "Request Changes" → comment posted, agent can see it
5. Remove agent assignee → agentMode resets to null, badges gone
