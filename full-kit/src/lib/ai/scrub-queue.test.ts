import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  backfillScrubQueue,
  claimScrubQueueRows,
  enqueueScrubForCommunication,
  enqueueScrubForCommunicationIfMissing,
  getScrubCoverageStats,
} from "./scrub-queue"

vi.mock("@/lib/prisma", () => ({
  db: {
    scrubQueue: {
      createMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    // Sensitive-content gate (added 2026-05-01) reads subject+body from the
    // Communication before enqueuing. Default mock returns null, which the
    // gate treats as "skip the gate, proceed to enqueue".
    communication: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    contactPromotionCandidate: { groupBy: vi.fn() },
    systemState: {
      upsert: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}))

describe("scrub-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(db.$transaction as ReturnType<typeof vi.fn>).mockImplementation((fn) =>
      fn(db)
    )
  })

  it("enqueues only signal and uncertain communications", async () => {
    await enqueueScrubForCommunication(db, "comm-1", "signal")
    await enqueueScrubForCommunication(db, "comm-2", "uncertain")
    await enqueueScrubForCommunication(db, "comm-3", "noise")

    expect(db.scrubQueue.create).toHaveBeenCalledTimes(2)
    expect(db.scrubQueue.create).toHaveBeenCalledWith({
      data: { communicationId: "comm-1", status: "pending" },
    })
  })

  it("enqueues Plaud transcripts for scrub even when transcript text trips sensitive keywords", async () => {
    ;(
      db.communication.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      subject: "wire transfer",
      body: "routing number and bank account discussion",
      metadata: { source: "plaud" },
    })

    await enqueueScrubForCommunicationIfMissing(db, "comm-plaud", "signal")

    expect(db.scrubQueue.upsert).toHaveBeenCalledWith({
      where: { communicationId: "comm-plaud" },
      create: { communicationId: "comm-plaud", status: "pending" },
      update: {
        status: "pending",
        lockedUntil: null,
        leaseToken: null,
        lastError: null,
      },
    })
    expect(db.scrubQueue.create).not.toHaveBeenCalled()
  })

  it("revives existing failed or sensitive queue rows when attaching a Plaud transcript", async () => {
    ;(
      db.communication.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      subject: "wire transfer",
      body: "routing number and bank account discussion",
      metadata: { source: "plaud" },
    })

    await enqueueScrubForCommunicationIfMissing(db, "comm-stuck", "signal")

    expect(db.scrubQueue.upsert).toHaveBeenCalledWith({
      where: { communicationId: "comm-stuck" },
      create: { communicationId: "comm-stuck", status: "pending" },
      update: {
        status: "pending",
        lockedUntil: null,
        leaseToken: null,
        lastError: null,
      },
    })
  })

  it("rotates a lease token while claiming rows", async () => {
    ;(db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "queue-1", communication_id: "comm-1" },
    ])

    const claimed = await claimScrubQueueRows({ limit: 1 })

    expect(claimed).toHaveLength(1)
    expect(claimed[0]?.leaseToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(db.scrubQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "queue-1" },
        data: expect.objectContaining({
          status: "in_flight",
          leaseToken: claimed[0]?.leaseToken,
          attempts: { increment: 1 },
        }),
      })
    )
  })

  it("scopes the claim to the requested communicationIds when provided", async () => {
    ;(db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "queue-1", communication_id: "comm-1" },
    ])

    await claimScrubQueueRows({ limit: 5, communicationIds: ["comm-1"] })

    const sql = JSON.stringify(
      (db.$queryRaw as ReturnType<typeof vi.fn>).mock.calls[0]
    )
    expect(sql).toContain("communication_id")
    expect(sql).toContain("comm-1")
  })

  it("returns no rows for an empty communicationIds filter without hitting the DB", async () => {
    const result = await claimScrubQueueRows({
      limit: 5,
      communicationIds: [],
    })

    expect(result).toEqual([])
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })

  it("issues DISTINCT lease tokens per row in a multi-row claim", async () => {
    // This is the spec's rev-log #1: per-row tokens, not one batch-wide token.
    ;(db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "queue-1", communication_id: "comm-1" },
      { id: "queue-2", communication_id: "comm-2" },
      { id: "queue-3", communication_id: "comm-3" },
    ])

    const claimed = await claimScrubQueueRows({ limit: 3 })

    expect(claimed).toHaveLength(3)
    const tokens = claimed.map((c) => c.leaseToken)
    // All three must be non-empty UUIDs and DIFFERENT from each other.
    expect(new Set(tokens).size).toBe(3)

    // And the per-row update() was called three times with the corresponding
    // row's token — confirms the DB sees distinct tokens, not a shared one.
    expect(db.scrubQueue.update).toHaveBeenCalledTimes(3)
    for (let i = 0; i < 3; i += 1) {
      expect(db.scrubQueue.update).toHaveBeenNthCalledWith(
        i + 1,
        expect.objectContaining({
          where: { id: claimed[i]!.id },
          data: expect.objectContaining({ leaseToken: claimed[i]!.leaseToken }),
        })
      )
    }
  })

  it("dry-runs scrub backfill without creating queue rows", async () => {
    ;(db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "comm-1" },
      { id: "comm-2" },
    ])

    const result = await backfillScrubQueue({
      dryRun: true,
      limit: 2,
      runId: "run-1",
    })

    expect(result).toMatchObject({
      dryRun: true,
      runId: "run-1",
      eligible: 2,
      enqueued: 0,
      nextCursor: "comm-2",
      sampledIds: ["comm-1", "comm-2"],
    })
    expect(db.scrubQueue.createMany).not.toHaveBeenCalled()
  })

  it("requires an explicit limit for write-mode scrub backfill", async () => {
    await expect(
      backfillScrubQueue({ dryRun: false, runId: "run-1" })
    ).rejects.toThrow("limit is required")
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })

  it("enqueues at most the requested scrub backfill chunk in write mode", async () => {
    ;(db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "comm-1" },
    ])
    ;(db.scrubQueue.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    const result = await backfillScrubQueue({
      dryRun: false,
      limit: 1,
      runId: "run-1",
    })

    expect(result.enqueued).toBe(1)
    expect(db.scrubQueue.createMany).toHaveBeenCalledWith({
      data: [{ communicationId: "comm-1", status: "pending" }],
      skipDuplicates: true,
    })
    expect(db.systemState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "scrub_backfill_run:run-1" },
        create: expect.objectContaining({
          value: expect.objectContaining({
            runId: "run-1",
            enqueued: 1,
            eligible: 1,
            limit: 1,
          }),
        }),
      })
    )
  })

  it("honors cursor clauses and caps dry-run limits from env", async () => {
    const previous = process.env.SCRUB_BACKFILL_MAX_ENQUEUE_LIMIT
    process.env.SCRUB_BACKFILL_MAX_ENQUEUE_LIMIT = "2"
    try {
      ;(db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "comm-2" },
        { id: "comm-3" },
      ])

      const result = await backfillScrubQueue({
        dryRun: true,
        limit: 999,
        cursor: "comm-1",
        runId: "run-1",
      })

      expect(result.nextCursor).toBe("comm-3")
      expect(
        JSON.stringify((db.$queryRaw as ReturnType<typeof vi.fn>).mock.calls[0])
      ).toContain("c.id >")
    } finally {
      process.env.SCRUB_BACKFILL_MAX_ENQUEUE_LIMIT = previous
    }
  })

  it("summarizes scrub coverage with missed eligible and skipped noise buckets", async () => {
    ;(db.scrubQueue.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { status: "done", _count: { status: 8 } },
      { status: "failed", _count: { status: 1 } },
    ])
    ;(
      db.contactPromotionCandidate.groupBy as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      { status: "pending", _count: { status: 3 } },
      { status: "approved", _count: { status: 2 } },
    ])
    ;(db.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        {
          total: BigInt(20),
          scrubbed: BigInt(8),
          linked_to_contact: BigInt(7),
        },
      ])
      .mockResolvedValueOnce([
        { name: "signal", count: BigInt(10) },
        { name: "noise", count: BigInt(8) },
        { name: "uncertain", count: BigInt(2) },
      ])
      .mockResolvedValueOnce([
        { name: "signal", count: BigInt(2) },
        { name: "noise", count: BigInt(8) },
        { name: "uncertain", count: BigInt(1) },
      ])
      .mockResolvedValueOnce([
        { open: BigInt(4), pending_mark_done_actions: BigInt(1) },
      ])

    const stats = await getScrubCoverageStats()

    expect(stats.communications).toMatchObject({
      total: 20,
      scrubbed: 8,
      unscrubbed: 12,
      linkedToContact: 7,
      orphaned: 13,
    })
    expect(stats.queue).toEqual({ done: 8, failed: 1 })
    expect(stats.neverQueued).toEqual({
      total: 11,
      missedEligible: 3,
      intentionallySkipped: 8,
      byClassification: { signal: 2, noise: 8, uncertain: 1 },
    })
    expect(stats.contactCandidates).toEqual({
      total: 5,
      byStatus: { pending: 3, approved: 2 },
    })
    expect(stats.todos).toEqual({ open: 4, pendingMarkDoneActions: 1 })
  })
})
