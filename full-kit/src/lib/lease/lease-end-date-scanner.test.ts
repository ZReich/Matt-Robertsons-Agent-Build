import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type {
  AttachmentMeta,
  ScanMissingDealRow,
  SearchedMessage,
} from "./lease-end-date-scanner"

import { db } from "@/lib/prisma"

import {
  buildGraphSearchValue,
  scanMissingLeaseEndDates,
} from "./lease-end-date-scanner"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/prisma", () => ({
  db: {
    leaseRecord: {
      update: vi.fn(),
      create: vi.fn(),
    },
    scrubApiCall: {
      aggregate: vi.fn(),
    },
  },
}))

const mockedDb = db as unknown as {
  leaseRecord: {
    update: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  scrubApiCall: {
    aggregate: ReturnType<typeof vi.fn>
  }
}

function dealRow(
  overrides: Partial<ScanMissingDealRow> = {}
): ScanMissingDealRow {
  return {
    dealId: "deal-1",
    buildoutDealId: "BO-100",
    dealName: "303 N Broadway | Suite 200",
    searchTerms: ["303 N Broadway", "Hudson Tenant LLC"],
    existingLeaseRecordId: "lr-1",
    contactId: "contact-1",
    propertyId: "prop-1",
    closeDate: new Date("2024-01-15T00:00:00.000Z"),
    expectedDealKind: "lease",
    ...overrides,
  }
}

function pdfBlob(name = "lease.pdf", size = 1024) {
  return {
    id: "att-1",
    name,
    contentType: "application/pdf",
    size,
    contentBytes: Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
      Buffer.alloc(size - 5),
    ]),
  }
}

function leaseExtraction(overrides: Record<string, unknown> = {}) {
  return {
    contactName: "Hudson Tenant LLC",
    contactEmail: null,
    propertyAddress: "303 N Broadway",
    closeDate: "2024-01-15",
    leaseStartDate: "2024-02-01",
    leaseEndDate: "2029-01-31",
    leaseTermMonths: 60,
    rentAmount: 5000,
    rentPeriod: "monthly" as const,
    mattRepresented: "owner" as const,
    dealKind: "lease" as const,
    confidence: 0.92,
    reasoning: "End date plainly stated in PDF",
    ...overrides,
  }
}

