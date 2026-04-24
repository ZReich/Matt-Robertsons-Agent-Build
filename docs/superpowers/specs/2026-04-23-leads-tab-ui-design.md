# Leads Tab UI — Design Spec

**Date:** 2026-04-23
**Status:** approved (brainstorm complete, plan pending)
**Sibling specs:** AI email scrub, Dashboard hub, Pipeline kanban (each chipped, separate sessions)

## Goal

Surface auto-extracted CRE leads (Crexi / LoopNet / Buildout / cold email / referral) as a first-class section of the app so Matt can review what came in, see what each inquirer asked, and advance status without manual triage. The list and detail layouts pin the location of an AI Suggestions slot so a separate spec can fill it later without touching this UI.

## Non-goals (v1)

- Generating AI suggestions or tasks (separate spec)
- Kanban / pipeline view (separate spec)
- Dashboard widgets / unified hub (separate spec)
- Manual "Add Lead" action
- Bulk actions on leads
- Deal creation from a lead (Convert moves to Client; deal flow is downstream)

## Architecture

```
src/app/[lang]/(dashboard-layout)/pages/leads/
  page.tsx                 # RSC — list view (direct Prisma)
  [id]/page.tsx            # RSC — detail view (Promise.all fetch)

src/app/api/vault/leads/
  [id]/route.ts            # PATCH leadStatus / notes
  [id]/view/route.ts       # POST mark-as-viewed
  [id]/convert/route.ts    # POST lead → Client transition

src/components/leads/
  leads-table.tsx          # client — TanStack table, filters, sort
  lead-row.tsx             # client — two-line row (layout B)
  lead-detail-header.tsx   # client — name + status action buttons
  inquiry-quote.tsx        # server — pulls extractor metadata
  activity-timeline.tsx    # server — Communications reverse-chrono
  contact-card.tsx         # server — sidebar contact info
  notes-card.tsx           # server — sidebar notes
  lead-ai-suggestions.tsx  # client — placeholder slot (see AI hook contract)
  unread-badge.tsx         # server — sidebar nav count badge

src/data/navigations.ts    # MODIFY — add "Leads" item under People

prisma/schema.prisma       # MODIFY — add Contact.leadLastViewedAt
```

Mirrors the existing Clients tab pattern (RSC + `Promise.all` fetch, vault API for mutations). Reuses shadcn UI primitives, TanStack Table v8, Lucide icons, and existing email-row styling for the activity timeline.

## Data model changes

### `prisma/schema.prisma` — Contact

Add one nullable timestamp:

```prisma
model Contact {
  // existing fields ...
  leadLastViewedAt DateTime? @map("lead_last_viewed_at")

  @@index([leadSource, leadStatus, leadLastViewedAt])
}
```

Index supports the unread-count query (filter on `leadSource IS NOT NULL` + status + last-viewed).

No other schema changes. The `LeadSource`, `LeadStatus`, `leadSource`, `leadStatus`, `leadAt` columns landed in the email-ingestion spec.

## List view

### Route
`/pages/leads`

### Query (RSC, direct Prisma)

Default filter is "active leads" — anything `leadSource IS NOT NULL AND leadStatus NOT IN ('converted', 'dropped')`. The "Show all" toggle removes the status exclusion.

```ts
const leads = await db.contact.findMany({
  where: {
    leadSource: { not: null },
    leadStatus: { notIn: ["converted", "dropped"] },
    // plus user-applied search / source-pill / status-pill filters
  },
  include: {
    communications: {
      orderBy: { date: "desc" },
      take: 1,                       // for the snippet line
    },
  },
  orderBy: [{ leadAt: "desc" }],     // unread bump computed client-side per row
});
```

Unread is computed in the RSC after the fetch (cheap — one boolean per row from already-loaded fields), then sort is finalized client-side. No separate unread-count subquery needed at row level.

### Filters & toolbar
- **Status pills:** All · New · Vetted · Contacted (excludes converted/dropped from default — those are surfaced via a separate "Show all" toggle)
- **Source pills:** All · Crexi · LoopNet · Buildout · Email · Referral
- **Search:** name / company / email (TanStack `globalFilterFn: "includesString"`)

