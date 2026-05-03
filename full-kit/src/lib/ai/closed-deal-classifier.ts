import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"

import { db } from "@/lib/prisma"

import {
  type ClosedDealClassification,
  type ClosedDealClassificationKind,
} from "./lease-types"
import { logScrubApiCall, type ScrubApiOutcome } from "./scrub-api-log"
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
 * DeepSeek pricing as of 2026 — published rates for `deepseek-chat`:
 *   input  ~$0.14 / 1M tokens
 *   output ~$0.28 / 1M tokens
 *
 * No cache pricing is applied here — the classifier sends a fresh
 * single-message request per Communication and DeepSeek's
 * implicit-cache discount is not material at v1 traffic levels.
 */
const DEEPSEEK_INPUT_PER_M_USD = 0.14
const DEEPSEEK_OUTPUT_PER_M_USD = 0.28

/**
 * Audit I5: per-attempt timeout for the DeepSeek HTTP call. DeepSeek's
 * observed failure mode under load is TCP-accept-but-no-response, which
 * would otherwise freeze the backlog driver indefinitely. With one retry,
 * worst case is ~60s plus any Retry-After backoff between attempts.
 */
const CLASSIFIER_FETCH_TIMEOUT_MS = 30_000

/**
 * Cost estimate for a single DeepSeek classifier call. Colocated with
 * the wiring (not in `scrub-api-log.ts`) because the pricing model is
 * provider-specific and we don't want to entangle it with the Haiku
 * scrub cost curve.
 */
export function estimateClassifierUsd({
  tokensIn,
  tokensOut,
}: {
  tokensIn: number
  tokensOut: number
}): number {
  return (
    (tokensIn / 1_000_000) * DEEPSEEK_INPUT_PER_M_USD +
    (tokensOut / 1_000_000) * DEEPSEEK_OUTPUT_PER_M_USD
  )
}

/**
 * Classifier system prompt body. In production, loaded from disk on
 * first read and cached for the lifetime of the process — the file is
 * part of the deployed bundle and never changes between requests.
 *
 * In non-production (dev) mode the cache is bypassed so edits to
 * `closed-deal-classifier.prompt.md` take effect without a server
 * restart. Next.js hot-reload does not re-run module-scope initialisers,
 * so a module-level cache would silently serve stale prompt text.
 */
let CLASSIFIER_PROMPT_CACHE: string | null = null
async function loadClassifierPrompt(): Promise<string> {
  // Bypass cache in dev so prompt edits take effect without a restart.
  if (process.env.NODE_ENV === "production" && CLASSIFIER_PROMPT_CACHE !== null) {
    return CLASSIFIER_PROMPT_CACHE
  }
  const promptPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "ai",
    "closed-deal-classifier.prompt.md"
  )
  const text = await fs.readFile(promptPath, "utf8")
  if (process.env.NODE_ENV === "production") CLASSIFIER_PROMPT_CACHE = text
  return text
}

function getClassifierEndpoint(): string {
  const baseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ??
    "https://api.openai.com/v1"
  return `${baseUrl}/chat/completions`
}

type DeepSeekChatResponse = {
  model?: string
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
  error?: {
    message?: string
  }
}

/**
 * Sleep `ms` milliseconds without blocking other timers. Extracted to a
 * named function for clarity in the retry path; intentionally
 * non-cancelable — the request loop only retries once.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Compute backoff for the single retry the classifier permits.
 * Honors `Retry-After` if the server sent one (seconds, integer).
 */
function backoffMsFromResponse(response: Response): number {
  const retryAfter = response.headers.get("retry-after")
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10)
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000
    }
  }
  return 1000 // 1s base backoff
}

/**
 * Provider call: POST {subject, body} to DeepSeek's chat-completions
 * endpoint, parse the model's JSON content, validate, and return the
 * narrowed classification (or null if the response wasn't usable).
 *
 * - Uses JSON-mode (`response_format: { type: "json_object" }`) — the
 *   classifier prompt instructs the model to output a single JSON
 *   object. We do NOT use tool-calling here; the schema is small and
 *   JSON-mode keeps the request shape simple and the response cheap.
 * - Retries ONCE on 429 and 5xx with `Retry-After`-aware backoff.
 *   Throws on persistent provider failure (caller maps to
 *   `provider_error`).
 * - Logs every call to `ScrubApiCall` with a classifier-specific
 *   outcome and DeepSeek-priced USD estimate. Logging failure is
 *   non-fatal.
 */
