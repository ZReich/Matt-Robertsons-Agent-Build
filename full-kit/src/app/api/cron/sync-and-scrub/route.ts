import { NextResponse } from "next/server"

import { scrubEmailBatch } from "@/lib/ai/scrub"
import { syncEmails } from "@/lib/msgraph"
import { constantTimeCompare } from "@/lib/msgraph/constant-time-compare"

export const dynamic = "force-dynamic"
// Sync can take ~60s on first bootstrap, then near-instant on delta-empty
// runs. Scrub batch is bounded to 50 messages * ~1s each = ~50s. 5 minutes
// gives plenty of headroom even when both run hot.
export const maxDuration = 300

const BEARER_PREFIX = "Bearer "

/**
 * Combined sync-and-scrub cron. Runs every 10 minutes (per vercel.json).
 *
 * Step 1: pull any new emails from Outlook via the existing delta-cursored
 * syncEmails() — no-op when delta returns empty (cheap), processes only the
 * new messages otherwise. New messages get auto-classified and signal/
 * uncertain ones are auto-enqueued for AI scrub by the existing pipeline.
 *
 * Step 2: drain up to 50 pending scrub queue rows through DeepSeek so the
 * Personal tab and relationship summary stay current as new emails arrive.
 *
 * Auth: Vercel auto-injects Authorization: Bearer ${CRON_SECRET} when the
 * env var is set. Mirrors the daily-listings cron pattern.
 */
function authorize(headers: Headers): { ok: boolean; status?: number } {
  const cronSecret = process.env.CRON_SECRET
  const adminToken = process.env.MSGRAPH_TEST_ADMIN_TOKEN
  // 503 if neither secret is configured — clearer in cron logs than 401.
  if (!cronSecret && !adminToken) return { ok: false, status: 503 }
  const auth = headers.get("authorization") ?? ""
  if (auth.startsWith(BEARER_PREFIX)) {
    const token = auth.slice(BEARER_PREFIX.length).trim()
    if (cronSecret && constantTimeCompare(token, cronSecret))
      return { ok: true }
    if (adminToken && constantTimeCompare(token, adminToken))
      return { ok: true }
  }
  // Local-dev convenience: also accept x-admin-token header so this can be
  // hit from the same place as the test routes.
  const provided = headers.get("x-admin-token") ?? ""
  if (adminToken && constantTimeCompare(provided, adminToken)) {
    return { ok: true }
  }
  return { ok: false, status: 401 }
}

export async function POST(request: Request): Promise<Response> {
  const auth = authorize(request.headers)
  if (!auth.ok) {
    return new NextResponse(null, { status: auth.status ?? 401 })
  }

  const t0 = Date.now()
  let syncResult: unknown = null
  let syncError: string | null = null
  try {
    syncResult = await syncEmails()
  } catch (err) {
    syncError = err instanceof Error ? err.message : String(err)
  }

  let scrubResult: unknown = null
  let scrubError: string | null = null
  try {
    scrubResult = await scrubEmailBatch({ limit: 50 })
  } catch (err) {
    scrubError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({
    ok: !syncError && !scrubError,
    durationMs: Date.now() - t0,
    sync: syncError ? { error: syncError } : syncResult,
    scrub: scrubError ? { error: scrubError } : scrubResult,
  })
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
