import type { LeadSource, LeadStatus } from "@prisma/client"

import { db } from "@/lib/prisma"

export type RelatedLead = {
  /** Contact id when the inquirer is a promoted Contact, null when the
   *  inquirer is still a pending ContactPromotionCandidate awaiting review. */
  contactId: string | null
  /** Candidate id when the inquirer is a pending ContactPromotionCandidate.
   *  null when the inquirer is already a promoted Contact. Exactly one of
   *  contactId / candidateId is non-null per row. */
  candidateId: string | null
  /** "lead" → click-through to /pages/leads/<contactId>.
   *  "candidate" → click-through to /pages/contact-candidates. */
  kind: "lead" | "candidate"
  name: string
  email: string | null
  phone: string | null
  leadSource: LeadSource | null
  leadStatus: LeadStatus | null
  firstInquiryAt: Date
  lastInquiryAt: Date
  inquiryCount: number
  mostRecentSubject: string | null
  mostRecentCommunicationId: string
}

type RawContactRow = {
  source: "lead"
  contact_id: string
  candidate_id: null
  name: string
  email: string | null
  phone: string | null
  lead_source: LeadSource | null
  lead_status: LeadStatus | null
  first_inquiry_at: Date
  last_inquiry_at: Date
  inquiry_count: bigint
  most_recent_subject: string | null
  most_recent_communication_id: string
}

type RawCandidateRow = {
  source: "candidate"
  contact_id: null
  candidate_id: string
  name: string
  email: string | null
  phone: string | null
  lead_source: LeadSource | null
  lead_status: null
  first_inquiry_at: Date
  last_inquiry_at: Date
  inquiry_count: bigint
  most_recent_subject: string | null
  most_recent_communication_id: string
}

type RawRow = RawContactRow | RawCandidateRow

/**
 * Find all leads who have inquired about the deal's property — anyone whose
 * inbound communication has `metadata.extracted.propertyKey` matching this
 * deal's `propertyKey` OR any of its `propertyAliases`.
 *
 * Returns two flavors of inquirer in a single ordered list:
 *
 * 1. **Promoted leads** — communications already linked to a Contact (Buildout
 *    new-lead/information-requested auto-promotes at ingest; LoopNet/Crexi
 *    leads only land here after Matt approves them on the Contact Candidates
 *    page). Linked back to `/pages/leads/<contactId>`.
 *
 * 2. **Pending candidates** — LoopNet/Crexi platform inquiries that the
 *    `lead-apply-backfill` queued into `contact_promotion_candidates` but
 *    Matt hasn't approved yet. Without this branch, the Inquirers tab silently
 *    hid every Crexi/LoopNet inquirer until promotion, even though their
 *    extracted `propertyKey` already matches the deal. Linked to the
 *    candidate-review page so Matt can approve from there.
 *
 * Excludes archived contacts and the deal's own primary contact (so the
 * listing client of a `lead_derived` deal doesn't show up as their own
 * inquirer). Returns one row per contact OR per candidate, ordered by most-
 * recent inquiry first.
 *
 * Returns an empty array if the deal has no propertyKey.
 */
