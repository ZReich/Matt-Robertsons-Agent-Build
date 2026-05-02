import { NextResponse } from "next/server"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import {
  processBuildoutStageUpdate,
  processUnprocessedBuildoutStageUpdates,
} from "@/lib/deals/buildout-stage-action"

/**
 * POST /api/buildout/process-stage-updates
 *
 * Body shape:
 *   { communicationId: string }                                  ← single
 *   { sweep: true, lookbackDays?: number, limit?: number }       ← bulk
 *
 * Single-mode: process exactly that Communication; return the discriminated
 * result.
 *
 * Sweep-mode: find inbound Communications whose subject starts with "Deal
 * stage updated" within `lookbackDays` (default 7, max 90), filter out rows
 * already idempotency-stamped, and process each. Returns a per-status
 * histogram and a sample of per-row results.
 */
export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  let body: {
    communicationId?: unknown
    sweep?: unknown
    lookbackDays?: unknown
    limit?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  if (typeof body.communicationId === "string") {
    const result = await processBuildoutStageUpdate(body.communicationId)
    return NextResponse.json({ ok: true, result })
  }

  if (body.sweep === true) {
    const lookback =
      typeof body.lookbackDays === "number" && body.lookbackDays > 0
        ? Math.min(Math.floor(body.lookbackDays), 90)
        : 7
    const limit =
      typeof body.limit === "number" && body.limit > 0
        ? Math.min(Math.floor(body.limit), 500)
        : 100
    const result = await processUnprocessedBuildoutStageUpdates({
      lookbackDays: lookback,
      limit,
    })
    return NextResponse.json({ ok: true, ...result })
  }

  return NextResponse.json(
    {
      error:
        "Provide { communicationId } to process one, or { sweep: true, lookbackDays?, limit? } to sweep unprocessed Buildout deal-stage emails.",
    },
    { status: 400 }
  )
}
