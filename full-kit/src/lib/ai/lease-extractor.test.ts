import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

// Hoisted fake Anthropic client so vi.mock can wire it before any
// `import` of the SDK in module-under-test code.
const { mockMessagesCreate, MockAnthropicClass } = vi.hoisted(() => {
  const mockMessagesCreate = vi.fn()
  class MockAnthropicClass {
    messages = { create: mockMessagesCreate }
    constructor(_opts?: unknown) {}
  }
  return { mockMessagesCreate, MockAnthropicClass }
})

vi.mock("@anthropic-ai/sdk", () => ({
  default: MockAnthropicClass,
}))

import { db } from "@/lib/prisma"

import {
  callExtractor,
  estimateExtractorUsd,
  LEASE_EXTRACTOR_VERSION,
  resolveExtractorModel,
  runLeaseExtraction,
  validateLeaseExtraction,
} from "./lease-extractor"

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

const VALID_LEASE = {
  contactName: "Brandon Miller",
  contactEmail: "brandon@example.com",
  propertyAddress: "303 N Broadway, Billings MT",
  closeDate: "2026-01-15",
  leaseStartDate: "2026-02-01",
  leaseEndDate: "2031-01-31",
  leaseTermMonths: 60,
  rentAmount: 4500,
  rentPeriod: "monthly" as const,
  mattRepresented: "owner" as const,
  dealKind: "lease" as const,
  confidence: 0.88,
  reasoning: "Subject line says 'Lease fully executed' with both signatures.",
}

const VALID_SALE = {
  contactName: "Acme Holdings LLC",
  contactEmail: null,
  propertyAddress: "120 W Main, Billings MT",
  closeDate: "2026-03-10",
  leaseStartDate: null,
  leaseEndDate: null,
  leaseTermMonths: null,
  rentAmount: null,
  rentPeriod: null,
  mattRepresented: "owner" as const,
  dealKind: "sale" as const,
  confidence: 0.91,
  reasoning: "Closing statement attached, deed recorded 03/10.",
}

describe("validateLeaseExtraction — happy paths", () => {
  it("accepts a full lease record", () => {
    const r = validateLeaseExtraction(VALID_LEASE, "lease")
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.dealKind).toBe("lease")
      expect(r.value.leaseTermMonths).toBe(60)
    }
  })

  it("accepts a sale with all lease-only fields null", () => {
    const r = validateLeaseExtraction(VALID_SALE, "sale")
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.dealKind).toBe("sale")
      expect(r.value.rentAmount).toBeNull()
    }
  })

  it("normalizes empty-string optional fields to null", () => {
    const r = validateLeaseExtraction(
      { ...VALID_SALE, propertyAddress: "   ", contactEmail: "" },
      "sale"
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.propertyAddress).toBeNull()
      expect(r.value.contactEmail).toBeNull()
    }
  })
})

