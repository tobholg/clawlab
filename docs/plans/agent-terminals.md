# Agent Terminals & Work Sessions

## Vision

ClawLab becomes the control plane for multi-agent orchestration. Engineers launch, monitor, and interact with AI coding agents directly from the application. Each agent gets a contextualized terminal session that already knows who it is, what it should work on, and how to communicate back. The cognitive overhead of running 5+ agents simultaneously collapses to a single screen.

## The Problem Today

The best agentic engineers run 5 Codex/Claude Code sessions in parallel. The pain points:

1. **Startup cost per session** - paste context, explain project, explain task, orient the agent
2. **Tracking overhead** - which tab is doing what? Did agent 3 finish? What was agent 1 working on again?
3. **No shared state** - Agent A finishes, Agent B doesn't know. You're the message bus
4. **Lost context on errors** - agent goes off track, you re-explain from scratch
5. **No persistent record** - work sessions vanish when the terminal closes

## The Solution

### Contextualized Agent Terminals

Each terminal session is bound to an agent identity and (optionally) a task. When launched, ClawLab handles orientation automatically:

1. Sets the agent's identity (`CTX_TOKEN`, `CTX_BASE_URL`)
2. Injects a system instruction explaining ClawLab and the clawlab CLI
3. Runs `clawlab catchup` so the agent sees its assignments
4. Agent self-orients and asks the user what to start on

The user has a full interactive terminal (Codex, Claude Code, Aider, any CLI agent) but the agent already knows who it is and what it should be doing.

### Example Flow

1. User assigns "Payment webhooks" to Harriet on the kanban board
2. User clicks "Launch terminal" on the task card
3. Terminal opens in the bottom panel, bootstrap runs:

```bash
export CTX_TOKEN=ctx_<harriet_token>
export CTX_BASE_URL=http://localhost:3001
cd /path/to/project/repo
```

4. Agent CLI starts (e.g., `codex`) with system instruction:

```
You are Harriet, an AI agent working inside OpenClawLab. You have a CLI tool
`clawlab` for managing your tasks. Run `clawlab catchup` to see your assignments.

When you start working on a task: `clawlab checkout <task-id>`
When you need to update progress: `clawlab task <id> --progress N`
When you want to communicate: `clawlab comment <id> "message"`
When you're done: `clawlab submit <id>`

If you need clarification, ask the user in this terminal.
```

5. Agent runs catchup, responds:

```
I can see I've been assigned "Payment webhooks" which is in EXECUTE mode
with an approved plan. Should I get started?
```

6. User: "yes, go"
7. Agent checks out the task, works, updates progress, kanban updates live
8. Agent finishes, submits for review
9. Terminal tab shows green checkmark, user reviews from task detail

### Terminal Tab UI

Each tab displays:

```
[🟢 Harriet · Payment webhooks · 47min]  [🟡 Codex-1 · Auth refactor · 12min]  [✅ Codex-2 · Rate limiting · 1h23m · ⏸]
```

- Agent name + avatar initial
- Task title (clickable -> opens task detail modal)
- Duration since checkout (live counter)
- Status indicator:
  - 🟢 pulsing = actively working
  - ✅ solid green = done, awaiting human review
  - 🟡 = idle, no current task checked out
  - 🔴 = errored or terminated

## Data Model

### AgentSession

Tracks an agent's work session on a task. Analogous to human focus sessions.

```prisma
model AgentSession {
  id             String    @id @default(cuid())
  agentId        String
  itemId         String?
  projectId      String?
  terminalId     String?   @unique

  // Work tracking
  checkedOutAt   DateTime?
  completedAt    DateTime?

  // State
  status         AgentSessionStatus @default(IDLE)

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  agent          User      @relation("AgentSessions", fields: [agentId], references: [id])
  item           Item?     @relation(fields: [itemId], references: [id])

  @@index([agentId])
  @@index([itemId])
  @@index([terminalId])
  @@map("agent_sessions")
}

enum AgentSessionStatus {
  IDLE
  ACTIVE
  AWAITING_REVIEW
  TERMINATED
}
```

### Project Repo Binding

```prisma
// Add to existing Project/Item model:
repoUrl        String?   // e.g., https://github.com/org/repo
repoPath       String?   // Local path, e.g., /Users/me/Projects/acme
defaultBranch  String?   // e.g., main
```

