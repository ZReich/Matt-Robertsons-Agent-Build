import "server-only"

import { Prisma } from "@prisma/client"

import type { PropertyType } from "@prisma/client"

import { db } from "@/lib/prisma"

import { containsRawSensitiveData } from "./sensitive-filter"

const CRITERIA_TOOL = {
  name: "record_buyer_intent",
  description:
    "Record what a CRE prospect is looking to buy or lease, based on their email correspondence with Matt Robertson.",
  parameters: {
    type: "object",
    properties: {
      hasIntent: {
        type: "boolean",
        description:
          "True ONLY if the contact has clearly expressed they are looking to buy or lease commercial real estate. False if they are a seller, a tenant rep on the other side, a vendor, a friend, a referral source, or just had a one-off conversation. Be strict — false positives waste outreach.",
      },
      propertyTypes: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "office",
            "retail",
            "industrial",
            "multifamily",
            "land",
            "mixed_use",
            "hospitality",
            "medical",
            "other",
          ],
        },
        description: "Property types the contact has indicated interest in.",
      },
      minSqft: {
        type: "number",
        description: "Lower bound of size range in square feet, if mentioned.",
      },
      maxSqft: {
        type: "number",
        description: "Upper bound of size range in square feet, if mentioned.",
      },
      minPrice: {
        type: "number",
        description: "Lower bound budget in USD, if mentioned.",
      },
      maxPrice: {
        type: "number",
        description: "Upper bound budget in USD, if mentioned.",
      },
      locations: {
        type: "array",
        items: { type: "string" },
        description:
          "Cities, neighborhoods, or markets they want — e.g. ['Billings', 'Kalispell', 'downtown']. Use the names they used.",
      },
      notes: {
        type: "string",
        description:
          "1-2 sentences capturing nuance the structured fields don't — timing, dealbreakers, motivations. Empty string if nothing to add.",
      },
      confidence: {
        type: "number",
        description:
          "0.0–1.0 confidence that this represents real, current buyer intent (not aspirational, not from a contact who has since closed a deal and is dormant).",
      },
    },
    required: ["hasIntent", "confidence"],
  },
} as const

const SYSTEM_PROMPT = `You analyze email threads from a commercial real estate broker's archive and extract whether a contact has expressed buyer/tenant intent. You are strict: only flag hasIntent=true when the contact has actually said something like "I'm looking for X" or "we want to acquire/lease Y." Do NOT flag listing brokers, sellers, vendors, attorneys, escrow, banks, or one-off social contacts. Output ONLY via the record_buyer_intent tool. If unsure, hasIntent=false with low confidence.`

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{
        type: string
        function?: { name?: string; arguments?: string }
      }>
    }
  }>
  error?: { message?: string }
}

export interface ExtractedCriteria {
  hasIntent: boolean
  propertyTypes?: PropertyType[]
  minSqft?: number
  maxSqft?: number
  minPrice?: number
  maxPrice?: number
  locations?: string[]
  notes?: string
  confidence: number
}

class CriteriaExtractorError extends Error {
  constructor(
    public reason: string,
    message: string
  ) {
    super(message)
  }
}

