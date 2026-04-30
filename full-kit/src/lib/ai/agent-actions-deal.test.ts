import { beforeEach, describe, expect, it, vi } from "vitest"

import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"
import { db } from "@/lib/prisma"

import {
  createDealFromAction,
  moveDealStageFromAction,
  updateDealFromAction,
} from "./agent-actions-deal"

vi.mock("@/lib/prisma", () => ({
  db: {
    deal: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    agentAction: {
      update: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/contacts/sync-contact-role", () => ({
  syncContactRoleFromDeals: vi.fn(),
}))

const dealFindUnique = db.deal.findUnique as unknown as ReturnType<
  typeof vi.fn
>
const dealUpdate = db.deal.update as unknown as ReturnType<typeof vi.fn>
const dealCreate = db.deal.create as unknown as ReturnType<typeof vi.fn>
const agentActionUpdate = db.agentAction.update as unknown as ReturnType<
  typeof vi.fn
>
const contactFindFirst = db.contact.findFirst as unknown as ReturnType<
  typeof vi.fn
>
const contactCreate = db.contact.create as unknown as ReturnType<typeof vi.fn>

describe("moveDealStageFromAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("transitions stage and stamps stageChangedAt", async () => {
    dealFindUnique
      .mockResolvedValueOnce({
        id: "deal-1",
        stage: "offer",
      })
      .mockResolvedValueOnce({ contactId: "contact-7" })
    dealUpdate.mockResolvedValue({})
    agentActionUpdate.mockResolvedValue({})

    const result = await moveDealStageFromAction(
      {
        id: "action-1",
        actionType: "move-deal-stage",
        payload: {
          dealId: "deal-1",
          fromStage: "offer",
          toStage: "under_contract",
          reason: "PSA fully executed",
        },
      },
      "matt@nai.test"
    )
    expect(result.status).toEqual("executed")
    expect(db.deal.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: expect.objectContaining({
        stage: "under_contract",
        stageChangedAt: expect.any(Date),
      }),
    })
    expect(syncContactRoleFromDeals).toHaveBeenCalledWith("contact-7")
  })

  it("rejects when fromStage doesn't match current stage (concurrency safety)", async () => {
    dealFindUnique.mockResolvedValue({
      id: "deal-1",
      stage: "under_contract",
    })

    await expect(
      moveDealStageFromAction(
        {
          id: "action-1",
          actionType: "move-deal-stage",
          payload: {
            dealId: "deal-1",
            fromStage: "offer",
            toStage: "under_contract",
            reason: "...",
          },
        },
        "matt@nai.test"
      )
    ).rejects.toThrow(/stage mismatch/i)
  })

  it("stamps closedAt and outcome when transitioning to closed", async () => {
    dealFindUnique
      .mockResolvedValueOnce({ id: "deal-1", stage: "closing" })
      .mockResolvedValueOnce({ contactId: "contact-9" })
    dealUpdate.mockResolvedValue({})
    agentActionUpdate.mockResolvedValue({})

    await moveDealStageFromAction(
      {
        id: "action-1",
        actionType: "move-deal-stage",
        payload: {
          dealId: "deal-1",
          fromStage: "closing",
          toStage: "closed",
          reason: "Close completed",
          outcome: "won",
        },
      },
      "matt@nai.test"
    )
    expect(db.deal.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: expect.objectContaining({
        stage: "closed",
        outcome: "won",
        closedAt: expect.any(Date),
      }),
    })
  })
})

describe("updateDealFromAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("applies allowed field updates", async () => {
    dealFindUnique.mockResolvedValue({ id: "deal-1" })
    dealUpdate.mockResolvedValue({})
    agentActionUpdate.mockResolvedValue({})

    await updateDealFromAction(
      {
        id: "action-1",
        actionType: "update-deal",
        payload: {
          dealId: "deal-1",
          fields: {
            value: 2100000,
            closingDate: "2026-06-30T00:00:00.000Z",
          },
          reason: "...",
        },
      },
      "matt@nai.test"
    )
    expect(db.deal.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: {
        value: 2100000,
        closingDate: new Date("2026-06-30T00:00:00.000Z"),
      },
    })
  })

  it("rejects updates to forbidden fields (id, contactId)", async () => {
    dealFindUnique.mockResolvedValue({ id: "deal-1" })
    await expect(
      updateDealFromAction(
        {
          id: "action-1",
          actionType: "update-deal",
          payload: {
            dealId: "deal-1",
            fields: { contactId: "another-contact" },
            reason: "...",
          },
        },
        "matt@nai.test"
      )
    ).rejects.toThrow(/forbidden field/i)
  })
})

