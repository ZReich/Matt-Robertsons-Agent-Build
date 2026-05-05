import { randomUUID } from "node:crypto"

import { Prisma } from "@prisma/client"

import type { PrismaClient } from "@prisma/client"
import type { ClaimedScrubQueueRow } from "./scrub-types"

import { db } from "@/lib/prisma"

import { isSensitiveRoutingEnabled } from "./scrub-provider"
import { containsSensitiveContent } from "./sensitive-filter"

type DbLike =
  | PrismaClient
  | Parameters<Parameters<typeof db.$transaction>[0]>[0]
type Classification = "signal" | "uncertain" | "noise" | string

type RawClaimedRow = {
  id: string
  communication_id: string
}

export async function enqueueScrubForCommunicationIfMissing(
  tx: DbLike,
  communicationId: string,
  classification: Classification
): Promise<void> {
  await enqueueScrubForCommunicationInternal(
    tx,
    communicationId,
    classification,
    {
      skipDuplicates: true,
    }
  )
}

export async function enqueueScrubForCommunication(
  tx: DbLike,
  communicationId: string,
  classification: Classification
): Promise<void> {
  await enqueueScrubForCommunicationInternal(
    tx,
    communicationId,
    classification,
    {
      skipDuplicates: false,
    }
  )
}

