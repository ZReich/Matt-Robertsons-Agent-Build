import { NextResponse } from "next/server"

import { constantTimeCompare } from "@/lib/msgraph/constant-time-compare"
import { syncPlaud } from "@/lib/plaud"
import {
  ReviewerAuthError,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"
// First sync can pull ~90 days of recordings → AI passes per recording add up.
// 300s requires Vercel Pro or higher; on Hobby this is silently capped at
// 60s. The orchestrator's MAX_PAGES + per-recording errors-don't-abort
// design means a 60s cap just means more pages are processed across
// multiple cron ticks, not data loss.
export const maxDuration = 300

const BEARER_PREFIX = "Bearer "

/**
 * POST /api/integrations/plaud/sync
 *
 * Two auth modes:
 *   1. Cron: Authorization: Bearer ${PLAUD_CRON_SECRET}. Vercel cron path.
 *   2. Session: same-origin request from a logged-in reviewer (manual button).
 *
 * Returns the SyncResult shape from `syncPlaud()`. 409 when another sync
 * is already running (advisory lock not acquired).
 */
async function handle(request: Request): Promise<Response> {
  const auth = await authorize(request)
  if (!auth.ok) {
    return new NextResponse(null, { status: auth.status })
  }

  try {
    const result = await syncPlaud({ manual: auth.manual })
    if (result.skipped === "already_running") {
      return NextResponse.json(result, { status: 409 })
    }
    return NextResponse.json({ ok: result.errors === 0, ...result })
  } catch (err) {
    // Surface a generic message — credentials and transcript bodies must
    // never leak to a public response. Server-side error is logged below;
    // PlaudApiError already sanitizes `message`, so it's safe to include.
    console.error(
      "[plaud-sync-route] failed:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown",
      err instanceof Error && err.stack ? `\n${err.stack}` : ""
    )
    return NextResponse.json(
      { ok: false, error: "sync_failed" },
      { status: 500 }
    )
  }
}

// Vercel Cron sends GET; the manual button sends POST. Both go through
// the same authorize() flow.
export async function POST(request: Request): Promise<Response> {
  return handle(request)
}

export async function GET(request: Request): Promise<Response> {
  return handle(request)
}

async function authorize(
  request: Request
): Promise<
  | { ok: true; manual: boolean; status?: never }
  | { ok: false; manual?: never; status: number }
> {
  // Accept either secret. Vercel auto-injects Authorization: Bearer ${CRON_SECRET}
  // for scheduled cron requests; the integration-specific PLAUD_CRON_SECRET
  // is for local dev / manual invocations from cron-like callers. Mirrors
  // the daily-listings route pattern.
  const plaudCronSecret = process.env.PLAUD_CRON_SECRET
  const vercelCronSecret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization") ?? ""
  if (auth.startsWith(BEARER_PREFIX)) {
    const token = auth.slice(BEARER_PREFIX.length).trim()
    if (plaudCronSecret && constantTimeCompare(token, plaudCronSecret)) {
      return { ok: true, manual: false }
    }
    if (vercelCronSecret && constantTimeCompare(token, vercelCronSecret)) {
      return { ok: true, manual: false }
    }
  }
  // Fall back to session auth for the manual "Sync now" button.
  try {
    assertSameOriginRequest(request)
    await requireAgentReviewer()
    return { ok: true, manual: true }
  } catch (err) {
    const status = err instanceof ReviewerAuthError ? err.status : 401
    return { ok: false, status }
  }
}
