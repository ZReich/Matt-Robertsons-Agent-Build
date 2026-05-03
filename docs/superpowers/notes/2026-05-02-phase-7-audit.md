# Phase 7 Audit — AgentAction Deal Handlers

**Date:** 2026-05-02
**Scope:** Phase A of the 2026-05-02 deal-pipeline-automation plan.
**Method:** `full-kit/scripts/phase-7-audit.mjs` synthesizes pending AgentAction rows
against real Deal IDs, calls `approveAgentAction` directly (the same code path the
`POST /api/agent/actions/{id}/approve` route invokes), asserts the side effects, and
rolls back any synthesized state. Sidecar JSON: `2026-05-02-phase-7-audit-results.json`.

## Result summary

| Probe | Status |
|---|---|
| A.1.a — `move-deal-stage` flips `stage` + stamps `stageChangedAt`, marks action executed | OK |
| A.1.b — concurrency guard returns 409 `stage_mismatch` when payload `fromStage` is stale | OK |
| A.2.a — `update-deal` writes `value` / `probability` / `closingDate` and marks action executed | OK |
| A.2.b — `update-deal` rejects fields outside `ALLOWED_UPDATE_FIELDS` with 400 `forbidden_update_field` | OK |
| A.2.c — `create-deal` resolves a brand-new `recipientEmail` via find-or-create Contact | OK |

All three handler types round-trip cleanly. Phase A acceptance is met: the existing
`agent-actions-deal.ts` switch is safe to build on.

## Findings on the 306 pending `create-deal` rows

All 306 pending `create-deal` actions originate from the **buyer-rep detector that
already runs in `src/lib/msgraph/emails.ts` ingest** (call site at lines 1253-1284).
Every pending row has:

- `dealType: "buyer_rep"`
- `dealSource: "buyer_rep_inferred"`
- `contactId: null` (matching contact lookup at proposal time was skipped — find-or-create runs at approval time)

Breakdown:

| `signalType` | n |
|---|---|
| `loi` (confidence 0.85) | 242 |
| `tour` (confidence 0.75) | 64 |
| **total** | **306** |

### Failure mode #1 — no dedupe

The 306 rows collapse to **83 distinct `(recipientEmail, signalType)` pairs**. Examples:

| recipient | signal | count |
|---|---|---|
| `samantha.turner@weyerhaeuser.com` | loi | 30 |
| `ryan.tracy@dsgsupply.com` | loi | 20 |
| `michael@cbcmontana.com` | loi | 16 |
| `deborah.coyne@cushwake.com` | loi | 12 |

Every outbound email that re-trips the LOI / tour regex against the same broker
generates a fresh pending action. If Matt naively bulk-approved his queue, Samantha
Turner alone would acquire 30 buyer-rep Deals.

**Implication for Phase D:** the proposer in `src/lib/deals/buyer-rep-action.ts` must
gain a dedupe guard *before* creating a new AgentAction. Cheapest fix: skip if a
pending `create-deal` already exists with the same `(recipientEmail, signalType)`
or, better, the same `(contactId-after-resolution, dealType)`. Since we already keep
`createdAt`, a "within last 90 days" cap on this check would also work. The
`createDealFromAction` handler itself can stay as-is — dedupe belongs at proposal time.

### Failure mode #2 — no "deal already exists" guard

Zero of the 306 pending rows overlap an existing `buyer_rep` Deal — but that's only
because no `buyer_rep` Deals exist yet (all 26 current Deals are `seller_rep`). Once
the queue starts getting approved, every subsequent LOI/tour signal against the same
broker would still propose a brand-new Deal regardless of whether one already exists.
The proposer needs to short-circuit when a non-archived Deal with the matching
`(contactId, dealType)` is already present.

### Failure mode #3 — silent type coercion on `update-deal`

`Deal.probability` is `Int?` (see `prisma/schema.prisma` line 505), but
`agent-actions-deal.ts` does no validation: it forwards whatever value the AI sent
straight to Prisma, which silently truncates floats to integers. A model that emits
`probability: 0.5` (intent: 50%) would persist `0`. Not an audit blocker, but worth
hardening when we touch that handler again — either pin the schema (add a Zod
validator on the payload field) or document the convention with the prompt.

## Already-landed scaffolding the plan didn't account for

While auditing, I noticed Phases B and D have substantial code already on disk that
the plan treats as net-new. Calling this out so we don't re-invent it:

### Phase B — Buildout deal-stage parser

- `src/lib/msgraph/buildout-stage-parser.ts` — `parseBuildoutStageTransition(body)`
  + `mapBuildoutStageToDealStage(raw)`. Already covers prospecting / marketing /
  showings / offer / under_contract / due_diligence / closing / closed. `.test.ts`
  exists.
