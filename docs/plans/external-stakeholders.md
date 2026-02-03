# External Stakeholders System

> The AI-mediated transparency layer between your team and the outside world.

## Vision

Relai's External Stakeholders system creates isolated portals where clients, investors, partners, and power users can see project progress, ask questions, and submit requests — all mediated by AI that understands your project context.

The key insight: **AI sits in the middle**, translating between internal reality and external audiences. Stakeholders get answers instantly when possible, and the team only gets interrupted when genuinely needed.

**The network effect play:** External stakeholders are invited in, experience Relai's value, and convert to full users for their own teams.

---

## Core Concepts

### External Spaces

A project can have multiple isolated **External Spaces** — each a separate portal for a different audience:

- "Protencon" — your main client
- "Power Users" — engaged customers with good ideas
- "Investors" — board members and backers

**Spaces are fully isolated.** Stakeholders in one space cannot see other spaces exist. They see only their space's name, members, Q&A, and requests.

### Stakeholder Access

Users are invited to a specific space via magic link. On signup (lightweight: email required, name/position optional), they become a stakeholder with access to that space.

**A user can be:**
- Stakeholder on Project A (external view)
- Owner/contributor on Project B (full view)
- Stakeholder on multiple projects (different spaces)

**A user cannot** be in multiple spaces for the same project.

### The AI Intermediary

The chat interface is the universal input. Stakeholders just talk naturally, and the AI:

1. **Answers questions** directly when it has context
2. **Drafts Information Requests** when it can't answer, for stakeholder approval before sending
3. **Drafts tasks** (for stakeholders with permission) from natural language or pasted content
4. **Creates suggestions** when stakeholders have ideas

The AI knows:
- Project title, description, goals
- All tasks (titles, descriptions, status, progress) — anonymized (no contributor names)
- Activity feed / recent completions
- Owner-curated context documents
- Previous IRs + responses (to avoid re-asking answered questions)

---

## Data Models

### ExternalSpace

```typescript
interface ExternalSpace {
  id: string
  projectId: string
  name: string                    // "Protencon", "Investors"
  description?: string            // Shown to stakeholders
  maxIRsPer24h: number           // Default rate limit for this space
  allowTaskSubmission: boolean    // Can stakeholders in this space submit tasks?
  createdAt: Date
  updatedAt: Date
}
```

### StakeholderAccess

```typescript
interface StakeholderAccess {
  id: string
  userId: string
  externalSpaceId: string
  canSubmitTasks: boolean         // Override space default
  maxIRsPer24h?: number           // Override space default
  displayName?: string            // How they appear in this space
  position?: string               // Job title: "CTO", "Product Lead"
  invitedAt: Date
  invitedBy: string               // User ID of who invited them
}
```

### InformationRequest

```typescript
interface InformationRequest {
  id: string
  externalSpaceId: string
  createdById: string             // Stakeholder user ID
  type: 'question' | 'suggestion'
  content: string                 // AI-drafted or stakeholder-written
  status: 'pending' | 'answered' | 'accepted' | 'declined'
  response?: string               // From team
  respondedById?: string          // Team member who responded
  respondedAt?: Date
  votes: string[]                 // User IDs who upvoted
  convertedToTaskId?: string      // If suggestion → accepted as task
  addedToAIContext: boolean       // Owner flagged for AI to learn
  createdAt: Date
  updatedAt: Date
}
```

### ExternalTask

```typescript
interface ExternalTask {
  id: string
  externalSpaceId: string
  submittedById: string           // Stakeholder user ID
  title: string
  description: string
  externalComments: ExternalComment[]
  status: 'pending' | 'accepted' | 'rejected' | 'needsInfo'
  rejectionReason?: string
  linkedTaskId?: string           // When accepted, points to real task
  internalNotes?: string          // Team-only, not visible to stakeholder
  createdAt: Date
  updatedAt: Date
}

interface ExternalComment {
  id: string
  authorId: string                // Stakeholder user ID
  content: string
  createdAt: Date
}
```

### ProjectStakeholderSettings

```typescript
interface ProjectStakeholderSettings {
  projectId: string
  aiContextDocs: AIContextDoc[]   // Owner-curated docs for AI
}

interface AIContextDoc {
  id: string
  title: string
  content: string
  addedAt: Date
  addedById: string
}
```

