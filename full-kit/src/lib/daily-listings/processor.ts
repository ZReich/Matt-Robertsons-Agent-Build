import "server-only"

import type { SearchCriteria } from "@/lib/matching/property-criteria"
import type { Prisma, Property, PropertyType } from "@prisma/client"
import type { ParsedDailyListing } from "./parser"

import { generatePendingReply } from "@/lib/ai/auto-reply"
import { scorePropertyMatch } from "@/lib/matching/property-criteria"
import { findMatchesForProperty } from "@/lib/matching/queries"
import { sendMailAsMatt } from "@/lib/msgraph/send-mail"
import { db } from "@/lib/prisma"
import { getAutomationSettings } from "@/lib/system-state/automation-settings"

import { isDailyListingsEmail } from "./classifier"
import { parseDailyListings } from "./parser"

export interface ProcessOneResult {
  ok: true
  communicationId: string
  parsed: number
  newProperties: number
  existingProperties: number
  matchesEvaluated: number
  draftsCreated: number
  draftsSent: number
  errors: string[]
}

export interface ProcessOneSkip {
  ok: false
  reason: "not_a_daily_listings_email" | "communication_not_found" | "no_body"
  communicationId?: string
}

const PSEUDO_ADDRESS_PREFIX = "external-listing:"

/**
 * Convert a parsed listing into a stable property_key. We don't have a real
 * street address from these emails — only the listing URL — so the URL itself
 * is the dedupe key. The propertyKey column gets a "external-listing:" prefix
 * so a future lead-derived Property at the same actual address doesn't collide
 * with an external-only stub.
 */
function externalPropertyKey(url: string): string {
  return PSEUDO_ADDRESS_PREFIX + url.toLowerCase()
}

function inferAddressFromListing(listing: ParsedDailyListing): {
  address: string
  city: string | null
  state: string | null
} {
  // Best-effort address: the URL slug for Crexi often encodes the address
  // (e.g. "/montana-2901-w-broadway-street-102"). Decode the last slug and
  // strip the leading state.
  let inferred = ""
  try {
    const url = new URL(listing.url)
    const segments = url.pathname.split("/").filter(Boolean)
    const last = segments[segments.length - 1] ?? ""
    inferred = decodeURIComponent(last).replace(/-/g, " ").trim()
    inferred = inferred.replace(
      /^(montana|wyoming|north dakota|south dakota|idaho)\s+/i,
      ""
    )
  } catch {
    // not a URL we can parse; fall through
  }
  const address = inferred || listing.url
  const city =
    listing.townHint ||
    (listing.city !== "Other" && listing.city !== "Unknown"
      ? listing.city
      : null)
  return { address, city, state: city ? "MT" : null }
}

async function upsertPropertyForListing(
  listing: ParsedDailyListing
): Promise<{ property: Property; created: boolean }> {
  const key = externalPropertyKey(listing.url)
  const inferred = inferAddressFromListing(listing)
  const data = {
    address: inferred.address.slice(0, 250),
    city: inferred.city,
    state: inferred.state,
    propertyKey: key,
    propertyType: (listing.propertyType ?? null) as PropertyType | null,
    listingUrl: listing.url,
    source: "daily_listings",
    externalId: listing.url,
    tags: [
      "external_listing",
      "daily_listings",
      listing.platform,
      listing.saleOrLease,
      (listing.city || "").toLowerCase(),
    ].filter(Boolean) as Prisma.InputJsonValue,
  }
  const existing = await db.property.findFirst({
    where: { propertyKey: key, unit: null },
  })
  if (existing) {
    // Re-parse may have improved the city/type extraction since the row was
    // first created. Update the inferred fields in place. Don't touch fields
    // a human may have edited (status, listPrice, capRate, description).
    const updated = await db.property.update({
      where: { id: existing.id },
      data,
    })
    return { property: updated, created: false }
  }
  const created = await db.property.create({
    data: {
      ...data,
      status: "active",
      listedAt: new Date(),
      createdBy: "daily_listings_processor",
    },
  })
  return { property: created, created: true }
}

interface CandidateContact {
  id: string
  name: string
  email: string | null
  searchCriteria: unknown
  closedDealCount: number
}

async function loadCriteriaTaggedContacts(): Promise<CandidateContact[]> {
  const rows = await db.contact.findMany({
    where: {
      archivedAt: null,
      NOT: { searchCriteria: { equals: undefined } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      searchCriteria: true,
      _count: {
        select: {
          deals: { where: { stage: "closed" } },
        },
      },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    searchCriteria: r.searchCriteria,
    closedDealCount: r._count.deals,
  }))
}

function parseCriteria(value: unknown): SearchCriteria | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as SearchCriteria
}

async function dailyMatchCountForContact(contactId: string): Promise<number> {
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  return db.pendingReply.count({
    where: {
      contactId,
      createdAt: { gte: since },
      // Only count replies originated from a daily-listings property to keep
      // the cap scoped to this flow.
      property: { source: "daily_listings" },
    },
  })
}

/**
 * Process a single Daily Listings email by id. Idempotent on the parse step
 * (existing Property rows are reused) but NOT idempotent on the draft step
 * (re-running on the same Communication will create duplicate drafts unless
 * the metadata flag is checked). The route caller should guard against this.
 */
