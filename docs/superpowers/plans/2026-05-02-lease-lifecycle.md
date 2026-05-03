# Lease Lifecycle Tracking + Re-engagement Implementation Plan

**Date:** 2026-05-02
**Source:** Zach's directive to "use sub agent driven development for all of this... put together the plan, set up all the scaffolding, build all of that in, and then we'll move forward... so the only thing that should be left is to plug in an AI model to run it."

**Goal:** Surface every lease in Matt's history, alert him before each one expires, and auto-draft re-engagement emails so he stops losing renewals he'd otherwise forget about.

## What this delivers

1. Email-history scan reaches back 10 years (currently 90 days)
2. Closed-deal emails get auto-detected; the contact becomes a `past_client` (or stays an `active_listing_client`)
3. Lease-end dates land on the calendar as recurring renewal events
4. Configurable lookahead (default 6 months) triggers a Todo + dashboard banner + auto-drafted re-engagement email
5. The re-engagement email follows the same Pending Replies / auto-send pattern as the existing auto-reply system

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Microsoft Graph                                                │
│   (Outlook archive — going back 10 years)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ paginated date-range fetch
                           ▼
       ┌──────────────────────────────────────┐
       │  Email-history backfill (Stream D)   │
       │  src/lib/msgraph/email-history-      │
       │  backfill.ts                         │
       └──────────────────────────────────────┘
                           │
                           ▼  Communication rows in DB
       ┌──────────────────────────────────────┐
       │  Closed-deal classifier (Stream C-1) │  ←── DeepSeek (cheap broad scan)
       │  src/lib/ai/closed-deal-classifier.ts│
       └──────────────────────────────────────┘
                           │ candidates only
                           ▼
       ┌──────────────────────────────────────┐
       │  Lease/deal extractor (Stream C-2)   │  ←── US model (Claude Haiku)
       │  src/lib/ai/lease-extractor.ts       │      ↑ AI prompt is the only
       │  (PROMPT IS A STUB)                  │        blank when done
       └──────────────────────────────────────┘
                           │
                           ▼  LeaseRecord row created
       ┌──────────────────────────────────────┐
       │  Side effects (Stream A + E):        │
       │   - Contact.clientType ← past_/      │
       │     active_*_client                  │
       │   - CalendarEvent for renewal date   │
       │   - Todo seeded near renewal-N-mo    │
       │   - Re-engagement PendingReply at    │
       │     N months out                     │
       └──────────────────────────────────────┘
                           │
                           ▼
       ┌──────────────────────────────────────┐
       │  UI surfaces (Stream B + E):         │
       │   - Calendar tab shows renewals      │
       │   - Dashboard banner: "3 leases up   │
       │     this quarter"                    │
       │   - Todos page: "Reach out to ___    │
       │     about lease renewing 2026-12"    │
       │   - Pending Replies: re-engagement   │
       │     drafts                           │
       └──────────────────────────────────────┘
