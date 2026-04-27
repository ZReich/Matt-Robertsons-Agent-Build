# Historical Communication Contact/Client Backfill - Design

**Date:** 2026-04-25
**Author:** Zach Reichert (with Codex/Ralplan)
**Status:** Draft for implementation
**Depends on:** [Email Ingestion](2026-04-23-email-ingestion-design.md), [Contact Sync](2026-04-22-contact-sync-design.md), [AI Email Scrub](2026-04-24-ai-email-scrub-design.md)
**Related:** [Lead Extractor Diagnostics](2026-04-25-lead-extractor-diagnostics-design.md), [AI Scrub Backfill Orchestration](2026-04-25-email-ai-scrub-backfill-orchestration-design.md), [Contact Dossier Rollups](2026-04-25-contact-dossier-rollup-design.md)

---

## Problem

The ingester now links new emails as they arrive, but the historical Supabase table already contains a large backlog:

- `Communication`: 22,597 rows
- `Communication.contactId IS NULL`: 19,613 rows (87%)
- `Communication.contactId IS NOT NULL`: 2,984 rows (13%)
- `classification IN ('signal', 'uncertain')`: 8,745 rows
- `classification = 'noise'`: 13,852 rows

That means scrub output, todos, dashboard follow-ups, lead cards, and future contact/client files will be incomplete unless existing rows are backfilled to the right `Contact`/client.

In this app, a "client" is not a separate table: it is a `Contact` with one or more `Deal` rows. This backfill therefore attaches historical emails to:

1. `Communication.contactId` when the counterparty is known.
2. `Communication.dealId` only when there is a deterministic single-deal match.
3. `metadata.backfill.*` audit state so every automatic Supabase write is explainable and reversible.

---

## Goals

- Deterministically link as many of the 19,613 unlinked communications as possible without model/API spend.
- Link both inbound and outbound email where metadata is sufficient:
  - inbound: sender is the primary counterparty.
  - outbound: primary recipient is the counterparty only when the recipient set is unambiguous.
- Avoid bad links: auto-write only exact/unique matches; ambiguous matches stay unmodified and are reported.
- Preserve existing curated links; never overwrite `contactId` or `dealId` unless an explicit operator flag is supplied.
- Make the pass dry-runnable, batchable, idempotent, and safe to run against Supabase.
- Feed the AI scrub and dossier specs with better contact/deal context before paid bulk model processing.

## Non-goals

- No creation of new Contacts in v1. Unknown senders are counted for a later auto-promote sender spec.
- No multi-party communication model in v1. `Communication` only has one `contactId`; multi-recipient outbound emails remain unlinked unless exactly one CRM contact can be identified as the business counterparty.
- No AI/model calls in the deterministic linking pass.
- No broad `dealId` guessing. A deal link is only written when exactly one active deal is safely implied.
- No UI in this spec; outputs are script/route responses and database updates.

---

## Inputs and contracts

### Existing tables

- `communications`
  - `contact_id`, `deal_id`, `direction`, `metadata`, `body`, `subject`, `date`, `archived_at`
- `contacts`
  - `id`, `email`, `name`, `archived_at`, `lead_source`, `lead_status`
- `deals`
  - `id`, `contact_id`, `property_address`, `stage`, `archived_at`

### Required metadata reader

Add one reusable parser instead of ad-hoc JSON access:

```ts
interface CommunicationParties {
  from: { name?: string; address?: string } | null
  to: Array<{ name?: string; address?: string }>
  cc: Array<{ name?: string; address?: string }>
  conversationId?: string
  source?: string
}

function readCommunicationParties(metadata: unknown): CommunicationParties
```

It must tolerate old/new metadata shapes and normalize addresses with `trim().toLowerCase()`.
It must explicitly support the current Graph-backed persisted shape from
`full-kit/src/lib/msgraph/emails.ts`:

```ts
metadata.from = {
  address: string,
  displayName?: string,
  isInternal?: boolean
}
metadata.toRecipients = Array<{
  emailAddress?: { address?: string, name?: string }
}>
metadata.ccRecipients = Array<{
  emailAddress?: { address?: string, name?: string }
}>
```

It should also accept defensive legacy aliases (`to`, `cc`, `recipients`,
`sender`, `emailAddress`) so historical rows with earlier metadata shapes are
counted rather than crashing the run.

### Audit metadata written per changed row

```ts
metadata: {
  ...existing,
  backfill: {
    ...existing.backfill,
    contactLink: {
      runId: string,
      linkedAt: string,
      strategy:
        | "inbound_sender_exact_email"
        | "outbound_single_recipient_exact_email"
        | "scrub_candidate_high_confidence",
      matchedEmail: string,
      previousContactId: string | null,
      newContactId: string,
      confidence: 1 | number,
      dryRun: false
    },
    dealLink?: {
      runId: string,
      linkedAt: string,
      strategy: "single_active_deal_for_contact" | "scrub_candidate_high_confidence",
      previousDealId: string | null,
      newDealId: string,
      confidence: 1 | number,
      dryRun: false
    }
  }
}
```

