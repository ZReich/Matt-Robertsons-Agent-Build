import type { ClaudeScrubResponse } from "./claude"

import { SCRUB_TOOL, SYSTEM_PROMPT } from "./scrub-prompt"

export class OpenAIConfigError extends Error {
  code = "OPENAI_CONFIG_ERROR" as const
}

export class ScrubOpenAIAuthError extends Error {
  code = "SCRUB_OPENAI_AUTH_ERROR" as const

  constructor(
    readonly httpStatus: number,
    message: string
  ) {
    super(`OpenAI auth error (${httpStatus}): ${message}`)
  }
}

type ChatCompletionResponse = {
  model?: string
  choices?: Array<{
    message?: {
      tool_calls?: Array<{
        type?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_tokens_details?: {
      cached_tokens?: number
    }
  }
  error?: {
    message?: string
  }
}

const DEFAULT_OPENAI_SCRUB_MODEL = "gpt-4.1-mini"

function getOpenAIEndpoint() {
  const baseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ??
    "https://api.openai.com/v1"
  return `${baseUrl}/chat/completions`
}

export async function scrubWithOpenAI({
  perEmailPrompt,
  globalMemory,
  correction,
}: {
  perEmailPrompt: string
  globalMemory: string
  correction?: string
}): Promise<ClaudeScrubResponse> {
  const model = process.env.OPENAI_SCRUB_MODEL || DEFAULT_OPENAI_SCRUB_MODEL
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new OpenAIConfigError("OPENAI_API_KEY is required")

  const messages = [
    {
      role: "system",
      content: [SYSTEM_PROMPT, globalMemory].filter(Boolean).join("\n\n"),
    },
    { role: "user", content: perEmailPrompt },
  ]
  if (correction) {
    messages.push({ role: "user", content: correction })
  }

  const response = await fetch(getOpenAIEndpoint(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: SCRUB_TOOL.name,
            description: SCRUB_TOOL.description,
            parameters: SCRUB_TOOL.input_schema,
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: SCRUB_TOOL.name },
      },
    }),
  })
  const body = (await response
    .json()
    .catch(() => ({}))) as ChatCompletionResponse
  if (!response.ok) {
    const message = body.error?.message ?? response.statusText
    if (response.status === 401 || response.status === 403) {
      throw new ScrubOpenAIAuthError(response.status, message)
    }
    throw new Error(`OpenAI scrub failed (${response.status}): ${message}`)
  }

  const toolCall = body.choices?.[0]?.message?.tool_calls?.find(
    (call) =>
      call.type === "function" && call.function?.name === SCRUB_TOOL.name
  )
  const rawArguments = toolCall?.function?.arguments
  if (!rawArguments) {
    throw new Error("OpenAI did not return record_email_scrub tool output")
  }

  return {
    toolInput: JSON.parse(rawArguments),
    modelUsed: body.model ?? model,
    usage: {
      tokensIn: body.usage?.prompt_tokens ?? 0,
      tokensOut: body.usage?.completion_tokens ?? 0,
      cacheReadTokens: body.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      cacheWriteTokens: 0,
    },
  }
}
