import { NextResponse } from "next/server"

import {
  COVERAGE_POLICY_VERSION,
  CoverageValidationError,
  applyCoverageReviewAction,
  parseReviewActionPayload,
} from "@/lib/coverage/communication-coverage"
import {
  type CoverageActionAuditOutcome,
  recordCoverageActionAudit,
} from "@/lib/coverage/coverage-observability"
import {
  ReviewerAuthError,
  assertJsonRequest,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    assertJsonRequest(request)
    const reviewer = await requireAgentReviewer()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new CoverageValidationError("invalid JSON body")
    }
    const payload = parseReviewActionPayload(body)
    const { id } = await params
    const result = await applyCoverageReviewAction(id, {
      ...payload,
      reviewer: reviewer.label,
    })
    await recordCoverageActionAudit({
      actor: reviewer.label,
      action: `coverage_review_action:${payload.action}`,
      runId: payload.runId,
      dryRun: payload.dryRun,
      policyVersion: COVERAGE_POLICY_VERSION,
      reviewItemIds: [id],
      outcome: outcomeForApplyResult(result.status),
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ReviewerAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    if (error instanceof CoverageValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }
}

function outcomeForApplyResult(
  status:
    | "would_update"
    | "updated"
    | "would_enqueue"
    | "enqueued"
    | "would_requeue"
    | "requeued"
    | "noop"
    | "unsupported"
): CoverageActionAuditOutcome {
  switch (status) {
    case "updated":
    case "enqueued":
    case "requeued":
    case "would_update":
    case "would_enqueue":
    case "would_requeue":
      return { applied: 1, skipped: 0, unsupported: 0 }
    case "noop":
      return { applied: 0, skipped: 1, unsupported: 0 }
    case "unsupported":
      return { applied: 0, skipped: 0, unsupported: 1 }
  }
}
