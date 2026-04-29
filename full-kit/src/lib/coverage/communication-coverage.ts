import { Buffer } from "node:buffer"

import { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

export const COVERAGE_POLICY_VERSION = "coverage-review-v1"

export const COVERAGE_FILTERS = [
  "never_queued",
  "missed_eligible",
  "suspicious_noise",
  "orphaned_context",
  "failed_scrub",
  "stale_queue",
  "pending_mark_done",
] as const

export const COVERAGE_ACTIONS = [
  "mark_true_noise",
  "mark_false_negative",
  "enqueue_scrub",
  "requeue_scrub",
  "snooze",
  "defer",
  "create_contact_candidate",
  "deterministic_link_contact",
] as const

const REVIEW_STATUSES = ["open", "resolved", "snoozed", "ignored"] as const
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 25
const STALE_QUEUE_MS = 24 * 60 * 60 * 1000
const MAX_REASON_LENGTH = 1000
const RUN_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/
const SNOOZE_ACTIONS = new Set(["snooze", "defer"])

export type CoverageFilter = (typeof COVERAGE_FILTERS)[number]
export type CoverageAction = (typeof COVERAGE_ACTIONS)[number]
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export type CoverageDb = typeof db

export type CoverageReviewItemDto = {
  id: string
  communicationId: string
  type: CoverageFilter
  status: ReviewStatus
  coarseDate: string
  subject: string | null
  senderDomain: string | null
  classification: string
  queueState: {
    id: string | null
    status: string | null
    attempts: number | null
    enqueuedAt: string | null
    lockedUntil: string | null
  }
  scrubState: string
  contactState: {
    contactId: string | null
    linked: boolean
  }
  actionState: {
    agentActionId: string | null
    actionType: string | null
    status: string | null
    targetEntity: string | null
  }
  riskScore: number
  reasonCodes: string[]
  reasonKey: string
  recommendedAction: string
  policyVersion: string
  evidenceSnippets: string[]
  createdAt: string
}

export type CoverageReviewItemsResult = {
  items: CoverageReviewItemDto[]
  pageInfo: {
    nextCursor: string | null
    limit: number
    sort: "risk_desc"
  }
}

export type CoverageActionResult = {
  ok: boolean
  dryRun: boolean
  action: CoverageAction
  reviewItemId: string
  status:
    | "would_update"
    | "updated"
    | "would_enqueue"
    | "enqueued"
    | "would_requeue"
    | "requeued"
    | "noop"
    | "unsupported"
  unsupportedReason?: string
  reviewStatus?: ReviewStatus
  scrubQueueId?: string
}

type CursorTuple = {
  riskScore: number
  createdAt: string
  id: string
}

type ReviewItemRow = {
  id: string
  communication_id: string
  review_id: string | null
  review_status: ReviewStatus | null
  review_reason_codes: unknown
  review_reason_key: string | null
  review_recommended_action: string | null
  review_policy_version: string | null
  review_created_at: Date | string | null
  review_snoozed_until: Date | string | null
  date: Date | string
  created_at: Date | string | null
  subject: string | null
  direction: string | null
  contact_id: string | null
  metadata: unknown
  queue_id: string | null
  queue_status: string | null
  queue_attempts: number | null
  queue_enqueued_at: Date | string | null
  queue_locked_until: Date | string | null
  queue_last_error: string | null
  action_id: string | null
  action_type: string | null
  action_status: string | null
  action_target_entity: string | null
  action_summary: string | null
  action_created_at: Date | string | null
  risk_score: number | bigint
  item_created_at: Date | string
}

type ReviewRecord = {
  id: string
  communicationId: string
  emailFilterAuditId?: string | null
  subjectEntityKind?: string | null
  subjectEntityId?: string | null
  agentActionId?: string | null
  type: CoverageFilter
  status: ReviewStatus
  riskScore: number
  reasonCodes: unknown
  reasonKey: string
  dedupeKey: string
  recommendedAction: string
  operatorOutcome?: string | null
  operatorNotes?: string | null
  snoozedUntil?: Date | string | null
  policyVersion: string
  promptVersion?: string | null
  createdFromRunId?: string | null
  resolvedBy?: string | null
  resolvedAt?: Date | string | null
  metadata?: unknown
  createdAt: Date | string
  updatedAt?: Date | string
}

type ReviewDraft = {
  communicationId: string
  emailFilterAuditId?: string | null
  subjectEntityKind?: string | null
  subjectEntityId?: string | null
  agentActionId?: string | null
  type: CoverageFilter
  riskScore: number
  reasonCodes: string[]
  recommendedAction: string
  policyVersion?: string
  promptVersion?: string | null
  createdFromRunId?: string | null
  metadata?: Record<string, unknown>
}

export class CoverageValidationError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
  }
}

