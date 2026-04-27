# Historical Email AI Scrub Backfill Orchestration - Design

**Date:** 2026-04-25
**Author:** Zach Reichert (with Codex/Ralplan)
**Status:** Draft for implementation
**Depends on:** [AI Email Scrub](2026-04-24-ai-email-scrub-design.md), [Communication Contact Backfill](2026-04-25-communication-contact-backfill-design.md), [Lead Extractor Diagnostics](2026-04-25-lead-extractor-diagnostics-design.md)
**Related:** [Contact Dossier Rollups](2026-04-25-contact-dossier-rollup-design.md)

---

## Problem

The AI scrub system is implemented for per-email enrichment, but current recon shows:

- `classification IN ('signal', 'uncertain')`: 8,745 historical communications.
- `metadata.scrub` populated: 0.
- Many communications are not linked to contacts/deals yet.

Running `/api/integrations/scrub/backfill` immediately would enrich emails, but it would do so with weaker context and spend paid model/API budget before the deterministic work is done.

The user also wants to use subscription/human-agent capacity first, then pay for API usage only when needed, and use cheap/fast models for low-reasoning work.

---

## Decision

Use a staged orchestration policy:

1. **No-model deterministic prep first.** Run contact/client linking and lead extractor diagnostics before any paid bulk scrub.
2. **Subscription-first development and QA.** Use subscription/OMX/Codex agent capacity for planning, code changes, test fixture review, dry-run analysis, and sampled human QA. Do not bulk-send private email bodies through uncontrolled manual chat sessions.
3. **API only behind an explicit budget gate.** Bulk processing of email bodies must run inside app-controlled code with route gates, telemetry, scrub API logs, prompt-cache verification, and a hard spend cap checked before each model call or reserved for the batch before rows are claimed.
4. **Fast-model default, escalation by exception.** Low-reasoning tasks use the cheapest configured fast model lane; stronger models are reserved for conflicts, high-value client dossiers, or failed validation retries.

This preserves the user intent of avoiding unnecessary API spend while keeping private email processing auditable and repeatable.

---

## Goals

- Enqueue and process all historical `signal` + `uncertain` communications after deterministic prep.
- Ensure every successful scrub writes `Communication.metadata.scrub` with summaries, tags, urgency, sentiment, reply-required flag, contact/deal candidates, and model telemetry.
- Generate pending `AgentAction` rows for todos, meeting updates, deal updates, and memories without auto-executing sensitive mutations.
- Make the notes/todos deliverable explicit: historical scrub produces **reviewable proposals** first; user-visible `Todo` and `AgentMemory` rows are materialized only through an approval/materialization path that links the created entity back to its `AgentAction`.
- Apply high-confidence contact/deal link candidates only via the separate linking spec's safe threshold rules.
- Keep one-time cost bounded by current budget configuration and cache-live checks.
- Produce run-level evidence: how many processed, failed, dropped actions, cache hit tokens, estimated spend, and remaining queue.

## Non-goals

- No auto-replies.
- No automatic execution of proposed todos/deal updates in v1; they remain `AgentAction(status='pending', tier='approve')` unless a later approval/control-center spec promotes them.
- No bulk processing of `classification='noise'` rows, except sampled diagnostics if needed.
- No hardcoded external model names in the business logic. Use env/config aliases so cheap/fast lanes can change without code churn.

---

## Prerequisite gates

Before `/scrub/backfill` is allowed for the full historical set:

1. **Contact linking dry-run complete**
   - `2026-04-25-communication-contact-backfill-design.md` Phase 0 report exists.
   - Deterministic contact write batch has either run or been consciously deferred with counts.
2. **Lead extractor diagnostic complete**
   - It explains the "only 1 lead" result.
   - Any critical extractor misses have tests or are documented as follow-ups.
3. **Small scrub smoke batch passes**
   - Run `/api/integrations/scrub/run` with a small `limit` (e.g. 5-20).
   - `status='ok'`.
   - Validation failures are below threshold.
   - Recent `ScrubApiCall.cacheReadTokens` proves caching is live once enough calls exist.
4. **Budget cap is set**
   - Existing budget tracker must reject processing once the configured daily/monthly cap is exceeded.
   - Operator records expected max spend for the historical run in the runbook.
5. **Backfill gate is enabled only for the run window**
   - `SCRUB_ROUTES_ENABLED=true`.
   - `ALLOW_BACKFILL=true` only during the backfill window.
   - `SCRUB_ADMIN_TOKEN` available only to the operator.

---

## Model-routing policy

### Configuration aliases

Add or document these env/config aliases for implementation:

```txt
EMAIL_AI_FAST_MODEL=<cheap-fast-model-alias>
EMAIL_AI_REASONING_MODEL=<stronger-model-alias>
EMAIL_AI_ESCALATION_ENABLED=false
EMAIL_AI_DOSSIER_MODEL=<cheap-fast-model-alias>
```

Implementation should map these aliases in one provider adapter. The specs must not scatter hardcoded model IDs.

### Lanes

