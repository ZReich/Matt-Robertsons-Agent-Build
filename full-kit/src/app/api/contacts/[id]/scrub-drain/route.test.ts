import { beforeEach, describe, expect, it, vi } from "vitest"

import { POST } from "./route"

vi.mock("@/lib/ai/scrub", () => ({
  scrubEmailBatch: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  db: {
    contact: { findUnique: vi.fn() },
    scrubQueue: { findMany: vi.fn(), count: vi.fn() },
  },
}))
vi.mock("@/lib/api-route-auth", () => ({
  requireApiUser: vi.fn(),
}))

function makeReq(): Request {
  return new Request("http://localhost/api/contacts/c1/scrub-drain", {
    method: "POST",
  })
}

describe("POST /api/contacts/[id]/scrub-drain", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    const { requireApiUser } = await import("@/lib/api-route-auth")
    const { NextResponse } = await import("next/server")
    ;(requireApiUser as any).mockResolvedValueOnce(
      NextResponse.json({ error: "unauthorized" }, { status: 401 })
    )
    const res = await POST(
      makeReq() as any,
      {
        params: Promise.resolve({ id: "c1" }),
      } as any
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when contact not found", async () => {
    const { requireApiUser } = await import("@/lib/api-route-auth")
    const { db } = await import("@/lib/prisma")
    ;(requireApiUser as any).mockResolvedValueOnce(null)
    ;(db.contact.findUnique as any).mockResolvedValueOnce(null)
    const res = await POST(
      makeReq() as any,
      {
        params: Promise.resolve({ id: "missing" }),
      } as any
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("contact_not_found")
  })

  it("drains pending rows in batches and returns aggregate counts", async () => {
    const { requireApiUser } = await import("@/lib/api-route-auth")
    const { db } = await import("@/lib/prisma")
    const { scrubEmailBatch } = await import("@/lib/ai/scrub")
    ;(requireApiUser as any).mockResolvedValueOnce(null)
    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1" })

    // First findMany: 3 pending rows. Second findMany: empty (drain done).
    ;(db.scrubQueue.findMany as any)
      .mockResolvedValueOnce([
        { communicationId: "comm-1" },
        { communicationId: "comm-2" },
        { communicationId: "comm-3" },
      ])
      .mockResolvedValueOnce([])
    ;(scrubEmailBatch as any).mockResolvedValueOnce({
      status: "ok",
      processed: 3,
      succeeded: 2,
      failed: 1,
      droppedActions: 0,
      tokensIn: 100,
      tokensOut: 50,
      cacheReadTokens: 0,
      costUsdEstimate: 0,
      cachingLive: true,
      mode: "strict",
    })

    const res = await POST(
      makeReq() as any,
      {
        params: Promise.resolve({ id: "c1" }),
      } as any
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      totalProcessed: 3,
      totalSucceeded: 2,
      totalFailed: 1,
      batches: 1,
      reachedCap: false,
    })
    expect(scrubEmailBatch).toHaveBeenCalledTimes(1)
    expect((scrubEmailBatch as any).mock.calls[0][0].communicationIds).toEqual([
      "comm-1",
      "comm-2",
      "comm-3",
    ])
  })

  it("returns batches=0 when no pending rows", async () => {
    const { requireApiUser } = await import("@/lib/api-route-auth")
    const { db } = await import("@/lib/prisma")
    const { scrubEmailBatch } = await import("@/lib/ai/scrub")
    ;(requireApiUser as any).mockResolvedValueOnce(null)
    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1" })
    ;(db.scrubQueue.findMany as any).mockResolvedValueOnce([])

    const res = await POST(
      makeReq() as any,
      {
        params: Promise.resolve({ id: "c1" }),
      } as any
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.batches).toBe(0)
    expect(body.totalProcessed).toBe(0)
    expect(scrubEmailBatch).not.toHaveBeenCalled()
  })

  it("stops when scrubEmailBatch claims 0 rows (avoids spin)", async () => {
    // E.g. another worker raced us and claimed every pending row between
    // our findMany and the batch call. We must not loop endlessly.
    const { requireApiUser } = await import("@/lib/api-route-auth")
    const { db } = await import("@/lib/prisma")
    const { scrubEmailBatch } = await import("@/lib/ai/scrub")
    ;(requireApiUser as any).mockResolvedValueOnce(null)
    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1" })
    ;(db.scrubQueue.findMany as any).mockResolvedValueOnce([
      { communicationId: "comm-1" },
    ])
    ;(scrubEmailBatch as any).mockResolvedValueOnce({
      status: "ok",
      processed: 0,
      succeeded: 0,
      failed: 0,
      droppedActions: 0,
      tokensIn: 0,
      tokensOut: 0,
      cacheReadTokens: 0,
      costUsdEstimate: 0,
      cachingLive: true,
      mode: "strict",
    })

    const res = await POST(
      makeReq() as any,
      {
        params: Promise.resolve({ id: "c1" }),
      } as any
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.batches).toBe(1)
    expect(body.totalProcessed).toBe(0)
    expect(scrubEmailBatch).toHaveBeenCalledTimes(1)
  })

  it("caps at MAX_BATCHES and reports reachedCap=true if work remains", async () => {
    const { requireApiUser } = await import("@/lib/api-route-auth")
    const { db } = await import("@/lib/prisma")
    const { scrubEmailBatch } = await import("@/lib/ai/scrub")
    ;(requireApiUser as any).mockResolvedValueOnce(null)
    ;(db.contact.findUnique as any).mockResolvedValueOnce({ id: "c1" })
    // Always return a non-empty pending list so the loop hits MAX_BATCHES.
    ;(db.scrubQueue.findMany as any).mockResolvedValue([
      { communicationId: "comm-x" },
    ])
    ;(scrubEmailBatch as any).mockResolvedValue({
      status: "ok",
      processed: 1,
      succeeded: 1,
      failed: 0,
      droppedActions: 0,
      tokensIn: 0,
      tokensOut: 0,
      cacheReadTokens: 0,
      costUsdEstimate: 0,
      cachingLive: true,
      mode: "strict",
    })
    ;(db.scrubQueue.count as any).mockResolvedValueOnce(42)

    const res = await POST(
      makeReq() as any,
      {
        params: Promise.resolve({ id: "c1" }),
      } as any
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.batches).toBe(20)
    expect(body.reachedCap).toBe(true)
    expect(scrubEmailBatch).toHaveBeenCalledTimes(20)
  })
})
