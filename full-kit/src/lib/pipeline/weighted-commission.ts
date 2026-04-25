import type { DealStage } from "@prisma/client"

import { getStageProbability } from "./stage-probability"

export type Decimalish =
  | number
  | string
  | { toNumber(): number }
  | null
  | undefined

export function decimalishToNumber(value: Decimalish): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const parsed = value.toNumber()
  return Number.isFinite(parsed) ? parsed : null
}

export function computeWeightedCommission({
  stage,
  value,
  commissionRate,
  probability,
}: {
  stage: DealStage
  value: Decimalish
  commissionRate?: Decimalish
  probability?: number | null
}): number | null {
  const dealValue = decimalishToNumber(value)
  if (dealValue === null) return null

  const rate = decimalishToNumber(commissionRate) ?? 0.03
  const probabilityPercent = getStageProbability(stage, probability)

  return dealValue * rate * (probabilityPercent / 100)
}
