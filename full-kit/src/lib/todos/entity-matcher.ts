import { db } from "@/lib/prisma"

/**
 * Entity matcher — used by the agent-action auto-promotion sweep to fill
 * in the contact / deal / property FKs on a freshly-created Todo so the
 * card surfaces context chips even when the upstream agent action only
 * captured a loose payload (e.g. an inquirer name + email).
 *
 * Matching tiers, in priority order:
 *   1. Direct linkage via the source Communication's contactId.
 *   2. Email-exact match on payload.email / payload.contactEmail.
 *   3. Name-token match against Contact.name (all tokens must appear).
 *   4. Address match on payload.propertyAddress / payload.address against
 *      Property.address (case-insensitive substring).
 *   5. If a contact match landed, attach the contact's most recent
 *      non-archived Deal as the dealId.
 *
 * The score is heuristic — 1.0 for direct linkage, 0.95 for email exact,
 * 0.7 for full-name token overlap, 0.5 for partial / single-token name,
 * and 0.6 for an address-only match. Callers can use this to decide
 * whether to surface the link as a chip vs. flagging the Todo as
 * "Unmatched."
 */

export interface MatchInput {
  agentActionPayload: unknown
  sourceCommunicationId?: string | null
}

export interface MatchResult {
  contactId: string | null
  dealId: string | null
  propertyId: string | null
  matchScore: number
  matchSignals: string[]
}

const EMPTY_RESULT: MatchResult = {
  contactId: null,
  dealId: null,
  propertyId: null,
  matchScore: 0,
  matchSignals: [],
}

export async function matchEntitiesForAction(
  input: MatchInput
): Promise<MatchResult> {
  const payload = asRecord(input.agentActionPayload)
  const signals: string[] = []
  let score = 0
  let contactId: string | null = null
  let propertyId: string | null = null

  // Tier 1: source communication's contact (highest confidence).
  if (input.sourceCommunicationId) {
    const comm = await db.communication.findUnique({
      where: { id: input.sourceCommunicationId },
      select: { contactId: true, dealId: true },
    })
    if (comm?.contactId) {
      contactId = comm.contactId
      signals.push("source_comm_contact")
      score = Math.max(score, 1.0)
    }
  }

  // Tier 2: payload email-exact (case-insensitive).
  if (!contactId) {
    const email = pickString(payload, [
      "email",
      "contactEmail",
      "inquirerEmail",
      "fromEmail",
    ])
    if (email) {
      const normalized = email.trim().toLowerCase()
      const found = await db.contact.findFirst({
        where: {
          email: { equals: normalized, mode: "insensitive" },
          archivedAt: null,
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      })
      if (found) {
        contactId = found.id
        signals.push("email_exact")
        score = Math.max(score, 0.95)
      }
    }
  }

  // Tier 3: payload name token-overlap.
  if (!contactId) {
    const name = pickString(payload, [
      "contactName",
      "name",
      "inquirerName",
      "fromName",
    ])
    if (name) {
      const tokens = nameTokens(name)
      if (tokens.length > 0) {
        // Case-insensitive AND-match every token against Contact.name.
        const candidates = await db.contact.findMany({
          where: {
            archivedAt: null,
            AND: tokens.map((t) => ({
              name: { contains: t, mode: "insensitive" as const },
            })),
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, name: true },
        })
        if (candidates.length > 1) {
          // Ambiguous: don't guess. Surface a low-confidence "name_ambiguous"
          // signal and leave contactId null so the operator picks. Auditing
          // flagged that quietly attaching the most-recently-updated of N
          // homonym contacts (e.g. two "John Smith"s) is a confidence bug —
          // the cascade also drops the deal-lookup since we have no contact.
          signals.push("name_ambiguous")
          score = Math.max(score, 0.3)
        } else if (candidates.length === 1) {
          contactId = candidates[0].id
          if (tokens.length >= 2) {
            signals.push("name_token_overlap")
            score = Math.max(score, 0.7)
          } else {
            signals.push("name_partial")
            score = Math.max(score, 0.5)
          }
        }
      }
    }
  }

  // Tier 4: address match against Property.
  const address = pickString(payload, [
    "propertyAddress",
    "address",
    "propertyKey",
  ])
  if (address) {
    const trimmed = address.trim()
    if (trimmed.length >= 4) {
      const prop = await db.property.findFirst({
        where: {
          archivedAt: null,
          OR: [
            { address: { contains: trimmed, mode: "insensitive" } },
            { propertyKey: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      })
      if (prop) {
        propertyId = prop.id
        signals.push("address_match")
        score = Math.max(score, 0.6)
      }
    }
  }

  // Tier 5: most-recent active deal for the matched contact.
  let dealId: string | null = null
  if (contactId) {
    const deal = await db.deal.findFirst({
      where: {
        contactId,
        archivedAt: null,
        stage: { notIn: ["closed"] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    })
    if (deal) {
      dealId = deal.id
      signals.push("contact_deal")
    }
  }

  // Preserve signals (e.g. "name_ambiguous") even when no entity attached —
  // the consumer surfaces them so the operator understands the matcher's
  // reasoning. Only return the canonical empty result when there's truly
  // nothing to report.
  if (!contactId && !propertyId && !dealId && signals.length === 0) {
    return EMPTY_RESULT
  }

  return { contactId, dealId, propertyId, matchScore: score, matchSignals: signals }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function pickString(
  payload: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const v = payload[key]
    if (typeof v === "string" && v.trim().length > 0) return v
  }
  return null
}

function nameTokens(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}'-]/gu, "").trim())
    .filter((t) => t.length >= 2)
}
