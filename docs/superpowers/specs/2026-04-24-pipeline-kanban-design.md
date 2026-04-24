# Pipeline Kanban Design

**Date:** 2026-04-24
**Status:** Draft (spec)
**Scope:** Kanban pipeline view for Leads and Deals, plus a read-only dashboard snapshot widget. Replaces the existing vault-backed `/apps/kanban`.

---

## 1. Goal

Give Matt a CRE1Source-style pipeline board: cards arranged by status/stage across columns, drag to advance, weighted commission visible at a glance. Two boards — **Lead Pipeline** (pre-deal contacts) and **Deal Pipeline** (active listings/transactions) — both Prisma-backed, both colocated with their list views under a view toggle.

**Non-goals:** multi-user assignment, workflow automation, custom pipelines, Gantt/timeline views.

---

## 2. Scope

| Board | Entity | Columns | Route |
|---|---|---|---|
| **Lead Pipeline** | `Contact` where `leadStatus IS NOT NULL` | `LeadStatus` enum: `new`, `vetted`, `contacted`, `converted`, `dropped` | `/pages/leads?view=kanban` |
| **Deal Pipeline** | `Deal` | `DealStage` enum: `prospecting`, `listing`, `marketing`, `showings`, `offer`, `under_contract`, `due_diligence`, `closing`, `closed` | `/pages/deals?view=kanban` |

Columns are **fixed to the Prisma enums** — no add/remove/reorder. No per-user customization in v1.

**Single URL per entity, List/Kanban toggle** (`view=list` default, `view=kanban`). Matches Linear/Pipedrive/HubSpot convention; prevents two surfaces drifting apart.

The existing `/apps/kanban` (vault-backed) is **deprecated and removed**. Reusable board components are extracted into `src/components/kanban/` and consumed by both boards.

---

## 3. Data Model

### 3.1 Prisma additions

```prisma
model Deal {
  // ... existing fields ...
  commissionRate  Decimal?  @default(0.03) @db.Decimal(5, 4) @map("commission_rate")
  probability     Int?      // 0–100; null = use stage default from code table
  stageChangedAt  DateTime? @map("stage_changed_at")
}

model Contact {
  // ... existing fields ...
  estimatedValue  Decimal?  @db.Decimal(14, 2) @map("estimated_value")
}
```

**Rationale:**
- `commissionRate` per-deal (real CRE listings vary; 3% default is the industry-standard buyer-side rate).
- `probability` is a per-deal *override*. When null, the stage-default table applies. This matches how every real CRE CRM handles weighting.
- `stageChangedAt` is required for honest "age in current stage" math — "days since listed" is misleading once a deal has progressed.
- `Contact.estimatedValue` lets the AI email-scrub sibling spec or manual entry populate a value for leads that haven't become deals yet. Null renders `—`.

### 3.2 Code-level stage-probability table

Lives in `src/lib/pipeline/stage-probability.ts` (NOT a DB enum — code evolves faster than migrations):

```ts
export const DEAL_STAGE_PROBABILITY: Record<DealStage, number> = {
  prospecting:    10,
  listing:        25,
  marketing:      40,
  showings:       55,
  offer:          70,
  under_contract: 85,
  due_diligence:  90,
  closing:        95,
  closed:         100,
}
```

A compile-time check (`Record<DealStage, number>`) keeps this table exhaustive when the enum grows.

### 3.3 Weighted commission formula

Single utility `computeWeightedCommission(deal)`:

```ts
const rate = Number(deal.commissionRate ?? 0.03)
const prob = (deal.probability ?? DEAL_STAGE_PROBABILITY[deal.stage]) / 100
const value = Number(deal.value ?? 0)
return value * rate * prob
```

Closed deals → `probability = 100` → weighted = actual earned commission.

---

## 4. UI Structure

### 4.1 Header (both boards)

```
[Board Title]  [🔍 search…]  [Source ▾]  [Type ▾]  [Age ▾]   [List | Kanban]   [⋯ Show all]
```

- **Search:** debounced 250ms, filters cards in-place.
  - Deal board searches `propertyAddress`, `contact.name`, `contact.company`.
  - Lead board searches `name`, `company`, `email`, email-snippet body.
- **Source filter:** `LeadSource` enum — applies to both boards (Deal resolves via `deal.contact.leadSource`).
- **Type filter:** `PropertyType` enum (Deal board only).
- **Age filter:** `<7d | 7–30d | 30–90d | >90d`.
- **List/Kanban toggle:** writes `view=` query param.
- **Show all:** disables terminal-column time-windowing.

All filter state lives in URL query params so views are shareable/refreshable.

### 4.2 Column header

```
┌─────────────────────────────────┐
│ Offer                    [ 3 ]  │  ← title + count pill
│ $6.2M gross     ~$130k weighted │  ← totals row (Deal board)
└─────────────────────────────────┘
```

- **Deal board totals:** `gross sum` (neutral) + `weighted sum` (green, bold).
- **Lead board totals:** `count` + `est. value sum` (green). Leads without `estimatedValue` are excluded from the sum (no guessing).

