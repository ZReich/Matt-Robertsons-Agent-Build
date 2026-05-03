import "server-only"

import { db } from "@/lib/prisma"

import {
  type ClosedDealClassificationKind,
  type LeaseExtraction,
  type LeaseExtractorInput,
} from "./lease-types"
import { containsRawSensitiveData } from "./sensitive-filter"

/**
 * Stage-2 lease/sale extractor.
 *
 * Invoked only after the classifier returned `closed_lease` or
 * `closed_sale`. Routed to a US-based model (Claude Haiku) per Zach's
 * sensitive-content decision (2026-04-30): closed-deal emails routinely
 * carry rent figures and tenant identities, which we don't ship to
 * non-US providers.
 *
 * Persistence (creating a `LeaseRecord` row) is Stream E's job. This
 * module returns a validated `LeaseExtraction`; downstream wires it
 * through.
 */

export const LEASE_EXTRACTOR_VERSION = "2026-05-02.2"

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const RENT_PERIOD_VALUES: ReadonlySet<"monthly" | "annual"> = new Set([
  "monthly",
  "annual",
])
const MATT_REPRESENTED_VALUES: ReadonlySet<"owner" | "tenant" | "both"> = new Set([
  "owner",
  "tenant",
  "both",
])
const DEAL_KIND_VALUES: ReadonlySet<"lease" | "sale"> = new Set(["lease", "sale"])

/**
 * If start/end and a `leaseTermMonths` value are all present, the months
 * value should be within this many months of the actual span. We allow
 * +/- 1 to account for partial-month leases ("Jan 15 → Jan 14, 2027" is
 * 24 months of "term" colloquially even though strictly it's 23.97).
 */
const LEASE_TERM_TOLERANCE_MONTHS = 1

export type LeaseExtractorOutcome =
  | {
      ok: true
      result: LeaseExtraction
      modelUsed: string
    }
  | {
      ok: false
      reason:
        | "missing_communication"
        | "wrong_classification"
        | "sensitive_content"
        | "stub_no_response"
        | "validation_failed"
        | "provider_error"
      details?: string
      sensitiveReasons?: string[]
    }

/**
 * Looks vaguely like an email. We're permissive here: the AI may pull a
 * malformed address out of a signature block, and we'd rather flag it as
 * non-null garbage than silently accept it. Validation rejects strings
 * with no `@`.
 */
const EMAIL_SHAPE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  // Round-trip to catch values like 2026-02-30 that Date silently
  // promotes to 2026-03-02.
  return d.toISOString().slice(0, 10) === value
}

function monthsBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(`${endIso}T00:00:00Z`)
  const years = end.getUTCFullYear() - start.getUTCFullYear()
  const months = end.getUTCMonth() - start.getUTCMonth()
  let total = years * 12 + months
  if (end.getUTCDate() < start.getUTCDate()) total -= 1
  return total
}

/**
 * Strict validator for the AI's output. Catches the kinds of bad data the
 * model produces in practice — backwards lease dates, term-mismatching
 * months, confidence > 1, sale records that still have rent fields, etc.
 *
 * `expectedDealKind` comes from the upstream classifier outcome and is
 * cross-checked against the AI's self-reported `dealKind`.
 */
