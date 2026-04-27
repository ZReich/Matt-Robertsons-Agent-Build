import type { Prisma, PrismaClient } from "@prisma/client"

import {
  extractBuildoutEvent,
  extractCrexiLead,
  extractLoopNetLead,
} from "@/lib/msgraph/email-extractors"
import { db } from "@/lib/prisma"

import { readCommunicationParties } from "./communication-linker"

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]
type DbLike = PrismaClient | TxClient

export type LeadDiagnosticPlatform = "crexi" | "loopnet" | "buildout"

export type LeadDiagnosticOutcome =
  | "would_create_contact_candidate"
  | "would_mark_existing_contact_as_lead"
  | "already_client_no_lead_status"
  | "already_lead"
  | "platform_signal_but_extractor_null"
  | "extractor_has_no_inquirer_email"
  | "classified_noise_but_platform_candidate"
  | "classified_uncertain_but_platform_candidate"
  | "missing_body_or_metadata"

export type LeadDiagnosticRequest = {
  limit?: number
  cursor?: string | null
  platforms?: LeadDiagnosticPlatform[]
  includeSamples?: boolean
  sampleLimitPerBucket?: number
  runId?: string
}

export type LeadDiagnosticResponse = {
  runId: string
  scanned: number
  nextCursor: string | null
  byPlatform: Record<string, number>
  byClassification: Record<string, number>
  byOutcome: Partial<Record<LeadDiagnosticOutcome, number>>
  topSenderDomains: Array<{ domain: string; count: number }>
  topSubjectBuckets: Array<{ bucket: string; count: number }>
  samples: Array<{
    communicationId: string
    platform: LeadDiagnosticPlatform
    outcome: LeadDiagnosticOutcome
    subjectRedacted: string
    senderDomain: string
    hasBody: boolean
    wouldCreateOrUpdateContact: boolean
  }>
}

type CommunicationDiagnosticRow = {
  id: string
  subject: string | null
  body: string | null
  metadata: Prisma.JsonValue | null
  date: Date
}

type DiagnosticContact = {
  id: string
  email: string | null
  leadSource: string | null
  leadStatus: string | null
  _count: { deals: number }
}

type PlatformCandidate = {
  row: CommunicationDiagnosticRow
  platform: LeadDiagnosticPlatform
  classification: string
  inquirerEmail: string | null
}

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 2000
const ALL_PLATFORMS: LeadDiagnosticPlatform[] = ["crexi", "loopnet", "buildout"]

export async function runLeadExtractorDiagnostics({
  request = {},
  client = db,
}: {
  request?: LeadDiagnosticRequest
  client?: DbLike
} = {}): Promise<LeadDiagnosticResponse> {
  const limit = clampLimit(request.limit)
  const runId = request.runId ?? `lead-diagnostic-${new Date().toISOString()}`
  const platforms = request.platforms?.length
    ? request.platforms
    : ALL_PLATFORMS
  const rows = await client.communication.findMany({
    where: {
      id: request.cursor ? { gt: request.cursor } : undefined,
      channel: "email",
      archivedAt: null,
    },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, subject: true, body: true, metadata: true, date: true },
  })

  const response: LeadDiagnosticResponse = {
    runId,
    scanned: rows.length,
    nextCursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null,
    byPlatform: {},
    byClassification: {},
    byOutcome: {},
    topSenderDomains: [],
    topSubjectBuckets: [],
    samples: [],
  }
  const domains = new Map<string, number>()
  const buckets = new Map<string, number>()
  const sampleLimit = Math.max(0, request.sampleLimitPerBucket ?? 5)
  const candidates = rows.flatMap((row): PlatformCandidate[] => {
    const platform = detectLeadPlatform(row)
    if (!platform || !platforms.includes(platform)) return []
    return [
      {
        row,
        platform,
        classification:
          metadataString(row.metadata, "classification") ?? "unknown",
        inquirerEmail: extractInquirerEmail(row, platform),
      },
    ]
  })
  const contactsByEmail = await loadContactsByEmail(
    client,
    candidates.flatMap((candidate) =>
      candidate.inquirerEmail ? [candidate.inquirerEmail] : []
    )
  )

  for (const candidate of candidates) {
    const { row, platform, classification } = candidate
    increment(response.byPlatform, platform)

    increment(response.byClassification, classification)

    const parties = readCommunicationParties(row.metadata)
    const domain = parties.from?.address?.split("@")[1] ?? "unknown"
    incrementMap(domains, domain)

    const bucket = subjectBucket(row.subject)
    incrementMap(buckets, bucket)

    const outcome = diagnosticOutcome(
      row,
      platform,
      classification,
      candidate.inquirerEmail
        ? (contactsByEmail.get(candidate.inquirerEmail) ?? null)
        : null
    )
    increment(response.byOutcome, outcome)

    if (
      request.includeSamples &&
      response.samples.length < sampleLimit * platforms.length
    ) {
      response.samples.push({
        communicationId: row.id,
        platform,
        outcome,
        subjectRedacted: redactSubject(row.subject),
        senderDomain: domain,
        hasBody: Boolean(row.body),
        wouldCreateOrUpdateContact:
          outcome === "would_create_contact_candidate" ||
          outcome === "would_mark_existing_contact_as_lead",
      })
    }
  }

  response.topSenderDomains = topCounts(domains).map(([domain, count]) => ({
    domain,
    count,
  }))
  response.topSubjectBuckets = topCounts(buckets).map(([bucket, count]) => ({
    bucket,
    count,
  }))
  return response
}

