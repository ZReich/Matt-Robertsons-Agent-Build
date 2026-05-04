import { NextResponse } from "next/server"

import { scrubEmailBatch } from "@/lib/ai/scrub"
import { requireApiUser } from "@/lib/api-route-auth"
import { db } from "@/lib/prisma"

/**
 * Per-contact "drain pending" endpoint. The /api/ai-suggestions/process
 * route only handles ~5 newly-enqueued rows per click and skips already-
 * pending — operators draining a backfilled contact need to chew through
 * the queue without manually clicking until the count hits zero.
 *
 * Strategy: load all pending scrub-queue rows for this contact, then call
 * scrubEmailBatch in slices of up to PER_BATCH until empty or until
 * MAX_BATCHES iterations cap is hit. Each scrubEmailBatch call internally
 * processes its slice with concurrency=5 (see scrub.ts).
 */

const PER_BATCH = 200
const MAX_BATCHES = 5 // upper bound: 1000 messages per call
// Generous max-duration so a full 1000-message drain has runway. Each
// scrubEmailBatch slice does up to PER_BATCH provider calls, with internal
// concurrency=5 — call it ~1.5s per message worst-case = 5 minutes for the
// max. Vercel hard cap is 5 minutes on Pro for non-streaming; allow up to
// the cap so we don't truncate mid-drain.
export const maxDuration = 300

type DrainSummary = {
  totalProcessed: number
  totalSucceeded: number
  totalFailed: number
  batches: number
  reachedCap: boolean
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params

  // Verify the contact exists. A 404 here is more useful to the operator
  // than silently draining zero rows for a typo'd id.
  const contact = await db.contact.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!contact) {
    return NextResponse.json({ error: "contact_not_found" }, { status: 404 })
  }

  let totalProcessed = 0
  let totalSucceeded = 0
  let totalFailed = 0
  let batches = 0
  let reachedCap = false

  for (let i = 0; i < MAX_BATCHES; i += 1) {
    // Re-query each iteration: prior batches may have transitioned rows out
    // of `pending`, and parallel UI clicks could have moved others in. Order
    // doesn't matter — scrubEmailBatch will claim atomically — we just need
    // a non-empty list to seed the next call.
    const pending = await db.scrubQueue.findMany({
      where: {
        status: "pending",
        communication: { contactId: id },
      },
      select: { communicationId: true },
      take: PER_BATCH,
    })
    if (pending.length === 0) break

    const summary = await scrubEmailBatch({
      communicationIds: pending.map((p) => p.communicationId),
      limit: PER_BATCH,
    })
    batches += 1
    totalProcessed += summary.processed
    totalSucceeded += summary.succeeded
    totalFailed += summary.failed

    // If a batch claimed zero rows (e.g. another worker raced us, or budget
    // cap hit), stop — looping further would just spin.
    if (summary.processed === 0) break

    // After the loop guard increments to MAX_BATCHES, mark we hit the cap
    // only if there's still work left to do.
    if (i === MAX_BATCHES - 1) {
      const stillPending = await db.scrubQueue.count({
        where: {
          status: "pending",
          communication: { contactId: id },
        },
      })
      if (stillPending > 0) reachedCap = true
    }
  }

  const result: DrainSummary = {
    totalProcessed,
    totalSucceeded,
    totalFailed,
    batches,
    reachedCap,
  }
  return NextResponse.json(result)
}
