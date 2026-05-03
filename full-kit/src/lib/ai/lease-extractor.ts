import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"

import type Anthropic from "@anthropic-ai/sdk"

import { db } from "@/lib/prisma"

import { createAnthropicClient } from "./claude"
import {
  type ClosedDealClassificationKind,
  type LeaseExtraction,
  type LeaseExtractorInput,
} from "./lease-types"
import {
  logScrubApiCall,
  type ScrubApiOutcome,
  type ScrubApiUsage,
} from "./scrub-api-log"
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
 * Claude Haiku 4.5 published pricing (2026):
 *   input  ~$1.00 / 1M tokens
 *   output ~$5.00 / 1M tokens
 *   cache reads  ~$0.10 / 1M tokens
 *   cache writes ~$1.25 / 1M tokens (5m ephemeral)
 *
 * Mirrors the breakdown in `scrub-api-log.ts` so the extractor and the
 * scrub pipeline produce comparable per-call USD numbers.
 */
const HAIKU_INPUT_PER_M_USD = 1.0
const HAIKU_OUTPUT_PER_M_USD = 5.0
const HAIKU_CACHE_READ_PER_M_USD = 0.1
const HAIKU_CACHE_WRITE_PER_M_USD = 1.25

/**
 * Cost estimate for a single Haiku extractor call. Colocated here (not
 * in `scrub-api-log.ts`) because the extractor pricing is identical to
 * the scrub pricing today but may diverge if Anthropic changes Haiku
 * pricing or we route the extractor to a different model — keeping the
 * pricing local to the extractor avoids cross-module surprises.
 */
export function estimateExtractorUsd(usage: ScrubApiUsage): number {
  const cacheReadTokens = usage.cacheReadTokens ?? 0
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0
  const uncachedInputTokens = Math.max(0, usage.tokensIn - cacheReadTokens)
  return (
    (uncachedInputTokens / 1_000_000) * HAIKU_INPUT_PER_M_USD +
    (cacheReadTokens / 1_000_000) * HAIKU_CACHE_READ_PER_M_USD +
    (cacheWriteTokens / 1_000_000) * HAIKU_CACHE_WRITE_PER_M_USD +
    (usage.tokensOut / 1_000_000) * HAIKU_OUTPUT_PER_M_USD
  )
}

/**
 * Anthropic tool-use schema for the structured extraction. Forces the
 * model to emit a single JSON object that matches `LeaseExtraction` (the
 * validator in this file does the actual narrowing).
 *
 * `tool_choice` (set on the request) pins the model to this tool —
 * Haiku will not free-text its way out of the schema.
 *
 * Note on the `["string", "null"]` union type: the Anthropic SDK's
 * `Tool.InputSchema` is loosely typed (`properties?: unknown`), so the
 * draft-2020-12 array-of-types form passes through to the wire format
 * unchanged. The model handles it natively. If a future SDK rejects
 * this form, switch to `anyOf: [{type: "string"}, {type: "null"}]`.
 */
export const EXTRACT_TOOL = {
  name: "extract_lease",
  description: "Emit the structured lease/sale extraction.",
  input_schema: {
    type: "object" as const,
    properties: {
      contactName: { type: "string" },
      contactEmail: { type: ["string", "null"] },
      propertyAddress: { type: ["string", "null"] },
      closeDate: { type: ["string", "null"] },
      leaseStartDate: { type: ["string", "null"] },
      leaseEndDate: { type: ["string", "null"] },
      leaseTermMonths: { type: ["integer", "null"] },
      rentAmount: { type: ["number", "null"] },
      rentPeriod: {
        type: ["string", "null"],
        enum: ["monthly", "annual", null],
      },
      mattRepresented: {
        type: ["string", "null"],
        enum: ["owner", "tenant", "both", null],
      },
      dealKind: { type: "string", enum: ["lease", "sale"] },
      confidence: { type: "number" },
      reasoning: { type: "string" },
    },
    required: ["contactName", "dealKind", "confidence", "reasoning"],
  },
} as const

/**
 * Extractor system prompt body. In production, loaded from disk on
 * first read and cached for the lifetime of the process — the file is
 * part of the deployed bundle and never changes between requests.
 *
 * In non-production (dev) mode the cache is bypassed so edits to
 * `lease-extractor.prompt.md` take effect without a server restart.
 * Mirrors the pattern in `closed-deal-classifier.ts`.
 */
let EXTRACTOR_PROMPT_CACHE: string | null = null
async function loadPromptBody(): Promise<string> {
  if (process.env.NODE_ENV === "production" && EXTRACTOR_PROMPT_CACHE !== null) {
    return EXTRACTOR_PROMPT_CACHE
  }
  const promptPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "ai",
    "lease-extractor.prompt.md"
  )
  const text = await fs.readFile(promptPath, "utf8")
  if (process.env.NODE_ENV === "production") EXTRACTOR_PROMPT_CACHE = text
  return text
}