---

## User Flows

### Invite Flow

```
Owner creates External Space "Protencon"
    → Configures: allowTaskSubmission, maxIRsPer24h
    → Generates invite link (magic link with space token)
    → Sends to client contacts

Client clicks link
    → "You've been invited to Protencon Portal"
    → Sign up: email (required), password
    → Optional: display name, position/title
    → Lands in stakeholder dashboard
```

### Stakeholder Dashboard

```
/dashboard (logged-in stakeholder)

My External Projects
├── Protencon Portal (Acme Corp)
│   └── 3 active items, 2 pending requests
├── Beta Program (Other Co) 
│   └── Invited 2 days ago
│
└── [Use Relai for your team →]  // Conversion CTA
```

### Stakeholder Portal (per space)

```
/s/[spaceSlug] or /project/[projectSlug]/external/[spaceSlug]

├── Overview (default)
│   ├── Project title + description
│   ├── "Currently Working On" — active tasks (anonymized)
│   └── "Recently Shipped" — completed items
│
├── My Requests
│   ├── Submitted tasks + status
│   └── My IRs + responses
│
├── Q&A (Community)
│   ├── All IRs in this space
│   ├── Sorted by votes / recent
│   ├── Can upvote others' IRs
│   └── Search/filter
│
└── Chat (persistent sidebar)
    └── Universal AI input
```

### AI Chat — Question Flow

```
Stakeholder: "When will the API be ready?"

AI: [checks project context, finds task but no clear date]

AI: "The API integration is currently in progress. I don't 
     have a specific timeline for completion.
     
     Would you like me to ask the team?"
     
     [Draft shown]
     ┌────────────────────────────────────────┐
     │ Stakeholder is asking about the        │
     │ expected completion date for the API   │
     │ integration.                           │
     └────────────────────────────────────────┘
     
     [Send Request] [Edit] [Cancel]

Stakeholder: [clicks Send Request]

→ IR created, visible to team
→ Stakeholder sees it in My Requests
→ Other stakeholders can upvote in Q&A
```

### AI Chat — Task Submission Flow (permission required)

```
Stakeholder: "Got this from a user:
              
              Hi, the login button doesn't work on Safari.
              I click it and nothing happens. I'm on a Mac
              with the latest updates. It worked fine last 
              week. Please help! - John"

AI: "I've drafted a bug report from that:

     Title: Login button unresponsive on Safari
     Description: User reports that clicking the login 
     button on Safari (macOS, latest updates) produces 
     no response. User confirms this worked as of last 
     week, suggesting a recent regression.
     Priority: Medium (suggested)
     
     [Submit to Project] [Edit Draft] [Add More Details]"

Stakeholder: "Actually, another user reported the same on 
              Firefox too"

AI: "Updated to reflect multiple browsers:

     Title: Login button unresponsive on Safari and Firefox
     Description: Multiple users report... affecting Safari 
     and Firefox on macOS... recent regression...
     
     [Submit to Project] [Edit Draft]"

Stakeholder: [clicks Submit]

→ ExternalTask created, lands in team's inbound queue
→ Stakeholder sees it in My Requests with status "Pending"
```

### AI Chat — Suggestion Flow

```
Stakeholder: "It would be great if you had a dark mode"

AI: "I can submit that as a feature suggestion to the team.

     [Draft shown]
     ┌────────────────────────────────────────┐
     │ Feature suggestion: Dark mode          │
     │                                        │
     │ Stakeholder requests dark mode /       │
     │ dark theme option for the application. │
     └────────────────────────────────────────┘
     
     [Send Suggestion] [Edit] [Cancel]"

→ Creates IR with type: 'suggestion'
→ Team can convert to task if accepted
```

---

## Owner/Contributor Views

### External Spaces Management

```
/project/[slug]/settings/external

External Spaces
├── Protencon
│   ├── 12 stakeholders
│   ├── Task submission: Enabled
│   ├── [Manage] [Invite Link] [Settings]
│   
├── Power Users  
│   ├── 34 stakeholders
│   ├── Task submission: Disabled
│   ├── [Manage] [Invite Link] [Settings]
│
└── [+ Create Space]
```

### Inbound Queue

