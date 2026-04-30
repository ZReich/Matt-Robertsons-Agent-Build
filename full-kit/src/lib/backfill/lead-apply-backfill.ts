import type { InquirerInfo } from "@/lib/msgraph/email-extractors"
import type { LeadSource, Prisma, PrismaClient } from "@prisma/client"
import type { LeadDiagnosticPlatform } from "./lead-extractor-diagnostics"

import {
  evaluateContactAutoPromotion,
  hasRealAttachmentEvidenceFromMetadata,
  readContactAutoPromotionMode,
} from "@/lib/contact-auto-promotion-policy"
import { proposeStageMoveFromBuildoutEmail } from "@/lib/deals/buildout-stage-action"
import { upsertDealForLead } from "@/lib/deals/lead-to-deal"
import {
  extractBuildoutEvent,
  extractCrexiLead,
  extractLoopNetLead,
} from "@/lib/msgraph/email-extractors"
import { db } from "@/lib/prisma"

import { detectLeadPlatform } from "./lead-extractor-diagnostics"

type DbLike = PrismaClient

export type LeadApplyBackfillRequest = {
  dryRun?: boolean
  limit?: number
  cursor?: string | null
  runId?: string
}

export type LeadApplyOutcome =
  | "would_create_lead_contact"
  | "created_lead_contact"
  | "would_create_contact_candidate"
  | "would_auto_create_sender_contact"
  | "created_contact_candidate"
  | "created_sender_contact"
  | "updated_contact_candidate"
  | "would_link_existing_contact"
  | "linked_existing_contact"
  | "already_lead"
  | "already_client_no_lead_status"
  | "skipped_noise"
  | "skipped_uncertain"
  | "skipped_non_signal"
  | "skipped_non_platform"
  | "skipped_extractor_null"
  | "skipped_no_inquirer_email"
  | "skipped_existing_contact"
  | "skipped_ambiguous_contact"
  | "skipped_race_lost"
  | "proposed_buildout_stage_move"

export type LeadApplySample = {
  communicationId: string
  platform?: LeadDiagnosticPlatform
  outcome: LeadApplyOutcome
  extractedKind?: string
  inquirerEmail?: string
  previousContactId?: string | null
  contactId?: string | null
}

export type LeadApplyBackfillResult = {
  runId: string
  dryRun: boolean
  scanned: number
  nextCursor: string | null
  createdLeadContacts: number
  createdSenderContacts: number
  createdContactCandidates: number
  markedExistingContacts: number
  communicationLinked: number
  byOutcome: Partial<Record<LeadApplyOutcome, number>>
  samples: LeadApplySample[]
}

type CommunicationRow = {
  id: string
  subject: string | null
  body: string | null
  metadata: Prisma.JsonValue | null
  date: Date
  contactId: string | null
}

type ContactLookup = {
  id: string
  email: string | null
  archivedAt?: Date | null
  leadSource: LeadSource | null
  leadStatus: string | null
  _count: { deals: number }
}

type ExtractedLead = {
  platform: LeadDiagnosticPlatform
  leadSource: LeadSource
  kind: string
  inquirer: InquirerInfo & { email: string }
  propertyKey?: string
  propertyAddress?: string
  propertyAliases?: string[]
  propertyAddressMissing?: boolean
}

type SenderCandidate = {
  email: string
  displayName: string | null
  sourceKind: string | null
}

const DEFAULT_LIMIT = 25
const MAX_WRITE_LIMIT = 100
const ADVISORY_LOCK_KEY = "historical-lead-apply-backfill"

export async function runLeadApplyBackfill({
  request = {},
  client = db,
}: {
  request?: LeadApplyBackfillRequest
  client?: DbLike
} = {}): Promise<LeadApplyBackfillResult> {
  const dryRun = request.dryRun ?? true
  const limit = readLimit(request.limit)
  const runId = request.runId ?? `lead-apply-${new Date().toISOString()}`

  if (!dryRun) {
    if (!request.runId) throw new Error("runId is required when dryRun=false")
    if (request.limit === undefined)
      throw new Error("limit is required when dryRun=false")
    if (request.limit > MAX_WRITE_LIMIT)
      throw new Error(`limit must be <= ${MAX_WRITE_LIMIT} when dryRun=false`)
  }

  const rows = await client.communication.findMany({
    where: {
      id: request.cursor ? { gt: request.cursor } : undefined,
      channel: "email",
      archivedAt: null,
      metadata: { path: ["classification"], equals: "signal" },
    },
    orderBy: { id: "asc" },
    take: limit,
    select: {
      id: true,
      subject: true,
      body: true,
      metadata: true,
      date: true,
      contactId: true,
    },
  })

  const result = emptyResult(runId, dryRun)
  result.scanned = rows.length
  result.nextCursor = rows.length === limit ? (rows.at(-1)?.id ?? null) : null

  const extractedById = new Map<string, ExtractedLead>()
  const senderCandidateById = new Map<string, SenderCandidate>()
  for (const row of rows) {
    const extracted = extractLead(row)
    if (extracted) extractedById.set(row.id, extracted)
    const senderCandidate = extractSenderCandidate(row)
    if (senderCandidate) senderCandidateById.set(row.id, senderCandidate)
  }
  const contactsByEmail = await loadContactsByEmail(client, [
    ...[...extractedById.values()].map((item) => item.inquirer.email),
    ...[...senderCandidateById.values()].map((item) => item.email),
  ])

  if (dryRun) {
    for (const row of rows) {
      planRow(
        row,
        extractedById.get(row.id),
        senderCandidateById.get(row.id),
        contactsByEmail,
        result
      )
    }
    return result
  }

  const locked = await tryAdvisoryLock(client)
  if (!locked)
    throw new Error("historical lead apply backfill is already running")
  try {
    for (const row of rows) {
      await applyRow(
        row,
        extractedById.get(row.id),
        senderCandidateById.get(row.id),
        contactsByEmail,
        result,
        client
      )
    }
    await proposeBuildoutStageMoves(rows, result)
    return result
  } finally {
    await releaseAdvisoryLock(client)
  }
}

