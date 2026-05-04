import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

// Hoisted fake Anthropic client so vi.mock can wire it before any
// `import` of the SDK in module-under-test code. Mirrors the pattern in
// lease-extractor.test.ts.
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

vi.mock("@/lib/prisma", () => ({
  db: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    scrubApiCall: {
      create: vi.fn().mockResolvedValue({ id: "log-pdf-1" }),
      update: vi.fn(),
    },
  },
}))

import { db } from "@/lib/prisma"

import { LEASE_EXTRACTOR_VERSION } from "./lease-extractor"
import { extractLeaseFromPdf } from "./pdf-lease-extractor"

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
  confidence: 0.92,
  reasoning: "Lease document, term Feb 1 2026 – Jan 31 2031, monthly rent $4,500.",
}

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
      input_tokens: overrides.usage?.input_tokens ?? 4500,
      output_tokens: overrides.usage?.output_tokens ?? 240,
      cache_read_input_tokens: overrides.usage?.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens:
        overrides.usage?.cache_creation_input_tokens ?? 0,
    },
    content: [{ type: "tool_use", name: "extract_lease", input }],
  }
}

/**
 * Build a minimum-viable PDF buffer that passes the magic-byte sniff.
 * The contents past the header don't matter for unit tests because the
 * Anthropic call is mocked; what matters is that the sniff lets it
 * through and the SDK receives the base64-encoded bytes back.
 */
function makeFakePdf(payload = "hello pdf body"): Buffer {
  return Buffer.concat([
    Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]), // %PDF-
    Buffer.from(`1.4\n${payload}\n%%EOF\n`),
  ])
}

const ORIGINAL_ENV = { ...process.env }

