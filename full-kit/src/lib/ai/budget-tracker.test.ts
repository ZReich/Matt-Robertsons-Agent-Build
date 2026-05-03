import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  assertWithinLeaseBackfillBudget,
  assertWithinScrubBudget,
  getRollingLeaseBackfillSpendUsd,
  getRollingScrubSpendUsd,
} from "./budget-tracker"

vi.mock("@/lib/prisma", () => ({
  db: {
    scrubApiCall: {
      aggregate: vi.fn(),
    },
  },
}))

const mockedAggregate = db.scrubApiCall.aggregate as unknown as ReturnType<
  typeof vi.fn
>

describe("budget-tracker — scrub", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SCRUB_DAILY_BUDGET_USD
  })

  it("reads authoritative spend from ScrubApiCall rows, including failed downstream calls", async () => {
    mockedAggregate.mockResolvedValue({
      _sum: { estimatedUsd: { toString: () => "1.234567" } },
    })

    await expect(getRollingScrubSpendUsd()).resolves.toBe(1.234567)
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          at: { gte: expect.any(Date) },
          // Audit I4: lease-pipeline outcomes excluded so the scrub
          // budget isn't double-counting them.
          NOT: expect.arrayContaining([
            { outcome: { startsWith: "classifier-" } },
            { outcome: { startsWith: "extractor-" } },
            { outcome: { startsWith: "extractor-pdf-" } },
          ]),
        }),
        _sum: { estimatedUsd: true },
      })
    )
  })

  it("short-circuits when rolling spend exceeds the configured cap", async () => {
    process.env.SCRUB_DAILY_BUDGET_USD = "0.01"
    mockedAggregate.mockResolvedValue({ _sum: { estimatedUsd: 0.02 } })

    await expect(assertWithinScrubBudget()).rejects.toMatchObject({
      code: "SCRUB_BUDGET_CAP_HIT",
    })
  })
})

describe("budget-tracker — lease backfill (I4)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.LEASE_BACKFILL_DAILY_BUDGET_USD
  })

  it("getRollingLeaseBackfillSpendUsd queries ONLY classifier-/extractor-/extractor-pdf- outcomes", async () => {
    mockedAggregate.mockResolvedValue({
      _sum: { estimatedUsd: { toString: () => "12.5" } },
    })

    await expect(getRollingLeaseBackfillSpendUsd()).resolves.toBe(12.5)
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          at: { gte: expect.any(Date) },
          OR: expect.arrayContaining([
            { outcome: { startsWith: "classifier-" } },
            { outcome: { startsWith: "extractor-" } },
            { outcome: { startsWith: "extractor-pdf-" } },
          ]),
        }),
        _sum: { estimatedUsd: true },
      })
    )
  })

  it("$25 of classifier-ok spend does NOT trip the scrub budget cap (lease-pipeline outcomes excluded)", async () => {
    process.env.SCRUB_DAILY_BUDGET_USD = "5"
    // Scrub aggregate excludes lease-pipeline outcomes — so the
    // mocked aggregate (returning 0 because the WHERE filter would
    // strip the lease-pipeline rows) leaves spend at $0.
    mockedAggregate.mockResolvedValue({ _sum: { estimatedUsd: 0 } })

    await expect(assertWithinScrubBudget()).resolves.toBeUndefined()
  })

  it("$25 of classifier-ok spend DOES trip the lease-backfill budget when cap is $20", async () => {
    process.env.LEASE_BACKFILL_DAILY_BUDGET_USD = "20"
    mockedAggregate.mockResolvedValue({ _sum: { estimatedUsd: 25 } })

    await expect(assertWithinLeaseBackfillBudget()).rejects.toMatchObject({
      code: "LEASE_BACKFILL_BUDGET_CAP_HIT",
    })
  })

  it("uses $30 as the default lease-backfill cap when env var is unset", async () => {
    mockedAggregate.mockResolvedValue({ _sum: { estimatedUsd: 25 } })
    // 25 < 30 → no throw
    await expect(assertWithinLeaseBackfillBudget()).resolves.toBeUndefined()

    mockedAggregate.mockResolvedValue({ _sum: { estimatedUsd: 35 } })
    // 35 >= 30 → throws
    await expect(assertWithinLeaseBackfillBudget()).rejects.toMatchObject({
      code: "LEASE_BACKFILL_BUDGET_CAP_HIT",
    })
  })
})
