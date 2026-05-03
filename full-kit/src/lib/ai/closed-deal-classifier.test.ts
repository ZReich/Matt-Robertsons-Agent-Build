import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { db } from "@/lib/prisma"

import {
  callClassifier,
  resolveClassifierModel,
  runClosedDealClassifier,
  validateClosedDealClassification,
} from "./closed-deal-classifier"

vi.mock("@/lib/prisma", () => ({
  db: {
    communication: {
      findUnique: vi.fn(),
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

describe("callClassifier (stub)", () => {
  it("returns null until the prompt is wired", async () => {
    const out = await callClassifier("subject", "body")
    expect(out).toBeNull()
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

  it("returns stub_no_response when the underlying callClassifier returns null", async () => {
    mockedFindUnique.mockResolvedValue({
      id: "c1",
      subject: "Lease executed for 303 N Broadway",
      body: "All parties have signed.",
    })
    const out = await runClosedDealClassifier("c1")
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
    const callClassifierFn = vi.fn().mockRejectedValue(new Error("network down"))
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
