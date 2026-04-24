import { randomUUID } from "node:crypto"

import type { PrismaClient } from "@prisma/client"
import type { ClaimedScrubQueueRow } from "./scrub-types"

import { db } from "@/lib/prisma"

type DbLike =
  | PrismaClient
  | Parameters<Parameters<typeof db.$transaction>[0]>[0]
type Classification = "signal" | "uncertain" | "noise" | string

type RawClaimedRow = {
  id: string
  communication_id: string
}

export async function enqueueScrubForCommunication(
  tx: DbLike,
  communicationId: string,
  classification: Classification
): Promise<void> {
  if (classification !== "signal" && classification !== "uncertain") return
  await tx.scrubQueue.create({
    data: { communicationId, status: "pending" },
  })
}

export async function claimScrubQueueRows({
  limit = 20,
  leaseMs = 5 * 60 * 1000,
}: {
  limit?: number
  leaseMs?: number
} = {}): Promise<ClaimedScrubQueueRow[]> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<RawClaimedRow[]>`
      SELECT id, communication_id
        FROM scrub_queue
       WHERE status = 'pending'
          OR (status = 'in_flight' AND locked_until < NOW())
       ORDER BY enqueued_at ASC
       LIMIT ${limit}
       FOR UPDATE SKIP LOCKED
    `
    if (rows.length === 0) return []

    // Rotate a fresh lease token PER ROW so the fencing primitive stays
    // per-row-unique — two workers claiming different rows must never
    // share a token, and two successive claims of the same row must
    // produce different tokens.
    const lockedUntil = new Date(Date.now() + leaseMs)
    const claims: ClaimedScrubQueueRow[] = []
    for (const row of rows) {
      const leaseToken = randomUUID()
      await tx.scrubQueue.update({
        where: { id: row.id },
        data: {
          status: "in_flight",
          lockedUntil,
          leaseToken,
          attempts: { increment: 1 },
        },
      })
      claims.push({
        id: row.id,
        communicationId: row.communication_id,
        leaseToken,
      })
    }
    return claims
  })
}

export async function markScrubQueueFailed(
  queueRowId: string,
  message: string
): Promise<void> {
  await db.scrubQueue.update({
    where: { id: queueRowId },
    data: {
      status: "failed",
      lockedUntil: null,
      leaseToken: null,
      lastError: message.slice(0, 2048),
    },
  })
}

export async function backfillScrubQueue(): Promise<{ enqueued: number }> {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT c.id
      FROM communications c
     WHERE c.metadata->>'classification' IN ('signal', 'uncertain')
       AND c.metadata->'scrub' IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM scrub_queue sq WHERE sq.communication_id = c.id
       )
  `
  if (rows.length === 0) return { enqueued: 0 }
  await db.scrubQueue.createMany({
    data: rows.map((row) => ({
      communicationId: row.id,
      status: "pending" as const,
    })),
    skipDuplicates: true,
  })
  return { enqueued: rows.length }
}

export async function requeueFailedScrubs(
  ids?: string[]
): Promise<{ requeued: number }> {
  const result = await db.scrubQueue.updateMany({
    where: ids?.length ? { id: { in: ids } } : { status: "failed" },
    data: {
      status: "pending",
      attempts: 0,
      lockedUntil: null,
      leaseToken: null,
      lastError: null,
    },
  })
  return { requeued: result.count }
}

export async function getScrubQueueStats(): Promise<{
  queue: Record<string, number>
}> {
  const grouped = await db.scrubQueue.groupBy({
    by: ["status"],
    _count: { status: true },
  })
  return {
    queue: Object.fromEntries(
      grouped.map((row) => [row.status, row._count.status])
    ),
  }
}
