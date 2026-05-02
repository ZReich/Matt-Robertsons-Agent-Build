import { NextResponse } from "next/server"

import { processUnprocessedDailyListings } from "@/lib/daily-listings/processor"
import { constantTimeCompare } from "@/lib/msgraph/constant-time-compare"
import {
  setLastDailyListingsSweep,
  type LastDailyListingsSweep,
} from "@/lib/system-state/last-daily-listings-sweep"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const BEARER_PREFIX = "Bearer "

function authorize(headers: Headers): {
  ok: boolean
  status?: number
} {
  const secret = process.env.DAILY_LISTINGS_CRON_SECRET
  if (!secret) {
    // The endpoint exists but is misconfigured in this environment. 503 makes
    // the failure mode obvious in cron logs vs a generic 401 — Matt's local
    // dev env may not have the secret set at all.
    return { ok: false, status: 503 }
  }
  const auth = headers.get("authorization")
  if (!auth || !auth.startsWith(BEARER_PREFIX)) {
    return { ok: false, status: 401 }
  }
  const presented = auth.slice(BEARER_PREFIX.length)
  if (!constantTimeCompare(presented, secret)) {
    return { ok: false, status: 401 }
  }
  return { ok: true }
}

interface ProcessorResult {
  candidates: number
  processed: number
  results: Array<
    | {
        ok: true
        parsed: number
        draftsCreated: number
        draftsSent: number
        errors: string[]
      }
    | { ok: false }
  >
}

function summarize(result: ProcessorResult): LastDailyListingsSweep {
  let listingsParsed = 0
  let draftsCreated = 0
  let draftsSent = 0
  let errors = 0
  for (const r of result.results) {
    if (r.ok) {
      listingsParsed += r.parsed
      draftsCreated += r.draftsCreated
      draftsSent += r.draftsSent
      errors += r.errors.length
    }
  }
  return {
    ranAt: new Date().toISOString(),
    candidates: result.candidates,
    processed: result.processed,
    listingsParsed,
    draftsCreated,
    draftsSent,
    errors,
  }
}

/**
 * Vercel cron entrypoint. Vercel cron jobs always issue a GET; the existing
 * POST `/api/daily-listings/process` route is reserved for in-app user-driven
 * sweeps (cookie + same-origin) — that's why this lives at a separate path
 * with separate auth.
 *
 * Auth: `Authorization: Bearer <DAILY_LISTINGS_CRON_SECRET>`. If the env var
 * is not set, the route returns 503 so a misconfigured deploy is obvious.
 *
 * On success: runs `processUnprocessedDailyListings({ lookbackDays: 1 })`,
 * persists a `last_daily_listings_sweep` summary to SystemState (surfaced in
 * the Settings → Automation page), and returns the summary as JSON.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = authorize(request.headers)
  if (!auth.ok) {
    return new NextResponse(null, { status: auth.status ?? 401 })
  }

  let result: ProcessorResult
  try {
    result = (await processUnprocessedDailyListings({
      lookbackDays: 1,
    })) as ProcessorResult
  } catch (error) {
    // Surface the failure as a 500 so the cron log shows red and Matt sees
    // it on the Settings page (last-run timestamp won't have advanced).
    console.error(
      "[cron/daily-listings] processor threw",
      error instanceof Error ? error.message : error
    )
    return NextResponse.json(
      { ok: false, error: "processor_failed" },
      { status: 500 }
    )
  }

  const summary = summarize(result)
  try {
    await setLastDailyListingsSweep(summary)
  } catch (error) {
    // Last-run persistence is observability, not correctness. Don't fail the
    // cron just because we couldn't write the summary row.
    console.error(
      "[cron/daily-listings] failed to persist last-run summary",
      error instanceof Error ? error.message : error
    )
  }

  return NextResponse.json({ ok: true, ...summary })
}
