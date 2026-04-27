import type { Direction, Prisma, PrismaClient } from "@prisma/client"

import { db } from "@/lib/prisma"

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]
type DbLike = PrismaClient | TxClient

type MetadataRecord = Record<string, unknown>

export type PartyAddress = {
  name?: string
  address?: string
}

export type CommunicationParties = {
  from: PartyAddress | null
  to: PartyAddress[]
  cc: PartyAddress[]
  conversationId?: string
  source?: string
}

export type OutboundFilterConfig = {
  selfEmails: string[]
  targetUpn?: string
  internalDomains: string[]
  systemEmailDenylist: string[]
  outboundIncludeInternal: boolean
}

export type LinkBackfillPhase = "all" | "contact" | "deal" | "scrub-candidates"

export type LinkBackfillRequest = {
  dryRun?: boolean
  limit?: number
  cursor?: string | null
  phase?: LinkBackfillPhase
  applyScrubCandidates?: boolean
  runId?: string
}

export type BackfillDecision = {
  communicationId: string
  strategy:
    | "inbound_sender_exact_email"
    | "outbound_single_recipient_exact_email"
    | "single_active_deal_for_contact"
    | "scrub_candidate_high_confidence"
  matchedEmail?: string
  previousContactId?: string | null
  newContactId?: string
  previousDealId?: string | null
  newDealId?: string
  confidence: number
}

export type CommunicationLinkBackfillResult = {
  runId: string
  dryRun: boolean
  scanned: number
  nextCursor: string | null
  updatedContactId: number
  updatedDealId: number
  skippedAlreadyLinked: number
  skippedUnknownParty: number
  skippedAmbiguousContact: number
  skippedAmbiguousRecipients: number
  skippedMultipleDeals: number
  skippedRaceLost: number
  samples: {
    linked: BackfillDecision[]
    ambiguous: BackfillDecision[]
    unknownTopEmails: Array<{ email: string; count: number; lastDate: string }>
  }
}

type CommunicationRow = {
  id: string
  metadata: Prisma.JsonValue | null
  direction: Direction | null
  contactId: string | null
  dealId: string | null
  date: Date
}

type ContactMatch = {
  id: string
  email: string | null
  archivedAt: Date | null
}

type DealMatch = {
  id: string
  contactId: string
  archivedAt: Date | null
  stage: string
}

const DEFAULT_LIMIT = 250
const MAX_LIMIT = 1000
const DEFAULT_SYSTEM_DENYLIST = [
  "no-reply@",
  "noreply@",
  "donotreply@",
  "mailer-daemon@",
  "postmaster@",
  "notifications@",
]

function asRecord(value: unknown): MetadataRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as MetadataRecord)
    : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  if (!normalized.includes("@")) return null
  return normalized
}

function readParty(value: unknown): PartyAddress | null {
  const record = asRecord(value)
  const emailAddress = asRecord(record.emailAddress)
  const address = normalizeEmail(
    record.address ?? emailAddress.address ?? record.email
  )
  if (!address) return null
  const name = record.name ?? record.displayName ?? emailAddress.name
  return {
    address,
    ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
  }
}

function readParties(value: unknown): PartyAddress[] {
  return asArray(value).flatMap((item) => {
    const party = readParty(item)
    return party ? [party] : []
  })
}

export function readCommunicationParties(
  metadata: unknown
): CommunicationParties {
  const record = asRecord(metadata)
  const from = readParty(record.from ?? record.sender ?? record.emailAddress)
  const to = [
    ...readParties(record.toRecipients),
    ...readParties(record.to),
    ...readParties(record.recipients),
  ]
  const cc = [...readParties(record.ccRecipients), ...readParties(record.cc)]
  const conversationId = record.conversationId
  const source = record.source
  return {
    from,
    to: dedupeParties(to),
    cc: dedupeParties(cc),
    ...(typeof conversationId === "string" ? { conversationId } : {}),
    ...(typeof source === "string" ? { source } : {}),
  }
}

function dedupeParties(parties: PartyAddress[]): PartyAddress[] {
  const seen = new Set<string>()
  const result: PartyAddress[] = []
  for (const party of parties) {
    if (!party.address || seen.has(party.address)) continue
    seen.add(party.address)
    result.push(party)
  }
  return result
}

