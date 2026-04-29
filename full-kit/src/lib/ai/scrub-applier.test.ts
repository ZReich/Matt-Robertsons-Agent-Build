import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ScrubOutput } from "./scrub-types"

import { db } from "@/lib/prisma"

import { applyScrubResult } from "./scrub-applier"

vi.mock("@/lib/prisma", () => ({
  db: {
    communication: { findUnique: vi.fn(), update: vi.fn() },
    scrubQueue: { updateMany: vi.fn(), update: vi.fn() },
    agentAction: { create: vi.fn(), findFirst: vi.fn() },
    contactProfileFact: { findUnique: vi.fn(), upsert: vi.fn() },
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
  profileFacts: [],
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
      contactId: "contact-1",
      date: new Date("2026-04-24T12:00:00.000Z"),
    })
    delete process.env.PROFILE_FACT_EXTRACTION_MODE
    ;(
      db.contactProfileFact.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null)
    ;(db.agentAction.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
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
            todoCreatedAt: "2026-04-27T12:00:00.000Z",
            contactId: "contact-1",
            dealId: null,
            communicationId: "comm-previous",
            targetEntity: "todo:todo-123",
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

  it("suppresses duplicate pending mark-todo-done proposals before insert", async () => {
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })
    ;(db.agentAction.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-action",
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
            todoCreatedAt: "2026-04-27T12:00:00.000Z",
            contactId: "contact-1",
            dealId: null,
            communicationId: "comm-previous",
            targetEntity: "todo:todo-123",
          },
        },
      ],
    })

    expect(db.agentAction.findFirst).toHaveBeenCalledWith({
      where: {
        actionType: "mark-todo-done",
        status: "pending",
        targetEntity: "todo:todo-123",
      },
      select: { id: true },
    })
    expect(db.agentAction.create).not.toHaveBeenCalled()
  })

  it("rejects non-canonical mark-todo-done target variants", async () => {
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
            todoCreatedAt: "2026-04-27T12:00:00.000Z",
            contactId: "contact-1",
            dealId: null,
            communicationId: "comm-previous",
            targetEntity: "Todo:todo-123",
          },
        },
      ],
    })

    expect(db.agentAction.findFirst).not.toHaveBeenCalled()
    expect(db.agentAction.create).not.toHaveBeenCalled()
  })

  it("saves high-confidence live profile facts for the linked contact", async () => {
    process.env.PROFILE_FACT_EXTRACTION_MODE = "live_only"
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    await applyScrubResult({
      communicationId: "comm-1",
      queueRowId: "queue-1",
      leaseToken: "fresh-token",
      scrubOutput: {
        ...scrub,
        profileFacts: [
          {
            category: "communication_style",
            fact: "Prefers email over phone for scheduling.",
            normalizedKey: "communication_style:prefers_email",
            confidence: 0.92,
            wordingClass: "operational",
            contactId: "contact-1",
            sourceCommunicationId: "comm-1",
            evidence:
              "Email me at abcdefghijklmnopqrstuvwxyz@example.com via https://example.test/schedule with code abcdefghijklmnopqrstuvwxyz1234567890.",
          },
        ],
      },
      suggestedActions: [],
    })

    expect(db.contactProfileFact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contactId_normalizedKey: {
            contactId: "contact-1",
            normalizedKey: "communication_style:prefers_email",
          },
        },
        create: expect.objectContaining({
          contactId: "contact-1",
          status: "active",
          fact: "Prefers email over phone for scheduling.",
          confidence: 0.92,
          sourceCommunicationId: "comm-1",
          metadata: expect.objectContaining({
            evidence: expect.stringContaining("[redacted-email]"),
            savedBy: "scrub-profile-fact",
          }),
        }),
        update: expect.objectContaining({
          status: "active",
          lastSeenAt: new Date("2026-04-24T12:00:00.000Z"),
        }),
      })
    )
    const metadata = (db.contactProfileFact.upsert as ReturnType<typeof vi.fn>)
      .mock.calls[0][0].create.metadata as { evidence?: string }
    expect(metadata.evidence).toContain("[redacted-url]")
    expect(metadata.evidence).toContain("[redacted-token]")
    expect(metadata.evidence).not.toContain(
      "abcdefghijklmnopqrstuvwxyz@example.com"
    )
    expect(metadata.evidence).not.toContain("@example.com")
    expect(metadata.evidence).not.toContain("abcdefghijklmnopqrstuvwxyz")
  })

  it("does not save low-confidence or caution profile facts automatically", async () => {
    process.env.PROFILE_FACT_EXTRACTION_MODE = "live_only"
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    await applyScrubResult({
      communicationId: "comm-1",
      queueRowId: "queue-1",
      leaseToken: "fresh-token",
      scrubOutput: {
        ...scrub,
        profileFacts: [
          {
            category: "personal",
            fact: "Has a delicate personal constraint.",
            normalizedKey: "personal:constraint",
            confidence: 0.9,
            wordingClass: "caution",
            contactId: "contact-1",
            sourceCommunicationId: "comm-1",
          },
          {
            category: "schedule",
            fact: "Might prefer mornings.",
            normalizedKey: "schedule:mornings",
            confidence: 0.5,
            wordingClass: "operational",
            contactId: "contact-1",
            sourceCommunicationId: "comm-1",
          },
        ],
      },
      suggestedActions: [],
    })

    expect(db.contactProfileFact.upsert).toHaveBeenCalledTimes(2)
    expect(db.contactProfileFact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "review" }),
        update: expect.objectContaining({ status: "review" }),
      })
    )
  })

  it("does not let review profile facts overwrite an active fact", async () => {
    process.env.PROFILE_FACT_EXTRACTION_MODE = "live_only"
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })
    ;(
      db.contactProfileFact.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ status: "active" })

    await applyScrubResult({
      communicationId: "comm-1",
      queueRowId: "queue-1",
      leaseToken: "fresh-token",
      scrubOutput: {
        ...scrub,
        profileFacts: [
          {
            category: "schedule",
            fact: "Might prefer mornings.",
            normalizedKey: "schedule:mornings",
            confidence: 0.5,
            wordingClass: "operational",
            contactId: "contact-1",
            sourceCommunicationId: "comm-1",
          },
        ],
      },
      suggestedActions: [],
    })

    expect(db.contactProfileFact.upsert).not.toHaveBeenCalled()
  })

  it("drops forbidden sensitive profile facts instead of storing them for review", async () => {
    process.env.PROFILE_FACT_EXTRACTION_MODE = "live_only"
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    await applyScrubResult({
      communicationId: "comm-1",
      queueRowId: "queue-1",
      leaseToken: "fresh-token",
      scrubOutput: {
        ...scrub,
        profileFacts: [
          {
            category: "personal",
            fact: "Has a medical issue.",
            normalizedKey: "personal:medical",
            confidence: 0.9,
            wordingClass: "caution",
            contactId: "contact-1",
            sourceCommunicationId: "comm-1",
          },
        ],
      },
      suggestedActions: [],
    })

    expect(db.contactProfileFact.upsert).not.toHaveBeenCalled()
  })

  it("does not save profile facts when env mode is unset", async () => {
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    await applyScrubResult({
      communicationId: "comm-1",
      queueRowId: "queue-1",
      leaseToken: "fresh-token",
      scrubOutput: {
        ...scrub,
        profileFacts: [
          {
            category: "communication_style",
            fact: "Prefers email.",
            normalizedKey: "communication_style:prefers_email",
            confidence: 0.92,
            wordingClass: "operational",
            contactId: "contact-1",
            sourceCommunicationId: "comm-1",
          },
        ],
      },
      suggestedActions: [],
    })

    expect(db.contactProfileFact.upsert).not.toHaveBeenCalled()
  })

  it("does not save profile facts with mismatched identity or provenance", async () => {
    process.env.PROFILE_FACT_EXTRACTION_MODE = "live_only"
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    await applyScrubResult({
      communicationId: "comm-1",
      queueRowId: "queue-1",
      leaseToken: "fresh-token",
      scrubOutput: {
        ...scrub,
        profileFacts: [
          {
            category: "communication_style",
            fact: "Prefers email.",
            normalizedKey: "communication_style:wrong_contact",
            confidence: 0.92,
            wordingClass: "operational",
            contactId: "contact-2",
            sourceCommunicationId: "comm-1",
          },
          {
            category: "communication_style",
            fact: "Prefers email.",
            normalizedKey: "communication_style:wrong_source",
            confidence: 0.92,
            wordingClass: "operational",
            contactId: "contact-1",
            sourceCommunicationId: "comm-2",
          },
        ],
      },
      suggestedActions: [],
    })

    expect(db.contactProfileFact.upsert).not.toHaveBeenCalled()
  })

  it("does not save profile facts when the communication has no linked contact", async () => {
    process.env.PROFILE_FACT_EXTRACTION_MODE = "live_only"
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })
    ;(
      db.communication.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      metadata: { classification: "signal" },
      contactId: null,
      date: new Date("2026-04-24T12:00:00.000Z"),
    })

    await applyScrubResult({
      communicationId: "comm-1",
      queueRowId: "queue-1",
      leaseToken: "fresh-token",
      scrubOutput: {
        ...scrub,
        profileFacts: [
          {
            category: "communication_style",
            fact: "Prefers email.",
            normalizedKey: "communication_style:prefers_email",
            confidence: 0.92,
            wordingClass: "operational",
            contactId: "contact-1",
            sourceCommunicationId: "comm-1",
          },
        ],
      },
      suggestedActions: [],
    })

    expect(db.contactProfileFact.upsert).not.toHaveBeenCalled()
  })
})
