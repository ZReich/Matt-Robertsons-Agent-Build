import type { LeadSource, Prisma } from "@prisma/client"
import type { PipelineFilters } from "./board"

import { db } from "@/lib/prisma"

import { getMissedFollowupCutoff } from "./followups"

/**
 * Pending platform-lead candidates — LoopNet/Crexi/Buildout inquirers
 * extracted from inbound emails but not yet promoted to a Contact (still
 * sitting in `contact_promotion_candidates`).
 *
 * These rows DON'T appear in the regular `Contact` lead query because they
 * aren't Contact rows yet, but Matt's Leads tab should still surface them
 * — they ARE inbound leads, just unreviewed. Each row links to the
 * candidate review queue rather than a /pages/leads/<id> detail page.
 */
export type PendingLeadCandidate = {
  id: string
  displayName: string | null
  company: string | null
  normalizedEmail: string | null
  message: string | null
  sourcePlatform: string | null
  sourceKind: string | null
  evidenceCount: number
  firstSeenAt: Date
  lastSeenAt: Date
  evidence: {
    subject: string | null
    body: string | null
    direction: "inbound" | "outbound" | null
    metadata: unknown
  } | null
}

const REVIEWABLE_STATUSES = ["pending", "needs_more_evidence"] as const

const PLATFORM_TO_LEAD_SOURCE: Record<string, LeadSource> = {
  loopnet: "loopnet",
  crexi: "crexi",
  buildout: "buildout",
}

export async function getPendingLeadCandidatesForPipeline(
  filters: PipelineFilters,
  now = new Date()
): Promise<PendingLeadCandidate[]> {
  const followupCutoff = getMissedFollowupCutoff(now)
  // Match the contact-side terminal cutoff in leads-query.ts:123 — a
  // promoted lead that's been inactive >30 days falls out of the default
  // view; apply the same window to candidates.
  const terminalCutoff = new Date(now.getTime() - 30 * 86_400_000)

  const where: Prisma.ContactPromotionCandidateWhereInput = {
    status: { in: [...REVIEWABLE_STATUSES] },
    // Surface only candidates derived from a known platform inquiry path —
    // skip the "historical-email-sender-backfill" type that produces
    // service-address noise we don't want cluttering the Leads tab.
    sourcePlatform: { in: Object.keys(PLATFORM_TO_LEAD_SOURCE) },
  }

  if (filters.source) {
    // PipelineFilters.source uses the LeadSource enum strings; map back to
    // the candidate's sourcePlatform string column.
    const platform = Object.entries(PLATFORM_TO_LEAD_SOURCE).find(
      ([, leadSource]) => leadSource === filters.source
    )?.[0]
    if (!platform) return [] // filter is for a source we never queue as a candidate
    where.sourcePlatform = platform
  }

  // needsFollowup filter: a never-reviewed candidate IS by definition
  // awaiting attention, but we only want to surface ones older than the
  // followup cutoff so the panel doesn't redundantly include candidates
  // that just landed.
  if (filters.needsFollowup) {
    where.firstSeenAt = { lt: followupCutoff }
  } else if (!filters.showAll) {
    // Default view: hide candidates that have been sitting untouched past
    // the same terminal cutoff used for promoted leads.
    where.lastSeenAt = { gte: terminalCutoff }
  }

  if (filters.search) {
    where.OR = [
      { displayName: { contains: filters.search, mode: "insensitive" } },
      { normalizedEmail: { contains: filters.search, mode: "insensitive" } },
      { company: { contains: filters.search, mode: "insensitive" } },
      { message: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  const candidates = await db.contactPromotionCandidate.findMany({
    where,
    orderBy: [{ lastSeenAt: "desc" }, { firstSeenAt: "desc" }],
    select: {
      id: true,
      displayName: true,
      company: true,
      normalizedEmail: true,
      message: true,
      sourcePlatform: true,
      sourceKind: true,
      evidenceCount: true,
      firstSeenAt: true,
      lastSeenAt: true,
      communicationId: true,
    },
  })
  if (candidates.length === 0) return []

  // Pull the linked evidence comm in one batch so the row can render a
  // subject + body snippet matching the promoted-lead UI.
  const commIds = candidates
    .map((c) => c.communicationId)
    .filter((id): id is string => !!id)
  const comms = commIds.length
    ? await db.communication.findMany({
        where: { id: { in: commIds } },
        select: {
          id: true,
          subject: true,
          body: true,
          direction: true,
          metadata: true,
        },
      })
    : []
  const commsById = new Map(comms.map((c) => [c.id, c]))

  return candidates
    .map((c) => ({
      id: c.id,
      displayName: c.displayName,
      company: c.company,
      normalizedEmail: c.normalizedEmail,
      message: c.message,
      sourcePlatform: c.sourcePlatform,
      sourceKind: c.sourceKind,
      evidenceCount: c.evidenceCount,
      firstSeenAt: c.firstSeenAt,
      lastSeenAt: c.lastSeenAt,
      evidence: c.communicationId
        ? (commsById.get(c.communicationId) ?? null)
        : null,
    }))
    .filter((row) => {
      // Use firstSeenAt for age bucketing — that matches the `leadAt`
      // semantics on promoted contacts ("when did this lead originate?"),
      // not lastSeenAt which is "last activity touch."
      if (!filters.age) return true
      const days = Math.floor(
        (now.getTime() - row.firstSeenAt.getTime()) / 86_400_000
      )
      switch (filters.age) {
        case "lt7":
          return days < 7
        case "7_30":
          return days >= 7 && days < 30
        case "30_90":
          return days >= 30 && days < 90
        case "gt90":
          return days >= 90
        default:
          return true
      }
    })
}

export function platformToLeadSource(
  platform: string | null
): LeadSource | null {
  if (!platform) return null
  return PLATFORM_TO_LEAD_SOURCE[platform] ?? null
}
