import { NextResponse } from "next/server"

import {
  authorizeScrubRequest,
  backfillScrubQueue,
  isCachingLive,
} from "@/lib/ai"

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
  const dryRun =
    typeof body === "object" &&
    body !== null &&
    "dryRun" in body &&
    typeof body.dryRun === "boolean"
      ? body.dryRun
      : true

  if (!dryRun && !body?.runId) {
    return NextResponse.json(
      {
        ok: false,
        error: "run-id-required",
        message: "runId is required when dryRun=false.",
      },
      { status: 400 }
    )
  }
  if (!dryRun && typeof body?.limit !== "number") {
    return NextResponse.json(
      {
        ok: false,
        error: "limit-required",
        message: "limit is required when dryRun=false.",
      },
      { status: 400 }
    )
  }
  if (
    !dryRun &&
    process.env.NODE_ENV !== "development" &&
    process.env.ALLOW_BACKFILL !== "true"
  ) {
    return new NextResponse(null, { status: 404 })
  }

  if (!dryRun) {
    // Spec "Caching threshold" guard: if caching isn't engaging on recent
    // scrubs, a backfill run will cost 3-4x projected. Refuse write-mode
    // enqueue until prompt padding / length is fixed and the warning clears.
    const cachingLive = await isCachingLive()
    if (!cachingLive) {
      return NextResponse.json(
        {
          ok: false,
          error: "caching-not-live",
          message:
            "Recent scrub calls show cache_read_tokens=0. Backfill refuses to run while caching is not engaging (would cost 3-4x projected). Fix SYSTEM_PROMPT length / padding and clear the warning by running a small /run batch first.",
        },
        { status: 409 }
      )
    }
  }

  const result = await backfillScrubQueue({
    dryRun,
    limit: typeof body?.limit === "number" ? body.limit : undefined,
    cursor: typeof body?.cursor === "string" ? body.cursor : null,
    runId: typeof body?.runId === "string" ? body.runId : undefined,
  })
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
