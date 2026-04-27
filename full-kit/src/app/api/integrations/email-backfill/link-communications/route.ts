import { NextResponse } from "next/server"

import type { LinkBackfillRequest } from "@/lib/backfill/communication-linker"

import { runCommunicationLinkBackfill } from "@/lib/backfill/communication-linker"
import { authorizeEmailBackfillRequest } from "@/lib/backfill/email-backfill-auth"

export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const auth = authorizeEmailBackfillRequest(request.headers)
  if (!auth.ok) {
    return new NextResponse(null, {
      status: auth.reason === "disabled" ? 404 : 401,
    })
  }

  const body = (await request.json().catch(() => ({}))) as LinkBackfillRequest
  const dryRun = body.dryRun ?? true
  if (!dryRun && process.env.ALLOW_BACKFILL !== "true") {
    return NextResponse.json(
      {
        ok: false,
        error: "backfill-not-allowed",
        message: "Set ALLOW_BACKFILL=true for write-mode email backfills.",
      },
      { status: 409 }
    )
  }

  const result = await runCommunicationLinkBackfill({
    request: { ...body, dryRun },
  })
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