```

## Streams (parallel-safe sub-agents)

### Stream A — Schema

Files:
- `prisma/schema.prisma` (new model + enum extensions)
- `prisma/migrations/20260502_lease_lifecycle/migration.sql`

New model `LeaseRecord`:

```prisma
model LeaseRecord {
  id                  String         @id @default(uuid())
  contactId           String         @map("contact_id")
  propertyId          String?        @map("property_id")
  dealId              String?        @map("deal_id")
  sourceCommunicationId String?      @map("source_communication_id")
  closeDate           DateTime?      @map("close_date")
  leaseStartDate      DateTime?      @map("lease_start_date")
  leaseEndDate        DateTime?      @map("lease_end_date")
  leaseTermMonths     Int?           @map("lease_term_months")
  rentAmount          Decimal?       @map("rent_amount") @db.Decimal(14, 2)
  rentPeriod          String?        @map("rent_period")  // "monthly", "annual"
  /// Which side of the deal Matt represented. Drives the re-engagement
  /// language (different pitch for owner-side vs tenant-side).
  mattRepresented     String?        @map("matt_represented") // "owner" | "tenant" | "both" | null
  /// Confidence score 0.0–1.0 from the AI extraction. Below 0.6 surfaces
  /// to a human-review queue rather than auto-creating side effects.
  extractionConfidence Decimal       @default(0.0) @map("extraction_confidence") @db.Decimal(5, 4)
  status              String         @default("active") // "active" | "expiring_soon" | "expired" | "terminated_early" | "renewed"
  notes               String?        @db.Text
  metadata            Json?          @default("{}")

  contact             Contact         @relation(fields: [contactId], references: [id], onDelete: Cascade)
  property            Property?       @relation(fields: [propertyId], references: [id], onDelete: SetNull)
  deal                Deal?           @relation(fields: [dealId], references: [id], onDelete: SetNull)
  sourceCommunication Communication?  @relation(fields: [sourceCommunicationId], references: [id], onDelete: SetNull)
  calendarEvents      CalendarEvent[]
  renewalReplies      PendingReply[]  @relation("LeaseRenewalReply")

  createdBy           String?         @map("created_by")
  archivedAt          DateTime?       @map("archived_at")
  createdAt           DateTime        @default(now()) @map("created_at")
  updatedAt           DateTime        @updatedAt @map("updated_at")

  @@index([contactId])
  @@index([leaseEndDate])
  @@index([status])
  @@index([closeDate])
  @@map("lease_records")
}
```

New model `CalendarEvent` (extends beyond Meeting which is for actual scheduled meetings with attendees):

```prisma
model CalendarEvent {
  id                String       @id @default(uuid())
  title             String
  description       String?      @db.Text
  startDate         DateTime     @map("start_date")
  endDate           DateTime?    @map("end_date")
  allDay            Boolean      @default(true) @map("all_day")
  /// Type of automated event — "lease_renewal", "follow_up", "anniversary",
  /// "tax_deadline", etc. Drives the icon/color in the calendar UI.
  eventKind         String       @map("event_kind")
  /// Linked entities so click-through works.
  contactId         String?      @map("contact_id")
  dealId            String?      @map("deal_id")
  propertyId        String?      @map("property_id")
  leaseRecordId     String?      @map("lease_record_id")
  /// "system" for AI-generated, "manual" for hand-added.
  source            String       @default("system")
  status            String       @default("upcoming") // "upcoming" | "completed" | "dismissed"

  contact           Contact?       @relation(fields: [contactId], references: [id], onDelete: SetNull)
  deal              Deal?          @relation(fields: [dealId], references: [id], onDelete: SetNull)
  property          Property?      @relation(fields: [propertyId], references: [id], onDelete: SetNull)
  leaseRecord       LeaseRecord?   @relation(fields: [leaseRecordId], references: [id], onDelete: SetNull)

  createdBy         String?      @map("created_by")
  createdAt         DateTime     @default(now()) @map("created_at")
  updatedAt         DateTime     @updatedAt @map("updated_at")

  @@index([startDate])
  @@index([eventKind])
  @@index([leaseRecordId])
  @@index([contactId])
  @@map("calendar_events")
}
```

Acceptance: migration applies, `pnpm prisma generate` clean.

---

### Stream B — Calendar tab

Files:
- `src/app/[lang]/(dashboard-layout)/apps/calendar/page.tsx` (rewrite to query DB)
- `src/app/[lang]/(dashboard-layout)/apps/calendar/_components/calendar-grid.tsx` (new)
- `src/app/[lang]/(dashboard-layout)/apps/calendar/_components/event-detail-drawer.tsx` (new)
- `src/app/api/calendar/events/route.ts` (GET list, optional date range)

Pull existing `Meeting` records + new `CalendarEvent` records into a unified merged list. Render full-month grid with:
- Color-coded events by `eventKind` (lease_renewal = amber, meeting = blue, follow_up = purple)
- Click → drawer with all linked entities (contact, property, lease record), action buttons (Mark complete / Dismiss / Open the related lease)
- Filter chips by event kind
- Date-range navigation (this month / next 90 days / next 12 months)

Acceptance: at least 3 sample renewals visible on the calendar; clicking opens drawer with full context.

---

### Stream C — Closed-deal classifier + lease extractor

Two-stage AI pipeline (cost-optimized):

**Stage 1 — Closed-deal classifier (`src/lib/ai/closed-deal-classifier.ts`)**

Cheap broad scan via DeepSeek. Classifies each Communication as:
- `closed_lease` (strong signal — signed lease, lease commencement, etc.)
- `closed_sale` (strong signal — closed escrow, recorded deed, commission disbursement)
- `lease_in_progress` (LOI, negotiation — not closed)
- `not_a_deal` (everything else)

Returns `{ classification, confidence, signals[] }`. The actual prompt is a stub:

```typescript
// TODO: WIRE PROMPT
// Expected output: { classification, confidence, signals: string[] }
async function callClassifier(_subject: string, _body: string) {
  return null
}
```

**Stage 2 — Lease extractor (`src/lib/ai/lease-extractor.ts`)**

Only invoked when classifier returns `closed_lease` (or `closed_sale` for non-lease tracking).

Routes to a US-based model (Claude Haiku) per Zach's sensitive-content decision. Returns full structured `LeaseExtraction`:

```typescript
export interface LeaseExtraction {
  contactName: string
  contactEmail: string | null
  propertyAddress: string | null
  closeDate: string | null            // ISO date
  leaseStartDate: string | null
  leaseEndDate: string | null
  leaseTermMonths: number | null
  rentAmount: number | null
  rentPeriod: "monthly" | "annual" | null
  mattRepresented: "owner" | "tenant" | "both" | null
  confidence: number                  // 0.0–1.0
  reasoning: string                   // for audit
}
```

The AI call is a stub:

```typescript
// TODO: WIRE PROMPT — see lease-extractor.prompt.md for the planned prompt.
// When the prompt is added, this function returns the parsed LeaseExtraction.
async function callExtractor(_input: ExtractionInput): Promise<LeaseExtraction | null> {
  return null
}
```

Both functions have:
- Full input/output type definitions
- Validation of returned fields (date parsing, range checks, confidence floor)
- Error paths surfaced as typed result enums
- Sensitive-content gate via the existing `containsRawSensitiveData`

Acceptance: typecheck clean, unit tests verify the validation logic with hardcoded mock returns from the stub.

---

### Stream D — Email-history extender

Files:
- `src/lib/msgraph/email-history-backfill.ts` (new)
- `src/app/api/integrations/msgraph/email-history-backfill/route.ts` (new — admin-token-gated)
- `scripts/lease-history-scan.mjs` (new operator script)

Today: `fetchEmailDelta` uses Graph delta link, bounded to ~30 days back without prior cursor. To go 10 years:

1. Pull mailFolder messages with `$filter=receivedDateTime ge YYYY-MM-DD and receivedDateTime lt YYYY-MM-DD` (paginated by month).
2. Iterate month by month, current → 10-years-ago.
3. Each batch → existing email-ingest pipeline (filter, dedupe by `externalMessageId`, persist Communication rows).
4. Resume-safe via a new `email_history_cursor` SystemState row per `(folder, year-month)` pair.
5. Throttle: 1 second between Graph requests (Graph limit ~10K/10min).
6. Operator-driven via API: `POST /api/integrations/msgraph/email-history-backfill { startMonth, endMonth, folder }`.

Cost / time estimate for 10-year scan:
- ~880K emails * 50ms per ingest = ~12 hours wall clock
- Storage: each email row ~5KB = ~4.5 GB DB growth (manageable on Supabase)
- Graph quota: well within Microsoft's per-app limits

Operator workflow:
1. Run `scripts/lease-history-scan.mjs --years 10` overnight.
2. Watch DB row count grow; abort safely at any time (resumes from last cursor).
3. Once done, the closed-deal classifier (Stream C-1) runs against the new corpus (separately invoked).

Acceptance: kicked off against a 1-month range, completes, Communication rows visible in DB with `createdBy: 'msgraph-history-backfill'`.

---

### Stream E — Renewal alert pipeline

Files:
- `src/lib/lease/renewal-alert-job.ts` (new — scheduled scan)
- `src/lib/ai/lease-renewal-draft.ts` (new — extends existing auto-reply with `outreachKind: "lease_renewal"`)
- `src/app/api/lease/renewal-sweep/route.ts` (new — operator/cron entry)
- Settings extension: add `leaseRenewalLookaheadMonths` to automation settings (default 6, range 1-24)

Daily job logic:
1. Find every `LeaseRecord` where `leaseEndDate` is between `now + lookaheadMonths - 7d` and `now + lookaheadMonths` (sliding window so it fires once per lease, not every day).
2. For each:
   - Create a Todo: "Reach out to {contact.name} — lease at {property.address} expires {leaseEndDate}"
   - Create a CalendarEvent: kind="lease_renewal_outreach", linked to leaseRecord
   - Generate a `PendingReply` via `generatePendingReply` with new `outreachKind: "lease_renewal"`
   - Write `LeaseRecord.status = "expiring_soon"`
3. If `automation.autoSendDailyMatchReplies` is on (or a new specific `autoSendLeaseRenewalReplies` toggle), send via Graph; else queue for review.

The new `outreachKind: "lease_renewal"` system prompt: "It's been ~5 years since you closed this lease. The tenant's lease at [address] is up [date]. Open the conversation about whether they're staying, expanding, or moving. Keep it warm and low-pressure."

Acceptance: synthetic LeaseRecord with `leaseEndDate = now + 6 months` triggers all three side effects (todo + calendar event + draft) on the next sweep.

---

## What "AI-prompt is the only blank" looks like at the end

Two prompt files left for the human to fill:

1. `src/lib/ai/lease-extractor.prompt.md` — currently a TODO header. When written, dropped into the existing tool-call wrapper and wired in the stubbed `callExtractor`.
2. `src/lib/ai/closed-deal-classifier.prompt.md` — same pattern.

Everything else — schema, calendar UI, alert pipeline, draft generator, history backfill — is wired and tested with mocked extractor output.

## Out of scope (deferred deliberately)

- **Attachment OCR.** Lease PDFs are 90% of the sensitive content. Building OCR is a separate phase that needs a vendor decision (Anthropic vision / OpenAI vision / dedicated OCR like Mistral OCR).
- **Multi-tenant lease handling** (some buildings have multiple leases). Phase 2.
- **Lease modifications / amendments** as separate records. Phase 2.
- **Calendar event RRULE / recurrence support.** A lease renewal isn't really recurring — it's a one-shot event per lease term. If the lease renews, a NEW LeaseRecord gets created.
- **Re-running the full classifier on every email scan.** Once Stream D's history-backfill completes, the closed-deal classifier runs once on the full corpus and persists results.

## Cost guardrails

- DeepSeek for broad classification: ~$5-15 for the full 880K email scan (one-time)
- Claude Haiku for extraction on classified candidates: ~$10-30 (one-time, ~5K-15K candidates)
- Going forward (per day on new mail): pennies
- Hard kill switch: the existing automation-settings page gets a `useUSModelForExtraction` toggle. Default OFF until Zach confirms cost is acceptable.

## Order of execution (in this session)

1. Plan written (this doc)
2. Stream A — schema (do it myself, ~10 min, blocks others)
3. Streams B + C + D + E in parallel via sub-agents (each ~15-30 min)
4. Integration pass + typecheck + tests
5. Final report
