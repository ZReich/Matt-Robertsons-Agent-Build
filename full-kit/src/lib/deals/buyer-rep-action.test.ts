import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { proposeBuyerRepDeal } from "./buyer-rep-action"

vi.mock("@/lib/prisma", () => {
  const tx = {
    contact: { findFirst: vi.fn() },
    deal: { findFirst: vi.fn() },
    agentAction: { findFirst: vi.fn(), create: vi.fn() },
    communication: { findUnique: vi.fn() },
    $executeRaw: vi.fn(async () => 1),
  }
  return {
    db: {
      ...tx,
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    },
  }
})

const dbAny = db as unknown as {
  contact: { findFirst: ReturnType<typeof vi.fn> }
  deal: { findFirst: ReturnType<typeof vi.fn> }
  agentAction: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  communication: { findUnique: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
  $executeRaw: ReturnType<typeof vi.fn>
}

function resetDbMocks() {
  dbAny.contact.findFirst.mockReset()
  dbAny.deal.findFirst.mockReset()
  dbAny.agentAction.findFirst.mockReset()
  dbAny.agentAction.create.mockReset()
  dbAny.communication.findUnique.mockReset()
  dbAny.$executeRaw.mockReset()
  dbAny.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      contact: dbAny.contact,
      deal: dbAny.deal,
      agentAction: dbAny.agentAction,
      communication: dbAny.communication,
      $executeRaw: dbAny.$executeRaw,
    })
  )
  // Defaults: no contact-by-email match, no existing deal, no pending action,
  // no attachments on the source communication.
  dbAny.contact.findFirst.mockResolvedValue(null)
  dbAny.deal.findFirst.mockResolvedValue(null)
  dbAny.agentAction.findFirst.mockResolvedValue(null)
  dbAny.communication.findUnique.mockResolvedValue({ metadata: {} })
  dbAny.$executeRaw.mockResolvedValue(1)
}

