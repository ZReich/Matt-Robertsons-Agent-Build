import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ScrubOutput } from "./scrub-types"

import { db } from "@/lib/prisma"

import { applyScrubResult } from "./scrub-applier"

vi.mock("@/lib/prisma", () => ({
  db: {
    communication: { findUnique: vi.fn(), update: vi.fn() },
    scrubQueue: { updateMany: vi.fn(), update: vi.fn() },
    agentAction: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

const scrub: ScrubOutput = {
  summary: "A buyer asked for a tour.",
  topicTags: ["showing-scheduling"],
  urgency: "soon",
  replyRequired: true,
  sentiment: "neutral",
  linkedContactCandidates: [],
  linkedDealCandidates: [],
  modelUsed: "claude-haiku-4-5-20251001",
  promptVersion: "v1",
  scrubbedAt: "2026-04-24T12:00:00.000Z",
  tokensIn: 10,
  tokensOut: 5,
  cacheHitTokens: 1,
}

describe("applyScrubResult", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(db.$transaction as ReturnType<typeof vi.fn>).mockImplementation((fn) =>
      fn(db)
    )
    ;(
      db.communication.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      metadata: { classification: "signal" },
    })
  })

  it("refuses to write Communication or AgentAction rows when the lease token has been rotated", async () => {
    // Simulating: another worker re-claimed this row, rotating leaseToken.
    // Our original worker's conditional update finds 0 rows and throws
    // BEFORE any Communication metadata or AgentAction inserts happen.
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 0,
    })

    await expect(
      applyScrubResult({
        communicationId: "comm-1",
        queueRowId: "queue-1",
        leaseToken: "old-token",
        scrubOutput: scrub,
        suggestedActions: [
          {
            actionType: "create-todo",
            summary: "This should never land",
            payload: { title: "ignored", priority: "low" },
          },
        ],
      })
    ).rejects.toMatchObject({ code: "SCRUB_FENCED_OUT" })

    // Critical invariant: neither entity write is attempted on the
    // fenced-out path. This is what protects against duplicate AgentActions.
    expect(db.agentAction.create).not.toHaveBeenCalled()
    expect(db.communication.update).not.toHaveBeenCalled()
  })

  it("writes scrub metadata and approved AgentAction proposals after fencing succeeds", async () => {
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    await applyScrubResult({
      communicationId: "comm-1",
      queueRowId: "queue-1",
      leaseToken: "fresh-token",
      scrubOutput: scrub,
      suggestedActions: [
        {
          actionType: "create-todo",
          summary: "Schedule tour",
          payload: { title: "Schedule tour", priority: "medium" },
        },
      ],
    })

    // Fence-and-commit in a single conditional updateMany — the queue row
    // transitions to status='done' inside the fence, not in a separate
    // later update.
    expect(db.scrubQueue.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "queue-1",
          leaseToken: "fresh-token",
          status: "in_flight",
        },
        data: expect.objectContaining({
          status: "done",
          lockedUntil: null,
          leaseToken: null,
        }),
      })
    )
    expect(db.communication.update).toHaveBeenCalledWith({
      where: { id: "comm-1" },
      data: { metadata: { classification: "signal", scrub } },
    })
    expect(db.agentAction.create).toHaveBeenCalledWith({
      data: {
        actionType: "create-todo",
        tier: "approve",
        status: "pending",
        summary: "Schedule tour",
        sourceCommunicationId: "comm-1",
        promptVersion: "v1",
        targetEntity: null,
        payload: { title: "Schedule tour", priority: "medium" },
      },
    })
  })

  it("targets mark-todo-done actions to the referenced todo", async () => {
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    await applyScrubResult({
      communicationId: "comm-1",
      queueRowId: "queue-1",
      leaseToken: "fresh-token",
      scrubOutput: scrub,
      suggestedActions: [
        {
          actionType: "mark-todo-done",
          summary: "Close sent LOI todo",
          payload: {
            todoId: "todo-123",
            reason: "Outbound email says the LOI was attached.",
            todoUpdatedAt: "2026-04-27T13:00:00.000Z",
            contactId: "contact-1",
            dealId: null,
            communicationId: "comm-previous",
          },
        },
      ],
    })

    expect(db.agentAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: "mark-todo-done",
        targetEntity: "todo:todo-123",
      }),
    })
  })
})
