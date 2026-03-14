# Git Integration — Commit Tracking & Diff Stats

## Overview

Connect agent (and human) work to git commits. When an agent checks out a task and makes commits, those commits are automatically linked to the task. The task detail modal shows commit history with diff stats, giving full visibility into what changed.

## Schema Changes

### 1. Add `COMPLETED` to `AgentMode` enum

```prisma
enum AgentMode {
  PLAN
  EXECUTE
  COMPLETED
}
```

This gives agent workflow four clear states: `null` -> `PLAN` -> `EXECUTE` -> `COMPLETED`.

### 2. New `Commit` model

```prisma
model Commit {
  id           String        @id @default(cuid())
  sha          String
  message      String
  branch       String?
  filesChanged Int           @default(0)
  insertions   Int           @default(0)
  deletions    Int           @default(0)
  diffSummary  Json?         // [{file, insertions, deletions, status}]
  itemId       String
  item         Item          @relation(fields: [itemId], references: [id], onDelete: Cascade)
  sessionId    String?
  session      AgentSession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  authorId     String
  author       User          @relation(fields: [authorId], references: [id])
  createdAt    DateTime      @default(now())

  @@index([itemId])
  @@index([authorId])
  @@unique([sha, itemId])
  @@map("commits")
}
```

### 3. Add relations to existing models

On `Item`:
```prisma
commits Commit[]
```

On `AgentSession`:
```prisma
commits Commit[]
```

On `User`:
```prisma
commits Commit[]
```

### 4. Migration

Single migration: `20260221000000_add_commits`

Add `COMPLETED` value to `AgentMode` enum. Create `commits` table with indexes.

## Git Hook: Auto-Linking Commits

### `clawlab init-hooks`

New CLI command. Installs a `post-commit` git hook in the current repo:

```bash
#!/bin/sh
# clawlab commit hook
SHA=$(git rev-parse HEAD)
clawlab commit --sha "$SHA" 2>/dev/null || true
```

The hook:
- Runs after every `git commit`
- Calls the `clawlab commit` CLI command with the new SHA
- Fails silently (`|| true`) so it never blocks git workflow
- Works for both agents and humans (anyone with a `clawlab` session)

If a `.git/hooks/post-commit` already exists, append the clawlab line rather than overwriting. Print a warning if appending.

### `clawlab commit --sha <sha>`

New CLI command. Links a commit to the currently checked-out task.

Flow:
1. Read agent auth token from env (`CTX_API_TOKEN`) or config
2. Call `POST /api/agents/commits` with `{ sha }`
3. Server resolves the active session and linked task
4. Server extracts commit metadata and diff stats from the repo
5. Creates the `Commit` record
6. Returns summary: `Linked abc1234 to "Fix auth bug" (+89 -12, 3 files)`

Manual mode: `clawlab commit --sha <sha> --task <taskId>` to retroactively link a commit to a specific task (bypasses active session lookup).

## API Endpoints

### `POST /api/agents/commits`

Auth: agent bearer token (requireAgentUser).

Body:
```json
{
  "sha": "abc1234def5678",
  "taskId": "optional-override"
}
```

Logic:
1. If `taskId` provided, use it (verify agent is assigned). Otherwise, find the agent's active session and use its `itemId`.
2. Resolve repo path: walk up from task -> parent -> project root, use first `repoPath` found. Error if none configured.
3. Run git commands on the repo path to extract metadata:
   - `git log -1 --format='%H%n%s%n%an%n%aI' <sha>` -> full sha, message, author, date
   - `git diff --numstat <sha>^..<sha>` -> per-file insertions/deletions
   - `git rev-parse --abbrev-ref HEAD` -> branch name
4. Create `Commit` record with all extracted data.
5. Return the created commit.

Error cases:
- No active session and no taskId: 400
- Repo path not configured: 400 with message "No repository configured for this task. Set repoPath on the task or a parent item."
- SHA not found in repo: 404
- Duplicate sha+itemId: 409 (already linked)

### `GET /api/items/:id/commits`

Auth: session auth (requireUser) or agent bearer.

Returns all commits linked to the given item, newest first:
```json
{
  "commits": [
    {
      "id": "cuid",
      "sha": "abc1234",
      "shortSha": "abc1234",
      "message": "fix: rate limiting middleware",
      "branch": "feat/rate-limiting",
      "filesChanged": 3,
      "insertions": 89,
      "deletions": 12,
      "diffSummary": [
        { "file": "server/middleware/rateLimit.ts", "insertions": 67, "deletions": 0, "status": "added" },
        { "file": "server/api/auth/login.post.ts", "insertions": 12, "deletions": 8, "status": "modified" },
        { "file": "tests/rateLimit.test.ts", "insertions": 10, "deletions": 4, "status": "modified" }
      ],
      "author": { "id": "...", "name": "Codex One", "isAgent": true },
      "createdAt": "2026-02-21T..."
    }
  ]
}
```

