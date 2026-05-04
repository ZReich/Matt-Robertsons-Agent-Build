import type { ClaudeScrubResponse } from "./claude"
import type { ClaimedScrubQueueRow, SuggestedAction } from "./scrub-types"

import { getAttachmentSummary } from "@/lib/communications/attachment-types"
import { db } from "@/lib/prisma"

import { processInBatches } from "@/lib/util/batch"

import { assertAuthCircuitClosed, tripAuthCircuit } from "./auth-circuit"
import { ScrubBudgetError, assertWithinScrubBudget } from "./budget-tracker"
import { ScrubClaudeAuthError } from "./claude"
import { ScrubOpenAIAuthError } from "./openai"
import { logScrubApiCall, updateScrubApiCallOutcome } from "./scrub-api-log"
import { ScrubFencedOutError, applyScrubResult } from "./scrub-applier"
import {
  hasThreadOutboundEvidence,
  loadGlobalMemoryBlock,
  loadOpenTodoCandidates,
  loadRecentThread,
  loadScopedMemory,
  runHeuristicLinker,
} from "./scrub-linker"
import { SCRUB_TOOL } from "./scrub-prompt"
import {
  isSensitiveRoutingEnabled,
  scrubWithConfiguredProvider,
  scrubWithSensitiveProvider,
} from "./scrub-provider"
import { containsSensitiveContent } from "./sensitive-filter"
import { claimScrubQueueRows, markScrubQueueFailed } from "./scrub-queue"
import { PROMPT_VERSION } from "./scrub-types"
import { ScrubValidationError, validateScrubToolInput } from "./scrub-validator"

export type BatchSummary = {
  status:
    | "ok"
    | "budget-cap-hit"
    | "circuit-open"
    | "caching-not-live"
    | "strict-consecutive-halt"
  processed: number
  succeeded: number
  failed: number
  droppedActions: number
  tokensIn: number
  tokensOut: number
  cacheReadTokens: number
  costUsdEstimate: number
  cachingLive: boolean
  mode: "strict" | "relaxed"
}

export type ScrubMode = "strict" | "relaxed"

/**
 * In strict mode, N consecutive validation failures in a single batch halt
 * the batch to prevent runaway spend on a broken prompt. Matches spec
 * "SCRUB_STRICT_MODE" section.
 */
const STRICT_CONSECUTIVE_HALT_THRESHOLD = 5

/**
 * Per-batch internal concurrency for scrubOne calls. The bottleneck is the
 * provider HTTP call (DeepSeek for the default path, occasionally Haiku for
 * sensitive). DeepSeek and Anthropic both happily handle bursts of 5
 * concurrent requests. Higher values risk hammering pgbouncer (each scrubOne
 * does ~5 reads + 1 write) without much marginal speedup since N=5 already
 * approaches the per-call latency floor.
 */
const SCRUB_BATCH_CONCURRENCY = 5

/**
 * After the first batch in a fresh environment, at least this many of the
 * most recent successful calls must have cache_read_tokens > 0 for caching
 * to be considered "live". If fewer do, a loud warning fires and the
 * backfill route refuses to run.
 */
export const CACHING_LIVE_THRESHOLD_CALLS = 2

export function readScrubMode(env: NodeJS.ProcessEnv = process.env): ScrubMode {
  return env.SCRUB_STRICT_MODE === "false" ? "relaxed" : "strict"
}

type ScrubClient = (input: {
  perEmailPrompt: string
  globalMemory: string
  correction?: string
}) => Promise<ClaudeScrubResponse>

