import { NextResponse } from "next/server"

import {
  GraphError,
  constantTimeCompare,
  loadMsgraphConfig,
  runStoredEmailFilterAudit,
} from "@/lib/msgraph"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function optionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("expected non-negative integer")
  }
  return value
}

function optionalDate(value: unknown): Date | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "string") {
    throw new Error("expected ISO date string")
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid ISO date string")
  }
  return date
}

export async function POST(request: Request): Promise<Response> {
  let config
  try {
    config = loadMsgraphConfig()
  } catch {
    return new NextResponse(null, { status: 404 })
  }
  if (!config.testRouteEnabled) {
    return new NextResponse(null, { status: 404 })
  }

  const provided = request.headers.get("x-admin-token")
  if (!provided || !constantTimeCompare(provided, config.testAdminToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    cursorDate?: unknown
    cursorId?: unknown
    limit?: unknown
    offset?: unknown
    sampleEvery?: unknown
    snapshotDate?: unknown
  }

  try {
    const cursorDate = optionalDate(body.cursorDate)
    const cursorId =
      typeof body.cursorId === "string" && body.cursorId.length > 0
        ? body.cursorId
        : undefined
    if ((cursorDate && !cursorId) || (!cursorDate && cursorId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_request",
          message: "cursorDate and cursorId must be provided together",
        },
        { status: 400 }
      )
    }
    const result = await runStoredEmailFilterAudit({
      limit: optionalPositiveInteger(body.limit),
      offset: optionalPositiveInteger(body.offset),
      cursorDate,
      cursorId,
      sampleEvery: optionalPositiveInteger(body.sampleEvery),
      snapshotDate: optionalDate(body.snapshotDate),
      requestedBy: "msgraph-filter-audit-route",
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof GraphError) {
      return NextResponse.json(
        {
          ok: false,
          status: err.status,
          code: err.code,
          path: err.path,
          message: err.message,
        },
        { status: err.status >= 400 && err.status < 600 ? err.status : 500 }
      )
    }
    if (err instanceof Error && err.message.startsWith("expected")) {
      return NextResponse.json(
        { ok: false, error: "invalid_request", message: err.message },
        { status: 400 }
      )
    }
    if (err instanceof Error && err.message.startsWith("invalid")) {
      return NextResponse.json(
        { ok: false, error: "invalid_request", message: err.message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { ok: false, error: "unexpected", message: String(err) },
      { status: 500 }
    )
  }
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
