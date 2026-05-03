import { NextResponse } from "next/server"

import type { CandidateReviewAction } from "@/lib/contact-promotion-candidates"

import {
  CandidateReviewAuthError,
  assertSameOriginRequest,
  requireContactCandidateReviewer,
} from "@/lib/contact-candidate-review-auth"
import {
  CandidateReviewError,
  reviewContactPromotionCandidate,
} from "@/lib/contact-promotion-candidates"

// Phase E auto-reply hook in reviewContactPromotionCandidate is awaited (so
// the API response reflects the real PendingReply state). The hook makes a
// DeepSeek round-trip (documented at 6-10s) plus DB writes. Vercel's hobby
// plan defaults to a 10s function timeout, which puts approval requests
// right at the wall: a slow DeepSeek call would surface as a 504 to the UI
// even though state is correct. Bump to 60s so the hook has comfortable
// headroom and Mail.Send latency can be added later without revisiting.
export const maxDuration = 60

const ACTIONS = new Set([
  "approve_create_contact",
  "approve_link_contact",
  "reject",
  "not_a_contact",
  "needs_more_evidence",
  "snooze",
])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  let reviewer: string
  try {
    assertSameOriginRequest(request)
    reviewer = (await requireContactCandidateReviewer()).label
  } catch (error) {
    if (error instanceof CandidateReviewAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const action = typeof body.action === "string" ? body.action : null
  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 })
  }

  const contactId =
    typeof body.contactId === "string" && body.contactId.trim()
      ? body.contactId.trim()
      : undefined
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : undefined
  const snoozedUntil =
    typeof body.snoozedUntil === "string" && body.snoozedUntil.trim()
      ? new Date(body.snoozedUntil)
      : undefined

  if (snoozedUntil && Number.isNaN(snoozedUntil.getTime())) {
    return NextResponse.json({ error: "invalid snoozedUntil" }, { status: 400 })
  }

  try {
    const result = await reviewContactPromotionCandidate({
      id,
      action: action as CandidateReviewAction,
      contactId,
      reviewer,
      reason,
      snoozedUntil,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof CandidateReviewError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }
}