beforeEach(() => {
  mockedDb.leaseRecord.update.mockReset()
  mockedDb.leaseRecord.create.mockReset()
  mockedDb.scrubApiCall.aggregate.mockReset()
  mockedDb.leaseRecord.update.mockResolvedValue({
    id: "lr-1",
    notes: null,
  })
  mockedDb.leaseRecord.create.mockResolvedValue({ id: "lr-new" })
  mockedDb.scrubApiCall.aggregate.mockResolvedValue({
    _sum: { estimatedUsd: 0 },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("buildGraphSearchValue", () => {
  it("quotes each term as an exact phrase joined by OR", () => {
    expect(buildGraphSearchValue(["303 N Broadway", "Hudson"])).toBe(
      '"303 N Broadway" OR "Hudson"'
    )
  })

  it("dedupes, trims, drops too-short tokens, and replaces inner quotes", () => {
    expect(
      buildGraphSearchValue([
        "303 N Broadway",
        " 303 N Broadway ",
        "ab",
        '  "Acme" Realty  ',
        "",
      ])
    ).toBe('"303 N Broadway" OR "Acme Realty"')
  })
})

describe("scanMissingLeaseEndDates", () => {
  it("happy path: search→PDF→extract updates the existing LeaseRecord", async () => {
    const searchMessagesFn = vi.fn(
      async (): Promise<SearchedMessage[]> => [
        {
          id: "msg-1",
          subject: "Executed lease — 303 N Broadway",
          receivedDateTime: "2024-02-01T15:00:00Z",
          hasAttachments: true,
        },
      ]
    )
    const fetchMessageAttachmentsFn = vi.fn(
      async (): Promise<AttachmentMeta[]> => [
        {
          id: "att-1",
          name: "executed-lease.pdf",
          contentType: "application/pdf",
          size: 1024,
        },
      ]
    )
    const downloadAttachmentFn = vi.fn(async () => pdfBlob())
    const extractLeaseFromPdfFn = vi.fn(async () => ({
      ok: true as const,
      result: leaseExtraction(),
      modelUsed: "claude-haiku-4-5",
    }))

    const result = await scanMissingLeaseEndDates({
      dealRows: [dealRow()],
      throttleMs: 0,
      searchMessagesFn,
      fetchMessageAttachmentsFn,
      downloadAttachmentFn,
      extractLeaseFromPdfFn: extractLeaseFromPdfFn as never,
      assertWithinBudgetFn: vi.fn(async () => {}),
      sleepFn: vi.fn(async () => {}),
    })

    expect(result.outcomes).toHaveLength(1)
    expect(result.outcomes[0]).toMatchObject({
      dealId: "deal-1",
      status: "updated",
      leaseRecordId: "lr-1",
      leaseEndDate: "2029-01-31",
      leaseStartDate: "2024-02-01",
      messagesScanned: 1,
      pdfsAttempted: 1,
    })
    expect(result.totals.updated).toBe(1)
    expect(mockedDb.leaseRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lr-1" },
        data: expect.objectContaining({
          leaseEndDate: new Date("2029-01-31"),
          leaseStartDate: new Date("2024-02-01"),
          leaseTermMonths: 60,
          rentPeriod: "monthly",
        }),
      })
    )
    expect(extractLeaseFromPdfFn).toHaveBeenCalledTimes(1)
  })

  it("creates a new LeaseRecord when none exists", async () => {
    const searchMessagesFn = vi.fn(
      async (): Promise<SearchedMessage[]> => [
        {
          id: "msg-1",
          subject: "Lease",
          receivedDateTime: "2024-02-01T15:00:00Z",
          hasAttachments: true,
        },
      ]
    )
    const fetchMessageAttachmentsFn = vi.fn(
      async (): Promise<AttachmentMeta[]> => [
        { id: "att-1", name: "l.pdf", contentType: "application/pdf", size: 1 },
      ]
    )

    const result = await scanMissingLeaseEndDates({
      dealRows: [dealRow({ existingLeaseRecordId: null })],
      throttleMs: 0,
      searchMessagesFn,
      fetchMessageAttachmentsFn,
      downloadAttachmentFn: vi.fn(async () => pdfBlob()),
      extractLeaseFromPdfFn: vi.fn(async () => ({
        ok: true as const,
        result: leaseExtraction(),
        modelUsed: "claude-haiku-4-5",
      })) as never,
      assertWithinBudgetFn: vi.fn(async () => {}),
      sleepFn: vi.fn(async () => {}),
    })

    expect(result.outcomes[0]?.status).toBe("created")
    expect(result.outcomes[0]?.leaseRecordId).toBe("lr-new")
    expect(mockedDb.leaseRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: "contact-1",
          dealId: "deal-1",
          leaseEndDate: new Date("2029-01-31"),
        }),
      })
    )
  })

  it("returns no_messages when Graph $search returns nothing", async () => {
    const result = await scanMissingLeaseEndDates({
      dealRows: [dealRow()],
      throttleMs: 0,
      searchMessagesFn: vi.fn(async () => []),
      fetchMessageAttachmentsFn: vi.fn(async () => []),
      downloadAttachmentFn: vi.fn(async () => pdfBlob()),
      extractLeaseFromPdfFn: vi.fn() as never,
      assertWithinBudgetFn: vi.fn(async () => {}),
      sleepFn: vi.fn(async () => {}),
    })
    expect(result.outcomes[0]?.status).toBe("no_messages")
    expect(result.totals.noMessages).toBe(1)
    expect(mockedDb.leaseRecord.update).not.toHaveBeenCalled()
  })

  it("returns no_pdf_found when messages have only non-PDF attachments", async () => {
    const result = await scanMissingLeaseEndDates({
      dealRows: [dealRow()],
      throttleMs: 0,
      searchMessagesFn: vi.fn(async () => [
        {
          id: "msg-1",
          subject: "lease",
          receivedDateTime: "2024-02-01T15:00:00Z",
          hasAttachments: true,
        },
      ]),
      fetchMessageAttachmentsFn: vi.fn(async () => [
        {
          id: "att-1",
          name: "lease.docx",
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 1,
        },
      ]),
      downloadAttachmentFn: vi.fn(async () => pdfBlob()),
      extractLeaseFromPdfFn: vi.fn() as never,
      assertWithinBudgetFn: vi.fn(async () => {}),
      sleepFn: vi.fn(async () => {}),
    })
    expect(result.outcomes[0]?.status).toBe("no_pdf_found")
    expect(result.totals.noPdf).toBe(1)
  })

  it("returns extractor_failed when the PDF extractor returns ok:false", async () => {
    const extractLeaseFromPdfFn = vi.fn(async () => ({
      ok: false as const,
      reason: "validation_failed" as const,
      details: "model returned no end date",
    }))
    const result = await scanMissingLeaseEndDates({
      dealRows: [dealRow()],
      throttleMs: 0,
      searchMessagesFn: vi.fn(async () => [
        {
          id: "msg-1",
          subject: "lease",
          receivedDateTime: "2024-02-01T15:00:00Z",
          hasAttachments: true,
        },
      ]),
      fetchMessageAttachmentsFn: vi.fn(async () => [
        {
          id: "att-1",
          name: "lease.pdf",
          contentType: "application/pdf",
          size: 1,
        },
      ]),
      downloadAttachmentFn: vi.fn(async () => pdfBlob()),
      extractLeaseFromPdfFn: extractLeaseFromPdfFn as never,
      assertWithinBudgetFn: vi.fn(async () => {}),
      sleepFn: vi.fn(async () => {}),
    })
    expect(result.outcomes[0]?.status).toBe("extractor_failed")
    expect(result.outcomes[0]?.pdfsAttempted).toBe(1)
    expect(result.outcomes[0]?.reasoning).toContain("validation_failed")
  })

  it("respects maxPdfsPerDeal cap when many PDFs are found", async () => {
    // 1 message, 10 PDFs — only 3 should be attempted.
    const extractLeaseFromPdfFn = vi.fn(async () => ({
      ok: false as const,
      reason: "validation_failed" as const,
    }))
    const downloadAttachmentFn = vi.fn(async () => pdfBlob())

    const result = await scanMissingLeaseEndDates({
      dealRows: [dealRow()],
      throttleMs: 0,
      maxPdfsPerDeal: 3,
      searchMessagesFn: vi.fn(async () => [
        {
          id: "msg-1",
          subject: "lease",
          receivedDateTime: "2024-02-01T15:00:00Z",
          hasAttachments: true,
        },
      ]),
      fetchMessageAttachmentsFn: vi.fn(async () =>
        Array.from({ length: 10 }, (_, i) => ({
          id: `att-${i}`,
          name: `doc-${i}.pdf`,
          contentType: "application/pdf",
          size: 100 + i,
        }))
      ),
      downloadAttachmentFn,
      extractLeaseFromPdfFn: extractLeaseFromPdfFn as never,
      assertWithinBudgetFn: vi.fn(async () => {}),
      sleepFn: vi.fn(async () => {}),
    })

    expect(extractLeaseFromPdfFn).toHaveBeenCalledTimes(3)
    expect(result.outcomes[0]?.pdfsAttempted).toBe(3)
    expect(result.outcomes[0]?.status).toBe("extractor_failed")
  })

  it("throttles between deals (sleepFn called N-1 times for N deals)", async () => {
    const sleepFn = vi.fn(async () => {})
    await scanMissingLeaseEndDates({
      dealRows: [
        dealRow({ dealId: "d1" }),
        dealRow({ dealId: "d2" }),
        dealRow({ dealId: "d3" }),
      ],
      throttleMs: 1500,
      searchMessagesFn: vi.fn(async () => []),
      fetchMessageAttachmentsFn: vi.fn(async () => []),
      downloadAttachmentFn: vi.fn(async () => pdfBlob()),
      extractLeaseFromPdfFn: vi.fn() as never,
      assertWithinBudgetFn: vi.fn(async () => {}),
      sleepFn,
    })

    expect(sleepFn).toHaveBeenCalledTimes(2)
    expect(sleepFn).toHaveBeenCalledWith(1500)
  })

  it("skips creating an LR when no contactId is available", async () => {
    const result = await scanMissingLeaseEndDates({
      dealRows: [dealRow({ existingLeaseRecordId: null, contactId: null })],
      throttleMs: 0,
      searchMessagesFn: vi.fn(async () => [
        {
          id: "msg-1",
          subject: "lease",
          receivedDateTime: "2024-02-01T15:00:00Z",
          hasAttachments: true,
        },
      ]),
      fetchMessageAttachmentsFn: vi.fn(async () => [
        {
          id: "att-1",
          name: "lease.pdf",
          contentType: "application/pdf",
          size: 1,
        },
      ]),
      downloadAttachmentFn: vi.fn(async () => pdfBlob()),
      extractLeaseFromPdfFn: vi.fn(async () => ({
        ok: true as const,
        result: leaseExtraction(),
        modelUsed: "claude-haiku-4-5",
      })) as never,
      assertWithinBudgetFn: vi.fn(async () => {}),
      sleepFn: vi.fn(async () => {}),
    })

    expect(result.outcomes[0]?.status).toBe("skipped")
    expect(mockedDb.leaseRecord.create).not.toHaveBeenCalled()
  })
})