| Lane | Work | Default |
|---|---|---|
| Deterministic | SQL linking, exact email matching, dry-run counts | No model |
| Fast AI | Per-email scrub summaries/tags/todos for normal signal/uncertain rows | Cheap/fast configured model |
| Escalation AI | Conflicting link candidates, high-value client summaries, repeated validation failures | Stronger configured model, off by default |
| Human/subscription QA | Reviewing samples, fixtures, specs, tests, prompts | Subscription seat/manual review, no bulk private email dump |

### Escalation triggers

Escalate only when all are true:

- `EMAIL_AI_ESCALATION_ENABLED=true`.
- The row/contact is high-value or high-risk, e.g. active deal, urgent reply, large estimated value, or conflicting candidates.
- Fast lane output fails validation or produces low confidence.

---

## Existing scrub flow to reuse

Current code already provides:

- `backfillScrubQueue()` - enqueues existing signal/uncertain rows without `metadata.scrub`.
- `scrubEmailBatch()` - claims `ScrubQueue` rows, calls the scrub model, validates output, writes metadata, creates pending `AgentAction` rows, logs API calls.
- `isCachingLive()` - refuses backfill when prompt caching is not engaging after enough successful samples.
- `ScrubApiCall` - authoritative spend/usage log.
- `SystemState` - circuit breaker and budget state.

This spec should extend orchestration and runbook behavior, not rewrite the scrub worker.

---

## Historical runbook

### Pilot-batch loop before full 90-day run

Do not jump directly from dry-run to the full 90-day historical set. Scale only
after sampled quality passes:

1. Dry-run 100-250 communications; inspect contact/deal/lead/todo/memory
   decisions.
2. Write the same small chunk with deterministic links only.
3. Scrub a tiny batch from that chunk.
4. Materialize only low-risk notes/todos/memories.
5. QA linked contacts, active-vs-closed deal references, and note/todo quality.
6. Fix parser/rules/prompts, then repeat.
7. Increase chunk size only after the previous size passes, e.g.
   `250 -> 500 -> 1000 -> full eligible remainder`.

Closed/worked deals may be referenced in dossier notes, but deterministic
`dealId` writes only attach active operational deals. Historical/closed deal
matches stay as evidence in scrub/dossier output or review candidates unless a
separate migration explicitly approves closed-deal linking.

### Step 1 - deterministic prep

1. Run communication contact/client link dry-run.
2. Write deterministic links in small batches.
3. Run lead extractor diagnostic.
4. Apply extractor fixes/reprocess leads if needed.
5. Re-run link dry-run to capture improved counts.

### Step 2 - scrub smoke test

1. Ensure scrub routes enabled.
2. Run `POST /api/integrations/scrub/run` with a tiny limit.
3. Inspect:
   - `BatchSummary.status`
   - `ScrubApiCall` rows
   - `Communication.metadata.scrub` shape
   - pending `AgentAction` examples
4. If caching-live false or validation failures cluster, stop and fix prompt/schema.

### Step 3 - enqueue backfill

Run `POST /api/integrations/scrub/backfill` only after gates pass.

Expected output for current recon should be near 8,745 enqueued minus rows already scrubbed or already queued.

The existing unbounded route/function must be hardened before historical
production use. Required request contract:

```json
{
  "dryRun": true,
  "limit": 500,
  "cursor": null,
  "runId": "scrub-enqueue-20260425-001"
}
```

Required behavior:

- `dryRun` defaults to `true`.
- `limit` is required for write mode and capped by `SCRUB_BACKFILL_MAX_ENQUEUE_LIMIT` (default 500).
- The query orders by stable `(date ASC, id ASC)` or `(id ASC)` cursor and returns `nextCursor`.
- Dry-run returns eligible count, sampled IDs, and next cursor without writing `ScrubQueue`.
- Write mode creates at most `limit` queue rows, records `runId` in queue metadata if a queue metadata column is added later, or in `SystemState` run logs for v1.
- Re-running with the same cursor/runId is idempotent because `ScrubQueue.communicationId` is unique and `createMany(..., skipDuplicates: true)` remains required.

### Step 4 - process queue in batches

Use existing `/scrub/run` batches or cron. Keep batches small enough for logs and recovery.

Track:

- pending/in-flight/done/failed queue counts.
- succeeded/failed per batch.
- dropped actions.
- estimated spend from `ScrubApiCall`.
- cache read tokens.
- top validation errors.

Budget enforcement must be tighter than a one-time pre-batch check. The worker
must either:

1. call `assertWithinScrubBudget()` immediately before every model call, or
2. reserve a conservative maximum estimated batch cost before claiming rows and
   release unused reservation after the batch.

Per-row checking is simpler and is the default requirement unless reservation is
implemented deliberately.

### Step 5 - post-scrub link candidate application

Run communication linker Phase 4 dry-run:

- auto-apply `>=0.90` contact/deal candidates that pass consistency checks.
- export `0.80-0.89` candidates for review.

### Step 6 - action review readiness