describe("createDealFromAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a buyer-rep Deal when payload has contactId", async () => {
    dealCreate.mockResolvedValue({ id: "deal-new" })
    agentActionUpdate.mockResolvedValue({})

    const result = await createDealFromAction(
      {
        id: "action-1",
        actionType: "create-deal",
        payload: {
          contactId: "contact-1",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "showings",
          signalType: "tour",
          reason: "...",
        },
      },
      "matt@nai.test"
    )
    expect(result.status).toEqual("executed")
    expect(dealCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: "contact-1",
        dealType: "buyer_rep",
        dealSource: "buyer_rep_inferred",
        stage: "showings",
      }),
      select: { id: true },
    })
    expect(contactFindFirst).not.toHaveBeenCalled()
    expect(contactCreate).not.toHaveBeenCalled()
    expect(syncContactRoleFromDeals).toHaveBeenCalledWith("contact-1")
  })

  it("creates Deal AND finds existing Contact when payload has recipientEmail matching an existing Contact", async () => {
    contactFindFirst.mockResolvedValue({ id: "contact-existing" })
    dealCreate.mockResolvedValue({ id: "deal-new" })
    agentActionUpdate.mockResolvedValue({})

    const result = await createDealFromAction(
      {
        id: "action-2",
        actionType: "create-deal",
        payload: {
          contactId: null,
          recipientEmail: "Agent@CushWake.com",
          recipientDisplayName: "Agent",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "offer",
          signalType: "loi",
          reason: "...",
        },
      },
      "matt@nai.test"
    )
    expect(result.status).toEqual("executed")
    expect(contactFindFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: "agent@cushwake.com", mode: "insensitive" },
        archivedAt: null,
      },
      select: { id: true },
    })
    expect(contactCreate).not.toHaveBeenCalled()
    expect(dealCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: "contact-existing",
        dealType: "buyer_rep",
        dealSource: "buyer_rep_inferred",
        stage: "offer",
      }),
      select: { id: true },
    })
    expect(syncContactRoleFromDeals).toHaveBeenCalledWith("contact-existing")
  })

  it("creates Deal AND auto-creates Contact when payload has recipientEmail with no match", async () => {
    contactFindFirst.mockResolvedValue(null)
    contactCreate.mockResolvedValue({ id: "contact-auto" })
    dealCreate.mockResolvedValue({ id: "deal-new" })
    agentActionUpdate.mockResolvedValue({})

    const result = await createDealFromAction(
      {
        id: "action-3",
        actionType: "create-deal",
        payload: {
          contactId: null,
          recipientEmail: "newbroker@example.com",
          recipientDisplayName: "New Broker",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "showings",
          signalType: "tour",
          reason: "...",
        },
      },
      "matt@nai.test"
    )
    expect(result.status).toEqual("executed")
    expect(contactCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "New Broker",
        email: "newbroker@example.com",
        category: "business",
        tags: ["auto-created-from-buyer-rep-action"],
        createdBy: "agent-action-create-deal",
      }),
      select: { id: true },
    })
    expect(dealCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: "contact-auto",
        dealType: "buyer_rep",
        dealSource: "buyer_rep_inferred",
        stage: "showings",
      }),
      select: { id: true },
    })
    expect(syncContactRoleFromDeals).toHaveBeenCalledWith("contact-auto")
  })

  it("falls back to email when display name is missing while auto-creating Contact", async () => {
    contactFindFirst.mockResolvedValue(null)
    contactCreate.mockResolvedValue({ id: "contact-auto-2" })
    dealCreate.mockResolvedValue({ id: "deal-new" })
    agentActionUpdate.mockResolvedValue({})

    await createDealFromAction(
      {
        id: "action-4",
        actionType: "create-deal",
        payload: {
          contactId: null,
          recipientEmail: "noname@example.com",
          recipientDisplayName: null,
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "showings",
          reason: "...",
        },
      },
      "matt@nai.test"
    )
    expect(contactCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "noname@example.com",
        email: "noname@example.com",
      }),
      select: { id: true },
    })
  })

  it("throws when neither contactId nor recipientEmail is provided", async () => {
    await expect(
      createDealFromAction(
        {
          id: "action-5",
          actionType: "create-deal",
          payload: {
            contactId: null,
            recipientEmail: null,
            dealType: "buyer_rep",
            dealSource: "buyer_rep_inferred",
            stage: "showings",
            reason: "...",
          },
        },
        "matt@nai.test"
      )
    ).rejects.toThrow(/contactId or recipientEmail/i)
    expect(dealCreate).not.toHaveBeenCalled()
    expect(contactCreate).not.toHaveBeenCalled()
  })
})
