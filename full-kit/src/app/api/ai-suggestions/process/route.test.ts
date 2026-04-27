import { beforeEach, describe, expect, it, vi } from "vitest"

import { assertWithinScrubBudget } from "@/lib/ai/budget-tracker"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/prisma"

import { POST } from "./route"

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  db: {
    communication: { findMany: vi.fn() },
    scrubQueue: { upsert: vi.fn() },
  },
}))

vi.mock("@/lib/ai/budget-tracker", () => ({
  ScrubBudgetError: class ScrubBudgetError extends Error {
    code = "SCRUB_BUDGET_CAP_HIT" as const
    constructor(
      readonly spentUsd: number,
      readonly capUsd: number
    ) {
      super("budget exceeded")
    }
  },
  assertWithinScrubBudget: vi.fn(),
}))

describe("AI suggestions process route", () => {
  beforeEach(() => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockReset()
    vi.mocked(db.communication.findMany).mockReset()
    vi.mocked(db.scrubQueue.upsert).mockReset()
    vi.mocked(assertWithinScrubBudget).mockReset()
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(assertWithinScrubBudget).mockResolvedValue(undefined)
  })

  it("rejects cross-origin process requests", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request(
        { entityType: "contact", entityId: "c1" },
        { origin: "https://malicious.example" }
      )
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "invalid origin" })
    expect(db.communication.findMany).not.toHaveBeenCalled()
    expect(db.scrubQueue.upsert).not.toHaveBeenCalled()
  })

  it("rejects non-JSON process requests", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(request("", { contentType: "text/plain" }))

    expect(response.status).toBe(415)
    expect(await response.json()).toMatchObject({
      error: "invalid content type",
    })
    expect(db.communication.findMany).not.toHaveBeenCalled()
    expect(db.scrubQueue.upsert).not.toHaveBeenCalled()
  })

  it("rejects authenticated users who are not agent reviewers", async () => {
    delete process.env.AGENT_ACTION_REVIEWER_EMAILS
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({ entityType: "contact", entityId: "c1" })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "forbidden" })
    expect(db.communication.findMany).not.toHaveBeenCalled()
    expect(db.scrubQueue.upsert).not.toHaveBeenCalled()
  })

  it("requires explicit confirmation before reprocessing older scrub output", async () => {
    vi.mocked(db.communication.findMany).mockResolvedValue([
      {
        id: "comm-1",
        metadata: { scrub: { promptVersion: "old" } },
        scrubQueue: null,
      },
    ])

    const response = await POST(
      request({ entityType: "contact", entityId: "c1" })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      code: "reprocess_requires_confirmation",
      currentPromptVersion: "old",
    })
    expect(db.scrubQueue.upsert).not.toHaveBeenCalled()
  })

  it("validates all communications before enqueueing any work", async () => {
    vi.mocked(db.communication.findMany).mockResolvedValue([
      { id: "comm-new", metadata: {}, scrubQueue: null },
      {
        id: "comm-old",
        metadata: { scrub: { promptVersion: "old" } },
        scrubQueue: null,
      },
    ])

    const response = await POST(
      request({ entityType: "contact", entityId: "c1" })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      code: "reprocess_requires_confirmation",
    })
    expect(assertWithinScrubBudget).not.toHaveBeenCalled()
    expect(db.scrubQueue.upsert).not.toHaveBeenCalled()
  })

  it("returns 429 when the scrub budget is exhausted", async () => {
    const budget = await import("@/lib/ai/budget-tracker")
    vi.mocked(db.communication.findMany).mockResolvedValue([
      { id: "comm-1", metadata: {}, scrubQueue: null },
    ])
    vi.mocked(assertWithinScrubBudget).mockRejectedValue(
      new budget.ScrubBudgetError(5, 5)
    )

    const response = await POST(
      request({ entityType: "contact", entityId: "c1" })
    )

    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({
      code: "scrub_budget_exceeded",
    })
    expect(db.scrubQueue.upsert).not.toHaveBeenCalled()
  })

  it("enqueues unprocessed communications after auth and budget checks", async () => {
    vi.mocked(db.communication.findMany).mockResolvedValue([
      { id: "comm-1", metadata: {}, scrubQueue: null },
      { id: "comm-2", metadata: {}, scrubQueue: { status: "pending" } },
    ])
    vi.mocked(db.scrubQueue.upsert).mockResolvedValue({ id: "queue-1" })

    const response = await POST(
      request({ entityType: "contact", entityId: "c1" })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      enqueued: 1,
      pending: 1,
    })
    expect(assertWithinScrubBudget).toHaveBeenCalledTimes(1)
    expect(db.scrubQueue.upsert).toHaveBeenCalledWith({
      where: { communicationId: "comm-1" },
      create: { communicationId: "comm-1", status: "pending" },
      update: {
        status: "pending",
        attempts: 0,
        lockedUntil: null,
        leaseToken: null,
        lastError: null,
      },
    })
  })
})

function request(
  body: Record<string, unknown> | string,
  options: { origin?: string; contentType?: string } = {}
): Request {
  return new Request("https://example.test/api/ai-suggestions/process", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": options.contentType ?? "application/json",
      origin: options.origin ?? "https://example.test",
    },
  })
}

function session() {
  return {
    user: {
      id: "user-1",
      name: "Zach Reviewer",
      email: "zach@example.com",
      avatar: null,
      status: "ONLINE",
    },
    expires: "2026-05-27T00:00:00Z",
  }
}
