import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { db } from "@/lib/prisma"

import {
  callExtractor,
  resolveExtractorModel,
  runLeaseExtraction,
  validateLeaseExtraction,
} from "./lease-extractor"

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

describe("callExtractor (stub)", () => {
  it("returns null until the prompt is wired", async () => {
    const out = await callExtractor({
      subject: "x",
      body: "y",
      classification: "closed_lease",
      signals: [],
    })
    expect(out).toBeNull()
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
    const out = await runLeaseExtraction("c1", "closed_lease")
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
