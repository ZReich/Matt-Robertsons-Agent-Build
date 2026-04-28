import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  OpenAIConfigError,
  ScrubOpenAIAuthError,
  scrubWithOpenAI,
} from "./openai"

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

  it("throws OpenAIConfigError when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY

    await expect(
      scrubWithOpenAI({ perEmailPrompt: "email", globalMemory: "" })
    ).rejects.toBeInstanceOf(OpenAIConfigError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("throws ScrubOpenAIAuthError on 401 so the auth circuit can trip", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: { message: "invalid key" } }),
    } as Response)

    await expect(
      scrubWithOpenAI({ perEmailPrompt: "email", globalMemory: "" })
    ).rejects.toBeInstanceOf(ScrubOpenAIAuthError)
  })

  it("throws ScrubOpenAIAuthError on 403 too", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: async () => ({ error: { message: "forbidden" } }),
    } as Response)

    await expect(
      scrubWithOpenAI({ perEmailPrompt: "email", globalMemory: "" })
    ).rejects.toBeInstanceOf(ScrubOpenAIAuthError)
  })

  it("surfaces non-auth API errors as a generic Error with status in the message", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
      json: async () => ({ error: { message: "boom" } }),
    } as Response)

    await expect(
      scrubWithOpenAI({ perEmailPrompt: "email", globalMemory: "" })
    ).rejects.toThrow(/OpenAI scrub failed \(500\): boom/)
  })

  it("throws when the response is missing a record_email_scrub tool call", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { tool_calls: [] } }],
      }),
    } as Response)

    await expect(
      scrubWithOpenAI({ perEmailPrompt: "email", globalMemory: "" })
    ).rejects.toThrow(/did not return record_email_scrub tool output/)
  })

  it("appends a correction message as a third user turn so the model can retry", async () => {
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
                      summary: "fixed",
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

    await scrubWithOpenAI({
      perEmailPrompt: "email",
      globalMemory: "",
      correction: "please retry with valid schema",
    })

    const body = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body ?? "{}")
    )
    expect(body.messages).toEqual([
      expect.objectContaining({ role: "system" }),
      expect.objectContaining({ role: "user", content: "email" }),
      expect.objectContaining({
        role: "user",
        content: "please retry with valid schema",
      }),
    ])
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
