import { NextResponse } from "next/server"

import type { LeadDiagnosticRequest } from "@/lib/backfill/lead-extractor-diagnostics"

import { authorizeEmailBackfillRequest } from "@/lib/backfill/email-backfill-auth"
import { runLeadExtractorDiagnostics } from "@/lib/backfill/lead-extractor-diagnostics"

export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const auth = authorizeEmailBackfillRequest(request.headers)
  if (!auth.ok) {
    return new NextResponse(null, {
      status: auth.reason === "disabled" ? 404 : 401,
    })
  }

  const body = (await request.json().catch(() => ({}))) as LeadDiagnosticRequest
  const result = await runLeadExtractorDiagnostics({ request: body })
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
