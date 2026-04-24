# AI Email Scrub + Task Generation — Design

**Date:** 2026-04-24
**Author:** Zach Reichert (with Claude)
**Status:** Revised after adversarial review — awaiting final approval
**Depends on:** [Email Ingestion](2026-04-23-email-ingestion-design.md)
**Blocks (soft):** Leads/Deals Kanban spec, Dashboard Hub spec — both should pause until this lands
**Blocks (hard, for user-visible value):** a sibling "retire-the-vault / UI→Prisma migration" spec (not yet written)

### Revision log

- **2026-04-24 rev-2** — adversarial review caught 8 real issues; all addressed in place:
  1. Prompt caching is now a **hard constraint, not an assumption** — `SYSTEM_PROMPT` deliberately padded to exceed the highest plausible per-model threshold; an implementation-time assertion validates `cacheReadTokens > 0` before backfill runs; degraded-mode cost ceiling documented.
  2. Budget accounting moved off `Communication.metadata.scrub` and onto a new **`ScrubApiCall`** table that logs every Anthropic response including those whose downstream validation/commit failed. Budget tracker is authoritative on spend.
  3. Prompt-version requeue is **in-place UPDATE**, never DELETE — consistent across all sections.
  4. Worker claim/commit now uses a **fencing token** (`leaseToken`) to prevent duplicate `AgentAction` writes under lease expiry. Lease bumped from 2 min to 5 min as belt-and-suspenders.
  5. **`SystemState`** table added to the schema section (circuit breaker was referenced but unbacked in rev-1).
  6. Approval semantics flipped to **entity-write first, status-last, one transaction** — no more "executed" without a corresponding entity.
  7. `AgentMemory` gains an `agentActionId` back-link so the contract's "entity backlinks to action" rule holds for `create-agent-memory` too.
  8. Scrub routes use **dedicated env vars** (`SCRUB_ADMIN_TOKEN`, `SCRUB_CRON_SECRET`, `SCRUB_ROUTES_ENABLED`) — no longer piggybacks on the Graph test-route flag.

---

## Context

Email ingestion (completed spec 2026-04-23) now flows Matt's Outlook mailbox into Prisma `Communication` rows, classified `signal` / `noise` / `uncertain`, tagged by source (`crexi-lead`, `buildout-event`, `nai-internal`, …), with lead-inquirer Contacts auto-created. The ingester stops at structured tagging — it does not read bodies for meaning.

This spec adds the **AI scrub** layer: every non-noise email gets passed through Claude (Haiku 4.5 with prompt caching), which produces:

- A human-readable **summary**, **topic tags**, **urgency**, **replyRequired** flag, and **sentiment** — written onto `Communication.metadata.scrub`
- **Proposed links** to existing Contacts and Deals (ranked, not auto-attached)
- **0–5 suggested structured mutations** — create a Todo, move a Deal stage, update a Deal field, schedule/update a Meeting, or save an AgentMemory — emitted as `AgentAction` rows with `tier=approve, status=pending`

Matt reviews pending `AgentAction`s in the (sibling-spec) Agent Control Center. Approve executes the mutation; reject archives it with optional feedback. Over time, specific action types get promoted from `tier=approve` to `tier=auto` — no architectural change, just config.

The output layer is **cloud-native Prisma-only** — no vault writes, no local filesystem dependency. The vault retires as a separate migration effort.

---

## Goals

