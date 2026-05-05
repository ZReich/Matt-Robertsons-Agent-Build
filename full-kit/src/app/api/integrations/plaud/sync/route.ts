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
    // never leak to a public response. Server-side error is logged below.
    // eslint-disable-next-line no-console
    console.error(
      "[plaud-sync-route] failed:",
      err instanceof Error ? err.name : "unknown"
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
  const cronSecret = process.env.PLAUD_CRON_SECRET
  const auth = request.headers.get("authorization") ?? ""
  if (cronSecret && auth.startsWith(BEARER_PREFIX)) {
    const token = auth.slice(BEARER_PREFIX.length).trim()
    if (constantTimeCompare(token, cronSecret)) {
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
