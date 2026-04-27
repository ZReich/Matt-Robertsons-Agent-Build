import { NextResponse } from "next/server"

import {
  CandidateReviewAuthError,
  requireContactCandidateReviewer,
} from "@/lib/contact-candidate-review-auth"
import { countContactPromotionCandidates } from "@/lib/contact-promotion-candidates"

export async function GET(): Promise<Response> {
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

  const count = await countContactPromotionCandidates()

  return NextResponse.json({ ok: true, count })
}
