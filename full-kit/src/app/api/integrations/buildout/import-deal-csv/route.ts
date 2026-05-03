import { NextResponse } from "next/server"

import { constantTimeCompare, loadMsgraphConfig } from "@/lib/msgraph"
import { ingestBuildoutDealCsv } from "@/lib/buildout/deal-csv-ingest"

export const dynamic = "force-dynamic"

/**
 * Operator-driven ingest of a Buildout Deal Pipeline Report CSV.
 * Authenticated via the same admin-token pattern as the other Buildout
 * integration endpoints.
 *
 * Body: { csv: string, dryRun?: boolean }
 *
 * Idempotent — keyed on `buildoutDealId`. Re-runs upsert.
 */
export async function POST(request: Request): Promise<Response> {
  let config
  try {
    config = loadMsgraphConfig()
  } catch {
    return new NextResponse(null, { status: 404 })
  }
  if (!config.testRouteEnabled) {
    return new NextResponse(null, { status: 404 })
  }

  const provided = request.headers.get("x-admin-token")
  if (!provided || !constantTimeCompare(provided, config.testAdminToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    )
  }

  let body: { csv?: unknown; dryRun?: unknown }
  try {
    body = (await request.json()) as { csv?: unknown; dryRun?: unknown }
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON body" },
      { status: 400 }
    )
  }

  if (typeof body.csv !== "string" || body.csv.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "csv (string) is required" },
      { status: 400 }
    )
  }

  const summary = await ingestBuildoutDealCsv(body.csv, {
    dryRun: body.dryRun === true,
  })
  return NextResponse.json({ ok: true, dryRun: body.dryRun === true, summary })
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