export function parseReviewItemsQuery(url: string): {
  filter: CoverageFilter
  cursor: string | null
  limit: number
  sort: "risk_desc"
} {
  const params = new URL(url).searchParams
  const allowed = new Set(["filter", "cursor", "limit", "sort"])
  for (const key of params.keys()) {
    if (!allowed.has(key)) {
      throw new CoverageValidationError(`unknown query parameter: ${key}`)
    }
  }

  const filter = params.get("filter")
  if (!isCoverageFilter(filter)) {
    throw new CoverageValidationError("invalid filter")
  }

  const sort = params.get("sort") ?? "risk_desc"
  if (sort !== "risk_desc") {
    throw new CoverageValidationError("invalid sort")
  }

  const limitParam = params.get("limit")
  const parsedLimit = limitParam
    ? Number.parseInt(limitParam, 10)
    : DEFAULT_LIMIT
  if (
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > MAX_LIMIT
  ) {
    throw new CoverageValidationError("invalid limit")
  }

  const cursor = params.get("cursor")
  if (cursor) decodeCursor(cursor)

  return { filter, cursor, limit: parsedLimit, sort }
}

export async function listCoverageReviewItems(
  input: {
    filter: CoverageFilter
    cursor?: string | null
    limit?: number
  },
  client: CoverageDb = db
): Promise<CoverageReviewItemsResult> {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const cursor = input.cursor ? decodeCursor(input.cursor) : null
  const rows = await client.$queryRaw<ReviewItemRow[]>`
    SELECT *
      FROM (${baseReviewItemsSql(input.filter)}) coverage_items
     ${cursorWhereSql(cursor)}
     ORDER BY risk_score DESC, item_created_at DESC, id DESC
     LIMIT ${limit + 1}
  `
  const pageRows = await materializeReviewRows(
    input.filter,
    rows.slice(0, limit),
    client
  )
  const hasNext = rows.length > limit
  return {
    items: pageRows.map((row) => toReviewItemDto(input.filter, row)),
    pageInfo: {
      nextCursor:
        hasNext && pageRows.length > 0
          ? encodeCursor({
              riskScore: toNumber(pageRows[pageRows.length - 1].risk_score),
              createdAt: toIso(pageRows[pageRows.length - 1].item_created_at),
              id: pageRows[pageRows.length - 1].id,
            })
          : null,
      limit,
      sort: "risk_desc",
    },
  }
}

export function reasonKey(reasonCodes: readonly string[]): string {
  return [...new Set(reasonCodes.map((code) => code.trim()).filter(Boolean))]
    .sort()
    .join("|")
}

export function dedupeKey(input: {
  communicationId: string
  type: CoverageFilter
  reasonKey: string
  subjectEntityKind?: string | null
  subjectEntityId?: string | null
}): string {
  const parts = [input.communicationId, input.type, input.reasonKey]
  if (input.subjectEntityKind && input.subjectEntityId) {
    parts.push(input.subjectEntityKind, input.subjectEntityId)
  }
  return parts.join("|")
}

export function minimizeOperationalReviewMetadata(input: {
  classification?: string | null
  queueStatus?: string | null
  contactId?: string | null
  riskReasonCodes?: readonly string[]
  policyVersion?: string
  promptVersion?: string | null
  evidenceSnippets?: readonly string[]
  coarseDate?: Date | string | null
}): Record<string, unknown> {
  return {
    classification: input.classification ?? "unknown",
    queueStatus: input.queueStatus ?? null,
    contactId: input.contactId ?? null,
    riskReasonCodes: [...(input.riskReasonCodes ?? [])],
    policyVersion: input.policyVersion ?? COVERAGE_POLICY_VERSION,
    promptVersion: input.promptVersion ?? null,
    evidenceSnippets: (input.evidenceSnippets ?? [])
      .map((snippet) => redactText(snippet, 240))
      .filter(Boolean),
    coarseDate: input.coarseDate ? toCoarseDate(input.coarseDate) : null,
  }
}

