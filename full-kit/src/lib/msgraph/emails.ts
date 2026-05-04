import type {
  AttachmentFetchMeta,
  AttachmentMeta,
} from "@/lib/communications/attachment-types"
import type { Prisma } from "@prisma/client"
import type {
  BuildoutEventExtract,
  CrexiLeadExtract,
  LoopNetLeadExtract,
} from "./email-extractors"
import type {
  BehavioralHints,
  ClassificationResult,
  EmailAcquisitionDecision,
  EmailClassification,
  EmailFilterRunMode,
  EmailFolder,
  GraphEmailMessage,
} from "./email-types"
import type { NormalizedSender } from "./sender-normalize"

import { enqueueScrubForCommunication } from "@/lib/ai/scrub-queue"
import { processBuildoutStageUpdate } from "@/lib/deals/buildout-stage-action"
import { proposeBuyerRepDeal } from "@/lib/deals/buyer-rep-action"
import { classifyBuyerRepSignal } from "@/lib/deals/buyer-rep-detector"
import {
  CONTACT_AUTO_PROMOTION_POLICY_VERSION,
  evaluateContactAutoPromotion,
  hasRealAttachmentEvidence,
  hasRealAttachmentEvidenceFromMetadata,
  readContactAutoPromotionMode,
} from "@/lib/contact-auto-promotion-policy"
import { db } from "@/lib/prisma"

import { graphFetch } from "./client"
import { loadMsgraphConfig } from "./config"
import {
  extractBuildoutEvent,
  extractCrexiLead,
  extractLoopNetLead,
} from "./email-extractors"
import { classifyEmail, domainIsLargeCreBroker } from "./email-filter"
import {
  evaluateBodyFetchFailure,
  evaluateEmailAcquisition,
} from "./email-filter-evaluator"
import { pruneGraphSnapshot } from "./email-filter-redaction"
import { GraphError } from "./errors"
import { normalizeSenderAddress } from "./sender-normalize"

const CURSOR_EXTERNAL_ID = "__cursor__"

function cursorSourceFor(folder: EmailFolder): string {
  return folder === "inbox" ? "msgraph-email-inbox" : "msgraph-email-sentitems"
}

export async function loadEmailCursor(
  folder: EmailFolder
): Promise<{ deltaLink: string } | null> {
  const row = await db.externalSync.findUnique({
    where: {
      source_externalId: {
        source: cursorSourceFor(folder),
        externalId: CURSOR_EXTERNAL_ID,
      },
    },
  })
  if (!row) return null
  const data = row.rawData as { deltaLink?: string } | null
  if (!data?.deltaLink || typeof data.deltaLink !== "string") return null
  return { deltaLink: data.deltaLink }
}

export async function saveEmailCursor(
  folder: EmailFolder,
  deltaLink: string
): Promise<void> {
  await db.externalSync.upsert({
    where: {
      source_externalId: {
        source: cursorSourceFor(folder),
        externalId: CURSOR_EXTERNAL_ID,
      },
    },
    create: {
      source: cursorSourceFor(folder),
      externalId: CURSOR_EXTERNAL_ID,
      entityType: "cursor",
      status: "synced",
      rawData: { deltaLink },
    },
    update: {
      rawData: { deltaLink },
      status: "synced",
      syncedAt: new Date(),
    },
  })
}

export async function deleteEmailCursor(folder: EmailFolder): Promise<void> {
  await db.externalSync.deleteMany({
    where: {
      source: cursorSourceFor(folder),
      externalId: CURSOR_EXTERNAL_ID,
    },
  })
}

// ---------------------------------------------------------------------------
// Delta fetcher
// ---------------------------------------------------------------------------

interface GraphDeltaPage {
  value: Array<GraphEmailMessage & { "@removed"?: { reason: string } }>
  "@odata.nextLink"?: string
  "@odata.deltaLink"?: string
}

const EMAIL_SELECT_FIELDS = [
  "id",
  "internetMessageId",
  "conversationId",
  "parentFolderId",
  "subject",
  "from",
  "sender",
  "toRecipients",
  "ccRecipients",
  "bccRecipients",
  "receivedDateTime",
  "sentDateTime",
  "hasAttachments",
  "isRead",
  "importance",
  "bodyPreview",
  "internetMessageHeaders",
].join(",")

const PAGE_SIZE = 100

const METADATA_PREFER_HEADER = {
  Prefer: `IdType="ImmutableId", odata.maxpagesize=${PAGE_SIZE}`,
}

const BODY_FETCH_PREFER_HEADER = {
  Prefer: `IdType="ImmutableId", outlook.body-content-type="text"`,
}

/**
 * Async generator that yields Graph email pages for a single folder.
 *
 * Starts from the stored cursor if one exists, or from the folder root
 * filtered by receivedDateTime >= sinceIso otherwise. Yields each page plus
 * the final deltaLink when the sync completes.
 */
export async function* fetchEmailDelta(
  folder: EmailFolder,
  sinceIso: string
): AsyncGenerator<{ page: GraphDeltaPage; isFinal: boolean }, void, void> {
  const cfg = loadMsgraphConfig()
  const cursor = await loadEmailCursor(folder)

  const initialUrl =
    cursor?.deltaLink ??
    `/users/${encodeURIComponent(cfg.targetUpn)}/mailFolders/${folder}/messages/delta` +
      `?$filter=${encodeURIComponent(`receivedDateTime ge ${sinceIso}`)}` +
      `&$select=${encodeURIComponent(EMAIL_SELECT_FIELDS)}`

  let url: string | undefined = initialUrl
  while (url) {
    const res: GraphDeltaPage = await graphFetch<GraphDeltaPage>(url, {
      headers: METADATA_PREFER_HEADER,
    })
    const isFinal = !res["@odata.nextLink"] && !!res["@odata.deltaLink"]
    yield { page: res, isFinal }
    url = res["@odata.nextLink"]
  }
}

/** Exported for test re-export and type-only consumers. */
export type { GraphDeltaPage }

export const EMAIL_METADATA_SELECT_FIELDS = EMAIL_SELECT_FIELDS

export async function fetchEmailBodyById(
  targetUpn: string,
  messageId: string
): Promise<
  Pick<GraphEmailMessage, "id" | "body" | "bodyPreview" | "internetMessageId">
> {
  const path =
    `/users/${encodeURIComponent(targetUpn)}/messages/${encodeURIComponent(messageId)}` +
    `?$select=${encodeURIComponent("id,body,bodyPreview,internetMessageId,changeKey")}`
  return graphFetch<
    Pick<GraphEmailMessage, "id" | "body" | "bodyPreview" | "internetMessageId">
  >(path, { headers: BODY_FETCH_PREFER_HEADER })
}