export function buildScrubPromptPayload(comm: {
  id?: string
  subject: string | null
  body: string | null
  date: Date
  metadata: unknown
  contactId?: string | null
}) {
  const metadata =
    comm.metadata &&
    typeof comm.metadata === "object" &&
    !Array.isArray(comm.metadata)
      ? (comm.metadata as Record<string, unknown>)
      : {}
  const attachmentSummary = getAttachmentSummary(metadata, { limit: 10 })
  const attachmentFetch =
    metadata.attachmentFetch &&
    typeof metadata.attachmentFetch === "object" &&
    !Array.isArray(metadata.attachmentFetch)
      ? (metadata.attachmentFetch as Record<string, unknown>)
      : undefined

  return {
    id: comm.id,
    linkedContactId: comm.contactId,
    subject: comm.subject,
    receivedDate: comm.date.toISOString(),
    body: (comm.body ?? "").slice(0, 4000),
    metadata: {
      classification: metadata.classification,
      source: metadata.source,
      tier1Rule: metadata.tier1Rule,
      extracted: metadata.extracted,
      hasAttachments: metadata.hasAttachments,
      attachmentFetch: attachmentSummary.fetchStatus
        ? { status: attachmentSummary.fetchStatus }
        : attachmentFetch?.status
          ? { status: attachmentFetch.status }
          : undefined,
      attachments: attachmentSummary.items.map((item) => ({
        name: item.name,
        contentType: item.contentType,
      })),
    },
  }
}

function renderPerEmailPrompt({
  comm,
  matches,
  openTodos,
  scopedMemory,
  threadContext,
}: {
  comm: {
    id?: string
    subject: string | null
    body: string | null
    date: Date
    metadata: unknown
    contactId?: string | null
  }
  matches: Awaited<ReturnType<typeof runHeuristicLinker>>
  openTodos: Awaited<ReturnType<typeof loadOpenTodoCandidates>>
  scopedMemory: string
  threadContext: string
}): string {
  return JSON.stringify(
    {
      email: buildScrubPromptPayload(comm),
      candidates: matches,
      openTodos,
      scopedMemory,
      threadContext,
    },
    null,
    2
  )
}

/**
 * Build the {perEmailPrompt, globalMemory} pair the real scrub provider would
 * be called with for a single Communication, plus the JSON Schema for the
 * record_email_scrub tool. Pure read-only — does NOT claim the queue row, log
 * api calls, or write anything. Used by the offline validation harness
 * (scripts/scrub-export.mjs) so an operator-driven Claude Code session can
 * produce review JSONL at $0 API spend before committing to bulk API spend.
 *
 * Parity with scrubOne: this MUST stay aligned with the input-construction
 * block in scrubOne (load comm, runHeuristicLinker, the five Promise.all
 * loaders, renderPerEmailPrompt). If scrubOne starts injecting a new context
 * field, mirror it here too or the offline path will see a stale prompt.
 */
export async function buildPromptInputs(communicationId: string): Promise<{
  perEmailPrompt: string
  globalMemory: string
  scrubToolSchema: unknown
  promptVersion: string
}> {
  const comm = await db.communication.findUnique({
    where: { id: communicationId },
    select: {
      id: true,
      subject: true,
      body: true,
      date: true,
      metadata: true,
      conversationId: true,
      direction: true,
      contactId: true,
      dealId: true,
    },
  })
  if (!comm) {
    throw new Error(
      `buildPromptInputs: communication ${communicationId} not found`
    )
  }

  const matches = await runHeuristicLinker(comm)
  const [globalMemory, scopedMemory, threadContext, openTodos] =
    await Promise.all([
      loadGlobalMemoryBlock(),
      loadScopedMemory(matches),
      loadRecentThread(comm),
      loadOpenTodoCandidates(comm, matches),
    ])
  const perEmailPrompt = renderPerEmailPrompt({
    comm,
    matches,
    openTodos,
    scopedMemory,
    threadContext,
  })

  return {
    perEmailPrompt,
    globalMemory,
    scrubToolSchema: SCRUB_TOOL.input_schema,
    promptVersion: PROMPT_VERSION,
  }
}

type ScrubOneResult = {
  ok: boolean
  droppedActions: number
  tokensIn: number
  tokensOut: number
  cacheReadTokens: number
  /** True when this row's failure was a validation error (counts toward strict-mode consecutive halt) */
  validationFailure: boolean
}

