# Dashboard Hub — Design

**Date:** 2026-04-24
**Author:** Zach Reichert (with Claude)
**Status:** Awaiting review (revised post-adversarial-review 2026-04-24)
**Depends on:** [Email Ingestion](2026-04-23-email-ingestion-design.md), [Microsoft Graph Contact Sync](2026-04-22-contact-sync-design.md)
**Hard prerequisites before merge:** Leads tab UI spec must have added `/pages/leads` to `full-kit/src/data/navigations.ts`; AI email-scrub spec must have adopted the "vault todo with status: proposed" contract (see §Integration).
**Related (in flight):** Leads tab UI, AI email-scrub task generation, Kanban pipeline redesign

---

## Context

Matt Robertson opens the app in the morning and wants a single at-a-glance view of what's going on in his business — new leads, things he's forgetting, what the AI has proposed for him to do, what's urgent, what's scheduled. This is the primary surface he starts his day on, and usually the first page he navigates back to between other tasks.

A working dashboard already exists at `full-kit/src/app/[lang]/(dashboard-layout)/dashboards/home/page.tsx`. It has a greeting header and 4 widgets in a 4-column grid: Pipeline Snapshot, Today's Agenda, Urgent Todos, and Recent Activity. It reads from vault notes via `listNotes()` from `@/lib/vault`, is styled with shadcn `Card` primitives in the app's dark theme, and uses RSC.

That dashboard was built before the email-ingestion and Leads-tab work, so it's missing the highest-value surfaces the new data unlocks: the **new lead count** from Crexi/LoopNet/Buildout ingestion, the **missed-follow-ups** recovery view (the "Focused / Other leak" from Matt's Outlook inbox split), and the **AI task-approval inbox** for todos the email-scrub agent proposes.

This spec covers **an enhancement pass on `/dashboards/home`**: extending the existing page with 3 new widget surfaces, an AI-approval banner above the widget grid, and a unification of the existing Urgent Todos widget with the AI-proposed-task inbox. **Todos stay in the vault layer for v1** — no Prisma schema change to `Todo`. The unification happens by extending the vault `TodoMeta` status vocabulary.

This spec does **not** cover:

