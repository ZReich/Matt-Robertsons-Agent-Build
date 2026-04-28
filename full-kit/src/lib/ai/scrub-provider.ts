import type { ClaudeScrubResponse } from "./claude"

import { scrubWithClaude } from "./claude"
import { scrubWithOpenAI } from "./openai"

export async function scrubWithConfiguredProvider(input: {
  perEmailPrompt: string
  globalMemory: string
  correction?: string
}): Promise<ClaudeScrubResponse> {
  if (process.env.ANTHROPIC_API_KEY) {
    return scrubWithClaude(input)
  }
  return scrubWithOpenAI(input)
}
