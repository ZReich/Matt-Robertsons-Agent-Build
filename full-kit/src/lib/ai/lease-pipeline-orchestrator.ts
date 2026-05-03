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

import {
  findOrCreateContactForLease,
  isUsableContactName,
} from "@/lib/contacts/find-or-create-for-lease"
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
 * LeaseRecord upsert. Both kinds key on (contactId, propertyId, dateDim):
 *   - leases use leaseStartDate
 *   - sales use closeDate
 * When the date dimension is missing, fall back to
 * (contactId, sourceCommunicationId) so the create remains idempotent on
 * retry of the same Communication.
 *
 * propertyId is part of the key so that two distinct sales (or leases)
 * that share contact + date but differ in property are NOT collapsed into
 * one upsert. Real-world cases: a broker closing two adjacent units on
 * the same day, or a CSV import where close_date is null across many
 * unrelated rows.
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
    propertyId,
    archivedAt: null,
    dealKind: extraction.dealKind,
  }
  const dateDim = extraction.dealKind === "lease" ? args.leaseStartDate : args.closeDate
  if (dateDim) {
    if (extraction.dealKind === "lease") {
      where.leaseStartDate = dateDim
    } else {
      where.closeDate = dateDim
    }
  } else {
    // No date dimension — guard with sourceCommunicationId so unrelated
    // rows for the same contact/property aren't treated as duplicates.
    where.sourceCommunicationId = sourceCommunicationId
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

  // ---------------------------------------------------------------------
  // Two-transaction structure (atomicity rationale).
  //
  // We intentionally split persistence into TWO short-lived transactions
  // around the AI calls rather than wrapping everything in one big block:
  //
  //   txn-1: stamp `metadata.closedDealClassification`. Once committed,
  //          the backlog driver's "already-stamped" filter excludes this
  //          row, so we cannot lose the classifier outcome to a later
  //          crash. This durably marks the row as "classifier ran".
  //
  //   AI call: extractor runs OUTSIDE any DB transaction (long-held DB
  //            txns over an external HTTP call are an antipattern —
  //            connections back up, deadlocks become more likely, and
  //            Postgres transactions weren't designed for multi-second
  //            holds).
  //
  //   txn-2: in the success path, atomically: create/upsert
  //          LeaseRecord + CalendarEvent + Contact.clientType update.
  //          In the failure paths (extractor_failed / low_confidence),
  //          stamp `metadata.leaseExtractionAttempt` (no LeaseRecord side
  //          effects). Either way, the second txn is a single atomic
  //          group — a crash mid-way leaves no half-built state.
  //
  // Before this refactor, the classifier-stamp write happened OUTSIDE the
  // persistence transaction, so a transaction failure would leave the
  // Communication permanently marked "classified" with no LeaseRecord —
  // the backlog driver would then skip it on the next run. Silent loss.
  // ---------------------------------------------------------------------

  // txn-1: durably stamp the classifier outcome. Use the txn even though
  // it's a single write so the post-commit visibility semantics are
  // identical to txn-2 below.
  //
  // C1 fix: re-read metadata INSIDE the txn (not against the outer
  // `comm.metadata` snapshot) so that any concurrent metadata writers —
  // notably scrub-applier — don't get clobbered by our merge. The pattern
  // mirrors scrub-applier.ts:69-78.
  await db.$transaction(async (tx) => {
    const fresh = await tx.communication.findUnique({
      where: { id: communicationId },
      select: { metadata: true },
    })
    await tx.communication.update({
      where: { id: communicationId },
      data: {
        metadata: mergeMetadata(fresh?.metadata, {
          closedDealClassification: classificationStamp,
        }),
      },
    })
  })

  const classification = classifierOutcome.result.classification
  if (classification !== "closed_lease" && classification !== "closed_sale") {
    return { ok: false, reason: "not_a_closed_deal", details: classification }
  }

  // Stage 2 — extractor (NO transaction; external HTTP call).
  const extractorOutcome = await extractorFn(communicationId, classification, {
    signals: classifierOutcome.result.signals,
  })
  if (!extractorOutcome.ok) {
    // Stamp the failed-extraction attempt so the backlog driver doesn't
    // re-pick this Communication. Phase 2 PDF fallback reads this stamp.
    // Preserve any pre-existing unrelated metadata. Single-write txn
    // because the classifier-stamp is already durable from txn-1.
    await db.$transaction(async (tx) => {
      const fresh = await tx.communication.findUnique({
        where: { id: communicationId },
        select: { metadata: true },
      })
      await tx.communication.update({
        where: { id: communicationId },
        data: {
          metadata: mergeMetadata(fresh?.metadata, {
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
    })
    return {
      ok: false,
      reason: "extractor_failed",
      details: extractorOutcome.reason,
    }
  }

  const extraction = extractorOutcome.result
  if (extraction.confidence < settings.leaseExtractorMinConfidence) {
    await db.$transaction(async (tx) => {
      const fresh = await tx.communication.findUnique({
        where: { id: communicationId },
        select: { metadata: true },
      })
      await tx.communication.update({
        where: { id: communicationId },
        data: {
          metadata: mergeMetadata(fresh?.metadata, {
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
    })
    return { ok: false, reason: "low_confidence" }
  }

  // Pre-flight: reject obviously-unusable contactName before opening txn-2.
  // We don't want a hallucinated "Re: closed lease" name turning into a
  // fresh garbage Contact row. If contactName is unusable AND there's no
  // contactEmail to fall back on, treat as low-confidence and skip all
  // DB writes (just stamp metadata so the backlog driver doesn't re-pick).
  const trimmedContactName = extraction.contactName.trim()
  const trimmedContactEmail = extraction.contactEmail?.trim() ?? ""
  if (!isUsableContactName(trimmedContactName) && trimmedContactEmail.length === 0) {
    await db.$transaction(async (tx) => {
      const fresh = await tx.communication.findUnique({
        where: { id: communicationId },
        select: { metadata: true },
      })
      await tx.communication.update({
        where: { id: communicationId },
        data: {
          metadata: mergeMetadata(fresh?.metadata, {
            closedDealClassification: classificationStamp,
            leaseExtractionAttempt: {
              version: LEASE_EXTRACTOR_VERSION,
              failedReason: "unusable_contact_name",
              contactName: extraction.contactName,
              runAt: now.toISOString(),
            },
          }),
        },
      })
    })
    return { ok: false, reason: "low_confidence" }
  }

  // Persistence — txn-2: single atomic group covering the
  // leaseExtractionAttempt stamp + LeaseRecord create/upsert +
  // CalendarEvent upsert + Contact.clientType update. If any step throws,
  // the whole group rolls back, leaving the classifier-stamp from txn-1
  // intact (so the backlog driver still skips this row) but with no
  // LeaseRecord side effects.
  const closeDate = parseIsoDate(extraction.closeDate)
  const leaseStartDate = parseIsoDate(extraction.leaseStartDate)
  const leaseEndDate = parseIsoDate(extraction.leaseEndDate)

  const persisted = await db.$transaction(async (tx) => {
    // Stamp the successful extraction attempt inside the same txn as the
    // LeaseRecord create — so a downstream crash rolls back BOTH the stamp
    // and the half-built LeaseRecord state together. Re-read metadata
    // INSIDE this txn (C1) so any concurrent metadata write — notably
    // scrub-applier's `metadata.scrub` write — is preserved through our
    // merge instead of being clobbered by the stale outer snapshot.
    const fresh = await tx.communication.findUnique({
      where: { id: communicationId },
      select: { metadata: true },
    })
    await tx.communication.update({
      where: { id: communicationId },
      data: {
        metadata: mergeMetadata(fresh?.metadata, {
          closedDealClassification: classificationStamp,
          leaseExtractionAttempt: {
            version: LEASE_EXTRACTOR_VERSION,
            confidence: extraction.confidence,
            threshold: settings.leaseExtractorMinConfidence,
            runAt: now.toISOString(),
          },
        }),
      },
    })

    const contact = await findOrCreateContactForLease(
      {
        contactName: extraction.contactName,
        contactEmail: extraction.contactEmail,
        dealKind: extraction.dealKind,
        mattRepresented: extraction.mattRepresented,
      },
      tx
    )
    if (!contact) {
      // Pre-flight should have caught this — defense in depth. Throwing
      // here triggers the txn-2 rollback so no side effects land.
      throw new Error(
        "findOrCreateContactForLease returned null after pre-flight validation passed"
      )
    }

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
      // I2: catch a P2002 from the partial unique indexes. Two concurrent
      // orchestrator invocations can both pass the metadata short-circuit
      // (txn-1 stamp races), both run AI calls, both find no existing
      // LeaseRecord, and both reach create — the second one then violates
      // the dedupe index. Convert that to a re-find + update so the
      // eventual state is correct regardless of which call won the race.
      try {
        const created = await tx.leaseRecord.create({
          data: leaseData,
          select: { id: true },
        })
        leaseRecordId = created.id
      } catch (err) {
        if (
          err instanceof PrismaNS.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          const refound = await tx.leaseRecord.findFirst({
            where,
            select: { id: true },
          })
          if (!refound) {
            // Should be impossible — a P2002 means another row matching
            // our key just landed; barring a delete in between, findFirst
            // must see it. Re-throw so the failure is observable.
            throw err
          }
          const updated = await tx.leaseRecord.update({
            where: { id: refound.id },
            data: leaseData,
            select: { id: true },
          })
          leaseRecordId = updated.id
        } else {
          throw err
        }
      }
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
        // I2: same P2002 handling as the LeaseRecord create — the
        // (lease_record_id, event_kind) partial unique can fire under a
        // concurrent-orchestrator race.
        try {
          const created = await tx.calendarEvent.create({
            data: eventData,
            select: { id: true },
          })
          calendarEventId = created.id
        } catch (err) {
          if (
            err instanceof PrismaNS.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            const refound = await tx.calendarEvent.findFirst({
              where: { leaseRecordId, eventKind: "lease_renewal" },
              select: { id: true },
            })
            if (!refound) throw err
            const updated = await tx.calendarEvent.update({
              where: { id: refound.id },
              data: eventData,
              select: { id: true },
            })
            calendarEventId = updated.id
          } else {
            throw err
          }
        }
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
 *   2. Per-Communication exceptions are tolerated up to thresholds. The
 *      driver continues processing on a per-row failure (logging it to
 *      `errors[]` and advancing the cursor past it) until either:
 *        - 5 consecutive errors occur, OR
 *        - 50 total errors accumulate.
 *      At that point `stoppedReason: "error"` and we stop. This shape lets
 *      a 200K-row backfill survive transient DB blips without aborting the
 *      whole sweep, while still bailing fast on a true outage or a code
 *      bug (which would burn through the consecutive-error budget quickly).
 *   3. Reached `maxBatches` → `stoppedReason: "max_batches"`.
 *   4. Query returned no more rows → `stoppedReason: "complete"`.
 */
const BACKLOG_MAX_CONSECUTIVE_ERRORS = 5
const BACKLOG_MAX_TOTAL_ERRORS = 50
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
  let consecutiveErrors = 0

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
        consecutiveErrors = 0
      } catch (err) {
        result.errors.push({
          communicationId: comm.id,
          message: err instanceof Error ? err.message : String(err),
        })
        consecutiveErrors += 1
        // Advance the cursor past the failed row anyway. The classifier
        // stamp from txn-1 may or may not have landed (depends where the
        // throw came from); skipping forward prevents the same row from
        // blocking the sweep on every retry. The metadata exclusion in
        // findMany is the durable record of "did this row get classified" —
        // the cursor is just a paging optimization layered on top.
        cursor = {
          lastProcessedCommunicationId: comm.id,
          lastProcessedReceivedAt: comm.date.toISOString(),
        }
        if (
          consecutiveErrors >= BACKLOG_MAX_CONSECUTIVE_ERRORS ||
          result.errors.length >= BACKLOG_MAX_TOTAL_ERRORS
        ) {
          stop = "error"
          break
        }
        // Continue to the next row — a transient blip on one row should
        // not abort the entire backlog sweep.
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
