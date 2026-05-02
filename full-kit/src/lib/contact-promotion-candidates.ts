import type {
  ContactPromotionCandidateStatus,
  LeadSource,
  Prisma,
  PrismaClient,
} from "@prisma/client"

import { db } from "@/lib/prisma"

import { maybeFireAutoReplyForApprovedLead } from "./contact-promotion-auto-reply"

type CandidateClient = Pick<
  PrismaClient,
  "$transaction" | "communication" | "contact" | "contactPromotionCandidate"
>

type CandidateTransaction = Prisma.TransactionClient

export type CandidateReviewAction =
  | "approve_create_contact"
  | "approve_link_contact"
  | "reject"
  | "not_a_contact"
  | "needs_more_evidence"
  | "snooze"

export type CandidateActionInput = {
  id: string
  action: CandidateReviewAction
  contactId?: string
  reviewer?: string
  reason?: string
  snoozedUntil?: Date
  now?: Date
  client?: CandidateClient
}

export type CandidateListFilters = {
  status?: ContactPromotionCandidateStatus
  includeTerminal?: boolean
  client?: CandidateClient
  now?: Date
}

const ACTIVE_STATUSES: ContactPromotionCandidateStatus[] = [
  "pending",
  "needs_more_evidence",
]

const TERMINAL_STATUSES = new Set<ContactPromotionCandidateStatus>([
  "approved",
  "merged",
  "rejected",
  "not_a_contact",
  "superseded",
])

const LEAD_SOURCES = new Set<LeadSource>([
  "crexi",
  "loopnet",
  "buildout",
  "email_cold",
  "referral",
])

const CANDIDATE_SELECT = {
  id: true,
  normalizedEmail: true,
  displayName: true,
  company: true,
  phone: true,
  message: true,
  source: true,
  sourcePlatform: true,
  sourceKind: true,
  status: true,
  confidenceScore: true,
  evidenceCount: true,
  firstSeenAt: true,
  lastSeenAt: true,
  suggestedContactId: true,
  approvedContactId: true,
  communicationId: true,
  dedupeKey: true,
  snoozedUntil: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactPromotionCandidateSelect

const CONTACT_SELECT = {
  id: true,
  name: true,
  company: true,
  email: true,
  phone: true,
  leadSource: true,
  leadStatus: true,
} satisfies Prisma.ContactSelect

const COMMUNICATION_SELECT = {
  id: true,
  channel: true,
  subject: true,
  body: true,
  date: true,
  direction: true,
  contactId: true,
  createdBy: true,
  externalMessageId: true,
  conversationId: true,
  metadata: true,
} satisfies Prisma.CommunicationSelect

type CandidateRow = Prisma.ContactPromotionCandidateGetPayload<{
  select: typeof CANDIDATE_SELECT
}>

type ContactSummary = Prisma.ContactGetPayload<{
  select: typeof CONTACT_SELECT
}>

type CommunicationSummary = Prisma.CommunicationGetPayload<{
  select: typeof COMMUNICATION_SELECT
}>

export type CandidateReviewRow = CandidateRow & {
  communication: CommunicationSummary | null
  evidenceCommunications: CommunicationSummary[]
  matchingContacts: ContactSummary[]
}

export class CandidateReviewError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
  }
}

export async function listContactPromotionCandidates({
  status,
  includeTerminal = false,
  client = db,
  now = new Date(),
}: CandidateListFilters = {}): Promise<CandidateReviewRow[]> {
  const candidates = await client.contactPromotionCandidate.findMany({
    where: candidateListWhere({ status, includeTerminal, now }),
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
    select: CANDIDATE_SELECT,
  })

  const communicationIds = [
    ...new Set(
      candidates.flatMap((candidate) => [
        candidate.communicationId,
        ...metadataStringArray(candidate.metadata, "communicationIds"),
      ])
    ),
  ].filter((id): id is string => !!id)

  const communications = communicationIds.length
    ? await client.communication.findMany({
        where: { id: { in: communicationIds } },
        select: COMMUNICATION_SELECT,
      })
    : []
  const communicationsById = new Map(
    communications.map((communication) => [communication.id, communication])
  )

  return Promise.all(
    candidates.map(async (candidate) => {
      const matchingContacts = await findMatchingContacts(client, candidate)
      const evidenceCommunications = evidenceCommunicationIds(candidate)
        .map((id) => communicationsById.get(id))
        .filter(
          (communication): communication is CommunicationSummary =>
            !!communication
        )
        .sort((a, b) => b.date.getTime() - a.date.getTime())
      return {
        ...candidate,
        communication: candidate.communicationId
          ? (communicationsById.get(candidate.communicationId) ?? null)
          : null,
        evidenceCommunications,
        matchingContacts,
      }
    })
  )
}