describe("validateLeaseExtraction — rejections", () => {
  it("rejects when contactName is empty", () => {
    const r = validateLeaseExtraction({ ...VALID_LEASE, contactName: "  " }, "lease")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("contactName_missing_or_empty")
  })

  it("rejects a malformed contactEmail (no @)", () => {
    const r = validateLeaseExtraction(
      { ...VALID_LEASE, contactEmail: "brandon at example dot com" },
      "lease"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/contactEmail_malformed/)
  })

  it("rejects a malformed closeDate", () => {
    const r = validateLeaseExtraction(
      { ...VALID_LEASE, closeDate: "Jan 15 2026" },
      "lease"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/closeDate_malformed/)
  })

  it("rejects a date that is shape-correct but invalid (Feb 30)", () => {
    const r = validateLeaseExtraction(
      { ...VALID_LEASE, leaseStartDate: "2026-02-30" },
      "lease"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/leaseStartDate_malformed/)
  })

  it("rejects when leaseEndDate precedes leaseStartDate", () => {
    const r = validateLeaseExtraction(
      {
        ...VALID_LEASE,
        leaseStartDate: "2026-02-01",
        leaseEndDate: "2026-01-15",
      },
      "lease"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/leaseEndDate_before_leaseStartDate/)
  })

  it("rejects a leaseTermMonths value that doesn't match the date range", () => {
    const r = validateLeaseExtraction(
      {
        ...VALID_LEASE,
        leaseStartDate: "2026-02-01",
        leaseEndDate: "2031-01-31",
        leaseTermMonths: 12, // actually 60
      },
      "lease"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/leaseTermMonths_mismatch/)
  })

  it("rejects a non-positive leaseTermMonths", () => {
    const r = validateLeaseExtraction(
      { ...VALID_LEASE, leaseTermMonths: 0 },
      "lease"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("leaseTermMonths_not_positive")
  })

  it("rejects confidence > 1", () => {
    const r = validateLeaseExtraction(
      { ...VALID_LEASE, confidence: 1.2 },
      "lease"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/confidence_out_of_range/)
  })

  it("rejects confidence < 0", () => {
    const r = validateLeaseExtraction(
      { ...VALID_LEASE, confidence: -0.1 },
      "lease"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/confidence_out_of_range/)
  })

  it("rejects an invalid mattRepresented enum", () => {
    const r = validateLeaseExtraction(
      { ...VALID_LEASE, mattRepresented: "landlord" },
      "lease"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/mattRepresented_invalid/)
  })

  it("rejects an invalid dealKind value", () => {
    const r = validateLeaseExtraction(
      { ...VALID_LEASE, dealKind: "rental" },
      "lease"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/dealKind_invalid/)
  })

  it("rejects a dealKind that disagrees with the upstream classifier", () => {
    const r = validateLeaseExtraction(VALID_LEASE, "sale")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/dealKind_mismatch/)
  })

  it("rejects a sale that still carries lease-only fields", () => {
    const r = validateLeaseExtraction(
      { ...VALID_SALE, leaseStartDate: "2026-04-01" },
      "sale"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("sale_has_lease_fields")
  })

  it("rejects a missing/empty reasoning string", () => {
    const r = validateLeaseExtraction({ ...VALID_LEASE, reasoning: "" }, "lease")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("reasoning_missing")
  })

  it("rejects an invalid rentPeriod value", () => {
    const r = validateLeaseExtraction(
      { ...VALID_LEASE, rentPeriod: "weekly" },
      "lease"
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/rentPeriod_invalid/)
  })
})

describe("callExtractor (Anthropic Haiku tool-use wiring)", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key"
    delete process.env.ANTHROPIC_LEASE_EXTRACTOR_MODEL
    mockMessagesCreate.mockReset()
    ;(db.scrubApiCall.create as ReturnType<typeof vi.fn>).mockClear()
    ;(db.scrubApiCall.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "log-1",
    })
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  function buildToolUseResponse(
    input: Record<string, unknown>,
    overrides: {
      model?: string
      usage?: {
        input_tokens?: number
        output_tokens?: number
        cache_read_input_tokens?: number
        cache_creation_input_tokens?: number
      }
    } = {}
  ) {
    return {
      model: overrides.model ?? "claude-haiku-4-5-20251001",
      usage: {
        input_tokens: overrides.usage?.input_tokens ?? 800,
        output_tokens: overrides.usage?.output_tokens ?? 220,
        cache_read_input_tokens: overrides.usage?.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens:
          overrides.usage?.cache_creation_input_tokens ?? 0,
      },
      content: [
        {
          type: "tool_use",
          name: "extract_lease",
          input,
        },
      ],
    }
  }

  it("calls Haiku with tool-use forced for extract_lease, prompt loaded from MD, temperature 0", async () => {
    mockMessagesCreate.mockResolvedValueOnce(buildToolUseResponse(VALID_LEASE))

    const out = await callExtractor({
      subject: "Lease fully executed — 303 N Broadway",
      body: "Brandon signed today.",
      classification: "closed_lease",
      signals: ["fully executed", "commencement"],
    })

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
    const args = mockMessagesCreate.mock.calls[0][0]

    expect(args.model).toBe("claude-haiku-4-5-20251001")
    expect(args.temperature).toBe(0)
    expect(args.max_tokens).toBeGreaterThan(0)
    expect(args.tool_choice).toEqual({ type: "tool", name: "extract_lease" })

    // tools array contains exactly the extract_lease tool with the right
    // schema shape.
    expect(Array.isArray(args.tools)).toBe(true)
    expect(args.tools).toHaveLength(1)
    expect(args.tools[0].name).toBe("extract_lease")
    expect(args.tools[0].input_schema.type).toBe("object")
    expect(args.tools[0].input_schema.required).toContain("contactName")
    expect(args.tools[0].input_schema.required).toContain("dealKind")
    expect(args.tools[0].input_schema.required).toContain("confidence")
    expect(args.tools[0].input_schema.required).toContain("reasoning")

    // System block is the prompt MD with cache_control set.
    expect(Array.isArray(args.system)).toBe(true)
    expect(args.system[0].type).toBe("text")
    expect(args.system[0].cache_control).toEqual({ type: "ephemeral" })
    // The prompt MD is non-trivial.
    expect(args.system[0].text.length).toBeGreaterThan(2000)

    // User content includes the four labelled sections.
    expect(args.messages).toHaveLength(1)
    expect(args.messages[0].role).toBe("user")
    const userText = args.messages[0].content as string
    expect(userText).toContain("SUBJECT:")
    expect(userText).toContain("Lease fully executed — 303 N Broadway")
    expect(userText).toContain("BODY:")
    expect(userText).toContain("Brandon signed today.")
    expect(userText).toContain("CLASSIFICATION: closed_lease")
    expect(userText).toContain("SIGNALS:")
    expect(userText).toContain(
      JSON.stringify(["fully executed", "commencement"])
    )

    // The validator-narrowed return matches what the SDK emitted.
    expect(out).toEqual(VALID_LEASE)
  })

  it("returns the raw tool input pre-validation; runLeaseExtraction narrows it via validateLeaseExtraction", async () => {
    mockMessagesCreate.mockResolvedValueOnce(buildToolUseResponse(VALID_LEASE))
    const out = await callExtractor({
      subject: "x",
      body: "y",
      classification: "closed_lease",
      signals: [],
    })
    // callExtractor returns the raw tool_use.input — runLeaseExtraction
    // is what runs the validator. Confirm shape here.
    const validated = validateLeaseExtraction(out, "lease")
    expect(validated.ok).toBe(true)
    if (validated.ok) {
      expect(validated.value.dealKind).toBe("lease")
      expect(validated.value.contactName).toBe("Brandon Miller")
    }
  })

  it("honors ANTHROPIC_LEASE_EXTRACTOR_MODEL override", async () => {
    process.env.ANTHROPIC_LEASE_EXTRACTOR_MODEL = "claude-3-5-haiku-latest"
    mockMessagesCreate.mockResolvedValueOnce(
      buildToolUseResponse(VALID_LEASE, { model: "claude-3-5-haiku-latest" })
    )
    await callExtractor({
      subject: "s",
      body: "b",
      classification: "closed_lease",
      signals: [],
    })
    expect(mockMessagesCreate.mock.calls[0][0].model).toBe(
      "claude-3-5-haiku-latest"
    )
  })

  it("returns null when the response carries no tool_use block", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      model: "claude-haiku-4-5-20251001",
      usage: {
        input_tokens: 200,
        output_tokens: 30,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      content: [{ type: "text", text: "I don't think this is a lease." }],
    })
    const out = await callExtractor({
      subject: "s",
      body: "b",
      classification: "closed_lease",
      signals: [],
    })
    expect(out).toBeNull()

    // Logs an extractor-validation-failed row.
    await Promise.resolve()
    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "extractor-validation-failed" }),
      })
    )
  })

  it("logs a ScrubApiCall row on success with extractor-ok and Haiku-priced USD", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      buildToolUseResponse(VALID_LEASE, {
        usage: {
          input_tokens: 1_000_000,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      })
    )
    await callExtractor({
      subject: "s",
      body: "b",
      classification: "closed_lease",
      signals: [],
    })

    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.data.outcome).toBe("extractor-ok")
    expect(args.data.modelUsed).toBe("claude-haiku-4-5-20251001")
    expect(args.data.promptVersion).toBe(LEASE_EXTRACTOR_VERSION)
    expect(args.data.tokensIn).toBe(1_000_000)
    expect(args.data.tokensOut).toBe(0)
    // Haiku 4.5 input pricing: $1.00/M.
    expect(parseFloat(args.data.estimatedUsd)).toBeCloseTo(1.0, 4)
  })

  it("logs extractor-provider-error and rethrows when the SDK throws", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("anthropic 503"))

    await expect(
      callExtractor({
        subject: "s",
        body: "b",
        classification: "closed_lease",
        signals: [],
      })
    ).rejects.toThrow(/anthropic 503/)

    await Promise.resolve()
    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "extractor-provider-error" }),
      })
    )
  })

  it("does not throw when telemetry write fails (non-fatal log)", async () => {
    mockMessagesCreate.mockResolvedValueOnce(buildToolUseResponse(VALID_LEASE))
    ;(db.scrubApiCall.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("db down")
    )
    const out = await callExtractor({
      subject: "s",
      body: "b",
      classification: "closed_lease",
      signals: [],
    })
    // Telemetry failure must not eat the result.
    expect(out).toEqual(VALID_LEASE)
  })
})