export async function scrubOne(
  queueRow: ClaimedScrubQueueRow,
  scrubClient: ScrubClient = scrubWithConfiguredProvider,
  mode: ScrubMode = readScrubMode()
): Promise<ScrubOneResult> {
  const empty: ScrubOneResult = {
    ok: false,
    droppedActions: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheReadTokens: 0,
    validationFailure: false,
  }

  const comm = await db.communication.findUnique({
    where: { id: queueRow.communicationId },
    select: {
      id: true,
      subject: true,
      body: true,
      date: true,
      metadata: true,
      conversationId: true,
      direction: true,
      contactId: true,
      dealId: true,
    },
  })
  if (!comm) {
    await markScrubQueueFailed(queueRow.id, "communication vanished")
    return empty
  }

  const matches = await runHeuristicLinker(comm)
  const [
    globalMemory,
    scopedMemory,
    threadContext,
    openTodos,
    threadHasOutboundEvidence,
  ] = await Promise.all([
    loadGlobalMemoryBlock(),
    loadScopedMemory(matches),
    loadRecentThread(comm),
    loadOpenTodoCandidates(comm, matches),
    hasThreadOutboundEvidence(comm),
  ])
  const perEmailPrompt = renderPerEmailPrompt({
    comm,
    matches,
    openTodos,
    scopedMemory,
    threadContext,
  })

  // Per-email provider routing: if the email trips the broad sensitive-
  // content filter AND sensitive-routing is enabled, swap to Haiku for this
  // call only. The default scrubClient (DeepSeek-via-OpenAI) never sees
  // sensitive bodies. If sensitive-routing is OFF, the enqueue step would
  // have skipped this email — reaching here with a sensitive body means
  // the operator explicitly opted in.
  const sensitive = containsSensitiveContent(comm.subject, comm.body)
  const effectiveScrubClient =
    sensitive.tripped && isSensitiveRoutingEnabled()
      ? scrubWithSensitiveProvider
      : scrubClient

  // First attempt
  let response: ClaudeScrubResponse
  try {
    response = await effectiveScrubClient({ perEmailPrompt, globalMemory })
  } catch (err) {
    await markScrubQueueFailed(
      queueRow.id,
      err instanceof Error ? err.message : String(err)
    )
    // Re-throw auth errors so the batch loop can trip the circuit
    if (isScrubProviderAuthError(err)) throw err
    return empty
  }

  // Telemetry-first: log the API call BEFORE validation/commit so that
  // downstream failures still count against budget. Outcome updates to its
  // terminal state below.
  let apiCallId = await logScrubApiCall({
    queueRowId: queueRow.id,
    communicationId: comm.id,
    promptVersion: PROMPT_VERSION,
    modelUsed: response.modelUsed,
    usage: response.usage,
    outcome: "pending-validation",
    purpose: "scrub",
  })

  // Validation — one correction retry allowed on outer-shape mismatch.
  let validated
  try {
    validated = validateScrubToolInput(response.toolInput, { mode })
  } catch (err) {
    if (err instanceof ScrubValidationError && err.kind === "outer-shape") {
      // Ask the model to re-emit, with a correction note appended to user prompt.
      await updateScrubApiCallOutcome(apiCallId, "retry-correction")
      try {
        const retry = await scrubClient({
          perEmailPrompt,
          globalMemory,
          correction: `Your previous tool call did not match the schema: ${err.message}. Re-emit a single record_email_scrub tool call that passes schema validation.`,
        })
        response = retry
        apiCallId = await logScrubApiCall({
          queueRowId: queueRow.id,
          communicationId: comm.id,
          promptVersion: PROMPT_VERSION,
          modelUsed: retry.modelUsed,
          usage: retry.usage,
          outcome: "pending-validation",
          purpose: "scrub",
        })
        validated = validateScrubToolInput(retry.toolInput, { mode })
      } catch (retryErr) {
        await updateScrubApiCallOutcome(apiCallId, "validation-failed")
        await markScrubQueueFailed(
          queueRow.id,
          retryErr instanceof Error ? retryErr.message : String(retryErr)
        )
        if (isScrubProviderAuthError(retryErr)) throw retryErr
        return {
          ...empty,
          tokensIn: response.usage.tokensIn,
          tokensOut: response.usage.tokensOut,
          cacheReadTokens: response.usage.cacheReadTokens ?? 0,
          validationFailure: true,
        }
      }
    } else {
      // Per-action or other validation failure — terminal for this row in strict
      // mode; in relaxed mode validate() would have already returned the
      // partial result, so reaching here means strict mode rejected the row.
      await updateScrubApiCallOutcome(apiCallId, "validation-failed")
      await markScrubQueueFailed(
        queueRow.id,
        err instanceof Error ? err.message : String(err)
      )
      return {
        ...empty,
        tokensIn: response.usage.tokensIn,
        tokensOut: response.usage.tokensOut,
        cacheReadTokens: response.usage.cacheReadTokens ?? 0,
        validationFailure: true,
      }
    }
  }

  // Commit phase
  try {
    const suggestedActions = bindMarkTodoDoneActions(
      validated.suggestedActions,
      openTodos,
      {
        communicationId: comm.id,
        communicationDate: comm.date,
        direction: comm.direction,
        hasThreadOutboundEvidence: threadHasOutboundEvidence,
      }
    )
    await applyScrubResult({
      communicationId: comm.id,
      queueRowId: queueRow.id,
      leaseToken: queueRow.leaseToken,
      scrubOutput: {
        ...validated.scrubOutput,
        modelUsed: response.modelUsed,
        promptVersion: PROMPT_VERSION,
        scrubbedAt: new Date().toISOString(),
        tokensIn: response.usage.tokensIn,
        tokensOut: response.usage.tokensOut,
        cacheHitTokens: response.usage.cacheReadTokens ?? 0,
      },
      suggestedActions,
    })
    await updateScrubApiCallOutcome(apiCallId, "scrubbed")
    return {
      ok: true,
      droppedActions:
        validated.droppedActions +
        (validated.suggestedActions.length - suggestedActions.length),
      tokensIn: response.usage.tokensIn,
      tokensOut: response.usage.tokensOut,
      cacheReadTokens: response.usage.cacheReadTokens ?? 0,
      validationFailure: false,
    }
  } catch (err) {
    if (err instanceof ScrubFencedOutError) {
      // Another worker won the row. Spend already counted via the
      // pending-validation row above; just flip its outcome.
      await updateScrubApiCallOutcome(apiCallId, "fenced-out")
      return {
        ...empty,
        tokensIn: response.usage.tokensIn,
        tokensOut: response.usage.tokensOut,
        cacheReadTokens: response.usage.cacheReadTokens ?? 0,
      }
    }
    await updateScrubApiCallOutcome(apiCallId, "db-commit-failed")
    await markScrubQueueFailed(
      queueRow.id,
      err instanceof Error ? err.message : String(err)
    )
    return {
      ...empty,
      tokensIn: response.usage.tokensIn,
      tokensOut: response.usage.tokensOut,
      cacheReadTokens: response.usage.cacheReadTokens ?? 0,
    }
  }
}

