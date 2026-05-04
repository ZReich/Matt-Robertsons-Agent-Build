import { db } from "@/lib/prisma"

export type ScrubApiUsage = {
  tokensIn: number
  tokensOut: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

type ScrubApiMetadata = Record<string, unknown>

/**
 * "pending-validation" is the initial state written immediately after a
 * successful Anthropic response, BEFORE validation or DB commit — so the
 * spend is counted even when downstream work fails.
 *
 * The remaining outcomes are terminal. `updateScrubApiCallOutcome()`
 * transitions a row from "pending-validation" to its final state.
 *
 * Cross-purpose outcomes (`ok`, `validation-failed`, `provider-error`)
 * are scoped by the `purpose` column — a query for "all validation
 * failures across the closed-deal classifier" is
 * `WHERE outcome = 'validation-failed' AND purpose = 'closed_deal_classifier'`.
 */
export type ScrubApiOutcome =
  | "pending-validation"
  | "scrubbed"
  | "validation-failed"
  | "db-commit-failed"
  | "fenced-out"
  | "retry-correction"
  | "ok"
  | "provider-error"
  /// PDF inputs we refused to send to Anthropic (file_too_large, not_pdf).
  /// Rows carry zero tokens and zero cost so the skip rate is queryable.
  | "skipped"

/**
 * Identifies which AI call site produced a `ScrubApiCall` row. Persisted
 * to the `purpose` column so cross-cutting queries can scope by source
 * without relying on outcome-string prefixes.
 */
export type ScrubApiPurpose =
  | "scrub"
  | "closed_deal_classifier"
  | "lease_extractor"
  | "pdf_lease_extractor"

const HAIKU_INPUT_PER_M = 1
const HAIKU_CACHE_READ_PER_M = 0.1
const HAIKU_CACHE_WRITE_PER_M = 1.25
const HAIKU_OUTPUT_PER_M = 5

let warnedMissingMetadataColumn = false

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
  purpose,
  estimatedUsdOverride,
  metadata,
}: {
  queueRowId?: string | null
  communicationId?: string | null
  promptVersion: string
  modelUsed: string
  usage: ScrubApiUsage
  outcome: ScrubApiOutcome
  purpose: ScrubApiPurpose
  metadata?: ScrubApiMetadata
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
        purpose,
        estimatedUsd: usd.toFixed(6),
      },
      select: { id: true },
    })
    if (row.id && metadata && Object.keys(metadata).length > 0) {
      await writeScrubApiCallMetadata(row.id, metadata)
    }
    return row.id
  } catch (err) {
    // Don't kill the scrub because telemetry couldn't land.
    // Under-counting spend is strictly better than losing scrub output.
    console.error("[scrub] failed to write ScrubApiCall row:", err)
    return null
  }
}

async function writeScrubApiCallMetadata(
  rowId: string,
  metadata: ScrubApiMetadata
): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `UPDATE "scrub_api_calls"
       SET "metadata" = COALESCE("metadata", '{}'::jsonb) || $1::jsonb
       WHERE "id" = $2`,
      JSON.stringify(metadata),
      rowId
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (
      message.includes(`column "metadata" does not exist`) ||
      message.includes("42703")
    ) {
      if (!warnedMissingMetadataColumn) {
        warnedMissingMetadataColumn = true
        console.error(
          "[scrub] scrub_api_calls.metadata column is missing; metadata not written"
        )
      }
      return
    }
    console.error("[scrub] failed to write ScrubApiCall metadata:", err)
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
