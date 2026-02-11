# Norwegian Time Management / Workforce Compliance

**Status:** Research / idea stage — not planned for implementation yet.

**Premise:** With existing focus/time tracking and project/task management, we're close to covering what tools like Tidsbanken provide — but for knowledge workers and consultants rather than shift workers.

---

## What We Already Have

- Project/task management (hierarchical items, kanban, dependencies)
- Time tracking (focus sessions with lanes: GENERAL, MEETING, ADMIN, LEARNING, BREAK)
- Team presence (real-time via WebSocket)
- Documents (per-item, versioned)
- Stakeholder comms (channels, messaging)
- Multi-workspace/org structure with seat management

## Market Context

### Tidsbanken (primary Norwegian competitor)
- Largest workforce management system supplier in the Nordics (est. 1999, Bergen)
- 130,000+ employees across 3,000+ Norwegian businesses
- Core modules: time clocks, timesheets, shift scheduling, project tracking, absence tracking, HMS
- Focused heavily on shift-based/industrial workers (retail, construction, manufacturing, transport)
- SaaS, ~50 employees, ~$6.2M annual revenue
- Does not publicly list pricing

### Other Norwegian Competitors
| Company | Segment | Notes |
|---------|---------|-------|
| Tripletex (Visma) | SME cloud ERP | NOK 29/employee/month for time module, 37k+ customers |
| PowerOffice Go | Cloud ERP | 37k customers, integrated time + payroll |
| 24SevenOffice / Finago Busy | Cloud ERP | Stopwatch + manual time entry |
| Xledger | Mid-market ERP | Integrated time, economics, projects |
| Simployer | HR platform | Often paired with Tidsbanken |
| Planday (Xero) | Shift scheduling | Mobile punch-clock, leave management |

### Gap in the Market
Knowledge workers / consultants are underserved in Norway. People use Toggl/Harvest (no Norwegian compliance) or Tripletex (accounting-first, time tracking is an afterthought). Nobody combines project management + time compliance + team comms in one tool.

Our unique angle: time data is already contextual because it's tied to the hierarchical task tree. A consultant's billable hours automatically map to projects and clients.

---

## Features Needed for Norwegian Compliance

### Legally Mandated (Arbeidsmiljoloven)

#### 1. Workday Clock-in/Clock-out (AML Section 10-7)
Norwegian law requires tracking the **workday itself** — start time, end time, breaks — not just task time. This is a layer above our current focus sessions.

- Must record: days worked, start/end times, breaks, total hours, overtime hours
- Records must be accessible to Arbeidstilsynet and tillitsvalgte
- Must be retained for **3.5 years**
- Method-agnostic: digital self-reporting is fine

**Implementation idea:** Optional "workday" mode that wraps focus sessions. Auto-stamp option (e.g., default 08:00-16:00) configurable per employee by admins, with manual punch override.

#### 2. Overtime Auto-detection and Limits (AML Section 10-6)
Automatic flagging when hours exceed legal thresholds:

| Scope | Standard | With Collective Agreement | With Arbeidstilsynet Approval |
|-------|----------|--------------------------|-------------------------------|
| Per 7 days | 10h | 20h | 25h |
| Per 4 weeks | 25h | 50h | — |
| Per 52 weeks | 200h | 300h | 400h |

- Daily limit: 9 hours (beyond = overtime)
- Weekly limit: 40 hours (beyond = overtime)
- Total work + overtime: max 13h/day, avg 48h/week over 8 weeks
- **Minimum 40% overtime supplement** — legally mandated, cannot be negotiated lower
- Mertid (additional hours) distinction for part-time workers

#### 3. Sick Leave Tracking
- **Egenmelding** (self-certification): 3 calendar days per instance, max 4 instances before requiring doctor's note. Requires 2 months employment.
- **Arbeidsgiverperiode**: First 16 calendar days — employer pays 100% salary
- After 16 days: NAV takes over, employer submits inntektsmelding via Altinn
- Employer follow-up: oppfolgingsplan within 4 weeks, dialogmote within 7 weeks
- IA-bedrifter may have extended self-certification (8 consecutive days, 24 total)

#### 4. Vacation Balance (Ferieloven)
- Statutory: 25 working days/year (many agreements: 30 days)
- Over-60: extra week
- 3 consecutive weeks must be taken June 1 - September 30
- Carryover: up to 12 days by written agreement
- Feriepenger: 10.2% of prior year gross (12% for 5-week agreements)
- Employer **must ensure** employees use all vacation days

#### 5. Flextime Balance (AML Section 10-2/10-5)
- Common for knowledge workers
- Requires written agreement
- Track plus/minus hours, enforce core time
- Plus-hours must be available as time off (employer can't just strike them)
- Distinguish flextime from overtime

### Business-Critical for Consultants

#### 6. Billable vs Non-billable Split
- Explicit billable flag per time entry
- Per-client billing rates (multiple rate tiers per seniority/project/time-of-day)
- Utilization dashboards (billable % per consultant, team, department)

#### 7. Travel Time as Working Time
Per Supreme Court ruling HR-2018-1036-A (2018): travel to off-site assignments counts toward working hour limits regardless of when it occurs. Must be tracked separately; can trigger overtime.

#### 8. Calendar View
Essential for viewing workdays, vacation, sick days, scheduled meetings in one place.

#### 9. Per Diem (Diett) Calculation
Norwegian tax-free rates for business travel (>15km, >6 hours). Varies by duration, domestic vs international, and whether meals are provided. Rates set annually by government.

#### 10. Expense Tracking
Mileage (kjoring), accommodation, travel costs with Norwegian tax rules.

### Can Defer

- **Shift scheduling** — not relevant for knowledge workers
- **Physical time clocks** — Tidsbanken's domain, not ours
- **HMS/quality management** — separate domain entirely
- **A-melding / SAF-T tax reporting** — integrate later via API to Tripletex/PowerOffice
- **Deep NAV integration** — start with manual sick leave logging, add digital integration later
- **E-invoicing (EHF format)** — mandatory for public sector clients, can add when needed

### Nice-to-Have

- AI-powered time suggestions (auto-detect from calendar/app usage)
- Real-time project budget monitoring
- Resource planning / staffing forecasts
- Collective agreement rule engine (different overtime rules per tariffavtale)
- Client portal for timesheet approval before invoicing
- Offline capability for travel/site visits
- SAF-T compliance
- Invoice generation from timesheets

---

## Exemptions to Note

Two categories of employees are **exempt** from working time tracking (AML 10-12):
1. **Ledende stilling** — senior/managerial positions with independent decision-making
2. **Saerlig uavhengig stilling** — particularly independent positions (sometimes applied to senior consultants, but scrutinized by authorities)

Even exempt employees must not be exposed to adverse strain.

---

## Regulatory Direction

The EU mandated objective digital time recording from July 2024. Norway (EEA member) generally adopts EU employment directives. While no specific new Norwegian legislation has been identified for 2024-2026, the direction is toward stricter digital tracking enforcement.

---

*Research conducted February 2026*