```
/project/[slug]/inbound

Unified view of:
├── External Tasks (pending review)
│   ├── [Bug] Login issues on Safari — from Protencon
│   └── [Feature] Export to PDF — from Power Users
│
├── Suggestions (from IRs)
│   └── Dark mode — 7 votes — from Power Users
│
└── Filter by: Space | Type | Status
```

### Information Requests

```
/project/[slug]/requests

All IRs across spaces
├── "When will API be ready?" — Protencon — 3 votes — Pending
├── "Do you support SSO?" — Protencon — Answered
├── "Dark mode?" — Power Users — 7 votes — Converted to task
│
├── Filter by: Space | Status | Votes
└── Actions: Respond | Add to AI Context | Convert to Task
```

### AI Context Management

```
/project/[slug]/settings/ai-context

Documents the AI uses to answer stakeholder questions:

├── Project Overview (auto-generated from project description)
├── FAQ: API Timeline — added from IR response
├── FAQ: SSO Support — added from IR response
├── Product Roadmap Q1 — manually added
│
└── [+ Add Document]
```

---

## Permissions Model

```typescript
// Space-level defaults
ExternalSpace {
  allowTaskSubmission: boolean    // Default for new stakeholders
  maxIRsPer24h: number           // Default rate limit
}

// Per-stakeholder overrides
StakeholderAccess {
  canSubmitTasks: boolean         // Override space default
  maxIRsPer24h?: number           // Override space default
}

// What stakeholders can always do:
// - View project overview (anonymized)
// - Ask questions via chat
// - Submit suggestions
// - Upvote IRs in their space
// - See their own requests and IRs

// What requires canSubmitTasks:
// - Submit external tasks via chat
```

---

## Technical Implementation

### Phase 1: Data Models + Migrations
- ExternalSpace table
- StakeholderAccess table (extends User relationship)
- InformationRequest table
- ExternalTask table
- ExternalComment table
- ProjectStakeholderSettings / AIContextDoc

### Phase 2: Space Management (Owner Side)
- Create/edit/delete external spaces
- Generate invite links
- Configure space settings
- View stakeholders per space

### Phase 3: Stakeholder Portal (External Side)
- Magic link signup flow
- Stakeholder dashboard (multi-project)
- Space portal: Overview, My Requests, Q&A tabs
- Basic views (no AI chat yet)

### Phase 4: Inbound Queue (Owner Side)
- Unified inbound view
- Accept/reject/needsInfo external tasks
- Respond to IRs
- Convert suggestions to tasks
- Add IR responses to AI context

### Phase 5: AI Chat Integration
- Stakeholder chat component
- AI with project context
- Question answering
- IR drafting + approval flow
- Task drafting (for permitted stakeholders)
- Suggestion drafting

### Phase 6: Polish + Conversion
- Stakeholder → full user conversion flow
- "Use Relai for your team" CTAs
- Onboarding for new stakeholders
- Email notifications for IR responses

---

## Edge Cases + Considerations

### Rate Limiting
- Each stakeholder has max IRs per 24h (space default or override)
- Prevents spam, encourages thoughtful questions
- Rate limit shown in UI when approaching limit

### IR Response Visibility
- All responses are public to the space
- Builds shared knowledge base
- Reduces repetitive questions

### Task Attribution
- Accepted external tasks show "Requested by [Space Name]"
- Original stakeholder visible to team, not to other stakeholders
- Maintains clean internal view while preserving attribution

### Stakeholder Removal
- Remove from space → loses access
- Their historical IRs/tasks remain (for continuity)
- Can be re-invited later

### Space Deletion
- Soft delete (archive)
- Stakeholders lose access
- Data preserved for team reference

---

## Success Metrics

- **Stakeholder engagement:** Questions asked, IRs submitted
- **AI deflection rate:** % of questions answered without IR
- **Response time:** Time from IR creation to response
- **Conversion rate:** Stakeholders → full Relai users
- **Task acceptance rate:** External tasks accepted vs rejected

---

## Future Ideas

- **Scheduled updates:** Auto-generated progress reports sent to stakeholders
- **Webhooks:** Notify external systems of project updates
- **Custom branding:** Per-space logos and colors
- **Role-based views:** Different project visibility for different stakeholder types
- **Public spaces:** Open access for open-source projects

---

*Document created: 2026-01-31*
*Last updated: 2026-01-31*