async function callDeepSeek(userPrompt: string): Promise<ExtractedCriteria> {
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ??
    "https://api.openai.com/v1"
  const model =
    process.env.OPENAI_CRITERIA_MODEL ||
    process.env.OPENAI_SCRUB_MODEL ||
    "deepseek-chat"
  if (!apiKey) {
    throw new CriteriaExtractorError(
      "missing_api_key",
      "OPENAI_API_KEY is not set"
    )
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tools: [{ type: "function", function: CRITERIA_TOOL }],
      tool_choice: { type: "function", function: { name: CRITERIA_TOOL.name } },
    }),
  })
  const body = (await response
    .json()
    .catch(() => ({}))) as ChatCompletionResponse
  if (!response.ok) {
    throw new CriteriaExtractorError(
      "provider_error",
      `provider ${response.status}: ${body.error?.message ?? response.statusText}`
    )
  }
  const toolCall = body.choices?.[0]?.message?.tool_calls?.find(
    (call) =>
      call.type === "function" && call.function?.name === CRITERIA_TOOL.name
  )
  if (!toolCall?.function?.arguments) {
    throw new CriteriaExtractorError("provider_error", "no tool call returned")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(toolCall.function.arguments)
  } catch {
    throw new CriteriaExtractorError("provider_error", "bad JSON")
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as Record<string, unknown>).hasIntent !== "boolean"
  ) {
    throw new CriteriaExtractorError(
      "provider_error",
      "missing hasIntent field"
    )
  }
  const r = parsed as Record<string, unknown>
  const propertyTypes = Array.isArray(r.propertyTypes)
    ? (r.propertyTypes.filter(
        (t): t is string => typeof t === "string"
      ) as PropertyType[])
    : undefined
  const locations = Array.isArray(r.locations)
    ? r.locations.filter((l): l is string => typeof l === "string")
    : undefined
  return {
    hasIntent: Boolean(r.hasIntent),
    confidence: typeof r.confidence === "number" ? r.confidence : 0,
    propertyTypes,
    minSqft: typeof r.minSqft === "number" ? r.minSqft : undefined,
    maxSqft: typeof r.maxSqft === "number" ? r.maxSqft : undefined,
    minPrice: typeof r.minPrice === "number" ? r.minPrice : undefined,
    maxPrice: typeof r.maxPrice === "number" ? r.maxPrice : undefined,
    locations,
    notes: typeof r.notes === "string" ? r.notes : undefined,
  }
}

export interface BackfillContactResult {
  contactId: string
  contactName: string
  contactEmail: string | null
  outcome:
    | "skipped_has_criteria"
    | "skipped_closed_deal"
    | "skipped_no_comms"
    | "skipped_sensitive"
    | "skipped_low_confidence"
    | "no_intent"
    | "criteria_set"
    | "error"
  confidence?: number
  criteria?: Record<string, unknown>
  error?: string
}

export interface BackfillRunSummary {
  scanned: number
  scopedContacts: number
  criteriaSet: number
  noIntent: number
  skipped: number
  errored: number
  results: BackfillContactResult[]
}

/**
 * Run the criteria backfill: scan contacts modified in the last `lookbackDays`
 * who don't have searchCriteria yet AND don't have a closed deal, pull their
 * recent communications, ask DeepSeek if they have buyer intent, and write
 * the result to Contact.searchCriteria.
 *
 * Caps protect against runaway costs: contactLimit defaults to 100, and only
 * the most recent commsPerContact emails are fed to the model.
 */