export async function upsertOperationalEmailReview(
  draft: ReviewDraft,
  client: CoverageDb = db,
  now = new Date()
): Promise<{ review: ReviewRecord | null; skipped: boolean; reason?: string }> {
  const canonicalReasonKey = reasonKey(draft.reasonCodes)
  const canonicalDedupeKey = dedupeKey({
    communicationId: draft.communicationId,
    type: draft.type,
    reasonKey: canonicalReasonKey,
    subjectEntityKind: draft.subjectEntityKind,
    subjectEntityId: draft.subjectEntityId,
  })
  const policyVersion = draft.policyVersion ?? COVERAGE_POLICY_VERSION

  const existing = (await client.operationalEmailReview.findFirst({
    where: { dedupeKey: canonicalDedupeKey },
    orderBy: { createdAt: "desc" },
  })) as ReviewRecord | null

  if (existing?.status === "open") {
    const review = (await client.operationalEmailReview.update({
      where: { id: existing.id },
      data: {
        riskScore: draft.riskScore,
        reasonCodes: [...new Set(draft.reasonCodes)] as Prisma.InputJsonValue,
        recommendedAction: draft.recommendedAction,
        metadata: sanitizeReviewMetadata(draft.metadata),
        policyVersion,
      },
    })) as ReviewRecord
    return { review, skipped: false }
  }

  if (
    existing?.status === "snoozed" &&
    existing.snoozedUntil &&
    new Date(existing.snoozedUntil).getTime() > now.getTime()
  ) {
    return { review: existing, skipped: true, reason: "snoozed" }
  }

  if (
    existing &&
    (existing.status === "ignored" ||
      (existing.status === "resolved" &&
        existing.operatorOutcome === "true_noise")) &&
    existing.policyVersion === policyVersion &&
    existing.reasonKey === canonicalReasonKey
  ) {
    return { review: existing, skipped: true, reason: "terminal_suppressed" }
  }

  try {
    const review = (await client.operationalEmailReview.create({
      data: {
        communicationId: draft.communicationId,
        emailFilterAuditId: draft.emailFilterAuditId ?? null,
        subjectEntityKind: draft.subjectEntityKind ?? null,
        subjectEntityId: draft.subjectEntityId ?? null,
        agentActionId: draft.agentActionId ?? null,
        type: draft.type,
        status: "open",
        riskScore: draft.riskScore,
        reasonCodes: [...new Set(draft.reasonCodes)] as Prisma.InputJsonValue,
        reasonKey: canonicalReasonKey,
        dedupeKey: canonicalDedupeKey,
        recommendedAction: draft.recommendedAction,
        policyVersion,
        promptVersion: draft.promptVersion ?? null,
        createdFromRunId: draft.createdFromRunId ?? null,
        metadata: sanitizeReviewMetadata(draft.metadata),
      },
    })) as ReviewRecord
    return { review, skipped: false }
  } catch (error) {
    if (!isUniqueConflict(error)) throw error
    const review = (await client.operationalEmailReview.findFirst({
      where: { dedupeKey: canonicalDedupeKey },
      orderBy: { createdAt: "desc" },
    })) as ReviewRecord | null
    if (review) return { review, skipped: false }
    throw error
  }
}

export function parseReviewActionPayload(body: unknown): {
  action: CoverageAction
  dryRun: boolean
  runId: string | null
  reason: string | null
  snoozedUntil: Date | null
} {
  if (!isObject(body)) {
    throw new CoverageValidationError("invalid JSON body")
  }
  const allowed = new Set([
    "action",
    "dryRun",
    "runId",
    "reason",
    "snoozedUntil",
  ])
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw new CoverageValidationError(`unknown body key: ${key}`)
    }
  }

  const action = body.action
  if (!isCoverageAction(action)) {
    throw new CoverageValidationError("invalid action")
  }
  if (typeof body.dryRun !== "boolean") {
    throw new CoverageValidationError("dryRun is required")
  }
  const rawRunId =
    typeof body.runId === "string" && body.runId.trim()
      ? body.runId.trim()
      : null
  if (!body.dryRun && !rawRunId) {
    throw new CoverageValidationError("runId is required when dryRun=false")
  }
  if (rawRunId && !RUN_ID_PATTERN.test(rawRunId)) {
    throw new CoverageValidationError("invalid runId")
  }
  const reason =
    typeof body.reason === "string"
      ? sanitizeOperatorNotes(body.reason)
      : null
  let snoozedUntil: Date | null = null
  if (body.snoozedUntil !== undefined) {
    if (!SNOOZE_ACTIONS.has(action)) {
      throw new CoverageValidationError(
        "snoozedUntil only allowed for snooze/defer actions"
      )
    }
    if (typeof body.snoozedUntil !== "string") {
      throw new CoverageValidationError("invalid snoozedUntil")
    }
    snoozedUntil = new Date(body.snoozedUntil)
    if (Number.isNaN(snoozedUntil.getTime())) {
      throw new CoverageValidationError("invalid snoozedUntil")
    }
    if (snoozedUntil.getTime() <= Date.now()) {
      throw new CoverageValidationError("snoozedUntil must be in the future")
    }
  }
  return { action, dryRun: body.dryRun, runId: rawRunId, reason, snoozedUntil }
}

