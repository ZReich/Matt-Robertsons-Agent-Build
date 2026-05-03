import type { Property, PropertyType } from "@prisma/client"

export interface SearchCriteria {
  propertyTypes?: PropertyType[]
  minSqft?: number
  maxSqft?: number
  minPrice?: number
  maxPrice?: number
  locations?: string[]
  notes?: string
}

export interface MatchScore {
  /** 0-100 weighted score. */
  score: number
  /** Component breakdown so the UI can explain why something matched. */
  reasons: string[]
}

const WEIGHT_TYPE = 40
const WEIGHT_SQFT = 25
const WEIGHT_LOCATION = 25
const WEIGHT_PRICE = 10

/**
 * Score a property against a buyer/tenant search criteria. Returns
 * `{score, reasons}` where score is 0-100. The function is pure and
 * deterministic — no I/O, no randomness — so it's cheap to run on every
 * (property, criteria) pair.
 *
 * Scoring weights (arbitrary but reasonable defaults):
 *   - property type match:  40
 *   - sqft inside band:     25 (graceful degradation when one side missing)
 *   - location match:       25 (substring match against city, address, state)
 *   - price within band:    10
 *
 * If a criteria component is missing (e.g. no propertyTypes specified), the
 * weight for that component is awarded automatically — the user said "anything
 * matches" by leaving it blank.
 */
export function scorePropertyMatch(
  property: Pick<
    Property,
    | "propertyType"
    | "squareFeet"
    | "city"
    | "address"
    | "state"
    | "listPrice"
    | "status"
  >,
  criteria: SearchCriteria | null | undefined
): MatchScore {
  const reasons: string[] = []
  if (!criteria) return { score: 0, reasons: ["no criteria set"] }

  let score = 0

  // Property type
  if (!criteria.propertyTypes || criteria.propertyTypes.length === 0) {
    score += WEIGHT_TYPE
    reasons.push("no type preference")
  } else if (
    property.propertyType &&
    criteria.propertyTypes.includes(property.propertyType)
  ) {
    score += WEIGHT_TYPE
    reasons.push(`type: ${property.propertyType.replace(/_/g, " ")}`)
  } else if (!property.propertyType) {
    // Property has no type recorded — partial credit since we can't disprove.
    score += Math.round(WEIGHT_TYPE * 0.3)
    reasons.push("type unknown on property")
  } else {
    reasons.push(
      `type mismatch (wants ${criteria.propertyTypes.join("/")}, got ${property.propertyType})`
    )
  }

  // SQFT
  if (criteria.minSqft === undefined && criteria.maxSqft === undefined) {
    score += WEIGHT_SQFT
    reasons.push("no sqft preference")
  } else if (property.squareFeet === null || property.squareFeet === undefined) {
    score += Math.round(WEIGHT_SQFT * 0.3)
    reasons.push("sqft unknown on property")
  } else {
    const sqft = property.squareFeet
    const min = criteria.minSqft ?? 0
    const max = criteria.maxSqft ?? Infinity
    if (sqft >= min && sqft <= max) {
      score += WEIGHT_SQFT
      reasons.push(`${sqft.toLocaleString()} sqft in band`)
    } else {
      // Graceful: partial credit if within ±20%.
      const tolMin = min * 0.8
      const tolMax = max * 1.2
      if (sqft >= tolMin && sqft <= tolMax) {
        score += Math.round(WEIGHT_SQFT * 0.5)
        reasons.push(`${sqft.toLocaleString()} sqft just outside band`)
      } else {
        reasons.push(`${sqft.toLocaleString()} sqft far from band`)
      }
    }
  }

  // Location
  if (!criteria.locations || criteria.locations.length === 0) {
    score += WEIGHT_LOCATION
    reasons.push("no location preference")
  } else {
    const haystack = [property.city, property.address, property.state]
      .filter((s): s is string => typeof s === "string")
      .join(" ")
      .toLowerCase()
    const matched = criteria.locations.find((loc) =>
      haystack.includes(loc.toLowerCase())
    )
    if (matched) {
      score += WEIGHT_LOCATION
      reasons.push(`location: ${matched}`)
    } else {
      reasons.push(`location not in ${criteria.locations.join(", ")}`)
    }
  }

  // Price
  if (criteria.minPrice === undefined && criteria.maxPrice === undefined) {
    score += WEIGHT_PRICE
    reasons.push("no price preference")
  } else if (property.listPrice === null || property.listPrice === undefined) {
    // Price unknown gets partial credit — many CRE listings are priced on request.
    score += Math.round(WEIGHT_PRICE * 0.5)
    reasons.push("price not listed (call for price)")
  } else {
    const price = Number(property.listPrice)
    const min = criteria.minPrice ?? 0
    const max = criteria.maxPrice ?? Infinity
    if (price >= min && price <= max) {
      score += WEIGHT_PRICE
      reasons.push(`$${price.toLocaleString()} in budget`)
    } else if (price >= min * 0.85 && price <= max * 1.15) {
      score += Math.round(WEIGHT_PRICE * 0.5)
      reasons.push(`$${price.toLocaleString()} just outside budget`)
    } else {
      reasons.push(`$${price.toLocaleString()} outside budget`)
    }
  }

  // Status nudge: archived properties shouldn't match even if perfect.
  if (property.status === "archived") {
    score = 0
    reasons.unshift("property archived")
  }

  return { score, reasons }
}

/**
 * Threshold above which we surface a property↔criteria pair to the user.
 * Below this, the match is too weak to be worth showing.
 */
export const MIN_USEFUL_SCORE = 50