export function readOutboundFilterConfig(
  env: Record<string, string | undefined> = process.env
): OutboundFilterConfig {
  return {
    selfEmails: splitCsv(env.EMAIL_BACKFILL_SELF_EMAILS),
    targetUpn: env.MSGRAPH_TARGET_UPN,
    internalDomains: splitCsv(env.EMAIL_BACKFILL_INTERNAL_DOMAINS),
    systemEmailDenylist:
      splitCsv(env.EMAIL_BACKFILL_SYSTEM_EMAIL_DENYLIST).length > 0
        ? splitCsv(env.EMAIL_BACKFILL_SYSTEM_EMAIL_DENYLIST)
        : DEFAULT_SYSTEM_DENYLIST,
    outboundIncludeInternal:
      env.EMAIL_BACKFILL_OUTBOUND_INCLUDE_INTERNAL === "true",
  }
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export function filterOutboundBusinessRecipients(
  recipients: PartyAddress[],
  config: OutboundFilterConfig
): PartyAddress[] {
  const selfEmails = new Set(
    [...config.selfEmails, config.targetUpn]
      .map((item) => normalizeEmail(item))
      .filter((item): item is string => Boolean(item))
  )

  return recipients.filter((recipient) => {
    const address = normalizeEmail(recipient.address)
    if (!address) return false
    if (selfEmails.has(address)) return false
    if (isSystemAddress(address, config.systemEmailDenylist)) return false
    if (
      !config.outboundIncludeInternal &&
      isInternalAddress(address, config.internalDomains)
    ) {
      return false
    }
    return true
  })
}

function isSystemAddress(address: string, denylist: string[]): boolean {
  return denylist.some((entry) => address.includes(entry))
}

function isInternalAddress(address: string, domains: string[]): boolean {
  const domain = address.split("@")[1] ?? ""
  return domains.some(
    (entry) => domain === entry || domain.endsWith(`.${entry}`)
  )
}

export async function runCommunicationLinkBackfill({
  request = {},
  client = db,
  filterConfig = readOutboundFilterConfig(),
}: {
  request?: LinkBackfillRequest
  client?: DbLike
  filterConfig?: OutboundFilterConfig
} = {}): Promise<CommunicationLinkBackfillResult> {
  const dryRun = request.dryRun ?? true
  const limit = clampLimit(request.limit)
  const runId =
    request.runId ?? `communication-link-${new Date().toISOString()}`

  if (!dryRun && !request.runId) {
    throw new Error("runId is required when dryRun=false")
  }

  const rows = await client.communication.findMany({
    where: {
      id: request.cursor ? { gt: request.cursor } : undefined,
      OR: [{ contactId: null }, { dealId: null }],
      archivedAt: null,
    },
    orderBy: { id: "asc" },
    take: limit,
    select: {
      id: true,
      metadata: true,
      direction: true,
      contactId: true,
      dealId: true,
      date: true,
    },
  })

  const result = emptyResult(runId, dryRun)
  result.scanned = rows.length
  result.nextCursor = rows.length === limit ? (rows.at(-1)?.id ?? null) : null

  const emailCounts = collectCandidateEmails(rows, filterConfig)
  const contactsByEmail = await loadContactsByEmail(client, [
    ...emailCounts.keys(),
  ])
  const contactDecisions = new Map<string, ContactDecision>()
  for (const row of rows) {
    const contactDecision = planContactDecision(
      row,
      contactsByEmail,
      filterConfig
    )
    contactDecisions.set(row.id, contactDecision)
  }
  const dealContactIds = rows.flatMap((row) => {
    const contactDecision = contactDecisions.get(row.id)
    const linkedContactId =
      contactDecision?.kind === "link"
        ? contactDecision.decision.newContactId
        : null
    const effectiveContactId = row.contactId ?? linkedContactId
    return effectiveContactId ? [effectiveContactId] : []
  })
  const dealsByContactId = await loadActiveDealsByContactId(
    client,
    dealContactIds
  )

  for (const row of rows) {
    const contactDecision = contactDecisions.get(row.id) ?? { kind: "none" }
    if (contactDecision.kind === "link") {
      await maybeApplyContactDecision(
        client,
        row,
        contactDecision.decision,
        runId,
        dryRun,
        result
      )
    } else if (contactDecision.kind === "already-linked") {
      result.skippedAlreadyLinked += 1
    } else if (contactDecision.kind === "ambiguous-contact") {
      result.skippedAmbiguousContact += 1
      pushSample(result.samples.ambiguous, contactDecision.sample)
    } else if (contactDecision.kind === "ambiguous-recipients") {
      result.skippedAmbiguousRecipients += 1
    } else if (contactDecision.kind === "unknown") {
      result.skippedUnknownParty += 1
      if (contactDecision.email) {
        const current = emailCounts.get(contactDecision.email)
        if (current) current.unknown = true
      }
    }

    const effectiveContactId =
      contactDecision.kind === "link"
        ? (contactDecision.decision.newContactId ?? null)
        : row.contactId
    const dealDecision = planDealDecision(
      row,
      effectiveContactId,
      dealsByContactId
    )
    if (dealDecision.kind === "link") {
      await maybeApplyDealDecision(
        client,
        row,
        dealDecision.decision,
        runId,
        dryRun,
        result
      )
    } else if (dealDecision.kind === "multiple-deals") {
      result.skippedMultipleDeals += 1
    }
  }

  result.samples.unknownTopEmails = [...emailCounts.entries()]
    .filter(([, value]) => value.unknown)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([email, value]) => ({
      email,
      count: value.count,
      lastDate: value.lastDate.toISOString(),
    }))

  return result
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT)
}

