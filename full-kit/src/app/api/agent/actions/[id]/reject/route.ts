import { NextResponse } from "next/server"

import {
  AgentActionReviewError,
  rejectAgentAction,
} from "@/lib/ai/agent-actions"
import {
  ReviewerAuthError,
  assertJsonRequest,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    assertJsonRequest(request)
    const reviewer = await requireAgentReviewer()
    const body = (await request.json()) as { feedback?: unknown }
    const { id } = await params
    const result = await rejectAgentAction({
      id,
      reviewer: reviewer.label,
      feedback: typeof body.feedback === "string" ? body.feedback : undefined,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof ReviewerAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    if (error instanceof AgentActionReviewError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }
    throw error
  }
}