export function bindMarkTodoDoneActions(
  suggestedActions: SuggestedAction[],
  openTodos: Awaited<ReturnType<typeof loadOpenTodoCandidates>>,
  source: {
    communicationId: string
    communicationDate: Date
    direction: string | null
    hasThreadOutboundEvidence: boolean
  }
): SuggestedAction[] {
  if (suggestedActions.length === 0) return suggestedActions
  const openTodoById = new Map(openTodos.map((todo) => [todo.id, todo]))
  const seenTodoIds = new Set<string>()
  return suggestedActions.flatMap((action) => {
    if (action.actionType !== "mark-todo-done") return [action]
    const todoId =
      typeof action.payload.todoId === "string" ? action.payload.todoId : ""
    // Defense-in-depth: prompt-injected todoIds with control characters,
    // colons, slashes, etc. must be rejected at the binder boundary, even
    // when no targetEntity is supplied. The applier enforces the same shape
    // via isSafeEntityId, but binders should not pass through unsafe ids.
    if (!isSafeBoundTodoId(todoId)) return []
    const targetEntity =
      typeof action.payload.targetEntity === "string"
        ? action.payload.targetEntity
        : null
    const todo = openTodoById.get(todoId)
    if (!todo) return []
    if (targetEntity && targetEntity !== `todo:${todo.id}`) return []
    if (seenTodoIds.has(todo.id)) return []
    if (source.direction !== "outbound" && !source.hasThreadOutboundEvidence) {
      return []
    }
    if (
      source.communicationDate.getTime() < new Date(todo.createdAt).getTime()
    ) {
      return []
    }
    seenTodoIds.add(todo.id)

    return [
      {
        ...action,
        payload: {
          ...action.payload,
          todoId: todo.id,
          todoTitle: todo.title,
          todoStatus: todo.status,
          todoUpdatedAt: todo.updatedAt,
          todoCreatedAt: todo.createdAt,
          contactId: todo.contactId,
          dealId: todo.dealId,
          communicationId: todo.communicationId,
          sourceCommunicationId: source.communicationId,
          targetEntity: `todo:${todo.id}`,
        },
      },
    ]
  })
}