function emptyResult(
  runId: string,
  dryRun: boolean
): CommunicationLinkBackfillResult {
  return {
    runId,
    dryRun,
    scanned: 0,
    nextCursor: null,
    updatedContactId: 0,
    updatedDealId: 0,
    skippedAlreadyLinked: 0,
    skippedUnknownParty: 0,
    skippedAmbiguousContact: 0,
    skippedAmbiguousRecipients: 0,
    skippedMultipleDeals: 0,
    skippedRaceLost: 0,
    samples: { linked: [], ambiguous: [], unknownTopEmails: [] },
  }
}

function collectCandidateEmails(
  rows: CommunicationRow[],
  config: OutboundFilterConfig
): Map<string, { count: number; lastDate: Date; unknown?: boolean }> {
  const counts = new Map<
    string,
    { count: number; lastDate: Date; unknown?: boolean }
  >()
  for (const row of rows) {
    const parties = readCommunicationParties(row.metadata)
    const emails =
      row.direction === "outbound"
        ? filterOutboundBusinessRecipients(
            [...parties.to, ...parties.cc],
            config
          ).map((party) => party.address)
        : [parties.from?.address]
    for (const email of emails) {
      const normalized = normalizeEmail(email)
      if (!normalized) continue
      const current = counts.get(normalized)
      if (!current) {
        counts.set(normalized, { count: 1, lastDate: row.date })
      } else {
        current.count += 1
        if (row.date > current.lastDate) current.lastDate = row.date
      }
    }
  }
  return counts
}

async function loadContactsByEmail(
  client: DbLike,
  emails: string[]
): Promise<Map<string, ContactMatch[]>> {
  if (emails.length === 0) return new Map()
  const contacts = await client.contact.findMany({
    where: {
      OR: emails.map((email) => ({
        email: { equals: email, mode: "insensitive" as const },
      })),
    },
    select: { id: true, email: true, archivedAt: true },
  })
  const map = new Map<string, ContactMatch[]>()
  for (const contact of contacts) {
    const email = normalizeEmail(contact.email)
    if (!email) continue
    const matches = map.get(email) ?? []
    matches.push(contact)
    map.set(email, matches)
  }
  return map
}

async function loadActiveDealsByContactId(
  client: DbLike,
  contactIds: string[]
): Promise<Map<string, DealMatch[]>> {
  const uniqueContactIds = [...new Set(contactIds)]
  if (uniqueContactIds.length === 0) return new Map()
  const deals = await client.deal.findMany({
    where: {
      contactId: { in: uniqueContactIds },
      archivedAt: null,
      stage: { not: "closed" },
    },
    select: { id: true, contactId: true, archivedAt: true, stage: true },
  })
  const map = new Map<string, DealMatch[]>()
  for (const deal of deals) {
    const matches = map.get(deal.contactId) ?? []
    matches.push(deal)
    map.set(deal.contactId, matches)
  }
  return map
}

type ContactDecision =
  | { kind: "link"; decision: BackfillDecision }
  | { kind: "already-linked" }
  | { kind: "unknown"; email?: string }
  | { kind: "ambiguous-contact"; sample: BackfillDecision }
  | { kind: "ambiguous-recipients" }
  | { kind: "none" }