function sanitizeOperatorNotes(value: string): string | null {
  // Strip C0/DEL control characters before length cap so untrusted notes
  // cannot smuggle ANSI escapes or null bytes into the audit trail.
  const stripped = value
    .replace(/[ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!stripped) return null
  return stripped.slice(0, MAX_REASON_LENGTH)
}

export async function applyCoverageReviewAction(
  reviewItemId: string,
  input: {
    action: CoverageAction
    dryRun: boolean
    runId: string | null
    reason: string | null
    snoozedUntil: Date | null
    reviewer: string
  },
  client: CoverageDb = db,
  now = new Date()
): Promise<CoverageActionResult> {
  const review = (await client.operationalEmailReview.findUnique({
    where: { id: reviewItemId },
  })) as ReviewRecord | null
  if (!review) {
    throw new CoverageValidationError("review item not found", 404)
  }
  if (review.status !== "open" && review.status !== "snoozed") {
    return {
      ok: true,
      dryRun: input.dryRun,
      action: input.action,
      reviewItemId,
      status: "noop",
      reviewStatus: review.status,
    }
  }

  if (
    input.action === "create_contact_candidate" ||
    input.action === "deterministic_link_contact"
  ) {
    return {
      ok: true,
      dryRun: input.dryRun,
      action: input.action,
      reviewItemId,
      status: "unsupported",
      unsupportedReason:
        "Contact candidate creation and deterministic contact linking are intentionally deferred to the identity/linking lane.",
      reviewStatus: review.status,
    }
  }

  if (input.dryRun) {
    if (input.runId)
      await rememberDryRun(client, reviewItemId, input.action, input.runId, now)
    return dryRunResult(review, input.action)
  }

  await requirePriorDryRun(client, reviewItemId, input.action, input.runId)

  if (input.action === "mark_true_noise") {
    return runReviewMutation(client, reviewItemId, async (tx) => {
      const updated = await updateOpenReview(tx, reviewItemId, {
        status: "resolved",
        operatorOutcome: "true_noise",
        operatorNotes: input.reason,
        resolvedBy: input.reviewer,
        resolvedAt: now,
      })
      if (!updated) return staleReviewResult(reviewItemId, input.action)
      return updatedResult(reviewItemId, input.action, "resolved")
    })
  }

  if (input.action === "mark_false_negative") {
    return runReviewMutation(client, reviewItemId, async (tx) => {
      const updated = await updateOpenReview(tx, reviewItemId, {
        status: "resolved",
        operatorOutcome: "false_negative",
        operatorNotes: input.reason,
        resolvedBy: input.reviewer,
        resolvedAt: now,
      })
      if (!updated) return staleReviewResult(reviewItemId, input.action)
      return updatedResult(reviewItemId, input.action, "resolved")
    })
  }

  if (input.action === "snooze" || input.action === "defer") {
    const snoozedUntil =
      input.snoozedUntil ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return runReviewMutation(client, reviewItemId, async (tx) => {
      const updated = await updateOpenReview(tx, reviewItemId, {
        status: "snoozed",
        snoozedUntil,
        operatorOutcome: input.action,
        operatorNotes: input.reason,
      })
      if (!updated) return staleReviewResult(reviewItemId, input.action)
      return updatedResult(reviewItemId, input.action, "snoozed")
    })
  }

  if (input.action === "enqueue_scrub" || input.action === "requeue_scrub") {
    return runReviewMutation(client, reviewItemId, async (tx) => {
      const updated = await updateOpenReview(tx, reviewItemId, {
        status: "resolved",
        operatorOutcome: input.action,
        operatorNotes: input.reason,
        resolvedBy: input.reviewer,
        resolvedAt: now,
      })
      if (!updated) return staleReviewResult(reviewItemId, input.action)
      const queue = await upsertScrubQueue(tx, review.communicationId)
      return {
        ok: true,
        dryRun: false,
        action: input.action,
        reviewItemId,
        status: input.action === "enqueue_scrub" ? "enqueued" : "requeued",
        reviewStatus: "resolved",
        scrubQueueId: queue.id,
      }
    })
  }

  return {
    ok: true,
    dryRun: false,
    action: input.action,
    reviewItemId,
    status: "noop",
    reviewStatus: review.status,
  }
}

async function updateOpenReview(
  client: CoverageDb,
  reviewItemId: string,
  data: Prisma.OperationalEmailReviewUpdateManyMutationInput
): Promise<boolean> {
  const result = await client.operationalEmailReview.updateMany({
    where: { id: reviewItemId, status: { in: ["open", "snoozed"] } },
    data,
  })
  return result.count === 1
}

async function runReviewMutation<T>(
  client: CoverageDb,
  reviewItemId: string,
  fn: (tx: CoverageDb) => Promise<T>
): Promise<T> {
  return client.$transaction(async (tx) => {
    // Acquire a SELECT FOR UPDATE row lock so concurrent reviewer mutations
    // serialize on this review item; tests that mock $queryRaw simply skip
    // the lock and rely on updateMany status guards.
    if (typeof tx.$queryRaw === "function") {
      try {
        await tx.$queryRaw`SELECT id FROM operational_email_reviews WHERE id = ${reviewItemId} FOR UPDATE`
      } catch {
        // Lock acquisition failures fall through to the status-guarded
        // updateMany; we never silently widen access on lock errors.
      }
    }
    return fn(tx as CoverageDb)
  })
}

function baseReviewItemsSql(filter: CoverageFilter): Prisma.Sql {
  return Prisma.sql`
    SELECT
      COALESCE(oer.id, c.id) AS id,
      c.id AS communication_id,
      oer.id AS review_id,
      oer.status::text AS review_status,
      oer.reason_codes AS review_reason_codes,
      oer.reason_key AS review_reason_key,
      oer.recommended_action AS review_recommended_action,
      oer.policy_version AS review_policy_version,
      oer.created_at AS review_created_at,
      oer.snoozed_until AS review_snoozed_until,
      c.date,
      c."createdAt" AS created_at,
      c.subject,
      c.direction::text AS direction,
      c.contact_id,
      c.metadata,
      sq.id AS queue_id,
      sq.status::text AS queue_status,
      sq.attempts AS queue_attempts,
      sq.enqueued_at AS queue_enqueued_at,
      sq.locked_until AS queue_locked_until,
      sq.last_error AS queue_last_error,
      aa.id AS action_id,
      aa.action_type AS action_type,
      aa.status::text AS action_status,
      aa.target_entity AS action_target_entity,
      aa.summary AS action_summary,
      aa."createdAt" AS action_created_at,
      ${riskScoreSql(filter)} AS risk_score,
      COALESCE(oer.created_at, aa."createdAt", c."createdAt", c.date) AS item_created_at
    FROM communications c
    LEFT JOIN scrub_queue sq ON sq.communication_id = c.id
    LEFT JOIN agent_actions aa
      ON aa.source_communication_id = c.id
     AND aa.status::text = 'pending'
     AND aa.action_type = 'mark-todo-done'
    LEFT JOIN operational_email_reviews oer
      ON oer.communication_id = c.id
     AND oer.type::text = ${filter}
     AND oer.status::text IN ('open', 'snoozed')
    WHERE c.channel::text = 'email'
      AND ${filterWhereSql(filter)}
  `
}

async function materializeReviewRows(
  filter: CoverageFilter,
  rows: ReviewItemRow[],
  client: CoverageDb
): Promise<ReviewItemRow[]> {
  const materializedRows: ReviewItemRow[] = []
  for (const row of rows) {
    if (row.review_id) {
      materializedRows.push(row)
      continue
    }
    const draft = reviewDraftFromRow(filter, row)
    const result = await upsertOperationalEmailReview(draft, client)
    if (!result.review) continue
    if (result.skipped && result.reason === "terminal_suppressed") continue
    row.id = result.review.id
    row.review_id = result.review.id
    row.review_status = result.review.status
    row.review_reason_codes = result.review.reasonCodes
    row.review_reason_key = result.review.reasonKey
    row.review_recommended_action = result.review.recommendedAction
    row.review_policy_version = result.review.policyVersion
    row.review_created_at = result.review.createdAt
    row.review_snoozed_until = result.review.snoozedUntil ?? null
    row.item_created_at = result.review.createdAt
    materializedRows.push(row)
  }
  return materializedRows
}

function reviewDraftFromRow(
  filter: CoverageFilter,
  row: ReviewItemRow
): ReviewDraft {
  const metadata = isObject(row.metadata) ? row.metadata : {}
  const classification = readString(metadata, "classification") ?? "unknown"
  const reasons = inferReasonCodes(filter, row, classification)
  const subjectEntity =
    filter === "pending_mark_done" &&
    row.action_target_entity?.startsWith("todo:")
      ? row.action_target_entity.slice("todo:".length)
      : null
  return {
    communicationId: row.communication_id,
    type: filter,
    riskScore: toNumber(row.risk_score),
    reasonCodes: reasons,
    recommendedAction: recommendedAction(filter),
    agentActionId: row.action_id,
    subjectEntityKind: subjectEntity ? "todo" : null,
    subjectEntityId: subjectEntity,
    metadata: minimizeOperationalReviewMetadata({
      classification,
      queueStatus: row.queue_status,
      contactId: row.contact_id,
      riskReasonCodes: reasons,
      policyVersion: COVERAGE_POLICY_VERSION,
      evidenceSnippets: inferEvidenceSnippets(row),
      coarseDate: row.date,
    }),
  }
}

function filterWhereSql(filter: CoverageFilter): Prisma.Sql {
  switch (filter) {
    case "never_queued":
      return Prisma.sql`sq.id IS NULL`
    case "missed_eligible":
      return Prisma.sql`sq.id IS NULL AND COALESCE(c.metadata->>'classification', 'unclassified') <> 'noise'`
    case "suspicious_noise":
      return Prisma.sql`
        COALESCE(c.metadata->>'classification', '') = 'noise'
        AND (
          c.contact_id IS NOT NULL
          OR c.direction::text = 'inbound'
          OR c.subject ILIKE '%lease%'
          OR c.subject ILIKE '%tenant%'
          OR c.subject ILIKE '%offer%'
          OR c.subject ILIKE '%property%'
          OR c.subject ILIKE '%deal%'
        )
      `
    case "orphaned_context":
      return Prisma.sql`
        c.contact_id IS NULL
        AND COALESCE(c.metadata->>'classification', 'unclassified') IN ('signal', 'uncertain')
      `
    case "failed_scrub":
      return Prisma.sql`sq.status::text = 'failed'`
    case "stale_queue":
      return Prisma.sql`
        sq.status::text IN ('pending', 'in_flight')
        AND COALESCE(sq.locked_until, sq.enqueued_at) < ${new Date(Date.now() - STALE_QUEUE_MS)}
      `
    case "pending_mark_done":
      return Prisma.sql`aa.id IS NOT NULL`
  }
}

function riskScoreSql(filter: CoverageFilter): Prisma.Sql {
  switch (filter) {
    case "suspicious_noise":
      return Prisma.sql`
        (
          CASE WHEN c.contact_id IS NOT NULL THEN 30 ELSE 0 END +
          CASE WHEN c.direction::text = 'inbound' THEN 15 ELSE 0 END +
          CASE WHEN c.subject ILIKE '%lease%' OR c.subject ILIKE '%tenant%' OR c.subject ILIKE '%offer%' OR c.subject ILIKE '%property%' OR c.subject ILIKE '%deal%' THEN 20 ELSE 0 END
        )`
    case "missed_eligible":
      return Prisma.sql`
        CASE COALESCE(c.metadata->>'classification', 'unclassified')
          WHEN 'signal' THEN 90
          WHEN 'uncertain' THEN 70
          ELSE 50
        END`
    case "orphaned_context":
      return Prisma.sql`75`
    case "failed_scrub":
      return Prisma.sql`80 + LEAST(COALESCE(sq.attempts, 0), 10)`
    case "stale_queue":
      return Prisma.sql`65`
    case "pending_mark_done":
      return Prisma.sql`60`
    case "never_queued":
      return Prisma.sql`45`
  }
}

function cursorWhereSql(cursor: CursorTuple | null): Prisma.Sql {
  if (!cursor) return Prisma.empty
  return Prisma.sql`
    WHERE (
      risk_score < ${cursor.riskScore}
      OR (risk_score = ${cursor.riskScore} AND item_created_at < ${new Date(cursor.createdAt)})
      OR (risk_score = ${cursor.riskScore} AND item_created_at = ${new Date(cursor.createdAt)} AND id < ${cursor.id})
    )
  `
}

function toReviewItemDto(
  filter: CoverageFilter,
  row: ReviewItemRow
): CoverageReviewItemDto {
  const metadata = isObject(row.metadata) ? row.metadata : {}
  const classification = readString(metadata, "classification") ?? "unknown"
  const reasonCodes = row.review_reason_key
    ? toStringArray(row.review_reason_codes)
    : inferReasonCodes(filter, row, classification)
  const canonicalReasonKey = row.review_reason_key ?? reasonKey(reasonCodes)
  const senderEmail = extractSenderEmail(metadata)
  return {
    id: row.review_id ?? row.id,
    communicationId: row.communication_id,
    type: filter,
    status: row.review_status ?? "open",
    coarseDate: toCoarseDate(row.date),
    subject: redactText(row.subject, 160),
    senderDomain: senderEmail ? (senderEmail.split("@")[1] ?? null) : null,
    classification,
    queueState: {
      id: row.queue_id,
      status: row.queue_status,
      attempts: row.queue_attempts,
      enqueuedAt: row.queue_enqueued_at ? toIso(row.queue_enqueued_at) : null,
      lockedUntil: row.queue_locked_until
        ? toIso(row.queue_locked_until)
        : null,
    },
    scrubState: metadata.scrub ? "scrubbed" : "unscrubbed",
    contactState: {
      contactId: row.contact_id,
      linked: Boolean(row.contact_id),
    },
    actionState: {
      agentActionId: row.action_id,
      actionType: row.action_type,
      status: row.action_status,
      targetEntity: row.action_target_entity,
    },
    riskScore: toNumber(row.risk_score),
    reasonCodes,
    reasonKey: canonicalReasonKey,
    recommendedAction:
      row.review_recommended_action ?? recommendedAction(filter),
    policyVersion: row.review_policy_version ?? COVERAGE_POLICY_VERSION,
    evidenceSnippets: inferEvidenceSnippets(row)
      .map((snippet) => redactText(snippet, 240))
      .filter((snippet): snippet is string => Boolean(snippet)),
    createdAt: toIso(row.item_created_at),
  }
}

function inferReasonCodes(
  filter: CoverageFilter,
  row: ReviewItemRow,
  classification: string
): string[] {
  switch (filter) {
    case "never_queued":
      return ["signal", "uncertain", "unclassified"].includes(classification)
        ? [`${classification}_without_queue`]
        : ["signal_without_queue"]
    case "missed_eligible":
      return classification === "uncertain"
        ? ["uncertain_without_queue"]
        : classification === "unknown" || classification === "unclassified"
          ? ["unclassified_without_queue"]
          : ["signal_without_queue"]
    case "suspicious_noise": {
      const reasons = []
      if (row.contact_id) reasons.push("noise_known_contact_signal")
      if (row.direction === "inbound") reasons.push("noise_direct_to_matt")
      if (
        String(row.subject ?? "").match(/lease|tenant|offer|property|deal/i)
      ) {
        reasons.push("noise_cre_terms")
      }
      return reasons.length ? reasons : ["noise_active_thread"]
    }
    case "orphaned_context":
      return ["orphaned_signal"]
    case "failed_scrub":
      return ["failed_queue_old"]
    case "stale_queue":
      return ["in_flight_stale"]
    case "pending_mark_done":
      return ["pending_mark_done"]
  }
}

function recommendedAction(filter: CoverageFilter): string {
  switch (filter) {
    case "suspicious_noise":
      return "review_noise_classification"
    case "missed_eligible":
    case "never_queued":
    case "failed_scrub":
    case "stale_queue":
      return "enqueue_or_requeue_scrub"
    case "orphaned_context":
      return "review_contact_linkage"
    case "pending_mark_done":
      return "review_todo_completion"
  }
}

function inferEvidenceSnippets(row: ReviewItemRow): string[] {
  const snippets = []
  if (row.subject) snippets.push(`Subject: ${row.subject}`)
  if (row.queue_last_error)
    snippets.push(`Queue error: ${row.queue_last_error}`)
  if (row.action_summary) snippets.push(`Pending action: ${row.action_summary}`)
  return snippets
}

function sanitizeReviewMetadata(metadata: unknown): Prisma.InputJsonValue {
  if (!isObject(metadata)) return {}
  const allowedKeys = new Set([
    "classification",
    "queueStatus",
    "contactId",
    "riskReasonCodes",
    "policyVersion",
    "promptVersion",
    "evidenceSnippets",
    "coarseDate",
    "scrubState",
  ])
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (!allowedKeys.has(key)) continue
    if (key === "evidenceSnippets" && Array.isArray(value)) {
      output[key] = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => redactText(item, 240))
      continue
    }
    output[key] = value
  }
  return output as Prisma.InputJsonValue
}

