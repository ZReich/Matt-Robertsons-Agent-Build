import { createHash } from "node:crypto"

import type { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

import {
  COVERAGE_FILTERS,
  COVERAGE_POLICY_VERSION,
  type CoverageDb,
  type CoverageFilter,
} from "./communication-coverage"

export const MAX_AUDIT_REVIEW_ITEM_IDS = 100
export const COVERAGE_AUDIT_RETENTION_DAYS = 90
export const COVERAGE_REVIEW_RETENTION_DAYS = 90

const REVIEW_RETENTION_STATUSES = [
  "resolved",
  "ignored",
  "snoozed",
] as const
type ReviewRetentionStatus = (typeof REVIEW_RETENTION_STATUSES)[number]

const REVIEW_RETENTION_BATCH_DEFAULT = 200
const AUDIT_RETENTION_BATCH_DEFAULT = 200

export type CoverageActionAuditOutcome = {
  applied: number
  skipped: number
  unsupported: number
}

export type RecordCoverageActionAuditInput = {
  actor: string
  action: string
  runId: string | null
  dryRun: boolean
  policyVersion?: string
  reviewItemIds?: readonly string[]
  outcome: CoverageActionAuditOutcome
}

export async function recordCoverageActionAudit(
  input: RecordCoverageActionAuditInput,
  client: CoverageDb = db
): Promise<{ id: string }> {
  const cappedIds = Array.from(
    new Set((input.reviewItemIds ?? []).filter((id) => typeof id === "string"))
  ).slice(0, MAX_AUDIT_REVIEW_ITEM_IDS)
  const outcome = sanitizeOutcome(input.outcome)
  const policyVersion = input.policyVersion ?? COVERAGE_POLICY_VERSION
  const created = await client.coverageActionAuditLog.create({
    data: {
      actor: redactActor(input.actor),
      action: redactSlug(input.action, "action"),
      runId: input.runId,
      dryRun: input.dryRun,
      policyVersion,
      reviewItemIds: cappedIds as Prisma.InputJsonValue,
      outcomeSummary: outcome as Prisma.InputJsonValue,
    },
    select: { id: true },
  })
  return created
}

export type ObservabilityCounters = {
  generatedAt: string
  since: string | null
  drilldownByType: Record<CoverageFilter, number>
  reviewedTrueNoise: number
  reviewedFalseNegative: number
  pendingMarkDoneProposals: number
  duplicateContactBlocks: number
  profileFacts: {
    saved: number
    reviewed: number
    dropped: number
  }
}

export async function getCoverageObservabilityCounters(
  options: { since?: Date | string | null } = {},
  client: CoverageDb = db
): Promise<ObservabilityCounters> {
  const since = parseSince(options.since)
  const sinceFilter = since ? { gte: since } : undefined

  const drilldownByType = Object.fromEntries(
    COVERAGE_FILTERS.map((filter) => [filter, 0])
  ) as Record<CoverageFilter, number>

  const drilldownGroups = await client.operationalEmailReview.groupBy({
    by: ["type"],
    where: {
      status: "open",
      ...(sinceFilter ? { createdAt: sinceFilter } : {}),
    },
    _count: { _all: true },
  })
  for (const row of drilldownGroups) {
    if (isCoverageFilter(row.type)) {
      drilldownByType[row.type] = row._count._all
    }
  }

  const [
    reviewedTrueNoise,
    reviewedFalseNegative,
    pendingMarkDoneProposals,
    duplicateContactBlocks,
    profileFactsSaved,
    profileFactsReviewed,
  ] = await Promise.all([
    client.operationalEmailReview.count({
      where: {
        status: "resolved",
        operatorOutcome: "true_noise",
        ...(sinceFilter ? { resolvedAt: sinceFilter } : {}),
      },
    }),
    client.operationalEmailReview.count({
      where: {
        status: "resolved",
        operatorOutcome: "false_negative",
        ...(sinceFilter ? { resolvedAt: sinceFilter } : {}),
      },
    }),
    client.agentAction.count({
      where: {
        actionType: "mark-todo-done",
        status: "pending",
        ...(sinceFilter ? { createdAt: sinceFilter } : {}),
      },
    }),
    client.contactPromotionCandidate.count({
      where: {
        status: { in: ["merged", "rejected", "not_a_contact", "superseded"] },
        ...(sinceFilter ? { updatedAt: sinceFilter } : {}),
      },
    }),
    client.contactProfileFact.count({
      where: {
        status: "active",
        ...(sinceFilter ? { createdAt: sinceFilter } : {}),
      },
    }),
    client.contactProfileFact.count({
      where: {
        status: "review",
        ...(sinceFilter ? { createdAt: sinceFilter } : {}),
      },
    }),
  ])

  return {
    generatedAt: new Date().toISOString(),
    since: since ? since.toISOString() : null,
    drilldownByType,
    reviewedTrueNoise,
    reviewedFalseNegative,
    pendingMarkDoneProposals,
    duplicateContactBlocks,
    profileFacts: {
      saved: profileFactsSaved,
      reviewed: profileFactsReviewed,
      // Dropped facts are filtered out before persistence (see scrub-applier.ts),
      // so the canonical store has no row to count. Surfaced as zero so operators
      // see the column rather than discover its absence later.
      dropped: 0,
    },
  }
}

export type RetainCoverageReviewRowsInput = {
  olderThanDays?: number
  status?: readonly ReviewRetentionStatus[]
  batchSize?: number
  now?: Date
}

export type RetainCoverageReviewRowsResult = {
  scanned: number
  anonymized: number
  boundary: string
  statuses: ReviewRetentionStatus[]
}

export async function retainCoverageReviewRows(
  input: RetainCoverageReviewRowsInput = {},
  client: CoverageDb = db
): Promise<RetainCoverageReviewRowsResult> {
  const olderThanDays = input.olderThanDays ?? COVERAGE_REVIEW_RETENTION_DAYS
  if (!Number.isFinite(olderThanDays) || olderThanDays <= 0) {
    throw new Error("olderThanDays must be a positive number")
  }
  const batchSize = input.batchSize ?? REVIEW_RETENTION_BATCH_DEFAULT
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("batchSize must be a positive integer")
  }
  const now = input.now ?? new Date()
  const boundary = new Date(
    now.getTime() - olderThanDays * 24 * 60 * 60 * 1000
  )
  const statuses = (input.status ?? REVIEW_RETENTION_STATUSES).filter(
    (status): status is ReviewRetentionStatus =>
      REVIEW_RETENTION_STATUSES.includes(status as ReviewRetentionStatus)
  )
  if (statuses.length === 0) {
    return {
      scanned: 0,
      anonymized: 0,
      boundary: boundary.toISOString(),
      statuses: [],
    }
  }

  const candidates = await client.operationalEmailReview.findMany({
    where: {
      status: { in: statuses },
      createdAt: { lt: boundary },
      OR: [
        { operatorNotes: { not: null } },
        { metadata: { not: { equals: {} } } },
      ],
    },
    select: { id: true, type: true, status: true, policyVersion: true },
    take: batchSize,
  })

  let anonymized = 0
  for (const row of candidates) {
    const result = await client.operationalEmailReview.updateMany({
      where: { id: row.id, createdAt: { lt: boundary } },
      data: {
        operatorNotes: null,
        metadata: {
          retained: true,
          type: row.type,
          status: row.status,
          policyVersion: row.policyVersion,
          retainedAt: now.toISOString(),
        } as Prisma.InputJsonValue,
      },
    })
    anonymized += result.count
  }

  return {
    scanned: candidates.length,
    anonymized,
    boundary: boundary.toISOString(),
    statuses: [...statuses],
  }
}

