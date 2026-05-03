import "server-only"

import { db } from "@/lib/prisma"

import {
  type ClosedDealClassification,
  type ClosedDealClassificationKind,
} from "./lease-types"
import { containsRawSensitiveData } from "./sensitive-filter"

/**
 * Stage-1 closed-deal classifier.
 *
 * Reads a Communication's subject + body and assigns it to one of four
 * buckets. Cheap broad scan: routed to DeepSeek via the OpenAI-compatible
 * endpoint, model selectable via `OPENAI_CLOSED_DEAL_CLASSIFIER_MODEL`.
 *
 * The actual prompt is in `closed-deal-classifier.prompt.md` and the
 * fetch/JSON-parse logic is stubbed below — this stream's job is the
 * scaffolding (validation, error paths, sensitive-content gate, entry
 * point), not the AI call itself.
 *
 * Persistence is deliberately out of scope here: this module returns the
 * validated classification, and Stream E wires it through to the
 * LeaseRecord row.
 */

export const CLOSED_DEAL_CLASSIFIER_VERSION = "2026-05-02.2"

/** Discriminated outcome of a `runClosedDealClassifier()` invocation. */
export type ClosedDealClassifierOutcome =
  | {
      ok: true
      result: ClosedDealClassification
      modelUsed: string
    }
  | {
      ok: false
      reason:
        | "missing_communication"
        | "empty_communication"
        | "sensitive_content"
        | "stub_no_response"
        | "validation_failed"
        | "provider_error"
      details?: string
      sensitiveReasons?: string[]
    }

const VALID_CLASSIFICATIONS: ReadonlySet<ClosedDealClassificationKind> = new Set<
  ClosedDealClassificationKind
>([
  "closed_lease",
  "closed_sale",
  "lease_in_progress",
  "not_a_deal",
])

/**
 * Validate an arbitrary value as a `ClosedDealClassification`. Returns the
 * narrowed value or a string describing why it was rejected.
 *
 * Rules (mirrored in `closed-deal-classifier.prompt.md`):
 * - `classification` ∈ the four valid kinds
 * - `confidence` ∈ [0, 1] and finite
 * - `signals` is an array of strings (may be empty)
 */
export function validateClosedDealClassification(
  raw: unknown
): { ok: true; value: ClosedDealClassification } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "not_an_object" }
  }
  const r = raw as Record<string, unknown>

  if (typeof r.classification !== "string") {
    return { ok: false, reason: "classification_not_string" }
  }
  if (!VALID_CLASSIFICATIONS.has(r.classification as ClosedDealClassificationKind)) {
    return {
      ok: false,
      reason: `classification_invalid:${r.classification}`,
    }
  }

  if (typeof r.confidence !== "number" || !Number.isFinite(r.confidence)) {
    return { ok: false, reason: "confidence_not_number" }
  }
  if (r.confidence < 0 || r.confidence > 1) {
    return { ok: false, reason: `confidence_out_of_range:${r.confidence}` }
  }

  let signals: string[] = []
  if (r.signals !== undefined && r.signals !== null) {
    if (!Array.isArray(r.signals)) {
      return { ok: false, reason: "signals_not_array" }
    }
    for (const s of r.signals) {
      if (typeof s !== "string") {
        return { ok: false, reason: "signals_contains_non_string" }
      }
    }
    signals = r.signals as string[]
  }

  return {
    ok: true,
    value: {
      classification: r.classification as ClosedDealClassificationKind,
      confidence: r.confidence,
      signals,
    },
  }
}

/**
 * Resolve the configured DeepSeek-compatible model name. Defaults to
 * `deepseek-chat`; override via `OPENAI_CLOSED_DEAL_CLASSIFIER_MODEL`.
 */
export function resolveClassifierModel(): string {
  return (
    process.env.OPENAI_CLOSED_DEAL_CLASSIFIER_MODEL?.trim() || "deepseek-chat"
  )
}

/**
 * Stub for the actual provider call. Returns `null` until the prompt is
 * wired in. When implemented, this should:
 *   1. Build the chat-completions payload using the prompt MD as the
 *      system message and `{subject, body}` as the user message.
 *   2. POST to `${OPENAI_BASE_URL ?? https://api.openai.com/v1}/chat/completions`
 *      with the model from `resolveClassifierModel()`.
 *   3. Parse the JSON tool-call output and pass through
 *      `validateClosedDealClassification`.
 *
 * TODO: WIRE PROMPT — see closed-deal-classifier.prompt.md
 */
export async function callClassifier(
  _subject: string,
  _body: string
): Promise<ClosedDealClassification | null> {
  // TODO: WIRE PROMPT — see closed-deal-classifier.prompt.md
  return null
}

/**
 * Higher-level entry point: load the Communication by id, run the gate,
 * call the classifier, validate the result, and return a typed outcome.
 *
 * Side-effects (persistence, downstream extractor invocation) are NOT
 * triggered here — that wiring lives in Stream E.
 */
export async function runClosedDealClassifier(
  communicationId: string,
  options: {
    /**
     * Hook for tests to inject a deterministic `callClassifier` without
     * needing to monkey-patch the module.
     */
    callClassifierFn?: typeof callClassifier
  } = {}
): Promise<ClosedDealClassifierOutcome> {
  const callFn = options.callClassifierFn ?? callClassifier

  const comm = await db.communication.findUnique({
    where: { id: communicationId },
    select: { id: true, subject: true, body: true },
  })
  if (!comm) {
    return { ok: false, reason: "missing_communication" }
  }

  const subject = comm.subject ?? ""
  const body = comm.body ?? ""
  if (subject.trim().length === 0 && body.trim().length === 0) {
    return { ok: false, reason: "empty_communication" }
  }

  // Defense-in-depth: even though the classifier is OpenAI-compatible
  // (DeepSeek), we still skip emails that contain raw banking/SSN/card
  // data. Stage 2 rechecks before routing to a US model.
  const sensitivity = containsRawSensitiveData(subject, body)
  if (sensitivity.tripped) {
    return {
      ok: false,
      reason: "sensitive_content",
      sensitiveReasons: sensitivity.reasons,
    }
  }

  let raw: ClosedDealClassification | null
  try {
    raw = await callFn(subject, body)
  } catch (err) {
    return {
      ok: false,
      reason: "provider_error",
      details: err instanceof Error ? err.message : String(err),
    }
  }

  if (raw === null) {
    return { ok: false, reason: "stub_no_response" }
  }

  const validation = validateClosedDealClassification(raw)
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
    modelUsed: resolveClassifierModel(),
  }
}
