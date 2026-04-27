import type { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

import { loadMsgraphConfig } from "./config"
import { classifyEmail, domainIsLargeCreBroker } from "./email-filter"
import {
  buildEmailFilterRunReport,
  createEmailFilterRunId,
} from "./email-filter-audit"
import { evaluateEmailAcquisition } from "./email-filter-evaluator"
import {
  EMAIL_FILTER_RULE_SET_VERSION,
  createRuleVersionSnapshot,
} from "./email-filter-rules"

interface StoredCommunicationRow {
  id: string
  externalMessageId: string | null
  subject: string | null
  body: string | null
  date: Date
  direction: string | null
  metadata: unknown
  externalSyncId: string | null
  contactId: string | null
}

export interface RunStoredEmailFilterAuditOptions {
  limit?: number
  offset?: number
  cursorDate?: Date
  cursorId?: string
  requestedBy?: string
  sampleEvery?: number
  snapshotDate?: Date
}

export interface RunStoredEmailFilterAuditResult {
  runId: string
  scanned: number
  offset: number
  limit: number
  nextCursor: StoredEmailFilterAuditCursor | null
  snapshotDate: string
  dryRun: true
  report: Record<string, unknown>
}

export interface StoredEmailFilterAuditCursor {
  date: string
  id: string
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringField(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key]
  return typeof value === "string" ? value : null
}

function objectField(
  record: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const value = record[key]
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function arrayObjectField(
  record: Record<string, unknown>,
  key: string
): Array<Record<string, unknown>> {
  const value = record[key]
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
}

function booleanField(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true
}

function chunkSafe(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "")
}

function conversationIdFromMetadata(value: unknown): string | null {
  return stringField(metadataObject(value), "conversationId")
}

function uniqueStrings(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))]
}

async function findOutboundConversationIds(
  conversationIds: string[]
): Promise<Set<string>> {
  if (conversationIds.length === 0) return new Set()
  const outboundRows = await db.communication.findMany({
    where: {
      channel: "email",
      direction: "outbound",
      OR: conversationIds.map((conversationId) => ({
        metadata: { path: ["conversationId"], equals: conversationId },
      })),
    },
    select: { metadata: true },
  })
  return new Set(
    outboundRows
      .map((row) => conversationIdFromMetadata(row.metadata))
      .filter((value): value is string => !!value)
  )
}

async function countRowsByConversationId(
  conversationIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (conversationIds.length === 0) return counts
  const threadRows = await db.communication.findMany({
    where: {
      channel: "email",
      OR: conversationIds.map((conversationId) => ({
        metadata: { path: ["conversationId"], equals: conversationId },
      })),
    },
    select: { metadata: true },
  })
  for (const row of threadRows) {
    const conversationId = conversationIdFromMetadata(row.metadata)
    if (!conversationId) continue
    counts.set(conversationId, (counts.get(conversationId) ?? 0) + 1)
  }
  return counts
}

