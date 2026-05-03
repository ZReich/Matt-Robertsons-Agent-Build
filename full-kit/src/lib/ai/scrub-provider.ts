import type { ClaudeScrubResponse } from "./claude"

import { scrubWithClaude } from "./claude"
import { scrubWithOpenAI } from "./openai"

/**
 * Default scrub path. ALWAYS routes to the OpenAI-compatible endpoint
 * configured by `OPENAI_BASE_URL` / `OPENAI_SCRUB_MODEL` (DeepSeek today,
 * could be Ollama or Grok depending on env).
 *
 * `ANTHROPIC_API_KEY` being set does NOT change the default path. Haiku is
 * reserved for sensitive-content routing — that path goes through
 * `scrubWithSensitiveProvider` below, which only fires when:
 *   1. The sensitive-content filter tripped, AND
 *   2. `ROUTE_SENSITIVE_TO_CLAUDE=true` is set in env (opt-in)
 *
 * Rationale: bulk email scrub at Matt's volume is cheap on DeepSeek
 * (~$5/mo). Routing all of it to Haiku would be ~$15-25/mo — not
 * catastrophic but unnecessary. Haiku is the right tool ONLY for the
 * slice of emails whose content shouldn't sit on a Chinese model.
 */
export async function scrubWithConfiguredProvider(input: {
  perEmailPrompt: string
  globalMemory: string
  correction?: string
}): Promise<ClaudeScrubResponse> {
  return scrubWithOpenAI(input)
}

/**
 * Sensitive-content scrub path. Used by `enqueueScrubForCommunication`
 * when an email trips the broad sensitive-content filter AND the
 * `ROUTE_SENSITIVE_TO_CLAUDE` env flag is `"true"`. Routes to Claude
 * (Haiku 4.5 by default — see scrub-prompt.ts) so the email never touches
 * a non-US model.
 *
 * If the flag is off, callers should fall back to the existing skip
 * behavior (`status="skipped_sensitive"` on the scrub queue row).
 */
export async function scrubWithSensitiveProvider(input: {
  perEmailPrompt: string
  globalMemory: string
  correction?: string
}): Promise<ClaudeScrubResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "scrubWithSensitiveProvider: ANTHROPIC_API_KEY is not set — caller should fall back to skip-sensitive instead of calling this."
    )
  }
  return scrubWithClaude(input)
}

/** True when the operator has opted in to routing sensitive emails through
 * Haiku rather than skipping them entirely. */
export function isSensitiveRoutingEnabled(): boolean {
  return (
    process.env.ROUTE_SENSITIVE_TO_CLAUDE === "true" &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  )
}
