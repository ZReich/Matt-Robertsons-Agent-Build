import { NextResponse } from "next/server"

import {
  CoverageValidationError,
  applyCoverageReviewActionBatch,
  parseBatchReviewActionPayload,
} from "@/lib/coverage/communication-coverage"
import {
  ReviewerAuthError,
  assertJsonRequest,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    assertJsonRequest(request)
    const reviewer = await requireAgentReviewer()
    const payload = parseBatchReviewActionPayload(await request.json())
    const { reviewItemIds, ...input } = payload
    const result = await applyCoverageReviewActionBatch(reviewItemIds, {
      ...input,
      reviewer: reviewer.label,
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