// Mirror isSafeEntityId in scrub-applier.ts exactly so the binder doesn't
// admit ids the applier will later reject — dots are NOT permitted because
// uuid/cuid identifiers don't use them and accepting them only widens the
// prompt-injection surface.
const SAFE_BOUND_TODO_ID = /^[A-Za-z0-9_-]{1,128}$/

function isSafeBoundTodoId(value: string): boolean {
  return SAFE_BOUND_TODO_ID.test(value)
}

/**
 * Spec section: "Caching threshold". After the first batch in a fresh env,
 * we expect cache_read_tokens > 0 on row 2+. If none of the recent
 * successful calls show cache reads, caching is silently not engaging —
 * log a loud warning and surface via isCachingLive().
 */
export async function isCachingLive(): Promise<boolean> {
  const recent = await db.scrubApiCall.findMany({
    where: { outcome: "scrubbed" },
    orderBy: { at: "desc" },
    take: 5,
    select: { cacheReadTokens: true },
  })
  if (recent.length < CACHING_LIVE_THRESHOLD_CALLS) {
    // Not enough data yet — neither live nor proven-broken. Default optimistic.
    return true
  }
  const withCache = recent.filter((r) => r.cacheReadTokens > 0).length
  return withCache >= CACHING_LIVE_THRESHOLD_CALLS
}

