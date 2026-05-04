import { NextResponse } from "next/server"

import { constantTimeCompare } from "@/lib/msgraph/constant-time-compare"
import { runPropertyCollapseBackfill } from "@/lib/properties/property-collapse-backfill"

export const dynamic = "force-dynamic"

/**
 * Operator-only endpoint that fixes property-collapse on existing
 * Buildout-imported Deals. Walks every Deal with `created_by =
 * 'buildout-csv-import'`, computes the canonical `(propertyKey, unit)` from
 * its title, reassigns the Deal (and any linked LeaseRecords/CalendarEvents)
 * to the canonical Property, then archives orphaned collapsed Properties.
 *
 * Auth: `x-admin-token: $MSGRAPH_TEST_ADMIN_TOKEN`. Mirrors the gate at
 * `process-backlog/route.ts` and `scan-missing-end-dates/route.ts`.
 *
 * Body shape (all optional):
 *   - dryRun: boolean. When true, computes everything but writes nothing.
 *     Defaults to false. RUN dry-run FIRST in production.
 *   - limit:  number.  Cap the deal count for incremental runs.
 *   - throttleMs: number. Sleep between deals (default 50).
 */
function isOperatorTokenAuthorized(req: Request): boolean {
  const expected = process.env.MSGRAPH_TEST_ADMIN_TOKEN ?? ""
  if (!expected) return false
  const provided = req.headers.get("x-admin-token") ?? ""
  return provided.length > 0 && constantTimeCompare(provided, expected)
}

export async function POST(req: Request): Promise<Response> {
  if (!isOperatorTokenAuthorized(req)) {
    return NextResponse.json(
      { ok: false, reason: "unauthorized" },
      { status: 401 }
    )
  }

  let body: { dryRun?: unknown; limit?: unknown; throttleMs?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const dryRun = body.dryRun === true
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit) && body.limit > 0
      ? body.limit
      : undefined
  const throttleMs =
    typeof body.throttleMs === "number" &&
    Number.isFinite(body.throttleMs) &&
    body.throttleMs >= 0
      ? body.throttleMs
      : undefined

  const report = await runPropertyCollapseBackfill({
    dryRun,
    limit,
    throttleMs,
  })

  return NextResponse.json(report, {
    status: report.ok ? 200 : 500,
  })
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
