import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { GET } from "./route"

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    contact: { findMany: vi.fn() },
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

describe("contacts search route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.contact.findMany.mockResolvedValue([])
    dbMock.$queryRaw.mockResolvedValue([])
  })

  it("uses broad SQL search for typed contact picker queries", async () => {
    dbMock.$queryRaw.mockResolvedValueOnce([
      {
        id: "contact-1",
        name: "Michelle Ray",
        company: "Ray Advisory",
        email: "michelle@example.test",
        phone: "555-0101",
        role: "Owner",
      },
    ])

    const response = await GET(
      request("https://example.test/api/contacts?q=555&limit=5")
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      items: [
        {
          id: "contact-1",
          name: "Michelle Ray",
          company: "Ray Advisory",
          email: "michelle@example.test",
          phone: "555-0101",
          role: "Owner",
        },
      ],
    })
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
    expect(dbMock.contact.findMany).not.toHaveBeenCalled()
  })

  it("returns contacts with phone and role before the user types", async () => {
    dbMock.contact.findMany.mockResolvedValueOnce([
      {
        id: "contact-2",
        name: "Laura Smith",
        company: "Smith Co",
        email: "laura@example.test",
        phone: "555-0202",
        role: "Broker",
      },
    ])

    const response = await GET(request("https://example.test/api/contacts"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      items: [
        {
          id: "contact-2",
          name: "Laura Smith",
          company: "Smith Co",
          email: "laura@example.test",
          phone: "555-0202",
          role: "Broker",
        },
      ],
    })
    expect(dbMock.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          phone: true,
          role: true,
        },
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
