import { NextResponse } from "next/server"

import {
  ScrubBudgetError,
  assertWithinScrubBudget,
} from "@/lib/ai/budget-tracker"
import { scrubEmailBatch } from "@/lib/ai/scrub"
import { PROMPT_VERSION } from "@/lib/ai/scrub-types"
import { db } from "@/lib/prisma"
import {
  ReviewerAuthError,
  assertJsonRequest,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const maxDuration = 300

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    assertJsonRequest(request)
    await requireAgentReviewer()
  } catch (error) {
    if (error instanceof ReviewerAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }

  const body = (await request.json()) as {
    entityType?: unknown
    entityId?: unknown
    confirmReprocess?: unknown
  }
  if (
    (body.entityType !== "contact" && body.entityType !== "deal") ||
    typeof body.entityId !== "string"
  ) {
    return NextResponse.json({ error: "invalid entity" }, { status: 400 })
  }

  const where =
    body.entityType === "deal"
      ? { dealId: body.entityId }
      : { contactId: body.entityId }
  const communications = await db.communication.findMany({
    where,
    orderBy: { date: "desc" },
    take: 50,
    select: {
      id: true,
      metadata: true,
      scrubQueue: { select: { status: true } },
    },
  })
  let enqueued = 0
  let alreadyCurrent = 0
  let pending = 0
  const toEnqueue: string[] = []

  for (const communication of communications) {
    const scrub = getScrub(communication.metadata)
    if (scrub?.promptVersion === PROMPT_VERSION) {
      alreadyCurrent += 1
      continue
    }
    if (
      communication.scrubQueue?.status === "pending" ||
      communication.scrubQueue?.status === "in_flight"
    ) {
      pending += 1
      continue
    }
    if (scrub && body.confirmReprocess !== true) {
      return NextResponse.json(
        {
          code: "reprocess_requires_confirmation",
          currentPromptVersion: scrub.promptVersion ?? "unknown",
          requestedPromptVersion: PROMPT_VERSION,
        },
        { status: 400 }
      )
    }
    toEnqueue.push(communication.id)
  }

  if (toEnqueue.length > 0) {
    try {
      await assertWithinScrubBudget()
    } catch (error) {
      if (error instanceof ScrubBudgetError) {
        return NextResponse.json(
          {
            error: "scrub budget exceeded",
            code: "scrub_budget_exceeded",
            resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          { status: 429 }
        )
      }
      throw error
    }
  }

  // Race-safe enqueue: between the SELECT above and this loop, a row could
  // have flipped from "failed"/"done" → "pending"/"in_flight" (a worker
  // re-claimed it, a cron requeued it). Unconditional upsert would stomp
  // the new lease and let two workers double-scrub the same comm. So we:
  //   1) Try to create a brand-new row (race-loses → unique-constraint error).
  //   2) On constraint violation, conditionally requeue ONLY if the row is
  //      still in "failed" or "done" — leaves "pending"/"in_flight" alone.
  for (const communicationId of toEnqueue) {
    try {
      await db.scrubQueue.create({
        data: { communicationId, status: "pending" },
      })
      enqueued += 1
      continue
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as { code: unknown }).code
          : null
      if (code !== "P2002") throw error // not a unique-constraint violation
    }
    const updated = await db.scrubQueue.updateMany({
      where: {
        communicationId,
        status: { in: ["failed", "done"] },
      },
      data: {
        status: "pending",
        attempts: 0,
        lockedUntil: null,
        leaseToken: null,
        lastError: null,
      },
    })
    if (updated.count > 0) {
      enqueued += 1
    } else {
      // Row was claimed by a worker between our SELECT and this update; it
      // will get processed without our help. Don't stomp.
      pending += 1
    }
  }

  // Scope the synchronous batch to the communications we just enqueued for
  // this contact. Without communicationIds, scrubEmailBatch would claim the
  // next N globally-pending rows and the toast would report counts unrelated
  // to what the user clicked.
  const batch =
    enqueued > 0
      ? await scrubEmailBatch({
          limit: Math.min(enqueued, 5),
          communicationIds: toEnqueue,
        })
      : null

  return NextResponse.json({
    ok: true,
    enqueued,
    pending,
    alreadyCurrent,
    processed: batch?.processed ?? 0,
    succeeded: batch?.succeeded ?? 0,
    failed: batch?.failed ?? 0,
    batchStatus: batch?.status ?? null,
  })
}

function getScrub(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  const scrub = (metadata as Record<string, unknown>).scrub
  if (!scrub || typeof scrub !== "object" || Array.isArray(scrub)) return null
  return scrub as Record<string, unknown>
}