- Every `Communication` row with `classification ∈ {signal, uncertain}` gets enriched with AI-produced `metadata.scrub` and 0–N proposed `AgentAction` rows, exactly once per `promptVersion`
- Cloud-native from day one: all state is Prisma rows, all API calls are HTTP; nothing reads or writes the vault filesystem
- Prompt-cached Anthropic SDK usage keeps per-email cost at ~$0.002 (well under a $25/month steady-state budget for Matt's mailbox)
- Failure isolation — a bad email never blocks the next one; a bad prompt version never corrupts existing good output; a runaway model response can't blow the budget
- Developer feedback loop — during training, a single malformed model output surfaces loudly; in prod, a single malformed suggestion degrades to a dropped action, not a lost scrub
- Establish the AgentAction `actionType` vocabulary the rest of the system will standardize on (6 action types in v1, extendable)

## Non-goals

- **No user-facing UI.** This spec ships data + admin routes only. Every screen Matt touches (approval queue, per-email scrub display, dashboard widgets) is a sibling spec.
- **No email drafting / auto-reply.** Explicitly deferred to a later spec (auto-reply workflows, spec #6 in the ingestion doc's follow-ups). The scrub emits `replyRequired: true` as a hint; the draft generator is future work.
- **No automatic execution in v1.** Every proposed action is `tier=approve`. Promotion to `tier=auto` per action type is a later calibration decision.
- **No `create-contact` / `update-contact` / `create-client` / `send-email` / `send-text` action types in v1.** Sensitive-mutation action types are deferred to dedicated follow-up specs.
- **No re-scrub of unchanged emails.** Bumping `promptVersion` triggers an operational re-queue; routine scrubbing is one-shot per row per version.
- **No vault writes.** Anything user-facing that currently reads the vault is a sibling-spec concern.
- **No Sonnet / Opus tiering.** Haiku 4.5 single-tier in v1; model-routing is a later spec if needed.

---

## Contracts exported by this spec

These are the **frozen interfaces** that sibling specs (Leads/Deals kanban, Dashboard hub, retire-the-vault) must consume. Copying verbatim into sibling sessions on resume.

### 1. `Communication.metadata.scrub`

Added by this spec to the existing flex-JSON `metadata` field. Present only on rows that have been scrubbed successfully.

```ts
interface ScrubOutput {
  summary: string                          // ≤400 chars, 1–2 sentences plain English

  topicTags: Array<
    | "showing-scheduling"
    | "loi-or-offer"
    | "proforma-request"
    | "financing"
    | "tour-feedback"
    | "contract-signing"
    | "closing-logistics"
    | "due-diligence"
    | "pricing-discussion"
    | "new-lead-inquiry"
    | "referral"
    | "internal-coordination"              // NAI-internal ops
    | "personal"                           // slipped through business filter
    | "admin-logistics"                    // scheduling, billing, notary, etc.
    | "other"
  >                                        // max 4

  urgency: "urgent" | "soon" | "normal" | "fyi"
  replyRequired: boolean
  sentiment: "positive" | "neutral" | "negative" | "frustrated" | null   // null for transactional

  linkedContactCandidates: Array<{
    contactId: string
    confidence: number                     // 0..1
    reason: string
  }>
  linkedDealCandidates: Array<{
    dealId: string
    confidence: number
    reason: string
    matchedVia: "property_address" | "property_name" | "key_contact" | "subject_match"
  }>

  modelUsed: string                        // e.g. "claude-haiku-4-5-20251001"
  promptVersion: string                    // e.g. "v1"
  scrubbedAt: string                       // ISO timestamp
  tokensIn: number
  tokensOut: number
  cacheHitTokens: number
}
```

### 2. `AgentAction` action types produced

`AgentAction.actionType` is already a `String` — no enum change. Documented vocabulary this spec emits:

| `actionType` | Approval writes | `payload` shape |
|---|---|---|
| `create-todo` | `Todo` row, linked via `Todo.agentActionId` and `Todo.communicationId` | `{ title: string, body?: string, priority: "low"\|"medium"\|"high"\|"urgent", dueHint?: string, parsedDueDate?: string, contactId?: string, dealId?: string }` |
| `move-deal-stage` | `Deal.stage` update | `{ dealId: string, fromStage: DealStage, toStage: DealStage, reason: string }` |
| `update-deal` | `Deal` field update | `{ dealId: string, fields: { value?: number, closingDate?: string, squareFeet?: number, propertyAddress?: string }, reason: string }` |
| `create-meeting` | `Meeting` + `MeetingAttendee` rows, linked via `Meeting.agentActionId` | `{ title: string, date: string, endDate?: string, location?: string, attendeeContactIds: string[], dealId?: string, reason: string }` |
| `update-meeting` | `Meeting` field update | `{ meetingId: string, fields: { date?: string, endDate?: string, location?: string, title?: string }, reason: string }` |
| `create-agent-memory` | `AgentMemory` row | `{ memoryType: MemoryType, title: string, content: string, contactId?: string, dealId?: string, priority?: Priority }` |

Every action carries:
- `tier = "approve"` (v1)
- `status = "pending"` (v1)
- `targetEntity = "communication:<sourceCommId>"`
- `summary`: ≤200-char human-readable label shown in the approval queue

### 3. Approval-flow semantics (contracts for the sibling UI spec)

When a UI approves an `AgentAction`, both steps happen inside a **single `prisma.$transaction`**, entity-first:

1. The corresponding entity is created/updated per the action-type table above. If an entity is created, its `agentActionId` FK is set back to this action in the same statement.
2. Only after (1) succeeds within the transaction, set `AgentAction.status = executed`, `executedAt = NOW()`.
3. On write failure (e.g., `dealId` no longer exists): transaction rolls back. Outside the rolled-back transaction, set `AgentAction.status = rejected`, `feedback = 'auto-rejected: <reason>'`. `status` never sits at `executed` without a corresponding entity.

When a UI rejects an `AgentAction`:
1. `status = rejected`, optional `feedback` saved
2. No entity is created
3. `Communication.metadata.scrub` stays intact

**Stale-proposal detection:** Approve handlers must compare the action's payload (which carries `fromStage`, current field values, etc.) against the target entity's current state before writing. If the entity has changed in a relevant way, the UI must surface "stale — refresh?" rather than silently overwriting. This spec guarantees payloads carry the context needed for that check.

**Link-candidate confirmation:** When a user confirms a `linkedContactCandidate` / `linkedDealCandidate`, the UI writes `Communication.contactId` / `Communication.dealId` directly. This is not an AgentAction (it's a trivial correction, not a mutation proposal).

### 4. Admin routes exposed by this spec

Gated **independently of the Graph test-route flag** — scrub has its own dedicated auth env vars so prod cron doesn't depend on a test flag intended for the Graph ingestion dev routes.

**New env vars (scrub-scoped):**
- `SCRUB_ADMIN_TOKEN` — secret for human-issued admin calls (`x-admin-token` header, constant-time compared)
- `SCRUB_CRON_SECRET` — secret for Vercel cron invocations (`authorization: Bearer <secret>` header, per Vercel's `vercel.json` cron pattern)
- `SCRUB_ROUTES_ENABLED` — master kill switch. If `"false"` or unset, all four routes return 404 regardless of tokens.

| Route | Auth | Dev-only gate |
|---|---|---|
| `POST /api/integrations/scrub/run` | `x-admin-token = $SCRUB_ADMIN_TOKEN` **OR** `authorization: Bearer $SCRUB_CRON_SECRET` (for cron) | No |
| `POST /api/integrations/scrub/backfill` | `x-admin-token` only | **Yes** — additionally requires `NODE_ENV="development"` OR `ALLOW_BACKFILL=true` |
| `POST /api/integrations/scrub/requeue` | `x-admin-token` only | No |
| `GET  /api/integrations/scrub/stats` | `x-admin-token` only | No |

Cron-specific auth means a leaked admin token (dev convenience, sometimes in `.env.local`) doesn't by itself let someone impersonate the scheduled invocations, and vice-versa. Neither token touches the Microsoft Graph routes' `MSGRAPH_TEST_ROUTE_ENABLED` flag.

---

## Architecture

```
                       ┌───────────────────────────────┐
                       │  Email ingester (existing)    │
                       │  writes Communication rows    │
                       └──────────────┬────────────────┘
                                      │
                                      │ INSERT where classification in {signal, uncertain}
                                      ▼
                       ┌───────────────────────────────┐
                       │  scrub_queue (new table)      │
                       │  rows: { communicationId,     │
                       │          enqueuedAt, attempts,│
                       │          status, lockedUntil }│
                       └──────────────┬────────────────┘
                                      │
                                      │ claimed in batches (FOR UPDATE SKIP LOCKED)
                                      ▼
                  ┌───────────────────────────────────────────┐
                  │  scrubEmailBatch() — the worker            │
                  │  triggered by:                             │
                  │   • Vercel cron every 5 min (prod)         │
                  │   • POST /api/integrations/scrub/run (dev) │
                  │   • (no direct ingester call — enqueue     │
                  │      is the coupling point)                │
                  └──────────────┬────────────────────────────┘
                                 │
                       ┌─────────┴─────────┐
                       ▼                   ▼
              ┌──────────────┐    ┌────────────────────────┐
              │ Anthropic    │    │ Prisma reads for       │
              │ SDK call     │    │ prompt context:        │
              │ w/ prompt    │    │  • candidate Contacts  │
              │ caching      │    │  • candidate Deals     │
              │              │    │  • scoped AgentMemory  │
              │              │    │  • recent thread comms │
              └──────┬───────┘    └────────────────────────┘
                     │
                     │ structured tool call output
                     ▼
              ┌───────────────────────────────────┐
              │ Transactional write:              │
              │  UPDATE Communication             │
              │    SET metadata = metadata || {   │
              │          scrub: {...} }           │
              │  INSERT AgentAction × 0..5        │
              │  UPDATE scrub_queue               │
              │    SET status='done'              │
              └───────────────────────────────────┘
```

**Design principles:**
- **Prisma-native.** No vault reads or writes. No local filesystem dependency. Deploys to Vercel + Supabase with zero local state.
- **Queue decouples ingestion from scrub.** Ingester stays fast and reliable; scrub failures can't stall email sync. Backfill and re-scrub are queue operations, not new code paths.
- **Row-level claim, not advisory lock.** `FOR UPDATE SKIP LOCKED` on the queue lets multiple Vercel invocations run concurrently without stepping on each other.
- **One worker entrypoint.** All triggers (cron, manual) call the same `scrubEmailBatch(limit)` function.
- **No email-send side effects.** The scrub only produces proposals. Execution happens via the existing `AgentAction` approval flow (once the Agent Control Center migrates to Prisma in the sibling spec).

---

## Schema changes

One new enum, three new tables, one new column on `AgentMemory`, and three new back-relations. Everything else in existing tables stays as-is.

```prisma
enum QueueStatus {
  pending
  in_flight
  done
  failed
}

model ScrubQueue {
  id              String        @id @default(uuid())
  communicationId String        @unique @map("communication_id")
  enqueuedAt      DateTime      @default(now()) @map("enqueued_at")
  status          QueueStatus   @default(pending)
  attempts        Int           @default(0)
  lockedUntil     DateTime?     @map("locked_until")
  leaseToken      String?       @map("lease_token")        // fencing token — rotates on each claim; checked on commit
  lastError       String?       @map("last_error") @db.Text
  promptVersion   String?       @map("prompt_version")

  communication   Communication @relation(fields: [communicationId], references: [id], onDelete: Cascade)
  apiCalls        ScrubApiCall[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, enqueuedAt])
  @@index([lockedUntil])
  @@map("scrub_queue")
}

/// Per-API-call usage log. Written on EVERY Anthropic response that reports
/// usage, regardless of whether validation/commit downstream succeeded.
/// This is the authoritative source for budget tracking.
model ScrubApiCall {
  id              String       @id @default(uuid())
  scrubQueueId    String?      @map("scrub_queue_id")      // nullable: logged even if the queue row was already reclaimed
  communicationId String?      @map("communication_id")
  promptVersion   String       @map("prompt_version")
  modelUsed       String       @map("model_used")
  tokensIn        Int          @map("tokens_in")
  tokensOut       Int          @map("tokens_out")
  cacheReadTokens Int          @default(0) @map("cache_read_tokens")
  cacheWriteTokens Int         @default(0) @map("cache_write_tokens")
  /// outcome of the call from the worker's perspective (for debugging, not budget math)
  outcome         String       // "scrubbed" | "validation-failed" | "db-commit-failed" | "fenced-out" | "retry-correction"
  estimatedUsd    Decimal      @db.Decimal(10, 6) @map("estimated_usd")
  at              DateTime     @default(now())

  scrubQueue      ScrubQueue?  @relation(fields: [scrubQueueId], references: [id], onDelete: SetNull)

  @@index([at])
  @@index([communicationId])
  @@map("scrub_api_calls")
}

/// Generic key/value state that persists across serverless invocations.
/// Used here for the auth circuit breaker; extensible for future cross-invocation flags.
model SystemState {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("system_state")
}

model Communication {
  // ... existing fields unchanged ...
  scrubQueue ScrubQueue?
}

model AgentMemory {
  // ... existing fields unchanged ...
  agentActionId String?      @unique @map("agent_action_id")
  agentAction   AgentAction? @relation(fields: [agentActionId], references: [id], onDelete: SetNull)
}

model AgentAction {
  // ... existing fields unchanged ...
  memory AgentMemory?        // back-relation for create-agent-memory executions
}
```

**Why `@unique` on `communicationId`:** one queue row per Communication. Re-scrubbing after a prompt bump **updates the existing row in place** (`UPDATE scrub_queue SET status='pending', attempts=0, locked_until=NULL, lease_token=NULL, last_error=NULL WHERE prompt_version IS NOT NULL AND prompt_version <> '<new>'`) — we never delete and re-insert. Keeps the unique constraint stable and preserves the audit trail via `ScrubApiCall` rows that point at it.

**`leaseToken`** is the fencing primitive — see "Claim fencing" under Pipeline. On each claim, the worker generates a fresh UUID, writes it to `leaseToken`, and carries a local copy. All writes gated on `WHERE id = ? AND lease_token = <carried>`. If another worker has re-claimed the row (and rotated the token), the conditional write affects zero rows and the in-flight worker rolls back.

**`ScrubApiCall`** exists specifically to answer "how much money did we spend, including on calls whose downstream commit failed?" — closes the gap where successful Anthropic calls + failed DB commits would otherwise go uncounted.

**`SystemState`** is a minimal key-value table for cross-invocation flags that don't warrant their own model. v1 uses it only for `scrub-circuit-auth`; schema is deliberately unbounded to avoid needing a migration every time we add a flag.

**`ON DELETE CASCADE`** on `ScrubQueue.communication` and `ON DELETE SetNull` on `ScrubApiCall.scrubQueue`: queue rows follow their Communication to the grave; API-call logs persist for audit even if the queue row they reference gets deleted.

---

## Pipeline

### Enqueue (in the ingester transaction)

`syncEmails()` (existing) already writes `Communication` rows and `ExternalSync` records inside `prisma.$transaction([...])`. For every row where `classification ∈ {signal, uncertain}`, add a third operation:

```ts
prisma.scrubQueue.create({
  data: { communicationId: newCommId, status: "pending" }
})
```

If the enqueue fails (e.g., duplicate — shouldn't happen but defense in depth), the transaction rolls back and the Communication isn't written. That's correct: either both land or neither does.

**Not added:** a direct call from the ingester into `scrubEmailBatch()`. The queue is the coupling point. Keeps email-sync latency predictable and makes backfill / retry paths identical to live-sync paths.

### Worker loop (one batch)

```ts
async function scrubEmailBatch({ limit = 20 } = {}): Promise<BatchSummary> {
  await budgetTracker.assertWithinCap();           // short-circuits on $5/day cap
  await authCircuit.assertClosed();                // short-circuits if SystemState['scrub-circuit-auth'] is tripped

  // Phase 1: claim rows atomically — rotate a fresh lease token per claim
  const claimed = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; communication_id: string }[]>`
      SELECT id, communication_id FROM scrub_queue
       WHERE status = 'pending'
          OR (status = 'in_flight' AND locked_until < NOW())
       ORDER BY enqueued_at ASC
       LIMIT ${limit}
       FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return [];

    // Each claimed row gets its own fresh lease token. We'll pass this
    // token through to every write for this attempt; any write that finds
    // a different token means another worker re-claimed.
    const claims = rows.map(r => ({ ...r, leaseToken: crypto.randomUUID() }));
    for (const c of claims) {
      await tx.scrubQueue.update({
        where: { id: c.id },
        data: {
          status:      "in_flight",
          lockedUntil: new Date(Date.now() + 5 * 60_000),  // 5-min lease (comfortably > typical scrub + retries)
          leaseToken:  c.leaseToken,
          attempts:    { increment: 1 },
        },
      });
    }
    return claims;
  });

  // Phase 2: scrub each row (concurrency = 4)
  const results = await runConcurrent(claimed, 4, scrubOne);

  // Phase 3: emit digest log
  logDigest(results);
  return summarize(results);
}
```

**Lease is 5 minutes**, not 2. Rationale: `maxDuration=300s` on the route plus correction-retry on schema mismatch plus transient-backoff retries (1s/4s/16s) can realistically push a single row past 2 minutes. 5 minutes comfortably exceeds any plausible single-row wall-clock time; the fencing token below catches the pathological case where we're wrong.

### Per-email scrub

```ts
async function scrubOne(claim): Promise<ScrubResult> {
  try {
    const comm = await prisma.communication.findUnique({
      where: { id: claim.communication_id },
      include: { contact: true, deal: true },
    });
    if (!comm) throw TerminalError("communication vanished");

    const heuristicMatches = await runHeuristicLinker(comm);
    const globalMemory = await loadGlobalMemoryBlock();       // cached in-process per batch
    const threadContext = await loadRecentThread(comm);
    const scopedMemory  = await loadScopedMemory(heuristicMatches);

    const anthropicResponse = await claude.scrub({
      systemBlocks: [SYSTEM_PROMPT, globalMemory],           // cache_control on both
      userPrompt:   renderPerEmailPrompt(comm, heuristicMatches, scopedMemory, threadContext),
      tool:         SCRUB_TOOL,
    });

    // ── FIX 2 LOCUS: record usage immediately, BEFORE validation or DB commit
    //     so failed downstream work still counts against budget
    await recordApiCall({
      scrubQueueId:    claim.id,
      communicationId: comm.id,
      promptVersion:   PROMPT_VERSION,
      modelUsed:       anthropicResponse.model,
      usage:           anthropicResponse.usage,
      outcome:         "pending-validation",     // updated after validation/commit
    });

    const validated = validateScrubOutput(anthropicResponse); // Zod + per-action payload check
    const committed = await applyScrubResult(
      comm.id,
      claim.id,
      claim.leaseToken,                           // ← fencing token carried through
      validated,
    );
    if (!committed) {
      // Another worker re-claimed this row mid-scrub. Our work is discarded
      // but the API call was still paid for and already logged above.
      await updateApiCallOutcome(claim.id, "fenced-out");
      return { ok: false, comm: comm.id, reason: "fenced-out" };
    }

    await updateApiCallOutcome(claim.id, "scrubbed");
    return { ok: true, comm: comm.id, ...validated.stats };

  } catch (err) {
    if (isValidationError(err)) await updateApiCallOutcome(claim.id, "validation-failed");
    if (isDbCommitError(err))    await updateApiCallOutcome(claim.id, "db-commit-failed");
    await handleFailure(claim, err);             // retry/terminal decision; also fencing-aware
    return { ok: false, comm: claim.communication_id, err };
  }
}
```

### Claim fencing on commit

`applyScrubResult(commId, queueRowId, leaseToken, validated)` does a single `prisma.$transaction` with a **conditional update gated on `leaseToken`**. If the row's token has changed (another worker re-claimed after our lease expired), the conditional affects zero rows and we roll back:

```ts
async function applyScrubResult(commId, queueRowId, leaseToken, validated): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // Conditional claim-still-ours check — gates the whole transaction.
    const stillOurs = await tx.scrubQueue.updateMany({
      where: { id: queueRowId, leaseToken, status: "in_flight" },
      data:  { status: "done", lockedUntil: null, lastError: null,
               promptVersion: PROMPT_VERSION, leaseToken: null },
    });
    if (stillOurs.count === 0) {
      // Lease lost. Throw to roll the txn; caller treats as "fenced-out".
      throw new FencedOutError();
    }

    await tx.communication.update({
      where: { id: commId },
      data:  { metadata: { ...existingMetadata, scrub: validated.scrubOutput } },
    });
    for (const action of validated.suggestedActions) {
      await tx.agentAction.create({
        data: {
          actionType:   action.actionType,
          tier:         "approve",
          status:       "pending",
          summary:      action.summary,
          targetEntity: `communication:${commId}`,
          payload:      action.payload,
        },
      });
    }
    return true;
  }).catch((err) => {
    if (err instanceof FencedOutError) return false;
    throw err;
  });
}
```

Two independent safeguards prevent duplicate AgentActions under lease expiry:
1. **Lease bumped to 5 min** (vs original 2 min) — eliminates the realistic-timing race entirely for all non-pathological executions
2. **Fencing token** — catches the residual case. Even if the lease expires and worker B re-claims and succeeds before worker A's transaction commits, worker A's `updateMany` finds zero matching rows (token was rotated) and rolls back. Only one worker ever writes AgentActions for a given queue row.

If the commit transaction fails for reasons other than fencing (DB blip, constraint violation), the queue row remains `in_flight` with the current `leaseToken` until its 5-min lease expires, then gets reclaimed with a fresh token. `attempts` was already incremented at claim time.

### Triggers

| Trigger | How | Cadence |
|---|---|---|
| Ingester inline-enqueue | `prisma.scrubQueue.create` inside `syncEmails()` transaction | Real-time per Communication row |
| Cron worker | Vercel cron → `POST /api/integrations/scrub/run` | Every 5 min (prod) |
| Manual dev | `POST /api/integrations/scrub/run` with admin token | Ad-hoc |
| Backfill | `POST /api/integrations/scrub/backfill` (dev-gated) | One-shot |

### Batch sizing

- **Batch size:** 20 Communications per invocation
- **Concurrency within batch:** 4 in-flight Anthropic calls at a time
- **Per-call budget:** ~2s with Haiku + caching, so a batch completes in ~10s
- **`maxDuration`:** 300s on the `/run` route
- **Cron every 5 min → 20×12 = 240/hr capacity.** Steady-state inflow is ~210/day, so ~17× headroom at default cadence.

### Historical backfill

`POST /api/integrations/scrub/backfill` enqueues every Communication where:

```
metadata->>'classification' IN ('signal','uncertain')
AND metadata->'scrub' IS NULL
AND NOT EXISTS (SELECT 1 FROM scrub_queue sq WHERE sq.communication_id = c.id)
```

At Matt's ~20K historical rows and default 5-min cron, drains in ~83 hours. For one-shot speed, temporarily run cron every 1 min (drains in ~7 hours) — no code change needed.

**Backfill runs on the dev API key** (Zach's Anthropic account) — the `ALLOW_BACKFILL=true` gate plus `NODE_ENV=development` keep this route disabled in Matt's prod deployment.

---

## Prompt strategy

### Model

**Haiku 4.5 single-tier in v1.** Structured extraction + controlled-vocab classification is Haiku's wheelhouse. Tiering (Haiku-then-Sonnet fallback) is deferred to a follow-up spec if quality demands it.

### Caching structure

Per `claude-api` skill guidance. Two cache breakpoints, both `cache_control: { type: "ephemeral" }`:

```ts
messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 2000,
  tools: [SCRUB_TOOL],
  tool_choice: { type: "tool", name: "record_email_scrub" },

  system: [
    { type: "text", text: SYSTEM_PROMPT,       cache_control: { type: "ephemeral" } }, // breakpoint 1
    { type: "text", text: GLOBAL_MEMORY_BLOCK, cache_control: { type: "ephemeral" } }, // breakpoint 2
  ],

  messages: [
    { role: "user", content: PER_EMAIL_PROMPT },                                        // variable tail
  ],
})
```

**Breakpoint 1 — `SYSTEM_PROMPT`.** Stable per `promptVersion`. Contains:
- Matt's role (CRE broker, NAI Business Properties, market + deal mix)
- What a "good" scrub looks like; **extensive worked examples** across edge cases (new lead, stage move, meeting reschedule, DocuSign transactional, frustrated client, ambiguous scope)
- Output schema narrative (each field, when to return null sentiment, etc.)
- Controlled topic-tag vocabulary with one-line descriptions and positive/negative exemplars per tag
- Guardrails: "never invent Contact/Deal IDs"; "transactional emails get empty suggestedActions and null sentiment"; "propose `move-deal-stage` only when the email explicitly indicates the new stage (signed LOI → under_contract, contract fully executed → closed, etc.)"; "dueHint parsing is Matt's to correct — don't fabricate specific dates that aren't in the email"
- **Intentionally padded to comfortably exceed Anthropic's per-model minimum-cacheable-prompt threshold** — see the caching-threshold constraint below

**Breakpoint 2 — `GLOBAL_MEMORY_BLOCK`.** Stable per worker batch (5-min cache window covers a typical batch duration). Contains all `AgentMemory` rows with `contactId IS NULL AND dealId IS NULL` — Matt's global rules, playbooks, style guides — rendered as markdown with `## {title}` headers.

