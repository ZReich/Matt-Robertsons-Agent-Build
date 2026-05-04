import { beforeEach, describe, expect, it, vi } from "vitest"

import { POST } from "./route"

vi.mock("@/lib/contacts/mailbox-backfill", () => ({
  backfillMailboxForContact: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  db: { backfillRun: { findFirst: vi.fn() } },
}))
vi.mock("@/lib/api-route-auth", () => ({
  requireApiUser: vi.fn(),
}))

describe("POST /api/contacts/[id]/email-backfill", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 200 with backfill result", async () => {
    const { backfillMailboxForContact } = await import(
      "@/lib/contacts/mailbox-backfill"
    )
    const { db } = await import("@/lib/prisma")
    const { requireApiUser } = await import("@/lib/api-route-auth")
    ;(requireApiUser as any).mockResolvedValueOnce(null)
    ;(db.backfillRun.findFirst as any).mockResolvedValueOnce(null)
    ;(backfillMailboxForContact as any).mockResolvedValueOnce({
      runId: "r1",
      contactId: "c1",
      status: "succeeded",
      messagesDiscovered: 10,
      ingested: 10,
      deduped: 0,
      scrubQueued: 8,
      multiClientConflicts: 0,
      durationMs: 1000,
      windowsSearched: [],
    })
    const req = new Request(
      "http://localhost/api/contacts/c1/email-backfill",
      { method: "POST" }
    )
    const res = await POST(req as any, {
      params: Promise.resolve({ id: "c1" }),
    } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("succeeded")
    expect(body.runId).toBe("r1")
    expect(Array.isArray(body.windowsSearched)).toBe(true)
    expect(backfillMailboxForContact).toHaveBeenCalledWith("c1", {
      mode: "lifetime",
      trigger: "ui",
    })
  })

  it("returns 429 when re-triggered within 10 minutes", async () => {
    const { db } = await import("@/lib/prisma")
    const { requireApiUser } = await import("@/lib/api-route-auth")
    ;(requireApiUser as any).mockResolvedValueOnce(null)
    ;(db.backfillRun.findFirst as any).mockResolvedValueOnce({
      id: "r0",
      startedAt: new Date(Date.now() - 60_000),
    })
    const req = new Request(
      "http://localhost/api/contacts/c1/email-backfill",
      { method: "POST" }
    )
    const res = await POST(req as any, {
      params: Promise.resolve({ id: "c1" }),
    } as any)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe("rate_limited")
    expect(body.lastRunId).toBe("r0")
    expect(typeof body.retryAfter).toBe("number")
    expect(res.headers.get("Retry-After")).toBeTruthy()
  })

  it("returns 401 when unauthenticated", async () => {
    const { requireApiUser } = await import("@/lib/api-route-auth")
    const { default: NextResponseModule } = await import("next/server").then(
      (m) => ({ default: m.NextResponse })
    )
    ;(requireApiUser as any).mockResolvedValueOnce(
      NextResponseModule.json({ error: "unauthorized" }, { status: 401 })
    )
    const req = new Request(
      "http://localhost/api/contacts/c1/email-backfill",
      { method: "POST" }
    )
    const res = await POST(req as any, {
      params: Promise.resolve({ id: "c1" }),
    } as any)
    expect(res.status).toBe(401)
  })
})