Dry-run returns the same shape in JSON/CSV but does not write it.

---

## Linking algorithm

### Phase 0 - dry-run inventory

Before writing, report:

- total unlinked communications
- unlinked by `direction`
- unlinked by `classification`
- number with parseable sender email
- number with exactly one parseable recipient email
- exact contact matches by direction
- ambiguous contact matches where one email maps to multiple active contacts
- possible single-active-deal matches
- unknown sender/recipient emails ranked by count, domain, and last message date

### Phase 1 - inbound sender exact match

For each unlinked inbound communication:

1. Extract `metadata.from.address`.
2. Find active contacts with `lower(contact.email) = lower(sender)`.
3. If exactly one active contact matches, set `contactId`.
4. If zero contacts match, leave unlinked and count as `unknownSender`.
5. If more than one active contact matches, leave unlinked and count as `ambiguousEmail`.

### Phase 2 - outbound single-recipient exact match

For each unlinked outbound communication:

1. Extract `to` plus, optionally, `cc` recipients.
2. Remove Matt/NAI self addresses and system/bulk addresses.
3. If exactly one recipient email remains and exactly one active contact matches it, set `contactId`.
4. If multiple business recipients remain, leave unlinked; do not guess a primary contact.

The self/system filter must be deterministic and configured, not inferred by the
model:

```txt
EMAIL_BACKFILL_SELF_EMAILS=matt@...,alias@...
EMAIL_BACKFILL_INTERNAL_DOMAINS=naipartners.com,nai-partners.com
EMAIL_BACKFILL_SYSTEM_EMAIL_DENYLIST=no-reply@,noreply@,donotreply@,mailer-daemon@,postmaster@,notifications@
EMAIL_BACKFILL_OUTBOUND_INCLUDE_INTERNAL=false
```

Predicate:

1. Drop exact matches from `EMAIL_BACKFILL_SELF_EMAILS` and the Graph target UPN.
2. Drop addresses whose local part or full address matches the system denylist.
3. Drop internal-domain recipients when
   `EMAIL_BACKFILL_OUTBOUND_INCLUDE_INTERNAL=false`; these are usually
   coordination emails, not the external client/contact relationship.
4. After filtering, auto-link only if exactly one recipient remains and exactly
   one active Contact matches that address.

Tests must cover self aliases, internal-domain recipients, system/bulk
addresses, and a mixed internal+external outbound email.

### Phase 3 - single active deal for linked contact

For rows that now have `contactId` and no `dealId`:

1. Find active operational deals for that contact:
   - `archivedAt IS NULL`
   - `stage != 'closed'`
2. If exactly one active deal exists, set `dealId`.
3. If zero or multiple active deals exist, leave `dealId` null.

Closed deals are intentionally excluded from deterministic auto-linking. If a
historical email clearly belongs to a closed deal, the scrub candidate phase or a
manual review path can attach it with evidence. Deal matching from property
names/addresses belongs in scrub candidate application, not deterministic
contact linking.

### Phase 4 - apply high-confidence scrub candidates

After AI scrub has run, a separate operation may apply model-proposed links:

- `linkedContactCandidates`: auto-apply only if the top candidate has `confidence >= 0.90`, the second candidate is absent or at least `0.15` lower, and `Communication.contactId` is still null.
- `linkedDealCandidates`: auto-apply only if `confidence >= 0.90`, the deal is active, and either:
  - the row has no `contactId`, or
  - the deal's `contactId` equals the communication's `contactId`.
- Candidates in `[0.80, 0.90)` are not auto-written; they are exported for manual review or a future approval UI.

The user-provided starting idea used `>0.8`; this spec raises the automatic-write threshold to reduce irreversible wrong-link cleanup. The `0.80-0.89` band still preserves the value as a review queue.

---

## Operational surfaces

Preferred implementation shape:

```txt
full-kit/src/lib/backfill/communication-linker.ts
full-kit/src/lib/backfill/communication-linker.test.ts
full-kit/src/app/api/integrations/email-backfill/link-communications/route.ts
```

Admin route:

`POST /api/integrations/email-backfill/link-communications`

Request:

```json
{
  "dryRun": true,
  "limit": 1000,
  "phase": "all",
  "applyScrubCandidates": false,
  "runId": "email-link-20260425-001"
}
```

Gates:

