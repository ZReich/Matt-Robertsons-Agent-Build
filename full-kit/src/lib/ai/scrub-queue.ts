import { randomUUID } from "node:crypto"

import { Prisma } from "@prisma/client"

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
  communicationIds,
}: {
  limit?: number
  leaseMs?: number
  /**
   * If provided, restricts the claim to these communication ids. An explicit
   * empty array claims nothing — used when callers want to scope a batch to a
   * known set of just-enqueued rows (e.g. the per-contact "Process with AI"
   * button) rather than draining the global pending queue.
   */
  communicationIds?: string[]
} = {}): Promise<ClaimedScrubQueueRow[]> {
  if (communicationIds && communicationIds.length === 0) return []

  const idFilter =
    communicationIds && communicationIds.length > 0
      ? Prisma.sql`AND communication_id IN (${Prisma.join(communicationIds)})`
      : Prisma.empty

  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<RawClaimedRow[]>`
      SELECT id, communication_id
        FROM scrub_queue
       WHERE (status = 'pending'
          OR (status = 'in_flight' AND locked_until < NOW()))
       ${idFilter}
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

export type BackfillScrubQueueOptions = {
  dryRun?: boolean
  limit?: number
  cursor?: string | null
  runId?: string
}

export type BackfillScrubQueueResult = {
  dryRun: boolean
  runId: string
  eligible: number
  enqueued: number
  nextCursor: string | null
  sampledIds: string[]
}

const DEFAULT_BACKFILL_LIMIT = 500
const MAX_BACKFILL_LIMIT = 1000

export async function backfillScrubQueue({
  dryRun = true,
  limit,
  cursor = null,
  runId = `scrub-enqueue-${new Date().toISOString()}`,
}: BackfillScrubQueueOptions = {}): Promise<BackfillScrubQueueResult> {
  if (!dryRun && limit === undefined) {
    throw new Error("limit is required when dryRun=false")
  }
  const configuredMaxLimit = readScrubBackfillMaxLimit()
  const requestedLimit = limit ?? DEFAULT_BACKFILL_LIMIT
  const safeLimit = Math.min(
    Math.max(
      Math.trunc(
        Number.isFinite(requestedLimit)
          ? requestedLimit
          : DEFAULT_BACKFILL_LIMIT
      ),
      1
    ),
    configuredMaxLimit
  )
  if (!dryRun && !runId) {
    throw new Error("runId is required when dryRun=false")
  }

  const cursorClause = cursor ? Prisma.sql`AND c.id > ${cursor}` : Prisma.empty
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT c.id
      FROM communications c
     WHERE c.metadata->>'classification' IN ('signal', 'uncertain')
       AND c.metadata->'scrub' IS NULL
       ${cursorClause}
       AND NOT EXISTS (
         SELECT 1 FROM scrub_queue sq WHERE sq.communication_id = c.id
       )
     ORDER BY c.id ASC
     LIMIT ${safeLimit}
  `
  const result: BackfillScrubQueueResult = {
    dryRun,
    runId,
    eligible: rows.length,
    enqueued: 0,
    nextCursor: rows.length === safeLimit ? (rows.at(-1)?.id ?? null) : null,
    sampledIds: rows.slice(0, 20).map((row) => row.id),
  }
  if (rows.length === 0 || dryRun) return result
  const created = await db.scrubQueue.createMany({
    data: rows.map((row) => ({
      communicationId: row.id,
      status: "pending" as const,
    })),
    skipDuplicates: true,
  })
  await db.systemState.upsert({
    where: { key: `scrub_backfill_run:${runId}` },
    create: {
      key: `scrub_backfill_run:${runId}`,
      value: {
        runId,
        enqueued: created.count,
        eligible: rows.length,
        limit: safeLimit,
        cursor,
        nextCursor: result.nextCursor,
        at: new Date().toISOString(),
      },
    },
    update: {
      value: {
        runId,
        enqueued: created.count,
        eligible: rows.length,
        limit: safeLimit,
        cursor,
        nextCursor: result.nextCursor,
        at: new Date().toISOString(),
      },
    },
  })
  return { ...result, enqueued: created.count }
}

function readScrubBackfillMaxLimit(
  env: Record<string, string | undefined> = process.env
): number {
  const parsed = Number.parseInt(env.SCRUB_BACKFILL_MAX_ENQUEUE_LIMIT ?? "", 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, MAX_BACKFILL_LIMIT)
  }
  return DEFAULT_BACKFILL_LIMIT
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
