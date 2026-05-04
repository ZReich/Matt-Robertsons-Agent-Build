import "server-only"

import type { SearchCriteria } from "./property-criteria"

import { db } from "@/lib/prisma"

import { MIN_USEFUL_SCORE, scorePropertyMatch } from "./property-criteria"

export interface PropertyMatchForContact {
  property: {
    id: string
    name: string | null
    address: string
    propertyType: string | null
    status: string
    squareFeet: number | null
    listPrice: number | null
    city: string | null
    state: string | null
    listingUrl: string | null
  }
  score: number
  reasons: string[]
}

export interface ContactMatchForProperty {
  contact: {
    id: string
    name: string
    company: string | null
    email: string | null
    phone: string | null
    tags: string[]
    leadStatus: string | null
  }
  score: number
  reasons: string[]
}

function parseCriteria(value: unknown): SearchCriteria | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const c = value as SearchCriteria
  // Empty / no-op criteria object (saved as `{}` by older code paths) would
  // make every property look like a perfect match. Treat it as "no criteria"
  // instead.
  const hasAny =
    (Array.isArray(c.propertyTypes) && c.propertyTypes.length > 0) ||
    typeof c.minSqft === "number" ||
    typeof c.maxSqft === "number" ||
    typeof c.minPrice === "number" ||
    typeof c.maxPrice === "number" ||
    (Array.isArray(c.locations) && c.locations.length > 0) ||
    (typeof c.notes === "string" && c.notes.trim().length > 0)
  return hasAny ? c : null
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string")
}

/**
 * For a given property, find every criteria-tagged contact whose criteria
 * scores ≥ MIN_USEFUL_SCORE against this property. Sorted high-to-low.
 *
 * Used on the Property detail page (Phase D) and the auto-reply pipeline
 * (Phase E) to surface "you might also like…" cross-references.
 */
export async function findMatchesForProperty(
  propertyId: string,
  options: { limit?: number; minScore?: number } = {}
): Promise<ContactMatchForProperty[]> {
  const { limit = 25, minScore = MIN_USEFUL_SCORE } = options
  const property = await db.property.findUnique({ where: { id: propertyId } })
  if (!property) return []
  // Pull only contacts that have a non-null searchCriteria. Doing this in DB
  // saves us from scoring every contact in the world.
  const candidates = await db.contact.findMany({
    where: {
      archivedAt: null,
      NOT: { searchCriteria: { equals: undefined } },
    },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      phone: true,
      tags: true,
      leadStatus: true,
      searchCriteria: true,
    },
  })

  const scored: ContactMatchForProperty[] = []
  for (const c of candidates) {
    const criteria = parseCriteria(c.searchCriteria)
    if (!criteria) continue
    const result = scorePropertyMatch(property, criteria)
    if (result.score < minScore) continue
    scored.push({
      contact: {
        id: c.id,
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone,
        tags: parseTags(c.tags),
        leadStatus: c.leadStatus,
      },
      score: result.score,
      reasons: result.reasons,
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

/**
 * For a given contact (presumed buyer/tenant/investor), find properties in
 * the catalog that match their criteria with score ≥ minScore.
 *
 * Used on the Contact detail page to show what's already on Matt's plate
 * that might be a fit.
 */
export async function findMatchesForContact(
  contactId: string,
  options: {
    limit?: number
    minScore?: number
    includeStatuses?: Array<"active" | "under_contract" | "closed">
  } = {}
): Promise<PropertyMatchForContact[]> {
  const {
    limit = 25,
    minScore = MIN_USEFUL_SCORE,
    includeStatuses = ["active", "under_contract"],
  } = options
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    select: { searchCriteria: true },
  })
  const criteria = parseCriteria(contact?.searchCriteria)
  if (!criteria) return []

  const properties = await db.property.findMany({
    where: { archivedAt: null, status: { in: includeStatuses } },
  })

  const scored: PropertyMatchForContact[] = []
  for (const p of properties) {
    const result = scorePropertyMatch(p, criteria)
    if (result.score < minScore) continue
    scored.push({
      property: {
        id: p.id,
        name: p.name,
        address: p.address,
        propertyType: p.propertyType,
        status: p.status,
        squareFeet: p.squareFeet,
        listPrice: p.listPrice ? Number(p.listPrice) : null,
        city: p.city,
        state: p.state,
        listingUrl: p.listingUrl,
      },
      score: result.score,
      reasons: result.reasons,
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}
