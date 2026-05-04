import { NextResponse } from "next/server"

import {
  ThreadSummarizerError,
  getOrGenerateThreadSummary,
} from "@/lib/ai/thread-summarizer"
import {
  CandidateReviewAuthError,
  assertSameOriginRequest,
  requireContactCandidateReviewer,
} from "@/lib/contact-candidate-review-auth"
import { db } from "@/lib/prisma"
import { ReviewerAuthError, assertJsonRequest } from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    assertJsonRequest(request)
    await requireContactCandidateReviewer()
  } catch (error) {
    if (
      error instanceof CandidateReviewAuthError ||
      error instanceof ReviewerAuthError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }

  const { id: candidateId } = await params

  let body: { force?: boolean } = {}
  try {
    const text = await request.text()
    if (text.trim().length > 0) body = JSON.parse(text) as { force?: boolean }
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  // Look up the candidate's evidence comm ids — single primary
  // communicationId plus any extras tracked in metadata.communicationIds.
  const candidate = await db.contactPromotionCandidate.findUnique({
    where: { id: candidateId },
    select: { communicationId: true, metadata: true },
  })
  if (!candidate) {
    return NextResponse.json({ error: "candidate not found" }, { status: 404 })
  }
  const md =
    candidate.metadata &&
    typeof candidate.metadata === "object" &&
    !Array.isArray(candidate.metadata)
      ? (candidate.metadata as Record<string, unknown>)
      : {}
  const extra = Array.isArray(md.communicationIds)
    ? md.communicationIds.filter((v): v is string => typeof v === "string")
    : []
  const ids = Array.from(
    new Set(
      [candidate.communicationId, ...extra].filter((id): id is string => !!id)
    )
  )
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "candidate has no evidence communications" },
      { status: 400 }
    )
  }

  try {
    const summary = await getOrGenerateThreadSummary(candidateId, ids, {
      force: body.force === true,
    })
    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    if (error instanceof ThreadSummarizerError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 400 ? error.status : 500 }
      )
    }
    throw error
  }
}
