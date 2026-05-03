import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  assertWithinScrubBudget,
  getRollingScrubSpendUsd,
} from "./budget-tracker"

vi.mock("@/lib/prisma", () => ({
  db: {
    scrubApiCall: {
      aggregate: vi.fn(),
    },
  },
}))

describe("budget-tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SCRUB_DAILY_BUDGET_USD
  })

  it("reads authoritative spend from ScrubApiCall rows, including failed downstream calls", async () => {
    ;(db.scrubApiCall.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { estimatedUsd: { toString: () => "1.234567" } },
    })

    await expect(getRollingScrubSpendUsd()).resolves.toBe(1.234567)
    expect(db.scrubApiCall.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          at: { gte: expect.any(Date) },
          OR: [{ purpose: "scrub" }, { purpose: null }],
        },
        _sum: { estimatedUsd: true },
      })
    )
  })

  it("short-circuits when rolling spend exceeds the configured cap", async () => {
    process.env.SCRUB_DAILY_BUDGET_USD = "0.01"
    ;(db.scrubApiCall.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { estimatedUsd: 0.02 },
    })

    await expect(assertWithinScrubBudget()).rejects.toMatchObject({
      code: "SCRUB_BUDGET_CAP_HIT",
    })
  })
})
