# Contact Mailbox Backfill — Design

**Status:** Draft for review
**Author:** Claude (with Zach)
**Date:** 2026-05-04

## Goal

Pull historical Outlook traffic for any contact into the local `Communication` table, link each message to the contact (and to a Deal when temporally inside one), and feed new rows through the existing scrub queue (DeepSeek classifier → Haiku extractor → `ContactProfileFact`). Two entry points share one pipeline:

1. **On-demand** — operator clicks the AI scrub button on a contact detail page. Lifetime mailbox sweep. Deep relationship signal.
2. **Bulk** — admin endpoint / CLI sweeps the 286 client contacts that currently have zero communications. Deal-anchored ±24mo windows to cap Graph + scrub cost.

## Background

Diagnostic on 2026-05-04: 292 client contacts (`clientType IN active_listing_client, active_buyer_rep_client, past_client, past_listing_client, past_buyer_client`). 286 have zero `Communication` rows linked. 133 have an email on file but no comms. Body-text searches for those emails return zero — the messages are not unlinked-but-present, they are simply not in the local DB. The current ingest pipeline only pulls inbound lead-classified email; sent mail and ongoing client correspondence has never been imported.

## Architecture

### Single shared function

```
backfillMailboxForContact(contactId: string, opts: {
  mode: "lifetime" | "deal-anchored";
  dryRun?: boolean;
}): Promise<BackfillResult>
```

`BackfillResult` shape:
```
{
  contactId: string,
  windowsSearched: Array<{ start: Date, end: Date }>,
  messagesDiscovered: number,
  ingested: number,
  deduped: number,
  scrubQueued: number,
  multiClientConflicts: number,
  durationMs: number,
}
```

Both entry points call this function. No duplicate logic.

### Window resolution

**`mode: "lifetime"`** — single window `[1970-01-01, now]`. No anchoring. Cost: high per contact, but operator triggered = explicit consent.

**`mode: "deal-anchored"`**:

1. If contact has Deal rows: union of `[earliestDate(deal) − 24mo, latestDate(deal) + 24mo]` across all deals. `earliestDate` = `min(createdAt, listingDate, leaseStartDate, …)`, `latestDate` = `max(closedAt, leaseEndDate, …, today if open)`.
2. Else if contact has prior Communications: `[min(comm.date) − 24mo, max(comm.date) + 24mo]`.
3. Else: skip — log to operator queue with reason `no_anchor_available`. (These are CSV-imported contacts that have never been engaged. Phase 3 territory.)

Clamp final union to a max span of 8 years to bound Graph cost on outlier contacts.

### Mailbox query (Microsoft Graph)

For each window:

- `GET /me/messages?$search="from:{email} OR to:{email} OR cc:{email}"&$filter=receivedDateTime ge {windowStart} and receivedDateTime le {windowEnd}`
- Page size 25 (Graph cap when `$search` is used). Follow `@odata.nextLink` until exhausted.
- Per message: dedupe against `Communication.externalMessageId` (existing partial unique index covers this).
- New row → insert into `Communication` with:
  - `contactId` = the target contact
  - `dealId` = first Deal whose date window contains `receivedDateTime`, else null
  - `channel` = `email`
  - `direction` = inferred from `from.emailAddress.address` vs Matt's mailbox address
  - `subject`, `body` (use `bodyPreview` if `body` excluded for size, full `body` for messages we care about), `date` = `receivedDateTime`
  - `externalMessageId` = Graph message id
  - `conversationId` = Graph conversation id
- Raw Graph response stored to `ExternalSync.rawData` (existing pattern from inbound ingest).

### Multi-client conflict handling

