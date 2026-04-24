import Anthropic from "@anthropic-ai/sdk"

import type { ScrubApiUsage } from "./scrub-api-log"

import { MODEL_ID, SCRUB_TOOL, SYSTEM_PROMPT } from "./scrub-prompt"

export type ClaudeScrubResponse = {
  toolInput: unknown
  modelUsed: string
  usage: ScrubApiUsage
}

export class ClaudeConfigError extends Error {
  code = "CLAUDE_CONFIG_ERROR" as const
}

/**
 * Thrown when Anthropic returns 401/403. The batch loop uses this as a
 * signal to trip the auth circuit breaker (which then makes subsequent
 * batch invocations early-return without calling Anthropic).
 */
export class ScrubClaudeAuthError extends Error {
  code = "SCRUB_CLAUDE_AUTH_ERROR" as const

  constructor(
    readonly httpStatus: number,
    message: string
  ) {
    super(`Anthropic auth error (${httpStatus}): ${message}`)
  }
}

/**
 * Below this threshold, the globalMemory block is NOT given its own
 * cache_control breakpoint. Anthropic silently refuses to cache prompts
 * under the per-model minimum; a failed cache write is money paid for
 * nothing. The SYSTEM_PROMPT's cache block already holds the bulk of the
 * stable prefix, so dropping breakpoint 2 when the memory is small loses
 * nothing.
 *
 * Set intentionally above the highest plausible Haiku minimum (currently
 * ~2K, with headroom for Anthropic to raise it).
 */
const GLOBAL_MEMORY_CACHE_MIN_CHARS = 4000

/**
 * Error classes we treat as retryable. Exponential backoff on these.
 * 500/502/503/504 = transport transient. 529/overloaded = server overload.
 * 429 = rate limit (we honor retry-after when present).
 */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 529])
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1000

function pickHttpStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null
  const anyErr = err as { status?: unknown; httpStatus?: unknown }
  if (typeof anyErr.status === "number") return anyErr.status
  if (typeof anyErr.httpStatus === "number") return anyErr.httpStatus
  return null
}

function pickRetryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== "object") return null
  const anyErr = err as {
    headers?:
      | Record<string, string | undefined>
      | { get?: (k: string) => string | null }
  }
  const headers = anyErr.headers
  let raw: string | null | undefined
  if (headers && typeof headers === "object") {
    if ("get" in headers && typeof headers.get === "function") {
      raw = headers.get("retry-after")
    } else {
      raw = (headers as Record<string, string | undefined>)["retry-after"]
    }
  }
  if (!raw) return null
  const secs = Number.parseInt(raw, 10)
  if (Number.isFinite(secs) && secs >= 0) return secs * 1000
  return null
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new ClaudeConfigError("ANTHROPIC_API_KEY is required")
  return new Anthropic({ apiKey })
}

type SystemBlock = {
  type: "text"
  text: string
  cache_control?: { type: "ephemeral" }
}

export async function scrubWithClaude({
  perEmailPrompt,
  globalMemory,
  correction,
  client = createAnthropicClient(),
}: {
  perEmailPrompt: string
  globalMemory: string
  correction?: string
  client?: Anthropic
}): Promise<ClaudeScrubResponse> {
  // Breakpoint 1 is always cached. Breakpoint 2 (global memory) is cached
  // ONLY when large enough to plausibly clear Anthropic's threshold.
  const system: SystemBlock[] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ]
  if (globalMemory && globalMemory.length > 0) {
    const block: SystemBlock = { type: "text", text: globalMemory }
    if (globalMemory.length >= GLOBAL_MEMORY_CACHE_MIN_CHARS) {
      block.cache_control = { type: "ephemeral" }
    }
    system.push(block)
  }

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: perEmailPrompt },
  ]
  if (correction) {
    messages.push({ role: "user", content: correction })
  }

  let attempt = 0
  let lastErr: unknown
  // Separate counter for transient backoff — doesn't eat the MAX_RETRIES budget.
  // (spec: "Overload/rate-limit retries use a separate counter from `attempts`")
  while (attempt <= MAX_RETRIES) {
    try {
      const response = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 2000,
        tools: [SCRUB_TOOL as unknown as Anthropic.Messages.Tool],
        tool_choice: { type: "tool", name: "record_email_scrub" },
        system,
        messages,
      })

      const toolUse = response.content.find(
        (block) => block.type === "tool_use"
      )
      if (!toolUse || toolUse.type !== "tool_use") {
        throw new Error("Claude did not return record_email_scrub tool output")
      }
      const usage = response.usage as typeof response.usage & {
        cache_read_input_tokens?: number
        cache_creation_input_tokens?: number
      }
      return {
        toolInput: toolUse.input,
        modelUsed: response.model,
        usage: {
          tokensIn: usage.input_tokens,
          tokensOut: usage.output_tokens,
          cacheReadTokens: usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
        },
      }
    } catch (err) {
      lastErr = err
      const status = pickHttpStatus(err)

      // Auth errors — terminal, wrapped so the batch loop can trip the
      // circuit breaker via ScrubClaudeAuthError instanceof check.
      if (status === 401 || status === 403) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new ScrubClaudeAuthError(status, msg)
      }

      // Retryable? Back off and try again.
      if (
        status != null &&
        RETRYABLE_STATUSES.has(status) &&
        attempt < MAX_RETRIES
      ) {
        const retryAfterMs = pickRetryAfterMs(err)
        const backoff = retryAfterMs ?? BASE_BACKOFF_MS * 4 ** attempt
        await sleep(backoff)
        attempt += 1
        continue
      }

      // Non-retryable (400 invalid_request, etc.) or retries exhausted.
      throw err
    }
  }
  throw lastErr ?? new Error("scrubWithClaude: retries exhausted")
}
