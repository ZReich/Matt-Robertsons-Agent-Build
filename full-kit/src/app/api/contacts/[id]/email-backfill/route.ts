import { NextResponse } from "next/server"

import {
  BackfillAlreadyRunningError,
  backfillMailboxForContact,
} from "@/lib/contacts/mailbox-backfill"
import { requireApiUser } from "@/lib/api-route-auth"
import { db } from "@/lib/prisma"

const RATE_GUARD_WINDOW_MS = 10 * 60 * 1000
// Backfill runs that have been "running" longer than this are considered
// abandoned (orchestrator died, request aborted, etc.) and reaped so that
// the partial unique on (contact_id) WHERE status='running' doesn't block
// the contact forever. Largest observed real-world run was ~67s; 15min
// gives 13x headroom.
const STUCK_RUN_THRESHOLD_MS = 15 * 60 * 1000

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params

  // Reap any abandoned `running` rows for this contact before checking the
  // rate-guard. Without this, a single aborted request (e.g., browser fetch
  // cancelled) leaves the BackfillRun row stuck in `running` forever and
  // every future "Scan mailbox" click hits the partial unique constraint.
  await db.backfillRun.updateMany({
    where: {
      contactId: id,
      status: "running",
      startedAt: { lt: new Date(Date.now() - STUCK_RUN_THRESHOLD_MS) },
    },
    data: {
      status: "failed",
      finishedAt: new Date(),
      errorMessage: "abandoned_no_finalize",
    },
  })

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
