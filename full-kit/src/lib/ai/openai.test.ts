import { beforeEach, describe, expect, it, vi } from "vitest"

import { scrubWithOpenAI } from "./openai"

describe("scrubWithOpenAI", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai-key"
    process.env.OPENAI_SCRUB_MODEL = "gpt-test"
    delete process.env.OPENAI_BASE_URL
    vi.stubGlobal("fetch", vi.fn())
  })

  it("forces a record_email_scrub function call and parses its arguments", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "gpt-test",
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: "function",
                  function: {
                    name: "record_email_scrub",
                    arguments: JSON.stringify({
                      summary: "Lead asked for details",
                      topicTags: ["new-lead-inquiry"],
                      urgency: "soon",
                      replyRequired: true,
                      sentiment: null,
                      linkedContactCandidates: [],
                      linkedDealCandidates: [],
                      suggestedActions: [],
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          prompt_tokens_details: { cached_tokens: 10 },
        },
      }),
    } as Response)

    await expect(
      scrubWithOpenAI({
        perEmailPrompt: "email",
        globalMemory: "memory",
      })
    ).resolves.toMatchObject({
      modelUsed: "gpt-test",
      usage: { tokensIn: 100, tokensOut: 20, cacheReadTokens: 10 },
      toolInput: { summary: "Lead asked for details" },
    })

    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-openai-key",
        }),
      })
    )
    const body = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body ?? "{}")
    )
    expect(body).toMatchObject({
      model: "gpt-test",
      tool_choice: {
        type: "function",
        function: { name: "record_email_scrub" },
      },
    })
  })

  it("uses an OpenAI-compatible base URL when configured", async () => {
    process.env.OPENAI_BASE_URL = "http://localhost:11434/v1/"
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: "function",
                  function: {
                    name: "record_email_scrub",
                    arguments: JSON.stringify({
                      summary: "ok",
                      topicTags: [],
                      urgency: "fyi",
                      replyRequired: false,
                      sentiment: null,
                      linkedContactCandidates: [],
                      linkedDealCandidates: [],
                      suggestedActions: [],
                    }),
                  },
                },
              ],
            },
          },
        ],
      }),
    } as Response)

    await scrubWithOpenAI({ perEmailPrompt: "email", globalMemory: "" })

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:11434/v1/chat/completions",
      expect.any(Object)
    )
  })
})
