import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { GET } from "./route"

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    deal: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ db: dbMock }))

vi.mock("@/lib/reviewer-auth", () => ({
  ReviewerAuthError: class ReviewerAuthError extends Error {
    constructor(
      message: string,
      public readonly status = 401
    ) {
      super(message)
    }
  },
  assertSameOriginRequest: vi.fn(),
  requireAgentReviewer: vi
    .fn()
    .mockResolvedValue({ id: "reviewer-1", label: "Zach Reviewer" }),
}))

describe("deals search route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.deal.findMany.mockResolvedValue([])
    dbMock.$queryRaw.mockResolvedValue([])
  })

  it("uses broad SQL search for typed deal picker queries", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([
      {
        id: "deal-1",
        property_address: "1601 Lewis, Suite 216",
        stage: "active",
        deal_type: "tenant_rep",
        contact_id: "contact-1",
        contact_name: "Michelle Ray",
        contact_company: "Ray Advisory",
        contact_email: "michelle@example.test",
        contact_phone: "555-0101",
      },
    ])

    const response = await GET(
      request("https://example.test/api/deals?q=michelle&limit=5")
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      items: [
        {
          id: "deal-1",
          propertyAddress: "1601 Lewis, Suite 216",
          stage: "active",
          dealType: "tenant_rep",
          contactId: "contact-1",
          contactName: "Michelle Ray",
          contactCompany: "Ray Advisory",
          contactEmail: "michelle@example.test",
          contactPhone: "555-0101",
        },
      ],
    })
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
    expect(dbMock.$queryRaw.mock.calls[0][0].text).toContain('d."updatedAt"')
    expect(dbMock.$queryRaw.mock.calls[0][0].text).toContain("c.name")
    expect(dbMock.$queryRaw.mock.calls[0][0].text).toContain(
      "d.property_address"
    )
    expect(dbMock.deal.findMany).not.toHaveBeenCalled()
  })

  it("returns recent deals with contact detail before the user types", async () => {
    dbMock.deal.findMany.mockResolvedValueOnce([
      {
        id: "deal-2",
        propertyAddress: "123 Main St",
        stage: "prospecting",
        dealType: "listing",
        contact: {
          id: "contact-2",
          name: "Laura Smith",
          company: "Smith Co",
          email: "laura@example.test",
          phone: "555-0202",
        },
      },
    ])

    const response = await GET(request("https://example.test/api/deals"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      items: [
        {
          id: "deal-2",
          propertyAddress: "123 Main St",
          stage: "prospecting",
          dealType: "listing",
          contactId: "contact-2",
          contactName: "Laura Smith",
          contactCompany: "Smith Co",
          contactEmail: "laura@example.test",
          contactPhone: "555-0202",
        },
      ],
    })
    expect(dbMock.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        select: expect.objectContaining({
          dealType: true,
          contact: {
            select: {
              id: true,
              name: true,
              company: true,
              email: true,
              phone: true,
            },
          },
        }),
      })
    )
    expect(dbMock.$queryRaw).not.toHaveBeenCalled()
  })
})

function request(url: string): Request {
  return new Request(url, {
    headers: { origin: "https://example.test" },
  })
}
