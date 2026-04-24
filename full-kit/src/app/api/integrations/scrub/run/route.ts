import { NextResponse } from "next/server"

import { authorizeScrubRequest, scrubEmailBatch } from "@/lib/ai"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(request: Request): Promise<Response> {
  const auth = authorizeScrubRequest(request.headers, undefined, {
    allowCron: true,
  })
  if (!auth.ok) {
    return new NextResponse(null, {
      status: auth.reason === "disabled" ? 404 : 401,
    })
  }

  const url = new URL(request.url)
  const limitRaw = url.searchParams.get("limit")
  const limit = limitRaw ? Math.min(100, Math.max(1, Number(limitRaw))) : 20
  const result = await scrubEmailBatch({ limit })
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