function extractSenderEmail(metadata: Record<string, unknown>): string | null {
  const candidates = [
    metadata.from,
    metadata.sender,
    metadata.emailAddress,
    metadata.senderEmail,
    metadata.fromEmail,
  ]
  for (const candidate of candidates) {
    const email = readEmailCandidate(candidate)
    if (email) return email.toLowerCase()
  }
  return null
}

function readEmailCandidate(value: unknown): string | null {
  if (typeof value === "string" && value.includes("@")) return value.trim()
  if (!isObject(value)) return null
  const direct = readString(value, "address") ?? readString(value, "email")
  if (direct?.includes("@")) return direct.trim()
  const emailAddress = value.emailAddress
  if (isObject(emailAddress)) {
    const nested = readString(emailAddress, "address")
    if (nested?.includes("@")) return nested.trim()
  }
  return null
}

function readString(
  value: Record<string, unknown>,
  key: string
): string | null {
  const candidate = value[key]
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null
}

function redactText(
  value: string | null | undefined,
  maxLength: number
): string | null {
  if (!value) return null
  const withoutUrls = value.replace(/https?:\/\/\S+/gi, "[redacted-url]")
  const withoutTokens = withoutUrls.replace(
    /\b[A-Za-z0-9_-]{24,}\b/g,
    "[redacted-token]"
  )
  const normalized = withoutTokens.replace(/\s+/g, " ").trim()
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function encodeCursor(cursor: CursorTuple): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

function decodeCursor(value: string): CursorTuple {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (
      !isObject(parsed) ||
      typeof parsed.riskScore !== "number" ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      Number.isNaN(new Date(parsed.createdAt).getTime())
    ) {
      throw new Error("invalid cursor")
    }
    return parsed as CursorTuple
  } catch {
    throw new CoverageValidationError("invalid cursor")
  }
}

