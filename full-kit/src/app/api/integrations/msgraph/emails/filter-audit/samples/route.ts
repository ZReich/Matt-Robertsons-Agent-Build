import { NextResponse } from "next/server"

import {
  buildEmailFilterAuditSampleCsv,
  constantTimeCompare,
  listEmailFilterAuditSamples,
  loadMsgraphConfig,
} from "@/lib/msgraph"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function optionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error("expected positive integer")
  }
  return value
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string" && item.length > 0)
  ) {
    throw new Error("expected string array")
  }
  return value
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
    format?: unknown
    latestRunCount?: unknown
    perBucketLimit?: unknown
    reviewPackLimit?: unknown
    runIds?: unknown
  }

  try {
    const report = await listEmailFilterAuditSamples({
      runIds: optionalStringArray(body.runIds),
      latestRunCount: optionalPositiveInteger(body.latestRunCount),
      perBucketLimit: optionalPositiveInteger(body.perBucketLimit),
      reviewPackLimit: optionalPositiveInteger(body.reviewPackLimit),
    })

    if (body.format === "csv") {
      return new NextResponse(buildEmailFilterAuditSampleCsv(report), {
        headers: {
          "content-disposition":
            'attachment; filename="email-filter-audit-review-samples.csv"',
          "content-type": "text/csv; charset=utf-8",
        },
      })
    }

    return NextResponse.json({ ok: true, ...report })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("expected")) {
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
