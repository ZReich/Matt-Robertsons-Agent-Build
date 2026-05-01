import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { syncContactRoleFromDeals } from "./sync-contact-role"

vi.mock("@/lib/prisma", () => ({
  db: {
    deal: { findMany: vi.fn() },
    contact: { findUnique: vi.fn(), update: vi.fn() },
    agentAction: { create: vi.fn() },
  },
}))

const dealFindMany = db.deal.findMany as unknown as ReturnType<typeof vi.fn>
const contactFindUnique = db.contact.findUnique as unknown as ReturnType<
  typeof vi.fn
>
const contactUpdate = db.contact.update as unknown as ReturnType<typeof vi.fn>
const agentActionCreate = db.agentAction.create as unknown as ReturnType<
  typeof vi.fn
>

const baseContact = {
  id: "contact-1",
  name: "Pat Example",
  clientType: null,
  archivedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  contactFindUnique.mockResolvedValue(baseContact)
  agentActionCreate.mockResolvedValue({ id: "action-1" })
})

describe("syncContactRoleFromDeals", () => {
  it("sets active_listing_client when contact has any active listing-side deal", async () => {
    dealFindMany.mockResolvedValue([
      { dealType: "seller_rep", stage: "marketing", outcome: null },
    ])
    const result = await syncContactRoleFromDeals("contact-1")
    expect(contactUpdate).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: "active_listing_client" },
    })
    expect(result.changed).toBe(true)
    expect(result.toClientType).toBe("active_listing_client")
  })

  it("sets active_buyer_rep_client when contact has any active buyer-rep deal", async () => {
    dealFindMany.mockResolvedValue([
      { dealType: "buyer_rep", stage: "showings", outcome: null },
    ])
    await syncContactRoleFromDeals("contact-1")
    expect(contactUpdate).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: "active_buyer_rep_client" },
    })
  })

  it("prefers active_buyer_rep_client when contact has both flows active", async () => {
    dealFindMany.mockResolvedValue([
      { dealType: "seller_rep", stage: "marketing", outcome: null },
      { dealType: "buyer_rep", stage: "offer", outcome: null },
    ])
    await syncContactRoleFromDeals("contact-1")
    expect(contactUpdate).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: "active_buyer_rep_client" },
    })
  })

  it("sets past_client when all deals are closed (regardless of outcome)", async () => {
    dealFindMany.mockResolvedValue([
      { dealType: "seller_rep", stage: "closed", outcome: null },
    ])
    await syncContactRoleFromDeals("contact-1")
    expect(contactUpdate).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: "past_client" },
    })
  })

  it("returns no-change when contact has no deals and clientType is already null", async () => {
    dealFindMany.mockResolvedValue([])
    const result = await syncContactRoleFromDeals("contact-1")
    expect(contactUpdate).not.toHaveBeenCalled()
    expect(agentActionCreate).not.toHaveBeenCalled()
    expect(result.changed).toBe(false)
    expect(result.toClientType).toBeNull()
  })

  it("logs an AgentAction row when role changes", async () => {
    contactFindUnique.mockResolvedValue({
      ...baseContact,
      clientType: "active_listing_client",
    })
    dealFindMany.mockResolvedValue([
      { dealType: "seller_rep", stage: "closed", outcome: "won" },
    ])
    const result = await syncContactRoleFromDeals(
      "contact-1",
      { trigger: "deal_close", dealId: "deal-1" }
    )
    expect(agentActionCreate).toHaveBeenCalledTimes(1)
    const args = agentActionCreate.mock.calls[0][0]
    expect(args.data.actionType).toBe("set-client-type")
    expect(args.data.tier).toBe("auto")
    expect(args.data.status).toBe("executed")
    expect(args.data.targetEntity).toBe("contact:contact-1")
    expect(args.data.payload).toMatchObject({
      contactId: "contact-1",
      fromClientType: "active_listing_client",
      toClientType: "past_client",
      dealId: "deal-1",
      trigger: "deal_close",
    })
    expect(result.actionId).toBe("action-1")
  })

  it("is a no-op when role would not change", async () => {
    contactFindUnique.mockResolvedValue({
      ...baseContact,
      clientType: "active_listing_client",
    })
    dealFindMany.mockResolvedValue([
      { dealType: "seller_rep", stage: "marketing", outcome: null },
    ])
    const result = await syncContactRoleFromDeals("contact-1")
    expect(contactUpdate).not.toHaveBeenCalled()
    expect(agentActionCreate).not.toHaveBeenCalled()
    expect(result.changed).toBe(false)
  })

  it("does not touch archived contacts", async () => {
    contactFindUnique.mockResolvedValue({
      ...baseContact,
      clientType: "active_listing_client",
      archivedAt: new Date(),
    })
    dealFindMany.mockResolvedValue([
      { dealType: "seller_rep", stage: "closed", outcome: "won" },
    ])
    const result = await syncContactRoleFromDeals("contact-1")
    expect(contactUpdate).not.toHaveBeenCalled()
    expect(agentActionCreate).not.toHaveBeenCalled()
    expect(result.changed).toBe(false)
  })
})
