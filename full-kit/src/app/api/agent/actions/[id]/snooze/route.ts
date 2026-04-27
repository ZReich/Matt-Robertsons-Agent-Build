import { NextResponse } from "next/server"

import {
  AgentActionReviewError,
  snoozeAgentAction,
} from "@/lib/ai/agent-actions"
import { DEFAULT_AGENT_ACTION_SNOOZE_MS } from "@/lib/ai/review-constants"
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
    const body = (await request.json()) as { snoozedUntil?: unknown }
    const snoozedUntil =
      typeof body.snoozedUntil === "string"
        ? new Date(body.snoozedUntil)
        : new Date(Date.now() + DEFAULT_AGENT_ACTION_SNOOZE_MS)
    if (Number.isNaN(snoozedUntil.getTime())) {
      return NextResponse.json(
        { error: "invalid snoozedUntil" },
        { status: 400 }
      )
    }
    const { id } = await params
    const result = await snoozeAgentAction({
      id,
      snoozedUntil,
      reviewer: reviewer.label,
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