export function detectLeadPlatform(
  row: Pick<CommunicationDiagnosticRow, "subject" | "metadata">
): LeadDiagnosticPlatform | null {
  const parties = readCommunicationParties(row.metadata)
  const from = parties.from?.address ?? ""
  const source = metadataString(row.metadata, "source") ?? ""
  const subject = row.subject ?? ""
  if (
    source.includes("crexi") ||
    from.includes("crexi.com") ||
    /crexi/i.test(subject)
  )
    return "crexi"
  if (
    source.includes("loopnet") ||
    from.includes("loopnet.com") ||
    /loopnet/i.test(subject)
  )
    return "loopnet"
  if (
    source.includes("buildout") ||
    from.includes("buildout.com") ||
    /buildout/i.test(subject)
  )
    return "buildout"
  return null
}

function diagnosticOutcome(
  row: CommunicationDiagnosticRow,
  platform: LeadDiagnosticPlatform,
  classification: string,
  contact: DiagnosticContact | null
): LeadDiagnosticOutcome {
  if (!row.body && !row.subject) return "missing_body_or_metadata"
  if (classification === "noise")
    return "classified_noise_but_platform_candidate"
  if (classification === "uncertain")
    return "classified_uncertain_but_platform_candidate"

  const extract = extractPlatform(row, platform)
  if (!extract) return "platform_signal_but_extractor_null"
  if (!("inquirer" in extract) || !extract.inquirer?.email) {
    return "extractor_has_no_inquirer_email"
  }
  if (!contact) return "would_create_contact_candidate"
  if (contact.leadSource) return "already_lead"
  if (contact._count.deals > 0) return "already_client_no_lead_status"
  return "would_mark_existing_contact_as_lead"
}

function extractInquirerEmail(
  row: CommunicationDiagnosticRow,
  platform: LeadDiagnosticPlatform
): string | null {
  const extract = extractPlatform(row, platform)
  if (!extract || !("inquirer" in extract)) return null
  const email = extract.inquirer?.email
  return typeof email === "string" && email.includes("@")
    ? email.trim().toLowerCase()
    : null
}

async function loadContactsByEmail(
  client: DbLike,
  emails: string[]
): Promise<Map<string, DiagnosticContact>> {
  const uniqueEmails = [...new Set(emails)]
  if (uniqueEmails.length === 0) return new Map()
  const contacts = await client.contact.findMany({
    where: {
      OR: uniqueEmails.map((email) => ({
        email: { equals: email, mode: "insensitive" as const },
      })),
    },
    select: {
      id: true,
      email: true,
      leadSource: true,
      leadStatus: true,
      _count: { select: { deals: true } },
    },
  })
  const map = new Map<string, DiagnosticContact>()
  for (const contact of contacts) {
    if (!contact.email) continue
    map.set(contact.email.trim().toLowerCase(), contact)
  }
  return map
}

function extractPlatform(
  row: CommunicationDiagnosticRow,
  platform: LeadDiagnosticPlatform
) {
  const input = { subject: row.subject, bodyText: row.body ?? "" }
  switch (platform) {
    case "crexi":
      return extractCrexiLead(input)
    case "loopnet":
      return extractLoopNetLead(input)
    case "buildout":
      return extractBuildoutEvent(input)
  }
}

function subjectBucket(subject: string | null): string {
  const s = subject ?? ""
  if (/new leads? found for/i.test(s)) return "new-leads-found-for"
  if (/requesting information on/i.test(s)) return "requesting-information"
  if (/you have new leads to be contacted/i.test(s))
    return "new-leads-to-be-contacted"
  if (/loopnet lead for/i.test(s)) return "loopnet-lead-for"
  if (/favorited/i.test(s)) return "favorited"
  if (/a new lead has been added/i.test(s)) return "buildout-new-lead"
  if (/deal stage updated on/i.test(s)) return "deal-stage-updated"
  if (/critical date/i.test(s)) return "critical-date"
  return "other"
}

function redactSubject(subject: string | null): string {
  return (subject ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "person@example.test")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "555-0100")
}

function metadataString(metadata: unknown, key: string): string | null {
  const record =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}
  const value = record[key]
  return typeof value === "string" ? value : null
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT)
}

function increment<T extends string>(
  record: Partial<Record<T, number>>,
  key: T
): void {
  record[key] = (record[key] ?? 0) + 1
}

function incrementMap(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function topCounts(map: Map<string, number>): Array<[string, number]> {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
}