async function proposeBuildoutStageMoves(
  rows: CommunicationRow[],
  result: LeadApplyBackfillResult
): Promise<void> {
  for (const row of rows) {
    const tier1Rule = metadataString(row.metadata, "tier1Rule")
    if (
      tier1Rule !== "buildout-support" &&
      tier1Rule !== "buildout-notification"
    ) {
      continue
    }
    const extracted = extractBuildoutEvent({
      subject: row.subject,
      bodyText: row.body ?? "",
    })
    if (
      !extracted ||
      extracted.kind !== "deal-stage-update" ||
      !extracted.fromStageRaw ||
      !extracted.toStageRaw ||
      !extracted.propertyName
    ) {
      continue
    }
    const proposal = await proposeStageMoveFromBuildoutEmail({
      communicationId: row.id,
      propertyName: extracted.propertyName,
      fromStageRaw: extracted.fromStageRaw,
      toStageRaw: extracted.toStageRaw,
    })
    if (proposal.created) {
      record(result, row, "proposed_buildout_stage_move", {
        platform: "buildout",
        extractedKind: extracted.kind,
      })
    }
  }
}

function readLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT
  return Math.min(
    Math.max(Math.trunc(limit ?? DEFAULT_LIMIT), 1),
    MAX_WRITE_LIMIT
  )
}

function emptyResult(runId: string, dryRun: boolean): LeadApplyBackfillResult {
  return {
    runId,
    dryRun,
    scanned: 0,
    nextCursor: null,
    createdLeadContacts: 0,
    createdSenderContacts: 0,
    createdContactCandidates: 0,
    markedExistingContacts: 0,
    communicationLinked: 0,
    byOutcome: {},
    samples: [],
  }
}

function planRow(
  row: CommunicationRow,
  extracted: ExtractedLead | undefined,
  senderCandidate: SenderCandidate | undefined,
  contactsByEmail: Map<string, ContactLookup[]>,
  result: LeadApplyBackfillResult
): LeadApplyOutcome {
  const classification = metadataString(row.metadata, "classification")
  if (classification === "noise") return record(result, row, "skipped_noise")
  if (classification === "uncertain")
    return record(result, row, "skipped_uncertain")
  if (classification !== "signal")
    return record(result, row, "skipped_non_signal")

  const platform = detectLeadPlatform(row)
  if (!platform) {
    return planSenderCandidate(row, senderCandidate, contactsByEmail, result)
  }
  if (!extractPlatform(row, platform)) {
    return record(result, row, "skipped_extractor_null", { platform })
  }
  if (!extracted) {
    return record(result, row, "skipped_no_inquirer_email", { platform })
  }

  const contacts = contactsByEmail.get(extracted.inquirer.email) ?? []
  if (contacts.length > 1) {
    return record(result, row, "skipped_ambiguous_contact", {
      platform,
      extracted,
    })
  }
  const contact = contacts[0] ?? null
  if (row.contactId && row.contactId !== contact?.id) {
    return record(result, row, "skipped_existing_contact", {
      platform,
      extracted,
      contactId: contact?.id ?? null,
    })
  }
  if (!contact) {
    if (shouldAutoCreateLeadContact(extracted)) {
      return record(result, row, "would_create_lead_contact", {
        platform,
        extracted,
      })
    }
    return record(result, row, "would_create_contact_candidate", {
      platform,
      extracted,
    })
  }
  if (contact.leadSource) {
    if (!row.contactId) {
      return record(result, row, "would_link_existing_contact", {
        platform,
        extracted,
        contactId: contact.id,
      })
    }
    return record(result, row, "already_lead", {
      platform,
      extracted,
      contactId: contact.id,
    })
  }
  if (contact._count.deals > 0) {
    if (!row.contactId) {
      return record(result, row, "would_link_existing_contact", {
        platform,
        extracted,
        contactId: contact.id,
      })
    }
    return record(result, row, "already_client_no_lead_status", {
      platform,
      extracted,
      contactId: contact.id,
    })
  }
  return record(result, row, "would_link_existing_contact", {
    platform,
    extracted,
    contactId: contact.id,
  })
}

