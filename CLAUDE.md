# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Context is a multi-stakeholder project management SaaS with AI-powered insights, seat-based licensing, and an external stakeholder portal. Built with Nuxt 4 (Vue 3), Nitro backend, PostgreSQL/Prisma, and Tailwind CSS v4.

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run db:push    # Sync Prisma schema to database
npm run db:reset   # Reset database (force-reset, no seed)
npx prisma studio  # Visual database browser
```

Note: There is no `db:seed` script. Demo seeding logic lives in `server/utils/seedDemoData.ts`. No test framework is configured.

## Architecture

### Core Data Model: Recursive Items

The `Item` model is the heart of the system - it supports infinite nesting for projects, tasks, and subtasks through self-referencing `parentId`. Key fields:
- **status**: TODO, IN_PROGRESS, BLOCKED, PAUSED, DONE
- **temperature**: cold, warm, hot, critical (deadline-based urgency, calculated in `server/utils/temperature.ts`)
- **progress/confidence**: 0-100 values for tracking and AI estimation
- **ownerId + ItemAssignment + ItemStakeholder**: Multi-stakeholder visibility model

### Organization Hierarchy

Organization → Workspace → Items. Each Organization has a `PlanTier` (FREE, PRO, ENTERPRISE) that governs limits. Workspaces scope items, channels, and members.

### Seat-Based Licensing System

Seats are actual DB rows (`Seat` model) per Organization, not a simple counter. Key files:
- `server/utils/seats.ts` — provisionDefaultSeats, findAvailableSeat, checkUserAlreadySeated, expireStaleInvites
- `server/utils/planLimits.ts` — central place for seat/project/AI credit limit checks
- `server/api/seats/` — REST endpoints for seat management, purchase, invites

Invite flow: `POST /api/seats/invite` creates `SeatInvite` + marks seat INVITED → user accepts at `/api/seats/invites/[token]/accept`. If user is already seated in the org, they get added directly without consuming a new seat.

### External Stakeholder Portal

External stakeholders access projects via `ExternalSpace` at `/s/[spaceId]/[spaceSlug]`. Spaces have inbound queues for information requests and external tasks. **Important**: `ExternalSpace.slug` is unique per-project (`@@unique([projectId, slug])`), NOT globally unique — always disambiguate by `spaceId`, never query by slug alone.

### Frontend State Management

No Pinia/Vuex — state is managed through composables in `app/composables/`. Key composables beyond basic CRUD:
- `useOrganization.ts` / `useWorkspaces.ts` — org and workspace state
- `useSeats.ts` — seat management
- `useQuickChat.ts` / `useStakeholderChat.ts` — AI chat interfaces
- `useMyTasks.ts` — cross-project task aggregation
- `useFocus.ts` — focus session time tracking (lanes: GENERAL, MEETING, ADMIN, LEARNING, BREAK)
- `useWebSocket.ts` — real-time connection and subscriptions

### Real-time System

WebSocket support via Nitro experimental websocket (`server/routes/_ws.ts`). Peer connections tracked per channel. Broadcasts for presence, typing indicators, messages.

### API Structure

RESTful endpoints in `server/api/` organized by resource (~19 directories):
- `/api/auth/` — Magic link authentication (passwordless, JWT in cookie)
- `/api/items/` — Recursive item CRUD, assignees, comments, AI creation
- `/api/projects/`, `/api/tasks/` — Specialized item endpoints
- `/api/channels/`, `/api/messages/` — Communication with AI chat support
- `/api/documents/` — Document CRUD with versioning and markdown import/export
- `/api/focus/` — Time tracking sessions (project, task, lane, history, team)
- `/api/seats/` — Seat management and invites
- `/api/organizations/`, `/api/workspaces/` — Org/workspace management
- `/api/s/` — External stakeholder portal endpoints

### Authentication & Authorization

Magic link based (no passwords):
1. User requests link via `/api/auth/magic-link.post.ts`
2. Token verified via `/api/auth/verify.get.ts`
3. JWT session created, stored in cookie
4. `useAuth` composable manages client state

Auth helpers in `server/utils/auth.ts`: `requireUser`, `requireWorkspaceMember(event, workspaceId)`, `requireWorkspaceMemberForItem(event, itemId)`, `requireWorkspaceMemberForChannel(event, channelId)`. All verify ACTIVE `WorkspaceMember` status. Most API endpoints use these helpers.

### Database Schema

30 Prisma models in `prisma/schema.prisma`. Key relationships:
- Organization → Workspace → Items (hierarchy)
- Organization → Seat / SeatInvite (licensing)
- Item → Item (recursive parent-child via parentId)
- Item → ItemDependency (blocking relationships)
- Item → Document → DocumentVersion (versioned docs)
- Channel → Message → Reaction (communication)
- ExternalSpace → InformationRequest / ExternalTask / SpaceUpdate (stakeholder portal)
- User → FocusSession, UserMonthlyUsage (tracking)

### Layouts & Middleware

Two layouts: `default.vue` (public pages) and `workspace.vue` (authenticated workspace with sidebar). Two client middleware: `auth.ts` (requires login) and `guest.ts` (redirects if logged in).

## Key Patterns

### Prisma Compound Key Gotcha

`findUnique` with a compound key (e.g. `workspaceId_userId`) cannot add extra `where` filters. Query by compound key first, then check additional fields in JS:
```ts
const membership = await prisma.workspaceMember.findUnique({
  where: { workspaceId_userId: { workspaceId, userId } }
})
if (!membership || membership.status !== 'ACTIVE') throw ...
```

### Member Status Filtering

`WorkspaceMember` and `OrganizationMember` have a `status` field (ACTIVE/DEACTIVATED). Always add `status: 'ACTIVE'` to `findMany` queries and include `status` in any `select` clause that also checks status.

### AI Features

Three AI endpoints with different credit costs:
- `/api/items/ai-create` (20 credits) — AI-powered item creation
- `/api/chat/` (7 credits) — Quick chat
- `/api/channels/[id]/ai` (30 credits) — Channel AI assistant

Credit limits per plan: FREE=100/user/mo, PRO=10,000/user/mo, ENTERPRISE=unlimited. AI input max: 8192 chars. AI config via `OPENAI_API_KEY`, `OPENAI_MODEL` (default: gpt-5-mini), `OPENAI_BASE_URL` env vars.

### Input Validation Limits

Title: 255 chars, Description: 10,000 chars, Comment/Message: 5,000 chars, Channel name: 80 chars, Channel description: 500 chars, Document title: 255 chars, Documents per item: 25 max. FREE tier cannot create CUSTOM channels.

### Activity Logging

All item changes create Activity records for audit trail. Types: CREATED, UPDATED, STATUS_CHANGE, PROGRESS_UPDATE, ASSIGNMENT, COMMENT, DEPENDENCY_ADDED, DEPENDENCY_REMOVED.

### Nuxt Component Auto-Import Naming

Nuxt deduplicates directory prefix from component filenames: `components/workspace/WorkspaceSwitcher.vue` → `<WorkspaceSwitcher>` (not `WorkspaceWorkspaceSwitcher`). But `components/workspace/CreateWorkspaceModal.vue` → `<WorkspaceCreateWorkspaceModal>` (no dedup because `Create` ≠ `Workspace`). Check `.nuxt/components.d.ts` to verify registered names.

## UI Guidelines

See `AGENTS.md` for icon/text alignment guardrails. Key rule: use fixed square `inline-flex` wrappers with `items-center justify-center leading-none` for icon buttons next to text. Prefer `w-3.5 h-3.5` icons inside `h-5 w-5` wrappers.

### Tailwind Theme

Custom design tokens in `tailwind.config.ts`: `ctx-*` brand palette, `dm-*` dark mode surface/card colors, temperature colors (hot, warm, cold, stale). Fonts: Inter (sans), JetBrains Mono (mono). Dynamic color safelist for status/risk badges.

## Environment Variables

See `.env.example`:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Minimum 32 characters
- `APP_URL` — Application URL (default: http://localhost:3000)
- `OPENAI_API_KEY` — AI features
- `OPENAI_MODEL` — AI model (default: gpt-5-mini)
- `POSTMARK_API_TOKEN` — Transactional email via Postmark
