/**
 * Parser for the "Daily Listings" emails Ty sends to Matt + a small NAI list.
 * Sender: data@naibusinessproperties.com (display name "Data").
 * Subject: "Daily Listings" (exact, occasionally suffixed with a date).
 *
 * Body format observed (2026-04-15 → 2026-04-29 sample):
 *
 *   Helena
 *   Office for Lease
 *   https://www.crexi.com/lease/properties/...
 *   https://www.crexi.com/lease/properties/...
 *
 *   Missoula
 *   Office for Lease
 *   https://www.crexi.com/lease/properties/...
 *
 *   Retail for Lease
 *   https://www.crexi.com/lease/properties/...
 *
 *   Other
 *   Retail – Molt
 *   https://portal.onehome.com/...
 *
 *   Office – Whitefish
 *   https://www.crexi.com/properties/...
 *
 * Conventions:
 *   - A non-URL line is either a city header (whitespace-only above it) OR
 *     a category sub-header (e.g. "Office for Lease", "Retail – Molt").
 *   - The "Other" section uses dash-suffixed category lines that include
 *     a city/town name after a hyphen.
 *   - URLs are bare; one per line; mostly Crexi, occasionally OneHome.
 *
 * The parser is intentionally permissive — if Ty changes whitespace or adds
 * a new city, listings still get extracted as "uncategorized" rather than
 * dropped on the floor.
 */

const URL_PATTERN = /^https?:\/\/[^\s<>]+$/i

const KNOWN_TYPES: Record<
  string,
  | "office"
  | "retail"
  | "industrial"
  | "land"
  | "multifamily"
  | "mixed_use"
  | "hospitality"
  | "other"
> = {
  office: "office",
  retail: "retail",
  industrial: "industrial",
  warehouse: "industrial",
  land: "land",
  multifamily: "multifamily",
  "multi-family": "multifamily",
  apartment: "multifamily",
  apartments: "multifamily",
  mixed: "mixed_use",
  "mixed-use": "mixed_use",
  "mixed use": "mixed_use",
  hospitality: "hospitality",
  hotel: "hospitality",
  "self-storage": "other",
  "self storage": "other",
  storage: "other",
  "special purpose": "other",
  "special use": "other",
  development: "land",
}

// Lines that match any of these are treated as category headers, not cities,
// regardless of casing or word count. Format observed in real Daily Listings:
//   "Multi-family", "Commercial Land", "Industrial", "Retail", "Office",
//   "Office/Industrial", "Retail/Office", "Multi-family/Office",
//   "Industrial for Lease", "Retail for Lease – Billings", etc.
const CATEGORY_KEYWORDS = [
  "office",
  "retail",
  "industrial",
  "warehouse",
  "multi-family",
  "multifamily",
  "land",
  "mixed",
  "hospitality",
  "hotel",
  "storage",
  "special purpose",
  "special use",
  "development",
  "apartment",
  "commercial",
]

function looksLikeCategory(line: string): boolean {
  const lower = line.toLowerCase()
  for (const kw of CATEGORY_KEYWORDS) {
    if (lower.includes(kw)) return true
  }
  return false
}

const FOR_LEASE_PATTERN = /\s+for\s+(lease|rent|sale)\s*$/i
const CATEGORY_DASH_PATTERN = /^(.+?)\s+[–\-—]\s+(.+)$/

// City sentinels used to recognize a header line. We don't constrain to a
// fixed list — anything that's not a URL and not obviously a category is
// treated as a possible city. These known names just bump confidence.
const KNOWN_MT_CITIES = new Set([
  "billings",
  "missoula",
  "helena",
  "bozeman",
  "great falls",
  "kalispell",
  "butte",
  "anaconda",
  "havre",
  "miles city",
  "laurel",
  "whitefish",
  "polson",
  "livingston",
  "molt",
  "other",
])