async function applyRow(
  row: CommunicationRow,
  extracted: ExtractedLead | undefined,
  senderCandidate: SenderCandidate | undefined,
  contactsByEmail: Map<string, ContactLookup[]>,
  result: LeadApplyBackfillResult,
  client: DbLike
): Promise<void> {
  const planned = planRow(
    row,
    extracted,
    senderCandidate,
    contactsByEmail,
    emptyResult(result.runId, true)
  )
  if (
    planned !== "would_create_contact_candidate" &&
    planned !== "would_auto_create_sender_contact" &&
    planned !== "would_create_lead_contact" &&
    planned !== "would_link_existing_contact"
  ) {
    record(
      result,
      row,
      planned,
      extracted ? { platform: extracted.platform, extracted } : {}
    )
    return
  }
  if (!extracted) {
    if (!senderCandidate) return
    if (planned === "would_link_existing_contact") {
      const contacts = contactsByEmail.get(senderCandidate.email) ?? []
      const contact = contacts.length === 1 ? contacts[0] : null
      if (!contact) {
        record(result, row, "skipped_race_lost", {
          inquirerEmail: senderCandidate.email,
          extractedKind: senderCandidate.sourceKind ?? "email-sender",
        })
        return
      }
      await linkExistingSenderContact(
        row,
        senderCandidate,
        contact.id,
        result,
        client
      )
      return
    }
    if (
      planned === "would_auto_create_sender_contact" &&
      readContactAutoPromotionMode() === "write"
    ) {
      await createSenderContact(row, senderCandidate, result, client)
      return
    }
    await client.$transaction(async (tx) => {
      const candidate = await upsertSenderContactPromotionCandidate(
        tx,
        row,
        senderCandidate,
        result.runId
      )
      result.createdContactCandidates += candidate.created ? 1 : 0
      record(
        result,
        row,
        candidate.created
          ? "created_contact_candidate"
          : "updated_contact_candidate",
        {
          inquirerEmail: senderCandidate.email,
          extractedKind: senderCandidate.sourceKind ?? "email-sender",
        }
      )
    })
    return
  }

  if (planned === "would_create_lead_contact") {
    await createLeadContact(row, extracted, result, client)
    return
  }

  if (planned === "would_link_existing_contact") {
    const contacts = contactsByEmail.get(extracted.inquirer.email) ?? []
    const contact = contacts.length === 1 ? contacts[0] : null
    if (!contact) {
      record(result, row, "skipped_race_lost", {
        platform: extracted.platform,
        extracted,
      })
      return
    }
    await linkExistingContact(
      row,
      extracted,
      contact.id,
      planned,
      result,
      client
    )
    return
  }

  await client.$transaction(async (tx) => {
    const candidate = await upsertContactPromotionCandidate(
      tx,
      row,
      extracted,
      result.runId
    )
    result.createdContactCandidates += candidate.created ? 1 : 0
    record(
      result,
      row,
      candidate.created
        ? "created_contact_candidate"
        : "updated_contact_candidate",
      {
        platform: extracted.platform,
        extracted,
      }
    )
  })
}

function planSenderCandidate(
  row: CommunicationRow,
  candidate: SenderCandidate | undefined,
  contactsByEmail: Map<string, ContactLookup[]>,
  result: LeadApplyBackfillResult
): LeadApplyOutcome {
  if (!candidate) return record(result, row, "skipped_non_platform")

  const contacts = contactsByEmail.get(candidate.email) ?? []
  const options = {
    inquirerEmail: candidate.email,
    extractedKind: candidate.sourceKind ?? "email-sender",
  }
  if (contacts.length > 1) {
    return record(result, row, "skipped_ambiguous_contact", options)
  }
  const contact = contacts[0] ?? null
  if (row.contactId && row.contactId !== contact?.id) {
    return record(result, row, "skipped_existing_contact", {
      ...options,
      contactId: contact?.id ?? null,
    })
  }
  if (!contact) {
    const promotion = evaluateContactAutoPromotion({
      classification: metadataString(row.metadata, "classification"),
      source: metadataString(row.metadata, "source"),
      direction: "inbound",
      normalizedEmail: candidate.email,
      displayName: candidate.displayName,
      contactMatches: [],
      currentCommunicationId: row.id,
      currentHasRealAttachment: hasRealAttachmentEvidenceFromMetadata(
        row.metadata
      ),
      mattRepliedBefore: metadataBoolean(
        metadataObject(row.metadata, "behavioralHints"),
        "mattRepliedBefore"
      ),
      materialCommunicationCount:
        metadataNumber(
          metadataObject(row.metadata, "behavioralHints"),
          "threadSize"
        ) ?? 1,
    })
    if (
      readContactAutoPromotionMode() !== "off" &&
      promotion.decision === "auto_create_contact"
    ) {
      return record(result, row, "would_auto_create_sender_contact", {
        ...options,
      })
    }
    return record(result, row, "would_create_contact_candidate", options)
  }
  if (!row.contactId) {
    return record(result, row, "would_link_existing_contact", {
      ...options,
      contactId: contact.id,
    })
  }
  if (contact.leadSource) {
    return record(result, row, "already_lead", {
      ...options,
      contactId: contact.id,
    })
  }
  if (contact._count.deals > 0) {
    return record(result, row, "already_client_no_lead_status", {
      ...options,
      contactId: contact.id,
    })
  }
  return record(result, row, "would_link_existing_contact", {
    ...options,
    contactId: contact.id,
  })
}