### 4.3 Terminal-column time-windowing

Server-side filter at the Prisma query layer:
- Deals `closed`: `updatedAt >= now() - interval '90 days'` unless `?showAll=1`.
- Leads `converted` / `dropped`: `updatedAt >= now() - interval '30 days'` unless `?showAll=1`.

Rationale: matches Pipedrive/HubSpot/Salesforce default behavior. Prevents terminal columns from burying signal over time.

### 4.4 Deal card

```
┌─────────────────────────────────┐
│ [Retail]              70%       │  ← property-type badge + probability pill
│ 1420 Main St, Springfield       │  ← address
│ Patel Holdings LLC              │  ← client name
│ ─────────────────────────────── │
│ $2.8M    ~$59k    34d           │  ← value / weighted / age-in-stage
└─────────────────────────────────┘
```

- **Age** = `differenceInDays(now, stageChangedAt ?? listedDate)`.
- **Weighted** renders `—` if `value` is null.
- **Click:** navigates to `/pages/deals/:id`.

### 4.5 Lead card

```
┌─────────────────────────────────┐
│ [Crexi]                   5d old│  ← source badge + age
│ Dana Morales                    │  ← name
│ Morales Medical Group · dentist │  ← company · role
│ ┃ "Looking for 3,000–4,000 sqft │  ← email snippet (italic, left border)
│ ┃  medical office near I-40…"   │
│ ─────────────────────────────── │
│ ~$1.2M est      Last touch: 2d  │  ← est value / last-touch age
└─────────────────────────────────┘
```

- **Age** = `differenceInDays(now, leadAt)`.
- **Last touch** = `differenceInDays(now, MAX(communication.date WHERE contactId = :id))`.
- **Email snippet:** first 140 chars of earliest inbound `Communication` for the contact: `WHERE contactId = :id AND direction = inbound ORDER BY date ASC LIMIT 1`. Hidden when no inbound communication exists.
- **Est. value** renders `—` when `Contact.estimatedValue` is null.
- **Click:** navigates to `/pages/leads/:id`.

### 4.6 Dashboard snapshot widget

Component: `<PipelineSnapshot board="deals" | "leads" />`.

- Read-only, **no drag-drop**.
- Columns = top 3 *active* stages:
  - Deals: `offer`, `under_contract`, `closing`.
  - Leads: `new`, `vetted`, `contacted`.
- Max 3 cards per column; sorted by `weighted $ DESC` (deals) or `leadAt DESC` (leads).
- "+N more" footer when a column has more.
- **Compact card:** single line — `[Badge] Title · $value`. No probability pill, no email snippet, no last-touch.
- Footer link: `View full pipeline →` → `/pages/{leads|deals}?view=kanban`.

---

## 5. Drag-Drop & Persistence

### 5.1 Behavior