### Caching threshold — hard constraint, not a cost assumption

Anthropic imposes a **minimum cacheable prompt length** that varies by model (as of the time of writing, approximately 1024 tokens for Sonnet/Opus and ~2048 tokens for Haiku models; subject to change — **must be verified against the current Anthropic docs at implementation time**). Prompts shorter than this minimum silently do not cache — no error, just pay full-price every call.

To guarantee caching actually engages:

1. **`SYSTEM_PROMPT` is deliberately built to exceed 4,096 tokens.** We pad above the highest plausible threshold with genuinely useful content (worked examples, tag exemplars, guardrail rationale) rather than filler. Even if Anthropic raises the Haiku threshold to 4K, we still cache. A byproduct: more examples tend to improve output quality.
2. **`GLOBAL_MEMORY_BLOCK`** is *not* padded. If Matt has few global AgentMemories, this block may be small (even zero rows on day one). When the block is below the threshold, it is **emitted without its own `cache_control` breakpoint** — a dynamic decision in `claude.ts`. Letting it fall under the system-prompt cache is still worthwhile because the combined block at breakpoint 1 would exceed the threshold either way.
3. **Implementation must assert the caching is live** on its first real run. After the first batch's second row completes, the `cacheReadTokens` on that `ScrubApiCall` row MUST be > 0. If it is 0, the worker logs a loud `[scrub-warning] caching not engaging; check prompt length vs model minimum` and operations fix the prompt padding before running backfill.