export async function countContactPromotionCandidates({
  status,
  includeTerminal = false,
  client = db,
  now = new Date(),
}: CandidateListFilters = {}): Promise<number> {
  return client.contactPromotionCandidate.count({
    where: candidateListWhere({ status, includeTerminal, now }),
  })
}

export async function reviewContactPromotionCandidate({
  id,
  action,
  contactId,
  reviewer = "manual-review",
  reason,
  snoozedUntil,
  now = new Date(),
  client = db,
}: CandidateActionInput) {
  const result = await client.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id
      FROM "contact_promotion_candidates"
      WHERE id = ${id}
      FOR UPDATE
    `
    const candidate = await tx.contactPromotionCandidate.findUnique({
      where: { id },
      select: CANDIDATE_SELECT,
    })
    if (!candidate) throw new CandidateReviewError("candidate not found", 404)
    await lockCandidateIdentity(tx, candidate)

    if (action === "approve_create_contact") {
      return approveCreateContact(tx, candidate, { now, reviewer, reason })
    }
    if (action === "approve_link_contact") {
      if (!contactId)
        throw new CandidateReviewError("contactId is required", 400)
      return approveLinkContact(tx, candidate, contactId, {
        now,
        reviewer,
        reason,
      })
    }
    if (action === "reject") {
      return markCandidate(tx, candidate, "rejected", {
        action,
        now,
        reviewer,
        reason,
      })
    }
    if (action === "not_a_contact") {
      return markCandidate(tx, candidate, "not_a_contact", {
        action,
        now,
        reviewer,
        reason,
      })
    }
    if (action === "needs_more_evidence") {
      return markCandidate(tx, candidate, "needs_more_evidence", {
        action,
        now,
        reviewer,
        reason,
      })
    }
    if (action === "snooze") {
      return markCandidate(tx, candidate, "snoozed", {
        action,
        now,
        reviewer,
        reason,
        snoozedUntil: snoozedUntil ?? new Date(now.getTime() + 7 * 86_400_000),
      })
    }

    throw new CandidateReviewError("unsupported action", 400)
  })

  // Phase E (2026-05-02 deal-pipeline-automation plan):
  // After the candidate-approval transaction has committed, fire the
  // auto-reply hook in fire-and-forget fashion. The hook itself wraps in
  // try/catch and never throws, but we ALSO wrap here as belt-and-suspenders
  // so any future regression in the hook cannot break the approve API
  // response. Only fires for fresh approvals (skipped for idempotent replays).
  const trigger = (result as { autoReplyTrigger?: AutoReplyTrigger })
    .autoReplyTrigger
  if (trigger && !result.idempotent) {
    try {
      const hookResult = await maybeFireAutoReplyForApprovedLead(trigger)
      if (hookResult.status === "errored") {
        console.warn(
          `[contact-promotion] auto-reply hook errored: ${hookResult.error}`
        )
      }
    } catch (err) {
      console.warn(
        `[contact-promotion] auto-reply hook threw: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return result
}

type AutoReplyTrigger = {
  communicationId: string | null | undefined
  contactId: string
  contactEmail: string | null | undefined
  contactName: string | null | undefined
}

