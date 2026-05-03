import { NextResponse } from "next/server"

import {
  PROMPT_VERSION,
  authorizeScrubRequest,
  getScrubCoverageStats,
  getScrubQueueStats,
  isCachingLive,
} from "@/lib/ai"
import { db } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type WindowAgg = {
  apiCalls: number
  scrubbedOk: number
  pendingValidation: number
  validationFailed: number
  dbCommitFailed: number
  fencedOut: number
  retryCorrection: number
  tokensIn: number
  tokensOut: number
  cacheReadTokens: number
  cacheWriteTokens: number
  cacheHitRate: number
  costUSD: number
}

/**
 * Strip the lease-pipeline namespace prefix from a ScrubApiCall.outcome
 * so the stats counter can use one switch statement for every prefix.
 *
 * `extractor-pdf-` MUST be tested before `extractor-` because the longer
 * prefix is a strict superset.
 */
function stripLeasePipelinePrefix(outcome: string): string {
  if (outcome.startsWith("extractor-pdf-")) {
    return outcome.slice("extractor-pdf-".length)
  }
  if (outcome.startsWith("extractor-")) {
    return outcome.slice("extractor-".length)
  }
  if (outcome.startsWith("classifier-")) {
    return outcome.slice("classifier-".length)
  }
  return outcome
}

async function aggregate(windowMs: number): Promise<WindowAgg> {
  const since = new Date(Date.now() - windowMs)
  const rows = await db.scrubApiCall.findMany({
    where: { at: { gte: since } },
    select: {
      outcome: true,
      tokensIn: true,
      tokensOut: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
      estimatedUsd: true,
    },
  })

  const agg: WindowAgg = {
    apiCalls: rows.length,
    scrubbedOk: 0,
    pendingValidation: 0,
    validationFailed: 0,
    dbCommitFailed: 0,
    fencedOut: 0,
    retryCorrection: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    cacheHitRate: 0,
    costUSD: 0,
  }

  for (const row of rows) {
    agg.tokensIn += row.tokensIn
    agg.tokensOut += row.tokensOut
    agg.cacheReadTokens += row.cacheReadTokens
    agg.cacheWriteTokens += row.cacheWriteTokens
    agg.costUSD += Number(row.estimatedUsd.toString())
    // Audit I3: strip lease-pipeline namespaces (classifier-, extractor-,
    // extractor-pdf-) before bucketing so operators see real failure
    // counts. Without this, a flood of `extractor-validation-failed` rows
    // would aggregate to validationFailed:0 on the dashboard while the
    // pipeline silently regressed.
    const stripped = stripLeasePipelinePrefix(row.outcome)
    switch (stripped) {
      case "ok":
      case "scrubbed":
        agg.scrubbedOk += 1
        break
      case "pending-validation":
        agg.pendingValidation += 1
        break
      case "validation-failed":
        agg.validationFailed += 1
        break
      case "db-commit-failed":
        agg.dbCommitFailed += 1
        break
      case "fenced-out":
        agg.fencedOut += 1
        break
      case "retry-correction":
        agg.retryCorrection += 1
        break
      case "provider-error":
        // Map lease-pipeline provider failures into dbCommitFailed for
        // dashboard parity — they're the closest existing bucket for
        // "the call left no usable result." (A dedicated bucket would be
        // a schema change beyond this fix-pack's scope.)
        agg.dbCommitFailed += 1
        break
      case "skipped":
        // PDF-skip rows (file_too_large, not_pdf): zero tokens/cost so
        // they show in apiCalls but don't move any other counter.
        break
    }
  }
  const totalInputTokens = agg.tokensIn
  agg.cacheHitRate =
    totalInputTokens > 0 ? agg.cacheReadTokens / totalInputTokens : 0
  // Round cost to 4 decimals for display sanity
  agg.costUSD = Math.round(agg.costUSD * 10000) / 10000
  agg.cacheHitRate = Math.round(agg.cacheHitRate * 1000) / 1000
  return agg
}

export async function GET(request: Request): Promise<Response> {
  const auth = authorizeScrubRequest(request.headers, undefined, {
    allowCron: false,
  })
  if (!auth.ok) {
    return new NextResponse(null, {
      status: auth.reason === "disabled" ? 404 : 401,
    })
  }

  const [queueStats, coverage, last24h, last7d, last30d, cachingLive] =
    await Promise.all([
      getScrubQueueStats(),
      getScrubCoverageStats(),
      aggregate(24 * 60 * 60 * 1000),
      aggregate(7 * 24 * 60 * 60 * 1000),
      aggregate(30 * 24 * 60 * 60 * 1000),
      isCachingLive(),
    ])

  return NextResponse.json({
    ok: true,
    ...queueStats,
    coverage,
    last24h,
    last7d: { apiCalls: last7d.apiCalls, costUSD: last7d.costUSD },
    last30d: { apiCalls: last30d.apiCalls, costUSD: last30d.costUSD },
    promptVersion: PROMPT_VERSION,
    cachingLive,
  })
}

export async function POST(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