async function createLeadContact(
  row: CommunicationRow,
  extracted: ExtractedLead,
  result: LeadApplyBackfillResult,
  client: DbLike
): Promise<void> {
  const linkedContactId = await client.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${"platform-lead-email:" + extracted.inquirer.email}))
    `
    const duplicates = await tx.contact.findMany({
      where: {
        email: { equals: extracted.inquirer.email, mode: "insensitive" },
        archivedAt: null,
      },
      select: { id: true },
      take: 2,
    })
    if (duplicates.length > 1) {
      record(result, row, "skipped_ambiguous_contact", {
        platform: extracted.platform,
        extracted,
      })
      return null
    }
    const duplicate = duplicates[0] ?? null
    if (duplicate) {
      const update = await tx.communication.updateMany({
        where: {
          id: row.id,
          OR: [{ contactId: null }, { contactId: duplicate.id }],
        },
        data: {
          contactId: duplicate.id,
          metadata: mergeLeadApplyMetadata(row.metadata, {
            runId: result.runId,
            appliedAt: new Date().toISOString(),
            strategy: "historical-platform-lead-apply",
            platform: extracted.platform,
            source: metadataString(row.metadata, "source"),
            extractedKind: extracted.kind,
            inquirerEmail: extracted.inquirer.email,
            previousContactId: row.contactId,
            newContactId: duplicate.id,
            outcome: "linked_existing_contact",
            dryRun: false,
          }),
        },
      })
      if (update.count !== 1) {
        record(result, row, "skipped_race_lost", {
          platform: extracted.platform,
          extracted,
          contactId: duplicate.id,
        })
        return null
      }
      result.communicationLinked += 1
      record(result, row, "linked_existing_contact", {
        platform: extracted.platform,
        extracted,
        contactId: duplicate.id,
      })
      return duplicate.id
    }

    const [currentCommunication] = await tx.$queryRaw<
      Array<{ contactId: string | null }>
    >`
      SELECT contact_id AS "contactId"
      FROM communications
      WHERE id = ${row.id}
      FOR UPDATE
    `
    if (!currentCommunication || currentCommunication.contactId) {
      record(result, row, "skipped_race_lost", {
        platform: extracted.platform,
        extracted,
        contactId: currentCommunication?.contactId ?? null,
      })
      return null
    }

    const contact = await tx.contact.create({
      data: {
        name:
          extracted.inquirer.name?.trim() ||
          extracted.inquirer.email ||
          "Unknown lead",
        company: extracted.inquirer.company ?? null,
        email: extracted.inquirer.email,
        phone: extracted.inquirer.phone ?? null,
        notes: buildAutoLeadNotes(row, extracted),
        category: "business",
        tags: ["platform-lead", extracted.platform],
        createdBy: "historical-platform-lead-apply",
        leadSource: extracted.leadSource,
        leadStatus: "new",
        leadAt: row.date,
      },
      select: { id: true },
    })

    const update = await tx.communication.updateMany({
      where: {
        id: row.id,
        OR: [{ contactId: null }, { contactId: contact.id }],
      },
      data: {
        contactId: contact.id,
        metadata: mergeLeadApplyMetadata(row.metadata, {
          runId: result.runId,
          appliedAt: new Date().toISOString(),
          strategy: "historical-platform-lead-apply",
          platform: extracted.platform,
          source: metadataString(row.metadata, "source"),
          extractedKind: extracted.kind,
          inquirerEmail: extracted.inquirer.email,
          previousContactId: row.contactId,
          newContactId: contact.id,
          outcome: "created_lead_contact",
          dryRun: false,
        }),
      },
    })
    if (update.count !== 1) {
      record(result, row, "skipped_race_lost", {
        platform: extracted.platform,
        extracted,
        contactId: contact.id,
      })
      return null
    }
    result.createdLeadContacts += 1
    result.communicationLinked += 1
    record(result, row, "created_lead_contact", {
      platform: extracted.platform,
      extracted,
      contactId: contact.id,
    })
    return contact.id
  })

  // After the contact is linked to the communication, propagate to a Deal if
  // the extractor surfaced a propertyKey. The function is a no-op when
  // propertyKey is null (e.g., named-only addresses or non-property events).
  if (
    linkedContactId &&
    (extracted.propertyKey || extracted.propertyAddress)
  ) {
    await upsertDealForLead({
      contactId: linkedContactId,
      communicationId: row.id,
      propertyKey: extracted.propertyKey ?? null,
      propertyAddress: extracted.propertyAddress ?? null,
      propertySource: extracted.platform,
    })
  }
}

async function createSenderContact(
  row: CommunicationRow,
  candidate: SenderCandidate,
  result: LeadApplyBackfillResult,
  client: DbLike
): Promise<void> {
  await client.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${"contact-promotion-email:" + candidate.email}))
    `
    const duplicates = await tx.contact.findMany({
      where: {
        email: { equals: candidate.email, mode: "insensitive" },
        archivedAt: null,
      },
      select: { id: true },
      take: 2,
    })
    if (duplicates.length > 1) {
      record(result, row, "skipped_ambiguous_contact", {
        inquirerEmail: candidate.email,
        extractedKind: candidate.sourceKind ?? "email-sender",
      })
      return
    }
    const duplicate = duplicates[0] ?? null
    if (duplicate) {
      const update = await tx.communication.updateMany({
        where: {
          id: row.id,
          OR: [{ contactId: null }, { contactId: duplicate.id }],
        },
        data: {
          contactId: duplicate.id,
          metadata: mergeLeadApplyMetadata(row.metadata, {
            runId: result.runId,
            appliedAt: new Date().toISOString(),
            strategy: "historical-email-sender-auto-promotion",
            source: metadataString(row.metadata, "source"),
            extractedKind: candidate.sourceKind ?? "email-sender",
            inquirerEmail: candidate.email,
            previousContactId: row.contactId,
            newContactId: duplicate.id,
            outcome: "linked_existing_contact",
            dryRun: false,
          }),
        },
      })
      if (update.count !== 1) {
        record(result, row, "skipped_race_lost", {
          inquirerEmail: candidate.email,
          extractedKind: candidate.sourceKind ?? "email-sender",
          contactId: duplicate.id,
        })
        return
      }
      result.communicationLinked += 1
      record(result, row, "linked_existing_contact", {
        inquirerEmail: candidate.email,
        extractedKind: candidate.sourceKind ?? "email-sender",
        contactId: duplicate.id,
      })
      return
    }

    const [currentCommunication] = await tx.$queryRaw<
      Array<{ contactId: string | null }>
    >`
      SELECT contact_id AS "contactId"
      FROM communications
      WHERE id = ${row.id}
      FOR UPDATE
    `
    if (!currentCommunication || currentCommunication.contactId) {
      record(result, row, "skipped_race_lost", {
        inquirerEmail: candidate.email,
        extractedKind: candidate.sourceKind ?? "email-sender",
        contactId: currentCommunication?.contactId ?? null,
      })
      return
    }

    const promotion = evaluateContactAutoPromotion({
      classification: metadataString(row.metadata, "classification"),
      source: metadataString(row.metadata, "source"),
      direction: "inbound",
      normalizedEmail: candidate.email,
      displayName: candidate.displayName,
      contactMatches: [],
      currentCommunicationId: row.id,
      currentHasRealAttachment: hasRealAttachmentEvidenceFromMetadata(
        row.metadata
      ),
      mattRepliedBefore: metadataBoolean(
        metadataObject(row.metadata, "behavioralHints"),
        "mattRepliedBefore"
      ),
      materialCommunicationCount:
        metadataNumber(
          metadataObject(row.metadata, "behavioralHints"),
          "threadSize"
        ) ?? 1,
    })
    if (promotion.decision !== "auto_create_contact") {
      record(result, row, "skipped_race_lost", {
        inquirerEmail: candidate.email,
        extractedKind: candidate.sourceKind ?? "email-sender",
      })
      return
    }

    const contact = await tx.contact.create({
      data: {
        name: candidate.displayName || candidate.email,
        email: candidate.email,
        category: "business",
        tags: ["auto-promoted-contact", "historical-email-sender"],
        createdBy: "historical-email-sender-auto-promotion",
        notes: "Auto-created from historical email relationship evidence.",
      },
      select: { id: true },
    })

    const update = await tx.communication.updateMany({
      where: {
        id: row.id,
        OR: [{ contactId: null }, { contactId: contact.id }],
      },
      data: {
        contactId: contact.id,
        metadata: mergeLeadApplyMetadata(row.metadata, {
          runId: result.runId,
          appliedAt: new Date().toISOString(),
          strategy: "historical-email-sender-auto-promotion",
          inquirerEmail: candidate.email,
          extractedKind: candidate.sourceKind ?? "email-sender",
          previousContactId: row.contactId,
          newContactId: contact.id,
          outcome: "created_sender_contact",
          dryRun: false,
          autoPromotion: promotion,
        }),
      },
    })
    if (update.count !== 1) {
      record(result, row, "skipped_race_lost", {
        inquirerEmail: candidate.email,
        extractedKind: candidate.sourceKind ?? "email-sender",
        contactId: contact.id,
      })
      return
    }
    result.createdSenderContacts += 1
    result.communicationLinked += 1
    record(result, row, "created_sender_contact", {
      inquirerEmail: candidate.email,
      extractedKind: candidate.sourceKind ?? "email-sender",
      contactId: contact.id,
    })
  })
}

