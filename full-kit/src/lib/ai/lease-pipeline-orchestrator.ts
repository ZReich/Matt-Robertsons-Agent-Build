import "server-only"

import { Prisma as PrismaNS } from "@prisma/client"

import type {
  ClosedDealClassification,
  LeaseExtraction,
} from "@/lib/ai/lease-types"
import type { AttachmentMeta } from "@/lib/communications/attachment-types"
import type { LeaseLifecycleInput } from "@/lib/contacts/lease-role-lifecycle"
import type { ClientType, Prisma } from "@prisma/client"

import {
  LeaseBackfillBudgetError,
  ScrubBudgetError,
  assertWithinLeaseBackfillBudget,
} from "@/lib/ai/budget-tracker"
import {
  CLOSED_DEAL_CLASSIFIER_VERSION,
  runClosedDealClassifier,
} from "@/lib/ai/closed-deal-classifier"
import {
  LEASE_EXTRACTOR_VERSION,
  runLeaseExtraction,
} from "@/lib/ai/lease-extractor"
import { extractLeaseFromPdf } from "@/lib/ai/pdf-lease-extractor"
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
import { nextClientTypeForLease } from "@/lib/contacts/lease-role-lifecycle"
import { downloadAttachment } from "@/lib/msgraph/download-attachment"
import { db } from "@/lib/prisma"
import { findPropertyForLease } from "@/lib/properties/find-for-lease"
import { getAutomationSettings } from "@/lib/system-state/automation-settings"

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
  /**
   * Inject the PDF extractor for tests. Falls back to the real
   * `extractLeaseFromPdf` runner. Called only when the body extractor
   * returns a recoverable failure (low_confidence / stub_no_response /
   * validation_failed) AND the Communication has at least one PDF
   * attachment we can ship to Anthropic.
   */
  extractLeaseFromPdfFn?: typeof extractLeaseFromPdf
  /**
   * Inject the Graph attachment downloader for tests. Falls back to the
   * real `downloadAttachment` runner. Called only inside the PDF fallback
   * path described above.
   */
  downloadAttachmentFn?: typeof downloadAttachment
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
 * Read `metadata.leaseExtractionAttempt` and check whether a PDF fallback
 * was already attempted at the CURRENT extractor version. We deliberately
 * key on `version`: if the extractor or its prompt/schema bumps to a new
 * `LEASE_EXTRACTOR_VERSION`, the prior `pdfAttempted: true` stamp is
 * effectively stale and we let the next run try PDF again. This mirrors
 * how the classifier-stamp short-circuit at the top of
 * `processCommunicationForLease` is gated by `CLOSED_DEAL_CLASSIFIER_VERSION`.
 */
function pdfAlreadyAttemptedAtCurrentVersion(
  metadata: Prisma.JsonValue | null | undefined
): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false
  }
  const m = metadata as Record<string, unknown>
  const slot = m.leaseExtractionAttempt
  if (!slot || typeof slot !== "object" || Array.isArray(slot)) return false
  const s = slot as Record<string, unknown>
  if (s.pdfAttempted !== true) return false
  return s.version === LEASE_EXTRACTOR_VERSION
}

/**
 * Pull `attachments` (an `AttachmentMeta[]`) off `Communication.metadata`.
 * The shape is set by `persistMessage` in `src/lib/msgraph/emails.ts`
 * (line ~466: `metadata.attachments = AttachmentMeta[]`). Returns an empty
 * array when the metadata is null, the slot is missing, or the slot is
 * the wrong shape — the orchestrator should never throw on a malformed
 * metadata blob from a legacy row.
 */
function readAttachmentsFromMetadata(
  metadata: Prisma.JsonValue | null | undefined
): AttachmentMeta[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return []
  }
  const raw = (metadata as Record<string, unknown>).attachments
  if (!Array.isArray(raw)) return []
  const out: AttachmentMeta[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
    const e = entry as Record<string, unknown>
    if (typeof e.id !== "string") continue
    if (typeof e.name !== "string") continue
    if (typeof e.size !== "number") continue
    if (typeof e.contentType !== "string") continue
    out.push({
      id: e.id,
      name: e.name,
      size: e.size,
      contentType: e.contentType,
      isInline: e.isInline === true,
      attachmentType:
        e.attachmentType === "file" ||
        e.attachmentType === "item" ||
        e.attachmentType === "reference" ||
        e.attachmentType === "unknown"
          ? e.attachmentType
          : undefined,
    })
  }
  return out
}

