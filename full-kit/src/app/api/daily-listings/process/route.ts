import { NextResponse } from "next/server"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import {
  processDailyListingsEmail,
  processUnprocessedDailyListings,
} from "@/lib/daily-listings/processor"

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  let body: { communicationId?: unknown; sweep?: unknown; lookbackDays?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  if (typeof body.communicationId === "string") {
    const result = await processDailyListingsEmail(body.communicationId)
    return NextResponse.json(result)
  }

  if (body.sweep === true) {
    const lookback =
      typeof body.lookbackDays === "number" && body.lookbackDays > 0
        ? Math.min(Math.floor(body.lookbackDays), 90)
        : 14
    const result = await processUnprocessedDailyListings({
      lookbackDays: lookback,
    })
    return NextResponse.json({ ok: true, ...result })
  }

  return NextResponse.json(
    {
      error:
        "Provide either { communicationId: '...' } to process one, or { sweep: true, lookbackDays?: number } to sweep unprocessed digests.",
    },
    { status: 400 }
  )
}