## CLI Commands

### `clawlab checkout <task-id>`

Signals the agent is starting work on a task.

- Creates an AgentSession with `checkedOutAt: now`, `status: ACTIVE`
- Sets task status to IN_PROGRESS if not already
- Updates task `subStatus` to "executing"
- Returns task details (title, description, plan doc if exists)

```
$ clawlab checkout qu117wx6
✓ Checked out: Payment webhooks
  Mode:     EXECUTE
  Plan:     CI/CD Pipeline Plan (spnmdno3)
  Subtasks: 3 (1 done, 1 in progress, 1 todo)
```

### `clawlab submit <task-id>`

Signals the agent has completed work and is requesting review.

- Sets AgentSession `completedAt: now`, `status: AWAITING_REVIEW`
- Sets task `subStatus` to "review"
- Auto-sets progress to 90% (human approval = final 10%)
- Notifies the user via toast/notification

```
$ clawlab submit qu117wx6
✓ Submitted for review: Payment webhooks
  Duration:  1h 23min
  Progress:  90% (awaiting human approval)
```

### `clawlab status` (agent self-status)

Shows the agent's current session state.

```
$ clawlab status
  Agent:    Harriet
  Session:  active since 47min ago
  Task:     Payment webhooks (qu117wx6)
  Mode:     EXECUTE
  Progress: 65%
```

## Terminal Backend Architecture

### Server-Side PTY

- Use `node-pty` to spawn pseudo-terminal processes on the server
- Stream PTY output to frontend via WebSocket
- Render with `xterm.js` in the browser
- For self-hosted: runs on the user's machine, minimal security concern
- Session persists if browser disconnects (reconnect to existing PTY)

### Bootstrap Sequence

When launching a terminal session, ClawLab runs a bootstrap before handing control to the agent CLI:

```typescript
// 1. Create agent session record
const session = await createAgentSession(agentId, taskId, projectId)

// 2. Spawn PTY
const pty = spawn('zsh', [], {
  cwd: project.repoPath || process.cwd(),
  env: {
    ...process.env,
    CTX_TOKEN: agent.apiToken,
    CTX_BASE_URL: serverUrl,
    CTX_AGENT_SESSION: session.id,
  }
})

// 3. Bootstrap commands (run before agent CLI)
pty.write('clawlab catchup\n')

// 4. Launch agent CLI with system instruction
pty.write(`codex --system-prompt "${systemInstruction}"\n`)
// or: claude --system-prompt "..."
// or: aider --message "..."
```

### Agent Runner Configuration

Per-project or global setting:

```json
{
  "agentRunner": "codex",
  "agentRunnerArgs": ["--model", "gpt-5.3-codex"],
  "systemInstruction": "..." // Template with {{task}}, {{agent}} variables
}
```

## Focus Tracking Integration

Agent sessions feed into the same focus tracking system as human sessions.

### Activity Heatmap

The existing activity tracker heatmap shows agent work alongside human work:
- Human squares: colored by focus type (deep work, meetings, etc.)
- Agent squares: colored by agent (amber = Harriet, emerald = Codex, etc.)

### Metrics

- Total agent hours per day/week
- Average task completion time by agent
- Agent utilization rate (active time / available time)
- Leverage ratio: agent hours / human hours

This visualization answers: "My team of 3 agents put in 14 hours of work today while I was in 2 hours of meetings." That's the leverage story.

## Dependency-Aware Coordination

When tasks have dependencies (`blockedBy`), the system coordinates automatically:

1. Agent B's task is blocked by Agent A's task
2. Agent B's catchup shows: "⏳ BLOCKED — waiting on 'Auth refactor' by Codex-1"
3. Agent A completes and submits for review
4. Human approves Agent A's work
5. Agent B's blocker clears automatically
6. If Agent B has an active terminal, it receives a system event: "Your blocker 'Auth refactor' has been resolved. Run `clawlab catchup` to continue."
7. Agent B's terminal tab changes from ⏳ to 🟢

No human dispatch required for the handoff.

## Conflict Detection (Future)

Track which files each task/agent touches:

- On `clawlab checkout`, agent declares target files/modules (or ClawLab infers from task description)
- On commit, ClawLab records changed files per session
- If two active sessions touch overlapping files, warn the user:
  "⚠️ Harriet (webhooks) and Codex-1 (auth) are both modifying server/utils/auth.ts"

