# Dashboard Hub — Design

**Date:** 2026-04-24
**Author:** Zach Reichert (with Claude)
**Status:** Awaiting review
**Depends on:** [Email Ingestion](2026-04-23-email-ingestion-design.md), [Microsoft Graph Contact Sync](2026-04-22-contact-sync-design.md)
**Related (in flight):** Leads tab UI, AI email-scrub task generation, Kanban pipeline redesign

---

## Context

Matt Robertson opens the app in the morning and wants a single at-a-glance view of what's going on in his business — new leads, things he's forgetting, what the AI has proposed for him to do, what's urgent, what's scheduled. This is the primary surface he starts his day on, and usually the first page he navigates back to between other tasks.

A working dashboard already exists at `full-kit/src/app/[lang]/(dashboard-layout)/dashboards/home/page.tsx`. It has a greeting header and 4 widgets in a 4-column grid: Pipeline Snapshot, Today's Agenda, Urgent Todos, and Recent Activity. It reads from vault notes via `listNotes()` from `@/lib/vault`, is styled with shadcn `Card` primitives in the app's dark theme, and uses RSC.

That dashboard was built before the email-ingestion and Leads-tab work, so it's missing the highest-value surfaces the new data unlocks: the **new lead count** from Crexi/LoopNet/Buildout ingestion, the **missed-follow-ups** recovery view (the "Focused / Other leak" from Matt's Outlook inbox split), and the **AI task-approval inbox** for todos the email-scrub agent proposes.

This spec covers **an enhancement pass on `/dashboards/home`**: extending the existing page with 3 new widget surfaces, an AI-approval banner above the widget grid, and a unification of the existing Urgent Todos widget with the AI-proposed-task inbox under a single `Todo` model.

This spec does **not** cover:

- Rewriting the existing 4 widgets' visual design (keep what's there, swap data source only where needed)
- Building the Leads tab (separate spec in flight — dashboard only *links* to it)
- Generating the AI-proposed todos themselves (separate spec — dashboard only *reads + triages* them)
- Redesigning the Kanban pipeline (separate spec — dashboard only *links* to it)
- Calendar / upcoming-events widget beyond the existing Today's Agenda (depends on Outlook calendar ingestion, not yet spec'd)
- "Deals Closing Soon" weighted pipeline widget (v2)
- Drag-to-rearrange widget layout (YAGNI; Matt isn't using the app yet)
- Mobile phone layout (desktop is primary; iPad-size responsive is already handled by the existing grid)
- Real-time push (SSE / websockets) for dashboard updates (YAGNI for a single-user app)

## Goals

- Give Matt a one-screen snapshot each morning that surfaces the three things that matter most post-ingestion: new leads he hasn't seen, inbound that's gone unanswered, and AI-proposed tasks waiting for his approval
- Unify the existing Urgent Todos card and the new AI-proposed-task inbox behind a single `Todo` model, so there are no parallel task concepts in the data layer
- Keep the existing 4-widget row visually and behaviorally unchanged (preserve Matt's muscle memory once he starts using it); add new surfaces below rather than reshuffling the top
- Make every widget a pointer to a deeper view — the dashboard summarizes, the dedicated pages own full interaction
- Establish the refresh model (RSC + revalidate-on-focus + `revalidatePath` on mutations) as the pattern for other future dashboard-style pages

## Non-goals

- Treating the dashboard as a workspace (no inline bulk edit, no drag-reorder, no column-resize)
- Real-time push — a 5-minute staleness ceiling via focus-revalidate is acceptable
- A "what's changed since your last visit" diff feed — only the New Leads count uses last-visit state
- Client-side polling — all refresh is either on-focus or after-mutation
- Per-user preferences or widget-level customization (single user, fixed layout)

---

## Role in the app

| Surface | Role | Interaction level |
|---|---|---|
| **Dashboard** (this spec) | Morning briefing / between-tasks glance | Read-only summary; one-click approve/dismiss for AI todos; everything else is click-through |
| **Leads tab** (sibling) | Full triage queue for new inbound leads | Assign, tag, convert to Deal |
| **Kanban** | Deal-stage operations | Drag between stages, full deal detail |
| **`/apps/todos`** | Full todo management | Bulk edit, filter, sort |
| **Communications** | Message-by-message browsing | Thread detail, reply |

The dashboard shows the top N rows from each of these and links out. It does not replicate their interaction surface.

---

## Widget inventory

### Banner (new)

A full-width card rendered above the widget grid, visible only when `Todo.status = 'proposed'` count > 0.

- **Visual:** blue left-border accent on the card, a 🤖 glyph, count as the primary number ("5 AI-proposed tasks waiting for approval"), 3 top titles inline as a secondary line, "Review →" button on the right.
- **Action:** clicking "Review →" scrolls to (and focuses) the "Needs review" section of the Todos widget. An optional v1.1 could open a modal instead — defer that call to implementation.
- **Dismissal:** not persistent. Banner hides when count hits 0 via approve/dismiss actions, reappears next session if new proposed todos exist.
- **Hidden state:** if zero proposed todos, banner is fully omitted (no empty-state card).

### Row 1 — existing widgets (keep, minor updates)

| # | Widget | Data source today | Change in v1 |
|---|---|---|---|
| 1 | Pipeline Snapshot | `listNotes<DealMeta>("clients")` from vault | No change in this spec. Data-source swap to Prisma `Deal` is deferred to the Kanban spec. |
| 2 | Today's Agenda | `meetings` + `todos` vault notes | Filter `todos` to `status != 'proposed'` (don't show AI-unapproved items in Agenda). |
| 3 | **Todos (unified)** | `todos` vault | **Rewrite.** Two-section card — see below. Replaces current "Urgent Todos". |
| 4 | Recent Activity | `listNotes<CommunicationMeta>("communications")` | Switch source to Prisma `Communication` (populated by the email-ingestion spec). Order by `date` desc, take 5. |

### Unified Todos widget (row 1, slot 3)

Single card with two stacked sections:

**Top section — "Needs review"**
- Shows up to 3 `Todo` rows where `status = 'proposed'`, ordered by `createdAt` desc.
- Each row: title, one-line context (resolved contact / deal name), inline "Approve" and "Dismiss" buttons.
- If count > 3, a "View all N pending →" link beneath the list.
- Collapsed to zero height when no proposed todos exist (no empty state — the banner doesn't render either).

**Bottom section — "Urgent"**
- Shows up to 5 `Todo` rows where `status = 'active'` and (`priority IN ('urgent','high')` OR `dueDate < startOfDay(today)`).
- Sorted by priority rank (`urgent, high, medium, low`), then `dueDate` asc.
- Same visual style as the current Urgent Todos card.
- Clicking a row opens the same drawer the current `UrgentTodosCard` uses.

Section headers use small uppercase labels (`text-xs uppercase tracking-wide text-muted-foreground`). Thin divider (`border-t`) between sections when both are present.

### Row 2 — new widgets

**New Leads**
- Grid slot: 1 column.
- Primary number: count of `Contact` where `leadStatus = 'new'` AND `createdAt > user.dashboardLastVisitedAt`, rendered in a danger-tint color when > 0.
- Sub-label: "unread since last visit".
- Body: top 3 lead rows (sorted by `createdAt` desc) — name, source platform (Crexi / LoopNet / Buildout / referral), relative time.
- Footer: "View all N →" link to the Leads tab.
- Red-dot indicator in the card header when count > 0.

**Missed Follow-ups**
- Grid slot: 2 columns (wide card).
- Query: `Contact` where the most recent `Communication` is inbound (`direction = 'inbound'`), has no subsequent outbound, and is older than 2 calendar days. Limit 5, ordered oldest-first.
- Each row: contact name, last-inbound subject preview (`<= 60 chars`), days-since chip (red ≥ 4 days, amber 2–3 days).
- Click: opens the contact detail drawer (existing pattern from Clients list).
- Footer: "View all N →" link to the Leads tab filtered by `needsFollowup=true`.
- Empty state: "No follow-ups missed — nice work."

### Row 2 — remaining column

Row 2 is defined as `xl:grid-cols-4` like row 1: New Leads (1 col) + Missed Follow-ups (2 cols) = 3 cols. The remaining column is left empty at `xl` in v1. An "AI Tasks" numeric tile was considered, but the banner + Todos widget already cover that surface; adding a third copy is redundant.

If a v2 widget (Deals Closing Soon, Calendar, or Kanban Snapshot) arrives, it drops into this slot without a layout change.

---

## Data model

### `Todo` changes (Prisma)

```prisma
enum TodoStatus {
  proposed    // AI-generated, awaits Matt's approve/dismiss
  active      // approved or manually created, live on the todo list
  done
  dismissed   // explicitly rejected (soft-delete)
}

enum TodoSource {
  manual
  ai_email_scrub
  buildout_event
  // extendable per future ingester
}

model Todo {
  // existing fields preserved
  status           TodoStatus @default(active)
  source           TodoSource @default(manual)
  proposedByRunId  String?    // FK-ish link to the AI run that produced this (for audit / re-gen); nullable
  // indexes
  @@index([status])
  @@index([status, priority, dueDate])
}
```

Migration strategy: existing todo vault notes have no `status` concept. When we migrate vault → Prisma (likely the same PR), every imported todo gets `status = 'active'` and `source = 'manual'`. The migration is one-way; no rollback. A separate task to shim existing vault todos into Prisma can live in the implementation plan.

### `Contact` — no new fields required

Relies on fields added by the email-ingestion and contact-sync specs:

- `leadStatus` enum with at least `new`
- `leadSource` enum (`crexi`, `loopnet`, `buildout`, `referral`, `email_cold`)
- Derived-column pair `lastInboundAt` / `lastOutboundAt` (or a view / derived query) for the Missed Follow-ups query

If those derived columns don't exist yet, the dashboard query can compute them inline against `Communication` (slower, fine for a single-user app). Prefer inline query in v1; optimize to a denormalized column in a later spec only if the dashboard gets sluggish.

### `User` — add last-visit timestamp

```prisma
model User {
  // existing fields preserved
  dashboardLastVisitedAt DateTime?
}
```

Updated on every dashboard render (in the page's server component, before data fetch — read the current value, then fire-and-forget an update). Drives the "unread since last visit" count on the New Leads widget.

### Server actions

Both live in a new `app/[lang]/(dashboard-layout)/dashboards/home/_actions.ts`:

```ts
export async function approveProposedTodo(todoId: string): Promise<void>
export async function dismissProposedTodo(todoId: string): Promise<void>
```

- `approve` flips `status` to `active`.
- `dismiss` flips to `dismissed`.
- Both call `revalidatePath('/dashboards/home')` at the end.
- Both no-op (with a logged warning) if the todo is already in a terminal state.

---

## Data loading

All fetch functions go in a new module `full-kit/src/lib/dashboard/queries.ts`:

```ts
getDashboardData(userId: string): Promise<{
  pipeline:         PipelineSnapshot
  todayAgenda:      AgendaEntry[]
  proposedTodos:    TodoWithContext[]
  urgentTodos:      TodoWithContext[]
  recentComms:      CommunicationWithContact[]
  newLeads:         { total: number; unreadSinceLastVisit: number; top: LeadPreview[] }
  missedFollowups:  MissedFollowup[]
  lastVisitedAt:    Date | null
}>
```

The page component becomes:

```ts
export default async function HomePage() {
  const userId = await getCurrentUserId()
  const data = await getDashboardData(userId)
  // ... render widgets
  // fire-and-forget: update dashboardLastVisitedAt = now
}
```

Single aggregated fetch. Keeps the page component thin and makes the query module the obvious place to test / profile.

## Refresh model

Three layers:

1. **Initial load:** plain RSC — every fetch runs on the server, page is streamed.
2. **Revalidate on focus:** a small client wrapper `<RevalidateOnFocus />` in `app/[lang]/(dashboard-layout)/dashboards/home/_components/` calls `router.refresh()` when `window` fires a `focus` event and more than ~30 seconds have passed since the last refresh. Debounced so alt-tabbing rapidly doesn't flood the server.
3. **Mutation-driven:** approve / dismiss server actions call `revalidatePath('/dashboards/home')` so the page re-renders immediately with fresh data (no client-side optimistic state needed for v1).

No polling. No SSE. No websockets. The only way data changes behind Matt's back is via the email-ingestion cron, and focus-revalidate catches that the moment he looks at the tab again.

**"Last updated" indicator:** optional — a small timestamp below the greeting showing `formatDistanceToNow(data.lastVisitedAt)`. Nice-to-have, can be dropped if it clutters the header.

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
```

Grid:

```tsx
<section className="container max-w-screen-xl grid gap-6 p-6">
  <GreetingHeader ... />
  {proposedCount > 0 && <AIApprovalBanner ... />}

  {/* Row 1 — existing */}
  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
    <PipelineCard ... />
    <TodayAgendaCard ... />
    <TodosWidget ... />
    <RecentActivityCard ... />
  </div>

  {/* Row 2 — new */}
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
| Email Ingestion | Prisma `Communication` rows (populated by `syncEmails()`). `direction` field on Communication for inbound/outbound distinction. `Contact.leadSource` / `leadStatus` for lead rows. | Nothing — read-only consumer. |
| Microsoft Graph Contact Sync | `Contact` rows to join against `Communication`. | Nothing — read-only consumer. |
| Leads tab UI (in flight) | None — the widget just links with `<Link href="/pages/leads">`. | New Leads widget acts as entry point. |
| AI email-scrub task gen (in flight) | Writes `Todo` rows with `status='proposed'`, `source='ai_email_scrub'`. | The `Todo` status/source enums in this spec become the contract. Approve/dismiss server actions become the control-plane. |
| Kanban pipeline redesign (in flight) | Pipeline widget links to `/apps/kanban`. | No data coupling in v1. |

**Navigation:** no changes to `full-kit/src/data/navigations.ts`. Home already points at `/dashboards/home`. The Leads-tab spec will add its own nav entry separately.

---

## Testing

- **Unit** — each query in `lib/dashboard/queries.ts` gets a Prisma-mocked unit test covering the filter logic (esp. Missed Follow-ups direction / no-subsequent-outbound logic).
- **Server actions** — `approveProposedTodo` / `dismissProposedTodo` each get a test for: happy path, already-terminal no-op, unknown-id error.
- **Component smoke** — `TodosWidget` renders correctly in three states: (a) proposed only, (b) urgent only, (c) both.
- **E2E (optional, if framework exists):** one Playwright test that loads the page, approves a proposed todo, and verifies it vanishes from the "Needs review" section and the banner count decrements.

No visual-regression tests required in v1.

---

## Rollout

Single-PR change. No feature flag — the dashboard is already in production, and the new surfaces hide themselves gracefully when their underlying data is empty (zero proposed todos → no banner, zero new leads → widget shows "0" with no red dot, etc.). If email ingestion hasn't run yet, every new widget renders its empty state and nothing breaks.

Order of work in the implementation plan (to be written by the writing-plans skill next):

1. Data model changes (`Todo` enum additions, `User.dashboardLastVisitedAt`, migration)
2. `lib/dashboard/queries.ts` with unit tests
3. Server actions + tests
4. Unified Todos widget (replaces existing Urgent Todos)
5. New Leads widget
6. Missed Follow-ups widget
7. AI Approval banner
8. `RevalidateOnFocus` client wrapper
9. Wire everything in `page.tsx`, remove old `urgent-todos-card.tsx`
10. Smoke test end-to-end with seeded data

Each step is independently shippable; the dashboard stays functional throughout.