export async function scrubEmailBatch({
  limit = 20,
  scrubClient = scrubWithConfiguredProvider,
  mode = readScrubMode(),
  communicationIds,
}: {
  limit?: number
  scrubClient?: ScrubClient
  mode?: ScrubMode
  /**
   * Optional scope: only claim queue rows for these communication ids. Used
   * by the per-contact "Process with AI" path so a synchronous batch doesn't
   * drain unrelated pending rows.
   */
  communicationIds?: string[]
} = {}): Promise<BatchSummary> {
  const zeroSummary = (status: BatchSummary["status"]): BatchSummary => ({
    status,
    processed: 0,
    succeeded: 0,
    failed: 0,
    droppedActions: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheReadTokens: 0,
    costUsdEstimate: 0,
    cachingLive: true,
    mode,
  })

  try {
    await assertAuthCircuitClosed()
    await assertWithinScrubBudget()
  } catch (err) {
    if (err instanceof ScrubBudgetError) return zeroSummary("budget-cap-hit")
    if (err instanceof Error && "code" in err)
      return zeroSummary("circuit-open")
    throw err
  }

  const rows = await claimScrubQueueRows({ limit, communicationIds })
  if (rows.length === 0) {
    const summary = zeroSummary("ok")
    logDigest(summary)
    return summary
  }

  let succeeded = 0
  let failed = 0
  let droppedActions = 0
  let tokensIn = 0
  let tokensOut = 0
  let cacheReadTokens = 0
  let consecutiveValidationFailures = 0
  let halted = false
  let authCircuitTripped = false

  // Process rows in bounded-concurrency slices. The strict-mode "5
  // consecutive validation failures halt" semantic is preserved at slice
  // granularity: we run a slice of up to N rows in parallel, fold their
  // results into counters in claim order, then decide whether to break out
  // before starting the next slice. This is slightly looser than the old
  // per-row break (a slice may overshoot the threshold by up to N-1 rows in
  // the worst case), but the speedup is worth it and the threshold is a
  // safety valve, not a precise budget.
  for (let i = 0; i < rows.length && !halted && !authCircuitTripped; i += SCRUB_BATCH_CONCURRENCY) {
    const slice = rows.slice(i, i + SCRUB_BATCH_CONCURRENCY)
    const settled = await processInBatches(slice, SCRUB_BATCH_CONCURRENCY, (row) =>
      scrubOne(row, scrubClient, mode)
    )

    for (let j = 0; j < settled.length; j += 1) {
      const outcome = settled[j]!
      if (outcome.status === "fulfilled") {
        const result = outcome.value
        tokensIn += result.tokensIn
        tokensOut += result.tokensOut
        cacheReadTokens += result.cacheReadTokens
        droppedActions += result.droppedActions
        if (result.ok) {
          succeeded += 1
          consecutiveValidationFailures = 0
        } else {
          failed += 1
          if (result.validationFailure) {
            consecutiveValidationFailures += 1
            if (
              mode === "strict" &&
              consecutiveValidationFailures >=
                STRICT_CONSECUTIVE_HALT_THRESHOLD
            ) {
              halted = true
              // Don't break out of the inner loop — fold the rest of this
              // slice's already-completed results into counters first so
              // spend is fully attributed; then the outer-loop guard halts
              // the next slice from starting.
            }
          } else {
            consecutiveValidationFailures = 0
          }
        }
      } else {
        // Rejected: scrubOne itself threw. Auth errors trip the circuit and
        // halt the whole batch; all others count as a non-validation failure.
        const err = outcome.reason
        failed += 1
        consecutiveValidationFailures = 0
        if (isScrubProviderAuthError(err)) {
          const message = err instanceof Error ? err.message : String(err)
          await tripAuthCircuit(message)
          authCircuitTripped = true
        }
      }
    }
  }

  const cachingLive = await isCachingLive()
  const costUsdEstimate = estimateAggregateCostUsd({
    tokensIn,
    tokensOut,
    cacheReadTokens,
  })

  const status: BatchSummary["status"] = halted
    ? "strict-consecutive-halt"
    : cachingLive
      ? "ok"
      : "caching-not-live"

  const summary: BatchSummary = {
    status,
    processed: rows.length,
    succeeded,
    failed,
    droppedActions,
    tokensIn,
    tokensOut,
    cacheReadTokens,
    costUsdEstimate,
    cachingLive,
    mode,
  }
  logDigest(summary)
  if (!cachingLive) {
    console.error(
      "[scrub-warning] caching not engaging; check SYSTEM_PROMPT length vs model minimum. Backfill will refuse until resolved."
    )
  }
  return summary
}

function isScrubProviderAuthError(
  err: unknown
): err is ScrubClaudeAuthError | ScrubOpenAIAuthError {
  return (
    err instanceof ScrubClaudeAuthError || err instanceof ScrubOpenAIAuthError
  )
}

function estimateAggregateCostUsd(usage: {
  tokensIn: number
  tokensOut: number
  cacheReadTokens: number
}): number {
  // Mirrors scrub-api-log HAIKU_* constants. Kept local to avoid circular imports.
  const uncached = Math.max(0, usage.tokensIn - usage.cacheReadTokens)
  return (
    (uncached / 1_000_000) * 1 +
    (usage.cacheReadTokens / 1_000_000) * 0.1 +
    (usage.tokensOut / 1_000_000) * 5
  )
}

function logDigest(s: BatchSummary): void {
  console.log(
    `[scrub-batch] processed=${s.processed} succeeded=${s.succeeded} failed=${s.failed} droppedActions=${s.droppedActions} ` +
      `tokensIn=${s.tokensIn} tokensOut=${s.tokensOut} cacheReadTokens=${s.cacheReadTokens} ` +
      `costUSD=${s.costUsdEstimate.toFixed(4)} mode=${s.mode} cachingLive=${s.cachingLive} status=${s.status}`
  )
}