**Cost guarantee — what we're actually committing to:**
- **With caching live** (the assertion above passes): per-email cost is ~$0.0024 as documented
- **With caching silently off**: per-email cost rises to ~$0.008–$0.010 (roughly 3–4× baseline). Backfill and steady-state still survive the $5/day cap at Matt's volume (~$2/day worst case for 210 emails), but headroom shrinks. This is a degraded-mode tolerance, not a target.

**Variable tail — `PER_EMAIL_PROMPT`.** Per-email, not cached. Contains:
- Email: `from`, `to`, `cc`, `subject`, `receivedDate`, `body` (truncated to ~4K chars if longer), `metadata.source`, `metadata.extracted` if present
- Heuristic-match candidates (up to 5 Contacts, 5 Deals — `id`, `name`/`propertyAddress`, `keyContacts`)
- Scoped `AgentMemory` rows for candidate Contacts/Deals
- Recent thread: last 3 Communications sharing `conversationId`, as `{from, date, snippet}` lines

### Pre-scrub heuristic linker

Before the API call, deterministic Node logic picks candidate links:
- **Contact candidates:** sender email match, sender-name token overlap, mentioned-name tokens in body
- **Deal candidates:** propertyAddress substring match, property-name match (via `Deal.tags` and name-form metadata if present), `keyContacts` name match against sender/mentioned names, subject-line substring match
- Up to 5 of each, ranked by match strength

