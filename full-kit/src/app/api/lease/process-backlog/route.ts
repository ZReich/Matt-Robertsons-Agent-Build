import { NextResponse } from "next/server"

import { processBacklogClosedDeals } from "@/lib/ai/lease-pipeline-orchestrator"
import { constantTimeCompare } from "@/lib/msgraph/constant-time-compare"

export const dynamic = "force-dynamic"

export async function POST(req: Request): Promise<Response> {
  const adminToken = req.headers.get("x-admin-token") ?? ""
  const expected = process.env.MSGRAPH_TEST_ADMIN_TOKEN ?? ""
  if (!expected || !constantTimeCompare(adminToken, expected)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const result = await processBacklogClosedDeals({
    batchSize: typeof body.batchSize === "number" ? body.batchSize : 50,
    throttleMs: typeof body.throttleMs === "number" ? body.throttleMs : 250,
    maxBatches: typeof body.maxBatches === "number" ? body.maxBatches : 10,
    cursorKey: typeof body.cursorKey === "string" ? body.cursorKey : undefined,
  })
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