function planContactDecision(
  row: CommunicationRow,
  contactsByEmail: Map<string, ContactMatch[]>,
  config: OutboundFilterConfig
): ContactDecision {
  if (row.contactId) return { kind: "already-linked" }
  const parties = readCommunicationParties(row.metadata)
  const strategy =
    row.direction === "outbound"
      ? "outbound_single_recipient_exact_email"
      : "inbound_sender_exact_email"
  const emails =
    row.direction === "outbound"
      ? filterOutboundBusinessRecipients([...parties.to, ...parties.cc], config)
          .map((party) => party.address)
          .filter((email): email is string => Boolean(email))
      : parties.from?.address
        ? [parties.from.address]
        : []

  const uniqueEmails = [
    ...new Set(emails.map((email) => normalizeEmail(email)).filter(Boolean)),
  ] as string[]
  if (row.direction === "outbound" && uniqueEmails.length > 1) {
    return { kind: "ambiguous-recipients" }
  }
  const email = uniqueEmails[0]
  if (!email) return { kind: "unknown" }

  const matches = (contactsByEmail.get(email) ?? []).filter(
    (contact) => !contact.archivedAt
  )
  if (matches.length === 0) return { kind: "unknown", email }
  const sample: BackfillDecision = {
    communicationId: row.id,
    strategy,
    matchedEmail: email,
    previousContactId: null,
    newContactId: matches[0]!.id,
    confidence: 1,
  }
  if (matches.length > 1) return { kind: "ambiguous-contact", sample }
  return { kind: "link", decision: sample }
}

type DealDecision =
  | { kind: "link"; decision: BackfillDecision }
  | { kind: "multiple-deals" }
  | { kind: "none" }

function planDealDecision(
  row: CommunicationRow,
  contactId: string | null,
  dealsByContactId: Map<string, DealMatch[]>
): DealDecision {
  if (!contactId || row.dealId) return { kind: "none" }
  const deals = dealsByContactId.get(contactId) ?? []
  if (deals.length === 0) return { kind: "none" }
  if (deals.length > 1) return { kind: "multiple-deals" }
  return {
    kind: "link",
    decision: {
      communicationId: row.id,
      strategy: "single_active_deal_for_contact",
      previousDealId: null,
      newDealId: deals[0]!.id,
      confidence: 1,
    },
  }
}

async function maybeApplyContactDecision(
  client: DbLike,
  row: CommunicationRow,
  decision: BackfillDecision,
  runId: string,
  dryRun: boolean,
  result: CommunicationLinkBackfillResult
): Promise<void> {
  pushSample(result.samples.linked, decision)
  if (dryRun) {
    result.updatedContactId += 1
    return
  }
  const update = await client.communication.updateMany({
    where: { id: row.id, contactId: null },
    data: {
      contactId: decision.newContactId,
      metadata: mergeBackfillMetadata(row.metadata, {
        contactLink: {
          runId,
          linkedAt: new Date().toISOString(),
          strategy: decision.strategy,
          matchedEmail: decision.matchedEmail,
          previousContactId: row.contactId,
          newContactId: decision.newContactId,
          confidence: decision.confidence,
          dryRun: false,
        },
      }),
    },
  })
  if (update.count === 1) result.updatedContactId += 1
  else result.skippedRaceLost += 1
}

async function maybeApplyDealDecision(
  client: DbLike,
  row: CommunicationRow,
  decision: BackfillDecision,
  runId: string,
  dryRun: boolean,
  result: CommunicationLinkBackfillResult
): Promise<void> {
  pushSample(result.samples.linked, decision)
  if (dryRun) {
    result.updatedDealId += 1
    return
  }
  const update = await client.communication.updateMany({
    where: { id: row.id, dealId: null },
    data: {
      dealId: decision.newDealId,
      metadata: mergeBackfillMetadata(row.metadata, {
        dealLink: {
          runId,
          linkedAt: new Date().toISOString(),
          strategy: decision.strategy,
          previousDealId: row.dealId,
          newDealId: decision.newDealId,
          confidence: decision.confidence,
          dryRun: false,
        },
      }),
    },
  })
  if (update.count === 1) result.updatedDealId += 1
  else result.skippedRaceLost += 1
}

function mergeBackfillMetadata(
  metadata: Prisma.JsonValue | null,
  patch: MetadataRecord
): Prisma.InputJsonValue {
  const existing = asRecord(metadata)
  const existingBackfill = asRecord(existing.backfill)
  return {
    ...existing,
    backfill: {
      ...existingBackfill,
      ...patch,
    },
  } as Prisma.InputJsonValue
}

function pushSample(
  samples: BackfillDecision[],
  sample: BackfillDecision
): void {
  if (samples.length < 20) samples.push(sample)
}
