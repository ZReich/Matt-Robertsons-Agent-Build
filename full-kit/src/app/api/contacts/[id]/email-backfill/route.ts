import { NextResponse } from "next/server"

import {
  BackfillAlreadyRunningError,
  backfillMailboxForContact,
} from "@/lib/contacts/mailbox-backfill"
import { requireApiUser } from "@/lib/api-route-auth"
import { db } from "@/lib/prisma"

const RATE_GUARD_WINDOW_MS = 10 * 60 * 1000

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params

  const recent = await db.backfillRun.findFirst({
    where: {
      contactId: id,
      startedAt: { gte: new Date(Date.now() - RATE_GUARD_WINDOW_MS) },
    },
    orderBy: { startedAt: "desc" },
  })
  if (recent) {
    const retryAfterSec = Math.ceil(
      (RATE_GUARD_WINDOW_MS - (Date.now() - recent.startedAt.getTime())) / 1000
    )
    return NextResponse.json(
      { error: "rate_limited", retryAfter: retryAfterSec, lastRunId: recent.id },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    )
  }

  try {
    const result = await backfillMailboxForContact(id, {
      mode: "lifetime",
      trigger: "ui",
    })
    return NextResponse.json(result)
  } catch (err) {
    // Concurrency safety net: the partial unique
    // `backfill_runs_one_running_per_contact` blocked a second simultaneous
    // run that raced past the `findFirst` rate-guard above. Surface as 429
    // identical to the rate-limit branch (no Retry-After hint — the prior
    // run could finish in seconds, the cooldown timer starts then).
    if (err instanceof BackfillAlreadyRunningError) {
      return NextResponse.json(
        { error: "rate_limited", reason: "already_running" },
        { status: 429 }
      )
    }
    throw err
  }
}
