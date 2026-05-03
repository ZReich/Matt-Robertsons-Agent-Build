import { db } from "@/lib/prisma"

export type ScrubApiUsage = {
  tokensIn: number
  tokensOut: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/**
 * "pending-validation" is the initial state written immediately after a
 * successful Anthropic response, BEFORE validation or DB commit — so the
 * spend is counted even when downstream work fails.
 *
 * The remaining outcomes are terminal. `updateScrubApiCallOutcome()`
 * transitions a row from "pending-validation" to its final state.
 */
export type ScrubApiOutcome =
  | "pending-validation"
  | "scrubbed"
  | "validation-failed"
  | "db-commit-failed"
  | "fenced-out"
  | "retry-correction"
  // Closed-deal classifier outcomes (Stage 1 of lease pipeline). These
  // share the same telemetry table because the schema fits 1:1 — only
  // the cost model differs (DeepSeek vs Haiku), and callers pass an
  // override via `estimatedUsdOverride`.
  //
  // CONVENTION: classifier-* outcomes are namespaced because there is no
  // `purpose` column on ScrubApiCall. Any cross-cutting query like
  // "show me all validation failures" must UNION over both
  // "validation-failed" AND "classifier-validation-failed".
  // Follow-up: add `purpose` column to schema and migrate.
  | "classifier-ok"
  | "classifier-validation-failed"
  | "classifier-provider-error"

const HAIKU_INPUT_PER_M = 1
const HAIKU_CACHE_READ_PER_M = 0.1
const HAIKU_CACHE_WRITE_PER_M = 1.25
const HAIKU_OUTPUT_PER_M = 5

export function estimateScrubCostUsd(usage: ScrubApiUsage): number {
  const cacheReadTokens = usage.cacheReadTokens ?? 0
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0
  const uncachedInputTokens = Math.max(0, usage.tokensIn - cacheReadTokens)
  return (
    (uncachedInputTokens / 1_000_000) * HAIKU_INPUT_PER_M +
    (cacheReadTokens / 1_000_000) * HAIKU_CACHE_READ_PER_M +
    (cacheWriteTokens / 1_000_000) * HAIKU_CACHE_WRITE_PER_M +
    (usage.tokensOut / 1_000_000) * HAIKU_OUTPUT_PER_M
  )
}

/**
 * Insert a new ScrubApiCall row. Returns the row's id so the caller can
 * later mark the outcome.
 *
 * Failure to write this row is logged to stderr but does NOT throw — we
 * prefer to under-count telemetry over blocking a scrub on telemetry
 * persistence.
 */
export async function logScrubApiCall({
  queueRowId,
  communicationId,
  promptVersion,
  modelUsed,
  usage,
  outcome,
  estimatedUsdOverride,
}: {
  queueRowId?: string | null
  communicationId?: string | null
  promptVersion: string
  modelUsed: string
  usage: ScrubApiUsage
  outcome: ScrubApiOutcome
  /**
   * Optional pre-computed USD estimate. Use when the caller has its own
   * pricing model (e.g. the closed-deal classifier on DeepSeek, which
   * does not match the Haiku cost curve baked into
   * `estimateScrubCostUsd`). When omitted, falls back to the Haiku
   * estimator.
   */
  estimatedUsdOverride?: number
}): Promise<string | null> {
  try {
    const usd =
      estimatedUsdOverride !== undefined
        ? estimatedUsdOverride
        : estimateScrubCostUsd(usage)
    const row = await db.scrubApiCall.create({
      data: {
        scrubQueueId: queueRowId ?? null,
        communicationId: communicationId ?? null,
        promptVersion,
        modelUsed,
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        cacheReadTokens: usage.cacheReadTokens ?? 0,
        cacheWriteTokens: usage.cacheWriteTokens ?? 0,
        outcome,
        estimatedUsd: usd.toFixed(6),
      },
      select: { id: true },
    })
    return row.id
  } catch (err) {
    // Don't kill the scrub because telemetry couldn't land.
    // Under-counting spend is strictly better than losing scrub output.
    console.error("[scrub] failed to write ScrubApiCall row:", err)
    return null
  }
}

/**
 * Update the outcome of a ScrubApiCall row previously created with
 * `logScrubApiCall({ outcome: "pending-validation" })`. No-op if `id` is
 * null (which happens when the insert above silently failed).
 */
export async function updateScrubApiCallOutcome(
  id: string | null,
  outcome: Exclude<ScrubApiOutcome, "pending-validation">
): Promise<void> {
  if (!id) return
  try {
    await db.scrubApiCall.update({
      where: { id },
      data: { outcome },
    })
  } catch (err) {
    console.error("[scrub] failed to update ScrubApiCall outcome:", err)
  }
}
