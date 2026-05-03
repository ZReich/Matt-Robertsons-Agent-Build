import type { PropertyType } from "@prisma/client"

import { normalizeBuildoutProperty } from "@/lib/buildout/property-normalizer"

const PROPERTY_TYPES: PropertyType[] = [
  "office",
  "retail",
  "industrial",
  "multifamily",
  "land",
  "mixed_use",
  "hospitality",
  "medical",
  "other",
]

const PROPERTY_TYPE_SET = new Set<string>(PROPERTY_TYPES)

export function isPropertyType(value: unknown): value is PropertyType {
  return typeof value === "string" && PROPERTY_TYPE_SET.has(value)
}

export const PROPERTY_TYPE_VALUES: ReadonlyArray<PropertyType> = PROPERTY_TYPES

/**
 * Derive the canonical propertyKey for a Property record. Reuses the existing
 * Buildout normalizer so the catalog joins to inbound lead extractors and
 * Deal.propertyKey on identical strings (e.g., "303 N Broadway" → "303 n broadway").
 *
 * Combines `address` with `city`, `state`, `zip` so addresses missing the city
 * suffix in the input field still normalize correctly.
 */
export function computePropertyKey(input: {
  address: string
  unit?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}): string {
  const parts = [input.address.trim()]
  if (input.city?.trim()) parts.push(input.city.trim())
  if (input.state?.trim()) parts.push(input.state.trim())
  if (input.zip?.trim()) parts.push(input.zip.trim())
  const combined = parts.join(", ")
  const normalized = normalizeBuildoutProperty(combined)
  if (normalized?.normalizedPropertyKey) {
    return normalized.normalizedPropertyKey
  }
  // Fallback: lowercase + collapse whitespace + strip punctuation. Keeps the
  // catalog functional even when the address is so non-standard the parser
  // can't extract a number-prefixed token.
  return combined
    .toLowerCase()
    .replace(/[.,|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export interface PropertyImportRow {
  name?: string
  address: string
  unit?: string
  city?: string
  state?: string
  zip?: string
  propertyType?: PropertyType
  status?: "active" | "under_contract" | "closed" | "archived"
  squareFeet?: number
  occupiedSquareFeet?: number
  listPrice?: number
  capRate?: number
  listingUrl?: string
  flyerUrl?: string
  description?: string
}

export interface PropertyImportError {
  row: number
  reason: string
  raw: Record<string, string>
}

export interface PropertyImportParseResult {
  rows: PropertyImportRow[]
  errors: PropertyImportError[]
}

/**
 * Parse a CSV blob into typed property rows. Handles quoted values, escapes,
 * blank rows, and header normalization (case-insensitive, snake/camel/space).
 *
 * Header aliases recognized:
 *   address      ← address, street_address, property_address, street
 *   name         ← name, property_name, listing_name
 *   unit         ← unit, suite, ste
 *   city         ← city
 *   state        ← state, st (only when 2 chars)
 *   zip          ← zip, postal_code
 *   propertyType ← type, property_type
 *   status       ← status
 *   squareFeet   ← sqft, square_feet, sf, total_sqft
 *   occupiedSquareFeet ← occupied_sqft, occupied_square_feet, leased_sqft
 *   listPrice    ← price, list_price, asking_price
 *   capRate      ← cap_rate, cap
 *   listingUrl   ← url, listing_url, link, flyer
 *   flyerUrl     ← flyer_url, brochure
 *   description  ← description, notes
 */
export function parsePropertyCsv(csv: string): PropertyImportParseResult {
  const rows: PropertyImportRow[] = []
  const errors: PropertyImportError[] = []
  const records = parseCsvRecords(csv)
  if (records.length === 0) return { rows, errors }
  const headers = records[0].map(normalizeHeader)
  for (let i = 1; i < records.length; i++) {
    const record = records[i]
    if (record.every((cell) => cell.trim() === "")) continue
    const raw: Record<string, string> = {}
    headers.forEach((h, idx) => {
      raw[h] = record[idx] ?? ""
    })
    const address = pickString(raw, [
      "address",
      "street_address",
      "property_address",
      "street",
    ])
    if (!address) {
      errors.push({ row: i + 1, reason: "address is required", raw })
      continue
    }
    const propertyTypeStr = pickString(raw, ["type", "property_type"])
    const statusStr = pickString(raw, ["status"])
    const status = parseStatus(statusStr)
    const propertyType = isPropertyType(propertyTypeStr)
      ? propertyTypeStr
      : undefined
    const row: PropertyImportRow = {
      address,
      ...(pickString(raw, ["name", "property_name", "listing_name"]) && {
        name: pickString(raw, ["name", "property_name", "listing_name"]),
      }),
      ...(pickString(raw, ["unit", "suite", "ste"]) && {
        unit: pickString(raw, ["unit", "suite", "ste"]),
      }),
      ...(pickString(raw, ["city"]) && { city: pickString(raw, ["city"]) }),
      ...(parseStateAbbrev(pickString(raw, ["state", "st"])) && {
        state: parseStateAbbrev(pickString(raw, ["state", "st"])),
      }),
      ...(pickString(raw, ["zip", "postal_code"]) && {
        zip: pickString(raw, ["zip", "postal_code"]),
      }),
      ...(propertyType && { propertyType }),
      ...(status && { status }),
      ...(parseNumber(pickString(raw, ["sqft", "square_feet", "sf", "total_sqft"])) !==
        undefined && {
        squareFeet: parseNumber(
          pickString(raw, ["sqft", "square_feet", "sf", "total_sqft"])
        ),
      }),
      ...(parseNumber(
        pickString(raw, [
          "occupied_sqft",
          "occupied_square_feet",
          "leased_sqft",
        ])
      ) !== undefined && {
        occupiedSquareFeet: parseNumber(
          pickString(raw, [
            "occupied_sqft",
            "occupied_square_feet",
            "leased_sqft",
          ])
        ),
      }),
      ...(parseNumber(pickString(raw, ["price", "list_price", "asking_price"])) !==
        undefined && {
        listPrice: parseNumber(
          pickString(raw, ["price", "list_price", "asking_price"])
        ),
      }),
      ...(parseNumber(pickString(raw, ["cap_rate", "cap"])) !== undefined && {
        capRate: parseNumber(pickString(raw, ["cap_rate", "cap"])),
      }),
      ...(pickString(raw, ["url", "listing_url", "link"]) && {
        listingUrl: pickString(raw, ["url", "listing_url", "link"]),
      }),
      ...(pickString(raw, ["flyer", "flyer_url", "brochure"]) && {
        flyerUrl: pickString(raw, ["flyer", "flyer_url", "brochure"]),
      }),
      ...(pickString(raw, ["description", "notes"]) && {
        description: pickString(raw, ["description", "notes"]),
      }),
    }
    rows.push(row)
  }
  return { rows, errors }
}

function pickString(
  source: Record<string, string>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const v = source[key]
    if (typeof v === "string" && v.trim().length > 0) return v.trim()
  }
  return undefined
}

function parseStatus(
  value: string | undefined
): PropertyImportRow["status"] | undefined {
  if (!value) return undefined
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_")
  if (normalized === "active") return "active"
  if (normalized === "under_contract" || normalized === "pending")
    return "under_contract"
  if (normalized === "closed" || normalized === "sold" || normalized === "leased")
    return "closed"
  if (normalized === "archived" || normalized === "off_market") return "archived"
  return undefined
}

function parseStateAbbrev(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (trimmed.length === 2) return trimmed.toUpperCase()
  return trimmed
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const cleaned = value.replace(/[$,%\s]/g, "")
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s\-/]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
}

function parseCsvRecords(csv: string): string[][] {
  const result: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false
  let i = 0
  const text = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 2
        continue
      }
      if (ch === '"') {
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ",") {
      row.push(cell)
      cell = ""
      i++
      continue
    }
    if (ch === "\n") {
      row.push(cell)
      result.push(row)
      row = []
      cell = ""
      i++
      continue
    }
    cell += ch
    i++
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    result.push(row)
  }
  return result
}

export const PROPERTY_STATUS_VALUES = [
  "active",
  "under_contract",
  "closed",
  "archived",
] as const
