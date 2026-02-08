# External Stakeholders — Polish & Final Fixes

> Audit completed: 2026-01-31
> Based on spec: `/docs/plans/external-stakeholders.md`

---

## Summary

Phases 1-5 of the External Stakeholders system are **substantially complete**. The core flows work:
- ✅ Space creation and management
- ✅ Invite link generation and acceptance
- ✅ Stakeholder portal with Overview, My Requests, Q&A tabs
- ✅ AI chat with streaming responses
- ✅ IR/Task creation via chat actions
- ✅ Inbound queue with accept/reject/respond actions
- ✅ Voting on Q&A items

However, several features from the spec are missing or incomplete, and there are polish opportunities throughout.

---

## P0 — Critical (Blocks Core Usage)

*None identified.* Core functionality is working.

---

## P1 — Important (Significantly Impacts UX)

### 1.1 AI Context Management UI Missing

**What:** The spec describes an owner-facing UI at `/project/[slug]/settings/ai-context` where owners can add, edit, and delete documents that the AI uses to answer stakeholder questions. The data model (`AIContextDoc`) exists and the chat API reads from it, but **there's no UI to manage these documents**.

**Where:**
- Missing: `/app/pages/workspace/projects/[id].vue` — no "AI Context" tab/section
- Missing: `/app/components/external/AIContextManager.vue` (doesn't exist)
- Missing: `/server/api/projects/[projectId]/ai-context/` (endpoints don't exist)

**Impact:** Owners can't curate what the AI knows. The AI only has access to project description and task titles, limiting its ability to answer stakeholder questions helpfully.

**Fix:**
1. Create API endpoints: `GET/POST /api/projects/[projectId]/ai-context` and `PATCH/DELETE /api/projects/[projectId]/ai-context/[docId]`
2. Create `AIContextManager.vue` component with document list and add/edit modal
3. Add "AI Context" tab or section to project settings (could live with External Spaces settings)

---

### 1.2 No Visibility of Rejection Reasons for Stakeholders

**What:** When a task is rejected or an IR is declined, stakeholders see the status badge but **can't see the rejection reason**. The API returns it, but the UI doesn't display it.

**Where:**
- `/app/pages/s/[spaceSlug].vue` — My Requests tab doesn't show `rejectionReason` for tasks or decline response for IRs

**Impact:** Stakeholders don't understand why their requests were rejected, leading to confusion and re-submissions.

**Fix:**
```vue
<!-- In My Requests > Submitted Tasks section -->
<div v-if="task.status === 'rejected' && task.rejectionReason" class="mt-2 p-2 bg-rose-50 rounded text-sm text-rose-700">
  <span class="font-medium">Reason:</span> {{ task.rejectionReason }}
</div>
```

---

### 1.3 No Rate Limit Feedback Before Hitting Limit

**What:** Stakeholders have a daily limit on IRs (`maxIRsPer24h`), but they only find out when they **exceed** the limit (429 error). The spec mentions showing rate limit status in the UI.

**Where:**
- `/app/components/stakeholder/StakeholderChat.vue` — no rate limit indicator
- `/server/api/s/[spaceSlug]/index.get.ts` — doesn't return remaining quota

**Impact:** Stakeholders might hold back from asking questions not knowing their quota, or get frustrated by unexpected 429 errors.

**Fix:**
1. Add to space overview API: `rateLimit: { used: number, max: number, resetsAt: string }`
2. Show quota in chat header: "3/10 questions today"
3. Show warning when approaching limit (e.g., 8/10)

---

### 1.4 Chat History Lost on Refresh

**What:** Chat messages are stored only in Vue reactive state (`useStakeholderChat` composable). Refreshing the page or navigating away loses all chat history.

**Where:**
- `/app/composables/useStakeholderChat.ts` — uses in-memory `ref<StakeholderChatMessage[]>()`

**Impact:** Stakeholders lose context of their conversation, may re-ask questions, degrades experience.

**Fix options:**
1. **Quick fix:** Persist to localStorage per spaceSlug
2. **Better:** Create `chat_messages` table and API endpoints to persist server-side
3. **Best:** Store in DB and allow owners to see chat history for support purposes

Recommended: Start with localStorage for MVP polish, consider server persistence later.

---

### 1.5 ExternalTask Linked Task Not Accessible to Stakeholder

**What:** When an `ExternalTask` is accepted, it gets a `linkedTaskId`. The owner can see this in the details modal, but the **stakeholder has no way to know their task was accepted and linked**.

**Where:**
- `/app/pages/s/[spaceSlug].vue` — My Requests doesn't show linked task status
- `/server/api/s/[spaceSlug]/my-requests.get.ts` — doesn't return `linkedTaskId`

**Impact:** Stakeholders don't get closure on accepted tasks. They see "accepted" but can't track progress.

**Fix:**
1. Return `linkedTaskId` in my-requests API
2. Show "✓ Accepted — now being worked on" with optional progress if the linked task has progress

---

## P2 — Polish (Nice-to-Have, Better UX)

### 2.1 Empty State CTAs

**What:** Empty states in Overview, Q&A, and My Requests tabs could be more actionable.

**Where:**
- `/app/pages/s/[spaceSlug].vue`

**Current:** "No active items at the moment" / "No questions yet"

**Better:**
- Overview empty: "The team hasn't started any tasks yet. Check back soon, or ask about the timeline →" (opens chat)
- Q&A empty: "Be the first to ask a question!" → CTA button to open chat
- My Requests empty: "Ask the AI anything about the project →" → CTA to open chat

---

### 2.2 Action Card Loading States

**What:** When clicking "Send Request" or "Submit Task" in the chat action cards, the button says "Sending..." but there's no visual indicator that it worked until the confirmation message appears.

**Where:**
- `/app/components/stakeholder/StakeholderChat.vue` — action card submit handlers

**Fix:** Add success animation (checkmark) before clearing the action card, or briefly show "✓ Sent!" state.

---

### 2.3 StakeholderAccess displayName Edit

**What:** Owners can toggle `canSubmitTasks` for individual stakeholders but **can't edit their displayName or position** after initial invite.

**Where:**
- `/app/components/external/SpaceStakeholdersModal.vue` — only has toggle for task permission
- `/server/api/projects/[projectId]/spaces/[spaceId]/stakeholders/[userId].patch.ts` — supports `canSubmitTasks` but check if it also supports `displayName`/`position`

**Fix:** Add inline edit or edit modal for stakeholder profile fields.

---

### 2.4 Q&A Status Filter

**What:** Q&A tab has sort (recent/votes) and search, but no **status filter** to show only pending or only answered questions.

**Where:**
- `/app/pages/s/[spaceSlug].vue` — Q&A tab filters

**Fix:** Add status pills: "All | Pending | Answered" similar to the inbound queue filters.

---

### 2.5 Markdown Rendering in IR Responses

**What:** IR responses from the team are displayed as plain text. If owners use markdown (bullets, links), it's not rendered.

**Where:**
- `/app/pages/s/[spaceSlug].vue` — response display in Q&A and My Requests

**Fix:** Use the same simple markdown renderer from `StakeholderChatMessage.vue` for IR responses.

---

### 2.6 Toast Notifications Instead of Alerts

**What:** Several actions use `alert()` for errors (e.g., failed invite link copy, failed stakeholder removal).

**Where:**
- `/app/components/external/SpacesList.vue` — `alert('Invite link copied to clipboard!')`
- `/app/components/external/SpaceStakeholdersModal.vue` — `alert('Failed to remove stakeholder...')`

**Fix:** Implement or use a toast notification system for cleaner UX.

---

### 2.7 Inbound Queue Real-Time Updates

**What:** Inbound queue requires manual refresh to see new items.

**Where:**
- `/app/components/external/InboundQueue.vue`

**Fix:** Add polling interval (e.g., every 30 seconds) or badge in sidebar showing new item count.

---

### 2.8 External Space URL Preview

**What:** When creating/editing a space, owners see `/slug` but don't see the full public URL.

**Where:**
- `/app/components/external/SpaceSettingsModal.vue`
- `/app/components/external/SpaceCard.vue`

**Fix:** Show full URL preview: `yourapp.com/s/protencon` and make it clickable to preview the portal.

---

### 2.9 Chat Keyboard Shortcuts

**What:** Chat input supports Enter to send but no other shortcuts.

**Where:**
- `/app/components/stakeholder/StakeholderChat.vue`

**Fix:**
- Shift+Enter for newline (already works via `@keydown.enter.exact`)
- Escape to close chat
- Cmd/Ctrl+Enter as alternative send shortcut

---

### 2.10 Mobile Responsiveness

**What:** The stakeholder portal chat is a fixed-width sidebar that may not work well on mobile.

**Where:**
- `/app/pages/s/[spaceSlug].vue`
- `/app/components/stakeholder/StakeholderChat.vue`

**Fix:** On mobile, make chat full-screen overlay instead of sidebar.

---

## P3 — Future (From Spec, Not Critical Now)

### 3.1 Email Notifications (Phase 6 from spec)
- Notify stakeholders when IR is answered
- Notify owners of new submissions
- Weekly digest of stakeholder activity

### 3.2 Stakeholder → Full User Conversion
- Track conversion funnel
- Enhanced "Use Context for your team" CTA
- Onboarding flow for new full users who started as stakeholders

### 3.3 Onboarding for New Stakeholders
- Welcome modal on first visit
- Quick tour of portal features
- Prompt to set displayName/position if not set

### 3.4 Scheduled Updates
- Auto-generated progress reports
- Configurable frequency (weekly/monthly)
- Email delivery to stakeholders

### 3.5 Custom Branding
- Per-space logo upload
- Color theme customization
- Custom domain support

### 3.6 Public Spaces
- Open access without invite
- For open-source projects
- Optional email capture

### 3.7 Project Progress Dashboard
- Overall completion percentage
- Milestone tracking
- Burndown/burnup charts visible to stakeholders

### 3.8 Webhooks
- Notify external systems of:
  - New IR/task submissions
  - IR responses
  - Task status changes

### 3.9 Password-Based Auth Option
- Currently only magic link
- Some users prefer traditional password login
- Consider as stakeholder signup option

---

## Implementation Priority

**Week 1: P1 Items**
1. AI Context Management UI (1.1) — 1-2 days
2. Rejection reason visibility (1.2) — 30 min
3. Rate limit feedback (1.3) — 2 hours
4. Chat history localStorage (1.4) — 1 hour
5. Linked task visibility (1.5) — 1 hour

**Week 2: High-Impact P2**
1. Empty state CTAs (2.1) — 1 hour
2. Toast notifications (2.6) — 2 hours (if adding new system)
3. Mobile chat (2.10) — 2-3 hours

**Ongoing: Other P2**
- Ship incrementally as time allows
- Consider user feedback to prioritize

**Later: P3**
- Email notifications should be next major feature
- Conversion tracking important for growth
- Custom branding for enterprise tier

---

## Files Changed Summary

### New Files Needed
- `/app/components/external/AIContextManager.vue`
- `/app/components/external/AIContextEditModal.vue`
- `/server/api/projects/[projectId]/ai-context/index.get.ts`
- `/server/api/projects/[projectId]/ai-context/index.post.ts`
- `/server/api/projects/[projectId]/ai-context/[docId].patch.ts`
- `/server/api/projects/[projectId]/ai-context/[docId].delete.ts`

### Files to Modify
- `/app/pages/s/[spaceSlug].vue` — rejection reasons, empty states, linked task visibility
- `/app/components/stakeholder/StakeholderChat.vue` — rate limit indicator, localStorage persistence
- `/app/composables/useStakeholderChat.ts` — localStorage persistence
- `/server/api/s/[spaceSlug]/index.get.ts` — add rate limit info
- `/server/api/s/[spaceSlug]/my-requests.get.ts` — add rejection reasons and linkedTaskId
- `/app/pages/workspace/projects/[id].vue` — add AI Context section
- `/app/components/external/SpaceStakeholdersModal.vue` — displayName edit
- Various — replace `alert()` with toast notifications

---

*Document created as part of External Stakeholders audit.*