Confirm pending `AgentAction` rows can be reviewed by the existing or planned approval UI before treating todos/notes as user-visible truth.

For now, `AgentAction` is the safety layer; do not auto-create `Todo` rows from scrub unless a separate approval execution spec is implemented.

This means v1 completion has two levels:

- **Backfill complete:** every eligible email has scrub metadata and pending
  proposals where appropriate.
- **Notes/todos complete:** pending `create-todo` and `create-agent-memory`
  actions have been reviewed or auto-materialized by a separately approved
  action executor that writes `Todo.agentActionId`, `Todo.communicationId`,
  and/or `AgentMemory.agentActionId`.

If the project requirement is "all notes and todos are actually added", the
implementation plan must include that approval/materialization lane before the
work is declared product-complete.

For this user's stated goal, **product-complete means actual notes/todos are
materialized**, not merely proposed. Therefore implementation must include a
bounded materialization lane after scrub:

1. Dry-run pending `AgentAction(actionType IN ('create-todo',
   'create-agent-memory'))` grouped by confidence/risk.
2. Auto-materialize only low-risk action types that pass validation and
   idempotency checks, or present them for approval if the approval UI is ready.
3. Create `Todo`/`AgentMemory` rows in a transaction with
   `agentActionId` backlinks.
4. Mark `AgentAction.status='executed'` only after the entity write succeeds.
5. Leave deal-stage, meeting, and other sensitive mutations pending approval.

---

## Supabase update policy

All writes must be:

- idempotent,
- batch-limited,
- transactionally scoped per row or per small batch,
- auditable via existing row metadata and/or `ScrubApiCall`,
- resumable after failures,
- blocked by env gates in production unless explicitly enabled.

No script should run an unbounded update across all 22k rows without a dry-run count and a limit/batch cursor.

---

## Acceptance criteria

1. Backfill cannot run if prompt caching is proven not live.
2. Backfill cannot run in production unless `ALLOW_BACKFILL=true` and scrub route auth passes.
3. Signal/uncertain rows without `metadata.scrub` are enqueued exactly once.
4. Scrub worker writes metadata and pending `AgentAction` rows atomically with queue completion.
5. Every model call is logged in `ScrubApiCall`, including validation/commit failures.
6. Batch summaries expose processed/succeeded/failed/dropped actions/tokens/cache/cost.
7. High-confidence contact/deal candidates are not written by the scrub worker itself; they are applied by the separate backfill linker with audit metadata.
8. Fast/cheap model lane is the default configurable path; stronger model use is explicit and off by default.
9. Historical run stops automatically on budget cap, auth circuit open, cache-live failure, or strict validation halt.
10. `/scrub/backfill` enqueue supports `dryRun`, `limit`, `cursor`, and `runId`; production write mode cannot enqueue the full historical set in one unbounded call.
11. Budget is checked before each model call or reserved before claim; a batch cannot knowingly exceed the configured cap after a single stale preflight check.
12. The plan distinguishes pending AI proposals from materialized `Todo`/`AgentMemory` records, and product completion requires the materialization path if actual notes/todos are expected.
13. For this project, product completion requires materialized low-risk `Todo` and `AgentMemory` rows, not just pending proposals; sensitive non-note/todo actions may remain pending approval.

---

## Test plan

### Unit tests

- `backfillScrubQueue()` enqueues only signal/uncertain rows missing `metadata.scrub` and missing queue row.
- Backfill route refuses when `isCachingLive()` is false.
- Backfill route defaults to dry-run, enforces max `limit`, returns `nextCursor`, and writes at most `limit` queue rows.
- Batch summary aggregates usage and failure counts.
- Budget cap is enforced before each model call or via a tested reservation path.
- Model alias config resolves defaults and rejects unknown aliases.
- Escalation is skipped when disabled.
- Candidate application remains outside scrub worker.
- Pending `create-todo`/`create-agent-memory` proposals are not confused with materialized `Todo`/`AgentMemory` rows in stats.

### Integration checks

```powershell
pnpm test -- scrub scrub-queue scrub-applier scrub-api-log budget-tracker
pnpm exec tsc --noEmit
pnpm lint
```

Manual run evidence:

1. `/scrub/stats` before enqueue.
2. `/scrub/run limit=5` smoke batch.
3. `ScrubApiCall` query proving usage/caching.
4. `/scrub/backfill` enqueue result.
5. Batch processing logs until queue done/failed.
6. Failure requeue report if needed.
7. Final counts:
   - signal/uncertain total,
   - scrubbed signal/uncertain,
   - failed queue rows,
   - pending actions by action type.

---

## Remaining risks

- A subscription UI/seat is not an auditable bulk email processing system; bulk private email body processing should stay in controlled app code.
- If many historical rows lack bodies, scrub quality will be limited unless Graph re-fetch is added.
- If deterministic linking is skipped, scrub link candidates and dossiers will be weaker.
- If approval UI is not ready, scrub-generated todos/notes exist as pending `AgentAction`s but are not yet part of Matt's live task list.