export async function* fetchEmailMetadataDelta(
  folder: EmailFolder,
  sinceIso: string
): AsyncGenerator<{ page: GraphDeltaPage; isFinal: boolean }, void, void> {
  yield* fetchEmailDelta(folder, sinceIso)
}

/**
 * Compute behavioral hints for the filter context. These influence Layer A's
 * known-counterparty rule and are stored on uncertain rows as hints for the
 * future classifier spec.
 *
 * All queries are scoped to the single sender + conversation under test, so
 * they are cheap per-message.
 */
export async function computeBehavioralHints(
  senderAddress: string,
  conversationId: string | undefined
): Promise<BehavioralHints> {
  const senderDomain = senderAddress.includes("@")
    ? senderAddress.split("@")[1]
    : undefined

  const [contactRow, directOutboundCount, threadOutboundCount, threadSize] =
    await Promise.all([
      senderAddress
        ? db.contact.findFirst({
            where: { email: { equals: senderAddress, mode: "insensitive" } },
            select: { id: true },
          })
        : Promise.resolve(null),
      senderAddress
        ? db.communication.count({
            where: {
              direction: "outbound",
              metadata: {
                path: ["toRecipients"],
                array_contains: [{ emailAddress: { address: senderAddress } }],
              },
            },
          })
        : Promise.resolve(0),
      conversationId
        ? db.communication.count({
            where: {
              direction: "outbound",
              OR: [
                { conversationId },
                {
                  metadata: {
                    path: ["conversationId"],
                    equals: conversationId,
                  },
                },
              ],
            },
          })
        : Promise.resolve(0),
      conversationId
        ? db.communication.count({
            where: {
              OR: [
                { conversationId },
                {
                  metadata: {
                    path: ["conversationId"],
                    equals: conversationId,
                  },
                },
              ],
            },
          })
        : Promise.resolve(0),
    ])

  return {
    senderInContacts: !!contactRow,
    mattRepliedBefore: directOutboundCount > 0 || threadOutboundCount > 0,
    directOutboundCount,
    threadOutboundCount,
    threadSize: threadSize + 1,
    domainIsLargeCreBroker: domainIsLargeCreBroker(senderDomain),
  }
}

// ---------------------------------------------------------------------------
// Attachment metadata
// ---------------------------------------------------------------------------

type GraphAttachment = AttachmentMeta & {
  "@odata.type"?: string
}

export interface AttachmentFetchResult {
  attachments: AttachmentMeta[]
  fetch: AttachmentFetchMeta
}

function attachmentTypeFromOdata(
  value: unknown
): AttachmentMeta["attachmentType"] {
  if (value === "#microsoft.graph.fileAttachment") return "file"
  if (value === "#microsoft.graph.itemAttachment") return "item"
  if (value === "#microsoft.graph.referenceAttachment") return "reference"
  return "unknown"
}

/** Fetches attachment metadata (not binary) for a single message. */
export async function fetchAttachmentMeta(
  targetUpn: string,
  messageId: string
): Promise<AttachmentFetchResult> {
  const attemptedAt = new Date().toISOString()
  const path =
    `/users/${encodeURIComponent(targetUpn)}/messages/${encodeURIComponent(messageId)}/attachments` +
    `?$select=id,name,size,contentType,isInline`
  try {
    const res = await graphFetch<{ value: GraphAttachment[] }>(path)
    const rawAttachments = res.value ?? []
    const attachments = rawAttachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      contentType: attachment.contentType,
      isInline: attachment.isInline,
      attachmentType: attachmentTypeFromOdata(attachment["@odata.type"]),
    }))
    const inlineCount = attachments.filter(
      (attachment) => attachment.isInline
    ).length
    return {
      attachments,
      fetch: {
        status: "success",
        attemptedAt,
        totalCount: attachments.length,
        inlineCount,
        nonInlineCount: attachments.length - inlineCount,
      },
    }
  } catch (err) {
    if (err instanceof GraphError) {
      return {
        attachments: [],
        fetch: {
          status: "failed",
          attemptedAt,
          errorCode: err.code ?? String(err.status),
        },
      }
    }
    throw err
  }
}

export type ExtractedData =
  | ({ platform: "crexi" } & CrexiLeadExtract)
  | ({ platform: "loopnet" } & LoopNetLeadExtract)
  | ({ platform: "buildout" } & BuildoutEventExtract)

