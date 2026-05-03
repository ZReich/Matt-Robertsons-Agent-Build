# Phase D — buyer-rep dedupe + detector expansion + tier differentiation

Date: 2026-05-02
Branch: `main`
Plan: `docs/superpowers/plans/2026-05-02-deal-pipeline-automation.md` (Phase D)

## Overview

Phase D landed in three commits on `main`. All work was TDD: failing tests
first, then implementation, then verification gates.

| Step | Commit | Subject |
|------|--------|---------|
| 1 (dedupe) | `9992c54` | proposeBuyerRepDeal skips when an existing buyer_rep Deal exists for the contact OR a pending duplicate AgentAction exists within 90 days |
| 2 (detector) | `92d3b27` | classifyBuyerRepSignal recognizes nda + tenant_rep_search in addition to loi/tour |
| 2.5 (type widen) | `a76a911` | ProposeBuyerRepInput.signalType widened to the full BuyerRepSignalType union |
| 3a (tier) | `f5c218a` | tier=auto for LOI proposals with matching attachment + log_only audit row for tenant_rep_search |
| 3b (backfill) | `18dbfd2` | backfill script tracks new tier outcomes (autoTierCount, loggedAuditOnly) |

## Step 1 — Dedupe (commit `9992c54`)

`proposeBuyerRepDeal` now runs two existence checks inside its transaction
before creating an AgentAction:

1. **Existing-Deal guard.** If a non-archived `buyer_rep` Deal exists for the
   resolved contact, return `{ created: false, skipReason: "existing-buyer-rep-deal" }`.
2. **Pending-AgentAction dedupe.** If a `create-deal` AgentAction with status
   `pending` exists for the same `(recipientEmail, signalType)` pair within
   the last 90 days, return `{ created: false, skipReason: "duplicate-pending-action" }`.

Background: the Phase 7 audit found 306 pending `create-deal` rows in production
that collapsed to 83 distinct `(recipientEmail, signalType)` pairs — the same
broker had been re-classified across multiple emails in a thread. Without the
dedupe, the upcoming backfill would have multiplied that number again.

The 90-day window is wide enough to catch tight-cluster duplication (a
re-engagement across days/weeks) but doesn't permanently block legitimate
re-fires after a long pause.

Case-insensitivity for the JSON-path email match is enforced by the writers
always lowercasing recipientEmail before persisting (emails.ts and the
backfill script both call `.trim().toLowerCase()` on the recipient address);
the dedupe query lowercases the input and compares against the stored value.

## Step 2 — Detector expansion (commit `92d3b27`)

`classifyBuyerRepSignal` now recognizes four signal types instead of two:

| Signal | Confidence | Stage | Patterns |
|--------|-----------:|-------|----------|
| `loi` | 0.85 | offer | `\bLOI\b`, `letter of intent`, `offer (sheet|draft)` |
| `tour` | 0.75 | showings | `(tour|showing|walkthrough)` ∧ `(schedule|available|time slot)` |
| `nda` | 0.70 | prospecting | `\bNDA\b`, `non[-\s]?disclosure agreement`, `confidentiality agreement` |
| `tenant_rep_search` | 0.50 | prospecting | `in the market for`, `looking for (space|properties|industrial|warehouse|retail|office|land|building|sites?)`, `exploring (options|sites|properties)`, `searching for ...` |

**Precedence (highest first):** LOI > tour > NDA > tenant_rep_search. First
match wins per email — never multi-fire.

NDA and tenant_rep_search are gated on at-least-one-external-BROKER recipient
(via `isExternalBrokerDomain`), not just any non-NAI recipient. They're
lower-confidence signals and we want the stronger domain signal as a guard.

The NDA `\bNDA\b` pattern is word-boundary-anchored to avoid false positives
on "panda", "Ndabaningi", etc. The tenant_rep `looking for` pattern is
anchored on concrete property-type vocabulary so a generic "looking for
feedback" doesn't trip it.

## Step 3 — Tier differentiation (commit `f5c218a`)

`proposeBuyerRepDeal` now decides `tier` and `status` per signal type:

| Signal | Attachment match | tier | status | Dedupe runs? |
|--------|------------------|------|--------|--------------|
| `loi` | filename matches `/loi\|letter[-_ ]of[-_ ]intent\|offer/i` | `auto` | `pending` | yes |
| `loi` | no match / no attachments | `approve` | `pending` | yes |
| `tour` | n/a | `approve` | `pending` | yes |
| `nda` | n/a | `approve` | `pending` | yes |
| `tenant_rep_search` | n/a | `log_only` | `executed` | **NO** |

### Tier=auto for LOI+attachment

`auto` here is a UI hint — the action still appears in the approval queue
(`status: pending`), but pre-flagged as high-confidence. Per Matt's
preference, the system never auto-executes buyer-rep deals; he confirms each
big move. A future UI iteration can render auto-tier rows with a different
visual treatment ("we're confident — one click to approve").