async function lockCandidateIdentity(
  tx: CandidateTransaction,
  candidate: CandidateRow
): Promise<void> {
  if (!candidate.normalizedEmail) return
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${"contact-promotion-email:" + candidate.normalizedEmail}))
  `
}

async function approveCreateContact(
  tx: CandidateTransaction,
  candidate: CandidateRow,
  context: ReviewContext
) {
  const existingDecision = await returnExistingApprovedContact(tx, candidate)
  if (existingDecision) return existingDecision
  ensureCanApprove(candidate)

  const duplicates = await findDuplicateContacts(tx, candidate)
  if (duplicates.length > 1) {
    throw new CandidateReviewError(
      "multiple active contacts match candidate email",
      409
    )
  }
  const duplicate = duplicates[0]
  if (duplicate) {
    return approveLinkContact(tx, candidate, duplicate.id, {
      ...context,
      reason: context.reason ?? "Matched existing Contact by candidate email.",
    })
  }

  // leadAt should reflect when the lead actually originated (the date of
  // the inquiry email), not when the candidate row happened to be created
  // by an ingest script. We look up the linked Communication's date when
  // available, falling back to firstSeenAt only if the comm is missing.
  const inquiryDate = await resolveInquiryDate(tx, candidate)

  const contact = await tx.contact.create({
    data: {
      name:
        candidate.displayName?.trim() ||
        candidate.normalizedEmail?.trim() ||
        "Unknown contact candidate",
      company: candidate.company,
      email: candidate.normalizedEmail,
      phone: candidate.phone,
      notes: buildPromotionNotes(candidate),
      category: "business",
      tags: ["candidate-approved", candidate.sourcePlatform].filter(
        (tag): tag is string => !!tag
      ),
      createdBy: "candidate-review",
      leadSource: leadSourceFromCandidate(candidate),
      leadStatus: "new",
      leadAt: inquiryDate,
      leadLastViewedAt: context.now,
    },
    select: CONTACT_SELECT,
  })

  await linkEvidenceCommunications(tx, candidate, contact.id, context)
  const updated = await updateCandidateDecision(tx, candidate, "approved", {
    ...context,
    action: "approve_create_contact",
    approvedContactId: contact.id,
    contactCreated: true,
  })

  return {
    candidate: updated,
    contact,
    idempotent: false,
    autoReplyTrigger: {
      communicationId: candidate.communicationId,
      contactId: contact.id,
      contactEmail: contact.email,
      contactName: contact.name,
    },
  }
}

async function approveLinkContact(
  tx: CandidateTransaction,
  candidate: CandidateRow,
  contactId: string,
  context: ReviewContext
) {
  if (
    candidate.approvedContactId &&
    candidate.approvedContactId !== contactId
  ) {
    throw new CandidateReviewError(
      "candidate is already linked to another contact",
      409
    )
  }
  const existingDecision = await returnExistingApprovedContact(tx, candidate)
  if (existingDecision) return existingDecision
  ensureCanApprove(candidate)

  const contact = await tx.contact.findUnique({
    where: { id: contactId },
    select: CONTACT_SELECT,
  })
  if (!contact) throw new CandidateReviewError("contact not found", 404)

  await linkEvidenceCommunications(tx, candidate, contact.id, context)
  const updated = await updateCandidateDecision(tx, candidate, "merged", {
    ...context,
    action: "approve_link_contact",
    approvedContactId: contact.id,
    contactCreated: false,
  })

  return {
    candidate: updated,
    contact,
    idempotent: false,
    autoReplyTrigger: {
      communicationId: candidate.communicationId,
      contactId: contact.id,
      contactEmail: contact.email,
      contactName: contact.name,
    },
  }
}

async function markCandidate(
  tx: CandidateTransaction,
  candidate: CandidateRow,
  status: ContactPromotionCandidateStatus,
  context: ReviewContext & { action: CandidateReviewAction }
) {
  const currentStatus = candidate.status
  if (
    currentStatus === status &&
    (status !== "snoozed" ||
      sameTime(candidate.snoozedUntil, context.snoozedUntil))
  ) {
    return { candidate, contact: null, idempotent: true }
  }
  if (TERMINAL_STATUSES.has(currentStatus) && currentStatus !== status) {
    throw new CandidateReviewError(`candidate is already ${currentStatus}`, 409)
  }

  const updated = await updateCandidateDecision(tx, candidate, status, context)
  return { candidate: updated, contact: null, idempotent: false }
}

async function returnExistingApprovedContact(
  tx: CandidateTransaction,
  candidate: CandidateRow
) {
  if (!candidate.approvedContactId) return null
  if (candidate.status !== "approved" && candidate.status !== "merged") {
    return null
  }
  const contact = await tx.contact.findUnique({
    where: { id: candidate.approvedContactId },
    select: CONTACT_SELECT,
  })
  return { candidate, contact, idempotent: true }
}

function ensureCanApprove(candidate: CandidateRow) {
  if (candidate.status === "rejected" || candidate.status === "not_a_contact") {
    throw new CandidateReviewError(
      `candidate is already ${candidate.status}`,
      409
    )
  }
}

function candidateListWhere({
  status,
  includeTerminal = false,
  now = new Date(),
}: Omit<
  CandidateListFilters,
  "client"
>): Prisma.ContactPromotionCandidateWhereInput {
  if (status) return { status }
  if (includeTerminal) return {}
  return {
    OR: [
      { status: { in: ACTIVE_STATUSES } },
      { status: "snoozed", snoozedUntil: { lte: now } },
      { status: "snoozed", snoozedUntil: null },
    ],
  }
}

async function updateCandidateDecision(
  tx: CandidateTransaction,
  candidate: CandidateRow,
  status: ContactPromotionCandidateStatus,
  context: ReviewContext & {
    action: CandidateReviewAction
    approvedContactId?: string
    contactCreated?: boolean
  }
) {
  const promotionReview = {
    action: context.action,
    decidedAt: context.now.toISOString(),
    reviewer: context.reviewer,
    reason: context.reason ?? null,
    status,
    approvedContactId: context.approvedContactId ?? null,
    contactCreated: context.contactCreated ?? false,
    snoozedUntil: context.snoozedUntil?.toISOString() ?? null,
    evidenceSnapshot: evidenceSnapshot(candidate),
  }

  return tx.contactPromotionCandidate.update({
    where: { id: candidate.id },
    data: {
      status,
      approvedContactId: context.approvedContactId,
      snoozedUntil: status === "snoozed" ? context.snoozedUntil : null,
      metadata: {
        ...jsonObject(candidate.metadata),
        promotionReview,
        promotionReviewHistory: [
          ...metadataObjectArray(candidate.metadata, "promotionReviewHistory"),
          promotionReview,
        ],
      } satisfies Prisma.InputJsonObject,
    },
    select: CANDIDATE_SELECT,
  })
}

async function linkEvidenceCommunications(
  tx: CandidateTransaction,
  candidate: CandidateRow,
  contactId: string,
  context: ReviewContext
) {
  const communicationIds = evidenceCommunicationIds(candidate)
  if (communicationIds.length === 0) return

  const communications = await tx.communication.findMany({
    where: { id: { in: communicationIds } },
    select: { id: true, contactId: true, metadata: true },
  })
  const conflicting = communications.find(
    (communication) =>
      communication.contactId !== null && communication.contactId !== contactId
  )
  if (conflicting) {
    throw new CandidateReviewError(
      "communication is already linked to another contact",
      409
    )
  }

  for (const communication of communications) {
    const updated = await tx.communication.updateMany({
      where: {
        id: communication.id,
        OR: [{ contactId: null }, { contactId }],
      },
      data: {
        contactId,
        metadata: mergeCommunicationReviewMetadata(
          communication.metadata,
          candidate,
          context,
          contactId
        ),
      },
    })
    if (updated.count !== 1) {
      throw new CandidateReviewError(
        "communication is already linked to another contact",
        409
      )
    }
  }
}

async function resolveInquiryDate(
  tx: CandidateTransaction,
  candidate: CandidateRow
): Promise<Date> {
  if (!candidate.communicationId) return candidate.firstSeenAt
  const comm = await tx.communication.findUnique({
    where: { id: candidate.communicationId },
    select: { date: true },
  })
  return comm?.date ?? candidate.firstSeenAt
}

async function findMatchingContacts(
  client: Pick<CandidateClient, "contact">,
  candidate: CandidateRow
): Promise<ContactSummary[]> {
  const email = candidate.normalizedEmail?.trim()
  const phone = candidate.phone?.trim()
  if (!email && !phone && !candidate.suggestedContactId) return []

  return client.contact.findMany({
    where: {
      OR: [
        ...(candidate.suggestedContactId
          ? [{ id: candidate.suggestedContactId }]
          : []),
        ...(email
          ? [{ email: { equals: email, mode: "insensitive" as const } }]
          : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: CONTACT_SELECT,
    take: 5,
  })
}

async function findDuplicateContacts(
  tx: CandidateTransaction,
  candidate: CandidateRow
): Promise<ContactSummary[]> {
  if (!candidate.normalizedEmail) return []
  return tx.contact.findMany({
    where: {
      email: { equals: candidate.normalizedEmail, mode: "insensitive" },
      archivedAt: null,
    },
    select: CONTACT_SELECT,
    take: 2,
  })
}

function buildPromotionNotes(candidate: CandidateRow): string {
  const lines = [
    "Created from a reviewed contact promotion candidate.",
    `Candidate ID: ${candidate.id}`,
    `Source: ${candidate.sourcePlatform ?? candidate.source} / ${
      candidate.sourceKind ?? "unknown"
    }`,
    `Evidence count: ${candidate.evidenceCount}`,
    `First seen: ${candidate.firstSeenAt.toISOString()}`,
    `Last seen: ${candidate.lastSeenAt.toISOString()}`,
  ]
  if (candidate.message) lines.push("", candidate.message)
  return lines.join("\n")
}

function leadSourceFromCandidate(candidate: CandidateRow): LeadSource | null {
  const metadataSource = metadataString(candidate.metadata, "leadSource")
  const source = metadataSource ?? candidate.sourcePlatform
  return source && LEAD_SOURCES.has(source as LeadSource)
    ? (source as LeadSource)
    : null
}

function evidenceSnapshot(candidate: CandidateRow) {
  return {
    candidateId: candidate.id,
    dedupeKey: candidate.dedupeKey,
    normalizedEmail: candidate.normalizedEmail,
    displayName: candidate.displayName,
    company: candidate.company,
    phone: candidate.phone,
    message: candidate.message,
    source: candidate.source,
    sourcePlatform: candidate.sourcePlatform,
    sourceKind: candidate.sourceKind,
    communicationId: candidate.communicationId,
    evidenceCount: candidate.evidenceCount,
    firstSeenAt: candidate.firstSeenAt.toISOString(),
    lastSeenAt: candidate.lastSeenAt.toISOString(),
    metadata: candidate.metadata,
  }
}

function evidenceCommunicationIds(candidate: CandidateRow): string[] {
  return [
    ...new Set([
      candidate.communicationId,
      ...metadataStringArray(candidate.metadata, "communicationIds"),
    ]),
  ].filter((id): id is string => !!id)
}

function mergeCommunicationReviewMetadata(
  metadata: Prisma.JsonValue | null,
  candidate: CandidateRow,
  context: ReviewContext,
  contactId: string
): Prisma.InputJsonValue {
  return {
    ...jsonObject(metadata),
    promotionReview: {
      candidateId: candidate.id,
      contactId,
      linkedAt: context.now.toISOString(),
      reviewer: context.reviewer,
    },
  } satisfies Prisma.InputJsonObject
}

type ReviewContext = {
  now: Date
  reviewer: string
  reason?: string
  snoozedUntil?: Date
}

function metadataString(metadata: unknown, key: string): string | null {
  const value = jsonObject(metadata)[key]
  return typeof value === "string" ? value : null
}

function metadataStringArray(metadata: unknown, key: string): string[] {
  const value = jsonObject(metadata)[key]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function metadataObjectArray(
  metadata: unknown,
  key: string
): Prisma.InputJsonObject[] {
  const value = jsonObject(metadata)[key]
  return Array.isArray(value)
    ? value.filter(
        (item): item is Prisma.InputJsonObject =>
          !!item && typeof item === "object" && !Array.isArray(item)
      )
    : []
}

function jsonObject(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

function sameTime(a: Date | null, b: Date | undefined): boolean {
  if (!a && !b) return true
  return a?.getTime() === b?.getTime()
}