/** Route a signal message to the right extractor (if any) based on its source. */
export function runExtractor(
  result: ClassificationResult,
  message: GraphEmailMessage
): ExtractedData | null {
  const input = {
    subject: message.subject ?? null,
    bodyText: message.body?.content ?? "",
  }
  switch (result.source) {
    case "crexi-lead": {
      const r = extractCrexiLead(input)
      return r ? { platform: "crexi", ...r } : null
    }
    case "loopnet-lead": {
      const r = extractLoopNetLead(input)
      return r ? { platform: "loopnet", ...r } : null
    }
    case "buildout-event": {
      const r = extractBuildoutEvent(input)
      return r ? { platform: "buildout", ...r } : null
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Communication writer
// ---------------------------------------------------------------------------

export interface ProcessedMessage {
  message: GraphEmailMessage
  folder: EmailFolder
  normalizedSender: NormalizedSender
  classification: ClassificationResult
  acquisition: EmailAcquisitionDecision
  hints: BehavioralHints
  extracted: ExtractedData | null
  attachments: AttachmentMeta[] | undefined
  attachmentFetch?: AttachmentFetchMeta
  contactId: string | null
  leadContactId: string | null
  leadCreated: boolean
  /**
   * Optional dealId to set on the Communication at insert time. Used by the
   * mailbox backfill flow to attribute historical messages to a deal that the
   * caller resolved from temporal window membership. Live ingest leaves this
   * undefined (→ null) and dealId is assigned later via downstream pipelines.
   * Only consulted on the initial Communication insert, never on dedupe-update.
   */
  dealIdOverride?: string | null
}

/** Persist one processed message as a Communication + ExternalSync pair, in a txn. */
export async function persistMessage(p: ProcessedMessage): Promise<{
  inserted: boolean
  contactCreated: boolean
  leadContactId: string | null
  leadCreated: boolean
  communicationId: string | null
  contactId: string | null
}> {
  const direction = p.folder === "inbox" ? "inbound" : "outbound"
  const storeBody = p.acquisition.bodyDecision === "fetch_body"
  const dateIso =
    p.folder === "sentitems"
      ? (p.message.sentDateTime ?? p.message.receivedDateTime)
      : p.message.receivedDateTime
  if (!dateIso) {
    throw new Error(`message ${p.message.id} missing date`)
  }

  // Existence check first — idempotency without relying on unique constraint race.
  const existing = await db.externalSync.findUnique({
    where: {
      source_externalId: { source: "msgraph-email", externalId: p.message.id },
    },
    select: { id: true },
  })
  if (existing) {
    return {
      inserted: false,
      contactCreated: false,
      leadContactId: p.leadContactId,
      leadCreated: false,
      communicationId: null,
      contactId: p.contactId,
    }
  }

  const metadata: Record<string, unknown> = {
    classification: p.classification.classification,
    source: p.classification.source,
    tier1Rule: p.classification.tier1Rule,
    acquisition: {
      bodyDecision: p.acquisition.bodyDecision,
      disposition: p.acquisition.disposition,
      ruleId: p.acquisition.ruleId,
      ruleVersion: p.acquisition.ruleVersion,
      riskFlags: p.acquisition.riskFlags,
      rescueFlags: p.acquisition.rescueFlags,
      rationale: p.acquisition.rationale,
    },
    behavioralHints: p.hints,
    conversationId: p.message.conversationId,
    internetMessageId: p.message.internetMessageId,
    parentFolderId: p.message.parentFolderId,
    from: {
      address: p.normalizedSender.address,
      displayName: p.normalizedSender.displayName,
      isInternal: p.normalizedSender.isInternal,
    },
    toRecipients: p.message.toRecipients ?? [],
    ccRecipients: p.message.ccRecipients ?? [],
    hasAttachments: !!p.message.hasAttachments,
    attachments: p.attachments,
    attachmentFetch: p.attachmentFetch,
    importance: p.message.importance ?? "normal",
    isRead: !!p.message.isRead,
    senderNormalizationFailed:
      p.normalizedSender.normalizationFailed || undefined,
    extracted: p.extracted ?? undefined,
    leadContactId: p.leadContactId ?? undefined,
    leadCreated: p.leadCreated || undefined,
  }
  if (
    p.contactId &&
    !p.leadContactId &&
    p.classification.classification === "signal"
  ) {
    metadata.contactAutoPromotion = {
      decision: "auto_link_existing",
      policyVersion: CONTACT_AUTO_PROMOTION_POLICY_VERSION,
      score: 100,
      reasonCodes: ["single_existing_contact_email_match"],
      blockedReasons: [],
      evidenceCommunicationIds: [],
      matchedContactId: p.contactId,
      appliedAt: new Date(dateIso).toISOString(),
      mode: "pre_insert_exact_match",
    }
  }
  let resolvedContactId = p.contactId
  let resolvedLeadContactId = p.leadContactId
  let resolvedLeadCreated = p.leadCreated
  let resolvedContactCreated = false
  let resolvedCommunicationId: string | null = null

  await db.$transaction(async (tx) => {
    const sync = await tx.externalSync.create({
      data: {
        source: "msgraph-email",
        externalId: p.message.id,
        entityType: "communication",
        status: "synced",
        rawData: {
          folder: p.folder,
          graphSnapshot: pruneGraphSnapshot(
            p.message
          ) as unknown as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      },
    })
    const autoLead = await resolveAutoPlatformLeadContact(
      tx,
      p.extracted,
      p.message,
      dateIso
    )
    if (autoLead) {
      resolvedContactId = autoLead.contactId
      resolvedLeadContactId = autoLead.contactId
      resolvedLeadCreated = autoLead.created
      resolvedContactCreated = autoLead.created
      metadata.leadContactId = autoLead.contactId
      metadata.leadCreated = autoLead.created || undefined
    }
    const comm = await tx.communication.create({
      data: {
        channel: "email",
        subject: p.message.subject ?? null,
        body: storeBody ? (p.message.body?.content ?? null) : null,
        date: new Date(dateIso),
        direction,
        category: "business",
        externalMessageId: p.message.id,
        conversationId: p.message.conversationId ?? null,
        externalSyncId: sync.id,
        contactId: resolvedContactId,
        dealId: p.dealIdOverride ?? null,
        createdBy: "msgraph-email",
        tags: [],
        metadata: metadata as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    resolvedCommunicationId = comm.id
    await tx.externalSync.update({
      where: { id: sync.id },
      data: { entityId: comm.id },
    })
    resolvedContactCreated =
      (await autoPromoteOrUpsertEmailSenderContact(tx, p, comm.id, dateIso)) ||
      resolvedContactCreated
    resolvedContactCreated =
      (await autoPromoteOutboundSingleRecipient(tx, p, comm.id, dateIso)) ||
      resolvedContactCreated
    const auditTx = tx as Prisma.TransactionClient & {
      emailFilterAudit?: Pick<
        Prisma.TransactionClient["emailFilterAudit"],
        "create"
      >
    }
    if (auditTx.emailFilterAudit?.create) {
      await auditTx.emailFilterAudit.create({
        data: {
          runId: "inline-msgraph-sync",
          chunkId: `${p.folder}-inline`,
          externalMessageId: p.message.id,
          internetMessageId: p.message.internetMessageId ?? null,
          communicationId: comm.id,
          externalSyncId: sync.id,
          ruleId: p.acquisition.ruleId,
          ruleVersion: p.acquisition.ruleVersion,
          classification: p.classification.classification,
          bodyDecision: p.acquisition.bodyDecision,
          disposition: p.acquisition.disposition,
          riskFlags: p.acquisition.riskFlags as Prisma.InputJsonValue,
          rescueFlags: p.acquisition.rescueFlags as Prisma.InputJsonValue,
          evidenceSnapshot: p.acquisition
            .evidenceSnapshot as Prisma.InputJsonValue,
          sampled: false,
          reviewOutcome: "not_reviewed",
          bodyAvailable: !!p.message.body?.content,
          bodyLength: p.message.body?.content?.length ?? 0,
          bodyContentType: p.message.body?.contentType ?? null,
          redactionStatus: "not_required",
        },
      })
    }
    // Enqueue for AI scrub — same transaction as the Communication
    // insert so either both land or neither does. enqueueScrubForCommunication
    // is a no-op for "noise" classification.
    await enqueueScrubForCommunication(
      tx,
      comm.id,
      p.classification.classification
    )
  })

  return {
    inserted: true,
    contactCreated: resolvedContactCreated,
    leadContactId: resolvedLeadContactId,
    leadCreated: resolvedLeadCreated,
    communicationId: resolvedCommunicationId,
    contactId: resolvedContactId,
  }
}

async function autoPromoteOutboundSingleRecipient(
  tx: Prisma.TransactionClient,
  p: ProcessedMessage,
  communicationId: string,
  dateIso: string
): Promise<boolean> {
  const mode = readContactAutoPromotionMode()
  if (
    mode !== "write" ||
    p.folder !== "sentitems" ||
    p.classification.classification !== "signal" ||
    !hasRealAttachmentEvidence({
      attachments: p.attachments ?? null,
      attachmentFetch: p.attachmentFetch ?? null,
    })
  ) {
    return false
  }
  if (
    recipientCount(p.message.toRecipients) !== 1 ||
    recipientCount(p.message.ccRecipients) > 0 ||
    recipientCount(p.message.bccRecipients) > 0
  ) {
    return false
  }

  const email = singleRecipientEmail(p.message.toRecipients)
  if (!email) return false
  if (isInternalEmail(email, p.normalizedSender.address)) return false

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${"contact-promotion-email:" + email}))
  `
  const contactMatches = await tx.contact.findMany({
    where: {
      email: { equals: email, mode: "insensitive" },
      archivedAt: null,
    },
    select: { id: true, archivedAt: true },
    take: 2,
  })
  const promotion = evaluateContactAutoPromotion({
    classification: p.classification.classification,
    source: p.classification.source,
    direction: "outbound",
    normalizedEmail: email,
    displayName: singleRecipientDisplayName(p.message.toRecipients),
    contactMatches,
    currentCommunicationId: communicationId,
    currentHasRealAttachment: true,
    mattRepliedBefore: true,
    materialCommunicationCount: p.hints.threadSize,
    outboundAttachmentEvidenceIds: [communicationId],
  })
  if (
    promotion.decision === "auto_link_existing" &&
    promotion.matchedContactId
  ) {
    await tx.communication.update({
      where: { id: communicationId },
      data: {
        contactId: promotion.matchedContactId,
        metadata: mergeCommunicationMetadataForAutoPromotion(
          p,
          promotion,
          dateIso
        ),
      },
    })
    return false
  }
  if (promotion.decision !== "auto_create_contact") return false

  const contact = await tx.contact.create({
    data: {
      name: singleRecipientDisplayName(p.message.toRecipients) || email,
      email,
      category: "business",
      tags: ["auto-promoted-contact", "outbound-file-recipient"],
      createdBy: "msgraph-email-auto-promotion",
      notes: buildAutoPromotedContactNotes(p, promotion.reasonCodes),
    },
    select: { id: true },
  })
  await tx.communication.update({
    where: { id: communicationId },
    data: {
      contactId: contact.id,
      metadata: mergeCommunicationMetadataForAutoPromotion(
        p,
        { ...promotion, matchedContactId: contact.id },
        dateIso
      ),
    },
  })
  return true
}

async function autoPromoteOrUpsertEmailSenderContact(
  tx: Prisma.TransactionClient,
  p: ProcessedMessage,
  communicationId: string,
  dateIso: string
): Promise<boolean> {
  const email = p.normalizedSender.address.trim().toLowerCase()
  if (
    p.folder !== "inbox" ||
    p.classification.classification !== "signal" ||
    p.contactId ||
    p.leadContactId ||
    p.normalizedSender.isInternal ||
    p.normalizedSender.normalizationFailed ||
    !email.includes("@") ||
    isPlatformLeadSource(p.classification.source)
  ) {
    return false
  }

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${"contact-promotion-email:" + email}))
  `
  const contactMatches = await tx.contact.findMany({
    where: {
      email: { equals: email, mode: "insensitive" },
      archivedAt: null,
    },
    select: { id: true, archivedAt: true },
    take: 2,
  })
  const directOutboundEvidence = await loadDirectOutboundEvidence(tx, email)
  const currentHasRealAttachment = hasRealAttachmentEvidence({
    attachments: p.attachments ?? null,
    attachmentFetch: p.attachmentFetch ?? null,
  })
  const promotion = evaluateContactAutoPromotion({
    classification: p.classification.classification,
    source: p.classification.source,
    direction: p.folder === "inbox" ? "inbound" : "outbound",
    normalizedEmail: email,
    displayName: p.normalizedSender.displayName,
    isInternal: p.normalizedSender.isInternal,
    normalizationFailed: p.normalizedSender.normalizationFailed,
    existingContactId: p.contactId,
    existingLeadContactId: p.leadContactId,
    contactMatches,
    currentCommunicationId: communicationId,
    currentHasRealAttachment,
    mattRepliedBefore: directOutboundEvidence.count > 0,
    materialCommunicationCount: p.hints.threadSize,
    outboundAttachmentEvidenceIds: directOutboundEvidence.attachmentIds,
  })
  const autoPromotionMode = readContactAutoPromotionMode()

  if (
    autoPromotionMode === "write" &&
    promotion.decision === "auto_link_existing" &&
    promotion.matchedContactId
  ) {
    await tx.communication.update({
      where: { id: communicationId },
      data: {
        contactId: promotion.matchedContactId,
        metadata: mergeCommunicationMetadataForAutoPromotion(
          p,
          promotion,
          dateIso
        ),
      },
    })
    return false
  }

  if (
    autoPromotionMode === "write" &&
    promotion.decision === "auto_create_contact"
  ) {
    const contact = await tx.contact.create({
      data: {
        name:
          p.normalizedSender.displayName?.trim() ||
          p.normalizedSender.address ||
          "Unknown contact",
        email,
        category: "business",
        tags: ["auto-promoted-contact", "email-sender"],
        createdBy: "msgraph-email-auto-promotion",
        notes: buildAutoPromotedContactNotes(p, promotion.reasonCodes),
      },
      select: { id: true },
    })
    await tx.communication.update({
      where: { id: communicationId },
      data: {
        contactId: contact.id,
        metadata: mergeCommunicationMetadataForAutoPromotion(
          p,
          { ...promotion, matchedContactId: contact.id },
          dateIso
        ),
      },
    })
    return true
  }

  const dedupeKey = `email-sender:${email}`
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
  const alreadyCounted = communicationIds.has(communicationId)
  communicationIds.add(communicationId)
  const displayName = p.normalizedSender.displayName?.trim() || null
  const now = new Date(dateIso)
  const shouldReopenSuppressed =
    !alreadyCounted &&
    (existing?.status === "rejected" || existing?.status === "not_a_contact")

  if (!existing) {
    await tx.contactPromotionCandidate.create({
      data: {
        dedupeKey,
        normalizedEmail: email,
        displayName,
        message: p.message.subject ?? null,
        source: "msgraph-email-sender",
        sourceKind: p.classification.source,
        status: "pending",
        firstSeenAt: now,
        lastSeenAt: now,
        communicationId,
        metadata: {
          firstCommunicationId: communicationId,
          lastCommunicationId: communicationId,
          communicationIds: [...communicationIds],
          classification: p.classification.classification,
          classificationSource: p.classification.source,
          autoPromotion: promotion,
        } as Prisma.InputJsonValue,
      },
    })
    return false
  }

  await tx.contactPromotionCandidate.update({
    where: { id: existing.id },
    data: {
      displayName: displayName ?? undefined,
      message: p.message.subject ?? undefined,
      sourceKind: p.classification.source,
      ...(alreadyCounted ? {} : { communicationId }),
      lastSeenAt: now,
      ...(alreadyCounted ? {} : { evidenceCount: { increment: 1 } }),
      ...(shouldReopenSuppressed
        ? { status: "needs_more_evidence" as const, snoozedUntil: null }
        : {}),
      metadata: {
        ...existingMetadata,
        lastCommunicationId: communicationId,
        communicationIds: [...communicationIds],
        classification: p.classification.classification,
        classificationSource: p.classification.source,
        autoPromotion: promotion,
        ...(shouldReopenSuppressed
          ? {
              reopenedFromStatus: existing.status,
              reopenedAt: now.toISOString(),
              reopenReason: "new-material-communication-evidence",
              reopenEvidenceIds: [communicationId],
            }
          : {}),
      } as Prisma.InputJsonValue,
    },
  })
  return false
}

async function loadDirectOutboundEvidence(
  tx: Prisma.TransactionClient,
  email: string
): Promise<{ count: number; attachmentIds: string[] }> {
  const matchingRows: Array<{ id: string; metadata: Prisma.JsonValue }> = []
  let cursor: { id: string } | undefined
  for (let page = 0; page < 10 && matchingRows.length < 50; page += 1) {
    const rows = await tx.communication.findMany({
      where: {
        direction: "outbound",
      },
      select: { id: true, metadata: true },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 50,
      ...(cursor ? { skip: 1, cursor } : {}),
    })
    if (rows.length === 0) break
    for (const row of rows) {
      if (metadataHasRecipient(row.metadata, email)) {
        matchingRows.push(row)
        if (matchingRows.length >= 50) break
      }
    }
    cursor = { id: rows[rows.length - 1].id }
  }
  return {
    count: matchingRows.length,
    attachmentIds: matchingRows
      .filter((row) => hasRealAttachmentEvidenceFromMetadata(row.metadata))
      .map((row) => row.id),
  }
}

function mergeCommunicationMetadataForAutoPromotion(
  p: ProcessedMessage,
  promotion: { [key: string]: unknown },
  dateIso: string
): Prisma.InputJsonValue {
  return {
    classification: p.classification.classification,
    source: p.classification.source,
    tier1Rule: p.classification.tier1Rule,
    acquisition: {
      bodyDecision: p.acquisition.bodyDecision,
      disposition: p.acquisition.disposition,
      ruleId: p.acquisition.ruleId,
      ruleVersion: p.acquisition.ruleVersion,
      riskFlags: p.acquisition.riskFlags,
      rescueFlags: p.acquisition.rescueFlags,
      rationale: p.acquisition.rationale,
    },
    behavioralHints: p.hints,
    conversationId: p.message.conversationId,
    internetMessageId: p.message.internetMessageId,
    parentFolderId: p.message.parentFolderId,
    from: {
      address: p.normalizedSender.address,
      displayName: p.normalizedSender.displayName,
      isInternal: p.normalizedSender.isInternal,
    },
    toRecipients: p.message.toRecipients ?? [],
    ccRecipients: p.message.ccRecipients ?? [],
    hasAttachments: !!p.message.hasAttachments,
    attachments: p.attachments,
    attachmentFetch: p.attachmentFetch,
    importance: p.message.importance ?? "normal",
    isRead: !!p.message.isRead,
    senderNormalizationFailed:
      p.normalizedSender.normalizationFailed || undefined,
    extracted: p.extracted ?? undefined,
    leadContactId: p.leadContactId ?? undefined,
    leadCreated: p.leadCreated || undefined,
    contactAutoPromotion: {
      ...promotion,
      appliedAt: new Date(dateIso).toISOString(),
    },
  } as unknown as Prisma.InputJsonValue
}

function buildAutoPromotedContactNotes(
  p: ProcessedMessage,
  reasonCodes: string[]
): string {
  const subject = p.message.subject?.trim()
  const reason = reasonCodes.join(", ") || "strong email engagement evidence"
  return [
    "Auto-created from email relationship evidence.",
    `Reason: ${reason}.`,
    subject ? `Source email: ${subject}` : null,
  ]
    .filter((line): line is string => !!line)
    .join("\n")
}

function singleRecipientEmail(recipients: unknown): string | null {
  if (!Array.isArray(recipients) || recipients.length !== 1) return null
  const email = recipientEmail(recipients[0])
  return email?.includes("@") ? email.toLowerCase() : null
}

function recipientCount(recipients: unknown): number {
  return Array.isArray(recipients) ? recipients.length : 0
}

function singleRecipientDisplayName(recipients: unknown): string | null {
  if (!Array.isArray(recipients) || recipients.length !== 1) return null
  const emailAddress = asRecord(asRecord(recipients[0]).emailAddress)
  const name = typeof emailAddress.name === "string" ? emailAddress.name : null
  return name?.trim() || null
}

function recipientEmail(recipient: unknown): string | null {
  const emailAddress = asRecord(asRecord(recipient).emailAddress)
  const address =
    typeof emailAddress.address === "string" ? emailAddress.address : null
  return address?.trim() || null
}

function metadataHasRecipient(metadata: unknown, email: string): boolean {
  const record = asRecord(metadata)
  return (
    recipientListHasEmail(record.toRecipients, email) ||
    recipientListHasEmail(record.ccRecipients, email)
  )
}

function recipientListHasEmail(recipients: unknown, email: string): boolean {
  if (!Array.isArray(recipients)) return false
  return recipients.some(
    (recipient) => recipientEmail(recipient)?.toLowerCase() === email
  )
}

function isInternalEmail(email: string, targetAddress: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase()
  const targetDomain = targetAddress.split("@")[1]?.toLowerCase()
  return !!domain && !!targetDomain && domain === targetDomain
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isPlatformLeadSource(source: string): boolean {
  return (
    source === "crexi-lead" ||
    source === "loopnet-lead" ||
    source === "buildout-event"
  )
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

function jsonObject(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

interface ProcessMessageSummary {
  classification: EmailClassification
  extractedPlatform: "crexi" | "loopnet" | "buildout" | null
  contactCreated: boolean
  leadCreated: boolean
  inserted: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Process a single Graph message end-to-end: normalize sender, compute hints,
 * classify, optionally run extractor + upsert lead Contact, fetch attachment
 * metadata for signal rows, persist. Three attempts on transient errors.
 */
export async function processOneMessage(
  message: GraphEmailMessage & { "@removed"?: { reason: string } },
  folder: EmailFolder,
  filterRunMode: EmailFilterRunMode = "observe"
): Promise<ProcessMessageSummary> {
  const cfg = loadMsgraphConfig()

  // Graph delta occasionally returns @removed tombstones — skip them.
  if (message["@removed"]) {
    return {
      classification: "noise",
      extractedPlatform: null,
      contactCreated: false,
      leadCreated: false,
      inserted: false,
    }
  }

  const normalizedSender = normalizeSenderAddress(
    message.from ?? message.sender ?? null,
    cfg.targetUpn
  )

  const hints = await computeBehavioralHints(
    normalizedSender.address,
    message.conversationId
  )

  const classification = classifyEmail(message, {
    folder,
    targetUpn: cfg.targetUpn,
    normalizedSender,
    hints,
  })

  let workingMessage: GraphEmailMessage = message
  let acquisition = evaluateEmailAcquisition(
    workingMessage,
    {
      folder,
      targetUpn: cfg.targetUpn,
      normalizedSender,
      hints,
    },
    classification,
    { runMode: filterRunMode }
  )

  if (
    acquisition.bodyDecision === "fetch_body" &&
    !workingMessage.body?.content
  ) {
    try {
      const bodyResult = await fetchEmailBodyById(
        cfg.targetUpn,
        workingMessage.id
      )
      workingMessage = { ...workingMessage, ...bodyResult }
    } catch (err) {
      acquisition = evaluateBodyFetchFailure(
        acquisition,
        err instanceof GraphError ? (err.code ?? String(err.status)) : undefined
      )
    }
  }

  const extracted =
    classification.classification === "signal"
      ? runExtractor(classification, workingMessage)
      : null
  const messageDateIso =
    folder === "sentitems"
      ? (workingMessage.sentDateTime ?? workingMessage.receivedDateTime)
      : workingMessage.receivedDateTime
  if (!messageDateIso) {
    throw new Error(`message ${message.id} missing date`)
  }

  const existingSync = await db.externalSync.findUnique({
    where: {
      source_externalId: { source: "msgraph-email", externalId: message.id },
    },
    select: { id: true },
  })
  if (existingSync) {
    return {
      classification: classification.classification,
      extractedPlatform: extracted?.platform ?? null,
      contactCreated: false,
      leadCreated: false,
      inserted: false,
    }
  }

  let contactId: string | null = null
  const leadContactId: string | null = null
  const leadCreated = false
  const isPlatformSource =
    classification.source === "crexi-lead" ||
    classification.source === "loopnet-lead" ||
    classification.source === "buildout-event"

  // If no platform source fired, try to resolve Contact by the normalized
  // sender email. Platform leads/events come from vendor senders (Buildout,
  // LoopNet, Crexi), so linking them to the sender Contact would poison the
  // historical record and suppress candidate review even when parsing fails.
  if (
    !isPlatformSource &&
    !contactId &&
    normalizedSender.address.includes("@")
  ) {
    const matches = await db.contact.findMany({
      where: {
        email: { equals: normalizedSender.address, mode: "insensitive" },
        archivedAt: null,
      },
      select: { id: true },
      take: 2,
    })
    contactId = matches.length === 1 ? (matches[0]?.id ?? null) : null
  }

  // Attachment metadata — only for signal rows with attachments.
  let attachments: AttachmentMeta[] | undefined
  let attachmentFetch: AttachmentFetchMeta | undefined
  if (
    classification.classification === "signal" &&
    workingMessage.hasAttachments &&
    !!workingMessage.id
  ) {
    const attachmentResult = await fetchAttachmentMeta(
      cfg.targetUpn,
      workingMessage.id
    )
    attachments = attachmentResult.attachments
    attachmentFetch = attachmentResult.fetch
  }

  // Persist with retry.
  const backoffs = [50, 200, 800]
  let lastError: unknown
  for (let attempt = 0; attempt < backoffs.length; attempt++) {
    try {
      const persisted = await persistMessage({
        message: workingMessage,
        folder,
        normalizedSender,
        classification,
        acquisition,
        hints,
        extracted,
        attachments,
        attachmentFetch,
        contactId,
        leadContactId,
        leadCreated,
      })

      // Buyer-rep deal detection on outbound emails. Fires regardless of
      // whether the row has a contactId yet — for outbound LOIs/tours to
      // brand-new cooperating brokers we won't have a Contact at ingest
      // time. The AgentAction carries the recipient email; createDealFromAction
      // resolves Contact at approval time (find-or-create by email).
      if (
        persisted.inserted &&
        persisted.communicationId &&
        folder === "sentitems"
      ) {
        const recipientDomains = extractRecipientDomains(
          workingMessage.toRecipients ?? []
        )
        const signal = classifyBuyerRepSignal({
          direction: "outbound",
          subject: workingMessage.subject ?? "",
          body: workingMessage.body?.content ?? "",
          recipientDomains,
        })
        if (signal.signalType && signal.proposedStage) {
          // Try to match the first external recipient to an existing
          // Contact. If matched, prefer contactId; otherwise pass
          // recipientEmail through to approval-time resolution.
          const externalRecipient = pickFirstExternalRecipient(
            workingMessage.toRecipients ?? [],
            normalizedSender.address
          )
          let buyerRepContactId: string | null = persisted.contactId
          if (!buyerRepContactId && externalRecipient?.email) {
            const match = await db.contact.findFirst({
              where: {
                email: {
                  equals: externalRecipient.email,
                  mode: "insensitive",
                },
                archivedAt: null,
              },
              select: { id: true },
            })
            if (match) buyerRepContactId = match.id
          }
          if (buyerRepContactId || externalRecipient?.email) {
            await proposeBuyerRepDeal({
              communicationId: persisted.communicationId,
              contactId: buyerRepContactId,
              recipientEmail: externalRecipient?.email ?? null,
              recipientDisplayName: externalRecipient?.displayName ?? null,
              signalType: signal.signalType,
              proposedStage: signal.proposedStage,
              confidence: signal.confidence,
            })
          }
        }
      }

      // Phase B: Buildout deal-stage update — fully deterministic, auto-execute.
      // Runs only on freshly-persisted inbound rows whose extractor flagged a
      // deal-stage-update. The processor itself is idempotent; if anything in
      // it throws we log + continue (don't poison the ingest pipeline).
      if (
        persisted.inserted &&
        persisted.communicationId &&
        folder === "inbox" &&
        extracted &&
        "kind" in extracted &&
        extracted.kind === "deal-stage-update"
      ) {
        try {
          await processBuildoutStageUpdate(persisted.communicationId)
        } catch (err) {
          // Swallow: we'll catch this on the next sweep run. Logging at warn
          // tier so it surfaces but doesn't block the ingest cursor.
          console.warn(
            "[buildout-stage] live-ingest processor failed",
            persisted.communicationId,
            err instanceof Error ? err.message : err
          )
        }
      }

      return {
        classification: classification.classification,
        extractedPlatform: extracted?.platform ?? null,
        contactCreated: persisted.contactCreated,
        leadCreated: persisted.leadCreated,
        inserted: persisted.inserted,
      }
    } catch (err) {
      lastError = err
      if (attempt < backoffs.length - 1) {
        await sleep(backoffs[attempt])
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function resolveAutoPlatformLeadContact(
  tx: Prisma.TransactionClient,
  extracted: ExtractedData | null,
  message: GraphEmailMessage,
  dateIso: string
): Promise<{ contactId: string; created: boolean } | null> {
  if (!shouldAutoCreatePlatformLead(extracted)) return null

  const email = extracted.inquirer.email?.trim().toLowerCase()
  if (!email) return null

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${"platform-lead-email:" + email}))
  `
  const existing = await tx.contact.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) return { contactId: existing.id, created: false }

  const contact = await tx.contact.create({
    data: {
      name: extracted.inquirer.name?.trim() || email || "Unknown Buildout lead",
      company: extracted.inquirer.company ?? null,
      email,
      phone: extracted.inquirer.phone ?? null,
      notes: buildAutoPlatformLeadNotes(message, extracted, dateIso),
      category: "business",
      tags: ["platform-lead", extracted.platform],
      createdBy: "msgraph-email",
      leadSource: extracted.platform,
      leadStatus: "new",
      leadAt: new Date(dateIso),
      leadLastViewedAt: new Date(dateIso),
    },
    select: { id: true },
  })

  return { contactId: contact.id, created: true }
}

function shouldAutoCreatePlatformLead(
  extracted: ExtractedData | null
): extracted is ExtractedData & {
  platform: "buildout"
  kind: "new-lead" | "information-requested"
  inquirer: NonNullable<BuildoutEventExtract["inquirer"]>
} {
  return (
    extracted?.platform === "buildout" &&
    (extracted.kind === "new-lead" ||
      extracted.kind === "information-requested") &&
    !!extracted.inquirer?.email
  )
}

function buildAutoPlatformLeadNotes(
  message: GraphEmailMessage,
  extracted: ExtractedData & {
    platform: "buildout"
    kind: "new-lead" | "information-requested"
    inquirer: NonNullable<BuildoutEventExtract["inquirer"]>
  },
  dateIso: string
): string {
  return [
    "Created automatically from a Buildout lead email.",
    `Graph message ID: ${message.id}`,
    `Source: ${extracted.platform} / ${extracted.kind}`,
    extracted.propertyName ? `Property: ${extracted.propertyName}` : "",
    `First seen: ${new Date(dateIso).toISOString()}`,
    extracted.inquirer.message ? `Message: ${extracted.inquirer.message}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

// ---------------------------------------------------------------------------
// Top-level orchestrator
// ---------------------------------------------------------------------------

export interface SyncEmailOptions {
  daysBack?: number
  forceBootstrap?: boolean
  filterRunMode?: EmailFilterRunMode
}

export interface FolderSyncSummary {
  created: number
  updated: number
  classification: { signal: number; noise: number; uncertain: number }
  platformExtracted: {
    crexiLead: number
    loopnetLead: number
    buildoutEvent: number
  }
  errors: Array<{ graphId: string; message: string; attempts: number }>
}

export interface SyncEmailResult {
  isBootstrap: boolean
  bootstrapReason?: "no-cursor" | "delta-expired" | "forced"
  skippedLocked: boolean
  perFolder: Record<EmailFolder, FolderSyncSummary>
  contactsCreated: number
  leadsCreated: number
  durationMs: number
  cursorAdvanced: boolean
}

const ADVISORY_LOCK_KEY = "msgraph-email"
const MS_PER_DAY = 24 * 60 * 60 * 1000

function emptyFolderSummary(): FolderSyncSummary {
  return {
    created: 0,
    updated: 0,
    classification: { signal: 0, noise: 0, uncertain: 0 },
    platformExtracted: { crexiLead: 0, loopnetLead: 0, buildoutEvent: 0 },
    errors: [],
  }
}

function emptyResult(
  skippedLocked: boolean,
  durationMs: number
): SyncEmailResult {
  return {
    isBootstrap: false,
    skippedLocked,
    perFolder: { inbox: emptyFolderSummary(), sentitems: emptyFolderSummary() },
    contactsCreated: 0,
    leadsCreated: 0,
    durationMs,
    cursorAdvanced: false,
  }
}

async function tryAdvisoryLock(): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ got: boolean }>>`
    SELECT pg_try_advisory_lock(hashtext(${ADVISORY_LOCK_KEY})) AS got
  `
  return !!rows[0]?.got
}

async function releaseAdvisoryLock(): Promise<void> {
  await db.$queryRaw`
    SELECT pg_advisory_unlock(hashtext(${ADVISORY_LOCK_KEY}))
  `
}

export async function syncEmails(
  options: SyncEmailOptions = {}
): Promise<SyncEmailResult> {
  const t0 = Date.now()
  const daysBack = options.daysBack ?? 90
  const sinceIso = new Date(Date.now() - daysBack * MS_PER_DAY).toISOString()

  const locked = await tryAdvisoryLock()
  if (!locked) {
    return emptyResult(true, Date.now() - t0)
  }

  try {
    if (options.forceBootstrap) {
      await deleteEmailCursor("inbox")
      await deleteEmailCursor("sentitems")
    }

    const inboxHadCursor = !!(await loadEmailCursor("inbox"))
    const sentHadCursor = !!(await loadEmailCursor("sentitems"))
    const isBootstrap = !inboxHadCursor || !sentHadCursor

    let contactsCreated = 0
    let leadsCreated = 0
    let deltaExpiredSomewhere = false

    const result: SyncEmailResult = {
      isBootstrap,
      bootstrapReason: options.forceBootstrap
        ? "forced"
        : isBootstrap
          ? "no-cursor"
          : undefined,
      skippedLocked: false,
      perFolder: {
        inbox: emptyFolderSummary(),
        sentitems: emptyFolderSummary(),
      },
      contactsCreated: 0,
      leadsCreated: 0,
      durationMs: 0,
      cursorAdvanced: false,
    }

    const folders: EmailFolder[] = ["inbox", "sentitems"]
    let cursorAdvanced = true

    for (const folder of folders) {
      const summary = result.perFolder[folder]
      let finalDeltaLink: string | undefined
      const concurrency = readSyncConcurrency()
      try {
        for await (const { page } of fetchEmailDelta(folder, sinceIso)) {
          await processMessagesConcurrently(
            page.value,
            concurrency,
            async (rawMsg) => {
              try {
                const res = await processOneMessage(
                  rawMsg,
                  folder,
                  options.filterRunMode ?? "observe"
                )
                summary.classification[res.classification]++
                if (res.inserted) summary.created++
                if (res.extractedPlatform === "crexi")
                  summary.platformExtracted.crexiLead++
                if (res.extractedPlatform === "loopnet")
                  summary.platformExtracted.loopnetLead++
                if (res.extractedPlatform === "buildout")
                  summary.platformExtracted.buildoutEvent++
                if (res.contactCreated) contactsCreated++
                if (res.leadCreated) leadsCreated++
              } catch (err) {
                summary.errors.push({
                  graphId: rawMsg.id,
                  message: err instanceof Error ? err.message : String(err),
                  attempts: 3,
                })
                await db.externalSync
                  .upsert({
                    where: {
                      source_externalId: {
                        source: "msgraph-email",
                        externalId: rawMsg.id,
                      },
                    },
                    create: {
                      source: "msgraph-email",
                      externalId: rawMsg.id,
                      entityType: "communication",
                      status: "failed",
                      errorMsg:
                        err instanceof Error ? err.message : String(err),
                    },
                    update: {
                      status: "failed",
                      errorMsg:
                        err instanceof Error ? err.message : String(err),
                    },
                  })
                  .catch(() => {
                    /* best-effort */
                  })
              }
            }
          )
          if (page["@odata.deltaLink"]) {
            finalDeltaLink = page["@odata.deltaLink"]
          }
        }
      } catch (err) {
        if (
          err instanceof GraphError &&
          err.status === 410 &&
          /sync\s*state/i.test(err.code ?? "")
        ) {
          await deleteEmailCursor(folder)
          deltaExpiredSomewhere = true
          cursorAdvanced = false
          continue
        }
        throw err
      }

      if (summary.errors.length === 0 && finalDeltaLink) {
        await saveEmailCursor(folder, finalDeltaLink)
      } else {
        cursorAdvanced = false
      }
    }

    if (deltaExpiredSomewhere) {
      result.bootstrapReason = "delta-expired"
      result.isBootstrap = true
    }

    result.contactsCreated = contactsCreated
    result.leadsCreated = leadsCreated
    result.cursorAdvanced = cursorAdvanced
    result.durationMs = Date.now() - t0
    return result
  } finally {
    await releaseAdvisoryLock()
  }
}

/**
 * Process a page of messages with bounded concurrency. Cursor advance still
 * waits for ALL handlers to settle (per-page Promise.all semantics), so the
 * delta cursor never moves past in-flight work. Each handler's per-message
 * try/catch lives in the caller — this helper just orchestrates the pool.
 *
 * Default concurrency is 10. Override with MSGRAPH_SYNC_CONCURRENCY=N (set
 * to 1 to restore strict-sequential behavior for debugging).
 */
export async function processMessagesConcurrently<T>(
  items: readonly T[],
  limit: number,
  handler: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return
  const safeLimit = Math.max(1, Math.min(limit, items.length))
  let nextIndex = 0
  const workers = Array.from({ length: safeLimit }, async () => {
    while (true) {
      const i = nextIndex++
      if (i >= items.length) return
      await handler(items[i])
    }
  })
  await Promise.all(workers)
}

const SYNC_CONCURRENCY_DEFAULT = 10
const SYNC_CONCURRENCY_MAX = 25

function readSyncConcurrency(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env.MSGRAPH_SYNC_CONCURRENCY
  if (!raw) return SYNC_CONCURRENCY_DEFAULT
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return SYNC_CONCURRENCY_DEFAULT
  return Math.min(parsed, SYNC_CONCURRENCY_MAX)
}

// Pull recipient domains from a Graph toRecipients array. Returns lower-cased
// domains, deduped. Used by the buyer-rep detector hook in processOneMessage.
function extractRecipientDomains(
  toRecipients: ReadonlyArray<{ emailAddress?: { address?: string } }>
): string[] {
  const out = new Set<string>()
  for (const r of toRecipients ?? []) {
    const addr = r?.emailAddress?.address?.trim().toLowerCase()
    if (!addr || !addr.includes("@")) continue
    const domain = addr.split("@")[1]
    if (domain) out.add(domain)
  }
  return Array.from(out)
}

// Pick the first non-internal recipient for the buyer-rep hook. Skips
// addresses sharing the sender's domain (NAI internal traffic). Returns
// null if every recipient is internal or malformed.
function pickFirstExternalRecipient(
  recipients: ReadonlyArray<{
    emailAddress?: { address?: string; name?: string }
  }>,
  senderAddress: string
): { email: string; displayName: string | null } | null {
  for (const r of recipients ?? []) {
    const email = r?.emailAddress?.address?.trim().toLowerCase()
    if (!email || !email.includes("@")) continue
    if (isInternalEmail(email, senderAddress)) continue
    const name = r?.emailAddress?.name?.trim()
    return {
      email,
      displayName: name && name.length > 0 ? name : null,
    }
  }
  return null
}