async function linkExistingContact(
  row: CommunicationRow,
  extracted: ExtractedLead,
  contactId: string,
  planned: "would_link_existing_contact",
  result: LeadApplyBackfillResult,
  client: DbLike
): Promise<void> {
  const linked = await client.$transaction(async (tx) => {
    const update = await tx.communication.updateMany({
      where: {
        id: row.id,
        OR: [{ contactId: null }, { contactId }],
      },
      data: {
        contactId,
        metadata: mergeLeadApplyMetadata(row.metadata, {
          runId: result.runId,
          appliedAt: new Date().toISOString(),
          strategy: "historical-platform-lead-apply",
          platform: extracted.platform,
          source: metadataString(row.metadata, "source"),
          extractedKind: extracted.kind,
          inquirerEmail: extracted.inquirer.email,
          previousContactId: row.contactId,
          newContactId: contactId,
          outcome: "linked_existing_contact",
          dryRun: false,
        }),
      },
    })
    if (update.count !== 1) {
      record(result, row, "skipped_race_lost", {
        platform: extracted.platform,
        extracted,
        contactId,
      })
      return false
    }
    result.communicationLinked += 1
    record(result, row, "linked_existing_contact", {
      platform: extracted.platform,
      extracted,
      contactId,
    })
    return true
  })

  // When an existing Contact gets linked to a Crexi/LoopNet/Buildout lead
  // communication, the same propertyKey-driven Deal upsert should fire so the
  // Communication.dealId is populated and the Contact's role lifecycle reflects
  // active listing involvement.
  if (linked && (extracted.propertyKey || extracted.propertyAddress)) {
    await upsertDealForLead({
      contactId,
      communicationId: row.id,
      propertyKey: extracted.propertyKey ?? null,
      propertyAddress: extracted.propertyAddress ?? null,
      propertySource: extracted.platform,
    })
  }
}

