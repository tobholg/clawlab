# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Context is a multi-stakeholder project management SaaS with AI-powered insights. Built with Nuxt 4 (Vue 3), Nitro backend, PostgreSQL/Prisma, and Tailwind CSS v4.

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run db:push    # Sync Prisma schema to database
npm run db:seed    # Populate demo data
npm run db:reset   # Reset and reseed database
```

## Architecture

### Core Data Model: Recursive Items

The `Item` model is the heart of the system - it supports infinite nesting for projects, tasks, and subtasks through self-referencing `parentId`. Key fields:
- **status**: TODO, IN_PROGRESS, BLOCKED, PAUSED, DONE
- **temperature**: cold, warm, hot, critical (visual priority)
- **progress/confidence**: 0-100 values for tracking and AI estimation
- **ownerId + ItemAssignment + ItemStakeholder**: Multi-stakeholder visibility model

### Frontend State Management

No Pinia/Vuex - state is managed through composables in `app/composables/`:
- `useAuth.ts` - Authentication state and session
- `useItems.ts` - Item CRUD and hierarchy operations
- `useProjects.ts` - Project-level operations (items with no parent)
- `useTasks.ts` - Task operations within projects
- `useFocus.ts` - Focus session time tracking
- `useChannels.ts` - Channel tree and messaging
- `useWebSocket.ts` - Real-time connection and subscriptions

### Real-time System

WebSocket support via Nitro experimental websocket (`server/routes/_ws.ts`):
- Peer connections tracked per channel
- Broadcasts for presence, typing indicators, messages
- Client subscribes via `useWebSocket` composable

### API Structure

RESTful endpoints in `server/api/` organized by resource:
- `/api/auth/` - Magic link authentication (passwordless)
- `/api/items/` - Recursive item CRUD
- `/api/projects/`, `/api/tasks/` - Specialized item endpoints
- `/api/channels/`, `/api/messages/` - Communication
- `/api/focus/` - Time tracking sessions

### Authentication Flow

Magic link based (no passwords):
1. User requests link via `/api/auth/magic-link.post.ts`
2. Token verified via `/api/auth/verify.get.ts`
3. JWT session created, stored in cookie
4. `useAuth` composable manages client state

### Database Schema

27 Prisma models in `prisma/schema.prisma`. Key relationships:
- Organization → Workspace → Items (hierarchy)
- Item → Item (recursive parent-child)
- Item → ItemDependency (blocking relationships)
- Channel → Message → Reaction (communication)
- User → FocusSession (time tracking with lanes: GENERAL, MEETING, ADMIN, LEARNING, BREAK)

## Key Patterns

### Temperature Calculation

Temperature indicates item urgency based on deadline proximity. Logic in `server/utils/temperature.ts`.

### Activity Logging

All item changes create Activity records for audit trail. Types include: CREATED, UPDATED, STATUS_CHANGE, PROGRESS_UPDATE, ASSIGNMENT, COMMENT, DEPENDENCY_ADDED, DEPENDENCY_REMOVED.

### Channel Types

- WORKSPACE: General workspace channel
- PROJECT: Auto-created for each project (linked via projectId)
- CUSTOM: User-created channels
- EXTERNAL: For external stakeholder communication

## Environment Variables

See `.env.example`:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Minimum 32 characters
- `APP_URL` - Application URL (default: http://localhost:3000)
- Optional: `RESEND_API_KEY` or `SENDGRID_API_KEY` for emails
