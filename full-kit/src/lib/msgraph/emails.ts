import type {
  BuildoutEventExtract,
  CrexiLeadExtract,
  InquirerInfo,
  LoopNetLeadExtract,
} from "./email-extractors"
import type {
  BehavioralHints,
  ClassificationResult,
  EmailClassification,
  EmailFolder,
  GraphEmailMessage,
} from "./email-types"
import type { NormalizedSender } from "./sender-normalize"
import type { LeadSource, Prisma } from "@prisma/client"

import { enqueueScrubForCommunication } from "@/lib/ai/scrub-queue"
import { db } from "@/lib/prisma"

import { graphFetch } from "./client"
import { loadMsgraphConfig } from "./config"
import {
  extractBuildoutEvent,
  extractCrexiLead,
  extractLoopNetLead,
} from "./email-extractors"
import { classifyEmail, domainIsLargeCreBroker } from "./email-filter"
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
  "body",
  "bodyPreview",
  "internetMessageHeaders",
].join(",")

const PAGE_SIZE = 100

const PREFER_HEADER = {
  Prefer: `outlook.body-content-type="text", odata.maxpagesize=${PAGE_SIZE}`,
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
      headers: PREFER_HEADER,
    })
    const isFinal = !res["@odata.nextLink"] && !!res["@odata.deltaLink"]
    yield { page: res, isFinal }
    url = res["@odata.nextLink"]
  }
}

/** Exported for test re-export and type-only consumers. */
export type { GraphDeltaPage }

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

  const [contactRow, outboundCount, threadSize] = await Promise.all([
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
            metadata: { path: ["conversationId"], equals: conversationId },
          },
        })
      : Promise.resolve(0),
  ])

  return {
    senderInContacts: !!contactRow,
    mattRepliedBefore: outboundCount > 0,
    threadSize: threadSize + 1,
    domainIsLargeCreBroker: domainIsLargeCreBroker(senderDomain),
  }
}

export interface UpsertLeadContactInput {
  inquirer: InquirerInfo
  leadSource: LeadSource
  leadAt: Date
}

export interface UpsertLeadContactResult {
  contactId: string
  created: boolean
  becameLead: boolean
}

/**
 * Create or update a Contact from an extracted lead inquirer.
 *
 * Rules:
 * - Requires inquirer.email (we key on normalized email).
 * - New Contact → created with leadSource, leadStatus=new, leadAt.
 * - Existing Contact with NO deals AND null leadSource → fill in lead fields.
 * - Existing Contact with deals (i.e. already a Client) → leave lead fields null.
 * - Existing Contact already a lead (leadSource set) → do not touch leadStatus/leadAt.
 * - Runs inside a transaction; safe to re-call on duplicate inquirer emails.
 */
export async function upsertLeadContact(
  input: UpsertLeadContactInput,
  tx?: Prisma.TransactionClient
): Promise<UpsertLeadContactResult | null> {
  if (!input.inquirer.email) return null
  const client: Prisma.TransactionClient =
    tx ?? (db as unknown as Prisma.TransactionClient)
  const email = input.inquirer.email.toLowerCase()

  const existing = await client.contact.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { _count: { select: { deals: true } } },
  })

  if (!existing) {
    const created = await client.contact.create({
      data: {
        name: input.inquirer.name ?? input.inquirer.email,
        email,
        phone: input.inquirer.phone ?? null,
        company: input.inquirer.company ?? null,
        notes: input.inquirer.message ?? null,
        category: "business",
        tags: [],
        createdBy: `msgraph-email-${input.leadSource}-extract`,
        leadSource: input.leadSource,
        leadStatus: "new",
        leadAt: input.leadAt,
      },
      select: { id: true },
    })
    return { contactId: created.id, created: true, becameLead: true }
  }

  const isClient = existing._count.deals > 0
  const alreadyLead = existing.leadSource !== null

  if (isClient || alreadyLead) {
    return { contactId: existing.id, created: false, becameLead: false }
  }

  await client.contact.update({
    where: { id: existing.id },
    data: {
      leadSource: input.leadSource,
      leadStatus: "new",
      leadAt: input.leadAt,
      // Only fill missing demographic fields; never overwrite what Matt curated.
      phone: existing.phone ?? input.inquirer.phone ?? null,
      company: existing.company ?? input.inquirer.company ?? null,
    },
  })
  return { contactId: existing.id, created: false, becameLead: true }
}

// ---------------------------------------------------------------------------
// Attachment metadata
// ---------------------------------------------------------------------------

export interface AttachmentMeta {
  id: string
  name: string
  size: number
  contentType: string
}

/** Fetches attachment metadata (not binary) for a single message. */
export async function fetchAttachmentMeta(
  targetUpn: string,
  messageId: string
): Promise<AttachmentMeta[]> {
  const path =
    `/users/${encodeURIComponent(targetUpn)}/messages/${encodeURIComponent(messageId)}/attachments` +
    `?$select=id,name,size,contentType`
  try {
    const res = await graphFetch<{ value: AttachmentMeta[] }>(path)
    return res.value ?? []
  } catch (err) {
    if (err instanceof GraphError) return []
    throw err
  }
}