async function linkExistingSenderContact(
  row: CommunicationRow,
  candidate: SenderCandidate,
  contactId: string,
  result: LeadApplyBackfillResult,
  client: DbLike
): Promise<void> {
  await client.$transaction(async (tx) => {
    const update = await tx.communication.updateMany({
      where: {
        id: row.id,
        OR: [{ contactId: null }, { contactId }],
      },
      data: {
        contactId,
        metadata: mergeLeadApplyMetadata(row.metadata, {
          runId: result.runId,
          appliedAt: new Date().toISOString(),
          strategy: "historical-email-sender-backfill",
          source: metadataString(row.metadata, "source"),
          extractedKind: candidate.sourceKind ?? "email-sender",
          inquirerEmail: candidate.email,
          previousContactId: row.contactId,
          newContactId: contactId,
          outcome: "linked_existing_contact",
          dryRun: false,
        }),
      },
    })
    if (update.count !== 1) {
      record(result, row, "skipped_race_lost", {
        inquirerEmail: candidate.email,
        extractedKind: candidate.sourceKind ?? "email-sender",
        contactId,
      })
      return
    }
    result.communicationLinked += 1
    record(result, row, "linked_existing_contact", {
      inquirerEmail: candidate.email,
      extractedKind: candidate.sourceKind ?? "email-sender",
      contactId,
    })
  })
}

async function upsertContactPromotionCandidate(
  tx: Prisma.TransactionClient,
  row: CommunicationRow,
  extracted: ExtractedLead,
  runId: string
): Promise<{ created: boolean }> {
  const dedupeKey = [
    "platform-lead",
    extracted.platform,
    extracted.inquirer.email.trim().toLowerCase(),
  ].join(":")
  const existing = await tx.contactPromotionCandidate.findUnique({
    where: { dedupeKey },
    select: { id: true, metadata: true, status: true },
  })
  const existingMetadata = jsonObject(existing?.metadata)
  const communicationIds = new Set([
    ...metadataStringArray(existingMetadata, "communicationIds"),
    ...[
      metadataString(existingMetadata, "firstCommunicationId"),
      metadataString(existingMetadata, "lastCommunicationId"),
    ].filter((id): id is string => !!id),
  ])
  const alreadyCounted = communicationIds.has(row.id)
  communicationIds.add(row.id)
  const shouldReopenSuppressed =
    !alreadyCounted &&
    (existing?.status === "rejected" || existing?.status === "not_a_contact")
  const reopenedAt = shouldReopenSuppressed ? new Date().toISOString() : null
  const reopenDecision =
    shouldReopenSuppressed && existing
      ? {
          reopenedFromStatus: existing.status,
          reopenedAt,
          reopenReason: "new-material-communication-evidence",
          reopenEvidenceIds: [row.id],
          priorTerminalDecision: terminalDecisionSnapshot(
            existing.status,
            existingMetadata
          ),
        }
      : null

  if (!existing) {
    await tx.contactPromotionCandidate.create({
      data: {
        dedupeKey,
        normalizedEmail: extracted.inquirer.email.trim().toLowerCase(),
        displayName: extracted.inquirer.name ?? null,
        company: extracted.inquirer.company ?? null,
        phone: extracted.inquirer.phone ?? null,
        message: extracted.inquirer.message ?? null,
        source: "historical-platform-lead-apply",
        sourcePlatform: extracted.platform,
        sourceKind: extracted.kind,
        status: "pending",
        communicationId: row.id,
        metadata: {
          runId,
          firstCommunicationId: row.id,
          lastCommunicationId: row.id,
          communicationIds: [...communicationIds],
          leadSource: extracted.leadSource,
        } as Prisma.InputJsonValue,
      },
    })
    return { created: true }
  }

  await tx.contactPromotionCandidate.update({
    where: { id: existing.id },
    data: {
      displayName: extracted.inquirer.name ?? undefined,
      company: extracted.inquirer.company ?? undefined,
      phone: extracted.inquirer.phone ?? undefined,
      message: extracted.inquirer.message ?? undefined,
      sourceKind: extracted.kind,
      ...(alreadyCounted ? {} : { communicationId: row.id }),
      lastSeenAt: new Date(),
      ...(shouldReopenSuppressed
        ? { status: "needs_more_evidence" as const, snoozedUntil: null }
        : {}),
      ...(alreadyCounted ? {} : { evidenceCount: { increment: 1 } }),
      metadata: {
        ...existingMetadata,
        runId,
        lastCommunicationId: row.id,
        communicationIds: [...communicationIds],
        leadSource: extracted.leadSource,
        ...(reopenDecision
          ? {
              ...reopenDecision,
              reopenHistory: [
                ...metadataObjectArray(existingMetadata, "reopenHistory"),
                reopenDecision,
              ],
            }
          : {}),
      } as Prisma.InputJsonValue,
    },
  })
  return { created: false }
}

