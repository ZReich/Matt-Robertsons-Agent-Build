import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"
import { db } from "@/lib/prisma"

import { upsertDealForLead } from "./lead-to-deal"

vi.mock("@/lib/prisma", () => ({
  db: {
    deal: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    communication: {
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/contacts/sync-contact-role", () => ({
  syncContactRoleFromDeals: vi.fn(),
}))

const dealFindFirst = db.deal.findFirst as unknown as ReturnType<typeof vi.fn>
const dealCreate = db.deal.create as unknown as ReturnType<typeof vi.fn>
const communicationUpdate = db.communication.update as unknown as ReturnType<
  typeof vi.fn
>
const syncRoleMock = syncContactRoleFromDeals as unknown as ReturnType<
  typeof vi.fn
>

describe("upsertDealForLead", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a new Deal when none matches propertyKey", async () => {
    dealFindFirst.mockResolvedValue(null)
    dealCreate.mockResolvedValue({ id: "deal-1" })
    communicationUpdate.mockResolvedValue({})

    const result = await upsertDealForLead({
      contactId: "contact-1",
      communicationId: "comm-1",
      propertyKey: "303 north broadway billings mt 59101",
      propertyAddress: "303 North Broadway, Billings, MT 59101",
      propertySource: "buildout",
    })

    expect(result.created).toBe(true)
    expect(result.dealId).toEqual("deal-1")
    expect(dealCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: "contact-1",
        propertyKey: "303 north broadway billings mt 59101",
        propertyAddress: "303 North Broadway, Billings, MT 59101",
        dealType: "seller_rep",
        dealSource: "lead_derived",
        stage: "marketing",
        propertyAliases: [],
      }),
      select: { id: true },
    })
    expect(communicationUpdate).toHaveBeenCalledWith({
      where: { id: "comm-1" },
      data: { dealId: "deal-1" },
    })
    expect(syncRoleMock).toHaveBeenCalledWith("contact-1")
  })

  it("links the Communication to an existing Deal when propertyKey matches", async () => {
    dealFindFirst.mockResolvedValue({
      id: "deal-existing",
      propertyAliases: [],
    })
    communicationUpdate.mockResolvedValue({})

    const result = await upsertDealForLead({
      contactId: "contact-1",
      communicationId: "comm-1",
      propertyKey: "303 north broadway billings mt 59101",
      propertyAddress: "303 N Broadway | Billings, MT 59101",
      propertySource: "loopnet",
    })

    expect(result.created).toBe(false)
    expect(result.dealId).toEqual("deal-existing")
    expect(dealCreate).not.toHaveBeenCalled()
    expect(communicationUpdate).toHaveBeenCalledWith({
      where: { id: "comm-1" },
      data: { dealId: "deal-existing" },
    })
    expect(syncRoleMock).toHaveBeenCalledWith("contact-1")
  })

  it("returns null when propertyKey is missing (no auto-deal)", async () => {
    const result = await upsertDealForLead({
      contactId: "contact-1",
      communicationId: "comm-1",
      propertyKey: null,
      propertyAddress: null,
      propertySource: "buildout",
    })

    expect(result.dealId).toBeNull()
    expect(dealCreate).not.toHaveBeenCalled()
    expect(communicationUpdate).not.toHaveBeenCalled()
    expect(syncRoleMock).not.toHaveBeenCalled()
  })

  it("recovers when create races with another worker (P2002)", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    })
    Object.setPrototypeOf(p2002, Prisma.PrismaClientKnownRequestError.prototype)

    dealFindFirst
      .mockResolvedValueOnce(null) // first findFirst — no deal yet
      .mockResolvedValueOnce({ id: "deal-raced", propertyAliases: [] }) // post-throw findFirst
    dealCreate.mockRejectedValue(p2002)
    communicationUpdate.mockResolvedValue({})

    const result = await upsertDealForLead({
      contactId: "contact-1",
      communicationId: "comm-1",
      propertyKey: "303 north broadway billings mt 59101",
      propertyAddress: "303 N Broadway",
      propertySource: "loopnet",
    })

    expect(result.created).toBe(false)
    expect(result.dealId).toEqual("deal-raced")
    expect(communicationUpdate).toHaveBeenCalledWith({
      where: { id: "comm-1" },
      data: { dealId: "deal-raced" },
    })
    expect(syncRoleMock).toHaveBeenCalledWith("contact-1")
  })
})
