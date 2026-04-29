import { NextResponse } from "next/server"

import {
  CoverageValidationError,
  listCoverageReviewItems,
  parseReviewItemsQuery,
} from "@/lib/coverage/communication-coverage"
import { ReviewerAuthError, requireAgentReviewer } from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAgentReviewer()
    const query = parseReviewItemsQuery(request.url)
    const result = await listCoverageReviewItems(query)
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