export async function runStoredEmailFilterAudit(
  options: RunStoredEmailFilterAuditOptions = {}
): Promise<RunStoredEmailFilterAuditResult> {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 1000))
  const offset = Math.max(0, options.offset ?? 0)
  const sampleEvery = Math.max(1, options.sampleEvery ?? 10)
  const snapshotDate = options.snapshotDate ?? new Date()
  const config = loadMsgraphConfig()
  const runId = createEmailFilterRunId("stored-email-filter-audit")
  const chunkId = options.cursorDate
    ? `stored-communications-cursor-${chunkSafe(options.cursorDate.toISOString())}-${chunkSafe(options.cursorId ?? "none")}`
    : `stored-communications-offset-${offset}`
  const ruleVersionSnapshot = createRuleVersionSnapshot()
  const cursorFilter =
    options.cursorDate && options.cursorId
      ? {
          OR: [
            { date: { lt: options.cursorDate } },
            {
              date: options.cursorDate,
              id: { gt: options.cursorId },
            },
          ],
        }
      : {}

  await db.emailFilterRun.create({
    data: {
      runId,
      mode: "dry_run",
      ruleSetVersion: EMAIL_FILTER_RULE_SET_VERSION,
      mailboxId: "stored-communications",
      folderScope: "communications.email",
      dryRun: true,
      status: "running",
      requestedBy: options.requestedBy ?? "admin-route",
      ruleVersionSnapshot: ruleVersionSnapshot as Prisma.InputJsonValue,
    },
  })
  await db.emailFilterChunk.create({
    data: {
      runId,
      chunkId,
      status: "running",
    },
  })

  const rows = (await db.communication.findMany({
    where: {
      channel: "email",
      date: { lte: snapshotDate },
      ...cursorFilter,
    },
    orderBy: [{ date: "desc" }, { id: "asc" }],
    skip: options.cursorDate ? 0 : offset,
    take: limit,
    select: {
      id: true,
      externalMessageId: true,
      subject: true,
      body: true,
      date: true,
      direction: true,
      metadata: true,
      externalSyncId: true,
      contactId: true,
    },
  })) as StoredCommunicationRow[]

  const conversationIds = uniqueStrings(
    rows.map((row) => conversationIdFromMetadata(row.metadata))
  )
  const [outboundConversationIds, threadCounts] = await Promise.all([
    findOutboundConversationIds(conversationIds),
    countRowsByConversationId(conversationIds),
  ])

  const auditRows: Array<{
    classification: string
    bodyDecision: string
    ruleId: string
    ruleVersion: number
    disposition: string
    riskFlags: unknown[]
    rescueFlags: unknown[]
  }> = []
  const auditData: Prisma.EmailFilterAuditCreateManyInput[] = []
  let index = 0
  for (const row of rows) {
    index++
    const metadata = metadataObject(row.metadata)
    const conversationId = stringField(metadata, "conversationId")
    const storedClassification =
      stringField(metadata, "classification") ?? "uncertain"
    const storedSource = stringField(metadata, "source") ?? "layer-c"
    const storedTier1Rule = stringField(metadata, "tier1Rule") ?? "stored-audit"
    const from = objectField(metadata, "from")
    const senderAddress = stringField(from, "address") ?? ""
    const senderDomain = senderAddress.includes("@")
      ? senderAddress.split("@")[1]
      : undefined
    const toRecipients = arrayObjectField(metadata, "toRecipients")
    const ccRecipients = arrayObjectField(metadata, "ccRecipients")
    const hasListUnsubscribe = storedSource === "layer-b-unsubscribe-header"
    const message = {
      id: row.externalMessageId ?? row.id,
      internetMessageId:
        stringField(metadata, "internetMessageId") ?? undefined,
      conversationId: conversationId ?? undefined,
      parentFolderId: stringField(metadata, "parentFolderId") ?? undefined,
      subject: row.subject,
      receivedDateTime: row.date.toISOString(),
      toRecipients: toRecipients as never,
      ccRecipients: ccRecipients as never,
      hasAttachments: booleanField(metadata, "hasAttachments"),
      body: row.body
        ? { contentType: "text" as const, content: row.body }
        : undefined,
      internetMessageHeaders: hasListUnsubscribe
        ? [{ name: "List-Unsubscribe", value: "stored-classification" }]
        : undefined,
    }
    const context = {
      folder:
        row.direction === "outbound"
          ? ("sentitems" as const)
          : ("inbox" as const),
      targetUpn: config.targetUpn,
      normalizedSender: {
        address: senderAddress,
        displayName: stringField(from, "displayName") ?? "",
        isInternal: booleanField(from, "isInternal"),
        normalizationFailed: booleanField(
          metadata,
          "senderNormalizationFailed"
        ),
      },
      hints: {
        senderInContacts:
          !!row.contactId || storedSource === "known-counterparty",
        mattRepliedBefore:
          storedSource === "known-counterparty" ||
          row.direction === "outbound" ||
          (!!conversationId && outboundConversationIds.has(conversationId)),
        threadSize: conversationId
          ? Math.max(1, threadCounts.get(conversationId) ?? 1)
          : storedSource === "known-counterparty"
            ? 2
            : 1,
        domainIsLargeCreBroker: domainIsLargeCreBroker(senderDomain),
      },
    }
    const currentClassification = classifyEmail(message, context)
    const classification = currentClassification.classification
    const decision = evaluateEmailAcquisition(
      message,
      context,
      currentClassification,
      { runMode: "observe" }
    )
    const bodyDecision = decision.bodyDecision
    const ruleId = decision.ruleId
    const ruleVersion = decision.ruleVersion
    const disposition = decision.disposition
    const riskFlags = decision.riskFlags
    const rescueFlags = decision.rescueFlags
    const sampled = index % sampleEvery === 0

    auditData.push({
      runId,
      chunkId,
      externalMessageId: row.externalMessageId ?? row.id,
      internetMessageId: stringField(metadata, "internetMessageId"),
      communicationId: row.id,
      externalSyncId: row.externalSyncId,
      ruleId,
      ruleVersion,
      classification,
      bodyDecision,
      disposition,
      riskFlags: riskFlags as Prisma.InputJsonValue,
      rescueFlags: rescueFlags as Prisma.InputJsonValue,
      evidenceSnapshot: {
        subject: row.subject,
        date: row.date,
        direction: row.direction,
        storedClassification,
        storedSource,
        storedTier1Rule,
        currentClassification: currentClassification.classification,
        currentSource: currentClassification.source,
        currentTier1Rule: currentClassification.tier1Rule,
        from: metadata["from"] ?? null,
      } as Prisma.InputJsonValue,
      sampleBucket: sampled ? "stored-email-sample" : null,
      sampled,
      reviewOutcome: "not_reviewed",
      bodyAvailable: !!row.body,
      bodyLength: row.body?.length ?? 0,
      bodyContentType: row.body ? "text" : null,
      redactionStatus: row.body ? "redacted" : "empty",
    })
    auditRows.push({
      classification,
      bodyDecision,
      ruleId,
      ruleVersion,
      disposition,
      riskFlags,
      rescueFlags,
    })
  }

  if (auditData.length > 0) {
    await db.emailFilterAudit.createMany({ data: auditData })
  }

  const report = {
    ...buildEmailFilterRunReport(auditRows),
    auditScope: {
      source: "stored-communications",
      offset,
      limit,
      cursorDate: options.cursorDate?.toISOString() ?? null,
      cursorId: options.cursorId ?? null,
      nextCursor:
        rows.length > 0
          ? {
              date: rows[rows.length - 1]!.date.toISOString(),
              id: rows[rows.length - 1]!.id,
            }
          : null,
      snapshotDate: snapshotDate.toISOString(),
      orderBy: "date desc, id asc",
    },
  }
  await db.emailFilterChunk.update({
    where: { runId_chunkId: { runId, chunkId } },
    data: {
      status: "completed",
      completedAt: new Date(),
      messagesSeen: rows.length,
      metadataFetched: rows.length,
      bodyFetchAttempted: 0,
      bodyFetchSucceeded: 0,
      bodyFetchFailed: 0,
      quarantineCount: auditRows.filter(
        (row) => row.disposition === "quarantined"
      ).length,
      safeSkipAppliedCount: auditRows.filter(
        (row) => row.bodyDecision === "safe_body_skip"
      ).length,
    },
  })
  await db.emailFilterRun.update({
    where: { runId },
    data: {
      status: "completed",
      completedAt: new Date(),
      messagesSeen: rows.length,
      metadataFetched: rows.length,
      gateResults: report as Prisma.InputJsonValue,
    },
  })

  return {
    runId,
    scanned: rows.length,
    offset,
    limit,
    nextCursor:
      rows.length > 0
        ? {
            date: rows[rows.length - 1]!.date.toISOString(),
            id: rows[rows.length - 1]!.id,
          }
        : null,
    snapshotDate: snapshotDate.toISOString(),
    dryRun: true,
    report,
  }
}
