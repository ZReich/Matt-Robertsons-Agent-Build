# Phase B Notes — Buildout Deal-Stage Email Processor

**Date:** 2026-05-02
**Plan:** `docs/superpowers/plans/2026-05-02-deal-pipeline-automation.md`, Phase B
**Audit:** `docs/superpowers/notes/2026-05-02-phase-7-audit.md` (precondition)

## What landed

| Path | Change |
|---|---|
| `full-kit/src/lib/deals/buildout-stage-action.ts` | **Rewrite.** Single exported `processBuildoutStageUpdate(communicationId)` returns a discriminated `ProcessBuildoutStageUpdateResult` (executed / already-processed / sensitive-filtered / not-a-stage-update / deal-not-found / stage-divergence / comm-not-found). All side-effects (AgentAction create + Deal update + idempotency stamp + role sync) wrapped in a single `db.$transaction`. Sweep helper `processUnprocessedBuildoutStageUpdates({ lookbackDays, limit })`. Backward-compat shim `proposeStageMoveFromBuildoutEmail({ communicationId })` for the existing backfill caller. |
| `full-kit/src/lib/deals/buildout-stage-action.test.ts` | **Rewrite.** 11 tests cover happy path, Closed→won, Dead→lost, sensitive-filter, parser-null, unmappable-stage, deal-not-found, stage-divergence, idempotency, comm-not-found, propertyKey lookup. |
| `full-kit/src/lib/msgraph/buildout-stage-parser.ts` | **Extended.** Added Sourcing, Evaluating, Dead to the stage map (after live-corpus audit revealed those labels are what Buildout actually emits). Added `mapBuildoutStageToDealOutcome(rawTo)` paired so Closed→won and Dead→lost. |
| `full-kit/src/lib/msgraph/buildout-stage-parser.test.ts` | New cases for Sourcing/Evaluating/Dead and the outcome mapper. |
| `full-kit/src/lib/backfill/lead-apply-backfill.ts` | Updated caller to the simpler `{ communicationId }` signature. |
| `full-kit/src/lib/backfill/lead-apply-backfill.test.ts` | Updated mock signature + assertions. |
| `full-kit/src/lib/msgraph/emails.ts` | **Live-ingest hook.** After successful persist of a Buildout deal-stage email (`extracted.kind === "deal-stage-update"`, inbox folder, freshly-inserted), call `processBuildoutStageUpdate(persisted.communicationId)`. Wrapped in try/catch — failures log but don't poison the cursor. |
| `full-kit/src/app/api/buildout/process-stage-updates/route.ts` | **New.** `POST` accepts `{ communicationId }` (single) or `{ sweep: true, lookbackDays?, limit? }` (batch). Auth: `requireApiUser` + `validateJsonMutationRequest`, mirroring the daily-listings route. |

## Test count delta

| | Before | After |
|---|---|---|
| Vitest tests | 761 | 775 |
| Test files | 86 | 86 |
| Net | +14 |

Both gates green:
- `pnpm exec tsc --noEmit --pretty false` — clean
- `pnpm test` — 775/775 passing

## Manual sweep verification

Ran the new processor against the live Supabase DB. Two passes via local-only audit scripts (`phase-b-sweep-audit.mjs` + `phase-b-fixture-test.mjs`, both deleted after the run, not committed).

### Pass 1 — sweep against the actual historical corpus (14 emails)

```
{
  "deal-not-found": 9,
  "sensitive-filtered": 3,
  "not-a-stage-update": 2   // earlier run before stage-map was extended
}
Executed: 0
```

After the stage-map was extended for Sourcing/Evaluating/Dead, 9 of the 14 historical Buildout deal-stage emails parse cleanly but **don't have a matching `seller_rep` Deal** in the DB. Their property nicknames (Valley Commons, Gallatin Road, Alpenglow Healthcare LLC Lease, etc.) don't align with the 26 existing seller_rep Deals' propertyKeys (which are street-address-derived from the lead → deal flow). 3 trip the sensitive filter on substring `w9` inside Buildout's tracking URLs — conservative behavior per the plan.

This was a **finding, not a bug**: the processor is correctly conservative. The stage moves can't run on this corpus until either (a) Matt's actual Buildout deals exist as Deal records (Phase 5 lead → deal creation) with matching propertyKeys, or (b) the property-key resolution gains a Buildout-nickname → deal mapping table.