describe("extractLeaseFromPdf", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key"
    delete process.env.ANTHROPIC_LEASE_EXTRACTOR_MODEL
    mockMessagesCreate.mockReset()
    ;(db.scrubApiCall.create as ReturnType<typeof vi.fn>).mockClear()
    ;(db.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockClear()
    ;(db.scrubApiCall.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "log-pdf-1",
    })
    ;(db.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(1)
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("happy path: ships the PDF as a document content block and returns the validated extraction", async () => {
    mockMessagesCreate.mockResolvedValueOnce(buildToolUseResponse(VALID_LEASE))

    const pdf = makeFakePdf("dummy lease body")
    const out = await extractLeaseFromPdf({
      pdf,
      classification: "closed_lease",
      signals: ["fully executed", "commencement"],
      subject: "Lease executed — 303 N Broadway",
      bodyExcerpt: "Brandon signed today, lease starts Feb 1.",
    })

    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.result.contactName).toBe("Brandon Miller")
      expect(out.result.dealKind).toBe("lease")
      expect(out.result.leaseTermMonths).toBe(60)
      expect(out.modelUsed).toBe("claude-haiku-4-5-20251001")
    }

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
    const args = mockMessagesCreate.mock.calls[0][0]

    // Wiring assertions — model, schema, prompt, and tool_choice all
    // reuse the body extractor's pieces.
    expect(args.model).toBe("claude-haiku-4-5-20251001")
    expect(args.temperature).toBe(0)
    expect(args.max_tokens).toBe(1024)
    expect(args.tool_choice).toEqual({ type: "tool", name: "extract_lease" })
    expect(args.tools).toHaveLength(1)
    expect(args.tools[0].name).toBe("extract_lease")
    expect(args.tools[0].input_schema.required).toContain("contactName")

    expect(args.system[0].type).toBe("text")
    expect(args.system[0].cache_control).toEqual({ type: "ephemeral" })
    expect(args.system[0].text.length).toBeGreaterThan(2000)

    // The user content is an ARRAY: [document, text].
    expect(args.messages).toHaveLength(1)
    expect(args.messages[0].role).toBe("user")
    const content = args.messages[0].content
    expect(Array.isArray(content)).toBe(true)
    expect(content).toHaveLength(2)

    const docBlock = content[0]
    expect(docBlock.type).toBe("document")
    expect(docBlock.source).toEqual({
      type: "base64",
      media_type: "application/pdf",
      data: pdf.toString("base64"),
    })
    expect(docBlock.cache_control).toEqual({ type: "ephemeral" })

    const textBlock = content[1]
    expect(textBlock.type).toBe("text")
    expect(textBlock.text).toContain("SUBJECT:")
    expect(textBlock.text).toContain("Lease executed — 303 N Broadway")
    expect(textBlock.text).toContain("BODY:")
    expect(textBlock.text).toContain("Brandon signed today, lease starts Feb 1.")
    expect(textBlock.text).toContain("CLASSIFICATION: closed_lease")
    expect(textBlock.text).toContain(
      `SIGNALS: ${JSON.stringify(["fully executed", "commencement"])}`
    )
  })

  it("uses the no-body sentinel when bodyExcerpt is omitted", async () => {
    mockMessagesCreate.mockResolvedValueOnce(buildToolUseResponse(VALID_LEASE))
    await extractLeaseFromPdf({
      pdf: makeFakePdf(),
      classification: "closed_lease",
      signals: [],
      subject: "no body",
    })
    const textBlock =
      mockMessagesCreate.mock.calls[0][0].messages[0].content[1]
    expect(textBlock.text).toContain("(extracted from PDF only — no body excerpt)")
  })

  it("logs extractor-pdf-ok with Haiku-priced USD on success", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      buildToolUseResponse(VALID_LEASE, {
        usage: {
          input_tokens: 1_000_000,
          output_tokens: 0,
        },
      })
    )

    await extractLeaseFromPdf({
      pdf: makeFakePdf(),
      classification: "closed_lease",
      signals: [],
      subject: "s",
    })

    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0][0]
    expect(args.data.outcome).toBe("extractor-pdf-ok")
    expect(args.data.modelUsed).toBe("claude-haiku-4-5-20251001")
    expect(args.data.promptVersion).toBe(LEASE_EXTRACTOR_VERSION)
    expect(args.data.tokensIn).toBe(1_000_000)
    expect(args.data.tokensOut).toBe(0)
    // Haiku 4.5 input pricing: $1.00/M tokens.
    expect(parseFloat(args.data.estimatedUsd)).toBeCloseTo(1.0, 4)
  })

  it("returns file_too_large and stamps extractor-pdf-skipped without calling Anthropic when the PDF exceeds 32MB", async () => {
    const oversize = Buffer.alloc(32 * 1024 * 1024 + 1, 0x20)
    // Stamp magic bytes so we know we're rejecting on size, not magic.
    Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]).copy(oversize, 0)

    const out = await extractLeaseFromPdf({
      pdf: oversize,
      classification: "closed_lease",
      signals: [],
      subject: "huge",
    })

    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.reason).toBe("file_too_large")
      expect(out.details).toMatch(/cap 33554432/)
    }
    expect(mockMessagesCreate).not.toHaveBeenCalled()

    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].data.outcome).toBe("extractor-pdf-skipped")
    expect(create.mock.calls[0][0].data.tokensIn).toBe(0)
    expect(create.mock.calls[0][0].data.tokensOut).toBe(0)
    expect(parseFloat(create.mock.calls[0][0].data.estimatedUsd)).toBe(0)
  })

  it("returns not_pdf and stamps extractor-pdf-skipped when the magic bytes are missing", async () => {
    const docx = Buffer.from("PK\x03\x04 not a pdf at all")
    const out = await extractLeaseFromPdf({
      pdf: docx,
      classification: "closed_lease",
      signals: [],
      subject: "renamed docx",
    })

    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe("not_pdf")
    expect(mockMessagesCreate).not.toHaveBeenCalled()

    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].data.outcome).toBe("extractor-pdf-skipped")
  })

  it("returns provider_error and stamps extractor-pdf-provider-error when the SDK throws", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("anthropic 503"))

    const out = await extractLeaseFromPdf({
      pdf: makeFakePdf(),
      classification: "closed_lease",
      signals: [],
      subject: "s",
    })

    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.reason).toBe("provider_error")
      expect(out.details).toBe("anthropic 503")
    }

    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].data.outcome).toBe(
      "extractor-pdf-provider-error"
    )
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('"metadata"'),
      JSON.stringify({ details: "anthropic 503" }),
      "log-pdf-1"
    )
  })

  it("returns stub_no_response and stamps extractor-pdf-validation-failed when the response carries no tool_use", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      model: "claude-haiku-4-5-20251001",
      usage: {
        input_tokens: 5000,
        output_tokens: 30,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      content: [{ type: "text", text: "I don't think this is a lease." }],
    })

    const out = await extractLeaseFromPdf({
      pdf: makeFakePdf(),
      classification: "closed_lease",
      signals: [],
      subject: "s",
    })

    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe("stub_no_response")

    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].data.outcome).toBe(
      "extractor-pdf-validation-failed"
    )
  })

  it("returns validation_failed and stamps extractor-pdf-validation-failed when the validator rejects the tool input", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      buildToolUseResponse({
        ...VALID_LEASE,
        leaseEndDate: "next year", // malformed → validator rejects
      })
    )

    const out = await extractLeaseFromPdf({
      pdf: makeFakePdf(),
      classification: "closed_lease",
      signals: [],
      subject: "s",
    })

    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.reason).toBe("validation_failed")
      expect(out.details).toMatch(/leaseEndDate_malformed/)
    }

    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].data.outcome).toBe(
      "extractor-pdf-validation-failed"
    )
  })

  it("propagates the dealKind expectation from the classification (closed_sale → expectedDealKind=sale)", async () => {
    // Send a "lease" payload but classify as closed_sale → validator
    // catches the mismatch and we surface validation_failed.
    mockMessagesCreate.mockResolvedValueOnce(buildToolUseResponse(VALID_LEASE))

    const out = await extractLeaseFromPdf({
      pdf: makeFakePdf(),
      classification: "closed_sale",
      signals: [],
      subject: "s",
    })

    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.reason).toBe("validation_failed")
      expect(out.details).toMatch(/dealKind_mismatch/)
    }
  })

  it("does not throw when the telemetry insert itself fails (non-fatal log)", async () => {
    mockMessagesCreate.mockResolvedValueOnce(buildToolUseResponse(VALID_LEASE))
    ;(db.scrubApiCall.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("db down")
    )

    const out = await extractLeaseFromPdf({
      pdf: makeFakePdf(),
      classification: "closed_lease",
      signals: [],
      subject: "s",
    })

    // Telemetry failure must not eat the result.
    expect(out.ok).toBe(true)
  })

  it("awaits the telemetry write on the provider-error path (I-1 regression)", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("anthropic timeout"))
    const create = db.scrubApiCall.create as ReturnType<typeof vi.fn>
    create.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return {} as never
    })

    await extractLeaseFromPdf({
      pdf: makeFakePdf(),
      classification: "closed_lease",
      signals: [],
      subject: "s",
    })

    // Telemetry ran before the function returned.
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].data.outcome).toBe(
      "extractor-pdf-provider-error"
    )
  })
})
