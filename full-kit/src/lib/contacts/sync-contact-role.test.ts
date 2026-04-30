import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { syncContactRoleFromDeals } from "./sync-contact-role"

vi.mock("@/lib/prisma", () => ({
  db: {
    deal: { findMany: vi.fn() },
    contact: { update: vi.fn() },
  },
}))

const dealFindMany = db.deal.findMany as unknown as ReturnType<typeof vi.fn>
const contactUpdate = db.contact.update as unknown as ReturnType<typeof vi.fn>

describe("syncContactRoleFromDeals", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sets active_listing_client when contact has any active listing-side deal", async () => {
    dealFindMany.mockResolvedValue([
      { dealType: "seller_rep", stage: "marketing", outcome: null },
    ])
    await syncContactRoleFromDeals("contact-1")
    expect(contactUpdate).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: "active_listing_client" },
    })
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

  it("sets past_client when all deals are closed and at least one is won", async () => {
    dealFindMany.mockResolvedValue([
      { dealType: "seller_rep", stage: "closed", outcome: "won" },
    ])
    await syncContactRoleFromDeals("contact-1")
    expect(contactUpdate).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: "past_client" },
    })
  })

  it("leaves clientType null when no deals exist", async () => {
    dealFindMany.mockResolvedValue([])
    await syncContactRoleFromDeals("contact-1")
    expect(contactUpdate).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { clientType: null },
    })
  })
})
