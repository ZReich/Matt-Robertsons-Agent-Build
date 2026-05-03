import { NextResponse } from "next/server"

import { GraphError, constantTimeCompare, loadMsgraphConfig } from "@/lib/msgraph"
import { runEmailHistoryBackfill } from "@/lib/msgraph/email-history-backfill"

import type { EmailFolder } from "@/lib/msgraph/email-types"

export const dynamic = "force-dynamic" // never cache

interface RequestBody {
  startMonth?: unknown
  endMonth?: unknown
  folder?: unknown
  maxBatches?: unknown
}

const ALLOWED_FOLDERS: ReadonlySet<EmailFolder> = new Set<EmailFolder>([
  "inbox",
  "sentitems",
])

const MONTH_RE = /^\d{4}-\d{2}$/

export async function POST(request: Request): Promise<Response> {
  // 1. Kill switch — 404 if feature flag not explicitly "true" OR config fails to load.
  let config
  try {
    config = loadMsgraphConfig()
  } catch {
    return new NextResponse(null, { status: 404 })
  }
  if (!config.testRouteEnabled) {
    return new NextResponse(null, { status: 404 })
  }

  // 2. Auth — constant-time compare of x-admin-token.
  const provided = request.headers.get("x-admin-token")
  if (!provided || !constantTimeCompare(provided, config.testAdminToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    )
  }

  // 3. Body parse + validate.
  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "expected JSON body" },
      { status: 400 }
    )
  }

  if (typeof body.startMonth !== "string" || !MONTH_RE.test(body.startMonth)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_body",
        message: "startMonth must be a YYYY-MM string",
      },
      { status: 400 }
    )
  }
  if (typeof body.endMonth !== "string" || !MONTH_RE.test(body.endMonth)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_body",
        message: "endMonth must be a YYYY-MM string",
      },
      { status: 400 }
    )
  }

  let folder: EmailFolder = "inbox"
  if (body.folder !== undefined) {
    if (
      typeof body.folder !== "string" ||
      !ALLOWED_FOLDERS.has(body.folder as EmailFolder)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_body",
          message: "folder must be 'inbox' or 'sentitems'",
        },
        { status: 400 }
      )
    }
    folder = body.folder as EmailFolder
  }

  let maxBatches: number | undefined
  if (body.maxBatches !== undefined) {
    if (
      typeof body.maxBatches !== "number" ||
      !Number.isFinite(body.maxBatches) ||
      body.maxBatches < 1 ||
      body.maxBatches > 1000
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_body",
          message: "maxBatches must be an integer between 1 and 1000",
        },
        { status: 400 }
      )
    }
    maxBatches = Math.floor(body.maxBatches)
  }

  // 4. Handler.
  try {
    const result = await runEmailHistoryBackfill({
      startMonth: body.startMonth,
      endMonth: body.endMonth,
      folder,
      maxBatches,
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
    return NextResponse.json(
      {
        ok: false,
        error: "unexpected",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