/**
 * Anthropic's PDF endpoint caps a single document at 32MB. The PDF
 * extractor short-circuits any payload over this cap with a zero-cost
 * `extractor-pdf-skipped` row, but skipping at the orchestrator level
 * avoids paying the Graph download bandwidth too. Same cap as the one
 * inside `pdf-lease-extractor.ts:48`.
 */
const PDF_FALLBACK_MAX_BYTES = 32 * 1024 * 1024

/**
 * Filter the Communication's attachments down to the set we'd actually
 * ship to the PDF extractor, then sort smallest-first so a successful
 * extraction lands on the cheapest payload. Filters:
 *   - `contentType === "application/pdf"` (case-insensitive, since Graph
 *     sometimes returns mixed case).
 *   - `attachmentType !== "item" && attachmentType !== "reference"` (skip
 *     Outlook-specific non-file types — "item" is an embedded message,
 *     "reference" is a OneDrive link, neither carries `contentBytes`).
 *     Pre-126b65f Communications have `attachmentType: undefined`; we treat
 *     that as "probably a file" — the magic-byte sniff in the PDF extractor
 *     enforces the actual PDF contract.
 *   - `size <= PDF_FALLBACK_MAX_BYTES` (skip oversize before download).
 *   - `isInline !== true` (inline attachments are almost always email
 *     signatures, not lease PDFs — and shipping a sig graphic to Claude
 *     is pure waste).
 */
function selectPdfFallbackCandidates(
  attachments: AttachmentMeta[]
): AttachmentMeta[] {
  return attachments
    .filter((a) => {
      if (a.isInline === true) return false
      // Pre-126b65f Communications stored attachmentType as undefined on the JSON
      // shape. Treat undefined as "probably a file" — the magic-byte sniff in the
      // PDF extractor enforces the actual PDF contract. Only reject Outlook-specific
      // non-file types ("item" = embedded message, "reference" = OneDrive link).
      if (a.attachmentType === "item" || a.attachmentType === "reference")
        return false
      if (typeof a.contentType !== "string") return false
      if (a.contentType.toLowerCase() !== "application/pdf") return false
      if (typeof a.size !== "number") return false
      if (a.size <= 0) return false
      if (a.size > PDF_FALLBACK_MAX_BYTES) return false
      return true
    })
    .sort((a, b) => a.size - b.size)
}

/**
 * Trim the email body to the leading slice we hand to the PDF extractor
 * as `bodyExcerpt`. Caps at ~500 chars (per the task spec) — enough to
 * give the model the surrounding email-thread context without bloating
 * the prompt or leaking long signature blocks.
 */
