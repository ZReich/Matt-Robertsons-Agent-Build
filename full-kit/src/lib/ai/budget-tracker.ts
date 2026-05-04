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

export class LeaseBackfillBudgetError extends Error {
  code = "LEASE_BACKFILL_BUDGET_CAP_HIT" as const

  constructor(
    readonly spentUsd: number,
    readonly capUsd: number
  ) {
    super(`Lease-backfill budget cap hit: spent $${spentUsd} of $${capUsd}`)
  }
}

/**
 * Audit I4: purpose values used to partition spend between the "live"
 * scrub pipeline (Haiku-backed) and the lease backfill pipeline
 * (DeepSeek classifier + Haiku extractors). Without partitioning, a
 * 200K-row backfill would exhaust SCRUB_DAILY_BUDGET_USD and silently
 * starve scrub-of-new-mail (or vice versa).
 */
const LEASE_PIPELINE_PURPOSES = [
  "closed_deal_classifier",
  "lease_extractor",
  "pdf_lease_extractor",
] as const

/**
 * Spend over the rolling window for the LIVE scrub pipeline only.
 * Lease-pipeline rows are excluded so they don't double-count against
 * `SCRUB_DAILY_BUDGET_USD`. Pre-migration rows (purpose IS NULL) are
 * treated as scrub since that was the only pipeline at the time.
 */
export async function getRollingScrubSpendUsd(
  windowMs = 24 * 60 * 60 * 1000
): Promise<number> {
  const since = new Date(Date.now() - windowMs)
  const result = await db.scrubApiCall.aggregate({
    where: {
      at: { gte: since },
      OR: [{ purpose: "scrub" }, { purpose: null }],
    },
    _sum: { estimatedUsd: true },
  })
  const value = result._sum.estimatedUsd
  if (value == null) return 0
  return typeof value === "number" ? value : Number(value.toString())
}

/**
 * Spend over the rolling window for the lease-backfill pipeline ONLY
 * (classifier + body extractor + PDF extractor purposes).
 */
export async function getRollingLeaseBackfillSpendUsd(
  windowMs = 24 * 60 * 60 * 1000
): Promise<number> {
  const since = new Date(Date.now() - windowMs)
  const result = await db.scrubApiCall.aggregate({
    where: {
      at: { gte: since },
      purpose: { in: [...LEASE_PIPELINE_PURPOSES] },
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

/**
 * Audit I4: the lease backfill driver calls this in place of
 * `assertWithinScrubBudget` so it has its own daily ceiling. Default
 * cap matches the spec's documented backfill-mode estimate of $30/day.
 */
export async function assertWithinLeaseBackfillBudget(): Promise<void> {
  const capUsd = Number.parseFloat(
    process.env.LEASE_BACKFILL_DAILY_BUDGET_USD ?? "30"
  )
  const spentUsd = await getRollingLeaseBackfillSpendUsd()
  if (Number.isFinite(capUsd) && spentUsd >= capUsd) {
    throw new LeaseBackfillBudgetError(spentUsd, capUsd)
  }
}