describe("estimateExtractorUsd (Haiku 4.5 pricing)", () => {
  it("prices input @ $1.00/M, output @ $5.00/M, cache reads @ $0.10/M, cache writes @ $1.25/M", () => {
    expect(
      estimateExtractorUsd({
        tokensIn: 1_000_000,
        tokensOut: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      })
    ).toBeCloseTo(1.0, 4)
    expect(
      estimateExtractorUsd({
        tokensIn: 0,
        tokensOut: 1_000_000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      })
    ).toBeCloseTo(5.0, 4)
    expect(
      estimateExtractorUsd({
        tokensIn: 0,
        tokensOut: 0,
        cacheReadTokens: 1_000_000,
        cacheWriteTokens: 0,
      })
    ).toBeCloseTo(0.1, 4)
    expect(
      estimateExtractorUsd({
        tokensIn: 0,
        tokensOut: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 1_000_000,
      })
    ).toBeCloseTo(1.25, 4)
  })

  it("subtracts cache reads from the priced input total (matches scrub estimator)", () => {
    // 800 input tokens of which 600 came from cache → 200 priced @ $1/M
    // + 600 priced @ $0.10/M.
    const usd = estimateExtractorUsd({
      tokensIn: 800,
      tokensOut: 0,
      cacheReadTokens: 600,
      cacheWriteTokens: 0,
    })
    // 200 / 1M * 1.0 + 600 / 1M * 0.1 = 0.0002 + 0.00006 = 0.00026
    expect(usd).toBeCloseTo(0.00026, 6)
  })
})