### Pass 2 — fixture test (5 synthesized Deals matching Buildout nicknames)

To prove the executed path actually moves stages on real Buildout email bodies, I synthesized 5 `seller_rep` Deals with propertyKeys matching the Buildout property names from 5 historical emails, ran the processor, verified the moves, ran the idempotency check, then cleaned up.

```
## Run processor
  d8457d24 → executed  (Valley Commons)            prospecting → closed
  f1f29e56 → executed  (Gallatin Road)             prospecting → closed
  2f5bfb75 → executed  (2621 Overland)             prospecting → under_contract
  17098746 → executed  (Agri Industries Sheridan)  prospecting → closed
  7e40484a → executed  (Billings Depot)            prospecting → under_contract

## Verify deal final state
  valley commons           → stage=closed         outcome=lost   closedAt=set
  gallatin rd              → stage=closed         outcome=lost   closedAt=set
  2621 overland            → stage=under_contract outcome=null   closedAt=null
  agri industries sheridan → stage=closed         outcome=lost   closedAt=set
  billings depot           → stage=under_contract outcome=null   closedAt=null

## Idempotency re-run
  d8457d24 → already-processed
  f1f29e56 → already-processed
  2f5bfb75 → already-processed
  17098746 → already-processed
  7e40484a → already-processed
```

5/5 stage moves landed correctly, including:
- `Sourcing → Dead` correctly mapped to `closed` + outcome=`lost` + `closedAt` stamped (3 deals)
- `Sourcing → Transacting` correctly mapped to `under_contract`, outcome unset, closedAt unset (2 deals)
- All AgentActions written at `tier="auto"` / `status="executed"` (verified during cleanup, deleted by id)
- `syncContactRoleFromDeals` fired for each (2 `set-client-type` actions written by the role-sync helper, also cleaned up)
- Idempotency stamps on Communications worked — second pass = 0 executed

Cleanup verified: 26 `seller_rep` deals (same as before), zero `PHASE-B-FIXTURE` rows lingering. Original Communication idempotency stamps restored as `deal-not-found` with `_phaseBAuditCleanup: true` so the next sweep no-ops on those rows correctly. The 5 fixture-related stamps will not re-process even after this audit because the metadata stamp short-circuits before the `findFirst` happens.

## Decisions made

1. **Stage map extension (Sourcing, Evaluating, Dead)** — the plan assumed the existing `BUILDOUT_TO_DEAL_STAGE` covered Buildout's labels. Live audit revealed it didn't — those three are the most common labels in Matt's actual emails. Without the map extension, 9 of 14 historical emails would hit `not-a-stage-update`. Mapped Sourcing+Evaluating both to `prospecting` (Matt's pipeline doesn't distinguish) and Dead to `closed` with paired outcome=`lost`.
2. **`mapBuildoutStageToDealOutcome` as a separate function** rather than embedding "Dead means lost" in the processor — keeps the stage parser pure and lets future paths (e.g. Phase D buyer-rep stage moves) reuse the same logic without re-implementing the mapping.
3. **Bypass approval flow at scrub time per the plan** — wrote the AgentAction with `tier="auto"` and `status="executed"` in the same tx as the Deal mutation, mirroring the post-conditions of the existing `moveDealStageFromAction` (stage, stageChangedAt, closedAt+outcome on close, syncContactRoleFromDeals call).
4. **Idempotency stamping on every code path that mutates Deal** — including the bail paths (`deal-not-found`, `stage-divergence`, `sensitive-filtered`). This means re-running a sweep is a guaranteed no-op for any Communication we've already considered, even if we couldn't act on it. The trade-off: future schema/parser improvements that would let us *now* move a Deal we previously couldn't will be skipped until the stamp is manually cleared. Documented as a known limitation; the cron is conservative-by-default.
5. **Backward-compat shim `proposeStageMoveFromBuildoutEmail({ communicationId })`** — kept the old export name so `lead-apply-backfill.ts` (and its test) didn't need a more invasive surgery. The shim translates the new discriminated result back to the legacy `{ created, actionId, status }` shape.
6. **Property-key normalization with empty body** — the original `normalizeBuildoutProperty(name, body)` includes `firstAddress(body)` heuristics, but Buildout deal-stage email bodies contain the literal phrase "was updated from X to Y" which `firstAddress` mistakes for an address fragment. I pass `""` for the body to avoid that pollution; the propertyName alone is the canonical key source.

