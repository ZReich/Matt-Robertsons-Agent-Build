import { describe, expect, it } from "vitest"

import {
  computePropertyKey,
  extractPropertyUnit,
  isPropertyType,
  parsePropertyCsv,
} from "./property-utils"

describe("computePropertyKey", () => {
  it("normalizes directionals + street suffixes the same as the buildout normalizer", () => {
    const a = computePropertyKey({
      address: "303 North Broadway",
      city: "Billings",
      state: "MT",
      zip: "59101",
    })
    const b = computePropertyKey({
      address: "303 N Broadway",
      city: "Billings",
      state: "MT",
      zip: "59101",
    })
    expect(a).toBe(b)
    expect(a).toContain("303 n broadway")
  })

  it("falls back to a lowercased trimmed key when no street-number prefix is present", () => {
    const key = computePropertyKey({
      address: "Some Named Property",
      city: "Billings",
      state: "MT",
    })
    expect(key).toContain("some named property")
  })

  it("strips punctuation and collapses whitespace in the fallback path", () => {
    const key = computePropertyKey({ address: "Acme | Plaza, , .", city: "" })
    expect(key.trim()).toBe(key)
    expect(key).not.toMatch(/[.,|]/)
  })
})

describe("extractPropertyUnit", () => {
  it("returns null when no unit/suite suffix is present", () => {
    expect(extractPropertyUnit("303 N Broadway")).toBeNull()
    expect(extractPropertyUnit("West Park Promenade")).toBeNull()
  })

  it("extracts Suite N from a pipe-separated deal title", () => {
    // The buildout normalizer recognizes "Suite N" → unitOrSuite="suite n"
    expect(extractPropertyUnit("303 N Broadway | Suite 100")).toBe("suite 100")
    expect(extractPropertyUnit("1601 Lewis | 1601 Lewis Ave, Suite 104")).toBe(
      "suite 104"
    )
  })

  it("extracts Unit N from a pipe-separated deal title", () => {
    expect(extractPropertyUnit("West Park Promenade | Unit 110")).toBe(
      "unit 110"
    )
  })

  it("recognizes 'Ste N' as a suite designator", () => {
    expect(extractPropertyUnit("2621 Overland - Ste A")).toBe("suite a")
  })

  it("recognizes a #N suffix", () => {
    expect(extractPropertyUnit("100 Main St #5")).toBe("suite 5")
  })

  it("does not invent a unit from building-name + address pipe forms", () => {
    // "Securities Building | 2708 1st Ave N" — the right side is just the
    // street address, not a unit; should NOT be treated as a unit.
    expect(
      extractPropertyUnit("Securities Building | 2708 1st Ave N")
    ).toBeNull()
  })

  it("falls back to a short bare-token after the pipe as a unit", () => {
    // Real-world CSV row has lone "110" with no Unit/Suite token
    expect(extractPropertyUnit("West Park Promenade | 110")).toBe("110")
  })

  it("collapses to building key when paired with computePropertyKey", () => {
    // Two suites in the same building share the same propertyKey but have
    // distinct unit values — that's exactly what (propertyKey, unit) dedupe
    // requires.
    const a = "1601 Lewis | Suite 104"
    const b = "1601 Lewis | Suite 110"
    const keyA = computePropertyKey({ address: a })
    const keyB = computePropertyKey({ address: b })
    expect(keyA).toBe(keyB)
    expect(extractPropertyUnit(a)).not.toBe(extractPropertyUnit(b))
  })
})

describe("isPropertyType", () => {
  it("accepts the canonical PropertyType enum values", () => {
    expect(isPropertyType("industrial")).toBe(true)
    expect(isPropertyType("retail")).toBe(true)
  })

  it("rejects unknown strings and non-strings", () => {
    expect(isPropertyType("warehouse")).toBe(false)
    expect(isPropertyType(undefined)).toBe(false)
    expect(isPropertyType(123)).toBe(false)
  })
})

describe("parsePropertyCsv", () => {
  it("parses a typical property catalog with mixed header casing", () => {
    const csv = [
      "Name,Address,City,State,Zip,Property Type,Status,SQFT,List Price,URL",
      "Broadway Plaza,303 N Broadway,Billings,MT,59101,office,active,12000,$2500000,https://example.com/listing/1",
      "Casper Warehouse,21 Suite A Casper,Casper,WY,82601,industrial,under contract,40000,$5400000,",
    ].join("\n")
    const { rows, errors } = parsePropertyCsv(csv)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe("Broadway Plaza")
    expect(rows[0].propertyType).toBe("office")
    expect(rows[0].status).toBe("active")
    expect(rows[0].squareFeet).toBe(12000)
    expect(rows[0].listPrice).toBe(2500000)
    expect(rows[1].status).toBe("under_contract")
  })

  it("emits an error row when address is missing", () => {
    const csv = ["Name,Address", "No Address Property,"].join("\n")
    const { rows, errors } = parsePropertyCsv(csv)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/address/i)
  })

  it("ignores blank lines and trailing empty cells", () => {
    const csv = ["Address", "303 N Broadway", "", "  ", "100 Main St"].join(
      "\n"
    )
    const { rows } = parsePropertyCsv(csv)
    expect(rows).toHaveLength(2)
  })

  it("handles quoted values containing commas", () => {
    const csv = [
      "Name,Address,Description",
      '"Suite A, B and C","13 Colorado Ave","Mixed-use space, ground floor"',
    ].join("\n")
    const { rows } = parsePropertyCsv(csv)
    expect(rows[0].name).toBe("Suite A, B and C")
    expect(rows[0].description).toBe("Mixed-use space, ground floor")
  })

  it("recognizes status synonyms (sold, pending, leased, off-market)", () => {
    const csv = [
      "Address,Status",
      "1 A St,sold",
      "2 B St,pending",
      "3 C St,off-market",
    ].join("\n")
    const { rows } = parsePropertyCsv(csv)
    expect(rows.map((r) => r.status)).toEqual([
      "closed",
      "under_contract",
      "archived",
    ])
  })
})