describe("proposeBuyerRepDeal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbMocks()
  })

  it("creates a create-deal AgentAction at tier=approve for tour signal", async () => {
    dbAny.agentAction.create.mockResolvedValue({ id: "action-1" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-1",
      contactId: "contact-1",
      signalType: "tour",
      proposedStage: "showings",
      confidence: 0.75,
    })
    expect(result.created).toBe(true)
    expect(result.actionId).toBe("action-1")
    expect(dbAny.agentAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: "create-deal",
        status: "pending",
        tier: "approve",
        sourceCommunicationId: "comm-1",
        payload: expect.objectContaining({
          contactId: "contact-1",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "showings",
        }),
      }),
    })
  })

  it("creates AgentAction with contactId when contactId is provided", async () => {
    dbAny.agentAction.create.mockResolvedValue({ id: "action-2" })
    await proposeBuyerRepDeal({
      communicationId: "comm-2",
      contactId: "contact-7",
      recipientEmail: "agent@cushwake.com",
      recipientDisplayName: "Agent",
      signalType: "loi",
      proposedStage: "offer",
      confidence: 0.9,
    })
    const call = dbAny.agentAction.create.mock.calls[0]?.[0]
    expect(call.data.payload.contactId).toBe("contact-7")
    expect(call.data.payload.recipientEmail).toBe("agent@cushwake.com")
    expect(call.data.payload.recipientDisplayName).toBe("Agent")
  })

  it("creates AgentAction with recipientEmail when contactId is null", async () => {
    dbAny.agentAction.create.mockResolvedValue({ id: "action-3" })
    await proposeBuyerRepDeal({
      communicationId: "comm-3",
      contactId: null,
      recipientEmail: "newbroker@example.com",
      recipientDisplayName: "New Broker",
      signalType: "tour",
      proposedStage: "showings",
      confidence: 0.6,
    })
    const call = dbAny.agentAction.create.mock.calls[0]?.[0]
    expect(call.data.payload.contactId).toBeNull()
    expect(call.data.payload.recipientEmail).toBe("newbroker@example.com")
    expect(call.data.payload.recipientDisplayName).toBe("New Broker")
    expect(call.data.actionType).toBe("create-deal")
    expect(call.data.tier).toBe("approve")
  })

  it("throws when both contactId and recipientEmail are null", async () => {
    await expect(
      proposeBuyerRepDeal({
        communicationId: "comm-4",
        contactId: null,
        recipientEmail: null,
        signalType: "tour",
        proposedStage: "showings",
        confidence: 0.6,
      })
    ).rejects.toThrow(/contactId or recipientEmail/i)
    expect(dbAny.agentAction.create).not.toHaveBeenCalled()
  })

  // ---- Dedupe: existing buyer_rep Deal -----------------------------------

  it("skips with existing-buyer-rep-deal when a non-archived buyer_rep Deal exists for the contact", async () => {
    dbAny.deal.findFirst.mockResolvedValue({ id: "deal-existing" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-5",
      contactId: "contact-1",
      signalType: "tour",
      proposedStage: "showings",
      confidence: 0.75,
    })
    expect(result).toEqual({
      created: false,
      actionId: null,
      skipReason: "existing-buyer-rep-deal",
    })
    expect(dbAny.agentAction.create).not.toHaveBeenCalled()
    // Verify the existence check filters non-archived buyer_rep deals.
    const dealCall = dbAny.deal.findFirst.mock.calls[0]?.[0]
    expect(dealCall.where).toEqual(
      expect.objectContaining({
        contactId: "contact-1",
        dealType: "buyer_rep",
        archivedAt: null,
      })
    )
  })

  it("creates the action when only the existing Deal is archived (archived doesn't count)", async () => {
    // findFirst is filtered by archivedAt: null in production. We simulate
    // 'all matching deals are archived' by returning null from the filtered query.
    dbAny.deal.findFirst.mockResolvedValue(null)
    dbAny.agentAction.create.mockResolvedValue({ id: "action-new" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-6",
      contactId: "contact-1",
      signalType: "tour",
      proposedStage: "showings",
      confidence: 0.75,
    })
    expect(result.created).toBe(true)
    expect(result.actionId).toBe("action-new")
  })

  it("creates the action when the existing buyer_rep Deal belongs to a different contact", async () => {
    // db filter is keyed on contactId, so a different-contact deal won't be returned here.
    dbAny.deal.findFirst.mockResolvedValue(null)
    dbAny.agentAction.create.mockResolvedValue({ id: "action-7" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-7",
      contactId: "contact-1",
      signalType: "tour",
      proposedStage: "showings",
      confidence: 0.75,
    })
    expect(result.created).toBe(true)
    // confirm the query was contact-scoped
    expect(dbAny.deal.findFirst.mock.calls[0]?.[0].where.contactId).toBe(
      "contact-1"
    )
  })

  it("creates the action when only a seller_rep Deal exists for the contact", async () => {
    // The query filters dealType === buyer_rep, so a seller-only contact returns null.
    dbAny.deal.findFirst.mockResolvedValue(null)
    dbAny.agentAction.create.mockResolvedValue({ id: "action-8" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-8",
      contactId: "contact-1",
      signalType: "tour",
      proposedStage: "showings",
      confidence: 0.75,
    })
    expect(result.created).toBe(true)
    expect(dbAny.deal.findFirst.mock.calls[0]?.[0].where.dealType).toBe(
      "buyer_rep"
    )
  })

  // ---- Dedupe: pending AgentAction ---------------------------------------

  it("skips with duplicate-pending-action when a pending create-deal action matches recipientEmail+signalType in the last 90d", async () => {
    dbAny.agentAction.findFirst.mockResolvedValue({ id: "action-existing" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-9",
      contactId: null,
      recipientEmail: "samantha.turner@weyerhaeuser.com",
      recipientDisplayName: "Samantha Turner",
      signalType: "loi",
      proposedStage: "offer",
      confidence: 0.85,
    })
    expect(result).toEqual({
      created: false,
      actionId: "action-existing",
      skipReason: "duplicate-pending-action",
    })
    expect(dbAny.agentAction.create).not.toHaveBeenCalled()
    const where = dbAny.agentAction.findFirst.mock.calls[0]?.[0].where
    expect(where.actionType).toBe("create-deal")
    expect(where.status).toBe("pending")
    expect(where.createdAt).toBeDefined()
    expect(where.createdAt.gt).toBeInstanceOf(Date)
  })

  it("matches pending action by recipientEmail case-insensitively", async () => {
    dbAny.agentAction.findFirst.mockResolvedValue({ id: "action-existing" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-10",
      contactId: null,
      recipientEmail: "Samantha.Turner@WEYERHAEUSER.com",
      signalType: "loi",
      proposedStage: "offer",
      confidence: 0.85,
    })
    expect(result.skipReason).toBe("duplicate-pending-action")
    // Inspect the filter sent into Prisma. Prisma's JSON-path filters don't
    // support `mode: "insensitive"`, so we lowercase the input for the
    // equality check. (Writers — emails.ts:pickFirstExternalRecipient and the
    // backfill script — already lowercase before writing, so equality on the
    // lowercased value matches all production rows.) The serialized query
    // must contain the lowercased email and must NOT contain the original
    // mixed-case form.
    const where = dbAny.agentAction.findFirst.mock.calls[0]?.[0].where
    const serialized = JSON.stringify(where)
    expect(serialized).toContain("samantha.turner@weyerhaeuser.com")
    expect(serialized).not.toContain("WEYERHAEUSER")
  })

  it("creates a new action when the most recent matching pending action is older than 90d", async () => {
    // The 90d window is enforced via createdAt: { gt: now - 90d } at the query
    // level. Simulate "no row newer than 90d" by returning null.
    dbAny.agentAction.findFirst.mockResolvedValue(null)
    dbAny.agentAction.create.mockResolvedValue({ id: "action-new" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-11",
      contactId: null,
      recipientEmail: "old@example.com",
      signalType: "loi",
      proposedStage: "offer",
      confidence: 0.85,
    })
    expect(result.created).toBe(true)
    // Confirm the lookup applied a 90d window approximately.
    const where = dbAny.agentAction.findFirst.mock.calls[0]?.[0].where
    const cutoff: Date = where.createdAt.gt
    const ageMs = Date.now() - cutoff.getTime()
    // 90d in ms ± 1d slop.
    expect(ageMs).toBeGreaterThan(89 * 24 * 60 * 60 * 1000)
    expect(ageMs).toBeLessThan(91 * 24 * 60 * 60 * 1000)
  })

  it("creates a new action when only a different signalType pending action exists", async () => {
    // The query filters payload.signalType === current signal, so a different
    // signal in DB returns null from this query.
    dbAny.agentAction.findFirst.mockResolvedValue(null)
    dbAny.agentAction.create.mockResolvedValue({ id: "action-12" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-12",
      contactId: null,
      recipientEmail: "broker@example.com",
      signalType: "tour",
      proposedStage: "showings",
      confidence: 0.75,
    })
    expect(result.created).toBe(true)
    const where = dbAny.agentAction.findFirst.mock.calls[0]?.[0].where
    // The filter must restrict by signalType so that a stored 'loi' wouldn't match a 'tour' propose.
    const serialized = JSON.stringify(where)
    expect(serialized).toContain('"signalType"')
    expect(serialized).toContain('"tour"')
  })

  it("creates a new action when matching action is rejected/executed (only pending counts)", async () => {
    // The query filters status: 'pending', so a rejected/executed row in the DB
    // returns null here.
    dbAny.agentAction.findFirst.mockResolvedValue(null)
    dbAny.agentAction.create.mockResolvedValue({ id: "action-13" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-13",
      contactId: null,
      recipientEmail: "broker@example.com",
      signalType: "loi",
      proposedStage: "offer",
      confidence: 0.85,
    })
    expect(result.created).toBe(true)
    const where = dbAny.agentAction.findFirst.mock.calls[0]?.[0].where
    expect(where.status).toBe("pending")
  })

  // ---- Effective contact resolution --------------------------------------

  it("looks up Contact by recipientEmail when contactId is null and uses it for the Deal-existence check", async () => {
    dbAny.contact.findFirst.mockResolvedValue({ id: "resolved-contact" })
    dbAny.deal.findFirst.mockResolvedValue({ id: "deal-resolved" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-14",
      contactId: null,
      recipientEmail: "Foo@Bar.com",
      signalType: "loi",
      proposedStage: "offer",
      confidence: 0.85,
    })
    expect(result.skipReason).toBe("existing-buyer-rep-deal")
    // contact lookup used case-insensitive match
    const contactWhere = dbAny.contact.findFirst.mock.calls[0]?.[0].where
    expect(contactWhere.email.mode).toBe("insensitive")
    // deal-existence query used the resolved contact id
    expect(dbAny.deal.findFirst.mock.calls[0]?.[0].where.contactId).toBe(
      "resolved-contact"
    )
  })

  it("when contactId is null and no Contact resolves by email, still runs pending dedupe by email", async () => {
    dbAny.contact.findFirst.mockResolvedValue(null)
    dbAny.agentAction.findFirst.mockResolvedValue({ id: "existing-pending" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-15",
      contactId: null,
      recipientEmail: "no-contact@example.com",
      signalType: "loi",
      proposedStage: "offer",
      confidence: 0.85,
    })
    expect(result).toEqual({
      created: false,
      actionId: "existing-pending",
      skipReason: "duplicate-pending-action",
    })
    // No deal-existence query expected when no contact resolved.
    expect(dbAny.deal.findFirst).not.toHaveBeenCalled()
  })

  // ---- Phase D step 3: tier differentiation ------------------------------

  it("LOI with matching attachment → tier=auto (status pending, dedupe still applies)", async () => {
    dbAny.communication.findUnique.mockResolvedValue({
      metadata: {
        attachments: [
          {
            id: "att-1",
            name: "LOI_draft.pdf",
            size: 1024,
            contentType: "application/pdf",
            isInline: false,
          },
        ],
      },
    })
    dbAny.agentAction.create.mockResolvedValue({ id: "action-auto-1" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-loi-att",
      contactId: "contact-loi",
      recipientEmail: "broker@cushwake.com",
      signalType: "loi",
      proposedStage: "offer",
      confidence: 0.85,
    })
    expect(result.created).toBe(true)
    expect(result.tier).toBe("auto")
    const call = dbAny.agentAction.create.mock.calls[0]?.[0]
    expect(call.data.tier).toBe("auto")
    expect(call.data.status).toBe("pending")
  })

  it("LOI with non-matching attachment filename → tier=approve", async () => {
    dbAny.communication.findUnique.mockResolvedValue({
      metadata: {
        attachments: [
          {
            id: "att-1",
            name: "company-overview.pdf",
            size: 1024,
            contentType: "application/pdf",
            isInline: false,
          },
        ],
      },
    })
    dbAny.agentAction.create.mockResolvedValue({ id: "action-app-1" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-loi-junk",
      contactId: "contact-loi-2",
      recipientEmail: "broker2@cushwake.com",
      signalType: "loi",
      proposedStage: "offer",
      confidence: 0.85,
    })
    expect(result.created).toBe(true)
    expect(result.tier).toBe("approve")
    const call = dbAny.agentAction.create.mock.calls[0]?.[0]
    expect(call.data.tier).toBe("approve")
  })

  it("LOI with no attachments → tier=approve", async () => {
    dbAny.communication.findUnique.mockResolvedValue({ metadata: {} })
    dbAny.agentAction.create.mockResolvedValue({ id: "action-app-2" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-loi-noatt",
      contactId: "contact-loi-3",
      recipientEmail: "broker3@cushwake.com",
      signalType: "loi",
      proposedStage: "offer",
      confidence: 0.85,
    })
    expect(result.created).toBe(true)
    expect(result.tier).toBe("approve")
    const call = dbAny.agentAction.create.mock.calls[0]?.[0]
    expect(call.data.tier).toBe("approve")
  })

  it("Tour signal → tier=approve regardless of attachments", async () => {
    dbAny.communication.findUnique.mockResolvedValue({
      metadata: {
        attachments: [
          {
            id: "att-1",
            name: "LOI_offer.pdf",
            size: 1024,
            contentType: "application/pdf",
          },
        ],
      },
    })
    dbAny.agentAction.create.mockResolvedValue({ id: "action-tour" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-tour",
      contactId: "contact-tour",
      signalType: "tour",
      proposedStage: "showings",
      confidence: 0.75,
    })
    expect(result.created).toBe(true)
    expect(result.tier).toBe("approve")
    const call = dbAny.agentAction.create.mock.calls[0]?.[0]
    expect(call.data.tier).toBe("approve")
  })

  it("NDA signal → tier=approve", async () => {
    dbAny.communication.findUnique.mockResolvedValue({ metadata: {} })
    dbAny.agentAction.create.mockResolvedValue({ id: "action-nda" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-nda",
      contactId: "contact-nda",
      signalType: "nda",
      proposedStage: "prospecting",
      confidence: 0.7,
    })
    expect(result.created).toBe(true)
    expect(result.tier).toBe("approve")
    const call = dbAny.agentAction.create.mock.calls[0]?.[0]
    expect(call.data.tier).toBe("approve")
  })

  it("tenant_rep_search → tier=log_only, status=executed, dedupe SKIPPED", async () => {
    // Even with a 'matching' pending row that would normally dedupe, log_only
    // proposals always create a new audit row.
    dbAny.agentAction.findFirst.mockResolvedValue({ id: "stale-pending" })
    dbAny.communication.findUnique.mockResolvedValue({ metadata: {} })
    dbAny.agentAction.create.mockResolvedValue({ id: "action-log-1" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-tenant-1",
      contactId: null,
      recipientEmail: "agent@jll.com",
      recipientDisplayName: "JLL Agent",
      signalType: "tenant_rep_search",
      proposedStage: "prospecting",
      confidence: 0.5,
    })
    expect(result.created).toBe(true)
    expect(result.tier).toBe("log_only")
    expect(result.actionId).toBe("action-log-1")
    const call = dbAny.agentAction.create.mock.calls[0]?.[0]
    expect(call.data.tier).toBe("log_only")
    expect(call.data.status).toBe("executed")
    // Dedupe must have been skipped — no findFirst against agentAction.
    expect(dbAny.agentAction.findFirst).not.toHaveBeenCalled()
    // Existing-Deal check must also be skipped (multiple log_only rows OK).
    expect(dbAny.deal.findFirst).not.toHaveBeenCalled()
  })

  it("tenant_rep_search creates a SECOND audit row even when one already exists", async () => {
    // Simulate prior log_only row in DB; dedupe is skipped so a second propose creates a new row.
    dbAny.agentAction.findFirst.mockResolvedValue({ id: "previous-log-only" })
    dbAny.communication.findUnique.mockResolvedValue({ metadata: {} })
    dbAny.agentAction.create.mockResolvedValue({ id: "action-log-2" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-tenant-2",
      contactId: null,
      recipientEmail: "broker@colliers.com",
      signalType: "tenant_rep_search",
      proposedStage: "prospecting",
      confidence: 0.5,
    })
    expect(result.created).toBe(true)
    expect(result.actionId).toBe("action-log-2")
    expect(dbAny.agentAction.create).toHaveBeenCalledTimes(1)
  })

  it("LOI attachment regex is case-insensitive and matches multiple aliases", async () => {
    const cases: Array<{ name: string; expected: "auto" | "approve" }> = [
      { name: "LOI_draft.pdf", expected: "auto" },
      { name: "loi_offer.pdf", expected: "auto" },
      { name: "Letter-of-Intent.docx", expected: "auto" },
      { name: "letter_of_intent.docx", expected: "auto" },
      { name: "OFFER_sheet.pdf", expected: "auto" },
      { name: "company-overview.pdf", expected: "approve" },
      { name: "signature.png", expected: "approve" },
    ]
    for (const tc of cases) {
      resetDbMocks()
      dbAny.communication.findUnique.mockResolvedValue({
        metadata: {
          attachments: [
            {
              id: "a",
              name: tc.name,
              size: 100,
              contentType: "application/pdf",
            },
          ],
        },
      })
      dbAny.agentAction.create.mockResolvedValue({ id: `act-${tc.name}` })
      const result = await proposeBuyerRepDeal({
        communicationId: `comm-${tc.name}`,
        contactId: "c-1",
        signalType: "loi",
        proposedStage: "offer",
        confidence: 0.85,
      })
      expect(result.tier, `case ${tc.name}`).toBe(tc.expected)
    }
  })
})
