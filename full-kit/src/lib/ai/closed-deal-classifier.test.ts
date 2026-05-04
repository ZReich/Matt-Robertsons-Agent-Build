import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  CLOSED_DEAL_CLASSIFIER_VERSION,
  callClassifier,
  estimateClassifierUsd,
  resolveClassifierModel,
  runClosedDealClassifier,
  validateClosedDealClassification,
} from "./closed-deal-classifier"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/prisma", () => ({
  db: {
    communication: {
      findUnique: vi.fn(),
    },
    scrubApiCall: {
      create: vi.fn().mockResolvedValue({ id: "log-1" }),
      update: vi.fn(),
    },
  },
}))

const mockedFindUnique = db.communication.findUnique as unknown as ReturnType<
  typeof vi.fn
>

describe("validateClosedDealClassification", () => {
  it("accepts a well-formed classification and passes signals through", () => {
    const r = validateClosedDealClassification({
      classification: "closed_lease",
      confidence: 0.82,
      signals: ["fully executed", "lease commencement"],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toEqual({
        classification: "closed_lease",
        confidence: 0.82,
        signals: ["fully executed", "lease commencement"],
      })
    }
  })

  it("rejects when classification is missing", () => {
    const r = validateClosedDealClassification({ confidence: 0.5, signals: [] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("classification_not_string")
  })

  it("rejects an unknown classification kind", () => {
    const r = validateClosedDealClassification({
      classification: "expired_listing",
      confidence: 0.5,
      signals: [],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/classification_invalid:/)
  })

  it("rejects confidence outside 0..1 (above)", () => {
    const r = validateClosedDealClassification({
      classification: "not_a_deal",
      confidence: 1.5,
      signals: [],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/confidence_out_of_range/)
  })

  it("rejects confidence outside 0..1 (below)", () => {
    const r = validateClosedDealClassification({
      classification: "not_a_deal",
      confidence: -0.01,
      signals: [],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/confidence_out_of_range/)
  })

  it("rejects non-string entries inside signals", () => {
    const r = validateClosedDealClassification({
      classification: "closed_sale",
      confidence: 0.7,
      signals: ["closed escrow", 42],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("signals_contains_non_string")
  })

  it("treats missing signals as an empty array", () => {
    const r = validateClosedDealClassification({
      classification: "lease_in_progress",
      confidence: 0.4,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.signals).toEqual([])
  })

  it("rejects non-finite confidence (NaN, Infinity)", () => {
    const a = validateClosedDealClassification({
      classification: "closed_lease",
      confidence: Number.NaN,
      signals: [],
    })
    expect(a.ok).toBe(false)
    const b = validateClosedDealClassification({
      classification: "closed_lease",
      confidence: Number.POSITIVE_INFINITY,
      signals: [],
    })
    expect(b.ok).toBe(false)
  })
})

describe("callClassifier (DeepSeek wiring)", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-key"
    process.env.OPENAI_BASE_URL = "https://api.deepseek.com/v1"
    delete process.env.OPENAI_CLOSED_DEAL_CLASSIFIER_MODEL
    ;(db.scrubApiCall.create as ReturnType<typeof vi.fn>).mockClear()
    ;(db.scrubApiCall.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "log-1",
    })
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  function mockFetchOnce(response: {
    status?: number
    headers?: Record<string, string>
    body: unknown
  }) {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: (response.status ?? 200) >= 200 && (response.status ?? 200) < 300,
      status: response.status ?? 200,
      statusText: "OK",
      headers: {
        get: (k: string) => response.headers?.[k.toLowerCase()] ?? null,
      },
      json: async () => response.body,
      text: async () =>
        typeof response.body === "string"
          ? response.body
          : JSON.stringify(response.body),
    })
    vi.stubGlobal("fetch", fetchMock)
    return fetchMock
  }

  function buildOkResponse(
    payload: object,
    usage = { prompt_tokens: 120, completion_tokens: 30 }
  ) {
    return {
      body: {
        model: "deepseek-chat",
        choices: [
          {
            message: { content: JSON.stringify(payload) },
          },
        ],
        usage,
      },
    }
  }

  it("POSTs to the configured DeepSeek endpoint with JSON-mode and the prompt as system", async () => {
    const fetchMock = mockFetchOnce(
      buildOkResponse({
        classification: "closed_lease",
        confidence: 0.9,
        signals: ["fully executed"],
      })
    )

    const out = await callClassifier("Lease executed", "Fully executed.")
    expect(out).toEqual({
      classification: "closed_lease",
      confidence: 0.9,
      signals: ["fully executed"],
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions")
    expect(init.method).toBe("POST")
    expect(init.headers.authorization).toBe("Bearer sk-test-key")
    expect(init.headers["content-type"]).toBe("application/json")
    const body = JSON.parse(init.body)
    expect(body.model).toBe("deepseek-chat")
    expect(body.temperature).toBe(0)
    expect(body.response_format).toEqual({ type: "json_object" })
    expect(Array.isArray(body.messages)).toBe(true)
    expect(body.messages[0].role).toBe("system")
    expect(typeof body.messages[0].content).toBe("string")
    // The prompt MD should have been read in (non-trivial length).
    expect(body.messages[0].content.length).toBeGreaterThan(500)
    expect(body.messages[1]).toEqual({
      role: "user",
      content: JSON.stringify({
        subject: "Lease executed",
        body: "Fully executed.",
      }),
    })
  })

  it("honors OPENAI_CLOSED_DEAL_CLASSIFIER_MODEL override", async () => {
    process.env.OPENAI_CLOSED_DEAL_CLASSIFIER_MODEL = "deepseek-reasoner"
    const fetchMock = mockFetchOnce(
      buildOkResponse({
        classification: "not_a_deal",
        confidence: 0.9,
        signals: [],
      })
    )

    await callClassifier("hi", "newsletter")
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe("deepseek-reasoner")
  })

  it("throws on non-2xx with status and a body excerpt", async () => {
    // 500 is retryable, so we need to mock TWO responses for this path
    // (initial + one retry). Both 500 → final throw.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: { get: () => null },
      json: async () => ({ error: { message: "internal" } }),
      text: async () => "internal server error",
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(callClassifier("subj", "body")).rejects.toThrow(
      /classifier provider failed.*500/i
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // writeClassifierLog is fire-and-forget (void-prefixed); flush the
    // microtask queue so the create() call has landed before we assert.
    await Promise.resolve()
    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "provider-error" }),
      })
    )
  })

  it("does NOT retry on 4xx other than 429 (e.g. 400)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      headers: { get: () => null },
      json: async () => ({ error: { message: "bad input" } }),
      text: async () => "bad input",
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(callClassifier("subj", "body")).rejects.toThrow(/400/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("returns null when the model emits a payload that fails validation", async () => {
    mockFetchOnce(
      buildOkResponse({
        classification: "totally_made_up",
        confidence: 0.9,
        signals: [],
      })
    )
    const out = await callClassifier("subj", "body")
    expect(out).toBeNull()

    // writeClassifierLog is fire-and-forget (void-prefixed); flush the
    // microtask queue so the create() call has landed before we assert.
    await Promise.resolve()
    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "validation-failed" }),
      })
    )
  })

  it("returns null when the response content is not valid JSON", async () => {
    mockFetchOnce({
      body: {
        model: "deepseek-chat",
        choices: [{ message: { content: "not-json{" } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    })
    const out = await callClassifier("subj", "body")
    expect(out).toBeNull()

    // writeClassifierLog is fire-and-forget (void-prefixed); flush the
    // microtask queue so the create() call has landed before we assert.
    await Promise.resolve()
    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "validation-failed" }),
      })
    )
  })

  it("retries once on 429 (Retry-After respected) and returns the 200 result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: {
          get: (k: string) => (k.toLowerCase() === "retry-after" ? "0" : null),
        },
        json: async () => ({ error: { message: "rate limited" } }),
        text: async () => "rate limited",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: () => null },
        json: async () => ({
          model: "deepseek-chat",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  classification: "closed_sale",
                  confidence: 0.91,
                  signals: ["closed escrow"],
                }),
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
        text: async () => "",
      })
    vi.stubGlobal("fetch", fetchMock)

    const out = await callClassifier("subj", "body")
    expect(out).toEqual({
      classification: "closed_sale",
      confidence: 0.91,
      signals: ["closed escrow"],
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("retries once on 503 then surfaces failure if still bad", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      headers: { get: () => null },
      json: async () => ({ error: { message: "down" } }),
      text: async () => "down",
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(callClassifier("subj", "body")).rejects.toThrow(/503/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("converts AbortError on both attempts into a timeout-tagged provider error (I5)", async () => {
    // Simulate the abort path by having fetch immediately reject with an
    // AbortError BOTH attempts. That's exactly what the in-process
    // 30s-timer would synthesize against a hanging DeepSeek connection,
    // without us having to actually wait 30 seconds. The classifier's
    // attempt-0 catch falls through to the 1s backoff and retries; the
    // attempt-1 catch throws the timeout-tagged error we assert on.
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      const err = new Error("The operation was aborted")
      err.name = "AbortError"
      throw err
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(callClassifier("subj", "body")).rejects.toThrow(/timeout/i)
    // Two attempts: attempt 0 throws + falls through to backoff, then
    // attempt 1 throws and surfaces the timeout-tagged error.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("logs a ScrubApiCall row on success with classifier outcome and tokens", async () => {
    mockFetchOnce(
      buildOkResponse(
        {
          classification: "closed_lease",
          confidence: 0.9,
          signals: ["fully executed"],
        },
        { prompt_tokens: 1000, completion_tokens: 200 }
      )
    )

    await callClassifier("subj", "body")

    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.data.modelUsed).toBe("deepseek-chat")
    expect(args.data.promptVersion).toBe(CLOSED_DEAL_CLASSIFIER_VERSION)
    expect(args.data.tokensIn).toBe(1000)
    expect(args.data.tokensOut).toBe(200)
    expect(args.data.outcome).toBe("ok")
    expect(args.data.purpose).toBe("closed_deal_classifier")
    // 1000 input tokens @ 0.14/M + 200 output tokens @ 0.28/M
    // = 0.00014 + 0.000056 = 0.000196
    expect(parseFloat(args.data.estimatedUsd)).toBeCloseTo(0.000196, 6)
  })
})

describe("estimateClassifierUsd", () => {
  it("prices DeepSeek at ~$0.14/M input + $0.28/M output", () => {
    expect(
      estimateClassifierUsd({ tokensIn: 1_000_000, tokensOut: 0 })
    ).toBeCloseTo(0.14, 4)
    expect(
      estimateClassifierUsd({ tokensIn: 0, tokensOut: 1_000_000 })
    ).toBeCloseTo(0.28, 4)
    expect(estimateClassifierUsd({ tokensIn: 0, tokensOut: 0 })).toBe(0)
  })
})

describe("resolveClassifierModel", () => {
  it("defaults to deepseek-chat when env var is unset", () => {
    delete process.env.OPENAI_CLOSED_DEAL_CLASSIFIER_MODEL
    expect(resolveClassifierModel()).toBe("deepseek-chat")
  })

  it("honors the override env var", () => {
    process.env.OPENAI_CLOSED_DEAL_CLASSIFIER_MODEL = "deepseek-reasoner"
    expect(resolveClassifierModel()).toBe("deepseek-reasoner")
    delete process.env.OPENAI_CLOSED_DEAL_CLASSIFIER_MODEL
  })
})

describe("runClosedDealClassifier", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns missing_communication when no row matches", async () => {
    mockedFindUnique.mockResolvedValue(null)
    const out = await runClosedDealClassifier("missing-id")
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe("missing_communication")
  })

  it("returns empty_communication when subject and body are blank", async () => {
    mockedFindUnique.mockResolvedValue({ id: "c1", subject: "", body: "   " })
    const out = await runClosedDealClassifier("c1")
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe("empty_communication")
  })

  it("gates emails containing raw sensitive data (SSN)", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Closing paperwork",
      body: "Tenant SSN is 123-45-6789, please file.",
    })
    const callClassifierFn = vi.fn()
    const out = await runClosedDealClassifier("c1", { callClassifierFn })
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.reason).toBe("sensitive_content")
      expect(out.sensitiveReasons).toContain("pattern:ssn")
    }
    expect(callClassifierFn).not.toHaveBeenCalled()
  })

  it("returns stub_no_response when the injected callClassifier returns null", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Lease executed for 303 N Broadway",
      body: "All parties have signed.",
    })
    // After the DeepSeek wiring landed, the real `callClassifier` either
    // returns a validated value, returns null on parse/validation
    // failure, or throws. The `stub_no_response` reason is still wired
    // and we exercise it here by injecting a callFn that resolves to
    // null (exactly what the real call does on a JSON-parse failure
    // before it could be validated).
    const callClassifierFn = vi.fn().mockResolvedValue(null)
    const out = await runClosedDealClassifier("c1", { callClassifierFn })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe("stub_no_response")
  })

  it("returns validation_failed when the AI emits a bad payload", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Closed",
      body: "Lease commenced today.",
    })
    const callClassifierFn = vi.fn().mockResolvedValue({
      // Nonsense classification should be rejected by validator.
      classification: "totally_made_up",
      confidence: 0.9,
      signals: [],
    } as never)
    const out = await runClosedDealClassifier("c1", { callClassifierFn })
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.reason).toBe("validation_failed")
      expect(out.details).toMatch(/classification_invalid:/)
    }
  })

  it("returns provider_error when the underlying call throws", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Closed",
      body: "ok",
    })
    const callClassifierFn = vi
      .fn()
      .mockRejectedValue(new Error("network down"))
    const out = await runClosedDealClassifier("c1", { callClassifierFn })
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.reason).toBe("provider_error")
      expect(out.details).toBe("network down")
    }
  })

  it("returns the validated classification on the happy path", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Lease fully executed — 303 N Broadway",
      body: "Both parties signed; commencement Jan 1.",
    })
    const callClassifierFn = vi.fn().mockResolvedValue({
      classification: "closed_lease",
      confidence: 0.93,
      signals: ["fully executed", "commencement"],
    } as never)
    const out = await runClosedDealClassifier("c1", { callClassifierFn })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.result.classification).toBe("closed_lease")
      expect(out.result.confidence).toBe(0.93)
      expect(out.result.signals).toEqual(["fully executed", "commencement"])
      expect(out.modelUsed).toBe("deepseek-chat")
    }
  })
})
