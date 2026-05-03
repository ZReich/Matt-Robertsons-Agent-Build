import { beforeEach, describe, expect, it, vi } from "vitest"

import { scrubWithClaude } from "./claude"
import { scrubWithOpenAI } from "./openai"
import { scrubWithConfiguredProvider } from "./scrub-provider"

vi.mock("./claude", () => ({ scrubWithClaude: vi.fn() }))
vi.mock("./openai", () => ({ scrubWithOpenAI: vi.fn() }))

const stubResponse = {
  modelUsed: "stub",
  toolInput: {},
  usage: { tokensIn: 0, tokensOut: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
}

describe("scrubWithConfiguredProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(scrubWithClaude).mockResolvedValue(stubResponse)
    vi.mocked(scrubWithOpenAI).mockResolvedValue(stubResponse)
  })

  it("ALWAYS routes to OpenAI/DeepSeek even when ANTHROPIC_API_KEY is set — Haiku is reserved for sensitive routing only", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-anthropic"

    await scrubWithConfiguredProvider({
      perEmailPrompt: "p",
      globalMemory: "g",
    })

    expect(scrubWithOpenAI).toHaveBeenCalledTimes(1)
    expect(scrubWithClaude).not.toHaveBeenCalled()
  })

  it("routes to OpenAI when ANTHROPIC_API_KEY is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY

    await scrubWithConfiguredProvider({
      perEmailPrompt: "p",
      globalMemory: "g",
    })

    expect(scrubWithOpenAI).toHaveBeenCalledTimes(1)
    expect(scrubWithClaude).not.toHaveBeenCalled()
  })

  it("routes to OpenAI when ANTHROPIC_API_KEY is empty", async () => {
    process.env.ANTHROPIC_API_KEY = ""

    await scrubWithConfiguredProvider({
      perEmailPrompt: "p",
      globalMemory: "g",
    })

    expect(scrubWithOpenAI).toHaveBeenCalledTimes(1)
    expect(scrubWithClaude).not.toHaveBeenCalled()
  })

  it("forwards the correction parameter through to the OpenAI path", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-anthropic"

    await scrubWithConfiguredProvider({
      perEmailPrompt: "p",
      globalMemory: "g",
      correction: "retry",
    })

    expect(scrubWithOpenAI).toHaveBeenCalledWith({
      perEmailPrompt: "p",
      globalMemory: "g",
      correction: "retry",
    })
  })
})
