import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  claimScrubQueueRows,
  enqueueScrubForCommunication,
} from "./scrub-queue"

vi.mock("@/lib/prisma", () => ({
  db: {
    scrubQueue: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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
})