The model **confirms** these candidates (writes `linkedContactCandidates` / `linkedDealCandidates` with confidence). The model **does not look up new IDs** — it picks from the candidates provided. Prevents ID hallucination.

### Tool schema (forced structured output)

```ts
const SCRUB_TOOL = {
  name: "record_email_scrub",
  description: "Record the scrub output for this email.",
  input_schema: {
    type: "object",
    required: ["summary","topicTags","urgency","replyRequired","sentiment",
               "linkedContactCandidates","linkedDealCandidates","suggestedActions"],
    properties: {
      summary:       { type: "string", maxLength: 400 },
      topicTags:     { type: "array", items: { enum: [/* 15 tags */] }, maxItems: 4 },
      urgency:       { enum: ["urgent","soon","normal","fyi"] },
      replyRequired: { type: "boolean" },
      sentiment:     { enum: ["positive","neutral","negative","frustrated", null] },
      linkedContactCandidates: {
        type: "array",
        items: { type: "object", required: ["contactId","confidence","reason"],
                 properties: {
                   contactId:  { type: "string" },
                   confidence: { type: "number", minimum: 0, maximum: 1 },
                   reason:     { type: "string" },
                 }}
      },
      linkedDealCandidates: {
        type: "array",
        items: { type: "object", required: ["dealId","confidence","reason","matchedVia"],
                 properties: {
                   dealId:     { type: "string" },
                   confidence: { type: "number", minimum: 0, maximum: 1 },
                   reason:     { type: "string" },
                   matchedVia: { enum: ["property_address","property_name","key_contact","subject_match"] },
                 }}
      },
      suggestedActions: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          required: ["actionType","summary","payload"],
          properties: {
            actionType: { enum: ["create-todo","move-deal-stage","update-deal",
                                 "create-meeting","update-meeting","create-agent-memory"] },
            summary:    { type: "string", maxLength: 200 },
            payload:    { type: "object" }
          }
        }
      }
    }
  }
}
```

`tool_choice: { type: "tool", name: "record_email_scrub" }` forces the model to invoke this tool (no free-text response). Validation layers on top:

1. Anthropic-side schema rejection (first line of defense)
2. Zod parse of the top-level `ScrubOutput` on arrival
3. Per-`actionType` Zod validation of each `payload` (see Failure section for partial-success semantics)

### Prompt versioning

- `PROMPT_VERSION` is a string constant in `src/lib/ai/scrub-prompt.ts`
- Bumped manually whenever `SYSTEM_PROMPT` or `SCRUB_TOOL` schema changes materially
- **Operational step on bump:**
  1. `UPDATE scrub_queue SET status='pending', attempts=0, locked_until=NULL, lease_token=NULL, last_error=NULL WHERE prompt_version IS NOT NULL AND prompt_version <> '<new>'`
  2. Worker picks up re-opened rows on next invocation (manual `POST /run` in dev, natural cron cadence in prod)
  3. If there are unscrubbed Communications that were never queued (e.g., newly migrated in), run `POST /api/integrations/scrub/backfill` to enqueue those — the backfill query skips rows that already have a `scrub_queue` entry, so the two operations compose cleanly
- `metadata.scrub` is overwritten on re-scrub (`metadata || {scrub: ...}` replaces the top-level `scrub` key in Postgres JSONB concat). Old `AgentAction` rows from prior versions are **not** deleted — Matt may have acted on them; history is preserved.

---

## Cost envelope

### Per-email baseline (Haiku 4.5, caching on)

| Component | Tokens | $/M | Subtotal |
|---|---:|---:|---:|
| Uncached input (variable tail) | 500 | $1.00 | $0.00050 |
| Cached input read | 3,500 | $0.10 | $0.00035 |
| Cache write (amortized ~50/window) | 3,500 / 50 | $1.25 | $0.00009 |
| Output (structured tool call) | 300 | $5.00 | $0.00150 |
| **Total per email** | | | **~$0.0024** |

Exact prices are read at implementation time — numbers above are order-of-magnitude Haiku-4.5.

### Steady-state daily (Matt's volume)

| Line | Volume | Daily cost |
|---|---:|---:|
| Signal emails | ~60/day | $0.14 |
| Uncertain emails | ~150/day | $0.36 |
| Retries (~5%) | — | $0.03 |
| **Total** | **~210/day** | **~$0.53/day** |

**Monthly steady-state:** ~$16. Budget **$25/month** with headroom.

### One-time historical backfill

20K existing signal+uncertain rows × $0.0024 = **~$48**. Runs on Zach's dev API key (backfill route is dev-gated). Matt's production account never sees this.

### Cost guardrails

- **`SCRUB_DAILY_BUDGET_USD`** env var, default `$5` (10× steady-state). The budget tracker short-circuits the worker when rolling 24h spend exceeds the cap; queue drains on the next window.
- **Prompt-version bumps** that trigger re-scrub-all are the main runaway lever. Document every bump.
- **Moving to Sonnet** would be ~4–5× per email — not in v1.

### Budget math reads from `ScrubApiCall`, not `metadata.scrub`

**This is the authoritative accounting surface.** Every Anthropic API call that returns a usage object writes one `ScrubApiCall` row *before* any downstream validation or DB commit. That means:

- A successful call followed by a failed validation → call is counted
- A successful call followed by a failed DB commit → call is counted
- A successful call followed by a lease-expired / fenced-out write → call is counted (with `outcome = "fenced-out"`)
- A tool-schema-mismatch correction retry → both calls are counted
- Only a transport-layer failure before any usage is reported → not counted (correctly — we weren't billed)

`budgetTracker.assertWithinCap()` queries `SELECT SUM(estimated_usd) FROM scrub_api_calls WHERE at > NOW() - interval '24 hours'` and compares against `SCRUB_DAILY_BUDGET_USD`. There is no reliance on `Communication.metadata.scrub` for budget decisions — that field only exists on successfully-committed rows and would under-count exactly the failure paths we need to see.

### Cost monitoring

`GET /api/integrations/scrub/stats` returns rolling aggregates, computed from `ScrubApiCall` (authoritative for spend) + `scrub_queue` (authoritative for queue health):

```json
{
  "queue":       { "pending": 12, "in_flight": 0, "done": 19834, "failed": 3 },
  "last24h":     { "apiCalls": 210, "scrubbedOk": 204, "validationFailed": 1,
                   "dbCommitFailed": 0, "fencedOut": 0, "retryCorrection": 2, "droppedActions": 2,
                   "tokensIn": 845000, "tokensOut": 62000, "cacheReadTokens": 720000,
                   "cacheHitRate": 0.85, "costUSD": 0.51 },
  "last7d":      { "apiCalls": 1462, "costUSD": 3.46 },
  "last30d":     { "apiCalls": 6277, "costUSD": 14.89 },
  "promptVersion": "v1"
}
```

Note `apiCalls >= scrubbedOk` — the gap is the visible cost-of-failures. This is the gap that goes uncounted if you budget off `metadata.scrub` alone.

Admin-token gated (`SCRUB_ADMIN_TOKEN`). Aggregates computed on-demand; no materialized rollup table in v1. Add `scrub_stats_daily` in a follow-up if the queries become expensive.

---

## Failure, retry, and observability

### Error taxonomy

| Error class | Example | Retriable? | Policy |
|---|---|---|---|
| Anthropic `529 overloaded` | Server overload | Yes | Honor `retry-after`, exponential backoff. Separate counter from `attempts` |
| Anthropic `429 rate_limit` | RPM/TPM ceiling | Yes | Honor `retry-after`. Separate counter |
| Anthropic `500/502/503/504` | Transient | Yes | 1s / 4s / 16s backoff; counts toward `attempts` |
| Anthropic `400 invalid_request` | Prompt-too-long, bad tool schema | No | Terminal; `lastError` records full error. Indicates a bug |
| Anthropic `401 authentication_error` | Bad / missing API key | No | Terminal + **circuit trip** (5 min) |
| Anthropic `403 permission_error` | Key lacks model access | No | Terminal + circuit trip |
| Tool-output shape mismatch | Model emitted wrong JSON | Yes (1 retry) | Immediate retry with a correction user-turn; if second attempt still invalid → terminal for this row |
| Zod per-`actionType` payload failure | `move-deal-stage` missing `dealId` | Depends on mode (see below) | Relaxed: drop that one action, commit the rest. Strict: fail whole row. |
| Prisma transaction failure | DB blip, constraint violation | Yes | 1 retry after 200ms; terminal on second failure |
| Daily budget cap hit | Rolling 24h > `SCRUB_DAILY_BUDGET_USD` | No for this window | Worker early-returns; queue drains next window |
| Communication deleted mid-flight | Cascade already removed the queue row | — | ON DELETE CASCADE handles it |

### `attempts` counter

Incremented on every claim. At `attempts >= 3` with a terminal or persistent failure, `status = failed`. Manual requeue via `POST /api/integrations/scrub/requeue`.

Overload / rate-limit retries use a **separate in-call counter**, not `attempts` — Anthropic-side throttling shouldn't eat the retry budget meant for actual bugs.

### Circuit breaker (auth errors)

On `401`/`403` from Anthropic, write a row to `SystemState` (new table, defined in Schema changes) with key `'scrub-circuit-auth'` and value `{ trippedAt: <ISO>, until: <trippedAt + 5 min>, reason: "<error>" }`. `authCircuit.assertClosed()` at the top of `scrubEmailBatch()` reads this row and early-returns with `status: "circuit-open"` if `until > NOW()`. First call after the window clears the row and retries one API call; if auth is still bad, the circuit re-trips. Prevents burning the whole queue on guaranteed-failing auth. Surviving across serverless invocations is the reason it's in Postgres rather than module-level memory.

### `SCRUB_STRICT_MODE` env flag

Env var `SCRUB_STRICT_MODE`:

- **`true`** (dev default) — used during training:
  - Per-action Zod failure → mark whole row `failed`, full payload logged to `lastError`. No partial commit.
  - Tool-output outer-shape mismatch → same treatment.
  - **Batch-level circuit:** if 5 consecutive rows in a batch hit validation/parse errors, halt the batch with `lastError: "strict-mode circuit: 5 consecutive validation failures"`. Prevents runaway spend while the prompt is broken.

- **`false`** (prod default) — used after training:
  - Per-action Zod failure → drop that action only, commit scrub + other actions. `lastError` logs dropped actions.
  - Outer-shape mismatch still retries once then fails the row.
  - No consecutive-error circuit (budget cap still applies).

Anthropic transient errors and auth circuit trip the same in both modes.

### Observability

| Signal | Location | Always-on? |
|---|---|---|
| Per-row `lastError` (≤2KB truncated) | `ScrubQueue.lastError` | Yes |
| Full rejected-payload dump | `ScrubQueue.lastError` + stdout | Strict mode only |
| Post-batch digest line | stdout → Vercel logs | Yes |
| Structured log per scrub completion | stdout → Vercel logs | Yes |
| Stats endpoint | `GET /api/integrations/scrub/stats` | Yes |
| Circuit-halted batch log | stdout | Yes |

Post-batch digest example:

```
[scrub-batch] processed=20 succeeded=18 failed=1 droppedActions=1
              tokensIn=8540 tokensOut=3900 costUSD=0.048 cacheHitRate=0.89
              durationMs=14320 mode=relaxed
              topErrors=["move-deal-stage missing dealId"]
```

**Operational workflow:** run a batch → watch digest log → if `failed > 0` or `droppedActions > 0`, hit `/stats` or `SELECT ... FROM scrub_queue WHERE status='failed' ORDER BY updated_at DESC LIMIT 20` → fix prompt → bump `promptVersion` → requeue.

### What's NOT handled in v1

- No Sentry / external APM (Vercel logs + stats endpoint suffice at current scale)
- No pager/alerting (manual inspection via stats)
- No auto-rescrub on Communication update (bodies don't change; manual requeue if needed)

---

## Approval UX boundary

This spec does **not** build user-facing screens. Each consumer surface lives in a sibling spec:

| Surface | Sibling spec | Reads |
|---|---|---|
| Agent Control Center queue | retire-the-vault / UI→Prisma migration | `AgentAction WHERE status='pending'` |
| Per-email "AI hook" on Leads / Clients detail | Leads/Deals kanban | `Communication.metadata.scrub` |
| Deal-card pending-proposal badge | Leads/Deals kanban | `AgentAction WHERE actionType='move-deal-stage' AND payload.dealId=X AND status='pending'` |
| Dashboard widgets (pending count, urgent count) | Dashboard hub | Aggregates of AgentAction + Communication.metadata.scrub |

Approval semantics are specified in the **Contracts** section above and are the sibling-spec contract, not built here.

**Explicitly punted from v1 UI behaviour** (flagged so sibling specs don't reinvent):
- No "regenerate scrub" button — rejecting actions is the recourse
- No bulk approve — individual review while calibrating
- No inline-edit of a Todo's title before approval — approve-as-written, edit after
- No in-queue preview of source email — click-through to Communication row
- No scrub display in `/apps/email` — it's a secondary view; scrub lives on CRM-centric detail pages

---

## File layout

```
full-kit/
├── prisma/
│   └── migrations/
│       └── <ts>_add_scrub_queue/
│           └── migration.sql
├── src/
│   ├── lib/
│   │   ├── ai/                           # NEW subtree — Anthropic SDK boundary
│   │   │   ├── claude.ts                 # SDK wrapper: client, env, retry, circuit
│   │   │   ├── claude.test.ts
│   │   │   ├── scrub.ts                  # scrubEmailBatch() + scrubOne()
│   │   │   ├── scrub.test.ts
│   │   │   ├── scrub-prompt.ts           # SYSTEM_PROMPT, SCRUB_TOOL, PROMPT_VERSION
│   │   │   ├── scrub-prompt.test.ts      # regression snapshots
│   │   │   ├── scrub-linker.ts           # pre-scrub heuristic Contact/Deal match
│   │   │   ├── scrub-linker.test.ts
│   │   │   ├── scrub-validator.ts        # Zod per actionType payload
│   │   │   ├── scrub-validator.test.ts
│   │   │   ├── scrub-applier.ts          # transactional commit with fencing
│   │   │   ├── scrub-applier.test.ts
│   │   │   ├── scrub-queue.ts            # enqueue, claim (lease-token), reclaim, requeue
│   │   │   ├── scrub-queue.test.ts
│   │   │   ├── scrub-api-log.ts          # NEW — writes ScrubApiCall rows; authoritative spend
│   │   │   ├── scrub-api-log.test.ts
│   │   │   ├── scrub-types.ts            # ScrubOutput, per-action payload types
│   │   │   ├── budget-tracker.ts         # reads ScrubApiCall SUM; cap check
│   │   │   ├── budget-tracker.test.ts
│   │   │   ├── auth-circuit.ts           # NEW — SystemState-backed breaker
│   │   │   ├── auth-circuit.test.ts
│   │   │   └── index.ts                  # barrel
│   │   └── msgraph/
│   │       └── emails.ts                 # MODIFY — enqueue into scrub_queue per Communication
│   └── app/
│       └── api/
│           └── integrations/
│               └── scrub/
│                   ├── run/route.ts      # POST — worker trigger
│                   ├── backfill/route.ts # POST — dev-gated one-shot enqueue
│                   ├── requeue/route.ts  # POST — requeue failed rows
│                   └── stats/route.ts    # GET  — aggregates
```

**Boundary rule:** nothing outside `src/lib/ai/` imports `@anthropic-ai/sdk`. Same pattern as `src/lib/msgraph/` for Microsoft Graph.

**Size guardrails:**
- `scrub.ts` ≤250 lines; split into `scrub-batch.ts` / `scrub-one.ts` if larger
- `scrub-prompt.ts` may exceed guidelines (prompt text); keep non-prompt logic out of it

**Dependency addition:** `@anthropic-ai/sdk` to `full-kit/package.json`. Pin to a current minor.

---

## Deployment & API-key separation

`ANTHROPIC_API_KEY` is env-scoped per deployment:

- **Dev env (Zach's account):** pays for backfill (~$48 one-shot), prompt-bump re-scrub, training iterations
- **Prod env (Matt's go-live):** pays only for ~$16–25/month steady-state; never sees backfill

`POST /api/integrations/scrub/backfill` is gated by BOTH `x-admin-token` AND (`NODE_ENV=="development"` OR `ALLOW_BACKFILL=="true"`). In prod, calling it returns 404 by default — prevents an accidental replay from hitting Matt's account.

---

## Testing plan

### Unit (vitest)

| Module | Coverage |
|---|---|
| `claude.ts` | env-var resolution, retry honors `retry-after`, circuit trip on 401/403, circuit reset after 5 min |
| `scrub-prompt.ts` | `PROMPT_VERSION` string is exported; controlled-vocab tag list is exported; regression snapshot of SYSTEM_PROMPT (fails-on-change to force conscious bumps) |
| `scrub-linker.ts` | Contact match by email exact / name token / phone; Deal match by propertyAddress substring / property-name / key-contact; confidence ranking; max-5 cap; empty-case safety |
| `scrub-validator.ts` | Each of 6 actionType payload Zods: positive + ≥2 negative cases; top-level ScrubOutput shape; null-sentiment allowed; >5 actions rejected |
| `scrub-applier.ts` | Relaxed partial-success: bad action dropped + scrub committed + good actions written; strict mode: any bad action → no commit; rollback on DB error; `agentActionId` back-link set on created entities (including `AgentMemory` for `create-agent-memory`); **fencing: when `leaseToken` no longer matches, conditional-update affects 0 rows and transaction rolls back (no AgentAction duplication)** |
| `scrub-queue.ts` | Enqueue idempotency (unique constraint); `FOR UPDATE SKIP LOCKED` claim semantics (two workers don't double-claim); **lease-token rotation on each claim**; lease-expiry reclaim; 3-attempt terminal transition; cascade-on-Communication-delete; in-place requeue via UPDATE (not DELETE) |
| `scrub-api-log.ts` | Every API call writes a `ScrubApiCall` row before validation/commit; outcome updated correctly across scrubbed / validation-failed / db-commit-failed / fenced-out paths; spend is counted on failure paths |
| `budget-tracker.ts` | Rolling 24h accumulation reads from `ScrubApiCall.estimatedUsd` (authoritative); cap-hit short-circuits worker; window-reset allows recovery; **failed-downstream calls ARE counted** (regression test for the gap reviewer caught) |
| `auth-circuit.ts` | Trip persists to `SystemState` across process boundaries; `assertClosed()` returns fast when tripped within window; clears after 5 min; re-trips on repeated 401/403 |
| `scrub.ts` orchestrator | E2E batch with mocked Anthropic: mixed success/failure/retry; strict-mode circuit at 5 consecutive errors; digest log emitted with correct aggregates; partial-success in relaxed mode; cursor-of-claimed rows advances correctly; **caching-not-engaging warning fires when `cacheReadTokens === 0` on row 2+ of first batch** |
| Ingester hook (`emails.ts`) | `syncEmails()` enqueues one `scrub_queue` row per new signal/uncertain Communication, inside the same transaction; rollback on enqueue failure |

### Integration (manual, live Anthropic + DB)

1. **Happy path.** Pick 10 real signal emails from Matt's ingested inbox. `POST /api/integrations/scrub/run`. Verify:
   - All 10 rows get `metadata.scrub` populated with non-null `summary`
   - `cacheHitTokens > 0` on rows 2+ (caching is actually firing)
   - At least 3 rows emit `AgentAction`s with `tier=approve, status=pending`
   - `GET /stats` reflects the batch within 2s of completion
2. **Malformed fixture.** A Communication with empty body. Strict-mode run: row marked `failed`, `lastError` has legible message. Relaxed-mode run: row still scrubs (empty summary acceptable).
3. **Auth circuit.** Set `ANTHROPIC_API_KEY` to `sk-invalid-xxx`. First batch call: returns fast, circuit flag set. Subsequent call within 5 min: returns fast without API call. After 5 min: retries once, re-trips.
4. **Prompt-version bump.** Edit `PROMPT_VERSION` from `"v1"` to `"v2"`. Operational steps (matching the in-place requeue documented under "Prompt versioning"): `UPDATE scrub_queue SET status='pending', attempts=0, locked_until=NULL, lease_token=NULL, last_error=NULL WHERE prompt_version IS NOT NULL AND prompt_version <> 'v2'`. Then trigger the worker. Verify rows with prior `prompt_version` return to `pending`, drain on the next batch, and `metadata.scrub.promptVersion = "v2"` on re-scrubbed rows. Verify a fresh `ScrubApiCall` row was logged for each re-scrub (so spend is counted for the replay).
5. **Backfill dry-count.** Before `POST /backfill`, run:
   ```sql
   SELECT COUNT(*) FROM communications
    WHERE metadata->>'classification' IN ('signal','uncertain')
      AND metadata->'scrub' IS NULL;
   ```
   After `POST /backfill`, confirm `scrub_queue` row count matches.
6. **Concurrency.** Call `POST /api/integrations/scrub/run` twice in parallel from two curl invocations. Verify via logs that each claims a disjoint set of rows (no double-processing).
7. **Budget cap.** Set `SCRUB_DAILY_BUDGET_USD=0.01`. Worker early-returns on next batch with `{ status: "budget-cap-hit" }`; `/stats` confirms no new scrubs.
8. **Fencing race.** Force a lease-expiry race: in a test env, manually `UPDATE scrub_queue SET locked_until = NOW() - interval '1 minute', lease_token = 'forced-other' WHERE id = <one-in-flight-row>` while the original worker is mid-API-call. Verify the original worker's commit transaction rolls back with `outcome='fenced-out'` on the `ScrubApiCall` row, no `AgentAction`s are written by the original worker, and the row gets processed exactly once (by whichever worker wins).
9. **Caching live.** After the first batch completes in a new environment, query `SELECT cache_read_tokens FROM scrub_api_calls ORDER BY at DESC LIMIT 5`. At least 3 of the 5 most recent must have `cache_read_tokens > 0`. If none do, caching is silently off — block on fixing prompt padding before running backfill.
10. **Authoritative spend accounting.** Temporarily force `scrub-validator.ts` to throw on a specific row (test-only flag). Run a batch. Verify that row has a `ScrubApiCall` row with `outcome='validation-failed'` and `estimated_usd > 0`. Verify `/stats` last24h `costUSD` reflects it.

---

## Error handling summary

| Condition | Where | Behavior |
|---|---|---|
| Missing `ANTHROPIC_API_KEY` | `claude.ts` | Throw at SDK init; `/run` returns 500, circuit does not trip (config error) |
| Another worker running | `scrub-queue.ts` claim | `FOR UPDATE SKIP LOCKED` skips claimed rows; no lock contention |
| Anthropic 401/403 | `claude.ts` | Circuit trip 5 min; row gets `status=failed` with auth error in `lastError` |
| Anthropic 429/529 | `claude.ts` | Retry with `retry-after`, separate counter; row retries within same invocation |
| Anthropic 500–504 | `claude.ts` | 1s/4s/16s backoff; if all attempts fail, increments `attempts` |
| Anthropic 400 | `claude.ts` | Terminal; `lastError` records error; indicates bug |
| Tool-output shape mismatch | `scrub-validator.ts` | 1 correction retry; if still bad, terminal |
| Per-action Zod fail (strict) | `scrub-applier.ts` | Whole row `failed`, full payload in `lastError` |
| Per-action Zod fail (relaxed) | `scrub-applier.ts` | Drop that action, commit others, log dropped |
| 5 consecutive validation fails in a batch (strict) | `scrub.ts` | Halt batch with circuit message; unclaimed rows remain pending |
| Communication deleted mid-flight | FK cascade | Queue row cascades; no orphan |
| Budget cap exceeded | `budget-tracker.ts` | `scrubEmailBatch` early-returns; queue drains next window |
| Prisma transaction failure | `scrub-applier.ts` | 1 retry after 200ms; terminal on second failure; row reclaimed via lease expiry |
| Lease expired mid-scrub | `scrub-queue.ts` | Next claim picks up the row with a fresh `leaseToken`; `attempts` already incremented |
| Lease expired + another worker claimed before commit | `scrub-applier.ts` fencing | Conditional update finds `leaseToken` rotated, affects 0 rows, transaction rolls back. `ScrubApiCall.outcome = "fenced-out"` (spend still counted). No AgentAction duplication. Winner's commit writes the row. |
| `ScrubApiCall` row fails to write | `scrub-api-log.ts` | Logged to stderr; does NOT block the scrub flow (we'd rather under-count spend than fail a scrub because of telemetry) |
| Caching not engaging (rows 2+ have `cache_read_tokens = 0`) | `scrub.ts` orchestrator | Loud warning log on every batch; operational step is prompt-padding fix. Backfill endpoint refuses to run while the warning is active (prevents the $48 backfill from costing 3–4× expected) |

---

## Open items / follow-ups

Ordered roughly by when they become valuable:

1. **Retire-the-vault / UI→Prisma migration** *(hard dep for user visibility)* — migrates Agent Control Center, Clients/Contacts/Leads detail, Comms detail, Urgent Todos card, Templates off `listNotes<*>("...")` and onto Prisma reads. Pre-req for Matt to see scrub output and approve proposals. Separate, focused spec.
2. **Agent Control Center executor expansion** — the queue currently knows how to execute `create-todo` only. Migration must add executors for the other 5 action types (`move-deal-stage`, `update-deal`, `create-meeting`, `update-meeting`, `create-agent-memory`). Called out in the retire-the-vault spec.
3. **Leads/Deals kanban spec (paused)** — once contracts from this spec land, kanban design can resume. Must surface pending-AgentAction badges on deal cards and render `metadata.scrub` in activity feeds.
4. **Dashboard hub spec (paused)** — same sequencing; surfaces pending-count, urgent/replyRequired counts from this spec's outputs.
5. **Tier promotion calibration** — once accuracy is characterized per action type, promote low-risk types (e.g., `create-agent-memory` for style notes) to `tier=auto` via config.
6. **Sonnet fallback lane** — if Haiku misses on nuanced CRE jargon or frustrated-client sentiment, add a `model: "sonnet"` second-pass lane, gated by scrub-output quality signals. Follow-up spec.
7. **Auto-reply / email drafting** — the scrub flags `replyRequired`; a dedicated draft-generator spec picks those up, selects templates from `Template` table, drafts a reply, proposes via a new `send-email-draft` action type. High-risk mutation — its own spec with its own safeguards.
8. **Scrub-aware search** — full-text search over `Communication.metadata.scrub.summary` + `topicTags` ("show me everything about the Overland deal") once Postgres FTS is wired up.
9. **Signature enrichment → AgentMemory** — the scrub can propose `create-agent-memory` for contact facts. A follow-up spec automates structured extraction from email signatures into Contact fields directly (phone, title, company).
10. **Batch-level alerting** — once failure rates are baselined, wire Vercel log alerts for batches where `failed > 10%`.
11. **Scrub stats rollup** — if `/stats` queries become expensive at scale, add a `scrub_stats_daily` rollup table.

---

## Assumptions

- `@anthropic-ai/sdk` is available as a dependency and compatible with the Next.js 15 runtime used by `full-kit`.
- Haiku 4.5 (or the then-current Haiku) pricing is in the ballpark of today's: ~$1/M input, ~$0.10/M cached, ~$5/M output. A 5× price increase would still keep steady-state under $100/month — not an architectural concern.
- Prompt caching remains a first-class SDK feature with 5-min ephemeral TTL. If Anthropic removes or reshapes it, the pipeline still works — costs rise ~3×.
- Matt's Communication inflow stays in the 100–500/day range. A 10× spike would warrant revisiting batch size and cron cadence, not architecture.
- Vercel function `maxDuration=300` on the `/run` route continues to be supported on the plan in use.
- The sibling retire-the-vault spec will land before Matt uses the feature in anger. The scrub engine can be validated on a dev deployment ahead of that without a UI.
- `AgentAction.actionType` stays a `String` (not an enum). Sibling specs extending the vocabulary add documented entries but do not require schema changes.
- `AgentMemory` continues to be the long-term-facts store and supports `contactId`/`dealId` scoping as currently modeled.