### Row layout (Layout B — approved)
Two-line row:

```
[●] Name · Company             inquirer@email.com         [crexi]    [new]    Apr 22, 2:14pm  ›
    "Inline snippet of what the inquirer asked, line-clamped to one line"
```

- Unread dot (left) — present iff row is unread per the rule below
- Source badge (color per source: crexi orange, loopnet blue, buildout purple, email gray, referral teal)
- Status chip (color per status: new blue, vetted gray, contacted amber, converted/dropped muted)
- Snippet pulled from `communications[0].metadata->'extracted'->'inquirer'->>'message'` if present, else from `communications[0].subject`
- Click → `/pages/leads/[id]`

### Sort
1. Unread first (computed in RSC, sent as boolean column)
2. `leadAt` desc

### Empty state
"No leads yet — they'll show up here as emails arrive from Crexi, LoopNet, or Buildout."

## Detail view

### Route
`/pages/leads/[id]` — `id` is the Contact id.

### Layout (Layout B — approved)

```
┌─────────────────────────────────────────────────────────────────┐
│ John Smith · Acme Holdings                  [Vetted] [Contacted]│
│ crexi · new lead · Apr 22, 2:14pm                [Drop] [Convert→]
├──────────────────────────────────────┬──────────────────────────┤
│ INQUIRY                              │ CONTACT                   │
│ "Interested in 1820 Keller..."       │ Email   john.smith@...   │
│                                      │ Phone   (415) 555-0142   │
│ ACTIVITY                             │ Company Acme Holdings    │
│ ↓ inbound · subject · date           ├──────────────────────────┤
│   body...                            │ AI SUGGESTIONS            │
│ ↑ outbound · re: subject · date      │ (placeholder slot)        │
│   body...                            ├──────────────────────────┤
│                                      │ NOTES                     │
│                                      │ (markdown)                │
└──────────────────────────────────────┴──────────────────────────┘
```

### Data fetching (RSC, `Promise.all`)

```ts
const [contact, comms] = await Promise.all([
  db.contact.findUnique({ where: { id }, include: { /* notes */ } }),
  db.communication.findMany({
    where: { contactId: id },
    orderBy: { date: "desc" },
  }),
]);
```

### Components

| Component | Type | Renders |
|---|---|---|
| `LeadDetailHeader` | client | name, meta, status action buttons |
| `InquiryQuote` | server | quote-styled block of `comms[last].metadata->extracted.inquirer.message`, falls back to first inbound `body` snippet |
| `ActivityTimeline` | server | reverse-chrono list of all `Communication` rows; row styling reuses email-app row patterns; inbound = blue arrow, outbound = green arrow |
| `ContactCard` | server | email / phone / company / source / lead date |
| `LeadAISuggestions` | client | placeholder — see AI hook contract |
| `NotesCard` | server | renders `Contact.notes` markdown; "No notes yet" empty state |
| `MarkViewedOnMount` | client | small island that fires `POST /api/vault/leads/[id]/view` once on mount |

### Status action buttons

Header buttons map to `PATCH /api/vault/leads/[id]` with `{ leadStatus: 'vetted' | 'contacted' | 'dropped' }`. The `Convert →` button is special — opens a confirm dialog and POSTs to `/api/vault/leads/[id]/convert`.

The current status is shown as the chip immediately after the meta line (matching mockup B).

## Unread tracking

### Definition (hybrid — chosen at brainstorm)

A lead is unread when **either**:
1. `leadStatus === 'new'` — the lead has never been triaged, OR
2. There exists an inbound `Communication` newer than `Contact.leadLastViewedAt` (or newer than `leadAt` if never viewed)

### Where it surfaces

- **Per-row dot** in the list view
- **Sidebar tab badge** (red count) via `<UnreadBadge tab="leads" />` — server-rendered count of unread leads, queried with the new index

### Read mechanic

Detail page renders `<MarkViewedOnMount />` which calls `POST /api/vault/leads/[id]/view`:
```ts
await db.contact.update({
  where: { id },
  data: { leadLastViewedAt: new Date() },
});
```

