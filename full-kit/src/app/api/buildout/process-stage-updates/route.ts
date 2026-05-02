import { NextResponse } from "next/server"

import {
  ReviewerAuthError,
  assertJsonRequest,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"
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
 *
 * Auth: mirrors `auto-approve-pending` — reviewer allowlist (not just any
 * authenticated user) because this endpoint can mutate Deal stages and write
 * AgentActions in `executed` status.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    assertJsonRequest(request)
    await requireAgentReviewer()

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
  } catch (error) {
    if (error instanceof ReviewerAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }
}