/**
 * Public alias for the prompt loader. The PDF extractor reuses the
 * same MD file so the body and PDF prompts never drift; exported here
 * so that file doesn't have to duplicate the path/cache logic.
 */
export async function loadLeaseExtractorPrompt(): Promise<string> {
  return loadPromptBody()
}

/**
 * Telemetry-write wrapper. Always swallows errors so a failed insert
 * never propagates to the caller — under-counting spend is strictly
 * preferred over losing a successful extraction result.
 */
async function writeExtractorLog({
  modelUsed,
  usage,
  outcome,
}: {
  modelUsed: string
  usage: ScrubApiUsage
  outcome: Extract<
    ScrubApiOutcome,
    "extractor-ok" | "extractor-validation-failed" | "extractor-provider-error"
  >
}): Promise<void> {
  try {
    await logScrubApiCall({
      promptVersion: LEASE_EXTRACTOR_VERSION,
      modelUsed,
      usage,
      outcome,
      estimatedUsdOverride: estimateExtractorUsd(usage),
    })
  } catch (err) {
    console.error("[extractor] failed to write ScrubApiCall row:", err)
  }
}

/**
 * Provider call: send the LeaseExtractorInput to Claude Haiku via the
 * Anthropic SDK with tool-use forced for `extract_lease`.
 *
 * - Returns the raw `tool_use.input` block (untyped). The caller
 *   (`runLeaseExtraction`) runs `validateLeaseExtraction` to narrow.
 * - Returns `null` when the response carries no `tool_use` block —
 *   shouldn't happen with `tool_choice: {type: "tool", ...}` but we
 *   defend anyway because Anthropic occasionally returns a stop-reason
 *   like `max_tokens` with a partial tool_use that we treat as a
 *   validation failure rather than a hard error.
 * - Logs every call to `ScrubApiCall` with the appropriate
 *   `extractor-*` outcome and a Haiku-priced USD estimate. Logging
 *   failure is non-fatal (telemetry under-count > losing the result).
 * - Re-raises provider errors after logging — caller maps them to
 *   `provider_error` in the outcome union.
 *
 * Retries: relies on the Anthropic SDK's built-in maxRetries (default
 * 2 for v0.30+; we run v0.91 which keeps that default). The scrub
 * pipeline runs its own retry loop in `scrubWithClaude` because it has
 * to coordinate with a circuit breaker; the extractor doesn't, so the
 * SDK's built-in is the right level of resilience.
 */
export async function callExtractor(
  input: LeaseExtractorInput
): Promise<unknown | null> {
  const model = resolveExtractorModel()
  const promptBody = await loadPromptBody()

  const userContent =
    `SUBJECT:\n${input.subject}\n\n` +
    `BODY:\n${input.body}\n\n` +
    `CLASSIFICATION: ${input.classification}\n` +
    `SIGNALS: ${JSON.stringify(input.signals)}`

  const client = createAnthropicClient()

  let response: Awaited<ReturnType<typeof client.messages.create>>
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1024,
      temperature: 0,
      system: [
        {
          type: "text",
          text: promptBody,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [EXTRACT_TOOL as unknown as Anthropic.Messages.Tool],
      tool_choice: { type: "tool", name: "extract_lease" },
      messages: [{ role: "user", content: userContent }],
    })
  } catch (err) {
    await writeExtractorLog({
      modelUsed: model,
      usage: { tokensIn: 0, tokensOut: 0 },
      outcome: "extractor-provider-error",
    })
    throw err
  }

  // Narrow the streaming-vs-message union before we touch usage/content.
  // `messages.create` without `stream: true` always returns a Message
  // here, but the SDK's overload doesn't fully encode that.
  const message = response as Anthropic.Messages.Message
  const usage: ScrubApiUsage = {
    tokensIn: message.usage?.input_tokens ?? 0,
    tokensOut: message.usage?.output_tokens ?? 0,
    cacheReadTokens:
      (message.usage as { cache_read_input_tokens?: number } | undefined)
        ?.cache_read_input_tokens ?? 0,
    cacheWriteTokens:
      (message.usage as { cache_creation_input_tokens?: number } | undefined)
        ?.cache_creation_input_tokens ?? 0,
  }
  const modelUsed = message.model ?? model

  const toolUse = message.content?.find(
    (block) => block.type === "tool_use" && block.name === "extract_lease"
  )

  if (!toolUse || toolUse.type !== "tool_use") {
    // No usable structured output — log as validation-failed and let
    // the caller see `null`.
    await writeExtractorLog({
      modelUsed,
      usage,
      outcome: "extractor-validation-failed",
    })
    return null
  }

  await writeExtractorLog({
    modelUsed,
    usage,
    outcome: "extractor-ok",
  })

  return toolUse.input
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