## UI Layout

### Primary View: Board + Terminals

```
┌──────────────────────────────────────────────────────────┐
│  Sidebar  │  Kanban Board                                │
│           │  ┌────────┐ ┌────────┐ ┌────────┐           │
│  Projects │  │  TODO   │ │IN PROG │ │  DONE  │           │
│  Agents   │  │        │ │ 🟢 65% │ │  ✓     │           │
│  ...      │  │        │ │ 🟢 12% │ │        │           │
│           │  └────────┘ └────────┘ └────────┘           │
│           ├──────────────────────────────────────────────┤
│           │  Terminal Panel                               │
│           │  [🟢 Harriet·webhooks·47m] [🟡 Codex-1·auth] │
│           │                                              │
│           │  $ clawlab checkout qu117wx6                      │
│           │  ✓ Checked out: Payment webhooks              │
│           │  ...                                         │
│           │                                              │
└──────────────────────────────────────────────────────────┘
```

The terminal panel is resizable (like VS Code's terminal). Tabs for each active agent session. Click a tab to focus that terminal. Click the task title in the tab to open the task detail modal.

### Agent Management in Sidebar

The sidebar's "Agents" section shows all configured agents with their current state:
- Harriet 🟢 working on "Payment webhooks" (47min)
- Codex-1 🟡 idle
- Codex-2 ✅ "Rate limiting" awaiting review

Right-click an agent to: Launch terminal, View sessions, Configure.

## Implementation Phases

### Phase 1: Foundation
- [ ] AgentSession model + migration
- [ ] Project `repoPath` / `repoUrl` fields
- [ ] `clawlab checkout` and `clawlab submit` CLI commands
- [ ] AgentSession API endpoints (create, update, list, current)
- [ ] Update catchup to show checked-out state

### Phase 2: Terminal
- [ ] xterm.js terminal component
- [ ] Server-side PTY manager (node-pty + WebSocket bridge)
- [ ] Bootstrap sequence (env vars, catchup, agent CLI launch)
- [ ] Terminal panel in app layout (tabbed, resizable)
- [ ] Session reconnect on page reload

### Phase 3: Integration
- [ ] Task card shows active agent terminal indicator
- [ ] Live progress sync (CLI updates -> kanban updates via WebSocket)
- [ ] Terminal tab shows task title, duration, status dot
- [ ] Click task title in tab -> open task detail modal
- [ ] Agent session history in task detail (who worked on it, for how long)
- [ ] Focus tracking integration (agent sessions on activity heatmap)

### Phase 4: Multi-Agent Coordination
- [ ] Dependency-aware blocking/unblocking with terminal notifications
- [ ] Conflict detection (overlapping file changes)
- [ ] Agent-to-agent task handoff
- [ ] Dashboard: all agents at a glance with utilization metrics
- [ ] Auto-branch creation per task

### Phase 5: Polish
- [ ] Agent runner configuration UI (select Codex/Claude/Aider per project)
- [ ] Custom system instruction templates
- [ ] Session recording/playback (review what an agent did)
- [ ] Auto-hibernate idle sessions
- [ ] Token auto-provisioning on agent creation

## Key Design Decisions

1. **Agent-runtime agnostic**: ClawLab doesn't integrate deeply with any agent framework. It spawns a process, injects context via env vars and system prompt, communicates via the clawlab CLI. Works with any agent that can run shell commands.

2. **Server-side PTY**: Terminal sessions run on the server (user's machine for self-hosted). Sessions persist across browser disconnects. This is correct for the self-hosted use case where security is not a concern.

3. **Checkout/submit over status overloading**: Explicit `clawlab checkout` and `clawlab submit` commands are clearer than inferring work sessions from status changes. They create clean timestamp boundaries for focus tracking.

4. **Focus tracking parity**: Agent work sessions use the same model as human focus sessions. This enables apples-to-apples comparison of human vs agent contribution, which is the leverage story.

5. **Terminal tab = task binding**: Each terminal tab is visually and semantically bound to a task. This is the key UX insight that makes 5 simultaneous agents manageable. You never lose track of which agent is doing what.

6. **Interactive, not fire-and-forget**: The terminal is a full interactive session. You can intervene, redirect, ask questions. This is fundamentally different from background job runners. The agent is your collaborator, not your worker.