async function upsertSenderContactPromotionCandidate(
  tx: Prisma.TransactionClient,
  row: CommunicationRow,
  candidate: SenderCandidate,
  runId: string
): Promise<{ created: boolean }> {
  const dedupeKey = `email-sender:${candidate.email}`
  const existing = await tx.contactPromotionCandidate.findUnique({
    where: { dedupeKey },
    select: { id: true, metadata: true, status: true },
  })
  const existingMetadata = jsonObject(existing?.metadata)
  const communicationIds = new Set([
    ...metadataStringArray(existingMetadata, "communicationIds"),
    ...[
      metadataString(existingMetadata, "firstCommunicationId"),
      metadataString(existingMetadata, "lastCommunicationId"),
    ].filter((id): id is string => !!id),
  ])
  const alreadyCounted = communicationIds.has(row.id)
  communicationIds.add(row.id)
  const shouldReopenSuppressed =
    !alreadyCounted &&
    (existing?.status === "rejected" || existing?.status === "not_a_contact")
  const reopenedAt = shouldReopenSuppressed ? new Date().toISOString() : null

  if (!existing) {
    await tx.contactPromotionCandidate.create({
      data: {
        dedupeKey,
        normalizedEmail: candidate.email,
        displayName: candidate.displayName,
        message: row.subject,
        source: "historical-email-sender-backfill",
        sourceKind: candidate.sourceKind ?? "email-sender",
        status: "pending",
        communicationId: row.id,
        metadata: {
          runId,
          firstCommunicationId: row.id,
          lastCommunicationId: row.id,
          communicationIds: [...communicationIds],
          classification: metadataString(row.metadata, "classification"),
          classificationSource: metadataString(row.metadata, "source"),
        } as Prisma.InputJsonValue,
      },
    })
    return { created: true }
  }

  await tx.contactPromotionCandidate.update({
    where: { id: existing.id },
    data: {
      displayName: candidate.displayName ?? undefined,
      message: row.subject ?? undefined,
      sourceKind: candidate.sourceKind ?? undefined,
      ...(alreadyCounted ? {} : { communicationId: row.id }),
      lastSeenAt: new Date(),
      ...(shouldReopenSuppressed
        ? { status: "needs_more_evidence" as const, snoozedUntil: null }
        : {}),
      ...(alreadyCounted ? {} : { evidenceCount: { increment: 1 } }),
      metadata: {
        ...existingMetadata,
        runId,
        lastCommunicationId: row.id,
        communicationIds: [...communicationIds],
        classification: metadataString(row.metadata, "classification"),
        classificationSource: metadataString(row.metadata, "source"),
        ...(shouldReopenSuppressed
          ? {
              reopenedFromStatus: existing.status,
              reopenedAt,
              reopenReason: "new-material-communication-evidence",
              reopenEvidenceIds: [row.id],
            }
          : {}),
      } as Prisma.InputJsonValue,
    },
  })
  return { created: false }
}

function extractLead(row: CommunicationRow): ExtractedLead | null {
  const platform = detectLeadPlatform(row)
  if (!platform) return null
  const extracted = extractPlatform(row, platform)
  if (!extracted || !("inquirer" in extracted) || !extracted.inquirer?.email) {
    return null
  }
  return {
    platform,
    leadSource: platformToLeadSource(platform),
    kind: String(extracted.kind),
    inquirer: {
      ...extracted.inquirer,
      email: extracted.inquirer.email.trim().toLowerCase(),
    },
    propertyKey: extracted.propertyKey,
    propertyAddress: extracted.propertyAddress,
    propertyAliases: extracted.propertyAliases,
    propertyAddressMissing: extracted.propertyAddressMissing,
  }
}

