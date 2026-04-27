import { describe, expect, it, vi } from "vitest"

import { backfillScrubQueue } from "@/lib/ai"

import { POST } from "./route"

vi.mock("@/lib/ai", () => ({
  authorizeScrubRequest: vi.fn(() => ({ ok: true, via: "admin" })),
  backfillScrubQueue: vi.fn(),
  isCachingLive: vi.fn(() => true),
}))

describe("scrub backfill route", () => {
  it("rejects write mode without an explicit limit", async () => {
    const response = await POST(
      new Request("https://example.test/api/integrations/scrub/backfill", {
        method: "POST",
        body: JSON.stringify({ dryRun: false, runId: "run-1" }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: "limit-required" })
    expect(backfillScrubQueue).not.toHaveBeenCalled()
  })
})
