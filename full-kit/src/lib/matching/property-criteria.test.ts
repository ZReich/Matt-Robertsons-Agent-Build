import { describe, expect, it } from "vitest"

import type { SearchCriteria } from "./property-criteria"

import { MIN_USEFUL_SCORE, scorePropertyMatch } from "./property-criteria"

const baseProperty = {
  propertyType: "industrial" as const,
  squareFeet: 12000,
  city: "Kalispell",
  address: "100 Main St",
  state: "MT",
  listPrice: 2_500_000 as unknown as null,
  status: "active" as const,
}

describe("scorePropertyMatch", () => {
  it("scores a perfect match at 100", () => {
    const criteria: SearchCriteria = {
      propertyTypes: ["industrial"],
      minSqft: 10000,
      maxSqft: 15000,
      locations: ["Kalispell"],
      minPrice: 2_000_000,
      maxPrice: 3_000_000,
    }
    const result = scorePropertyMatch(baseProperty, criteria)
    expect(result.score).toBe(100)
  })

  it("returns 0 + reason for archived properties", () => {
    const result = scorePropertyMatch(
      { ...baseProperty, status: "archived" },
      { propertyTypes: ["industrial"] }
    )
    expect(result.score).toBe(0)
    expect(result.reasons[0]).toMatch(/archived/)
  })

  it("treats missing criteria components as 'anything matches'", () => {
    const result = scorePropertyMatch(baseProperty, {})
    expect(result.score).toBe(100)
  })

  it("partial credit when sqft is just outside band", () => {
    const criteria: SearchCriteria = {
      propertyTypes: ["industrial"],
      minSqft: 13000,
      maxSqft: 20000,
      locations: ["Kalispell"],
    }
    const result = scorePropertyMatch(baseProperty, criteria)
    // type 40 + sqft partial 12 + location 25 + no-price 10 = 87
    expect(result.score).toBeGreaterThan(MIN_USEFUL_SCORE)
    expect(result.score).toBeLessThan(100)
  })

  it("type mismatch drops the type weight entirely", () => {
    const result = scorePropertyMatch(baseProperty, {
      propertyTypes: ["retail"],
    })
    // Without type credit (40), with full sqft+location+price defaults (25+25+10=60)
    expect(result.score).toBe(60)
    expect(result.reasons.some((r) => r.includes("mismatch"))).toBe(true)
  })

  it("location match is case-insensitive substring across city/address/state", () => {
    const result = scorePropertyMatch(baseProperty, { locations: ["mt"] })
    // 40 type-default + 25 sqft-default + 25 loc + 10 price-default
    expect(result.score).toBe(100)
  })

  it("missing property.squareFeet earns partial credit when criteria specify a band", () => {
    const result = scorePropertyMatch(
      { ...baseProperty, squareFeet: null as unknown as number },
      { minSqft: 10000, maxSqft: 15000 }
    )
    // Other components default, sqft gets ~30%
    expect(result.score).toBeGreaterThan(MIN_USEFUL_SCORE)
    expect(result.reasons.some((r) => r.includes("sqft unknown"))).toBe(true)
  })

  it("returns no-criteria result when criteria is null", () => {
    const result = scorePropertyMatch(baseProperty, null)
    expect(result.score).toBe(0)
    expect(result.reasons[0]).toMatch(/no criteria/)
  })
})
