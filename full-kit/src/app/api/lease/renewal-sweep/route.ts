import { NextResponse } from "next/server"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import { runRenewalAlertSweep } from "@/lib/lease/renewal-alert-job"

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  let body: { lookaheadMonths?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  let lookaheadMonths: number | undefined
  if (body.lookaheadMonths !== undefined) {
    if (
      typeof body.lookaheadMonths !== "number" ||
      !Number.isFinite(body.lookaheadMonths) ||
      body.lookaheadMonths < 1 ||
      body.lookaheadMonths > 24
    ) {
      return NextResponse.json(
        { error: "lookaheadMonths must be a number between 1 and 24" },
        { status: 400 }
      )
    }
    lookaheadMonths = Math.round(body.lookaheadMonths)
  }

  const result = await runRenewalAlertSweep({ lookaheadMonths })
  return NextResponse.json(result)
}
