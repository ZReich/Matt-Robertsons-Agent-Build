import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  estimateScrubCostUsd,
  logScrubApiCall,
  updateScrubApiCallOutcome,
} from "./scrub-api-log"

vi.mock("@/lib/prisma", () => ({
  db: {
    scrubApiCall: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe("scrub-api-log", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("estimates cached Haiku usage separately from uncached input", () => {
    expect(
      estimateScrubCostUsd({
        tokensIn: 1000,
        tokensOut: 100,
        cacheReadTokens: 500,
        cacheWriteTokens: 0,
      })
    ).toBeCloseTo(0.00105, 6)
  })

  it("logs an API call as pending-validation immediately after the response", async () => {
    ;(db.scrubApiCall.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "api-call-1",
    })

    const id = await logScrubApiCall({
      queueRowId: "queue-1",
      communicationId: "comm-1",
      promptVersion: "v1",
      modelUsed: "claude-haiku-4-5-20251001",
      usage: { tokensIn: 100, tokensOut: 25, cacheReadTokens: 50 },
      outcome: "pending-validation",
      purpose: "scrub",
    })

    expect(id).toBe("api-call-1")
    expect(db.scrubApiCall.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outcome: "pending-validation",
        purpose: "scrub",
        estimatedUsd: expect.any(String),
      }),
      select: { id: true },
    })
  })

  it("updates the outcome to terminal states after the pending row is written", async () => {
    await updateScrubApiCallOutcome("api-call-1", "validation-failed")
    expect(db.scrubApiCall.update).toHaveBeenCalledWith({
      where: { id: "api-call-1" },
      data: { outcome: "validation-failed" },
    })
  })

  it("is a no-op when called with a null id (insert had failed silently)", async () => {
    await updateScrubApiCallOutcome(null, "scrubbed")
    expect(db.scrubApiCall.update).not.toHaveBeenCalled()
  })

  it("does NOT throw when the telemetry insert fails — scrub must not die on telemetry", async () => {
    ;(db.scrubApiCall.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("connection refused")
    )
    const id = await logScrubApiCall({
      promptVersion: "v1",
      modelUsed: "claude-haiku-4-5-20251001",
      usage: { tokensIn: 10, tokensOut: 5 },
      outcome: "pending-validation",
      purpose: "scrub",
    })
    expect(id).toBeNull()
  })
})
