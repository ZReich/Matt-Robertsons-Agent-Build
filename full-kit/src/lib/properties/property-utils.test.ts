import { describe, expect, it } from "vitest"

import {
  computePropertyKey,
  isPropertyType,
  parsePropertyCsv,
} from "./property-utils"

describe("computePropertyKey", () => {
  it("normalizes directionals + street suffixes the same as the buildout normalizer", () => {
    const a = computePropertyKey({ address: "303 North Broadway", city: "Billings", state: "MT", zip: "59101" })
    const b = computePropertyKey({ address: "303 N Broadway", city: "Billings", state: "MT", zip: "59101" })
    expect(a).toBe(b)
    expect(a).toContain("303 n broadway")
  })

  it("falls back to a lowercased trimmed key when no street-number prefix is present", () => {
    const key = computePropertyKey({ address: "Some Named Property", city: "Billings", state: "MT" })
    expect(key).toContain("some named property")
  })

  it("strips punctuation and collapses whitespace in the fallback path", () => {
    const key = computePropertyKey({ address: "Acme | Plaza, , .", city: "" })
    expect(key.trim()).toBe(key)
    expect(key).not.toMatch(/[.,|]/)
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
    const csv = [
      "Address",
      "303 N Broadway",
      "",
      "  ",
      "100 Main St",
    ].join("\n")
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
