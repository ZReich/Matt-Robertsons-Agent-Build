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
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.ALLOW_BACKFILL !== "true"
  ) {
    return new NextResponse(null, { status: 404 })
  }

  // Spec "Caching threshold" guard: if caching isn't engaging on recent
  // scrubs, a backfill run will cost 3-4x projected. Refuse to run until
  // prompt padding / length is fixed and the warning clears.
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

  const result = await backfillScrubQueue()
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