### Tier=log_only for tenant_rep_search

`tenant_rep_search` is a low-confidence pure-audit signal — Matt wants a
trail of "I told a broker I was looking for X" without flooding the
approval queue. The row is created with `status: executed` so it never
appears in the queue and never gets approved or rejected. Dedupe is
**deliberately skipped** because multiple audit rows for the same contact
across different emails are useful — they show the user is actively
talking to many brokers about overlapping needs.

### Schema verification

`AgentTier` is a Postgres enum (`schema.prisma:195`) with values
`auto | log_only | approve | blocked`. **No migration needed** — `log_only`
already exists from Phase 1.

### Attachment detection mechanism

There is no separate `CommunicationAttachment` model. Attachments live in
`Communication.metadata.attachments` as a JSON array of `AttachmentMeta`:

```ts
interface AttachmentMeta {
  id: string
  name: string         // ← filename
  size: number
  contentType: string
  isInline?: boolean
  attachmentType?: "file" | "item" | "reference" | "unknown"
}
```

Populated by `fetchAttachmentMeta` in `src/lib/msgraph/emails.ts` for any
inbound/outbound message classified as `signal` whose
`hasAttachments` flag is set.

`proposeBuyerRepDeal` reads the source Communication's metadata inside the
same transaction as the dedupe + create, so the attachment lookup is
serialized under the advisory lock. Empty attachment list, missing
`metadata.attachments`, or non-array values all fall through to
`tier=approve`.

The LOI filename regex is case-insensitive and matches `LOI`,
`Letter-of-Intent`, `letter of intent`, `letter_of_intent`, and any filename
containing `offer`. Tested against `LOI_draft.pdf`, `loi_offer.pdf`,
`Letter-of-Intent.docx`, `letter_of_intent.docx`, `OFFER_sheet.pdf`
(all → auto) and `company-overview.pdf`, `signature.png` (→ approve).

## Dry-run backfill output (2026-05-02)

```
node scripts/backfill-buyer-rep-actions.mjs   # dry-run, no --apply
```

```json
{
  "stats": {
    "examined": 1864,
    "matched": 7,
    "actionCreated": 0,
    "autoTierCount": 0,
    "loggedAuditOnly": 1,
    "skippedExistingDeal": 0,
    "skippedDuplicatePending": 0,
    "skippedNoSignal": 1857,
    "skippedNoExternalRecipient": 0,
    "errors": 0
  },
  "matchedSignalBreakdown": {
    "loi": 0,
    "tour": 0,
    "nda": 6,
    "tenant_rep_search": 1
  }
}
```

### Reading the dry-run

The 306 pending `create-deal` rows from Phase 7 are excluded by the
`sourceAgentActions: { none: { actionType: "create-deal" } }` filter — those
communications already produced an action and won't be reprocessed. So this
dry-run is effectively the **incremental** corpus since the live ingest hook
landed.

- **0 LOI matches** in the residual 1864 outbound rows. The 306 pending
  rows already cover the LOI/tour cluster from before the hook went live.
- **0 tour matches.** Same reason.
- **6 NDA matches** — all from the `4015 1st Ave S | NDA` and `Cummins Mark 2
  Market` threads to MarcusMillichap and Colliers. These are net-new
  signals that the previous detector missed entirely.
- **1 tenant_rep_search match** — a `Re: Billings MT- Daniels Health` thread
  to a CBRE broker.

`autoTierCount: 0` reflects that none of the 7 matched rows have an
LOI-named attachment. The NDA and tenant_rep matches don't carry attachments
on the outbound side (NDAs are typically sent inbound from the other broker
for Matt to sign, and tenant_rep search emails are conversational).

**Apply was NOT run.** The parallel session may run their backfill soon and
we want to coordinate sequencing.

## Deferred — Phase F: Kanban filter chip

The Deals page (`src/app/[lang]/(dashboard-layout)/pages/deals/page.tsx:47`)
is hard-coded to `dealType: "seller_rep"`. Adding a chip to toggle between
`seller_rep` and `buyer_rep` (or "all") is straightforward but conflicts
with the parallel session's UI work on `lease-backfill-execution`.

**Deferred** until that branch lands. Trigger to revisit: when buyer_rep
deals begin reaching `won` status (currently 0 buyer_rep deals approved
through this pipeline). At that point the chip becomes user-facing essential.

## Verification gates

- `pnpm exec tsc --noEmit --pretty false` — clean (no new errors).
- `pnpm test` — 931 passed, 1 skipped (baseline before step 3 was 923 + 1).
  Delta: +8 tests added in step 3, all green.
- `git branch --show-current` returned `main` immediately before each commit.

## Open questions / concerns

None. The existing 306 pending rows carry `tier=approve` and are untouched —
when Matt approves them they'll mint `buyer_rep` Deals, after which the
Phase D dedupe blocks any future re-proposal for those contacts.