// ---------------------------------------------------------------------------
// Extractor dispatch
// ---------------------------------------------------------------------------

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
  extracted: ExtractedData | null
  attachments: AttachmentMeta[] | undefined
  contactId: string | null
  leadContactId: string | null
  leadCreated: boolean
}

/** Persist one processed message as a Communication + ExternalSync pair, in a txn. */
export async function persistMessage(
  p: ProcessedMessage
): Promise<{ inserted: boolean }> {
  const direction = p.folder === "inbox" ? "inbound" : "outbound"
  const storeBody = p.classification.classification !== "noise"
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
  if (existing) return { inserted: false }

  const metadata: Record<string, unknown> = {
    classification: p.classification.classification,
    source: p.classification.source,
    tier1Rule: p.classification.tier1Rule,
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
    importance: p.message.importance ?? "normal",
    isRead: !!p.message.isRead,
    senderNormalizationFailed:
      p.normalizedSender.normalizationFailed || undefined,
    extracted: p.extracted ?? undefined,
    leadContactId: p.leadContactId ?? undefined,
    leadCreated: p.leadCreated || undefined,
  }

  await db.$transaction(async (tx) => {
    const sync = await tx.externalSync.create({
      data: {
        source: "msgraph-email",
        externalId: p.message.id,
        entityType: "communication",
        status: "synced",
        rawData: {
          folder: p.folder,
          graphSnapshot: p.message as unknown as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      },
    })
    const comm = await tx.communication.create({
      data: {
        channel: "email",
        subject: p.message.subject ?? null,
        body: storeBody ? (p.message.body?.content ?? null) : null,
        date: new Date(dateIso),
        direction,
        category: "business",
        externalMessageId: p.message.id,
        externalSyncId: sync.id,
        contactId: p.contactId,
        createdBy: "msgraph-email",
        tags: [],
        metadata: metadata as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    await tx.externalSync.update({
      where: { id: sync.id },
      data: { entityId: comm.id },
    })
    // Enqueue for AI scrub — same transaction as the Communication
    // insert so either both land or neither does. enqueueScrubForCommunication
    // is a no-op for "noise" classification.
    await enqueueScrubForCommunication(
      tx,
      comm.id,
      p.classification.classification
    )
  })

  return { inserted: true }
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
  folder: EmailFolder
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

  const extracted =
    classification.classification === "signal"
      ? runExtractor(classification, message)
      : null

  // Lead contact upsert (before Communication insert so contactId can point at it).
  let leadContactId: string | null = null
  let leadCreated = false
  let contactId: string | null = null
  if (extracted && "inquirer" in extracted && extracted.inquirer?.email) {
    const sourceMap: Record<"crexi" | "loopnet" | "buildout", LeadSource> = {
      crexi: "crexi",
      loopnet: "loopnet",
      buildout: "buildout",
    }
    const res = await upsertLeadContact({
      inquirer: extracted.inquirer,
      leadSource: sourceMap[extracted.platform],
      leadAt: new Date(message.receivedDateTime ?? Date.now()),
    })
    if (res) {
      leadContactId = res.contactId
      leadCreated = res.created
      contactId = res.contactId
    }
  }

  // If no extractor lead, try to resolve Contact by the normalized sender email.
  if (!contactId && normalizedSender.address.includes("@")) {
    const match = await db.contact.findFirst({
      where: {
        email: { equals: normalizedSender.address, mode: "insensitive" },
      },
      select: { id: true },
    })
    contactId = match?.id ?? null
  }

  // Attachment metadata — only for signal rows with attachments.
  let attachments: AttachmentMeta[] | undefined
  if (
    classification.classification === "signal" &&
    message.hasAttachments &&
    !!message.id
  ) {
    attachments = await fetchAttachmentMeta(cfg.targetUpn, message.id)
  }

  // Persist with retry.
  const backoffs = [50, 200, 800]
  let lastError: unknown
  for (let attempt = 0; attempt < backoffs.length; attempt++) {
    try {
      const { inserted } = await persistMessage({
        message,
        folder,
        normalizedSender,
        classification,
        extracted,
        attachments,
        contactId,
        leadContactId,
        leadCreated,
      })
      return {
        classification: classification.classification,
        extractedPlatform: extracted?.platform ?? null,
        contactCreated: leadCreated,
        leadCreated,
        inserted,
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

// ---------------------------------------------------------------------------
// Top-level orchestrator
// ---------------------------------------------------------------------------

export interface SyncEmailOptions {
  daysBack?: number
  forceBootstrap?: boolean
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
      try {
        for await (const { page } of fetchEmailDelta(folder, sinceIso)) {
          for (const rawMsg of page.value) {
            try {
              const res = await processOneMessage(rawMsg, folder)
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
                    errorMsg: err instanceof Error ? err.message : String(err),
                  },
                  update: {
                    status: "failed",
                    errorMsg: err instanceof Error ? err.message : String(err),
                  },
                })
                .catch(() => {
                  /* best-effort */
                })
            }
          }
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
