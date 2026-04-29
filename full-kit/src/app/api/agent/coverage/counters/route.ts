import { NextResponse } from "next/server"

import { getCoverageObservabilityCounters } from "@/lib/coverage/coverage-observability"
import {
  ReviewerAuthError,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAgentReviewer()
    const url = new URL(request.url)
    const allowed = new Set(["since"])
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key)) {
        return NextResponse.json(
          { error: `unknown query parameter: ${key}` },
          { status: 400 }
        )
      }
    }
    const sinceParam = url.searchParams.get("since")
    if (sinceParam) {
      const parsed = new Date(sinceParam)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "invalid since" },
          { status: 400 }
        )
      }
    }
    const counters = await getCoverageObservabilityCounters({
      since: sinceParam,
    })
    return NextResponse.json(counters)
  } catch (error) {
    if (error instanceof ReviewerAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }
}
