import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { matchEntitiesForAction } from "./entity-matcher"

vi.mock("@/lib/prisma", () => ({
  db: {
    communication: { findUnique: vi.fn() },
    contact: { findFirst: vi.fn(), findMany: vi.fn() },
    deal: { findFirst: vi.fn() },
    property: { findFirst: vi.fn() },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.communication.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
    null
  )
  ;(db.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(db.deal.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(db.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
})

describe("matchEntitiesForAction", () => {
  it("returns empty result when there's nothing to match on", async () => {
    const result = await matchEntitiesForAction({ agentActionPayload: {} })
    expect(result.contactId).toBeNull()
    expect(result.dealId).toBeNull()
    expect(result.propertyId).toBeNull()
    expect(result.matchScore).toBe(0)
    expect(result.matchSignals).toEqual([])
  })

  it("uses the source communication's contactId at the highest confidence", async () => {
    ;(
      db.communication.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ contactId: "contact-1", dealId: null })

    const result = await matchEntitiesForAction({
      agentActionPayload: {},
      sourceCommunicationId: "comm-1",
    })

    expect(result.contactId).toBe("contact-1")
    expect(result.matchScore).toBe(1.0)
    expect(result.matchSignals).toContain("source_comm_contact")
  })

  it("falls back to email-exact match when no source comm contact", async () => {
    ;(db.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "contact-2",
    })

    const result = await matchEntitiesForAction({
      agentActionPayload: { email: "Sarah@Example.COM" },
    })

    expect(result.contactId).toBe("contact-2")
    expect(result.matchScore).toBe(0.95)
    expect(result.matchSignals).toContain("email_exact")
    // Confirm we normalize to lowercase for the lookup.
    const findCall = (db.contact.findFirst as ReturnType<typeof vi.fn>).mock
      .calls[0][0]
    expect(findCall.where.email.equals).toBe("sarah@example.com")
  })

  it("falls back to name token-overlap when no email match", async () => {
    ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "contact-3", name: "Jacky Bradley" },
    ])

    const result = await matchEntitiesForAction({
      agentActionPayload: { contactName: "Jacky Bradley" },
    })

    expect(result.contactId).toBe("contact-3")
    expect(result.matchScore).toBe(0.7)
    expect(result.matchSignals).toContain("name_token_overlap")
    // Verify both tokens were AND'd into the where clause.
    const callArgs = (db.contact.findMany as ReturnType<typeof vi.fn>).mock
      .calls[0][0]
    expect(callArgs.where.AND).toHaveLength(2)
  })

  it("scores a single-token name match as partial", async () => {
    ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "contact-4", name: "Madonna" },
    ])

    const result = await matchEntitiesForAction({
      agentActionPayload: { name: "Madonna" },
    })

    expect(result.contactId).toBe("contact-4")
    expect(result.matchScore).toBe(0.5)
    expect(result.matchSignals).toContain("name_partial")
  })

  it("matches a property by address", async () => {
    ;(db.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "prop-1",
    })

    const result = await matchEntitiesForAction({
      agentActionPayload: { propertyAddress: "303 N Broadway" },
    })

    expect(result.propertyId).toBe("prop-1")
    expect(result.matchSignals).toContain("address_match")
  })

  it("attaches the contact's most recent active deal when contact matches", async () => {
    ;(
      db.communication.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ contactId: "contact-1", dealId: null })
    ;(db.deal.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "deal-99",
    })

    const result = await matchEntitiesForAction({
      agentActionPayload: {},
      sourceCommunicationId: "comm-1",
    })

    expect(result.contactId).toBe("contact-1")
    expect(result.dealId).toBe("deal-99")
    expect(result.matchSignals).toContain("contact_deal")
  })

  it("does NOT search for a deal when no contact matched", async () => {
    await matchEntitiesForAction({ agentActionPayload: { name: "Nobody" } })
    expect(db.deal.findFirst).not.toHaveBeenCalled()
  })

  it("returns null contactId with name_ambiguous signal when multiple contacts share a name", async () => {
    // Two "John Smith"s in the database. Quietly attaching the most recent
    // would be a confidence bug — surface the ambiguity instead.
    ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "contact-a", name: "John Smith" },
      { id: "contact-b", name: "John Smith" },
    ])

    const result = await matchEntitiesForAction({
      agentActionPayload: { contactName: "John Smith" },
    })

    expect(result.contactId).toBeNull()
    expect(result.dealId).toBeNull()
    expect(result.matchSignals).toContain("name_ambiguous")
    expect(result.matchScore).toBe(0.3)
    // Cascade: with no contact, no deal lookup either.
    expect(db.deal.findFirst).not.toHaveBeenCalled()
  })
})
