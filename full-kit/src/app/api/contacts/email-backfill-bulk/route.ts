import { NextResponse } from "next/server"

import { runBulkBackfill } from "@/lib/contacts/mailbox-backfill/bulk-runner"
import { constantTimeCompare } from "@/lib/msgraph/constant-time-compare"
import { db } from "@/lib/prisma"

/**
 * Backfill runs that have been "running" longer than this are considered
 * abandoned (orchestrator died, request aborted, deploy mid-run, etc.) and
 * reaped so the partial unique on (contact_id) WHERE status='running' doesn't
 * block any contact forever. Mirrors the per-contact route's reaper.
 */
const STUCK_RUN_THRESHOLD_MS = 15 * 60 * 1000

/**
 * Operator-only endpoint: matches the inline admin-token pattern used by
 * `lease/renewal-sweep`. CLI / cron callers send
 * `x-admin-token: $MSGRAPH_TEST_ADMIN_TOKEN`. There is no NextAuth fallback
 * because no UI surface should ever trigger a 286-contact bulk run.
 */
function isOperatorTokenAuthorized(request: Request): boolean {
  const expected = process.env.MSGRAPH_TEST_ADMIN_TOKEN ?? ""
  if (!expected) return false
  const provided = request.headers.get("x-admin-token") ?? ""
  return provided.length > 0 && constantTimeCompare(provided, expected)
}

export async function POST(req: Request): Promise<Response> {
  if (!isOperatorTokenAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Reap any abandoned `running` rows across ALL contacts before delegating.
  // Without this, a single previously aborted bulk run leaves dozens of
  // BackfillRun rows stuck in `running` forever, and the per-contact partial
  // unique constraint then makes every entry in this bulk run hit
  // BackfillAlreadyRunningError. Per-contact route does the same reap scoped
  // to one contactId; the bulk variant reaps unscoped because we can't know
  // upfront which contacts the runner will touch.
  await db.backfillRun.updateMany({
    where: {
      status: "running",
      startedAt: { lt: new Date(Date.now() - STUCK_RUN_THRESHOLD_MS) },
    },
    data: {
      status: "failed",
      finishedAt: new Date(),
      errorMessage: "abandoned_no_finalize",
    },
  })

  let body: {
    contactIds?: unknown
    mode?: unknown
    delayBetweenMs?: unknown
    dryRun?: unknown
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }

  const contactIds = Array.isArray(body.contactIds)
    ? (body.contactIds.filter((v) => typeof v === "string") as string[])
    : undefined

  let mode: "deal-anchored" | "lifetime" = "deal-anchored"
  if (body.mode === "lifetime" || body.mode === "deal-anchored") {
    mode = body.mode
  }

  let delayBetweenMs: number | undefined
  if (typeof body.delayBetweenMs === "number" && body.delayBetweenMs >= 0) {
    delayBetweenMs = body.delayBetweenMs
  }

  const dryRun = body.dryRun === true

  const result = await runBulkBackfill({
    contactIds,
    mode,
    delayBetweenMs,
    dryRun,
    trigger: "bulk",
  })

  return NextResponse.json(result)
}