export async function runCriteriaBackfill(
  options: {
    lookbackDays?: number
    contactLimit?: number
    commsPerContact?: number
    minConfidence?: number
    dryRun?: boolean
  } = {}
): Promise<BackfillRunSummary> {
  const {
    lookbackDays = 90,
    contactLimit = 100,
    commsPerContact = 12,
    minConfidence = 0.55,
    dryRun = false,
  } = options

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - lookbackDays)

  const contacts = await db.contact.findMany({
    where: {
      archivedAt: null,
      searchCriteria: { equals: Prisma.DbNull },
      // Active in the lookback window — either contact or some communication
      // touched them recently.
      OR: [
        { updatedAt: { gte: cutoff } },
        { communications: { some: { date: { gte: cutoff } } } },
      ],
    },
    take: contactLimit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      role: true,
      _count: {
        select: { deals: { where: { stage: "closed" } } },
      },
    },
  })

  const results: BackfillContactResult[] = []
  let criteriaSet = 0
  let noIntent = 0
  let skipped = 0
  let errored = 0

  for (const c of contacts) {
    if (c._count.deals > 0) {
      results.push({
        contactId: c.id,
        contactName: c.name,
        contactEmail: c.email,
        outcome: "skipped_closed_deal",
      })
      skipped++
      continue
    }

    const comms = await db.communication.findMany({
      where: { contactId: c.id, archivedAt: null, body: { not: null } },
      orderBy: { date: "desc" },
      take: commsPerContact,
      select: {
        id: true,
        subject: true,
        body: true,
        direction: true,
        date: true,
      },
    })

    if (comms.length === 0) {
      results.push({
        contactId: c.id,
        contactName: c.name,
        contactEmail: c.email,
        outcome: "skipped_no_comms",
      })
      skipped++
      continue
    }

    // Sensitive-content gate: only skip if a comm contains *raw* sensitive
    // data (SSN, routing number with banking context, payment card details).
    // Use the strict variant — the broad keyword list rejects too many
    // routine CRE emails ("rent rolls", "OM", "tax return") that we want
    // the AI to read for buyer-intent extraction.
    const tripped = comms.find(
      (m) => containsRawSensitiveData(m.subject, m.body).tripped
    )
    if (tripped) {
      results.push({
        contactId: c.id,
        contactName: c.name,
        contactEmail: c.email,
        outcome: "skipped_sensitive",
      })
      skipped++
      continue
    }

    const formatted = comms
      .map((m, i) => {
        const dir = m.direction ?? "?"
        const date = m.date.toISOString().slice(0, 10)
        const subject = (m.subject ?? "").slice(0, 200)
        const body = (m.body ?? "").slice(0, 1200)
        return `--- Message ${i + 1} (${dir}, ${date}) ---\nSubject: ${subject}\n${body}`
      })
      .join("\n\n")

    const userPrompt = [
      `CONTACT:`,
      `  name: ${c.name}`,
      c.company ? `  company: ${c.company}` : "",
      c.role ? `  role: ${c.role}` : "",
      c.email ? `  email: ${c.email}` : "",
      ``,
      `RECENT MESSAGES (most recent first):`,
      formatted,
    ]
      .filter(Boolean)
      .join("\n")

    let extracted: ExtractedCriteria
    try {
      extracted = await callDeepSeek(userPrompt)
    } catch (e) {
      results.push({
        contactId: c.id,
        contactName: c.name,
        contactEmail: c.email,
        outcome: "error",
        error: e instanceof Error ? e.message : "unknown",
      })
      errored++
      continue
    }

    if (!extracted.hasIntent) {
      results.push({
        contactId: c.id,
        contactName: c.name,
        contactEmail: c.email,
        outcome: "no_intent",
        confidence: extracted.confidence,
      })
      noIntent++
      continue
    }

    if (extracted.confidence < minConfidence) {
      results.push({
        contactId: c.id,
        contactName: c.name,
        contactEmail: c.email,
        outcome: "skipped_low_confidence",
        confidence: extracted.confidence,
      })
      skipped++
      continue
    }

    const criteria: Record<string, unknown> = {}
    if (extracted.propertyTypes && extracted.propertyTypes.length > 0)
      criteria.propertyTypes = extracted.propertyTypes
    if (typeof extracted.minSqft === "number")
      criteria.minSqft = extracted.minSqft
    if (typeof extracted.maxSqft === "number")
      criteria.maxSqft = extracted.maxSqft
    if (typeof extracted.minPrice === "number")
      criteria.minPrice = extracted.minPrice
    if (typeof extracted.maxPrice === "number")
      criteria.maxPrice = extracted.maxPrice
    if (extracted.locations && extracted.locations.length > 0)
      criteria.locations = extracted.locations
    if (extracted.notes && extracted.notes.trim().length > 0)
      criteria.notes = extracted.notes
    criteria._extractedAt = new Date().toISOString()
    criteria._confidence = extracted.confidence
    criteria._source = "criteria-backfill-2026-05-01"

    if (!dryRun) {
      // Auto-tag as "buyer" if no buyer-style tag exists yet, so the criteria
      // editor surfaces in the UI immediately. Don't override existing tags.
      const existing = await db.contact.findUnique({
        where: { id: c.id },
        select: { tags: true },
      })
      const existingTags = Array.isArray(existing?.tags)
        ? (existing.tags as unknown[]).filter(
            (t): t is string => typeof t === "string"
          )
        : []
      const buyerLike = existingTags.some((t) =>
        ["buyer", "tenant", "investor"].includes(t)
      )
      const newTags = buyerLike
        ? existingTags
        : [...existingTags, "buyer", "ai-tagged"]

      await db.contact.update({
        where: { id: c.id },
        data: {
          searchCriteria: criteria as unknown as Prisma.InputJsonValue,
          tags: newTags as unknown as Prisma.InputJsonValue,
        },
      })
    }

    results.push({
      contactId: c.id,
      contactName: c.name,
      contactEmail: c.email,
      outcome: "criteria_set",
      confidence: extracted.confidence,
      criteria,
    })
    criteriaSet++
  }

  return {
    scanned: contacts.length,
    scopedContacts: contacts.length,
    criteriaSet,
    noIntent,
    skipped,
    errored,
    results,
  }
}