## Repo Path Resolution

When a task needs repo context, walk up the item hierarchy:

1. Check the task's own `repoPath`
2. Check `parentId` -> parent's `repoPath`
3. Continue up the chain until root (parentId = null)
4. The root item IS the project, so this covers project-level config too
5. First non-null `repoPath` wins

This means:
- Set `repoPath` once on the project, all tasks inherit it
- Override on any subtask for microservices, monorepo subdirs, etc.
- `repoUrl` is for display/linking (e.g., GitHub URL), `repoPath` is the local filesystem path used for git operations

## Submit Flow Update

When an agent runs `clawlab submit`:

1. Session status -> `AWAITING_REVIEW` (unchanged)
2. Task `agentMode` -> `COMPLETED` (NEW)
3. Task `subStatus` -> `review`, `progress` -> 90% (unchanged)

## UI Changes

### 1. Repository Config in Item Detail Panel

Add a "Repository" section in the sidebar metadata area of `ItemDetailPanel.vue`, below the existing fields (assignee, status, dates, etc.):

```
Repository
[/Users/recursion/Projects/relai          ] <- repoPath input
[main                                      ] <- branch input
[https://github.com/clawlab/context       ] <- repoUrl input (optional)
```

- Only show for items that have agent assignees OR for root project items
- Editable inline (same pattern as other metadata fields)
- PATCH `/api/items/:id` already supports these fields

### 2. Agent Workflow Box Updates

In the Agent Workflow section of `ItemDetailPanel.vue`:

**Add COMPLETED state:**

The agent mode dropdown gets a fourth option:
```
{ value: 'COMPLETED', label: 'Completed', color: 'bg-emerald-500', icon: 'heroicons:check-circle' }
```

**COMPLETED state banner** (similar to EXECUTE banner):
```html
<div class="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2">
  <Icon name="heroicons:check-circle" class="w-4 h-4 text-emerald-500" />
  <span class="text-sm text-emerald-700 dark:text-emerald-300">Completed - awaiting review</span>
</div>
```

**Commits subsection** (below the plan/execution state, visible when commits exist):

Show a list of linked commits:
- Each commit: short SHA (monospace, zinc-500), commit message, relative time
- Diff stat: `+89 -12` green/red text, file count
- Click to expand per-file breakdown
- Per-file row: filename (monospace), individual +/- stats, status badge (added/modified/deleted)

Fetch commits from `GET /api/items/:id/commits` when the panel loads (or lazily when Agent Workflow section is visible).

### 3. Kanban Card Indicator

On `ItemCard.vue`, if a task has commits linked, show a small git icon or commit count badge (similar to attachment count). Low priority, can be done later.

## CLI Summary

New commands:
- `clawlab commit --sha <sha> [--task <taskId>]` - Link a commit to a task
- `clawlab init-hooks` - Install post-commit git hook in current repo

Updated commands:
- `clawlab submit` - Now sets agentMode to COMPLETED

## Server Utility

Create `server/utils/gitOps.ts`:

```typescript
// resolveRepoPath(itemId: string): Promise<string>
// Walks up item hierarchy to find first non-null repoPath

// getCommitInfo(repoPath: string, sha: string): Promise<CommitInfo>
// Runs git commands to extract commit metadata and diff stats

// installHook(repoPath: string): void
// Writes post-commit hook (used by clawlab init-hooks if we add a server-side version)
```

## Implementation Order

1. Schema: Add COMPLETED to enum, create Commit model, add relations, generate migration
2. Server: `gitOps.ts` utility (repo resolution + git command execution)
3. API: `POST /api/agents/commits`, `GET /api/items/:id/commits`
4. CLI: `clawlab commit`, `clawlab init-hooks`, update `clawlab submit` to set COMPLETED
5. UI: Repository config fields in ItemDetailPanel sidebar
6. UI: COMPLETED state in Agent Workflow (dropdown option + banner)
7. UI: Commits subsection in Agent Workflow box

## Future (Not in This Spec)

- Inline diff viewer modal (click a file -> syntax-highlighted diff)
- Branch creation / PR linking
- `git status` warning on submit (uncommitted changes)
- Commit stats aggregation on team page (velocity metrics)
- Kanban card commit indicators
