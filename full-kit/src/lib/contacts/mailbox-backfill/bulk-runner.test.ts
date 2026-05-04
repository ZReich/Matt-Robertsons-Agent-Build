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

  it("finalizes parent as failed when cohort lookup throws", async () => {
    const { db } = await import("@/lib/prisma")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "parent-x" })
    ;(db.contact.findMany as any).mockRejectedValueOnce(
      new Error("supabase down")
    )

    await expect(runBulkBackfill({ delayBetweenMs: 0 })).rejects.toThrow(
      "supabase down"
    )

    expect(db.backfillRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "parent-x" },
        data: expect.objectContaining({
          status: "failed",
          errorMessage: "supabase down",
        }),
      })
    )
  })

  it("finalizes parent with status 'failed' when 100% of contacts fail", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "parent-fail" })
    ;(backfillMailboxForContact as any)
      .mockRejectedValueOnce(new Error("boom 1"))
      .mockRejectedValueOnce(new Error("boom 2"))

    const result = await runBulkBackfill({
      contactIds: ["c1", "c2"],
      delayBetweenMs: 0,
    })

    expect(result.failed).toBe(2)
    expect(result.succeeded).toBe(0)
    expect(db.backfillRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      })
    )
  })

  it("finalizes parent with status 'partial' when some succeed and some fail", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({
      id: "parent-partial",
    })
    ;(backfillMailboxForContact as any)
      .mockResolvedValueOnce({
        runId: "r1",
        contactId: "c1",
        status: "succeeded",
        windowsSearched: [],
        messagesDiscovered: 0,
        ingested: 1,
        deduped: 0,
        scrubQueued: 0,
        multiClientConflicts: 0,
        durationMs: 1,
      })
      .mockRejectedValueOnce(new Error("partial fail"))

    const result = await runBulkBackfill({
      contactIds: ["c1", "c2"],
      delayBetweenMs: 0,
    })

    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(db.backfillRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "partial" }),
      })
    )
  })

  it("times out a per-contact run after perContactTimeoutMs and continues", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({
      id: "parent-timeout",
    })
    // c1 hangs forever; c2 succeeds quickly. With perContactTimeoutMs: 50,
    // c1 should be counted as failed with the timeout error.
    ;(backfillMailboxForContact as any)
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({
        runId: "r2",
        contactId: "c2",
        status: "succeeded",
        windowsSearched: [],
        messagesDiscovered: 0,
        ingested: 0,
        deduped: 0,
        scrubQueued: 0,
        multiClientConflicts: 0,
        durationMs: 1,
      })

    const result = await runBulkBackfill({
      contactIds: ["c1", "c2"],
      delayBetweenMs: 0,
      perContactTimeoutMs: 50,
    })

    expect(result.failed).toBe(1)
    expect(result.succeeded).toBe(1)
    expect(result.failures).toEqual([
      { contactId: "c1", error: expect.stringContaining("per_contact_timeout") },
    ])
  })

  it("invokes onProgress callback after each contact with cumulative count", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({
      id: "parent-prog",
    })
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
    const calls: Array<[number, number, string, string]> = []

    await runBulkBackfill({
      contactIds: ["a", "b"],
      delayBetweenMs: 0,
      onProgress: (done, total, contactId, status) => {
        calls.push([done, total, contactId, status])
      },
    })

    expect(calls).toEqual([
      [1, 2, "a", "succeeded"],
      [2, 2, "b", "succeeded"],
    ])
  })

  it("bumps delay between contacts after a 429-flavored failure", async () => {
    const { db } = await import("@/lib/prisma")
    const { backfillMailboxForContact } = await import("./index")
    ;(db.backfillRun.create as any).mockResolvedValueOnce({
      id: "parent-throttle",
    })
    // First contact returns a failed status mentioning 429; second contact
    // succeeds. Using a tiny base delay so the bump is observable but the
    // test doesn't actually wait 30s — we override the delay reset constant
    // by using fake timers.
    vi.useFakeTimers()
    try {
      ;(backfillMailboxForContact as any)
        .mockResolvedValueOnce({
          runId: "r1",
          contactId: "c1",
          status: "failed",
          reason: "graph 429 throttle from MailFolders",
          windowsSearched: [],
          messagesDiscovered: 0,
          ingested: 0,
          deduped: 0,
          scrubQueued: 0,
          multiClientConflicts: 0,
          durationMs: 1,
        })
        .mockResolvedValueOnce({
          runId: "r2",
          contactId: "c2",
          status: "succeeded",
          windowsSearched: [],
          messagesDiscovered: 0,
          ingested: 0,
          deduped: 0,
          scrubQueued: 0,
          multiClientConflicts: 0,
          durationMs: 1,
        })

      const promise = runBulkBackfill({
        contactIds: ["c1", "c2"],
        delayBetweenMs: 100, // base; bump should add 30_000
      })

      // Advance enough to clear initial scheduling.
      await vi.advanceTimersByTimeAsync(50)
      // c1 has resolved by now and the bumped delay is queued. The next
      // setTimeout should be 30_100ms (base + bump). If the bump didn't
      // fire we'd only need to wait 100ms; with the bump we need ~30s.
      // Confirm by advancing 5s and seeing c2 has NOT yet been called.
      await vi.advanceTimersByTimeAsync(5_000)
      expect(backfillMailboxForContact).toHaveBeenCalledTimes(1)

      // Now advance the rest of the bumped delay to let c2 run.
      await vi.advanceTimersByTimeAsync(26_000)
      const result = await promise

      expect(backfillMailboxForContact).toHaveBeenCalledTimes(2)
      expect(result.failed).toBe(1)
      expect(result.succeeded).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
