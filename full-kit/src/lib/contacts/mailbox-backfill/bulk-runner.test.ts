import { beforeEach, describe, expect, it, vi } from "vitest"

import { runBulkBackfill } from "./bulk-runner"

vi.mock("./index", () => ({
  backfillMailboxForContact: vi.fn(),
  BackfillAlreadyRunningError: class BackfillAlreadyRunningError extends Error {
    readonly contactId: string
    constructor(contactId: string) {
      super(`backfill already running for contact ${contactId}`)
      this.name = "BackfillAlreadyRunningError"
      this.contactId = contactId
    }
  },
}))
vi.mock("@/lib/prisma", () => ({
  db: {
    contact: { findMany: vi.fn() },
    backfillRun: { create: vi.fn(), update: vi.fn() },
  },
}))

describe("runBulkBackfill", () => {
  beforeEach(() => vi.clearAllMocks())

  it("processes provided contactIds serially and aggregates totals", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "parent-1" })
    ;(backfillMailboxForContact as any).mockResolvedValue({
      runId: "r",
      contactId: "c",
      status: "succeeded",
      windowsSearched: [],
      messagesDiscovered: 0,
      ingested: 5,
      deduped: 0,
      scrubQueued: 4,
      multiClientConflicts: 0,
      durationMs: 10,
    })

    const result = await runBulkBackfill({
      contactIds: ["c1", "c2", "c3"],
      delayBetweenMs: 0,
    })

    expect(backfillMailboxForContact).toHaveBeenCalledTimes(3)
    expect(result.totalContacts).toBe(3)
    expect(result.succeeded).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.totalMessagesIngested).toBe(15)
    expect(result.totalScrubQueued).toBe(12)
    expect(result.parentRunId).toBe("parent-1")
    expect(db.backfillRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "parent-1" },
        data: expect.objectContaining({ status: "succeeded" }),
      })
    )
  })

  it("isolates per-contact failures", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "parent-1" })
    ;(backfillMailboxForContact as any)
      .mockResolvedValueOnce({
        runId: "r1",
        contactId: "c1",
        status: "succeeded",
        windowsSearched: [],
        messagesDiscovered: 0,
        ingested: 5,
        deduped: 0,
        scrubQueued: 0,
        multiClientConflicts: 0,
        durationMs: 1,
      })
      .mockRejectedValueOnce(new Error("graph throttle"))
      .mockResolvedValueOnce({
        runId: "r3",
        contactId: "c3",
        status: "succeeded",
        windowsSearched: [],
        messagesDiscovered: 0,
        ingested: 3,
        deduped: 0,
        scrubQueued: 0,
        multiClientConflicts: 0,
        durationMs: 1,
      })

    const result = await runBulkBackfill({
      contactIds: ["c1", "c2", "c3"],
      delayBetweenMs: 0,
    })

    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].contactId).toBe("c2")
    expect(result.failures[0].error).toContain("graph throttle")
  })

  it("treats BackfillAlreadyRunningError as a soft skip with reason already_running", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact, BackfillAlreadyRunningError } =
      await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "parent-1" })
    ;(backfillMailboxForContact as any).mockRejectedValueOnce(
      new BackfillAlreadyRunningError("c1")
    )

    const result = await runBulkBackfill({
      contactIds: ["c1"],
      delayBetweenMs: 0,
    })

    expect(result.skipped).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.skips).toEqual([
      { contactId: "c1", reason: "already_running" },
    ])
  })

  it("counts skipped status results without inflating failed", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "parent-1" })
    ;(backfillMailboxForContact as any).mockResolvedValueOnce({
      runId: "r1",
      contactId: "c1",
      status: "skipped",
      reason: "no_email_on_file",
      windowsSearched: [],
      messagesDiscovered: 0,
      ingested: 0,
      deduped: 0,
      scrubQueued: 0,
      multiClientConflicts: 0,
      durationMs: 1,
    })

    const result = await runBulkBackfill({
      contactIds: ["c1"],
      delayBetweenMs: 0,
    })

    expect(result.skipped).toBe(1)
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(0)
  })

  it("when no contactIds provided, defaults to all client contacts with zero comms and email", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.contact.findMany as any).mockResolvedValueOnce([
      { id: "c1" },
      { id: "c2" },
    ])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "parent-1" })
    ;(backfillMailboxForContact as any).mockResolvedValue({
      runId: "r",
      contactId: "c",
      status: "succeeded",
      windowsSearched: [],
      messagesDiscovered: 0,
      ingested: 0,
      deduped: 0,
      scrubQueued: 0,
      multiClientConflicts: 0,
      durationMs: 1,
    })

    await runBulkBackfill({ delayBetweenMs: 0 })

    expect(db.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { not: null },
          communications: { none: {} },
          clientType: expect.objectContaining({
            in: expect.arrayContaining([
              "active_listing_client",
              "active_buyer_rep_client",
              "past_client",
              "past_listing_client",
              "past_buyer_client",
            ]),
          }),
        }),
      })
    )
    expect(backfillMailboxForContact).toHaveBeenCalledTimes(2)
  })

  it("propagates dryRun and trigger to per-contact runs", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "parent-1" })
    ;(backfillMailboxForContact as any).mockResolvedValue({
      runId: "r",
      contactId: "c",
      status: "succeeded",
      windowsSearched: [],
      messagesDiscovered: 0,
      ingested: 0,
      deduped: 0,
      scrubQueued: 0,
      multiClientConflicts: 0,
      durationMs: 1,
    })

    await runBulkBackfill({
      contactIds: ["c1"],
      mode: "lifetime",
      trigger: "cli",
      dryRun: true,
      delayBetweenMs: 0,
    })

    expect(backfillMailboxForContact).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        mode: "lifetime",
        trigger: "cli",
        dryRun: true,
        parentRunId: "parent-1",
      })
    )
  })
})
