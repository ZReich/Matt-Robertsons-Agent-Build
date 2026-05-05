import { beforeEach, describe, expect, it, vi } from "vitest"

import { enqueueScrubForCommunicationIfMissing } from "@/lib/ai/scrub-queue"
import { db } from "@/lib/prisma"

import { POST } from "./route"

const { dbMock, enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn(),
  dbMock: {
    contact: { findUnique: vi.fn() },
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

describe("attach-contact route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.contact.findUnique.mockResolvedValue({
      id: "contact-1",
      archivedAt: null,
    })
    dbMock.communication.findUnique.mockResolvedValue({
      id: "comm-1",
      channel: "call",
      contactId: null,
      metadata: {
        source: "plaud",
        suggestions: [
          {
            contactId: "contact-1",
            score: 45,
            source: "counterparty_candidate",
          },
        ],
      },
    })
    dbMock.communication.update.mockResolvedValue({ id: "comm-1" })
    dbMock.$transaction.mockImplementation(
      async (fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock)
    )
    enqueueMock.mockResolvedValue(undefined)
  })

  it("attaches a Plaud transcript to a contact and queues scrub ingestion", async () => {
    const response = await POST(request({ contactId: "contact-1" }), params())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
    expect(dbMock.communication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "comm-1" },
        data: expect.objectContaining({
          contactId: "contact-1",
          metadata: expect.objectContaining({
            attachedBy: "Zach Reviewer",
            attachedFromSuggestion: {
              contactId: "contact-1",
              score: 45,
              source: "counterparty_candidate",
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

  it("re-queues scrub ingestion on idempotent same-contact attach", async () => {
    dbMock.communication.findUnique.mockResolvedValueOnce({
      id: "comm-1",
      channel: "call",
      contactId: "contact-1",
      metadata: { source: "plaud" },
    })

    const response = await POST(request({ contactId: "contact-1" }), params())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      alreadyAttached: true,
    })
    expect(dbMock.communication.update).not.toHaveBeenCalled()
    expect(enqueueScrubForCommunicationIfMissing).toHaveBeenCalledWith(
      db,
      "comm-1",
      "signal"
    )
  })
})

function params() {
  return { params: Promise.resolve({ id: "comm-1" }) }
}

function request(body: Record<string, unknown>): Request {
  return new Request(
    "https://example.test/api/communications/comm-1/attach-contact",
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
