import { NextResponse } from "next/server"

import type { ContactPromotionCandidateStatus } from "@prisma/client"
import type { NextRequest } from "next/server"

import {
  CandidateReviewAuthError,
  requireContactCandidateReviewer,
} from "@/lib/contact-candidate-review-auth"
import { listContactPromotionCandidates } from "@/lib/contact-promotion-candidates"

const STATUSES = new Set<ContactPromotionCandidateStatus>([
  "pending",
  "needs_more_evidence",
  "snoozed",
  "approved",
  "merged",
  "rejected",
  "not_a_contact",
  "superseded",
])

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requireContactCandidateReviewer()
  } catch (error) {
    if (error instanceof CandidateReviewAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }

  const statusParam = request.nextUrl.searchParams.get("status")
  const status =
    statusParam && STATUSES.has(statusParam as ContactPromotionCandidateStatus)
      ? (statusParam as ContactPromotionCandidateStatus)
      : undefined
  const includeTerminal =
    request.nextUrl.searchParams.get("includeTerminal") === "true"

  const candidates = await listContactPromotionCandidates({
    status,
    includeTerminal,
  })

  return NextResponse.json({ candidates })
}
