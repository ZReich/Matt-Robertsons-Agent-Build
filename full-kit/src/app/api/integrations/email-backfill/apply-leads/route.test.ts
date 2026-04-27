import { beforeEach, describe, expect, it, vi } from "vitest"

import { authorizeEmailBackfillRequest } from "@/lib/backfill/email-backfill-auth"
import { runLeadApplyBackfill } from "@/lib/backfill/lead-apply-backfill"

import { GET, POST } from "./route"

vi.mock("@/lib/backfill/email-backfill-auth", () => ({
  authorizeEmailBackfillRequest: vi.fn(() => ({ ok: true, via: "admin" })),
}))

vi.mock("@/lib/backfill/lead-apply-backfill", () => ({
  runLeadApplyBackfill: vi.fn(async ({ request }) => ({
    ok: true,
    runId: request.runId ?? "dry-run",
    dryRun: request.dryRun,
    scanned: 0,
  })),
}))

describe("apply-leads route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ALLOW_BACKFILL
  })

  it("defaults to dry-run", async () => {
    const response = await POST(request({}))

    expect(response.status).toBe(200)
    expect(runLeadApplyBackfill).toHaveBeenCalledWith({
      request: { dryRun: true },
    })
  })

  it("rejects disabled or unauthorized requests", async () => {
    vi.mocked(authorizeEmailBackfillRequest).mockReturnValueOnce({
      ok: false,
      reason: "disabled",
    })
    await expect(POST(request({}))).resolves.toMatchObject({ status: 404 })

    vi.mocked(authorizeEmailBackfillRequest).mockReturnValueOnce({
      ok: false,
      reason: "unauthorized",
    })
    await expect(POST(request({}))).resolves.toMatchObject({ status: 401 })
  })

  it("requires write-mode gates", async () => {
    let response = await POST(
      request({ dryRun: false, runId: "run-1", limit: 25 })
    )
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: "backfill-not-allowed",
    })

    process.env.ALLOW_BACKFILL = "true"
    response = await POST(request({ dryRun: false, limit: 25 }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: "run-id-required" })

    response = await POST(request({ dryRun: false, runId: "run-1" }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: "limit-required" })

    response = await POST(
      request({ dryRun: false, runId: "run-1", limit: 101 })
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: "limit-too-large" })

    expect(runLeadApplyBackfill).not.toHaveBeenCalled()
  })

  it("passes valid write-mode requests through", async () => {
    process.env.ALLOW_BACKFILL = "true"

    const response = await POST(
      request({ dryRun: false, runId: "run-1", limit: 25 })
    )

    expect(response.status).toBe(200)
    expect(runLeadApplyBackfill).toHaveBeenCalledWith({
      request: { dryRun: false, runId: "run-1", limit: 25 },
    })
  })

  it("rejects GET", async () => {
    await expect(GET()).resolves.toMatchObject({ status: 405 })
  })
})

function request(body: unknown): Request {
  return new Request(
    "https://example.test/api/integrations/email-backfill/apply-leads",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  )
}