export type RetainCoverageActionAuditLogInput = {
  olderThanDays?: number
  batchSize?: number
  now?: Date
}

export type RetainCoverageActionAuditLogResult = {
  scanned: number
  anonymized: number
  boundary: string
}

export async function retainCoverageActionAuditLog(
  input: RetainCoverageActionAuditLogInput = {},
  client: CoverageDb = db
): Promise<RetainCoverageActionAuditLogResult> {
  const olderThanDays = input.olderThanDays ?? COVERAGE_AUDIT_RETENTION_DAYS
  if (!Number.isFinite(olderThanDays) || olderThanDays <= 0) {
    throw new Error("olderThanDays must be a positive number")
  }
  const batchSize = input.batchSize ?? AUDIT_RETENTION_BATCH_DEFAULT
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("batchSize must be a positive integer")
  }
  const now = input.now ?? new Date()
  const boundary = new Date(
    now.getTime() - olderThanDays * 24 * 60 * 60 * 1000
  )

  const candidates = await client.coverageActionAuditLog.findMany({
    where: {
      createdAt: { lt: boundary },
      anonymizedAt: null,
    },
    select: { id: true, actor: true },
    take: batchSize,
  })

  let anonymized = 0
  for (const row of candidates) {
    const hash = hashActor(row.actor)
    const result = await client.coverageActionAuditLog.updateMany({
      where: { id: row.id, anonymizedAt: null, createdAt: { lt: boundary } },
      data: {
        actor: `anon:${hash.slice(0, 12)}`,
        actorHash: hash,
        anonymizedAt: now,
        reviewItemIds: [] as Prisma.InputJsonValue,
      },
    })
    anonymized += result.count
  }

  return {
    scanned: candidates.length,
    anonymized,
    boundary: boundary.toISOString(),
  }
}

function sanitizeOutcome(
  outcome: CoverageActionAuditOutcome
): CoverageActionAuditOutcome {
  return {
    applied: clampNonNegativeInt(outcome.applied),
    skipped: clampNonNegativeInt(outcome.skipped),
    unsupported: clampNonNegativeInt(outcome.unsupported),
  }
}

function clampNonNegativeInt(value: number): number {
  if (!Number.isFinite(value)) return 0
  const truncated = Math.trunc(value)
  return truncated < 0 ? 0 : truncated
}

function redactActor(actor: string): string {
  // Reviewers are pulled from session.user.name/email — those are operator
  // identifiers, not mailbox content. We still strip control characters so a
  // crafted display name cannot smuggle ANSI escapes into the audit ledger.
  return redactSlug(actor, "actor")
}

function redactSlug(value: string, fallback: string): string {
  if (typeof value !== "string") return fallback
  const stripped = value
    .replace(/[ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!stripped) return fallback
  return stripped.slice(0, 200)
}

function hashActor(actor: string): string {
  return createHash("sha256").update(actor).digest("hex")
}

function parseSince(value: Date | string | null | undefined): Date | null {
  if (value === undefined || value === null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isCoverageFilter(value: unknown): value is CoverageFilter {
  return (
    typeof value === "string" &&
    (COVERAGE_FILTERS as readonly string[]).includes(value)
  )
}