function isCoverageFilter(value: unknown): value is CoverageFilter {
  return (
    typeof value === "string" &&
    COVERAGE_FILTERS.includes(value as CoverageFilter)
  )
}

function isCoverageAction(value: unknown): value is CoverageAction {
  return (
    typeof value === "string" &&
    COVERAGE_ACTIONS.includes(value as CoverageAction)
  )
}

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return (
    typeof value === "string" && REVIEW_STATUSES.includes(value as ReviewStatus)
  )
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toIso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString()
}

function toCoarseDate(value: Date | string): string {
  return toIso(value).slice(0, 10)
}

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: string }).code === "P2002" ||
      (error as { code?: string }).code === "23505")
  )
}

async function rememberDryRun(
  client: CoverageDb,
  reviewItemId: string,
  action: CoverageAction,
  runId: string,
  now: Date
) {
  await client.systemState.upsert({
    where: { key: dryRunKey(reviewItemId, action, runId) },
    create: {
      key: dryRunKey(reviewItemId, action, runId),
      value: { reviewItemId, action, runId, at: now.toISOString() },
    },
    update: {
      value: { reviewItemId, action, runId, at: now.toISOString() },
    },
  })
}

async function requirePriorDryRun(
  client: CoverageDb,
  reviewItemId: string,
  action: CoverageAction,
  runId: string | null
) {
  if (!runId)
    throw new CoverageValidationError("runId is required when dryRun=false")
  const row = await client.systemState.findUnique({
    where: { key: dryRunKey(reviewItemId, action, runId) },
  })
  if (!row) {
    throw new CoverageValidationError("dry run required before write")
  }
}

