import { describe, expect, it } from "vitest"

import { parseDailyListings } from "./parser"

const SAMPLE = `Helena
Office for Lease
https://www.crexi.com/lease/properties/1155409/montana-910-n-last-chance-gulch-b
https://www.crexi.com/lease/properties/1154739/montana-2500-sf-office-suite


Missoula
Office for Lease
https://www.crexi.com/lease/properties/1155407/montana-2901-w-broadway-street-102

Retail for Lease
https://www.crexi.com/lease/properties/1155408/montana-817-s-higgins-avenue


Other
Retail – Molt
https://portal.onehome.com/en-US/share/1025490S17360

Office – Whitefish
https://www.crexi.com/properties/2476991/montana-214-central-avenue
`

describe("parseDailyListings", () => {
  it("parses the canonical 2026-04-29 email format", () => {
    const result = parseDailyListings(SAMPLE)
    expect(result.listings).toHaveLength(6)

    const first = result.listings[0]
    expect(first.city).toBe("Helena")
    expect(first.propertyType).toBe("office")
    expect(first.saleOrLease).toBe("lease")
    expect(first.platform).toBe("crexi")
    expect(first.url).toContain("1155409")

    const lastTwo = result.listings.slice(-2)
    expect(lastTwo[0].city).toBe("Other")
    expect(lastTwo[0].propertyType).toBe("retail")
    expect(lastTwo[0].townHint).toBe("Molt")
    expect(lastTwo[0].platform).toBe("onehome")
    expect(lastTwo[1].propertyType).toBe("office")
    expect(lastTwo[1].townHint).toBe("Whitefish")
  })

  it("inherits the city across multiple category sub-sections", () => {
    const result = parseDailyListings(SAMPLE)
    const missoulaListings = result.listings.filter(
      (l) => l.city === "Missoula"
    )
    expect(missoulaListings).toHaveLength(2)
    expect(missoulaListings.map((l) => l.propertyType)).toEqual([
      "office",
      "retail",
    ])
  })

  it("returns empty when given an empty body", () => {
    expect(parseDailyListings("")).toEqual({ listings: [], warnings: [] })
  })

  it("classifies LoopNet and OneHome platforms correctly", () => {
    const body = `Bozeman
Office for Lease
https://www.loopnet.com/Listing/123-Main-St
https://portal.onehome.com/share/abc`
    const r = parseDailyListings(body)
    expect(r.listings[0].platform).toBe("loopnet")
    expect(r.listings[1].platform).toBe("onehome")
  })

  it("recognizes 'for sale' vs 'for lease'", () => {
    const body = `Billings
Industrial for Sale
https://www.crexi.com/properties/123
Land for Lease
https://www.crexi.com/lease/properties/456`
    const r = parseDailyListings(body)
    expect(r.listings[0].saleOrLease).toBe("sale")
    expect(r.listings[0].propertyType).toBe("industrial")
    expect(r.listings[1].saleOrLease).toBe("lease")
    expect(r.listings[1].propertyType).toBe("land")
  })

  it("falls back to 'Unknown' city when no header preceded the URL", () => {
    const body = `https://www.crexi.com/properties/orphan-listing`
    const r = parseDailyListings(body)
    expect(r.listings[0].city).toBe("Unknown")
    expect(r.listings[0].rawCategory).toBe("Uncategorized")
  })

  it("does not misclassify category-only lines as cities", () => {
    // Real format observed in 2026-04-27 digest: bare category words like
    // "Multi-family" and "Commercial Land" without a "for Sale/Lease" suffix.
    const body = `Billings
Commercial Land
https://www.crexi.com/properties/2475387/montana-56th-st-w-grand-ave

Multi-family
https://www.loopnet.com/Listing/420-Lordwith-Dr-Billings-MT

Industrial for Lease – Billings
https://www.crexi.com/lease/properties/1152949/montana-livework

Bozeman
Commercial Land
https://www.crexi.com/properties/2468798/montana-lot-6b`
    const r = parseDailyListings(body)
    const cities = [...new Set(r.listings.map((l) => l.city))]
    expect(cities.sort()).toEqual(["Billings", "Bozeman"])
    // Multi-family is a category, not a city.
    expect(cities).not.toContain("Multi-family")
    expect(cities).not.toContain("Commercial Land")
    // The dash-suffix variant captures townHint.
    const dashed = r.listings.find((l) => l.url.includes("livework"))
    expect(dashed?.townHint).toBe("Billings")
  })

  it("recognizes self-storage / special-purpose categories", () => {
    const body = `Other
Self-Storage – Belgrade
https://www.loopnet.com/Listing/1205-Rizzo-Ln

Special Purpose – Twin Bridges
https://www.crexi.com/properties/2468668`
    const r = parseDailyListings(body)
    expect(r.listings).toHaveLength(2)
    expect(r.listings[0].propertyType).toBe("other")
    expect(r.listings[0].townHint).toBe("Belgrade")
    expect(r.listings[1].townHint).toBe("Twin Bridges")
  })
})
