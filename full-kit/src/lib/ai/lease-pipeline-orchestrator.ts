import "server-only"

import type { ClientType, Prisma } from "@prisma/client"
import { Prisma as PrismaNS } from "@prisma/client"

import { db } from "@/lib/prisma"
import {
  assertWithinScrubBudget,
  ScrubBudgetError,
} from "@/lib/ai/budget-tracker"
import {
  CLOSED_DEAL_CLASSIFIER_VERSION,
  runClosedDealClassifier,
} from "@/lib/ai/closed-deal-classifier"
import {
  LEASE_EXTRACTOR_VERSION,
  runLeaseExtraction,
} from "@/lib/ai/lease-extractor"
import type {
  ClosedDealClassification,
  LeaseExtraction,
} from "@/lib/ai/lease-types"
import { getAutomationSettings } from "@/lib/system-state/automation-settings"

/**
 * Lease pipeline orchestrator.
 *
 * Connects the Stage-1 closed-deal classifier and the Stage-2 lease/sale
 * extractor to the persistence layer. Per-Communication entry point
 * (`processCommunicationForLease`) and a backlog driver
 * (`processBacklogClosedDeals`) for the historical sweep.
 *
 * Idempotent: if a Communication already carries a
 * `metadata.closedDealClassification` matching the current classifier
 * version, the orchestrator short-circuits before any AI call. The
 * `LeaseRecord` upsert keys on contact + property + lease-start (or
 * contact + close-date for sales), so re-running on the same Communication
 * produces no duplicate rows.
 *
 * Side effects:
 * - Stamps `Communication.metadata.closedDealClassification` and (on
 *   low-confidence extractions) `Communication.metadata.leaseExtractionAttempt`.
 * - Find-or-creates a `Contact` (email-first, name-fallback).
 * - Looks up a `Property` via `computePropertyKey()` against
 *   `propertyKey`; tolerates a missing property and writes
 *   `LeaseRecord.propertyId = null`.
 * - Upserts a `LeaseRecord` and (when applicable) a single
 *   `lease_renewal` `CalendarEvent`.
 * - Updates `Contact.clientType` to the appropriate active/past role.
 *
 * NOT in scope:
 * - Creating a `Deal` row (the LeaseRecord is the canonical artifact for
 *   backfilled history; live deal flow goes through the Deal pipeline).
 * - Sending any external email or notification.
 */

import { findOrCreateContactForLease } from "@/lib/contacts/find-or-create-for-lease"
import { findPropertyForLease } from "@/lib/properties/find-for-lease"
import {
  nextClientTypeForLease,
  type LeaseLifecycleInput,
} from "@/lib/contacts/lease-role-lifecycle"

export type ProcessLeaseResult =
  | {
      ok: true
      leaseRecordId: string
      calendarEventId: string | null
      contactId: string
      propertyId: string | null
      classification: ClosedDealClassification
      extraction: LeaseExtraction
      contactClientTypeChanged: boolean
    }
  | {
      ok: false
      reason:
        | "already_processed"
        | "classifier_failed"
        | "not_a_closed_deal"
        | "extractor_failed"
        | "low_confidence"
      details?: string
    }

export interface ProcessLeaseOptions {
  /** Inject classifier for tests. Falls back to the production runner. */
  runClosedDealClassifierFn?: typeof runClosedDealClassifier
  /** Inject extractor for tests. Falls back to the production runner. */
  runLeaseExtractionFn?: typeof runLeaseExtraction
  /** Override "now" for past-vs-future close-date determinations. Tests only. */
  now?: Date
  /** Override the automation settings snapshot (skips a DB read in tests). */
  settings?: { leaseExtractorMinConfidence: number }
}

const ORCHESTRATOR_CREATED_BY = "lease-pipeline-orchestrator"

function isPastDate(d: Date | null, now: Date): boolean {
  if (!d) return false
  return d.getTime() < now.getTime()
}

