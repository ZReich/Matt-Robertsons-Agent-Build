import { describe, expect, it } from "vitest"

import { DEAL_STAGES, DEAL_STAGE_PROBABILITY } from "./stage-probability"
import { computeWeightedCommission } from "./weighted-commission"

describe("computeWeightedCommission", () => {
  it("defines a probability for every deal stage", () => {
    expect(Object.keys(DEAL_STAGE_PROBABILITY).sort()).toEqual(
      [...DEAL_STAGES].sort()
    )
  })

  it("uses the stage default when no probability override exists", () => {
    expect(
      computeWeightedCommission({
        stage: "offer",
        value: 1_000_000,
        commissionRate: 0.03,
        probability: null,
      })
    ).toBe(18_000)
  })

  it("uses probability overrides before the stage default", () => {
    expect(
      computeWeightedCommission({
        stage: "offer",
        value: "1000000",
        commissionRate: "0.03",
        probability: 50,
      })
    ).toBe(15_000)
  })

  it("returns null when value is absent", () => {
    expect(
      computeWeightedCommission({
        stage: "closed",
        value: null,
        commissionRate: 0.03,
      })
    ).toBeNull()
  })

  it("uses 3% when commission rate is absent", () => {
    expect(
      computeWeightedCommission({
        stage: "closed",
        value: 100_000,
        commissionRate: null,
      })
    ).toBe(3_000)
  })
})