function dryRunKey(
  reviewItemId: string,
  action: CoverageAction,
  runId: string
): string {
  return `coverage-review-action-dry-run:${runId}:${reviewItemId}:${action}`
}

function dryRunResult(
  review: ReviewRecord,
  action: CoverageAction
): CoverageActionResult {
  if (action === "enqueue_scrub") {
    return {
      ok: true,
      dryRun: true,
      action,
      reviewItemId: review.id,
      status: "would_enqueue",
      reviewStatus: review.status,
    }
  }
  if (action === "requeue_scrub") {
    return {
      ok: true,
      dryRun: true,
      action,
      reviewItemId: review.id,
      status: "would_requeue",
      reviewStatus: review.status,
    }
  }
  return {
    ok: true,
    dryRun: true,
    action,
    reviewItemId: review.id,
    status: "would_update",
    reviewStatus: review.status,
  }
}

function updatedResult(
  reviewItemId: string,
  action: CoverageAction,
  reviewStatus: ReviewStatus
): CoverageActionResult {
  return {
    ok: true,
    dryRun: false,
    action,
    reviewItemId,
    status: "updated",
    reviewStatus,
  }
}

function staleReviewResult(
  reviewItemId: string,
  action: CoverageAction
): CoverageActionResult {
  return {
    ok: true,
    dryRun: false,
    action,
    reviewItemId,
    status: "noop",
    reviewStatus: "resolved",
  }
}

async function upsertScrubQueue(
  client: CoverageDb,
  communicationId: string
): Promise<{ id: string }> {
  const existing = await client.scrubQueue.findUnique({
    where: { communicationId },
    select: { id: true },
  })
  if (existing) {
    await client.scrubQueue.update({
      where: { id: existing.id },
      data: {
        status: "pending",
        lockedUntil: null,
        leaseToken: null,
        lastError: null,
      },
    })
    return existing
  }
  return client.scrubQueue.create({
    data: { communicationId, status: "pending" },
    select: { id: true },
  })
}
