import { NextResponse } from "next/server"

import { runCriteriaBackfill } from "@/lib/ai/criteria-extractor"
import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  let body: {
    lookbackDays?: unknown
    contactLimit?: unknown
    commsPerContact?: unknown
    minConfidence?: unknown
    dryRun?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  function num(v: unknown, min: number, max: number, fallback: number): number {
    const n = Number(v)
    if (!Number.isFinite(n)) return fallback
    return Math.max(min, Math.min(max, n))
  }

  const result = await runCriteriaBackfill({
    lookbackDays: num(body.lookbackDays, 7, 365, 90),
    // Hard ceiling raised to 5000 — Matt's full contact set is ~2300 today,
    // and we want headroom. The UI should still expose the chosen number so
    // the operator sees what they're committing to (cost ≈ $0.002/contact).
    contactLimit: num(body.contactLimit, 1, 5000, 100),
    commsPerContact: num(body.commsPerContact, 1, 30, 12),
    minConfidence:
      typeof body.minConfidence === "number" &&
      Number.isFinite(body.minConfidence)
        ? Math.max(0, Math.min(1, body.minConfidence))
        : 0.55,
    dryRun: body.dryRun === true,
  })
  return NextResponse.json({ ok: true, ...result })
}