export function validateLeaseExtraction(
  raw: unknown,
  expectedDealKind: "lease" | "sale"
): { ok: true; value: LeaseExtraction } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "not_an_object" }
  }
  const r = raw as Record<string, unknown>

  // contactName — required, non-empty.
  if (typeof r.contactName !== "string" || r.contactName.trim().length === 0) {
    return { ok: false, reason: "contactName_missing_or_empty" }
  }

  // contactEmail — string-or-null. If string, must look like an email.
  let contactEmail: string | null
  if (r.contactEmail === null || r.contactEmail === undefined) {
    contactEmail = null
  } else if (typeof r.contactEmail === "string") {
    const trimmed = r.contactEmail.trim()
    if (trimmed.length === 0) {
      contactEmail = null
    } else if (!EMAIL_SHAPE_RE.test(trimmed)) {
      return { ok: false, reason: `contactEmail_malformed:${trimmed}` }
    } else {
      contactEmail = trimmed
    }
  } else {
    return { ok: false, reason: "contactEmail_wrong_type" }
  }

  // propertyAddress — string-or-null. We don't validate format.
  let propertyAddress: string | null
  if (r.propertyAddress === null || r.propertyAddress === undefined) {
    propertyAddress = null
  } else if (typeof r.propertyAddress === "string") {
    const trimmed = r.propertyAddress.trim()
    propertyAddress = trimmed.length === 0 ? null : trimmed
  } else {
    return { ok: false, reason: "propertyAddress_wrong_type" }
  }

  // Date fields — null-or-`YYYY-MM-DD` and must round-trip.
  const dates: { key: "closeDate" | "leaseStartDate" | "leaseEndDate"; value: string | null }[] =
    []
  for (const key of ["closeDate", "leaseStartDate", "leaseEndDate"] as const) {
    const v = r[key]
    if (v === null || v === undefined) {
      dates.push({ key, value: null })
    } else if (typeof v === "string") {
      const trimmed = v.trim()
      if (trimmed.length === 0) {
        dates.push({ key, value: null })
      } else if (!isValidIsoDate(trimmed)) {
        return { ok: false, reason: `${key}_malformed:${trimmed}` }
      } else {
        dates.push({ key, value: trimmed })
      }
    } else {
      return { ok: false, reason: `${key}_wrong_type` }
    }
  }
  const [closeDateField, leaseStartField, leaseEndField] = dates
  const closeDate = closeDateField!.value
  const leaseStartDate = leaseStartField!.value
  const leaseEndDate = leaseEndField!.value

  if (leaseStartDate && leaseEndDate && leaseEndDate < leaseStartDate) {
    return {
      ok: false,
      reason: `leaseEndDate_before_leaseStartDate:${leaseStartDate}>${leaseEndDate}`,
    }
  }

  // leaseTermMonths — null or positive integer.
  let leaseTermMonths: number | null
  if (r.leaseTermMonths === null || r.leaseTermMonths === undefined) {
    leaseTermMonths = null
  } else if (typeof r.leaseTermMonths === "number") {
    if (!Number.isFinite(r.leaseTermMonths) || !Number.isInteger(r.leaseTermMonths)) {
      return { ok: false, reason: "leaseTermMonths_not_integer" }
    }
    if (r.leaseTermMonths <= 0) {
      return { ok: false, reason: "leaseTermMonths_not_positive" }
    }
    leaseTermMonths = r.leaseTermMonths
  } else {
    return { ok: false, reason: "leaseTermMonths_wrong_type" }
  }

  // Cross-check the months value against the date range.
  if (leaseStartDate && leaseEndDate && leaseTermMonths !== null) {
    const computed = monthsBetween(leaseStartDate, leaseEndDate)
    if (Math.abs(computed - leaseTermMonths) > LEASE_TERM_TOLERANCE_MONTHS) {
      return {
        ok: false,
        reason: `leaseTermMonths_mismatch:reported=${leaseTermMonths},computed=${computed}`,
      }
    }
  }

  // rentAmount — null or positive number.
  let rentAmount: number | null
  if (r.rentAmount === null || r.rentAmount === undefined) {
    rentAmount = null
  } else if (typeof r.rentAmount === "number") {
    if (!Number.isFinite(r.rentAmount)) {
      return { ok: false, reason: "rentAmount_not_finite" }
    }
    if (r.rentAmount <= 0) {
      return { ok: false, reason: "rentAmount_not_positive" }
    }
    rentAmount = r.rentAmount
  } else {
    return { ok: false, reason: "rentAmount_wrong_type" }
  }

  // rentPeriod — null or one of the two enum values.
  let rentPeriod: "monthly" | "annual" | null
  if (r.rentPeriod === null || r.rentPeriod === undefined) {
    rentPeriod = null
  } else if (typeof r.rentPeriod === "string") {
    if (!RENT_PERIOD_VALUES.has(r.rentPeriod as "monthly" | "annual")) {
      return { ok: false, reason: `rentPeriod_invalid:${r.rentPeriod}` }
    }
    rentPeriod = r.rentPeriod as "monthly" | "annual"
  } else {
    return { ok: false, reason: "rentPeriod_wrong_type" }
  }

  // mattRepresented — null or one of the three enum values.
  let mattRepresented: "owner" | "tenant" | "both" | null
  if (r.mattRepresented === null || r.mattRepresented === undefined) {
    mattRepresented = null
  } else if (typeof r.mattRepresented === "string") {
    if (
      !MATT_REPRESENTED_VALUES.has(
        r.mattRepresented as "owner" | "tenant" | "both"
      )
    ) {
      return {
        ok: false,
        reason: `mattRepresented_invalid:${r.mattRepresented}`,
      }
    }
    mattRepresented = r.mattRepresented as "owner" | "tenant" | "both"
  } else {
    return { ok: false, reason: "mattRepresented_wrong_type" }
  }

  // dealKind — must match upstream classifier.
  if (typeof r.dealKind !== "string") {
    return { ok: false, reason: "dealKind_missing" }
  }
  if (!DEAL_KIND_VALUES.has(r.dealKind as "lease" | "sale")) {
    return { ok: false, reason: `dealKind_invalid:${r.dealKind}` }
  }
  if (r.dealKind !== expectedDealKind) {
    return {
      ok: false,
      reason: `dealKind_mismatch:expected=${expectedDealKind},got=${r.dealKind}`,
    }
  }
  const dealKind = r.dealKind as "lease" | "sale"

  // For sales, lease-only fields must all be null. The model occasionally
  // makes up a "lease term" for a sale; we reject rather than truncate.
  if (dealKind === "sale") {
    if (
      leaseStartDate !== null ||
      leaseEndDate !== null ||
      leaseTermMonths !== null ||
      rentAmount !== null ||
      rentPeriod !== null
    ) {
      return { ok: false, reason: "sale_has_lease_fields" }
    }
  }

  // confidence — 0..1.
  if (typeof r.confidence !== "number" || !Number.isFinite(r.confidence)) {
    return { ok: false, reason: "confidence_not_number" }
  }
  if (r.confidence < 0 || r.confidence > 1) {
    return { ok: false, reason: `confidence_out_of_range:${r.confidence}` }
  }

  // reasoning — non-empty string for audit.
  if (typeof r.reasoning !== "string" || r.reasoning.trim().length === 0) {
    return { ok: false, reason: "reasoning_missing" }
  }

  return {
    ok: true,
    value: {
      contactName: r.contactName.trim(),
      contactEmail,
      propertyAddress,
      closeDate,
      leaseStartDate,
      leaseEndDate,
      leaseTermMonths,
      rentAmount,
      rentPeriod,
      mattRepresented,
      dealKind,
      confidence: r.confidence,
      reasoning: r.reasoning.trim(),
    },
  }
}