- `src/lib/msgraph/email-extractors.ts:286-303` — `BUILDOUT_STAGE` subject regex +
  body parse, returns `{ kind: "deal-stage-update", propertyName, fromStageRaw,
  toStageRaw, ... }`.
- `src/lib/deals/buildout-stage-action.ts` — `proposeStageMoveFromBuildoutEmail()`
  matches a Deal by `propertyAddress` / `propertyAliases`, creates a pending
  `move-deal-stage` AgentAction at tier `"approve"`. `.test.ts` exists.
- `src/lib/backfill/lead-apply-backfill.ts:236-241` — backfill loop calls
  `proposeStageMoveFromBuildoutEmail` against historical communications.

What is **NOT** wired:

1. There is **no live ingest hook**. New Buildout deal-stage emails ingested by
   `emails.ts` do not call `proposeStageMoveFromBuildoutEmail` — only the backfill
   loop does. So no fresh stage-move actions are being created.
2. There is **no sweep API endpoint** at `/api/buildout/process-stage-updates`.
3. The current proposer creates a tier-`approve` action; the plan wants tier-`auto`
   for high-confidence deterministic transitions.
4. Idempotency stamp (`comm.metadata.buildoutStageUpdate`) is not written.
5. Sensitive-content filter is not run.
6. `propertyKey` lookup uses substring match against `propertyAddress`, not the
   `normalizeBuildoutProperty` key the plan calls for.

So Phase B is meaningfully ~40% done. The remaining work matches the plan's
acceptance criteria; we'll layer on top of the existing helper rather than build
parallel scaffolding.

### Phase D — Buyer-rep detection

- `src/lib/deals/buyer-rep-detector.ts` — `classifyBuyerRepSignal()`. Detects LOI
  (conf 0.85) and tour (conf 0.75) signals on outbound emails to a fixed broker
  domain list. NDA and tenant-rep "in the market" signals are NOT yet implemented.
- `src/lib/deals/buyer-rep-action.ts` — `proposeBuyerRepDeal()`. Always tier
  `"approve"`. No dedupe. (See Failure mode #1.)
- `src/lib/msgraph/emails.ts:1253-1284` — already wired into fresh ingest.
- `scripts/backfill-buyer-rep-actions.mjs` — historical sweep.

What is **NOT** done:

1. NDA detection signal.
2. Tenant-rep search-activation signal.
3. Tier differentiation (LOI + attachment → tier `"auto"`; tour → `"approve"`;
   "in the market" → `"log_only"`). Today everything is `"approve"`.
4. Dedupe at proposal time (see Failure mode #1).
5. Filter chip for buyer_rep on the Deals Kanban.

Phase D's acceptance can be partly satisfied by: (a) hardening dedupe + the existing
detector for signal volume rather than rewriting it, (b) adding NDA + tenant-rep
patterns, (c) splitting confidence tiers.

## Recommendations for downstream phases

1. **Before Phase B implementation:** decide whether to retire
   `proposeStageMoveFromBuildoutEmail` and start fresh per the plan (`deal-stage-processor.ts`),
   or extend it. Recommend extending — the regex parser is solid and tested.
2. **Before Phase D implementation:** dedupe at proposal time is the single highest-ROI
   change. Without it, any Phase B-cron / Phase D-cron will keep growing the queue
   past usefulness.
3. **Side fix worth bundling with Phase B / Phase C:** add Zod validation on
   `update-deal` `fields.probability` to require integer 0-100. Cheap.
4. **Operational cleanup:** the existing 306 pending `create-deal` rows should be
   collapsed to 83 by writing a one-shot dedupe script that rejects all but the
   newest row per `(recipientEmail, signalType)`. Recommend doing that immediately
   before turning on any Phase D-related cron, but **not** before the user has had
   a chance to triage the queue manually.

## Test coverage gaps surfaced

`agent-actions-deal.test.ts` exists. It does not currently exercise:

- The `outcome="won"` branch of `moveDealStageFromAction` when `toStage === "closed"`.
- The find-or-create branch of `createDealFromAction` (only the
  `payload.contactId` branch is covered).
- The `forbidden_update_field` rejection path.

Adding these is a tiny lift and worth doing alongside Phase C (since Phase C edits
this file anyway for the role-lifecycle hook).

## Files touched by this audit

- Added: `full-kit/scripts/phase-7-audit.mjs` (audit harness — keep, useful for
  re-running after handler changes)
- Added: `docs/superpowers/notes/2026-05-02-phase-7-audit-results.json` (raw output)
- Added: `docs/superpowers/notes/2026-05-02-phase-7-audit.md` (this file)

No production code changed.
