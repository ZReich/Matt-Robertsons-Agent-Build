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

  it("routes to Claude when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-anthropic"

    await scrubWithConfiguredProvider({
      perEmailPrompt: "p",
      globalMemory: "g",
    })

    expect(scrubWithClaude).toHaveBeenCalledTimes(1)
    expect(scrubWithOpenAI).not.toHaveBeenCalled()
  })

  it("falls back to OpenAI when ANTHROPIC_API_KEY is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY

    await scrubWithConfiguredProvider({
      perEmailPrompt: "p",
      globalMemory: "g",
    })

    expect(scrubWithOpenAI).toHaveBeenCalledTimes(1)
    expect(scrubWithClaude).not.toHaveBeenCalled()
  })

  it("treats an empty ANTHROPIC_API_KEY as unset and falls back to OpenAI", async () => {
    process.env.ANTHROPIC_API_KEY = ""

    await scrubWithConfiguredProvider({
      perEmailPrompt: "p",
      globalMemory: "g",
    })

    expect(scrubWithOpenAI).toHaveBeenCalledTimes(1)
    expect(scrubWithClaude).not.toHaveBeenCalled()
  })

  it("forwards the correction parameter through to the chosen provider", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-anthropic"

    await scrubWithConfiguredProvider({
      perEmailPrompt: "p",
      globalMemory: "g",
      correction: "retry",
    })

    expect(scrubWithClaude).toHaveBeenCalledWith({
      perEmailPrompt: "p",
      globalMemory: "g",
      correction: "retry",
    })
  })
})
