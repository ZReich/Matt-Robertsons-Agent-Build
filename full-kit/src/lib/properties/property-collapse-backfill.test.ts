import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { runPropertyCollapseBackfill } from "./property-collapse-backfill"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/prisma", () => ({
  db: {
    deal: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    property: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leaseRecord: {
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    calendarEvent: {
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

type AnyMock = ReturnType<typeof vi.fn>

const mockedDb = db as unknown as {
  deal: { findMany: AnyMock; update: AnyMock }
  property: {
    findFirst: AnyMock
    findUnique: AnyMock
    findMany: AnyMock
    create: AnyMock
    update: AnyMock
  }
  leaseRecord: { updateMany: AnyMock; count: AnyMock }
  calendarEvent: { updateMany: AnyMock; count: AnyMock }
  $transaction: AnyMock
}

/**
 * The helper opens one Prisma transaction per deal. We model that here by
 * having `$transaction(fn)` immediately invoke `fn(tx)` where `tx` is the
 * same mocked db. That mirrors how Prisma actually behaves and keeps the
 * test straightforward.
 */
function wireTransactionPassthrough(): void {
  mockedDb.$transaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn === "function") {
      return await (fn as (tx: typeof db) => Promise<unknown>)(db)
    }
    return undefined
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Sensible defaults — every test overrides what matters.
  mockedDb.property.findMany.mockResolvedValue([])
  mockedDb.leaseRecord.updateMany.mockResolvedValue({ count: 0 })
  mockedDb.calendarEvent.updateMany.mockResolvedValue({ count: 0 })
  mockedDb.leaseRecord.count.mockResolvedValue(0)
  mockedDb.calendarEvent.count.mockResolvedValue(0)
  wireTransactionPassthrough()
})

describe("runPropertyCollapseBackfill", () => {
  it("reassigns a deal whose title carries a Suite suffix to a NEW Property with that unit", async () => {
    mockedDb.deal.findMany.mockResolvedValue([
      {
        id: "deal-1",
        propertyId: "prop-old",
        propertyAddress: "303 N Broadway | Suite 200",
        property: { city: "Tulsa", state: "OK" },
      },
    ])
    // Current Property is the collapsed unit=NULL row.
    mockedDb.property.findUnique.mockResolvedValueOnce({
      propertyKey: "303 n broadway",
      unit: null,
    })
    // Inside txn — looking for canonical (key, unit="suite 200") Property.
    mockedDb.property.findFirst.mockResolvedValueOnce(null)
    // Read for old prop fields when creating new Property.
    mockedDb.property.findUnique.mockResolvedValueOnce({
      address: "303 N Broadway",
      city: "Tulsa",
      state: "OK",
      zip: null,
      propertyType: "office",
    })
    mockedDb.property.create.mockResolvedValueOnce({
      id: "prop-new",
      propertyType: "office",
      squareFeet: null,
      listingUrl: null,
      flyerUrl: null,
    })
    mockedDb.deal.update.mockResolvedValueOnce({ id: "deal-1" })
    mockedDb.leaseRecord.updateMany.mockResolvedValueOnce({ count: 1 })
    mockedDb.calendarEvent.updateMany.mockResolvedValueOnce({ count: 0 })

    const report = await runPropertyCollapseBackfill({
      throttleMs: 0,
      sleep: async () => {},
    })

    expect(report.ok).toBe(true)
    expect(report.dealsConsidered).toBe(1)
    expect(report.dealsReassigned).toBe(1)
    expect(report.propertiesCreated).toBe(1)
    expect(report.reassignments).toHaveLength(1)
    const r = report.reassignments[0]
    expect(r.dealId).toBe("deal-1")
    expect(r.fromPropertyId).toBe("prop-old")
    expect(r.toPropertyId).toBe("prop-new")
    expect(r.unit).toBe("suite 200")
    expect(r.leaseRecordsUpdated).toBe(1)

    // Confirm the new Property carries the split-from-collapse tag.
    const createArgs = mockedDb.property.create.mock.calls[0][0]
    expect(createArgs.data.unit).toBe("suite 200")
    expect(createArgs.data.tags).toContain("split-from-collapse")
    expect(createArgs.data.createdBy).toBe("property-collapse-backfill")
    expect(createArgs.data.source).toBe("buildout_import")

    // Deal updated to point at the new Property.
    expect(mockedDb.deal.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: { propertyId: "prop-new" },
    })
  })

  it("leaves a deal alone when it already points to the canonical (propertyKey, unit) Property", async () => {
    mockedDb.deal.findMany.mockResolvedValue([
      {
        id: "deal-2",
        propertyId: "prop-already-canonical",
        propertyAddress: "1601 Lewis | Suite 104",
        property: { city: "Tulsa", state: "OK" },
      },
    ])
    // The current Property already matches the canonical (key, unit).
    mockedDb.property.findUnique.mockResolvedValueOnce({
      propertyKey: "1601 lewis",
      unit: "suite 104",
    })

    const report = await runPropertyCollapseBackfill({
      throttleMs: 0,
      sleep: async () => {},
    })

    expect(report.ok).toBe(true)
    expect(report.dealsAlreadyCanonical).toBe(1)
    expect(report.dealsReassigned).toBe(0)
    expect(report.propertiesCreated).toBe(0)
    expect(mockedDb.$transaction).not.toHaveBeenCalled()
    expect(mockedDb.deal.update).not.toHaveBeenCalled()
    expect(mockedDb.property.create).not.toHaveBeenCalled()
  })

  it("dedupes multiple deals onto the same canonical Property", async () => {
    // Two deals on the same building, same suite — second one should reuse
    // the Property the first one created.
    mockedDb.deal.findMany.mockResolvedValue([
      {
        id: "deal-A",
        propertyId: "prop-old",
        propertyAddress: "500 Main | Suite 18",
        property: { city: "Tulsa", state: "OK" },
      },
      {
        id: "deal-B",
        propertyId: "prop-old",
        propertyAddress: "500 Main | Suite 18",
        property: { city: "Tulsa", state: "OK" },
      },
    ])

    // Deal A: current prop is collapsed unit=null
    mockedDb.property.findUnique.mockResolvedValueOnce({
      propertyKey: "500 main",
      unit: null,
    })
    // Inside txn for deal A: no canonical Property yet, then read old prop, then create.
    mockedDb.property.findFirst.mockResolvedValueOnce(null)
    mockedDb.property.findUnique.mockResolvedValueOnce({
      address: "500 Main",
      city: "Tulsa",
      state: "OK",
      zip: null,
      propertyType: null,
    })
    mockedDb.property.create.mockResolvedValueOnce({
      id: "prop-canonical",
      propertyType: null,
      squareFeet: null,
      listingUrl: null,
      flyerUrl: null,
    })

    // Deal B: current prop is still the collapsed one (Deal A was just
    // reassigned, but Deal B still points at prop-old).
    mockedDb.property.findUnique.mockResolvedValueOnce({
      propertyKey: "500 main",
      unit: null,
    })
    // Inside txn for deal B: the canonical Property now EXISTS.
    mockedDb.property.findFirst.mockResolvedValueOnce({
      id: "prop-canonical",
      propertyType: null,
      squareFeet: null,
      listingUrl: null,
      flyerUrl: null,
    })

    const report = await runPropertyCollapseBackfill({
      throttleMs: 0,
      sleep: async () => {},
    })

    expect(report.ok).toBe(true)
    expect(report.dealsReassigned).toBe(2)
    // Only ONE Property was actually created — the second deal reused it.
    expect(report.propertiesCreated).toBe(1)
    expect(mockedDb.property.create).toHaveBeenCalledTimes(1)
    expect(report.reassignments[0].toPropertyId).toBe("prop-canonical")
    expect(report.reassignments[1].toPropertyId).toBe("prop-canonical")
  })

  it("archives Properties with no remaining deal references", async () => {
    mockedDb.deal.findMany.mockResolvedValue([])
    mockedDb.property.findMany.mockResolvedValueOnce([
      {
        id: "orphan-1",
        propertyKey: "303 n broadway",
        address: "303 N Broadway",
        unit: null,
        _count: { deals: 0 },
      },
      {
        id: "still-used",
        propertyKey: "303 n broadway",
        address: "303 N Broadway",
        unit: "suite 200",
        _count: { deals: 3 },
      },
    ])
    mockedDb.property.update.mockResolvedValueOnce({ id: "orphan-1" })

    const report = await runPropertyCollapseBackfill({
      throttleMs: 0,
      sleep: async () => {},
    })

    expect(report.ok).toBe(true)
    expect(report.propertiesArchived).toBe(1)
    expect(report.archived).toHaveLength(1)
    expect(report.archived[0].propertyId).toBe("orphan-1")

    // Ensure we set archivedAt rather than deleting.
    expect(mockedDb.property.update).toHaveBeenCalledWith({
      where: { id: "orphan-1" },
      data: { archivedAt: expect.any(Date) },
    })
  })

  it("dry-run mode performs no writes", async () => {
    mockedDb.deal.findMany.mockResolvedValue([
      {
        id: "deal-dry",
        propertyId: "prop-old",
        propertyAddress: "100 Oak | Suite 5",
        property: { city: "Tulsa", state: "OK" },
      },
    ])
    mockedDb.property.findUnique.mockResolvedValueOnce({
      propertyKey: "100 oak",
      unit: null,
    })
    // Dry run will look for an existing canonical Property...
    mockedDb.property.findFirst.mockResolvedValueOnce(null)
    // ...and a remaining-deal-count check via property.findMany, plus
    // simulate-transaction count() calls for LR/CE.
    mockedDb.leaseRecord.count.mockResolvedValueOnce(2)
    mockedDb.calendarEvent.count.mockResolvedValueOnce(1)

    const report = await runPropertyCollapseBackfill({
      dryRun: true,
      throttleMs: 0,
      sleep: async () => {},
    })

    expect(report.dryRun).toBe(true)
    expect(report.dealsReassigned).toBe(1)
    // Critically: no writes.
    expect(mockedDb.property.create).not.toHaveBeenCalled()
    expect(mockedDb.deal.update).not.toHaveBeenCalled()
    expect(mockedDb.leaseRecord.updateMany).not.toHaveBeenCalled()
    expect(mockedDb.calendarEvent.updateMany).not.toHaveBeenCalled()
    expect(mockedDb.property.update).not.toHaveBeenCalled()
    expect(mockedDb.$transaction).not.toHaveBeenCalled()
    expect(report.reassignments[0].leaseRecordsUpdated).toBe(2)
    expect(report.reassignments[0].calendarEventsUpdated).toBe(1)
  })
})