async function enqueueScrubForCommunicationInternal(
  tx: DbLike,
  communicationId: string,
  classification: Classification,
  opts: { skipDuplicates: boolean }
): Promise<void> {
  if (classification !== "signal" && classification !== "uncertain") return

  // Sensitive-content gate (Matt's call 2026-04-30/05-01): emails containing
  // financial / banking / SSN-shaped content are skipped from AI processing
  // entirely rather than routed to a different model. False positives just
  // mean a single email isn't AI-enriched — the user can still see it in the
  // inbox and act manually.
  const comm = await tx.communication.findUnique({
    where: { id: communicationId },
    select: { subject: true, body: true, metadata: true },
  })
  if (comm) {
    const meta =
      comm.metadata &&
      typeof comm.metadata === "object" &&
      !Array.isArray(comm.metadata)
        ? (comm.metadata as Record<string, unknown>)
        : {}
    const isPlaudTranscript = meta.source === "plaud"
    const sensitivity = isPlaudTranscript
      ? { tripped: false, reasons: [] }
      : containsSensitiveContent(comm.subject, comm.body)
    if (sensitivity.tripped) {
      // Two paths depending on opt-in flag:
      //  - default (flag off): skip entirely. The email's body never reaches
      //    any AI provider. Status="skipped_sensitive".
      //  - opt-in (flag on, ANTHROPIC_API_KEY set): enqueue normally; the
      //    worker will re-check sensitivity at claim time and route to
      //    Haiku via scrubWithSensitiveProvider, keeping the body off
      //    DeepSeek (a non-US model).
      if (!isSensitiveRoutingEnabled()) {
        const data = {
          communicationId,
          status: "skipped_sensitive" as const,
          lastError: `sensitive_filter: ${sensitivity.reasons.slice(0, 3).join(", ")}`,
        }
        if (opts.skipDuplicates) {
          await tx.scrubQueue.upsert({
            where: { communicationId },
            create: data,
            update: data,
          })
        } else {
          await tx.scrubQueue.create({ data })
        }
        return
      }
      // Fall through to enqueue. The worker re-checks at scrubOne time.
    }
  }

  const data = { communicationId, status: "pending" as const }
  if (opts.skipDuplicates) {
    await tx.scrubQueue.upsert({
      where: { communicationId },
      create: data,
      update: {
        status: "pending",
        lockedUntil: null,
        leaseToken: null,
        lastError: null,
      },
    })
  } else {
    await tx.scrubQueue.create({ data })
  }
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

  // Bump the per-transaction timeout from Prisma's 5s default — at large
  // batch sizes (e.g. drain endpoint with 50 rows) the per-row UPDATE loop
  // legitimately takes longer than 5s on the pooled Supabase connection.
  // 30s gives 6x headroom even for the largest claim slice we permit.
  return db.$transaction(
    async (tx) => {
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
    },
    { timeout: 30_000 }
  )
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

export type ScrubCoverageStats = {
  communications: {
    total: number
    scrubbed: number
    unscrubbed: number
    linkedToContact: number
    orphaned: number
    byClassification: Record<string, number>
  }
  queue: Record<string, number>
  neverQueued: {
    total: number
    missedEligible: number
    intentionallySkipped: number
    byClassification: Record<string, number>
  }
  contactCandidates: {
    total: number
    byStatus: Record<string, number>
  }
  todos: {
    open: number
    pendingMarkDoneActions: number
  }
}

type CountRow = { count: number | bigint }
type NamedCountRow = { name: string | null; count: number | bigint }

export async function getScrubCoverageStats(): Promise<ScrubCoverageStats> {
  const [
    communicationRows,
    classificationRows,
    queueStats,
    neverQueuedRows,
    contactCandidateRows,
    todoRows,
  ] = await Promise.all([
    db.$queryRaw<
      Array<{
        total: number | bigint
        scrubbed: number | bigint
        linked_to_contact: number | bigint
      }>
    >`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE metadata->'scrub' IS NOT NULL)::bigint AS scrubbed,
        COUNT(*) FILTER (WHERE contact_id IS NOT NULL)::bigint AS linked_to_contact
      FROM communications
    `,
    db.$queryRaw<NamedCountRow[]>`
      SELECT CASE
               WHEN metadata->>'classification' IN ('signal', 'uncertain', 'noise')
                 THEN metadata->>'classification'
               WHEN metadata->>'classification' IS NULL
                 THEN 'unclassified'
               ELSE 'other'
             END AS name,
             COUNT(*)::bigint AS count
      FROM communications
      GROUP BY 1
      ORDER BY 2 DESC
    `,
    getScrubQueueStats(),
    db.$queryRaw<NamedCountRow[]>`
      SELECT CASE
               WHEN c.metadata->>'classification' IN ('signal', 'uncertain', 'noise')
                 THEN c.metadata->>'classification'
               WHEN c.metadata->>'classification' IS NULL
                 THEN 'unclassified'
               ELSE 'other'
             END AS name,
             COUNT(*)::bigint AS count
      FROM communications c
      LEFT JOIN scrub_queue sq ON sq.communication_id = c.id
      WHERE sq.id IS NULL
      GROUP BY 1
      ORDER BY 2 DESC
    `,
    db.contactPromotionCandidate.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.$queryRaw<
      Array<{
        open: number | bigint
        pending_mark_done_actions: number | bigint
      }>
    >`
      SELECT
        (SELECT COUNT(*)::bigint
          FROM todos
          WHERE archived_at IS NULL
            AND status::text IN ('pending', 'in_progress')) AS open,
        (SELECT COUNT(*)::bigint
           FROM agent_actions
          WHERE status::text = 'pending'
            AND action_type = 'mark-todo-done') AS pending_mark_done_actions
    `,
  ])

  const communication = communicationRows[0] ?? {
    total: 0,
    scrubbed: 0,
    linked_to_contact: 0,
  }
  const neverQueuedByClassification = toCountRecord(neverQueuedRows)
  const neverQueuedTotal = Object.values(neverQueuedByClassification).reduce(
    (sum, count) => sum + count,
    0
  )
  const neverQueuedMissedEligible =
    (neverQueuedByClassification.signal ?? 0) +
    (neverQueuedByClassification.uncertain ?? 0) +
    (neverQueuedByClassification.unclassified ?? 0) +
    (neverQueuedByClassification.other ?? 0)
  const neverQueuedIntentionallySkipped = neverQueuedByClassification.noise ?? 0
  const total = toNumber(communication.total)
  const scrubbed = toNumber(communication.scrubbed)
  const linkedToContact = toNumber(communication.linked_to_contact)
  const todoCounts = todoRows[0] ?? {
    open: 0,
    pending_mark_done_actions: 0,
  }

  return {
    communications: {
      total,
      scrubbed,
      unscrubbed: Math.max(0, total - scrubbed),
      linkedToContact,
      orphaned: Math.max(0, total - linkedToContact),
      byClassification: toCountRecord(classificationRows),
    },
    queue: queueStats.queue,
    neverQueued: {
      total: neverQueuedTotal,
      missedEligible: neverQueuedMissedEligible,
      intentionallySkipped: neverQueuedIntentionallySkipped,
      byClassification: neverQueuedByClassification,
    },
    contactCandidates: {
      total: contactCandidateRows.reduce(
        (sum, row) => sum + row._count.status,
        0
      ),
      byStatus: Object.fromEntries(
        contactCandidateRows.map((row) => [row.status, row._count.status])
      ),
    },
    todos: {
      open: toNumber(todoCounts.open),
      pendingMarkDoneActions: toNumber(todoCounts.pending_mark_done_actions),
    },
  }
}

function toCountRecord(rows: NamedCountRow[]): Record<string, number> {
  return Object.fromEntries(
    rows.map((row) => [row.name ?? "unknown", toNumber(row.count)])
  )
}

function toNumber(value: CountRow["count"]): number {
  return typeof value === "bigint" ? Number(value) : value
}