function parseIsoDate(iso: string | null): Date | null {
  if (!iso) return null
  // Use a UTC midnight anchor so comparisons against `new Date()` are
  // deterministic across timezones.
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

/**
 * Read the current `metadata.closedDealClassification.version` (if any)
 * without requiring the caller to widen Prisma's `JsonValue` type for us.
 */
function existingClassificationVersion(
  metadata: Prisma.JsonValue | null | undefined
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  const m = metadata as Record<string, unknown>
  const slot = m.closedDealClassification
  if (!slot || typeof slot !== "object" || Array.isArray(slot)) return null
  const v = (slot as Record<string, unknown>).version
  return typeof v === "string" ? v : null
}

/**
 * Merge a fresh stamp into the existing metadata blob. Always returns a
 * fresh plain object so Prisma stores it as a `JsonObject`.
 */
function mergeMetadata(
  existing: Prisma.JsonValue | null | undefined,
  patch: Record<string, unknown>
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {}
  return { ...base, ...patch } as Prisma.InputJsonValue
}

/**
 * Turn an extractor result into the deterministic find-key for the
 * LeaseRecord upsert. Leases key on (contactId, propertyId, leaseStartDate);
 * sales key on (contactId, closeDate). When the date dimension is missing,
 * we fall back to (contactId, sourceCommunicationId) so the create remains
 * idempotent on retry of the same Communication.
 */
function buildLeaseRecordWhere(args: {
  contactId: string
  propertyId: string | null
  extraction: LeaseExtraction
  sourceCommunicationId: string
  leaseStartDate: Date | null
  closeDate: Date | null
}): Prisma.LeaseRecordWhereInput {
  const { contactId, propertyId, extraction, sourceCommunicationId } = args
  const where: Prisma.LeaseRecordWhereInput = {
    contactId,
    archivedAt: null,
    dealKind: extraction.dealKind,
  }
  if (extraction.dealKind === "lease") {
    where.propertyId = propertyId
    if (args.leaseStartDate) {
      where.leaseStartDate = args.leaseStartDate
    } else {
      // No leaseStartDate — guard with sourceCommunicationId so we don't
      // mistakenly consider an unrelated lease for the same contact/property
      // as a duplicate.
      where.sourceCommunicationId = sourceCommunicationId
    }
  } else {
    if (args.closeDate) {
      where.closeDate = args.closeDate
    } else {
      where.sourceCommunicationId = sourceCommunicationId
    }
  }
  return where
}

/**
 * Process one Communication end-to-end. Returns `{ok: false, reason}` for
 * any non-success path so the backlog driver can aggregate stats; throws
 * only on infrastructure errors (DB, AI provider exceptions that escape
 * the inner runners).
 */
export async function processCommunicationForLease(
  communicationId: string,
  options: ProcessLeaseOptions = {}
): Promise<ProcessLeaseResult> {
  const classifierFn = options.runClosedDealClassifierFn ?? runClosedDealClassifier
  const extractorFn = options.runLeaseExtractionFn ?? runLeaseExtraction
  const now = options.now ?? new Date()

  const settings =
    options.settings ?? (await getAutomationSettings())

  const comm = await db.communication.findUnique({
    where: { id: communicationId },
    select: { id: true, metadata: true },
  })
  if (!comm) {
    return { ok: false, reason: "classifier_failed", details: "missing_communication" }
  }

  const stampedVersion = existingClassificationVersion(comm.metadata)
  if (stampedVersion === CLOSED_DEAL_CLASSIFIER_VERSION) {
    return { ok: false, reason: "already_processed" }
  }

  // Stage 1 — classifier
  const classifierOutcome = await classifierFn(communicationId)
  if (!classifierOutcome.ok) {
    return {
      ok: false,
      reason: "classifier_failed",
      details: classifierOutcome.reason,
    }
  }

  // Always stamp the classifier outcome onto metadata, regardless of class
  // (so backlog reruns short-circuit and so audits can see what was
  // detected even on negatives).
  const classificationStamp = {
    version: CLOSED_DEAL_CLASSIFIER_VERSION,
    classification: classifierOutcome.result.classification,
    confidence: classifierOutcome.result.confidence,
    signals: classifierOutcome.result.signals,
    runAt: now.toISOString(),
    modelUsed: classifierOutcome.modelUsed,
  }
  await db.communication.update({
    where: { id: communicationId },
    data: {
      metadata: mergeMetadata(comm.metadata, {
        closedDealClassification: classificationStamp,
      }),
    },
  })

  const classification = classifierOutcome.result.classification
  if (classification !== "closed_lease" && classification !== "closed_sale") {
    return { ok: false, reason: "not_a_closed_deal", details: classification }
  }

  // Stage 2 — extractor
  const extractorOutcome = await extractorFn(communicationId, classification, {
    signals: classifierOutcome.result.signals,
  })
  if (!extractorOutcome.ok) {
    // Stamp the failed-extraction attempt so the backlog driver doesn't
    // re-pick this Communication. Phase 2 PDF fallback reads this stamp.
    // Preserve any pre-existing unrelated metadata.
    await db.communication.update({
      where: { id: communicationId },
      data: {
        metadata: mergeMetadata(comm.metadata, {
          closedDealClassification: classificationStamp,
          leaseExtractionAttempt: {
            version: LEASE_EXTRACTOR_VERSION,
            failedReason: extractorOutcome.reason,
            details: extractorOutcome.details ?? null,
            runAt: now.toISOString(),
          },
        }),
      },
    })
    return {
      ok: false,
      reason: "extractor_failed",
      details: extractorOutcome.reason,
    }
  }

  const extraction = extractorOutcome.result
  if (extraction.confidence < settings.leaseExtractorMinConfidence) {
    await db.communication.update({
      where: { id: communicationId },
      data: {
        metadata: mergeMetadata(comm.metadata, {
          closedDealClassification: classificationStamp,
          leaseExtractionAttempt: {
            version: LEASE_EXTRACTOR_VERSION,
            failedReason: "low_confidence",
            confidence: extraction.confidence,
            threshold: settings.leaseExtractorMinConfidence,
            runAt: now.toISOString(),
          },
        }),
      },
    })
    return { ok: false, reason: "low_confidence" }
  }

  // Persistence — single transaction.
  const closeDate = parseIsoDate(extraction.closeDate)
  const leaseStartDate = parseIsoDate(extraction.leaseStartDate)
  const leaseEndDate = parseIsoDate(extraction.leaseEndDate)

  const persisted = await db.$transaction(async (tx) => {
    const contact = await findOrCreateContactForLease(
      {
        contactName: extraction.contactName,
        contactEmail: extraction.contactEmail,
        dealKind: extraction.dealKind,
        mattRepresented: extraction.mattRepresented,
      },
      tx
    )

    const property = await findPropertyForLease(
      { propertyAddress: extraction.propertyAddress },
      tx
    )
    const propertyId = property?.id ?? null

    const where = buildLeaseRecordWhere({
      contactId: contact.id,
      propertyId,
      extraction,
      sourceCommunicationId: communicationId,
      leaseStartDate,
      closeDate,
    })

    const existingLease = await tx.leaseRecord.findFirst({
      where,
      select: { id: true },
    })

    const leaseData = {
      contactId: contact.id,
      propertyId,
      sourceCommunicationId: communicationId,
      closeDate,
      leaseStartDate,
      leaseEndDate,
      leaseTermMonths: extraction.leaseTermMonths,
      rentAmount:
        extraction.rentAmount != null
          ? new PrismaNS.Decimal(extraction.rentAmount)
          : null,
      rentPeriod: extraction.rentPeriod,
      mattRepresented: extraction.mattRepresented,
      dealKind: extraction.dealKind,
      extractionConfidence: new PrismaNS.Decimal(extraction.confidence),
      createdBy: ORCHESTRATOR_CREATED_BY,
    } satisfies Prisma.LeaseRecordUncheckedCreateInput

    let leaseRecordId: string
    if (existingLease) {
      const updated = await tx.leaseRecord.update({
        where: { id: existingLease.id },
        data: leaseData,
        select: { id: true },
      })
      leaseRecordId = updated.id
    } else {
      const created = await tx.leaseRecord.create({
        data: leaseData,
        select: { id: true },
      })
      leaseRecordId = created.id
    }

    // Calendar event for lease renewal — only if there's a future end date.
    let calendarEventId: string | null = null
    if (leaseEndDate && leaseEndDate.getTime() > now.getTime()) {
      const existingEvent = await tx.calendarEvent.findFirst({
        where: {
          leaseRecordId,
          eventKind: "lease_renewal",
        },
        select: { id: true },
      })
      const title = `Lease renewal — ${extraction.contactName}${
        extraction.propertyAddress ? ` (${extraction.propertyAddress})` : ""
      }`
      const eventData: Prisma.CalendarEventUncheckedCreateInput = {
        title,
        startDate: leaseEndDate,
        allDay: true,
        eventKind: "lease_renewal",
        contactId: contact.id,
        propertyId,
        leaseRecordId,
        source: "system",
        status: "upcoming",
        createdBy: ORCHESTRATOR_CREATED_BY,
      }
      if (existingEvent) {
        const updated = await tx.calendarEvent.update({
          where: { id: existingEvent.id },
          data: eventData,
          select: { id: true },
        })
        calendarEventId = updated.id
      } else {
        const created = await tx.calendarEvent.create({
          data: eventData,
          select: { id: true },
        })
        calendarEventId = created.id
      }
    }

    // Contact lifecycle. We compute purely from this lease (not the full
    // Deal portfolio — orchestrator backfill rows don't necessarily have a
    // Deal). syncContactRoleFromDeals can override later when a Deal lands.
    const lifecycleInput: LeaseLifecycleInput = {
      dealKind: extraction.dealKind,
      mattRepresented: extraction.mattRepresented,
      closeDate,
      now,
    }
    const desiredRole = nextClientTypeForLease(lifecycleInput)
    let contactClientTypeChanged = false
    if (desiredRole && desiredRole !== contact.clientType) {
      await tx.contact.update({
        where: { id: contact.id },
        data: { clientType: desiredRole as ClientType },
      })
      contactClientTypeChanged = true
    }

    return {
      leaseRecordId,
      calendarEventId,
      contactId: contact.id,
      propertyId,
      contactClientTypeChanged,
    }
  })

  return {
    ok: true,
    classification: classifierOutcome.result,
    extraction,
    ...persisted,
  }
}

// ---------------------------------------------------------------------------
// Backlog driver
// ---------------------------------------------------------------------------

export interface BacklogOpts {
  /** Communications per query batch. Default 50. */
  batchSize?: number
  /** Throttle between Communications, ms. Default 250. */
  throttleMs?: number
  /** Cap on how many batches we'll run. Default Infinity. */
  maxBatches?: number
  /** SystemState row key for the cursor. Default "closed-deal-backlog-cursor". */
  cursorKey?: string
  /**
   * Inject for tests. Defaults to `processCommunicationForLease`.
   */
  processFn?: (
    commId: string,
    options?: ProcessLeaseOptions
  ) => Promise<ProcessLeaseResult>
  /**
   * Inject for tests. Defaults to `assertWithinScrubBudget`.
   */
  assertBudgetFn?: () => Promise<void>
  /**
   * Sleep used for throttling. Tests inject a no-op to avoid real waits.
   */
  sleepFn?: (ms: number) => Promise<void>
}

export interface BacklogResult {
  processed: number
  leaseRecordsCreated: number
  errors: { communicationId: string; message: string }[]
  stoppedReason: "complete" | "budget" | "max_batches" | "error"
  cursor: BacklogCursor | null
}

export interface BacklogCursor {
  lastProcessedCommunicationId: string | null
  lastProcessedReceivedAt: string | null
}

const DEFAULT_BACKLOG_KEY = "closed-deal-backlog-cursor"

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadBacklogCursor(key: string): Promise<BacklogCursor | null> {
  const row = await db.systemState.findUnique({ where: { key } })
  const v = row?.value
  if (!v || typeof v !== "object" || Array.isArray(v)) return null
  const r = v as Record<string, unknown>
  const id =
    typeof r.lastProcessedCommunicationId === "string"
      ? r.lastProcessedCommunicationId
      : null
  const at =
    typeof r.lastProcessedReceivedAt === "string"
      ? r.lastProcessedReceivedAt
      : null
  return { lastProcessedCommunicationId: id, lastProcessedReceivedAt: at }
}

async function persistBacklogCursor(
  key: string,
  cursor: BacklogCursor
): Promise<void> {
  await db.systemState.upsert({
    where: { key },
    create: { key, value: cursor as unknown as Prisma.InputJsonValue },
    update: { value: cursor as unknown as Prisma.InputJsonValue },
  })
}

/**
 * Sweep the backlog of Communications missing a fresh classifier stamp.
 * Drains in (`date` asc, `id` asc) order so the cursor is monotone.
 *
 * Each Communication runs through `processCommunicationForLease`. After
 * each batch we persist the cursor so a crash mid-sweep resumes near the
 * failure rather than restarting from epoch.
 *
 * Stop conditions (in priority order):
 *   1. Budget cap hit (`ScrubBudgetError`) → `stoppedReason: "budget"`.
 *   2. Per-Communication exception → `stoppedReason: "error"`. We log
 *      and stop rather than continuing because most failures here are
 *      either a DB outage or a code bug, both of which want a human.
 *   3. Reached `maxBatches` → `stoppedReason: "max_batches"`.
 *   4. Query returned no more rows → `stoppedReason: "complete"`.
 */
export async function processBacklogClosedDeals(
  opts: BacklogOpts = {}
): Promise<BacklogResult> {
  const batchSize = opts.batchSize ?? 50
  const throttleMs = opts.throttleMs ?? 250
  const maxBatches = opts.maxBatches ?? Number.POSITIVE_INFINITY
  const cursorKey = opts.cursorKey ?? DEFAULT_BACKLOG_KEY
  const processFn = opts.processFn ?? processCommunicationForLease
  const assertBudgetFn = opts.assertBudgetFn ?? assertWithinScrubBudget
  const sleepFn = opts.sleepFn ?? defaultSleep

  const result: BacklogResult = {
    processed: 0,
    leaseRecordsCreated: 0,
    errors: [],
    stoppedReason: "complete",
    cursor: null,
  }

  let batchesRun = 0
  let cursor = await loadBacklogCursor(cursorKey)

  while (batchesRun < maxBatches) {
    // Build a where clause that excludes already-stamped Communications.
    // Postgres JSONB path query: metadata->'closedDealClassification'->>'version'
    // != current version. Prisma JSON filter syntax handles the equivalent
    // via `path` + `not`.
    const whereExclusions: Prisma.CommunicationWhereInput = {
      archivedAt: null,
      OR: [
        { metadata: { equals: PrismaNS.DbNull } },
        {
          NOT: {
            metadata: {
              path: ["closedDealClassification", "version"],
              equals: CLOSED_DEAL_CLASSIFIER_VERSION,
            },
          },
        },
      ],
    }

    // Cursor-based pagination — use the receivedAt+id pair from the prior
    // batch so we never re-scan the same row twice.
    const where: Prisma.CommunicationWhereInput = cursor?.lastProcessedReceivedAt
      ? {
          AND: [
            whereExclusions,
            {
              OR: [
                {
                  date: { gt: new Date(cursor.lastProcessedReceivedAt) },
                },
                {
                  date: new Date(cursor.lastProcessedReceivedAt),
                  id: { gt: cursor.lastProcessedCommunicationId ?? "" },
                },
              ],
            },
          ],
        }
      : whereExclusions

    const batch = await db.communication.findMany({
      where,
      select: { id: true, date: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      take: batchSize,
    })

    if (batch.length === 0) {
      result.stoppedReason = "complete"
      break
    }

    let stop: BacklogResult["stoppedReason"] | null = null

    for (const comm of batch) {
      try {
        await assertBudgetFn()
      } catch (err) {
        if (err instanceof ScrubBudgetError) {
          stop = "budget"
          break
        }
        throw err
      }

      try {
        const out = await processFn(comm.id)
        result.processed += 1
        if (out.ok) result.leaseRecordsCreated += 1
        cursor = {
          lastProcessedCommunicationId: comm.id,
          lastProcessedReceivedAt: comm.date.toISOString(),
        }
      } catch (err) {
        result.errors.push({
          communicationId: comm.id,
          message: err instanceof Error ? err.message : String(err),
        })
        stop = "error"
        break
      }

      if (throttleMs > 0) await sleepFn(throttleMs)
    }

    if (cursor) await persistBacklogCursor(cursorKey, cursor)
    result.cursor = cursor
    batchesRun += 1

    if (stop) {
      result.stoppedReason = stop
      break
    }
  }

  if (batchesRun >= maxBatches && result.stoppedReason === "complete") {
    result.stoppedReason = "max_batches"
  }

  return result
}