export async function findRelatedLeadsForDeal(
  dealId: string
): Promise<RelatedLead[]> {
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: { id: true, propertyKey: true, propertyAliases: true, contactId: true },
  })
  if (!deal?.propertyKey) return []

  // Build the set of canonical keys this deal answers to: the canonical key
  // plus any aliases. Aliases are stored as a JSON array of strings; we
  // also lowercase to match the normalizer's output, in case any alias was
  // captured in mixed case.
  const aliasList = parseStringArray(deal.propertyAliases)
  const matchKeys = uniqLowercase([deal.propertyKey, ...aliasList])
  if (matchKeys.length === 0) return []

  // The query has two arms unioned together:
  //   - Lead arm: Communication has a contact_id → join contacts.
  //   - Candidate arm: Communication has no contact_id but a pending
  //     contact_promotion_candidate exists for it (linked via
  //     communication_id, OR by normalized inquirer email when the
  //     candidate predates the join column population).
  //
  // Both arms partition by the entity they represent (contact_id vs
  // candidate_id) and pick the most-recent inquiry per partition so the
  // page shows one card per inquirer with a stable count.
  const rows = await db.$queryRaw<RawRow[]>`
    WITH property_matches AS (
      SELECT
        m.id,
        m.contact_id,
        m.subject,
        m.date,
        lower(m.metadata -> 'extracted' ->> 'platform') AS platform,
        lower(m.metadata -> 'extracted' -> 'inquirer' ->> 'email') AS inquirer_email
      FROM communications m
      WHERE m.archived_at IS NULL
        AND lower(m.metadata -> 'extracted' ->> 'propertyKey') = ANY(${matchKeys})
    ),
    lead_arm AS (
      SELECT
        pm.id,
        pm.contact_id,
        pm.subject,
        pm.date,
        ROW_NUMBER() OVER (
          PARTITION BY pm.contact_id
          ORDER BY pm.date DESC, pm.id DESC
        ) AS rn,
        COUNT(*) OVER (PARTITION BY pm.contact_id) AS inquiry_count,
        MIN(pm.date) OVER (PARTITION BY pm.contact_id) AS first_inquiry_at,
        MAX(pm.date) OVER (PARTITION BY pm.contact_id) AS last_inquiry_at
      FROM property_matches pm
      WHERE pm.contact_id IS NOT NULL
    ),
    candidate_matches AS (
      -- Each contact-less property match joined to its
      -- contact_promotion_candidate (preferred join: communication_id;
      -- fallback: inquirer email + same source platform). Restricted to
      -- statuses that still represent a reviewable inquirer — once the
      -- candidate is rejected/not-a-contact we stop surfacing it as an
      -- "Inquirer" on the deal page.
      SELECT
        pm.id,
        pm.subject,
        pm.date,
        cpc.id AS candidate_id
      FROM property_matches pm
      INNER JOIN contact_promotion_candidates cpc
        ON (
          cpc.communication_id = pm.id
          OR (
            cpc.normalized_email IS NOT NULL
            AND cpc.normalized_email = pm.inquirer_email
            AND cpc.source_platform = pm.platform
          )
        )
      WHERE pm.contact_id IS NULL
        AND cpc.status IN ('pending', 'needs_more_evidence', 'snoozed')
    ),
    candidate_arm AS (
      SELECT
        cm.id,
        cm.candidate_id,
        cm.subject,
        cm.date,
        ROW_NUMBER() OVER (
          PARTITION BY cm.candidate_id
          ORDER BY cm.date DESC, cm.id DESC
        ) AS rn,
        COUNT(*) OVER (PARTITION BY cm.candidate_id) AS inquiry_count,
        MIN(cm.date) OVER (PARTITION BY cm.candidate_id) AS first_inquiry_at,
        MAX(cm.date) OVER (PARTITION BY cm.candidate_id) AS last_inquiry_at
      FROM candidate_matches cm
    )
    SELECT
      'lead'::text AS source,
      c.id AS contact_id,
      NULL::text AS candidate_id,
      c.name,
      c.email,
      c.phone,
      c.lead_source,
      c.lead_status,
      la.first_inquiry_at,
      la.last_inquiry_at,
      la.inquiry_count,
      la.subject AS most_recent_subject,
      la.id AS most_recent_communication_id
    FROM lead_arm la
    INNER JOIN contacts c ON c.id = la.contact_id
    WHERE la.rn = 1
      AND c.archived_at IS NULL
      AND c.lead_source IS NOT NULL
      AND c.id <> ${deal.contactId}
    UNION ALL
    SELECT
      'candidate'::text AS source,
      NULL::text AS contact_id,
      cpc.id AS candidate_id,
      COALESCE(cpc.display_name, cpc.normalized_email, 'Pending lead') AS name,
      cpc.normalized_email AS email,
      cpc.phone AS phone,
      CASE cpc.source_platform
        WHEN 'crexi' THEN 'crexi'::"LeadSource"
        WHEN 'loopnet' THEN 'loopnet'::"LeadSource"
        WHEN 'buildout' THEN 'buildout'::"LeadSource"
        ELSE NULL
      END AS lead_source,
      NULL::"LeadStatus" AS lead_status,
      ca.first_inquiry_at,
      ca.last_inquiry_at,
      ca.inquiry_count,
      ca.subject AS most_recent_subject,
      ca.id AS most_recent_communication_id
    FROM candidate_arm ca
    INNER JOIN contact_promotion_candidates cpc ON cpc.id = ca.candidate_id
    WHERE ca.rn = 1
    ORDER BY last_inquiry_at DESC
  `

  return rows.map((row) => ({
    contactId: row.contact_id,
    candidateId: row.candidate_id,
    kind: row.source,
    name: row.name,
    email: row.email,
    phone: row.phone,
    leadSource: row.lead_source,
    leadStatus: row.lead_status,
    firstInquiryAt: row.first_inquiry_at,
    lastInquiryAt: row.last_inquiry_at,
    inquiryCount: Number(row.inquiry_count),
    mostRecentSubject: row.most_recent_subject,
    mostRecentCommunicationId: row.most_recent_communication_id,
  }))
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string")
  }
  return []
}

function uniqLowercase(values: string[]): string[] {
  const set = new Set<string>()
  for (const v of values) {
    const trimmed = v.trim().toLowerCase()
    if (trimmed) set.add(trimmed)
  }
  return [...set]
}