If a Graph message would link to 2+ client contacts (e.g., Matt cc'd both buyer and seller, both clients), v1 picks **deterministic primary** = lowest `Contact.id` and logs the conflict to `OperationalEmailReview` with `type = multi_client_match` so the operator can split it later. Schema migration to a Communication↔Contact join table is out of scope for v1.

### Scrub integration

After successful insert of each new Communication, call existing `enqueueForScrub(communicationId)`. The scrub queue handles classification (DeepSeek) and fact extraction (Haiku) asynchronously. No new AI integration code needed.

For bulk runs we honor the existing scrub budget gate — if budget is exhausted mid-run, ingest continues but scrub-enqueue is skipped and conflicts logged so the operator can re-enqueue once budget resets.

### Entry point 1: On-demand UI button

- New POST `/api/contacts/[id]/email-backfill` — admin/CSRF protected, body `{}`, response = `BackfillResult` JSON.
- Internally: `await backfillMailboxForContact(id, { mode: "lifetime" })`.
- Wired to the existing AI button on contact detail page. **Verification needed during planning:** confirm whether the wired button lives in `ContactArcSummary` (`src/components/contact/contact-arc-summary.tsx` if present) or `lead-ai-suggestions.tsx`. Will resolve in plan task 1.
- UI states:
  - Idle → "Scan mailbox for this contact"
  - Click → "Scanning mailbox… (this can take 30–90s for active relationships)"
  - Success → "Found 47 messages, 12 already on file, 35 imported, 35 queued for AI scrub"
  - Error → red badge, error message, retry button
- After success, call `router.refresh()` so the Activity tab and `ContactArcSummary` re-fetch and re-render.
- Rate-guard: server rejects re-trigger within 10 minutes per contact (via lookup on most recent `BackfillRun` for that contact). Returns 429 with retry-after.

### Entry point 2: Bulk sweep

- New CLI `scripts/contact-email-backfill.mjs` — selects 286 client contacts, processes them serially (parallel = Graph throttle risk).
- New POST `/api/contacts/email-backfill-bulk` — admin token, body `{ contactIds?: string[], batchSize?: number, mode?: "deal-anchored" }`. Default mode = `deal-anchored`.
- Both invoke `backfillMailboxForContact(id, { mode: "deal-anchored" })` per contact.
- Per-contact failures isolated (one bad contact does not halt the run). Failures captured in run log.

### Operator visibility

- New table `BackfillRun`:
  ```
  id              String   @id @default(cuid())
  contactId       String?
  trigger         String   // "ui" | "bulk" | "cli"
  mode            String   // "lifetime" | "deal-anchored"
  startedAt       DateTime @default(now())
  finishedAt      DateTime?
  status          String   // "running" | "succeeded" | "failed" | "skipped"
  result          Json?    // BackfillResult or error detail
  contact         Contact? @relation(fields: [contactId], references: [id])
  ```
- Surfaced on contact detail page header as a thin status line: `Mailbox last scanned 3 days ago — 47 messages on file`. Plus a "Re-scan" button (subject to rate-guard).
- For bulk runs: a parent `BackfillRun` with `contactId = null` and child rows per contact. Operator can read aggregate progress from the parent.

## Phasing

**Phase 1 — Pipeline + on-demand UI**
Build `backfillMailboxForContact`, the per-contact API route, the UI button rewire, the `BackfillRun` model + migration, and the rate-guard. Test end-to-end on the two contacts the user reported as empty (named in conversation). Validate that the imported messages appear on the contact's Activity tab and that scrub-enqueued messages produce profile facts.

**Phase 2 — Bulk sweep**
Add the CLI driver and the bulk API endpoint. Run the deal-anchored sweep over 286 client contacts. Monitor Graph rate limits, scrub queue depth, and review-queue conflicts.

**Phase 3 — Contact relationship graph (planned, separate spec)**

After Phase 2 fills in the email history, derive a contact↔contact graph from co-occurrence:
- **Email co-occurrence:** any two contacts that appear together on the same `Communication.conversationId` (To/Cc/Bcc) get an edge. Strength = count of shared threads.
- **Deal co-occurrence:** any two contacts attached to the same Deal (or to two Deals on the same Property/transaction) get an edge. Strength = count of shared deals + recency weight.
- **Storage:** new `ContactRelationship` derived table — `(contactA, contactB, sharedThreads, sharedDeals, lastInteractionAt, strength)`. Rebuilt by a backfill job that re-runs after each bulk mailbox sweep, plus incrementally updated whenever a new Communication or Deal links a contact.
- **UI surface:** new "Connected to" card on contact detail. Lists top N related contacts ordered by strength, each row clickable → routes to that contact's page. For deal-linked relationships, badge them ("Co-listed on 123 Main", "Both on Acme transaction") so it's obvious *why* they're connected.
- **Phase 3 entry trigger:** runs automatically after bulk Phase 2 completes; also re-runs when on-demand mailbox scrub finishes for a contact (so newly discovered cc'd-together patterns surface immediately).

This phase gets its own spec + plan once Phase 2 ships. Mentioned here so the Phase 1 schema and conflict-logging decisions don't paint us into a corner — specifically, the `OperationalEmailReview` rows we log for `multi_client_match` in Phase 1 become high-confidence input signals for Phase 3.

**Out of scope entirely (no current plan)**
- Name-only matching for the 153 clients with no email on file.
- Contacts with no deals and no comms (need a different anchor — e.g., last meeting date, or operator-set hint).
- Many-to-many `Communication ↔ Contact` schema migration. Phase 3's `ContactRelationship` table sidesteps the need: the email itself still has one primary contact, but the relationship graph captures the co-occurrence cleanly.
- Re-running scrub on existing Communications that predate current scrub-prompt versions.

## Tradeoffs and risks

- **Lifetime mode cost.** A single power-user contact could have 1000+ emails. Worst case: lifetime sweep takes minutes and burns scrub budget. Mitigation: rate-guard + result preview ("found 1,243 messages, are you sure you want to scrub all?") could be added if first runs prove painful. Not in v1 — start permissive, tighten if needed.
- **Graph rate limits.** `/me/messages` allows ~250 req per 10s. With pagination at 25/page, that's ~6,250 messages per 10s ceiling. Deal-anchored bulk over 286 contacts should stay well under. Lifetime mode for 286 contacts could push it — mitigated by the bulk path defaulting to deal-anchored.
- **Multi-client cc'd messages.** v1 picks one primary, logs conflict. Operator review queue surfaces it. Not silently lossy — just deferred resolution.
- **Direction inference.** If Matt has multiple aliases, "outbound" detection by sender-address may misclassify. Mitigation: load Matt's known address list from settings; treat anything in that list as outbound.
- **`bodyPreview` vs `body`.** Graph's `body` field can be large; pulling for thousands of messages is bandwidth-heavy. Decision: pull `body` for all backfilled messages — matching downstream scrub needs. If bandwidth becomes an issue, switch to `bodyPreview` for a first pass and lazily fetch full body when scrub demands it.

## Verification needed during planning

- Locate the existing AI scrub button on contact detail and confirm wiring target.
- Confirm `Communication.externalMessageId` partial unique index exists (and is partial — null-allowed).
- Confirm `enqueueForScrub` signature and that it tolerates being called many times in one process (it does today via the bulk lead-apply backfill, but reverify).
- Confirm Matt's mailbox alias list location (settings table or env var).

## Out of scope (explicit non-goals)

- New AI prompts or scrub logic. We use the existing pipeline.
- UI changes outside the contact detail page header + button.
- Rebuilding the lead-intake pipeline. This is purely additive.
- Backfilling contacts that are not yet flagged as clients.