export interface ParsedDailyListing {
  /** Best-guess city for this listing. May be "Other" or "" if unknown. */
  city: string
  /** Free-text category as it appeared in the email (e.g. "Office for Lease"). */
  rawCategory: string
  /** Normalized PropertyType derivable from rawCategory, or null. */
  propertyType:
    | "office"
    | "retail"
    | "industrial"
    | "land"
    | "multifamily"
    | "mixed_use"
    | "hospitality"
    | "other"
    | null
  /** Listing URL — Crexi, LoopNet, OneHome, etc. */
  url: string
  /** Source-platform inferred from the URL host (crexi, loopnet, onehome, other). */
  platform: "crexi" | "loopnet" | "onehome" | "other"
  /** Listing kind — lease, sale, or unknown. */
  saleOrLease: "lease" | "sale" | "unknown"
  /** Free-text town/locality if the category line had a `Foo – Town` format. */
  townHint: string | null
}

export interface DailyListingsParseResult {
  listings: ParsedDailyListing[]
  /** Lines we couldn't classify — useful for surfacing parser drift. */
  warnings: string[]
}

function inferPlatform(url: string): ParsedDailyListing["platform"] {
  const lower = url.toLowerCase()
  if (lower.includes("crexi.com")) return "crexi"
  if (lower.includes("loopnet.com")) return "loopnet"
  if (lower.includes("onehome.com")) return "onehome"
  return "other"
}

function inferType(rawCategory: string): {
  type: ParsedDailyListing["propertyType"]
  saleOrLease: ParsedDailyListing["saleOrLease"]
  townHint: string | null
} {
  let category = rawCategory.trim()
  let townHint: string | null = null

  // "Foo – TownName" form (used in "Other" sections).
  const dashMatch = category.match(CATEGORY_DASH_PATTERN)
  if (dashMatch) {
    category = dashMatch[1].trim()
    townHint = dashMatch[2].trim()
  }

  let saleOrLease: ParsedDailyListing["saleOrLease"] = "unknown"
  const leaseMatch = category.match(FOR_LEASE_PATTERN)
  if (leaseMatch) {
    const word = leaseMatch[1].toLowerCase()
    saleOrLease = word === "sale" ? "sale" : "lease"
    category = category.replace(FOR_LEASE_PATTERN, "").trim()
  }

  const lowered = category.toLowerCase()
  let type: ParsedDailyListing["propertyType"] = null
  for (const [keyword, mapped] of Object.entries(KNOWN_TYPES)) {
    if (lowered.includes(keyword)) {
      type = mapped
      break
    }
  }

  return { type, saleOrLease, townHint }
}

function isLikelyCity(line: string): boolean {
  if (!line) return false
  if (line.length > 32) return false
  if (URL_PATTERN.test(line)) return false
  if (FOR_LEASE_PATTERN.test(line)) return false
  if (line.includes("–") || line.includes("—")) return false
  // Categories are never cities, even if short and Title Case.
  if (looksLikeCategory(line)) return false
  // A bare city is usually 1–3 words, no commas.
  const wordCount = line.trim().split(/\s+/).length
  if (wordCount > 3) return false
  if (line.includes(",")) return false
  // Known cities flag immediately.
  if (KNOWN_MT_CITIES.has(line.trim().toLowerCase())) return true
  // Otherwise: short Title Case looks city-ish.
  return /^[A-Z][a-zA-Z]/.test(line.trim())
}

export function parseDailyListings(body: string): DailyListingsParseResult {
  const listings: ParsedDailyListing[] = []
  const warnings: string[] = []
  if (!body) return { listings, warnings }

  const lines = body.replace(/\r\n/g, "\n").split("\n")
  let currentCity = ""
  let currentCategory = ""

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    if (URL_PATTERN.test(line)) {
      const inferred = inferType(currentCategory || "")
      listings.push({
        city: currentCity || "Unknown",
        rawCategory: currentCategory || "Uncategorized",
        propertyType: inferred.type,
        url: line,
        platform: inferPlatform(line),
        saleOrLease: inferred.saleOrLease,
        townHint: inferred.townHint,
      })
      continue
    }

    if (isLikelyCity(line)) {
      currentCity = line
      currentCategory = ""
      continue
    }

    // Otherwise, treat as a category line (Office for Lease / Retail – Molt / etc.)
    currentCategory = line
  }

  return { listings, warnings }
}