const PDF_BODY_EXCERPT_MAX_CHARS = 500
function buildBodyExcerpt(body: string | null | undefined): string {
  if (!body) return ""
  return body.length > PDF_BODY_EXCERPT_MAX_CHARS
    ? body.slice(0, PDF_BODY_EXCERPT_MAX_CHARS)
    : body
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
  const dateDim =
    extraction.dealKind === "lease" ? args.leaseStartDate : args.closeDate
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
  const classifierFn =
    options.runClosedDealClassifierFn ?? runClosedDealClassifier
  const extractorFn = options.runLeaseExtractionFn ?? runLeaseExtraction
  const pdfExtractorFn = options.extractLeaseFromPdfFn ?? extractLeaseFromPdf
  const downloadAttachmentFn =
    options.downloadAttachmentFn ?? downloadAttachment
  const now = options.now ?? new Date()

  const settings = options.settings ?? (await getAutomationSettings())

  // Subject/body/externalMessageId are needed for the PDF fallback (the
  // PDF extractor takes `subject` and `bodyExcerpt`; the Graph download
  // takes `externalMessageId`). Pulled in the initial read so the PDF
  // path doesn't require a second findUnique.
  const comm = await db.communication.findUnique({
    where: { id: communicationId },
    select: {
      id: true,
      metadata: true,
      subject: true,
      body: true,
      externalMessageId: true,
    },
  })
  if (!comm) {
    return {
      ok: false,
      reason: "classifier_failed",
      details: "missing_communication",
    }
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

  // Detect a "body extractor failed in a way the PDF fallback might
  // recover from" condition. The recoverable bucket per spec:
  //   - extractor_failed with reason `stub_no_response` or `validation_failed`
  //   - extractor returned a result, but confidence < threshold (low_confidence)
  // Other failure modes (`missing_communication`, `wrong_classification`,
  // `sensitive_content`, `provider_error`) are NOT recoverable via PDF —
  // they're either infrastructure problems or hard policy gates.
  type BodyFailure =
    | { kind: "stub_no_response" | "validation_failed"; details: string | null }
    | {
        kind: "low_confidence"
        confidence: number
        threshold: number
      }
  let bodyFailure: BodyFailure | null = null
  let extraction: LeaseExtraction | null = null

  if (!extractorOutcome.ok) {
    if (
      extractorOutcome.reason === "stub_no_response" ||
      extractorOutcome.reason === "validation_failed"
    ) {
      bodyFailure = {
        kind: extractorOutcome.reason,
        details: extractorOutcome.details ?? null,
      }
    } else {
      // Non-recoverable failure: stamp and return WITHOUT trying PDF.
      // (provider_error / sensitive_content / missing_communication /
      // wrong_classification all land here.)
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
  } else if (
    extractorOutcome.result.confidence < settings.leaseExtractorMinConfidence
  ) {
    bodyFailure = {
      kind: "low_confidence",
      confidence: extractorOutcome.result.confidence,
      threshold: settings.leaseExtractorMinConfidence,
    }
  } else {
    extraction = extractorOutcome.result
  }

  // -------------------------------------------------------------------
  // PDF fallback (Phase 2 / Task 2.3).
  //
  // When the body extractor failed recoverably AND the Communication has
  // PDF attachments we can ship to Anthropic, try each in size order
  // (smallest first → cheapest token bill on the win path) and let the
  // FIRST success win. The PDF extractor writes its own ScrubApiCall row
  // (`extractor-pdf-*` outcomes) so we don't add orchestrator-level
  // logging here — the per-row budget gate inside the backlog driver
  // already covers PDF spend because PDF telemetry rolls up through the
  // same lease-backfill budget.
  //
  // Re-attempt semantics: if a prior run already attempted PDF at the
  // CURRENT `LEASE_EXTRACTOR_VERSION` (stamped via `pdfAttempted: true`),
  // skip the re-attempt — it would burn another round of Graph download
  // + Haiku tokens for the same likely-same outcome. When the extractor
  // version bumps, that stamp goes stale and we DO retry.
  // -------------------------------------------------------------------
  let pdfAttempted = false
  let pdfFailureReason: string | null = null
  if (bodyFailure) {
    const pdfAlreadyAttempted = pdfAlreadyAttemptedAtCurrentVersion(
      comm.metadata
    )
    const candidates = pdfAlreadyAttempted
      ? []
      : selectPdfFallbackCandidates(readAttachmentsFromMetadata(comm.metadata))

    if (candidates.length > 0 && comm.externalMessageId) {
      const subject = comm.subject ?? ""
      const bodyExcerpt = buildBodyExcerpt(comm.body)
      pdfAttempted = true

      for (const attachment of candidates) {
        let blobBytes: Buffer
        try {
          const blob = await downloadAttachmentFn(
            comm.externalMessageId,
            attachment.id
          )
          blobBytes = blob.contentBytes
        } catch (err) {
          // A single attachment download failing isn't fatal — log the
          // reason on the metadata stamp (last attempt wins) and keep
          // trying the next attachment.
          pdfFailureReason = `download_failed:${
            err instanceof Error ? err.message : String(err)
          }`
          continue
        }

        const pdfOutcome = await pdfExtractorFn({
          pdf: blobBytes,
          classification,
          signals: classifierOutcome.result.signals,
          subject,
          bodyExcerpt,
        })
        if (pdfOutcome.ok) {
          // C1: apply the same confidence gate as the body extractor. A PDF
          // result below the threshold is not authoritative — treat it as a
          // recoverable failure and continue to the next PDF candidate.
          if (
            pdfOutcome.result.confidence < settings.leaseExtractorMinConfidence
          ) {
            pdfFailureReason = "low_confidence"
            continue
          }
          extraction = pdfOutcome.result
          pdfFailureReason = null
          break
        }
        pdfFailureReason = pdfOutcome.reason
      }
    } else if (!pdfAlreadyAttempted && candidates.length === 0) {
      // No usable PDF candidate to try, but we DID look. Stamp this so
      // operators can tell apart "we tried and failed" from "we never
      // tried because the email had no PDFs".
      pdfFailureReason = "no_pdf_attachments"
    } else if (pdfAlreadyAttempted) {
      pdfFailureReason = "already_attempted"
    }
  }

  if (bodyFailure && !extraction) {
    // Body failed AND PDF either wasn't tried or didn't recover. Stamp
    // the attempt (carrying `pdfAttempted` so backlog re-runs at the same
    // extractor version skip the redundant work) and return the same
    // shape as the pre-fallback code path.
    await db.$transaction(async (tx) => {
      const fresh = await tx.communication.findUnique({
        where: { id: communicationId },
        select: { metadata: true },
      })
      const stamp: Record<string, unknown> = {
        version: LEASE_EXTRACTOR_VERSION,
        runAt: now.toISOString(),
        pdfAttempted,
      }
      if (pdfFailureReason !== null) {
        stamp.pdfFailureReason = pdfFailureReason
      }
      if (bodyFailure.kind === "low_confidence") {
        stamp.failedReason = "low_confidence"
        stamp.confidence = bodyFailure.confidence
        stamp.threshold = bodyFailure.threshold
      } else {
        stamp.failedReason = bodyFailure.kind
        stamp.details = bodyFailure.details
      }
      await tx.communication.update({
        where: { id: communicationId },
        data: {
          metadata: mergeMetadata(fresh?.metadata, {
            closedDealClassification: classificationStamp,
            leaseExtractionAttempt: stamp,
          }),
        },
      })
    })
    if (bodyFailure.kind === "low_confidence") {
      return { ok: false, reason: "low_confidence" }
    }
    return {
      ok: false,
      reason: "extractor_failed",
      details: bodyFailure.kind,
    }
  }

  // Sanity: by here we MUST have an extraction. Either the body
  // extractor produced one above the confidence threshold, or the PDF
  // fallback just supplied one.
  if (!extraction) {
    throw new Error("orchestrator: extraction is null after fallback path")
  }

  // Pre-flight: reject obviously-unusable contactName before opening txn-2.
  // We don't want a hallucinated "Re: closed lease" name turning into a
  // fresh garbage Contact row. If contactName is unusable AND there's no
  // contactEmail to fall back on, treat as low-confidence and skip all
  // DB writes (just stamp metadata so the backlog driver doesn't re-pick).
  const trimmedContactName = extraction.contactName.trim()
  const trimmedContactEmail = extraction.contactEmail?.trim() ?? ""
  if (
    !isUsableContactName(trimmedContactName) &&
    trimmedContactEmail.length === 0
  ) {
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
   * Inject for tests. Defaults to `assertWithinLeaseBackfillBudget`
   * (audit I4 — lease pipeline has its own budget separate from the
   * live scrub pipeline).
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
  const assertBudgetFn = opts.assertBudgetFn ?? assertWithinLeaseBackfillBudget
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
    const where: Prisma.CommunicationWhereInput =
      cursor?.lastProcessedReceivedAt
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
        if (
          err instanceof ScrubBudgetError ||
          err instanceof LeaseBackfillBudgetError
        ) {
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
