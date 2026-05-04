import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  BackfillAlreadyRunningError,
  backfillMailboxForContact,
} from "./index"

vi.mock("./graph-query", () => ({
  fetchMessagesForContactWindow: vi.fn(),
}))
vi.mock("./ingest-message", () => ({
  ingestSingleBackfillMessage: vi.fn(),
}))
vi.mock("@/lib/msgraph/config", () => ({
  loadMsgraphConfig: () => ({
    targetUpn: "matt@example.com",
    knownSelfAddresses: ["matt@example.com"],
  }),
}))
vi.mock("@/lib/prisma", () => ({
  db: {
    contact: { findUnique: vi.fn(), findMany: vi.fn() },
    deal: { findMany: vi.fn() },
    communication: { findMany: vi.fn() },
    backfillRun: { create: vi.fn(), update: vi.fn() },
    operationalEmailReview: { create: vi.fn() },
    scrubQueue: { deleteMany: vi.fn(), create: vi.fn() },
  },
}))
vi.mock("@/lib/ai/scrub-queue", () => ({
  enqueueScrubForCommunication: vi.fn(),
}))
vi.mock("@/lib/ai/scrub-types", () => ({
  PROMPT_VERSION: "v6",
}))

describe("backfillMailboxForContact", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns failed result when contact not found", async () => {
    const { db } = await import("@/lib/prisma")
    ;(db.contact.findUnique as any).mockResolvedValueOnce(null)
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })

    const result = await backfillMailboxForContact("missing", { mode: "lifetime" })
    expect(result.status).toBe("failed")
    expect(db.backfillRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) })
    )
  })

  it("returns skipped when contact has no email", async () => {
    const { db } = await import("@/lib/prisma")
    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: null })
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })

    const result = await backfillMailboxForContact("c1", { mode: "lifetime" })
    expect(result.status).toBe("skipped")
  })

  it("returns skipped for deal-anchored with no anchor", async () => {
    const { db } = await import("@/lib/prisma")
    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: "a@b.com" })
    ;(db.deal.findMany as any).mockResolvedValueOnce([])
    ;(db.communication.findMany as any).mockResolvedValueOnce([])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })

    const result = await backfillMailboxForContact("c1", { mode: "deal-anchored" })
    expect(result.status).toBe("skipped")
  })

  it("ingests messages and tracks counts", async () => {
    const { db } = await import("@/lib/prisma")
    const { fetchMessagesForContactWindow } = await import("./graph-query")
    const { ingestSingleBackfillMessage } = await import("./ingest-message")

    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: "a@b.com" })
    ;(db.contact.findMany as any).mockResolvedValueOnce([])
    ;(db.deal.findMany as any).mockResolvedValueOnce([])
    ;(db.communication.findMany as any)
      .mockResolvedValueOnce([]) // initial anchor lookup
      .mockResolvedValueOnce([]) // stale-rescrub scan
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })
    ;(fetchMessagesForContactWindow as any).mockResolvedValueOnce([
      { id: "m1" },
      { id: "m2" },
      { id: "m3" },
    ])
    ;(ingestSingleBackfillMessage as any)
      .mockResolvedValueOnce({ communicationId: "comm-1", deduped: false, classification: "signal" })
      .mockResolvedValueOnce({ communicationId: "comm-2", deduped: true, classification: "noise" })
      .mockResolvedValueOnce({ communicationId: "comm-3", deduped: false, classification: "uncertain" })

    const result = await backfillMailboxForContact("c1", { mode: "lifetime" })
    expect(result.status).toBe("succeeded")
    expect(result.messagesDiscovered).toBe(3)
    expect(result.ingested).toBe(2)
    expect(result.deduped).toBe(1)
    expect(result.scrubQueued).toBe(2) // signal + uncertain, not noise
    expect(result.staleRescrubsEnqueued).toBe(0)
  })

  it("does not re-enqueue when all existing comms are at current PROMPT_VERSION", async () => {
    const { db } = await import("@/lib/prisma")
    const { fetchMessagesForContactWindow } = await import("./graph-query")
    const { enqueueScrubForCommunication } = await import("@/lib/ai/scrub-queue")

    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: "a@b.com" })
    ;(db.contact.findMany as any).mockResolvedValueOnce([])
    ;(db.deal.findMany as any).mockResolvedValueOnce([])
    ;(db.communication.findMany as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "old-1",
          metadata: {
            classification: "signal",
            scrub: { promptVersion: "v6" },
          },
        },
        {
          id: "old-2",
          metadata: {
            classification: "uncertain",
            scrub: { promptVersion: "v6" },
          },
        },
      ])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })
    ;(fetchMessagesForContactWindow as any).mockResolvedValueOnce([])

    const result = await backfillMailboxForContact("c1", { mode: "lifetime" })
    expect(result.status).toBe("succeeded")
    expect(result.staleRescrubsEnqueued).toBe(0)
    expect(enqueueScrubForCommunication).not.toHaveBeenCalled()
  })

  it("re-enqueues comms whose scrub.promptVersion is older than current", async () => {
    const { db } = await import("@/lib/prisma")
    const { fetchMessagesForContactWindow } = await import("./graph-query")
    const { enqueueScrubForCommunication } = await import("@/lib/ai/scrub-queue")

    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: "a@b.com" })
    ;(db.contact.findMany as any).mockResolvedValueOnce([])
    ;(db.deal.findMany as any).mockResolvedValueOnce([])
    ;(db.communication.findMany as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "stale-1",
          metadata: {
            classification: "signal",
            scrub: { promptVersion: "v5" },
          },
        },
        {
          id: "current-1",
          metadata: {
            classification: "signal",
            scrub: { promptVersion: "v6" },
          },
        },
        {
          id: "stale-2",
          metadata: {
            classification: "uncertain",
            scrub: { promptVersion: "v4" },
          },
        },
      ])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })
    ;(fetchMessagesForContactWindow as any).mockResolvedValueOnce([])

    const result = await backfillMailboxForContact("c1", { mode: "lifetime" })
    expect(result.status).toBe("succeeded")
    expect(result.staleRescrubsEnqueued).toBe(2)
    expect(enqueueScrubForCommunication).toHaveBeenCalledTimes(2)
    expect(enqueueScrubForCommunication).toHaveBeenCalledWith(db, "stale-1", "signal")
    expect(enqueueScrubForCommunication).toHaveBeenCalledWith(db, "stale-2", "uncertain")
    // Existing scrub_queue rows are cleared first to avoid the unique-constraint conflict.
    expect((db.scrubQueue.deleteMany as any)).toHaveBeenCalledWith({
      where: { communicationId: "stale-1" },
    })
    expect((db.scrubQueue.deleteMany as any)).toHaveBeenCalledWith({
      where: { communicationId: "stale-2" },
    })
  })

  it("re-enqueues comms with no scrub metadata at all", async () => {
    const { db } = await import("@/lib/prisma")
    const { fetchMessagesForContactWindow } = await import("./graph-query")
    const { enqueueScrubForCommunication } = await import("@/lib/ai/scrub-queue")

    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: "a@b.com" })
    ;(db.contact.findMany as any).mockResolvedValueOnce([])
    ;(db.deal.findMany as any).mockResolvedValueOnce([])
    ;(db.communication.findMany as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "never-scrubbed-1",
          metadata: { classification: "signal" }, // no `scrub` key at all
        },
      ])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })
    ;(fetchMessagesForContactWindow as any).mockResolvedValueOnce([])

    const result = await backfillMailboxForContact("c1", { mode: "lifetime" })
    expect(result.status).toBe("succeeded")
    expect(result.staleRescrubsEnqueued).toBe(1)
    expect(enqueueScrubForCommunication).toHaveBeenCalledWith(
      db,
      "never-scrubbed-1",
      "signal"
    )
  })

  it("does not re-enqueue stale comms classified as noise", async () => {
    const { db } = await import("@/lib/prisma")
    const { fetchMessagesForContactWindow } = await import("./graph-query")
    const { enqueueScrubForCommunication } = await import("@/lib/ai/scrub-queue")

    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: "a@b.com" })
    ;(db.contact.findMany as any).mockResolvedValueOnce([])
    ;(db.deal.findMany as any).mockResolvedValueOnce([])
    ;(db.communication.findMany as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "noise-stale",
          metadata: {
            classification: "noise",
            scrub: { promptVersion: "v5" },
          },
        },
      ])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })
    ;(fetchMessagesForContactWindow as any).mockResolvedValueOnce([])

    const result = await backfillMailboxForContact("c1", { mode: "lifetime" })
    expect(result.status).toBe("succeeded")
    expect(result.staleRescrubsEnqueued).toBe(0)
    expect(enqueueScrubForCommunication).not.toHaveBeenCalled()
  })

  it("rethrows P2002 from backfillRun.create as BackfillAlreadyRunningError", async () => {
    const { db } = await import("@/lib/prisma")
    // Build a stand-in for Prisma.PrismaClientKnownRequestError shaped enough
    // to trip the `instanceof` check in the orchestrator. Importing the real
    // class would pull the prisma client into the test path; the orchestrator
    // only inspects `code`.
    const { Prisma } = await import("@prisma/client")
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the constraint: backfill_runs_one_running_per_contact",
      { code: "P2002", clientVersion: "test" }
    )
    ;(db.backfillRun.create as any).mockRejectedValueOnce(p2002)

    await expect(
      backfillMailboxForContact("c-running", { mode: "lifetime" })
    ).rejects.toBeInstanceOf(BackfillAlreadyRunningError)

    // Importantly, the orchestrator does NOT finalize a phantom run when the
    // initial create fails — there's no run row to update.
    expect(db.backfillRun.update).not.toHaveBeenCalled()
  })

  it("does NOT re-enqueue same-run ingests in the stale-rescrub loop", async () => {
    // Bug 1 regression: just-ingested rows have no scrub.promptVersion yet,
    // so the staleness predicate would otherwise treat every fresh ingest as
    // stale and double-enqueue them. The orchestrator must exclude same-run
    // inserted communicationIds from the stale-rescrub query.
    const { db } = await import("@/lib/prisma")
    const { fetchMessagesForContactWindow } = await import("./graph-query")
    const { ingestSingleBackfillMessage } = await import("./ingest-message")
    const { enqueueScrubForCommunication } = await import(
      "@/lib/ai/scrub-queue"
    )

    ;(db.contact.findUnique as any).mockResolvedValueOnce({
      id: "c1",
      email: "a@b.com",
    })
    ;(db.contact.findMany as any).mockResolvedValueOnce([])
    ;(db.deal.findMany as any).mockResolvedValueOnce([])
    ;(db.communication.findMany as any)
      .mockResolvedValueOnce([]) // anchor lookup
      // Stale-rescrub scan returns ONLY the prior comm — the orchestrator's
      // `notIn` clause must have excluded the just-ingested fresh-1 / fresh-2.
      // Asserting on the call args below proves the exclusion happened.
      .mockResolvedValueOnce([
        {
          id: "prior-stale",
          metadata: {
            classification: "signal",
            scrub: { promptVersion: "v5" },
          },
        },
      ])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })
    ;(fetchMessagesForContactWindow as any).mockResolvedValueOnce([
      { id: "m1" },
      { id: "m2" },
    ])
    ;(ingestSingleBackfillMessage as any)
      .mockResolvedValueOnce({
        communicationId: "fresh-1",
        deduped: false,
        classification: "signal",
      })
      .mockResolvedValueOnce({
        communicationId: "fresh-2",
        deduped: false,
        classification: "uncertain",
      })

    const result = await backfillMailboxForContact("c1", { mode: "lifetime" })
    expect(result.status).toBe("succeeded")
    expect(result.ingested).toBe(2)
    // Only the prior stale comm gets re-enqueued — NOT fresh-1 / fresh-2.
    expect(result.staleRescrubsEnqueued).toBe(1)
    expect(enqueueScrubForCommunication).toHaveBeenCalledTimes(1)
    expect(enqueueScrubForCommunication).toHaveBeenCalledWith(
      db,
      "prior-stale",
      "signal"
    )
    // The stale-rescrub findMany call (second findMany invocation) must
    // exclude the freshly-inserted IDs via `notIn`.
    const findManyCalls = (db.communication.findMany as any).mock.calls
    const staleScanCall = findManyCalls[1]
    expect(staleScanCall[0].where.id).toEqual({
      notIn: ["fresh-1", "fresh-2"],
    })
  })

  it("returns successfully when finalize hits P2025 (BackfillRun row reaped)", async () => {
    // Bug 3 regression: the bulk endpoint's stuck-run reaper (or operator
    // cleanup) can delete the BackfillRun row mid-run. The finalize update
    // then throws P2025. We must log a warning and still return the
    // in-memory BackfillResult, not blow up the whole request.
    const { db } = await import("@/lib/prisma")
    const { fetchMessagesForContactWindow } = await import("./graph-query")
    const { Prisma } = await import("@prisma/client")

    ;(db.contact.findUnique as any).mockResolvedValueOnce({
      id: "c1",
      email: "a@b.com",
    })
    ;(db.contact.findMany as any).mockResolvedValueOnce([])
    ;(db.deal.findMany as any).mockResolvedValueOnce([])
    ;(db.communication.findMany as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-reaped" })
    ;(fetchMessagesForContactWindow as any).mockResolvedValueOnce([])
    const p2025 = new Prisma.PrismaClientKnownRequestError(
      "Record to update not found.",
      { code: "P2025", clientVersion: "test" }
    )
    ;(db.backfillRun.update as any).mockRejectedValueOnce(p2025)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = await backfillMailboxForContact("c1", { mode: "lifetime" })
    expect(result.status).toBe("succeeded")
    expect(result.runId).toBe("run-reaped")
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("disappeared before finalize")
    )

    warnSpy.mockRestore()
  })

  it("rethrows non-P2025 errors from BackfillRun.update", async () => {
    // Make sure the P2025 catch in finalize is narrow — any other error
    // (e.g. transient DB outage) must still bubble up. The outer try/catch
    // in the orchestrator will attempt to finalize as "failed" once the
    // success-path finalize throws; we make BOTH update attempts fail so
    // the error propagates out of the orchestrator.
    const { db } = await import("@/lib/prisma")
    const { fetchMessagesForContactWindow } = await import("./graph-query")

    ;(db.contact.findUnique as any).mockResolvedValueOnce({
      id: "c1",
      email: "a@b.com",
    })
    ;(db.contact.findMany as any).mockResolvedValueOnce([])
    ;(db.deal.findMany as any).mockResolvedValueOnce([])
    ;(db.communication.findMany as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-x" })
    ;(fetchMessagesForContactWindow as any).mockResolvedValueOnce([])
    const dbDown = new Error("connection terminated unexpectedly")
    ;(db.backfillRun.update as any)
      .mockRejectedValueOnce(dbDown)
      .mockRejectedValueOnce(dbDown)

    await expect(
      backfillMailboxForContact("c1", { mode: "lifetime" })
    ).rejects.toBe(dbDown)
  })

  it("dryRun does not call ingestSingleBackfillMessage", async () => {
    const { db } = await import("@/lib/prisma")
    const { fetchMessagesForContactWindow } = await import("./graph-query")
    const { ingestSingleBackfillMessage } = await import("./ingest-message")

    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1", email: "a@b.com" })
    ;(db.contact.findMany as any).mockResolvedValueOnce([])
    ;(db.deal.findMany as any).mockResolvedValueOnce([])
    ;(db.communication.findMany as any).mockResolvedValueOnce([])
    ;(db.backfillRun.create as any).mockResolvedValueOnce({ id: "run-1" })
    ;(fetchMessagesForContactWindow as any).mockResolvedValueOnce([{ id: "m1" }])

    const result = await backfillMailboxForContact("c1", { mode: "lifetime", dryRun: true })
    expect(ingestSingleBackfillMessage).not.toHaveBeenCalled()
    expect(result.messagesDiscovered).toBe(1)
    expect(result.ingested).toBe(0)
  })
})