Idempotent. Does **not** change `leadStatus` — Matt has to explicitly click Vetted / Contacted / etc. to flip status away from `new`.

## API surface

All under `src/app/api/vault/leads/`. Mirrors the existing `vault/contacts` and `vault/clients` route patterns.

| Method | Path | Body | Returns |
|---|---|---|---|
| PATCH | `/[id]` | `{ leadStatus?: LeadStatus, notes?: string }` | updated Contact (lead-relevant fields) |
| POST | `/[id]/view` | — | `{ ok: true, leadLastViewedAt }` |
| POST | `/[id]/convert` | — | `{ ok: true, clientId }` (creates Client row in transaction; sets `leadStatus='converted'`) |

List and single-lead **reads** go through Prisma directly in RSCs — no GET endpoints needed (matches Clients pattern).

### `/[id]/convert` semantics

In a single transaction:
1. Verify the Contact has `leadSource` set
2. If a `Client` row already exists for this Contact (matched by email), return `409 already_client` with the existing client id
3. Else create a Client row from the Contact's `name` / `email` / `phone` / `company` / `notes`
4. Set `Contact.leadStatus = 'converted'` (the Contact row stays — Client and Contact are separate entities; the same person now exists in both, with `leadStatus='converted'` marking the Contact as no longer a working lead)
5. Return `{ ok: true, clientId }`

Does **not** create a Deal — that's a downstream user action on the Client page.

## AI hook contract

```ts
// src/components/leads/lead-ai-suggestions.tsx
export interface LeadAISuggestionsProps {
  contactId: string;
  leadId?: string; // == contactId for now; reserved for future split
}

export function LeadAISuggestions(
  props: LeadAISuggestionsProps,
): Promise<JSX.Element>;
```

### v1 behavior

Server component that queries an `AISuggestion` table for `contactId = props.contactId`. The table is created by the AI scrub spec; until that lands, this component:

- Returns the empty-state card with copy:
  > *AI suggestions will appear here once this lead is processed.*
- Logs no error if the table is missing — wrap the query in a try/catch that swallows `PrismaClientKnownRequestError` with code `P2021` (table does not exist) and returns the empty state.

### Future contract (filled by AI spec — informational only)

The AI scrub spec will define rows like:
```
AISuggestion { id, contactId, communicationId, kind: "task"|"reply"|"note",
               summary, suggestedAction, status: "pending"|"approved"|"dismissed",
               createdAt }
```

`LeadAISuggestions` will render pending rows with approve / dismiss controls inline. **All of that lives in the AI spec, not this one.**

## Sidebar nav

Modify `src/data/navigations.ts`:

```ts
{
  group: "People",
  items: [
    { label: "Clients",  href: "/pages/clients" },
    { label: "Leads",    href: "/pages/leads", badge: <UnreadBadge tab="leads" /> },
    { label: "Contacts", href: "/pages/contacts" },
  ],
}
```

Order is intentional: Clients (your active work), Leads (incoming), Contacts (everything).

## Testing

### Unit / component
- `unreadFor(lead, comms, lastViewedAt) → boolean` — pure function, exhaustive cases for the OR condition
- Filter pill state changes the table query — RTL render test
- Status button click invokes correct PATCH — mocked fetch
- Convert dialog confirm path POSTs and navigates to client detail — mocked fetch + router

### Integration
- Lead row → click → detail page renders inquiry + activity
- Mark-viewed endpoint flips `leadLastViewedAt` and the same lead no longer appears unread on next list render
- Convert endpoint creates a `Client` row idempotently (second call returns 409)
- Sidebar `UnreadBadge` reflects post-mutation state on revalidation

### Manual smoke
- Trigger a real Crexi inquiry email through the email-sync endpoint and confirm it appears in the Leads list, the inquiry quote populates from extractor metadata, and viewing it clears the unread dot.

## Open follow-ups (not blocking this spec)

- AI Suggestions table + pipeline (sibling spec)
- Pipeline kanban view as alternative to the list (sibling spec)
- Dashboard hub showing unread-leads count + tasks (sibling spec)
- Manual "Add Lead" action — likely added when referral / cold-email sources need a self-service entry
- Bulk actions (select N, drop all) — defer until volume warrants it