- Reuse scrub-style dedicated env gates rather than Microsoft Graph test flags:
  - `EMAIL_BACKFILL_ROUTES_ENABLED=true`
  - `EMAIL_BACKFILL_ADMIN_TOKEN`
  - production writes additionally require `ALLOW_BACKFILL=true`
- Default `dryRun=true` when omitted.
- Write mode requires explicit `dryRun=false` and `runId`.

### Conditional write requirement

Every production write must be conditional at the database level to protect
against races with live ingestion or another backfill process. Examples:

```sql
UPDATE communications
   SET contact_id = $newContactId,
       metadata = $mergedMetadata
 WHERE id = $communicationId
   AND contact_id IS NULL;

UPDATE communications
   SET deal_id = $newDealId,
       metadata = $mergedMetadata
 WHERE id = $communicationId
   AND deal_id IS NULL;
```

The implementation must check the affected row count. If it is `0`, treat the
row as `skippedRaceLost` and do not retry with overwrite semantics.

Response:

```ts
interface CommunicationLinkBackfillResult {
  runId: string
  dryRun: boolean
  scanned: number
  updatedContactId: number
  updatedDealId: number
  skippedAlreadyLinked: number
  skippedUnknownParty: number
  skippedAmbiguousContact: number
  skippedAmbiguousRecipients: number
  skippedMultipleDeals: number
  samples: {
    linked: BackfillDecision[]
    ambiguous: BackfillDecision[]
    unknownTopEmails: Array<{ email: string; count: number; lastDate: string }>
  }
}
```

---

## Acceptance criteria

1. Dry-run on the current Supabase dataset returns counts without mutating any rows.
2. Running with `dryRun=false` only updates rows where `contactId`/`dealId` are null unless an explicit future `overwrite=true` flag is added.
3. Re-running the same operation is idempotent: already-updated rows are skipped or produce the same final state.
4. Inbound sender exact match auto-links when and only when there is exactly one active contact for the normalized sender email.
5. Outbound matching does not link multi-recipient emails unless exactly one non-self recipient maps to exactly one active contact.
6. Duplicate contact emails never auto-link; they are reported for manual cleanup.
7. Single-active-deal inference writes `dealId`; zero/multiple active deals leave `dealId` null.
8. Every changed row receives `metadata.backfill.contactLink` and/or `metadata.backfill.dealLink` with `runId`, strategy, before/after IDs, and timestamp.
9. High-confidence scrub candidate application is disabled until scrub has populated `metadata.scrub`; it uses the stricter threshold rules above.
10. Production writes use conditional `WHERE contact_id IS NULL` / `WHERE deal_id IS NULL` updates and report race-lost rows instead of overwriting.

---

## Test plan

### Unit tests

- `readCommunicationParties()` parses current metadata shapes and tolerates missing/null malformed JSON.
- `readCommunicationParties()` extracts current Graph `toRecipients[].emailAddress.address` and `ccRecipients[].emailAddress.address` shapes.
- Inbound exact sender match: one active contact -> link.
- Inbound duplicate contact email -> no link, ambiguity count increments.
- Inbound archived contact only -> no link.
- Outbound one non-self recipient -> link.
- Outbound multiple recipients -> no link.
- Existing `contactId` is not overwritten.
- Single active operational deal for linked contact -> link `dealId`.
- Closed deal only -> no deterministic `dealId` link.
- Multiple active deals -> no `dealId` write.
- Scrub candidate auto-apply respects `>=0.90` threshold and candidate gap.
- Audit metadata merges into existing `metadata` without dropping existing keys.

### Integration/dry-run checks

Run in order:

```powershell
pnpm test -- communication-linker
pnpm exec tsc --noEmit
pnpm lint
```

Manual Supabase dry-run:

1. Run route with `{ "dryRun": true, "limit": 500 }`.
2. Confirm response samples look correct.
3. Query counts before write.
4. Run write in small batches, e.g. `limit=500`.
5. Query counts after each batch.
6. Spot-check 20 linked inbound rows and 20 linked outbound rows.

---

## Rollback strategy

Because each row stores previous IDs in `metadata.backfill.*`, a rollback script can:

1. Select rows with `metadata.backfill.contactLink.runId = <runId>`.
2. Restore `contact_id = previousContactId`.
3. Select rows with `metadata.backfill.dealLink.runId = <runId>`.
4. Restore `deal_id = previousDealId`.
5. Append `metadata.backfill.rollback = { runId, rolledBackAt, reason }`.

Do not physically delete audit metadata.

---

## Follow-ups

- Auto-promote unknown senders to stub Contacts after manual review of top senders/domains.
- Add a `CommunicationParticipant` table if the product needs multi-recipient relationship mapping instead of one primary `contactId`.
- Build a small admin review UI for ambiguous matches and `[0.80, 0.90)` scrub candidates.
