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

## Spec-review follow-ups (2026-05-02, post-Phase-B)

External spec-review pass surfaced two real gaps. Both fixed in follow-up commits:

### Gap 1 — Sender / source check missing on non-ingest paths

The live ingest path is safe because `email-filter.ts` only routes Buildout
notifications to the processor when the sender + subject pre-checks already
fired. But the sweep query and the single-row API call relied on subject
regex alone — a forged or misclassified inbound row with the right subject
would have been processed.

Fix:
- `processBuildoutStageUpdate` now performs a defense-in-depth check on
  `comm.metadata.source === "buildout-event"` (the value `email-filter.ts`
  stamps after its sender + subject allowlist passes). Mismatch returns the
  new discriminated variant `{ status: "non-buildout-source", observedSource }`
  and writes a `skippedReason: "non-buildout-source"` idempotency stamp so
  re-runs short-circuit on `already-processed` instead of re-evaluating.
- `processUnprocessedBuildoutStageUpdates` (the sweep query) now also
  filters at the DB layer with
  `metadata.path: ["source"], equals: "buildout-event"`, so non-Buildout rows
  never appear as candidates.
- New tests cover the failure mode the reviewer described: a Communication
  with the matching subject regex but `metadata.source !== "buildout-event"`
  (and a separate case for missing metadata entirely) returns
  `non-buildout-source` and writes the stamp.
- Pre-existing test fixtures had `source: "buildout-notification"` (a typo —
  the actual upstream value is `"buildout-event"`); fixture updated to
  reflect what `email-filter.ts` actually emits.

### Gap 2 — Auth posture on the sweep route weaker than spec

The route used `requireApiUser` (any authenticated user). The spec called for
mirroring `auto-approve-pending`, which uses `requireAgentReviewer` (reviewer
allowlist). This route can mutate Deal stages and write executed
AgentActions, so the stricter posture is correct.

Fix:
- Swapped `requireApiUser` for `requireAgentReviewer` and switched the
  request-validation helpers from `validateJsonMutationRequest` to the
  explicit `assertSameOriginRequest` + `assertJsonRequest` pair, with the
  whole handler wrapped in a `try/catch (ReviewerAuthError)` block that maps
  the auth error to a JSON response with the right status (matches
  `auto-approve-pending` exactly).
- No existing route-level tests to update (per the original notes file the
  route still has no peer test; the processor + sweep helper carry the
  coverage).

### Gates after follow-up

- `pnpm exec tsc --noEmit --pretty false` — clean (exit 0)
- `pnpm test` — 777/777 passing (was 775; +2 new tests for the source check)

## Code-quality follow-ups (2026-05-02, post-spec-review code-quality pass)

External code-quality reviewer flagged 2 IMPORTANT findings + 9 NITs. The two
IMPORTANT findings are addressed below. The 9 NITs (#3–11) are explicitly
deferred at the user's request to a separate cleanup pass.

### Finding 1 (IMPORTANT) — concurrent-execution race produced duplicate executed AgentActions

The pre-tx `previousStamp` short-circuit read `comm.metadata` outside any
transaction, and the tx never re-read or locked the Communication before
stamping. Two concurrent callers (live ingest + manual sweep, or two sweep
retries on overlapping schedules) could both:

1. read `previousStamp = undefined` from their pre-tx fetches,
2. enter their own `db.$transaction`,
3. both create `move-deal-stage` AgentActions with `status="executed"`,
4. both update the Deal stage,
5. both stamp the Communication.

End state: the Deal sees one effective stage move, but the audit log has
**two** executed AgentActions claiming the same move.

**Fix mechanism:** Added a Postgres advisory transaction lock keyed on the
Communication id at the very top of the tx, plus an in-tx re-read of
`metadata.buildoutStageUpdate`:

```ts
return await db.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${comm.id}))`
  const fresh = await tx.communication.findUnique({
    where: { id: comm.id },
    select: { metadata: true },
  })
  const freshMeta = (fresh?.metadata ?? {}) as Record<string, unknown>
  if (freshMeta.buildoutStageUpdate) {
    return { status: "already-processed", previous: ... } as const
  }
  // ...rest of tx body, using freshMeta as the base for stamp merging
})
```

Both racing callers serialize on the advisory lock; the loser wakes up after
the winner commits, sees the stamp via the in-tx re-read, and returns
`already-processed` without writing anything. The pre-tx `previousStamp`
short-circuit is preserved as a cheap fast-path for the common case.

`freshMeta` is also now what gets spread into the final stamp write (and
into the in-tx `stampSkip` calls for `deal-not-found` / `stage-divergence`),
so any unrelated concurrent metadata writes between the pre-tx read and the
tx commit aren't clobbered. (This also addresses NIT #5 about meta
clobbering, as a free side-effect.)

The pre-tx checks (sensitive filter, source check, parser, stage-collapse
guard) intentionally stay outside the tx — they don't write to the Deal or
AgentAction tables (only idempotency stamps) and cheap short-circuits there
keep the tx scope minimal.

**Tests added** (4):

- `acquires a pg advisory lock inside the transaction before mutating`
- `re-reads metadata inside the tx and short-circuits when a concurrent run already stamped`
- `preserves concurrent metadata writes by spreading freshMeta into the stamp`
- `sequential back-to-back invocations: second call returns already-processed`

The first three exercise the lock-and-re-read path with mocked
`findUnique` returning different values for the pre-tx and in-tx reads; the
fourth uses an in-memory metadata shim where `communication.update` writes
through to the same store `findUnique` reads from, simulating a real
sequential idempotency round-trip.

### Finding 2 (IMPORTANT) — stage-collapse mapping created no-op executed AgentActions

`Sourcing` and `Evaluating` both map to `prospecting` in
`buildout-stage-parser.ts`. A "Sourcing → Evaluating" Buildout email parsed
to `fromStage = toStage = "prospecting"`. If the deal was at `prospecting`,
the divergence guard (`deal.stage !== fromStage`) passed and the processor
wrote a no-op `move-deal-stage` AgentAction + bumped `stageChangedAt`. That
polluted the audit log with executed actions that didn't actually move the
deal anywhere.

**Fix:** Added a stage-collapse guard right after `fromStage` and `toStage`
are resolved (after the parser block, before the propertyKey lookup). If
`fromStage === toStage`, stamp idempotency with
`skippedReason: "stage-collapsed"` and return the new discriminated-result
variant `{ status: "stage-collapsed", stage, fromStageRaw, toStageRaw,
collapsedTo }`. The new status was added to
`ProcessBuildoutStageUpdateResult`, and the sweep helper's `byStatus`
aggregation picks it up automatically because it's keyed off `result.status`.

**Tests added** (2):

- `returns stage-collapsed and writes no AgentAction / no Deal update for Sourcing → Evaluating`
- `does not collapse genuine moves like Marketing → Showings` (regression guard)

### Deferred NITs (#3–11)

Per the user's explicit instruction, the 9 NITs flagged by the reviewer are
deferred to a separate cleanup pass and intentionally not addressed here.
NIT #5 (meta clobbering on the in-tx stamp write) was incidentally resolved
by the Finding 1 fix because using `freshMeta` for the stamp base is the
correct merge behavior regardless.

### Gates after code-quality follow-up

- `pnpm exec tsc --noEmit --pretty false` — clean (exit 0)
- `pnpm test` — 783/783 passing (was 777; +6 new tests: 4 for the race fix,
  2 for the stage-collapse fix)
