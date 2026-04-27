import type { Prisma } from "@prisma/client"
import type {
  EmailAcquisitionDecision,
  EmailFilterRunMode,
  GraphEmailMessage,
} from "./email-types"

import { db } from "@/lib/prisma"

import { redactEmailBody } from "./email-filter-redaction"
import { createRuleVersionSnapshot } from "./email-filter-rules"

export interface EmailFilterRunSummary {
  runId: string
  mode: EmailFilterRunMode
  messagesSeen: number
  metadataFetched: number
  bodyFetchAttempted: number
  bodyFetchSucceeded: number
  bodyFetchFailed: number
  quarantineCount: number
  safeSkipProposedCount: number
  safeSkipAppliedCount: number
  criticalFalseNegativeCount: number
  ruleVersionSnapshot: Record<string, unknown>
}

export function createEmailFilterRunId(prefix = "email-filter"): string {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, "")}-${Math.random().toString(36).slice(2, 8)}`
}

export async function createEmailFilterRun(input: {
  mode: EmailFilterRunMode
  mailboxId: string
  folderScope?: string
  dateFrom?: Date
  dateTo?: Date
  dryRun?: boolean
  requestedBy?: string
}): Promise<string> {
  const runId = createEmailFilterRunId()
  await db.emailFilterRun.create({
    data: {
      runId,
      mode: input.mode,
      ruleSetVersion: "2026-04-26.1",
      mailboxId: input.mailboxId,
      folderScope: input.folderScope ?? null,
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
      dryRun: input.dryRun ?? input.mode === "dry_run",
      status: "running",
      requestedBy: input.requestedBy ?? "system",
      ruleVersionSnapshot: createRuleVersionSnapshot() as Prisma.InputJsonValue,
    },
  })
  return runId
}

export async function createEmailFilterChunk(input: {
  runId: string
  chunkId: string
  folder?: string
  cursorBefore?: string | null
  dateFrom?: Date
  dateTo?: Date
}): Promise<void> {
  await db.emailFilterChunk.create({
    data: {
      runId: input.runId,
      chunkId: input.chunkId,
      folder: input.folder ?? null,
      cursorBefore: input.cursorBefore ?? null,
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
      status: "running",
    },
  })
}

export async function recordEmailFilterAudit(input: {
  runId: string
  chunkId: string
  message: GraphEmailMessage
  decision: EmailAcquisitionDecision
  communicationId?: string | null
  externalSyncId?: string | null
  graphFetchStatus?: string | null
  graphErrorCode?: string | null
  sampled?: boolean
}): Promise<void> {
  const redaction = redactEmailBody(input.message.body)
  await db.emailFilterAudit.create({
    data: {
      runId: input.runId,
      chunkId: input.chunkId,
      externalMessageId: input.message.id,
      internetMessageId: input.message.internetMessageId ?? null,
      communicationId: input.communicationId ?? null,
      externalSyncId: input.externalSyncId ?? null,
      ruleId: input.decision.ruleId,
      ruleVersion: input.decision.ruleVersion,
      classification: input.decision.classification,
      bodyDecision: input.decision.bodyDecision,
      disposition: input.decision.disposition,
      riskFlags: input.decision.riskFlags as Prisma.InputJsonValue,
      rescueFlags: input.decision.rescueFlags as Prisma.InputJsonValue,
      evidenceSnapshot: input.decision
        .evidenceSnapshot as Prisma.InputJsonValue,
      sampleBucket: input.sampled ? "auto-sample" : null,
      sampled: input.sampled ?? false,
      reviewOutcome: "not_reviewed",
      bodyAvailable: !!input.message.body?.content,
      bodyHash: redaction.bodyHash,
      bodyLength: redaction.bodyLength,
      bodyContentType: redaction.bodyContentType,
      redactionVersion: redaction.redactionVersion,
      redactionStatus: redaction.redactionStatus,
      graphFetchStatus: input.graphFetchStatus ?? null,
      graphErrorCode: input.graphErrorCode ?? null,
    },
  })
}

export function buildEmailFilterRunReport(
  audits: Array<{
    classification: string
    bodyDecision: string
    ruleId: string
    ruleVersion: number
    disposition: string
    riskFlags?: unknown
    rescueFlags?: unknown
  }>
): Record<string, unknown> {
  const counts = {
    messagesSeen: audits.length,
    classifications: {} as Record<string, number>,
    bodyDecisions: {} as Record<string, number>,
    ruleHits: {} as Record<string, number>,
    dispositions: {} as Record<string, number>,
    riskFlags: {} as Record<string, number>,
    rescueFlags: {} as Record<string, number>,
  }
  for (const audit of audits) {
    counts.classifications[audit.classification] =
      (counts.classifications[audit.classification] ?? 0) + 1
    counts.bodyDecisions[audit.bodyDecision] =
      (counts.bodyDecisions[audit.bodyDecision] ?? 0) + 1
    const ruleKey = `${audit.ruleId}@${audit.ruleVersion}`
    counts.ruleHits[ruleKey] = (counts.ruleHits[ruleKey] ?? 0) + 1
    counts.dispositions[audit.disposition] =
      (counts.dispositions[audit.disposition] ?? 0) + 1
    for (const flag of Array.isArray(audit.riskFlags) ? audit.riskFlags : []) {
      const key = String(flag)
      counts.riskFlags[key] = (counts.riskFlags[key] ?? 0) + 1
    }
    for (const flag of Array.isArray(audit.rescueFlags)
      ? audit.rescueFlags
      : []) {
      const key = String(flag)
      counts.rescueFlags[key] = (counts.rescueFlags[key] ?? 0) + 1
    }
  }
  return counts
}
