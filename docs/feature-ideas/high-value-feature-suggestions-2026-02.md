# High-Value Feature Suggestions (February 2026)

## Context
This recommendation set is based on the current product surface in this repo: recursive work items, dependency tracking, focus sessions, channels, external stakeholder spaces, AI-generated updates, documents, agent sessions, and commit linking.

Goal: prioritize features that increase activation, retention, and expansion while reusing existing system primitives.

## Prioritization Rubric
- **Impact (1-5):** expected business/customer value
- **Effort (1-5):** implementation complexity (higher = harder)
- **Time-to-Value (1-5):** speed to meaningful user-visible results (higher = faster)
- **Priority Score:** `Impact * 2 + Time-to-Value - Effort`

## Ranked Feature List

| Rank | Feature | Impact | Effort | Time-to-Value | Priority Score |
|---|---|---:|---:|---:|---:|
| 1 | Intake-to-Task Autopilot | 5 | 2 | 5 | 13 |
| 2 | Stakeholder Update Autopilot v2 (Approval + Schedule) | 5 | 3 | 4 | 11 |
| 3 | Delivery Intelligence: Critical Path + Risk Delta Feed | 5 | 3 | 4 | 11 |
| 4 | Agent Playbooks (Event-Triggered Automation) | 4 | 3 | 4 | 9 |
| 5 | Commit-to-Outcome Traceability + Release Notes | 4 | 2 | 3 | 9 |
| 6 | Capacity Planner from Focus + Assignments | 4 | 3 | 3 | 8 |
| 7 | Portfolio Command Center (Cross-Workspace Rollups) | 4 | 4 | 2 | 6 |

---

## 1) Intake-to-Task Autopilot
**Problem:** Requests are spread across channels, comments, and external inbound threads; teams lose work during handoff.

**Feature:** Add AI-assisted triage that turns inbound messages into structured tasks with owner, due date suggestion, priority, and parent project mapping.

**MVP scope:**
- “Create task from message” with one-click suggested fields.
- Batch triage queue for unstructured inbound requests.
- Confidence + required-human-review flag before publish.
- Back-link from task to source message/thread.

**Why this is high-value now:** Existing channels/external inbox/task APIs already provide most plumbing.

**Success metrics:**
- % inbound requests converted to tracked tasks.
- Median time from inbound message to assigned owner.
- Reduction in “orphan” requests (messages with no linked work item).

## 2) Stakeholder Update Autopilot v2 (Approval + Schedule)
**Problem:** Update generation exists, but teams still need predictable cadence, approvals, and trust controls.

**Feature:** Add configurable weekly cadence, human approval routing, and change summaries (“what changed since last update”).

**MVP scope:**
- Per-space update schedule (weekly/biweekly).
- Draft queue with approver assignment.
- Delta section auto-generated from activity/completions/blockers.
- Auto-publish after approval with audit trail.

**Why this is high-value now:** `/updates/generate` already exists and can be extended without net-new data models.

**Success metrics:**
- % stakeholder spaces with active update schedules.
- Manual time spent writing updates per PM/week.
- Stakeholder response/engagement rate on published updates.

## 3) Delivery Intelligence: Critical Path + Risk Delta Feed
**Problem:** Teams can see status and dependencies, but not why confidence is changing or which path now drives delay risk.

**Feature:** Add a “risk delta feed” and critical-path view that explains top contributors to slippage.

**MVP scope:**
- Daily risk-change digest per project.
- Critical-path visualization from dependency graph + due dates.
- “What changed?” explanation cards (blocked item, confidence drop, due-date shift).
- Escalation suggestions for highest-impact unblock actions.

**Why this is high-value now:** Item dependencies, temperature/confidence, and activity logs already exist.

**Success metrics:**
- Time-to-detect high-risk slippage.
- On-time completion rate for high-priority projects.
- Mean blocked duration for critical-path items.

## 4) Agent Playbooks (Event-Triggered Automation)
**Problem:** Agents can execute tasks, but automation is still mostly manual and session-driven.

**Feature:** Let users define playbooks (if X happens, agent does Y) for repetitive workflows.

**MVP scope:**
- Triggers: item blocked, stale task, new external request, failed confidence threshold.
- Actions: draft comment, propose subtask plan, generate stakeholder summary, open triage checklist.
- Run history + approval mode (dry-run vs auto-run).
- Workspace-level template library.

**Why this is high-value now:** Agent task/session APIs, docs/comments, and notifications are already present.

**Success metrics:**
- # automated runs per workspace/week.
- Cycle time reduction for repeated workflows.
- Human acceptance rate of agent-generated outputs.

## 5) Commit-to-Outcome Traceability + Release Notes
**Problem:** Commit linkage exists in schema, but teams still need outcome-level visibility and stakeholder-friendly release narratives.

**Feature:** Build timeline and release-note generation connecting commits -> tasks -> project outcomes.

**MVP scope:**
- Project release view grouped by shipped tasks.
- Auto-generated release notes from commit + task context.
- “Unlinked commit” reminders to improve traceability.
- Export/share for stakeholder updates.

**Why this is high-value now:** `Commit` model and agent commit APIs already exist.

**Success metrics:**
- % commits linked to tasks.
- Time to produce weekly release notes.
- Post-release debugging speed (time to identify related task/decision).

## 6) Capacity Planner from Focus + Assignments
**Problem:** Focus data exists, but planning still lacks a practical workload/capacity layer.

**Feature:** Add weekly capacity planning from historical focus allocation + active assignments.

**MVP scope:**
- Individual/team capacity forecast (next 2-4 weeks).
- Over-allocation alerts by lane (task vs meeting/admin load).
- Suggested reassignments for overloaded owners.
- Plan-vs-actual review at week end.

**Why this is high-value now:** Focus sessions + assignment/status data are already available.

**Success metrics:**
- Over-allocated team member count over time.
- Planned vs actual completion variance.
- Increase in maker-time share for core contributors.

## 7) Portfolio Command Center (Cross-Workspace Rollups)
**Problem:** Leadership visibility is fragmented at workspace/project level.

**Feature:** Add org-level rollup for risk, throughput, blocker aging, and forecast confidence across workspaces.

**MVP scope:**
- Executive dashboard with workspace health cards.
- Cross-workspace blocker aging and risk leaderboard.
- Drill-down to project and owning team.
- Weekly portfolio digest.

**Why this is high-value now:** Org/workspace hierarchy and activity/risk primitives already exist.

**Success metrics:**
- Executive weekly active usage of portfolio view.
- Time from risk emergence to leadership visibility.
- Portfolio-level on-time delivery improvement.

---

## 90-Day Rollout Recommendation

### Days 1-30 (Fastest Value)
1. **Intake-to-Task Autopilot** MVP.
2. **Stakeholder Update Autopilot v2** scheduling + approval basics.
3. Instrument metrics/events for all new flows.

### Days 31-60 (Execution Intelligence)
1. **Delivery Intelligence** risk delta + critical-path view.
2. **Commit-to-Outcome Traceability** with release-note generator.
3. Harden permissions/audit trails for stakeholder-facing outputs.

### Days 61-90 (Scale + Expansion)
1. **Agent Playbooks** with guarded auto-run modes.
2. **Capacity Planner** initial forecasting and overload alerts.
3. **Portfolio Command Center** beta for org admins.

## Recommended Delivery Principles
- Ship feature flags per workspace for controlled rollout.
- Require explicit human approval on externally published content initially.
- Prioritize explainability over black-box AI behavior for trust.
- Tie every feature launch to one retention and one efficiency KPI.

