import { beforeEach, describe, expect, it, vi } from "vitest"

import { enqueueScrubForCommunicationIfMissing } from "@/lib/ai/scrub-queue"
import { db } from "@/lib/prisma"

import { POST } from "./route"

const { dbMock, enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn(),
  dbMock: {
    deal: { findUnique: vi.fn() },
    communication: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ db: dbMock }))

vi.mock("@/lib/ai/scrub-queue", () => ({
  enqueueScrubForCommunicationIfMissing: enqueueMock,
}))

vi.mock("@/lib/reviewer-auth", () => ({
  ReviewerAuthError: class ReviewerAuthError extends Error {
    constructor(
      message: string,
      public readonly status = 401
    ) {
      super(message)
    }
  },
  assertJsonRequest: vi.fn(),
  assertSameOriginRequest: vi.fn(),
  requireAgentReviewer: vi
    .fn()
    .mockResolvedValue({ id: "reviewer-1", label: "Zach Reviewer" }),
}))

describe("attach-deal route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.deal.findUnique.mockResolvedValue({ id: "deal-1", archivedAt: null })
    dbMock.communication.findUnique.mockResolvedValue({
      id: "comm-1",
      channel: "call",
      dealId: null,
      metadata: {
        source: "plaud",
        dealSuggestions: [
          { dealId: "deal-1", score: 80, source: "deal_contact_name" },
        ],
      },
    })
    dbMock.communication.update.mockResolvedValue({ id: "comm-1" })
    dbMock.$transaction.mockImplementation(
      async (fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock)
    )
    enqueueMock.mockResolvedValue(undefined)
  })

  it("attaches a Plaud transcript to a deal and queues scrub ingestion", async () => {
    const response = await POST(request({ dealId: "deal-1" }), params())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
    expect(dbMock.communication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "comm-1" },
        data: expect.objectContaining({
          dealId: "deal-1",
          metadata: expect.objectContaining({
            dealAttachedBy: "Zach Reviewer",
            dealReviewStatus: "linked",
            dealAttachedFromSuggestion: {
              dealId: "deal-1",
              score: 80,
              source: "deal_contact_name",
            },
          }),
        }),
      })
    )
    expect(enqueueScrubForCommunicationIfMissing).toHaveBeenCalledWith(
      db,
      "comm-1",
      "signal"
    )
  })

  it("does not queue scrub ingestion when marking a transcript as no-deal", async () => {
    dbMock.communication.findUnique.mockResolvedValueOnce({
      id: "comm-1",
      channel: "call",
      dealId: "deal-1",
      metadata: {
        source: "plaud",
        dealReviewStatus: "linked",
      },
    })

    const response = await POST(request({ dealId: null }), params())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
    expect(dbMock.communication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dealId: null,
          metadata: expect.objectContaining({ dealReviewStatus: "skipped" }),
        }),
      })
    )
    expect(enqueueScrubForCommunicationIfMissing).not.toHaveBeenCalled()
  })
})

function params() {
  return { params: Promise.resolve({ id: "comm-1" }) }
}

function request(body: Record<string, unknown>): Request {
  return new Request(
    "https://example.test/api/communications/comm-1/attach-deal",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        origin: "https://example.test",
      },
    }
  )
}