- `onDragEnd` fires an optimistic reducer update, then a PATCH to the API.
- On failure: reducer rollback + `toast.error("Couldn't update stage — try again")`.
- **Intra-column reorder is client-only and ephemeral** — kanban order within a column is derived from `updatedAt DESC`. We do NOT persist a per-card `order` field (YAGNI; Matt works alone and won't manually reshuffle within a column).
- **Cross-column drag** PATCHes only the status field.

### 5.2 Special cases

- **Deal stage change:** server sets `stageChangedAt = now()` on every stage PATCH (regardless of direction).
- **Lead status change:** server leaves `leadAt` untouched on every update *except* when transitioning from `null → new` (first-time lead creation — shouldn't happen via drag, but guarded).
- **Lead → `converted`:** opens a `CreateDealModal` seeded with `{ contactId, estimatedValue → value, propertyType }`. Submitting the modal creates the Deal. Dismissing the modal still converts the lead but no Deal is created (the user may convert on another channel).
- **Concurrent edits:** last-write-wins; Matt is the only user. No locking.

### 5.3 API endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/api/leads` | query: `source`, `age`, `search`, `showAll` | `{ columns: { [status]: LeadCard[] } }` |
| `PATCH` | `/api/leads/:id` | `{ leadStatus }` | updated `Contact` |
| `GET` | `/api/deals` | query: `propertyType`, `source`, `age`, `search`, `showAll` | `{ columns: { [stage]: DealCard[] } }` |
| `PATCH` | `/api/deals/:id` | `{ stage?, probability?, commissionRate? }` | updated `Deal` |
| `POST` | `/api/deals` | `{ contactId, propertyType, value, ... }` | new `Deal` (used by conversion modal) |

Response shape for `GET` endpoints includes per-column aggregates (`count`, `grossSum`, `weightedSum` or `estValueSum`) so the client doesn't recompute.

---

## 6. Component Architecture

**Shared, generic (extracted from existing `/apps/kanban`):**
```
src/components/kanban/
  kanban-board.tsx          # DragDropContext wrapper
  kanban-column-list.tsx    # columns layout
  kanban-column.tsx         # header + droppable
  kanban-card-shell.tsx     # draggable wrapper (handles, focus)
  kanban-context.tsx        # reducer + context
  kanban-reducer.ts
  types.ts                  # generic ColumnType<T>, TaskType<T>
```

**Board-specific:**
```
src/app/[lang]/(dashboard-layout)/pages/leads/
  page.tsx                  # list/kanban switch on ?view=
  _components/
    leads-kanban.tsx        # wires GET /api/leads into shared board
    lead-card.tsx           # source badge, email snippet, est. value
    lead-column-header.tsx  # count + est. value sum
    create-deal-modal.tsx   # fired on drag-to-converted

src/app/[lang]/(dashboard-layout)/pages/deals/
  page.tsx                  # list/kanban switch on ?view=
  _components/
    deals-kanban.tsx
    deal-card.tsx           # property badge, probability pill, weighted $
    deal-column-header.tsx  # gross + weighted sum

src/components/dashboard/
  pipeline-snapshot.tsx     # compact widget for dashboard hub
```

**Shared utilities:**
```
src/lib/pipeline/
  stage-probability.ts      # DEAL_STAGE_PROBABILITY table
  weighted-commission.ts    # computeWeightedCommission()
  age-buckets.ts            # <7d | 7-30d | 30-90d | >90d helpers
```

---

## 7. Migration from `/apps/kanban`

1. **Prisma migration** adds `Deal.commissionRate`, `Deal.probability`, `Deal.stageChangedAt`, `Contact.estimatedValue`. Backfill `stageChangedAt = updatedAt` for existing rows.
2. **Extract shared components** from `apps/kanban/_components/` into `src/components/kanban/` as generic primitives (no vault coupling).
3. **Delete** `apps/kanban/page.tsx`, `_data/kanban.ts`, and the vault-loader path. Delete `apps/kanban/_components/pipeline-header.tsx` and `deal-card.tsx` (replaced by board-specific files).
4. **Nav:** replace the "Apps → Kanban" menu link with "Pages → Leads" and "Pages → Deals" entries (both routes exist; they gain a view toggle).
5. **Vault sync:** this spec assumes the Contact/Deal vault-to-Prisma migration is complete (covered by the sibling `2026-04-22-contact-sync-design.md`). If any vault-only deals remain, they will not appear on the new board until migrated.

---

## 8. Relationship with Sibling Specs

- **`2026-04-23-leads-tab-ui-design.md`** — that spec describes the list view at `/pages/leads`. This spec adds the kanban *mode* at the same URL (`?view=kanban`). The list view keeps its status chip and adds a "Kanban" toggle in its header. Drag-to-change-status is kanban-only; the list view uses a dropdown.
- **`2026-04-24-dashboard-hub-design.md`** — that spec places the `<PipelineSnapshot />` widget on the dashboard hub. Contract defined here; implementation wiring lives in that spec.
- **AI email-scrub** (separate spec) — populates `Contact.estimatedValue` and the email snippet source (earliest inbound Communication). No direct UI overlap.

---

## 9. Testing

**Unit**
- `computeWeightedCommission()` — across all 9 stages; with/without probability override; null `value` / `commissionRate` guards.
- `DEAL_STAGE_PROBABILITY` — compile-time exhaustive (Record<DealStage, number>).
- Age-bucket helpers — boundary values (6d → `<7d`; 7d → `7–30d`).

**Integration (API)**
- `PATCH /api/deals/:id { stage }` updates `stageChangedAt`.
- `GET /api/deals?showAll=0` excludes `closed` deals older than 90d; `showAll=1` includes them.
- `GET /api/leads?showAll=0` excludes `dropped`/`converted` leads older than 30d.
- `PATCH /api/leads/:id { leadStatus: 'converted' }` — does not auto-create a Deal (client-side modal is responsible).

**E2E (Playwright)**
- Drag Deal from `offer` → `under_contract`: optimistic update, persists, weighted totals recompute.
- Drag Lead to `converted`: modal opens with pre-filled fields from `Contact`.
- PATCH failure: toast + card returns to original column.
- View toggle: navigating `?view=kanban` → `?view=list` → `?view=kanban` preserves filter state.

---

## 10. Error Handling

| Case | Behavior |
|---|---|
| PATCH fails | Reducer rollback + `toast.error` |
| Concurrent edit | Last-write-wins (single-user tool) |
| Missing `Deal.value` | Weighted `—`; column weighted sum = skip (don't crash) |
| Missing `Contact.estimatedValue` | Card shows `—`; column est. value sum = skip |
| Missing stage probability (impossible via compile check) | Treat as 0% |
| No inbound communication for lead | Email snippet block hidden; card remains valid |

---

## 11. Open Questions (for implementation plan)

None blocking. Two minor items to address during planning:
- Does the list-view header gain the same filter controls, or do we keep filters kanban-only in v1? Default: share the filters between views (same URL params).
- Do we want an explicit "Reset probability to stage default" button on the Deal detail view? Default: yes, it's trivial and prevents forever-stale overrides.
