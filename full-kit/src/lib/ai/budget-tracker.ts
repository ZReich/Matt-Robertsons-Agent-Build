import { db } from "@/lib/prisma"

export class ScrubBudgetError extends Error {
  code = "SCRUB_BUDGET_CAP_HIT" as const

  constructor(
    readonly spentUsd: number,
    readonly capUsd: number
  ) {
    super(`Scrub budget cap hit: spent $${spentUsd} of $${capUsd}`)
  }
}

export async function getRollingScrubSpendUsd(
  windowMs = 24 * 60 * 60 * 1000
): Promise<number> {
  const since = new Date(Date.now() - windowMs)
  const result = await db.scrubApiCall.aggregate({
    where: {
      at: { gte: since },
      // Scope to scrub rows so the SCRUB_DAILY_BUDGET_USD cap doesn't
      // get tripped by classifier or extractor spend. `purpose IS NULL`
      // keeps pre-migration rows (all scrub) in scope.
      OR: [{ purpose: "scrub" }, { purpose: null }],
    },
    _sum: { estimatedUsd: true },
  })
  const value = result._sum.estimatedUsd
  if (value == null) return 0
  return typeof value === "number" ? value : Number(value.toString())
}

export async function assertWithinScrubBudget(): Promise<void> {
  const capUsd = Number.parseFloat(process.env.SCRUB_DAILY_BUDGET_USD ?? "5")
  const spentUsd = await getRollingScrubSpendUsd()
  if (Number.isFinite(capUsd) && spentUsd >= capUsd) {
    throw new ScrubBudgetError(spentUsd, capUsd)
  }
}
