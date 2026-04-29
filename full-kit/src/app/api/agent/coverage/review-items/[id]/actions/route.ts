import { NextResponse } from "next/server"

import {
  CoverageValidationError,
  applyCoverageReviewAction,
  parseReviewActionPayload,
} from "@/lib/coverage/communication-coverage"
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
    const payload = parseReviewActionPayload(await request.json())
    const { id } = await params
    const result = await applyCoverageReviewAction(id, {
      ...payload,
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