describe("resolveExtractorModel", () => {
  it("defaults to claude-haiku-4-5-20251001", () => {
    delete process.env.ANTHROPIC_LEASE_EXTRACTOR_MODEL
    expect(resolveExtractorModel()).toBe("claude-haiku-4-5-20251001")
  })

  it("honors the override env var", () => {
    process.env.ANTHROPIC_LEASE_EXTRACTOR_MODEL = "claude-3-5-haiku-latest"
    expect(resolveExtractorModel()).toBe("claude-3-5-haiku-latest")
    delete process.env.ANTHROPIC_LEASE_EXTRACTOR_MODEL
  })
})

describe("runLeaseExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects the wrong upstream classification", async () => {
    const out = await runLeaseExtraction("c1", "not_a_deal")
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe("wrong_classification")
    expect(mockedFindUnique).not.toHaveBeenCalled()
  })

  it("returns missing_communication when no row matches", async () => {
    mockedFindUnique.mockResolvedValue(null)
    const out = await runLeaseExtraction("c1", "closed_lease")
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe("missing_communication")
  })

  it("gates raw-sensitive-data emails before calling the AI", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Closing — wire instructions",
      body: "Wire instructions: routing 123456789 account 9876543210.",
    })
    const callExtractorFn = vi.fn()
    const out = await runLeaseExtraction("c1", "closed_lease", {
      callExtractorFn,
    })
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.reason).toBe("sensitive_content")
      expect(out.sensitiveReasons?.length ?? 0).toBeGreaterThan(0)
    }
    expect(callExtractorFn).not.toHaveBeenCalled()
  })

  it("returns stub_no_response when the underlying extractor returns null", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Lease executed",
      body: "Both parties signed.",
    })
    // After the Haiku wiring landed, the real `callExtractor` either
    // returns the raw tool_use input or throws. The `stub_no_response`
    // reason fires when the extractor returns null (no tool_use block
    // in the response). Inject a callFn returning null to exercise it.
    const callExtractorFn = vi.fn().mockResolvedValue(null)
    const out = await runLeaseExtraction("c1", "closed_lease", {
      callExtractorFn,
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe("stub_no_response")
  })

  it("returns the validated extraction on a full lease happy path", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Lease executed — 303 N Broadway",
      body: "Brandon signed today, lease starts Feb 1.",
    })
    const callExtractorFn = vi
      .fn()
      .mockResolvedValue(VALID_LEASE as never)
    const out = await runLeaseExtraction("c1", "closed_lease", {
      callExtractorFn,
      signals: ["fully executed"],
    })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.result.contactName).toBe("Brandon Miller")
      expect(out.result.dealKind).toBe("lease")
      expect(out.result.leaseTermMonths).toBe(60)
      expect(out.modelUsed).toBe("claude-haiku-4-5-20251001")
    }
    expect(callExtractorFn).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: "closed_lease",
        signals: ["fully executed"],
      })
    )
  })

  it("returns the validated extraction on a sale (no lease dates)", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c2",
      subject: "Closed escrow — 120 W Main",
      body: "Deed recorded today.",
    })
    const callExtractorFn = vi.fn().mockResolvedValue(VALID_SALE as never)
    const out = await runLeaseExtraction("c2", "closed_sale", {
      callExtractorFn,
    })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.result.dealKind).toBe("sale")
      expect(out.result.leaseStartDate).toBeNull()
      expect(out.result.leaseEndDate).toBeNull()
      expect(out.result.rentAmount).toBeNull()
    }
  })

  it("rejects a malformed-date payload through validation_failed", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Lease executed",
      body: "ok",
    })
    const callExtractorFn = vi.fn().mockResolvedValue({
      ...VALID_LEASE,
      leaseEndDate: "next year",
    } as never)
    const out = await runLeaseExtraction("c1", "closed_lease", {
      callExtractorFn,
    })
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.reason).toBe("validation_failed")
      expect(out.details).toMatch(/leaseEndDate_malformed/)
    }
  })

  it("rejects a confidence floor violation through validation_failed", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Lease executed",
      body: "ok",
    })
    const callExtractorFn = vi
      .fn()
      .mockResolvedValue({ ...VALID_LEASE, confidence: 1.5 } as never)
    const out = await runLeaseExtraction("c1", "closed_lease", {
      callExtractorFn,
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.details).toMatch(/confidence_out_of_range/)
  })

  it("propagates dealKind mismatch from the AI as validation_failed", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Closed escrow",
      body: "ok",
    })
    const callExtractorFn = vi.fn().mockResolvedValue({
      ...VALID_LEASE,
      // Classifier says closed_sale but AI insists it's a lease.
    } as never)
    const out = await runLeaseExtraction("c1", "closed_sale", {
      callExtractorFn,
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.details).toMatch(/dealKind_mismatch/)
  })

  it("returns provider_error when the underlying call throws", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Lease executed",
      body: "ok",
    })
    const callExtractorFn = vi
      .fn()
      .mockRejectedValue(new Error("anthropic 503"))
    const out = await runLeaseExtraction("c1", "closed_lease", {
      callExtractorFn,
    })
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.reason).toBe("provider_error")
      expect(out.details).toBe("anthropic 503")
    }
  })
})
