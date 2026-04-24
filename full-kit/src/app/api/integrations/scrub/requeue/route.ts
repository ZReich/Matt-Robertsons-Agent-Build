import { NextResponse } from "next/server"

import { authorizeScrubRequest, requeueFailedScrubs } from "@/lib/ai"

export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const auth = authorizeScrubRequest(request.headers, undefined, {
    allowCron: false,
  })
  if (!auth.ok) {
    return new NextResponse(null, {
      status: auth.reason === "disabled" ? 404 : 401,
    })
  }
  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : undefined
  const result = await requeueFailedScrubs(ids)
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
