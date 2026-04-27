import { NextResponse } from "next/server"

import type { LeadApplyBackfillRequest } from "@/lib/backfill/lead-apply-backfill"

import { authorizeEmailBackfillRequest } from "@/lib/backfill/email-backfill-auth"
import { runLeadApplyBackfill } from "@/lib/backfill/lead-apply-backfill"

export const dynamic = "force-dynamic"

const MAX_WRITE_LIMIT = 100

export async function POST(request: Request): Promise<Response> {
  const auth = authorizeEmailBackfillRequest(request.headers)
  if (!auth.ok) {
    return new NextResponse(null, {
      status: auth.reason === "disabled" ? 404 : 401,
    })
  }

  const body = (await request
    .json()
    .catch(() => ({}))) as LeadApplyBackfillRequest
  const dryRun = body.dryRun ?? true
  if (!dryRun) {
    if (process.env.ALLOW_BACKFILL !== "true") {
      return NextResponse.json(
        {
          ok: false,
          error: "backfill-not-allowed",
          message: "Set ALLOW_BACKFILL=true for write-mode email backfills.",
        },
        { status: 409 }
      )
    }
    if (!body.runId) {
      return NextResponse.json(
        { ok: false, error: "run-id-required" },
        { status: 400 }
      )
    }
    if (body.limit === undefined) {
      return NextResponse.json(
        { ok: false, error: "limit-required" },
        { status: 400 }
      )
    }
    if (body.limit > MAX_WRITE_LIMIT) {
      return NextResponse.json(
        { ok: false, error: "limit-too-large", maxLimit: MAX_WRITE_LIMIT },
        { status: 400 }
      )
    }
  }

  try {
    const result = await runLeadApplyBackfill({
      request: { ...body, dryRun },
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 409 }
    )
  }
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