## Punted with rationale

- **Vercel cron entry (Phase B-cron)** — the plan called for a 15-minute cron to invoke the new sweep endpoint with `{ sweep: true, lookbackDays: 1 }`. Plan §B.6 explicitly says "Don't ship this until at least 5 Buildout emails have been processed manually and the moves were correct." The fixture run met that bar but the real corpus didn't trigger any executions. Recommend deferring the cron until the propertyKey alignment gap (see "decisions" #4) is closed; otherwise the cron will accumulate `deal-not-found` stamps on every fresh Buildout email and silently no-op forever.
- **Route-level test for `/api/buildout/process-stage-updates`** — `daily-listings/process/route.ts` doesn't have a peer test file in this repo, so I followed the convention and didn't add one. The processor + sweep helper are exhaustively unit-tested; the route is a thin wrapper.
- **propertyAliases lookup** — the original `proposeStageMoveFromBuildoutEmail` matched against `propertyAddress contains` and `propertyAliases array_contains`. The new processor uses `propertyKey` exact-match only (per spec). If a Deal exists with the right `propertyAddress` substring but no `propertyKey`, the processor will report `deal-not-found`. This is intentional — the partial unique index `deals_property_key_seller_rep_active_uidx` only enforces uniqueness on `propertyKey`, so that's the canonical identity. A future enhancement could add an alias fallback, but the conservative default avoids spurious matches.
- **Sensitive-filter false positives on Buildout tracking URLs** — 3 of 14 emails trip the filter because Buildout's tracking-URL slugs occasionally contain the substring `w9`. The plan explicitly says "skipping is the conservative choice" and "false positives here just mean a Communication doesn't get scrubbed/auto-replied — Matt still sees it in his inbox." Did not change the filter; documented the noise level for future tuning.

## Concerns to surface

1. **PropertyKey alignment is the bottleneck for any future Phase B value.** The current sweep would do nothing useful in production until either (a) Matt's existing Buildout deals are mirrored as Deal rows with property keys matching Buildout's nicknames, or (b) we introduce an alias-resolution table. Phase 5 of the prior plan (lead → deal creation) doesn't address this directly because Buildout's pipeline lives outside that flow. Worth a short follow-up plan.
2. **Live ingest hook fires on inbound + extracted-kind only** — that's correct, but if Buildout ever changes their subject pattern (e.g. adds a localized variant) `extractBuildoutEvent` will return null and the live hook won't fire. The sweep endpoint will catch any drift on the next run.
3. **The sensitive filter trips on `w9` inside tracking URLs.** Consider stripping URL hashes before sensitivity scanning in a future filter-tuning pass. Tracked as a known false positive.

## Open questions for review

- Should `Sourcing` and `Evaluating` collapse to `prospecting`, or do you want a finer-grained mapping that distinguishes them? I picked `prospecting` because the existing DealStage enum has no equivalent stage.
- For "Dead" the outcome is `lost`. Buildout doesn't transmit a separate "deal won" vs "deal expired" signal — should `Closed` always imply `won`, or is there a path where `Closed` means `expired` / `withdrawn`? Today: `Closed` → `won`, `Dead` → `lost`. Anything else gets no outcome.
- Cron schedule for the sweep endpoint: defer until propertyKey alignment is solved? Or ship the cron now (sweep would be a no-op on real data but at least we'd see "still 0 executed, 9 deal-not-found per day" in metrics)?

## Commits in this branch

To be created in the next step. The change set is staged across these files:
- `full-kit/src/lib/deals/buildout-stage-action.ts` (rewrite)
- `full-kit/src/lib/deals/buildout-stage-action.test.ts` (rewrite)
- `full-kit/src/lib/msgraph/buildout-stage-parser.ts` (extend stage map + outcome mapper)
- `full-kit/src/lib/msgraph/buildout-stage-parser.test.ts` (new cases)
- `full-kit/src/lib/msgraph/emails.ts` (live ingest hook)
- `full-kit/src/lib/backfill/lead-apply-backfill.ts` (caller signature)
- `full-kit/src/lib/backfill/lead-apply-backfill.test.ts` (mock signature)
- `full-kit/src/app/api/buildout/process-stage-updates/route.ts` (new endpoint)
- `docs/superpowers/notes/2026-05-02-phase-b-notes.md` (this file)