export async function processDailyListingsEmail(
  communicationId: string
): Promise<ProcessOneResult | ProcessOneSkip> {
  const comm = await db.communication.findUnique({
    where: { id: communicationId },
    select: { id: true, subject: true, body: true, metadata: true, date: true },
  })
  if (!comm) return { ok: false, reason: "communication_not_found" }
  if (
    !isDailyListingsEmail({ subject: comm.subject, metadata: comm.metadata })
  ) {
    return { ok: false, reason: "not_a_daily_listings_email", communicationId }
  }
  if (!comm.body) return { ok: false, reason: "no_body", communicationId }

  const settings = await getAutomationSettings()
  const { listings } = parseDailyListings(comm.body)
  const errors: string[] = []
  let newProperties = 0
  let existingProperties = 0
  let matchesEvaluated = 0
  let draftsCreated = 0
  let draftsSent = 0

  const candidates = await loadCriteriaTaggedContacts()

  for (const listing of listings) {
    let property: Property
    try {
      const upsert = await upsertPropertyForListing(listing)
      property = upsert.property
      if (upsert.created) newProperties++
      else existingProperties++
    } catch (e) {
      errors.push(
        `upsert ${listing.url}: ${e instanceof Error ? e.message : "unknown"}`
      )
      continue
    }

    for (const candidate of candidates) {
      // Skip contacts that have closed deals — Matt's note: "unless they have
      // already closed a deal." Per-contact opt-out via `do-not-contact` tag
      // is enforced by the auto-reply generator's existing filters; we can
      // also short-circuit here in the future if perf demands it.
      if (candidate.closedDealCount > 0) continue
      const criteria = parseCriteria(candidate.searchCriteria)
      if (!criteria) continue

      matchesEvaluated++
      const score = scorePropertyMatch(property, criteria)
      if (score.score < settings.autoMatchScoreThreshold) continue
      if (!candidate.email) continue

      // Per-contact daily cap.
      const todayCount = await dailyMatchCountForContact(candidate.id)
      if (todayCount >= settings.dailyMatchPerContactCap) continue

      const draft = await generatePendingReply({
        propertyId: property.id,
        contactId: candidate.id,
        // No specific inbound message triggered this — the Daily Listings
        // digest is the trigger. Pass the digest comm ID for traceability.
        triggerCommunicationId: comm.id,
        outreachKind: "market_alert",
        persist: true,
      })

      if (!draft.ok) {
        errors.push(
          `draft ${candidate.email}/${property.id}: ${draft.reason}${draft.details ? " — " + draft.details : ""}`
        )
        continue
      }
      draftsCreated++

      if (settings.autoSendDailyMatchReplies && draft.pendingReplyId) {
        const sendResult = await sendMailAsMatt({
          subject: draft.draft.subject,
          body: draft.draft.body,
          contentType: "Text",
          toRecipients: [{ address: candidate.email, name: candidate.name }],
          saveToSentItems: true,
        })
        if (sendResult.ok) {
          await db.pendingReply.update({
            where: { id: draft.pendingReplyId },
            data: {
              status: "approved",
              approvedAt: new Date(),
              approvedBy: "auto-send-daily-matches",
            },
          })
          draftsSent++
        } else {
          errors.push(
            `send ${candidate.email}: ${sendResult.reason}${sendResult.details ? " — " + sendResult.details : ""}`
          )
        }
      }
    }
  }

  // Stamp the source Communication so we don't re-process on the next sweep.
  const newMeta = {
    ...((comm.metadata as Record<string, unknown> | null) ?? {}),
    dailyListingsProcessed: {
      processedAt: new Date().toISOString(),
      listingsParsed: listings.length,
      newProperties,
      existingProperties,
      draftsCreated,
      draftsSent,
    },
  }
  await db.communication.update({
    where: { id: comm.id },
    data: { metadata: newMeta as unknown as Prisma.InputJsonValue },
  })

  return {
    ok: true,
    communicationId: comm.id,
    parsed: listings.length,
    newProperties,
    existingProperties,
    matchesEvaluated,
    draftsCreated,
    draftsSent,
    errors,
  }
}

/**
 * Sweep: find all unprocessed Daily Listings emails (subject + sender match,
 * no `dailyListingsProcessed` metadata stamp) within the lookback window and
 * process each. Useful as a cron and as a backfill.
 */
export async function processUnprocessedDailyListings(
  options: {
    lookbackDays?: number
    limit?: number
  } = {}
): Promise<{
  candidates: number
  processed: number
  results: Array<ProcessOneResult | ProcessOneSkip>
}> {
  const { lookbackDays = 14, limit = 50 } = options
  const since = new Date()
  since.setDate(since.getDate() - lookbackDays)

  const candidates = await db.communication.findMany({
    where: {
      direction: "inbound",
      date: { gte: since },
      subject: { contains: "Daily Listings", mode: "insensitive" },
    },
    select: { id: true, metadata: true },
    orderBy: { date: "desc" },
    take: limit,
  })

  const unprocessed = candidates.filter((c) => {
    const meta = c.metadata as Record<string, unknown> | null
    return !meta?.dailyListingsProcessed
  })

  const results: Array<ProcessOneResult | ProcessOneSkip> = []
  for (const c of unprocessed) {
    results.push(await processDailyListingsEmail(c.id))
  }
  return {
    candidates: candidates.length,
    processed: results.length,
    results,
  }
}

// Surface for tests and admin tooling.
export { findMatchesForProperty }
