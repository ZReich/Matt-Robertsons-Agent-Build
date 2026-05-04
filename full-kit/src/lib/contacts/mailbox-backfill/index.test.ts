import { describe, it, expect, vi, beforeEach } from "vitest"
import { backfillMailboxForContact } from "./index"

vi.mock("./graph-query", () => ({
  fetchMessagesForContactWindow: vi.fn(),
}))
vi.mock("./ingest-message", () => ({
  ingestSingleBackfillMessage: vi.fn(),
}))
vi.mock("@/lib/msgraph/config", () => ({
  loadMsgraphConfig: () => ({ targetUpn: "matt@example.com" }),
}))
vi.mock("@/lib/prisma", () => ({
  db: {
    contact: { findUnique: vi.fn(), findMany: vi.fn() },
    deal: { findMany: vi.fn() },
    communication: { findMany: vi.fn() },
    backfillRun: { create: vi.fn(), update: vi.fn() },
    operationalEmailReview: { create: vi.fn() },
  },
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
    ;(db.communication.findMany as any).mockResolvedValueOnce([])
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