function extractSenderCandidate(row: CommunicationRow): SenderCandidate | null {
  if (row.contactId) return null
  if (detectLeadPlatform(row)) return null
  const classification = metadataString(row.metadata, "classification")
  if (classification !== "signal") return null
  const from = metadataObject(row.metadata, "from")
  const email = metadataString(from, "address")?.trim().toLowerCase()
  if (!email || !email.includes("@")) return null
  if (metadataBoolean(from, "isInternal")) return null
  const sourceKind = metadataString(row.metadata, "source")
  return {
    email,
    displayName: metadataString(from, "displayName"),
    sourceKind,
  }
}

function extractPlatform(
  row: CommunicationRow,
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

function platformToLeadSource(platform: LeadDiagnosticPlatform): LeadSource {
  return platform as LeadSource
}

function shouldAutoCreateLeadContact(extracted: ExtractedLead): boolean {
  return (
    extracted.platform === "buildout" &&
    (extracted.kind === "new-lead" ||
      extracted.kind === "information-requested")
  )
}

function buildAutoLeadNotes(
  row: CommunicationRow,
  extracted: ExtractedLead
): string {
  return [
    "Created automatically from a reviewed platform lead email.",
    `Communication ID: ${row.id}`,
    `Source: ${extracted.platform} / ${extracted.kind}`,
    `First seen: ${row.date.toISOString()}`,
    extracted.inquirer.message ? `Message: ${extracted.inquirer.message}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

async function loadContactsByEmail(
  client: DbLike,
  emails: string[]
): Promise<Map<string, ContactLookup[]>> {
  const uniqueEmails = [...new Set(emails.map((email) => email.toLowerCase()))]
  if (uniqueEmails.length === 0) return new Map()
  const contacts = await client.contact.findMany({
    where: {
      archivedAt: null,
      OR: uniqueEmails.map((email) => ({
        email: { equals: email, mode: "insensitive" as const },
      })),
    },
    select: {
      id: true,
      email: true,
      archivedAt: true,
      leadSource: true,
      leadStatus: true,
      _count: { select: { deals: true } },
    },
  })
  const map = new Map<string, ContactLookup[]>()
  for (const contact of contacts) {
    if (!contact.email) continue
    const key = contact.email.trim().toLowerCase()
    const matches = map.get(key) ?? []
    matches.push(contact)
    map.set(key, matches)
  }
  return map
}

function record(
  result: LeadApplyBackfillResult,
  row: CommunicationRow,
  outcome: LeadApplyOutcome,
  options: {
    platform?: LeadDiagnosticPlatform
    extracted?: ExtractedLead
    extractedKind?: string
    inquirerEmail?: string
    contactId?: string | null
  } = {}
): LeadApplyOutcome {
  result.byOutcome[outcome] = (result.byOutcome[outcome] ?? 0) + 1
  if (result.samples.length < 20) {
    result.samples.push({
      communicationId: row.id,
      outcome,
      platform: options.platform,
      extractedKind: options.extracted?.kind ?? options.extractedKind,
      inquirerEmail: options.extracted?.inquirer.email ?? options.inquirerEmail,
      previousContactId: row.contactId,
      contactId: options.contactId,
    })
  }
  return outcome
}

function metadataString(metadata: unknown, key: string): string | null {
  const record =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}
  const value = record[key]
  return typeof value === "string" ? value : null
}

function metadataBoolean(metadata: unknown, key: string): boolean {
  return jsonObject(metadata)[key] === true
}

function metadataNumber(metadata: unknown, key: string): number | null {
  const value = jsonObject(metadata)[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function metadataObject(
  metadata: unknown,
  key: string
): Record<string, unknown> {
  return jsonObject(jsonObject(metadata)[key])
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
): Array<Record<string, unknown>> {
  const value = jsonObject(metadata)[key]
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object" && !Array.isArray(item)
      )
    : []
}

function jsonObject(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

function terminalDecisionSnapshot(
  status: string,
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const promotionReview = jsonObject(metadata.promotionReview)
  return Object.keys(promotionReview).length > 0 ? promotionReview : { status }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function mergeLeadApplyMetadata(
  metadata: Prisma.JsonValue | null,
  leadApply: Record<string, unknown>
): Prisma.InputJsonValue {
  const existing = asRecord(metadata)
  const backfill = asRecord(existing.backfill)
  return {
    ...existing,
    backfill: {
      ...backfill,
      leadApply,
    },
  } as Prisma.InputJsonValue
}

async function tryAdvisoryLock(client: DbLike): Promise<boolean> {
  const rows = await client.$queryRaw<Array<{ got: boolean }>>`
    SELECT pg_try_advisory_lock(hashtext(${ADVISORY_LOCK_KEY})) AS got
  `
  return !!rows[0]?.got
}

async function releaseAdvisoryLock(client: DbLike): Promise<void> {
  await client.$queryRaw`
    SELECT pg_advisory_unlock(hashtext(${ADVISORY_LOCK_KEY}))
  `
}