export async function callClassifier(
  subject: string,
  body: string
): Promise<ClosedDealClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("classifier provider failed: OPENAI_API_KEY is not set")
  }

  const model = resolveClassifierModel()
  const systemPrompt = await loadClassifierPrompt()
  const userPayload = JSON.stringify({ subject, body })

  const requestBody = JSON.stringify({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPayload },
    ],
  })

  const url = getClassifierEndpoint()
  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  }

  // One-shot retry: if the first response is 429 or 5xx, wait and try
  // once more. After the second attempt we either return success or
  // throw the most recent failure.
  //
  // Audit I5: each attempt is bounded by a 30s AbortController timeout.
  // A hanging DeepSeek connection (TCP-accept-but-no-response, observed
  // pattern under load) would otherwise freeze the backlog driver
  // indefinitely. Worst case: 2 attempts × 30s = ~60s plus any
  // Retry-After backoff between them. If both attempts time out we throw
  // a "timeout"-tagged provider error.
  let response: Response | null = null
  let lastTimeoutError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      CLASSIFIER_FETCH_TIMEOUT_MS
    )
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: requestBody,
        signal: controller.signal,
      })
    } catch (err) {
      // AbortError or other network failure. Treat as retryable on
      // attempt 0 (fall through to backoff), and as terminal on attempt 1.
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || /aborted/i.test(err.message))
      lastTimeoutError = err instanceof Error ? err : new Error(String(err))
      if (attempt === 1) {
        if (isAbort) {
          throw new Error(
            `classifier provider failed (timeout): no response within ${CLASSIFIER_FETCH_TIMEOUT_MS}ms`
          )
        }
        throw lastTimeoutError
      }
      // Attempt 0 timed out / failed — wait the base backoff and retry.
      await sleep(1000)
      continue
    } finally {
      clearTimeout(timeout)
    }
    const isRetryable =
      response.status === 429 || (response.status >= 500 && response.status < 600)
    if (!isRetryable || attempt === 1) break
    const delay = backoffMsFromResponse(response)
    await sleep(delay)
  }

  if (!response) {
    // Both attempts failed without a response — the catch above already
    // threw on attempt 1, but defense in depth.
    if (lastTimeoutError) {
      throw new Error(
        `classifier provider failed (timeout): no response within ${CLASSIFIER_FETCH_TIMEOUT_MS}ms`
      )
    }
    throw new Error("classifier provider failed: no response")
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    const excerpt = text.slice(0, 200)
    // Best-effort log of the failed call so spend is still observable.
    void writeClassifierLog({
      modelUsed: model,
      tokensIn: 0,
      tokensOut: 0,
      outcome: "classifier-provider-error",
    })
    throw new Error(
      `classifier provider failed (${response.status}): ${excerpt}`
    )
  }

  const json = (await response.json().catch(() => ({}))) as DeepSeekChatResponse
  const tokensIn = json.usage?.prompt_tokens ?? 0
  const tokensOut = json.usage?.completion_tokens ?? 0
  const content = json.choices?.[0]?.message?.content ?? ""

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    void writeClassifierLog({
      modelUsed: json.model ?? model,
      tokensIn,
      tokensOut,
      outcome: "classifier-validation-failed",
    })
    return null
  }

  const validation = validateClosedDealClassification(parsed)
  if (!validation.ok) {
    void writeClassifierLog({
      modelUsed: json.model ?? model,
      tokensIn,
      tokensOut,
      outcome: "classifier-validation-failed",
    })
    return null
  }

  void writeClassifierLog({
    modelUsed: json.model ?? model,
    tokensIn,
    tokensOut,
    outcome: "classifier-ok",
  })

  return validation.value
}

/**
 * Telemetry-write wrapper. Always swallows errors so a failed insert
 * never propagates to the caller — under-counting spend is strictly
 * preferred over losing a successful classification result.
 */
async function writeClassifierLog({
  modelUsed,
  tokensIn,
  tokensOut,
  outcome,
}: {
  modelUsed: string
  tokensIn: number
  tokensOut: number
  outcome: Extract<
    ScrubApiOutcome,
    | "classifier-ok"
    | "classifier-validation-failed"
    | "classifier-provider-error"
  >
}): Promise<void> {
  try {
    await logScrubApiCall({
      promptVersion: CLOSED_DEAL_CLASSIFIER_VERSION,
      modelUsed,
      usage: { tokensIn, tokensOut },
      outcome,
      estimatedUsdOverride: estimateClassifierUsd({ tokensIn, tokensOut }),
    })
  } catch (err) {
    console.error("[classifier] failed to write ScrubApiCall row:", err)
  }
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