- Migrating todos from vault notes to Prisma `Todo` rows (existing Prisma `Todo` model stays untouched; vault remains the live todo store for the dashboard in v1)
- Rewriting the existing 4 widgets' visual design (Pipeline and Today's Agenda are unchanged; Urgent Todos and Recent Activity have real behavior changes called out below)
- Building the Leads tab (separate spec in flight — dashboard only *links* to it)
- Generating the AI-proposed todos themselves (separate spec — dashboard only *reads + triages* them)
- Redesigning the Kanban pipeline (separate spec — dashboard only *links* to it)
- Calendar / upcoming-events widget beyond the existing Today's Agenda (depends on Outlook calendar ingestion, not yet spec'd)
- "Deals Closing Soon" weighted pipeline widget (v2)
- Drag-to-rearrange widget layout (YAGNI; Matt isn't using the app yet)
- Mobile phone layout (desktop is primary; iPad-size responsive is already handled by the existing grid)
- Real-time push (SSE / websockets) for dashboard updates (YAGNI for a single-user app)
- Per-user "seen since last visit" tracking (dropped after review — see §Data model)

## Goals

- Give Matt a one-screen snapshot each morning that surfaces the three things that matter most post-ingestion: new leads he hasn't touched, inbound that's gone unanswered, and AI-proposed tasks waiting for his approval
- Unify the existing Urgent Todos card and the new AI-proposed-task inbox under a single vault-note concept (one widget, two sections), so there is no parallel "agent action" approval inbox to track alongside the todo list
- Keep the two behaviorally stable existing widgets (Pipeline Snapshot, Today's Agenda) untouched. Explicitly call out the two that *are* changing: Urgent Todos becomes the unified Todos widget, and Recent Activity swaps its data source from vault notes to Prisma `Communication` so it can actually show ingested emails
- Make every widget a pointer to a deeper view — the dashboard summarizes, the dedicated pages own full interaction
- Establish the refresh model (RSC + revalidate-on-focus + `revalidateTag` on mutations) as the pattern for future dashboard-style pages

## Non-goals

- Treating the dashboard as a workspace (no inline bulk edit, no drag-reorder, no column-resize)
- Real-time push — a 5-minute staleness ceiling via focus-revalidate is acceptable
- Per-user "seen since last visit" state — the New Leads widget instead derives from `leadStatus = 'new'`, which the Leads tab flips when Matt acts on a lead
- Client-side polling — all refresh is either on-focus or after-mutation
- Per-user preferences or widget-level customization (single user, fixed layout)

---

## Role in the app

| Surface | Role | Interaction level |
|---|---|---|
| **Dashboard** (this spec) | Morning briefing / between-tasks glance | Read-only summary; one-click approve/dismiss for AI todos; everything else is click-through |
| **Leads tab** (sibling) | Full triage queue for new inbound leads | Assign, tag, convert to Deal; flips `leadStatus` from `new` → `vetted` / `contacted` / etc. |
| **Kanban** | Deal-stage operations | Drag between stages, full deal detail |
| **`/apps/todos`** | Full todo management | Bulk edit, filter, sort |
| **Communications** | Message-by-message browsing | Thread detail, reply |

The dashboard shows the top N rows from each of these and links out. It does not replicate their interaction surface.

---

## Widget inventory

### Banner (new)

A full-width card rendered above the widget grid, visible only when the count of vault todo notes with `status: proposed` is > 0.

- **Visual:** blue left-border accent on the card, a 🤖 glyph, count as the primary number ("5 AI-proposed tasks waiting for approval"), 3 top titles inline as a secondary line, "Review →" button on the right.
- **Action:** clicking "Review →" scrolls to and focuses the "Needs review" section of the Todos widget (same page, same section — no modal in v1).
- **Dismissal:** not persistent. Banner hides automatically when the proposed count hits 0 via approve/dismiss actions, reappears next session if new proposed todos exist.
- **Hidden state:** if zero proposed todos, banner is fully omitted (no empty-state card).

### Row 1 — the 4 existing widgets

| # | Widget | Data source today | Change in v1 |
|---|---|---|---|
| 1 | Pipeline Snapshot | `listNotes<DealMeta>("clients")` from vault | **No change.** Data-source swap to Prisma `Deal` is deferred to the Kanban spec. |
| 2 | Today's Agenda | `meetings` + `todos` vault notes | **Small change:** filter todos to exclude `status: proposed` so AI-unapproved items don't leak into the Agenda list. |
| 3 | **Urgent Todos → Todos (unified)** | `todos` vault | **Rewrite.** Two-section card — see below. Replaces `urgent-todos-card.tsx`. Reuses existing `TodoDetailDrawer` (vault-native, patches `/api/vault/todos`). |
| 4 | Recent Activity | `listNotes<CommunicationMeta>("communications")` | **Data-source swap.** Switch to Prisma `Communication` (populated by the email-ingestion spec). Order by `date` desc, take 5. Without this swap, the widget would keep reading empty vault notes and none of the ingested emails would show up. |

### Unified Todos widget (row 1, slot 3)

Single card with two stacked sections:

**Top section — "Needs review"**
- Shows up to 3 vault todo notes where `status: proposed`, ordered by `createdAt` desc.
- Each row: title, one-line context (resolved contact / deal name via `resolve-context.ts`), inline "Approve" and "Dismiss" buttons.
- If count > 3, a "View all N pending →" link beneath the list.
- Collapsed to zero height when no proposed todos exist (no empty state — the banner also doesn't render in that case).

**Bottom section — "Urgent"**
- Shows up to 5 vault todo notes where `status ∈ {pending, in_progress}` AND (`priority ∈ {urgent, high}` OR `due_date < startOfDay(today)`).
- Sorted by priority rank (`urgent, high, medium, low`), then `due_date` asc.
- Same visual style as the current `urgent-todos-card.tsx`.
- Clicking a row opens the existing `TodoDetailDrawer` unchanged.

Section headers use small uppercase labels (`text-xs uppercase tracking-wide text-muted-foreground`). Thin divider (`border-t`) between sections when both are present.

### Row 2 — new widgets

**New Leads**
- Grid slot: 1 column.
- Primary number: count of Prisma `Contact` where `leadStatus = 'new'` AND `archivedAt IS NULL`. Rendered in a danger-tint color when > 0.
- Sub-label: "new leads to review".
- Body: top 3 lead rows (sorted by `createdAt` desc) — name, `leadSource` (Crexi / LoopNet / Buildout / referral / email_cold), relative time.
- Footer: "View all N →" link to `/pages/leads` (hard dependency — see prerequisites).
- Red-dot indicator in the card header when count > 0.
- The count naturally drops as Matt acts on leads in the Leads tab (which flips `leadStatus` to `vetted` / `contacted` / `dropped`). No client-side "seen" tracking.

**Missed Follow-ups**
- Grid slot: 2 columns (wide card).
- Definition, precise: a Prisma `Contact` `C` is "missed" iff **all** of:
  - `C.archivedAt IS NULL`
  - `C.leadStatus ∉ {'dropped', 'converted'}` (already-closed leads don't count)
  - There exists a `Communication` row `I` such that `I.contactId = C.id` AND `I.direction = 'inbound'` AND `I.date < now() - interval '2 days'` (server timezone; documented)
  - There is no `Communication` row `O` such that `O.contactId = C.id` AND `O.direction = 'outbound'` AND `O.date > I.date`
  - `I.direction IS NOT NULL` (rows with unclassified direction are ignored, not counted as missing)
- Tiebreak when multiple inbound-without-reply messages exist for one contact: use the **oldest** inbound `I` as the "reference message" for the card.
- Order: by `I.date` ascending (oldest-overdue first). Limit 5.
- Each row: contact name, last-inbound subject preview (`<= 60 chars`), days-since chip (red ≥ 4 days, amber 2–3 days).
- Click: opens the contact detail drawer (existing pattern from Clients list).
- Footer: "View all N →" link to the Leads tab filtered by `needsFollowup=true` (the Leads tab spec is responsible for defining that filter).
- Empty state: "No follow-ups missed — nice work."
- Implementation note: in v1, implement this as a single Prisma query with a subquery or `groupBy` — benchmark at seed-data volume (hundreds of communications, dozens of contacts). If the query becomes a hotspot later, a denormalized `Contact.lastInboundAt` / `lastOutboundAt` pair can be added in a follow-up spec. Do not pre-optimize.

### Row 2 — remaining column

Row 2 uses `xl:grid-cols-4` like row 1: New Leads (1 col) + Missed Follow-ups (2 cols) = 3 cols. The remaining column is left empty at `xl` in v1. An "AI Tasks" numeric tile was considered, but the banner + Todos widget already cover that surface; adding a third copy is redundant.

If a v2 widget (Deals Closing Soon, Calendar, or Kanban Snapshot) arrives, it drops into this slot without a layout change.

---

## Data model

### Vault `TodoMeta` — extend status vocabulary

The vault `Todo` frontmatter schema in `@/lib/vault/shared` currently supports `status ∈ {pending, in_progress, done}` (matching the Prisma enum). Extend the vault-layer schema only:

```ts
// src/lib/vault/shared.ts — TodoMeta status field
status?: "proposed" | "pending" | "in_progress" | "done" | "dismissed"
// default when omitted stays "pending"
```

Plus a `source` field for provenance / audit:

```ts
source?: "manual" | "ai_email_scrub" | "buildout_event"
// default "manual"

// Optional link back to the run that proposed the todo — for audit / regeneration
proposedByRunId?: string
```

The **Prisma `TodoStatus` enum is not changed** in this spec. When and if a later spec migrates vault todos to Prisma, that spec is responsible for extending the Prisma enum and backfilling existing rows.

### Server actions — vault-backed approve / dismiss

Two new server actions, both in `app/[lang]/(dashboard-layout)/dashboards/home/_actions.ts`:

```ts
export async function approveProposedTodo(notePath: string): Promise<void>
export async function dismissProposedTodo(notePath: string): Promise<void>
```

- `approve` reads the vault note, flips `status` from `proposed` to `pending`, writes it back via the existing vault note writer.
- `dismiss` flips `status` to `dismissed`.
- Both call `revalidateTag('dashboard-data')` at the end (see §Refresh model).
- Both are idempotent: if the note's current status is already non-`proposed`, they no-op with a logged warning.
- Both validate that the caller is the authenticated single user (existing session guard pattern).

### `Contact` — no new fields required

Prisma `Contact` already has everything we need (verified in `schema.prisma`):

- `leadStatus: LeadStatus?` with `new | vetted | contacted | converted | dropped`
- `leadSource: LeadSource?` with `crexi | loopnet | buildout | email_cold | referral`
- `archivedAt: DateTime?`

No derived `lastInboundAt` / `lastOutboundAt` columns in v1 — Missed Follow-ups computes them inline. Add them in a later spec only if the dashboard query shows up in profiling.

### `User` — no new fields

The `dashboardLastVisitedAt` concept from the pre-review draft is **dropped**. The New Leads widget now derives its count from `leadStatus = 'new'`, which is state owned by the Leads tab spec (it flips `new` → `vetted` / `contacted` / `dropped` when Matt acts). No per-user visit tracking is needed, which also eliminates the concurrent-tab race and the focus-refresh-resets-the-counter bug flagged in review.

---

## Data loading

All fetch functions go in a new module `full-kit/src/lib/dashboard/queries.ts`:

```ts
getDashboardData(): Promise<{
  pipeline:         PipelineSnapshot
  todayAgenda:      AgendaEntry[]
  proposedTodos:    VaultNote<TodoMeta>[]          // source for Needs-review + banner
  urgentTodos:      VaultNote<TodoMeta>[]          // source for Urgent section
  todoContexts:     ReturnType<typeof resolveAllTodoContexts>
  recentComms:      CommunicationWithContact[]     // Prisma-backed
  newLeads:         { total: number; top: LeadPreview[] }
  missedFollowups:  MissedFollowup[]
}>
```

The page component becomes:

```ts
export default async function HomePage() {
  const data = await getDashboardData()
  // ... render widgets
  // no per-user visit timestamp to update
}
```

Single aggregated fetch, callable from the server component. Keeps the page component thin and makes the query module the obvious place to test / profile. Prisma queries are wrapped in `unstable_cache` tagged with `'dashboard-data'` so they participate in `revalidateTag`.

## Refresh model

Three layers:

1. **Initial load:** plain RSC — every fetch runs on the server, page is streamed.
2. **Revalidate on focus:** a small client wrapper `<RevalidateOnFocus />` in `app/[lang]/(dashboard-layout)/dashboards/home/_components/` calls `router.refresh()` when `window` fires a `focus` event and more than ~30 seconds have passed since the last refresh. Debounced so alt-tabbing rapidly doesn't flood the server. Safety: if a server action is in flight (tracked via a module-level flag set by the action wrapper), the focus handler skips the refresh and waits for the action's own revalidation to land.
3. **Mutation-driven:** approve / dismiss server actions call `revalidateTag('dashboard-data')` so all tagged queries invalidate and the page re-renders immediately. Using a **tag**, not a path, sidesteps the localized-route problem (`/en/dashboards/home` vs `/dashboards/home`) and means any future dashboard-touching action can invalidate by the same tag.

No polling. No SSE. No websockets. The only way data changes behind Matt's back is via the email-ingestion cron, and focus-revalidate catches that the moment he looks at the tab again.

---

## Layout

File layout changes:

```
full-kit/src/app/[lang]/(dashboard-layout)/dashboards/home/
  page.tsx                         # extended, not rewritten
  _actions.ts                      # NEW — approve/dismiss server actions
  _components/
    ai-approval-banner.tsx         # NEW
    todos-widget.tsx               # NEW (replaces urgent-todos-card.tsx)
    new-leads-widget.tsx           # NEW
    missed-followups-widget.tsx    # NEW
    revalidate-on-focus.tsx        # NEW
    urgent-todos-card.tsx          # REMOVE after replacement
    todo-checkbox.tsx              # KEEP — reused by todos-widget

full-kit/src/lib/dashboard/
  queries.ts                       # NEW — all dashboard data fetchers

full-kit/src/lib/vault/shared.ts   # EDIT — extend TodoMeta.status union
```

Grid:

```tsx
<section className="container max-w-screen-xl grid gap-6 p-6">
  <GreetingHeader ... />
  {proposedCount > 0 && <AIApprovalBanner ... />}

  {/* Row 1 */}
  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
    <PipelineCard ... />
    <TodayAgendaCard ... />
    <TodosWidget ... />
    <RecentActivityCard ... />
  </div>

  {/* Row 2 */}
  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
    <NewLeadsWidget ... />
    <MissedFollowupsWidget className="xl:col-span-2" ... />
    {/* empty slot for future v2 widget */}
  </div>

  <RevalidateOnFocus />
</section>
```

Responsive: `md:grid-cols-2` at tablet, single column below. No dedicated phone layout.

Styling: zero new theme tokens. All colors from existing shadcn theme. Red/amber/green chips reuse the pattern already in `urgent-todos-card.tsx`.

---

## Integration with sibling specs

| Sibling spec | What this spec depends on | What this spec contributes |
|---|---|---|
| Email Ingestion | Prisma `Communication` rows populated by `syncEmails()`; `direction` field non-null on classified rows; `Contact.leadStatus` / `leadSource` populated for ingested leads. | Nothing — read-only consumer. |
| Microsoft Graph Contact Sync | `Contact` rows with `archivedAt` preserved, `leadStatus` writable by downstream flows. | Nothing — read-only consumer. |
| **Leads tab UI (hard prerequisite)** | `/pages/leads` route exists and is registered in `full-kit/src/data/navigations.ts`. The Leads tab is also responsible for flipping `leadStatus` from `new` to its next state when Matt acts on a lead. | New Leads widget and Missed Follow-ups "View all" link here. |
| **AI email-scrub task gen (hard prerequisite)** | Scrub writes vault todo notes directly with `status: proposed`, `source: ai_email_scrub`, and (optionally) `proposedByRunId`. Scrub no longer writes `AgentAction(actionType='create-todo')` proposals for this pathway. `AgentAction` remains for non-todo actions (send-email, update-deal). | The vault `TodoMeta` status vocabulary extension in this spec is the contract the scrub spec writes to. Approve/dismiss server actions are the control plane. |
| Kanban pipeline redesign (future) | Pipeline widget links to `/apps/kanban` (already exists). | No data coupling. |

**Navigation:** no changes to `full-kit/src/data/navigations.ts` from this spec. Home already points at `/dashboards/home`. The Leads tab adds its own entry.

**Merge coordination:** this spec's PR cannot merge before both hard prerequisites land. If either slips, the PR sits in review or merges with its affected widget(s) rendering empty (graceful-degradation section below).

---

## Graceful degradation

Each new surface is empty-state-safe so the dashboard never breaks when upstream data is missing or sparse:

| Surface | Degrades to |
|---|---|
| AI Approval Banner | Fully hidden when no proposed todos exist |
| Todos widget – Needs review section | Section hidden (banner also hidden, so visible state is identical to the current Urgent-only card) |
| Todos widget – Urgent section | Standard empty state ("No urgent items right now.") |
| New Leads widget | Count `0`, no red dot, no list, link still present |
| Missed Follow-ups widget | "No follow-ups missed — nice work." |
| Recent Activity | Empty list message if Prisma `Communication` is empty |

Consequence: the new code is still mergeable even if an upstream spec temporarily ships with no data flowing through it — the dashboard reads as a calm empty state, not a broken page.

---

## Testing

- **Unit** — each query in `lib/dashboard/queries.ts` gets a Prisma-mocked (or vault-mocked, where applicable) test covering:
  - Missed Follow-ups: contacts with interleaved inbound/outbound, archived contacts, `leadStatus IN {dropped, converted}` contacts, `direction IS NULL` communications, multiple inbound-without-reply (oldest wins), exactly-at-2-days boundary
  - New Leads: `leadStatus = 'new'` filter, `archivedAt` exclusion
  - Todos: status vocabulary including `proposed` and `dismissed`, urgent-section sort order
- **Server actions** — `approveProposedTodo` / `dismissProposedTodo` each get tests for: happy path (reads, flips, writes, revalidates), already-terminal no-op with warning, unknown-path error, session-guard rejection
- **Vault schema** — a schema-validation test that `TodoMeta` accepts the new `proposed` and `dismissed` values and rejects garbage
- **Component smoke** — `TodosWidget` renders correctly in three states: proposed-only, urgent-only, both
- **E2E (optional, if Playwright exists):** load page, approve a proposed todo, verify it vanishes from the "Needs review" section and the banner count decrements

No visual-regression tests required in v1.

---

## Rollout

Single PR targeting main, no feature flag. Empty-state-safe degradation (table above) means the dashboard renders cleanly even if the two hard prerequisites haven't fully landed their data yet — this is the rationale for no flag, not an assumption that all upstream specs are ready.

Order of work for the implementation plan (written next by the writing-plans skill):

1. Extend vault `TodoMeta` status/source vocabulary; add schema-validation tests
2. `lib/dashboard/queries.ts` with unit tests (Prisma-mocked + vault-mocked)
3. Server actions (`approveProposedTodo`, `dismissProposedTodo`) with tests
4. `<RevalidateOnFocus />` client wrapper with debounce + in-flight-mutation check
5. Unified Todos widget (replaces `urgent-todos-card.tsx`); keep `todo-checkbox.tsx`
6. New Leads widget
7. Missed Follow-ups widget
8. AI Approval banner + focus-scroll wiring
9. Wire everything in `page.tsx`; delete `urgent-todos-card.tsx`; switch Recent Activity to Prisma `Communication`
10. Smoke test end-to-end with seeded data covering both populated and empty states

Each step is independently shippable; the dashboard stays functional throughout.