/**
 * Resolve the configured Anthropic model. Defaults to
 * `claude-haiku-4-5-20251001`; override via `ANTHROPIC_LEASE_EXTRACTOR_MODEL`.
 */
export function resolveExtractorModel(): string {
  return (
    process.env.ANTHROPIC_LEASE_EXTRACTOR_MODEL?.trim() ||
    "claude-haiku-4-5-20251001"
  )
}

/**
 * Stub for the actual provider call. Returns `null` until the prompt is
 * wired in. When implemented, this should:
 *   1. Build the Anthropic Messages API payload using the prompt MD as
 *      the system message and `LeaseExtractorInput` as the user content.
 *   2. POST to `https://api.anthropic.com/v1/messages` with
 *      `resolveExtractorModel()`.
 *   3. Parse the tool_use block and pass through `validateLeaseExtraction`.
 *
 * TODO: WIRE PROMPT — see lease-extractor.prompt.md
 */
export async function callExtractor(
  _input: LeaseExtractorInput
): Promise<unknown | null> {
  // TODO: WIRE PROMPT — see lease-extractor.prompt.md
  return null
}

/**
 * Higher-level entry point: load the Communication, gate, call the AI,
 * validate, return. Caller (Stream E) handles persistence.
 *
 * `classification` must come from the upstream classifier and must be
 * narrowed to one of the two extractable kinds. We re-check it here so a
 * future caller can't accidentally pass `not_a_deal`.
 */
export async function runLeaseExtraction(
  communicationId: string,
  classification: ClosedDealClassificationKind,
  options: {
    /** Pass-through signals from the classifier output. */
    signals?: string[]
    /**
     * Hook for tests to inject a deterministic `callExtractor` without
     * needing to monkey-patch the module.
     */
    callExtractorFn?: typeof callExtractor
  } = {}
): Promise<LeaseExtractorOutcome> {
  if (classification !== "closed_lease" && classification !== "closed_sale") {
    return {
      ok: false,
      reason: "wrong_classification",
      details: classification,
    }
  }

  const callFn = options.callExtractorFn ?? callExtractor

  const comm = await db.communication.findUnique({
    where: { id: communicationId },
    select: { id: true, subject: true, body: true },
  })
  if (!comm) {
    return { ok: false, reason: "missing_communication" }
  }

  const subject = comm.subject ?? ""
  const body = comm.body ?? ""

  // Defense-in-depth sensitive-content gate. Even though the extractor
  // routes to a US-based model, we still skip emails carrying raw
  // banking/SSN/card data — those belong in the human-review bucket.
  const sensitivity = containsRawSensitiveData(subject, body)
  if (sensitivity.tripped) {
    return {
      ok: false,
      reason: "sensitive_content",
      sensitiveReasons: sensitivity.reasons,
    }
  }

  const expectedDealKind: "lease" | "sale" =
    classification === "closed_lease" ? "lease" : "sale"

  let raw: unknown
  try {
    raw = await callFn({
      subject,
      body,
      classification,
      signals: options.signals ?? [],
    })
  } catch (err) {
    return {
      ok: false,
      reason: "provider_error",
      details: err instanceof Error ? err.message : String(err),
    }
  }

  if (raw === null || raw === undefined) {
    return { ok: false, reason: "stub_no_response" }
  }

  const validation = validateLeaseExtraction(raw, expectedDealKind)
  if (!validation.ok) {
    return {
      ok: false,
      reason: "validation_failed",
      details: validation.reason,
    }
  }

  return {
    ok: true,
    result: validation.value,
    modelUsed: resolveExtractorModel(),
  }
}
