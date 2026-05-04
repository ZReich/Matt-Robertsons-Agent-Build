import { beforeEach, describe, expect, it, vi } from "vitest"

import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"
import { db } from "@/lib/prisma"

import {
  createDealFromAction,
  moveDealStageFromAction,
  updateDealFromAction,
} from "./agent-actions-deal"

vi.mock("@/lib/prisma", () => {
  const dbMock = {
    deal: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
    // SELECT FOR UPDATE on agent_actions, etc.
    $queryRaw: vi.fn(),
  }
  return {
    db: {
      ...dbMock,
      // $transaction passes the same db mock as the tx client so existing
      // tests that mock `db.deal.findUnique` apply transparently.
      $transaction: vi.fn(
        async (fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock)
      ),
    },
  }
})

vi.mock("@/lib/contacts/sync-contact-role", () => ({
  syncContactRoleFromDeals: vi.fn(),
}))

const dealFindUnique = db.deal.findUnique as unknown as ReturnType<
  typeof vi.fn
>
const dealFindFirst = db.deal.findFirst as unknown as ReturnType<typeof vi.fn>
const dealUpdate = db.deal.update as unknown as ReturnType<typeof vi.fn>
const dealCreate = db.deal.create as unknown as ReturnType<typeof vi.fn>
const agentActionUpdate = db.agentAction.update as unknown as ReturnType<
  typeof vi.fn
>
const contactFindFirst = db.contact.findFirst as unknown as ReturnType<
  typeof vi.fn
>
const contactCreate = db.contact.create as unknown as ReturnType<typeof vi.fn>
const queryRaw = (db as unknown as { $queryRaw: ReturnType<typeof vi.fn> })
  .$queryRaw

// Helper: by default the SELECT FOR UPDATE on agent_actions returns
// status=pending. Tests that exercise the locked-already-executed branch can
// override with mockResolvedValueOnce.
function defaultQueryRawPending() {
  queryRaw.mockResolvedValue([{ status: "pending" }])
}

describe("moveDealStageFromAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaultQueryRawPending()
  })

  it("transitions stage and stamps stageChangedAt", async () => {
    dealFindUnique.mockResolvedValueOnce({
      id: "deal-1",
      stage: "offer",
      contactId: "contact-7",
    })
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
    expect(syncContactRoleFromDeals).toHaveBeenCalledWith(
      "contact-7",
      expect.objectContaining({
        trigger: "deal_stage_change",
        dealId: "deal-1",
        sourceAgentActionId: "action-1",
      }),
      expect.anything()
    )
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
  beforeEach(() => {
    vi.clearAllMocks()
    defaultQueryRawPending()
  })

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
  beforeEach(() => {
    vi.clearAllMocks()
    defaultQueryRawPending()
    // Default: no existing buyer-rep Deal blocks creation. Tests that exercise
    // the dedupe path override this via mockResolvedValue.
    dealFindFirst.mockResolvedValue(null)
  })

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

// BLOCKER 1: SELECT … FOR UPDATE on agent_actions row prevents concurrent
// approvals from doubling side effects. Tests that the second call into
// each handler with the same action ID — after the first one already
// executed — is idempotent (no extra Deal mutation, returns executed shape).
describe("agent-action handlers — locked idempotency (BLOCKER 1)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("moveDealStageFromAction: second concurrent approve is idempotent", async () => {
    // First call: status=pending → executes. Second call: status=executed →
    // returns idempotently without touching deal.update.
    queryRaw
      .mockResolvedValueOnce([{ status: "pending" }])
      .mockResolvedValueOnce([{ status: "executed" }])
    dealFindUnique.mockResolvedValueOnce({
      id: "deal-1",
      stage: "offer",
      contactId: "contact-7",
    })
    dealUpdate.mockResolvedValue({})
    agentActionUpdate.mockResolvedValue({})

    const payload = {
      dealId: "deal-1",
      fromStage: "offer" as const,
      toStage: "under_contract" as const,
      reason: "PSA fully executed",
    }
    const action = {
      id: "action-1",
      actionType: "move-deal-stage" as const,
      payload,
    }

    const first = await moveDealStageFromAction(action, "matt@nai.test")
    const second = await moveDealStageFromAction(action, "matt@nai.test")

    expect(first.status).toEqual("executed")
    expect(second.status).toEqual("executed")
    // deal.update fired exactly once across both calls.
    expect(dealUpdate).toHaveBeenCalledTimes(1)
    // agentAction.update fired exactly once (only the first call's terminal
    // status write).
    expect(agentActionUpdate).toHaveBeenCalledTimes(1)
  })

  it("updateDealFromAction: second concurrent approve is idempotent", async () => {
    queryRaw
      .mockResolvedValueOnce([{ status: "pending" }])
      .mockResolvedValueOnce([{ status: "executed" }])
    dealFindUnique.mockResolvedValueOnce({ id: "deal-1" })
    dealUpdate.mockResolvedValue({})
    agentActionUpdate.mockResolvedValue({})

    const action = {
      id: "action-2",
      actionType: "update-deal" as const,
      payload: {
        dealId: "deal-1",
        fields: { value: 2100000 },
        reason: "...",
      },
    }

    const first = await updateDealFromAction(action, "matt@nai.test")
    const second = await updateDealFromAction(action, "matt@nai.test")

    expect(first.status).toEqual("executed")
    expect(second.status).toEqual("executed")
    expect(dealUpdate).toHaveBeenCalledTimes(1)
    expect(agentActionUpdate).toHaveBeenCalledTimes(1)
  })

  it("createDealFromAction: second concurrent approve is idempotent", async () => {
    queryRaw
      .mockResolvedValueOnce([{ status: "pending" }])
      .mockResolvedValueOnce([{ status: "executed" }])
    dealFindFirst.mockResolvedValue(null) // no existing buyer-rep dedupe match
    dealCreate.mockResolvedValue({ id: "deal-new" })
    agentActionUpdate.mockResolvedValue({})

    const action = {
      id: "action-3",
      actionType: "create-deal" as const,
      payload: {
        contactId: "contact-1",
        dealType: "buyer_rep" as const,
        dealSource: "buyer_rep_inferred" as const,
        stage: "showings" as const,
        reason: "...",
      },
    }

    const first = await createDealFromAction(action, "matt@nai.test")
    const second = await createDealFromAction(action, "matt@nai.test")

    expect(first.status).toEqual("executed")
    expect(second.status).toEqual("executed")
    // deal.create fired exactly once across both calls.
    expect(dealCreate).toHaveBeenCalledTimes(1)
    // agentAction.update fired exactly once.
    expect(agentActionUpdate).toHaveBeenCalledTimes(1)
  })

  it("moveDealStageFromAction: surfaces invalid status (rejected) on locked read", async () => {
    queryRaw.mockResolvedValueOnce([{ status: "rejected" }])
    await expect(
      moveDealStageFromAction(
        {
          id: "action-x",
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
    ).rejects.toThrow(/cannot approve rejected/i)
    expect(dealUpdate).not.toHaveBeenCalled()
  })
})

// BLOCKER 2: Phase D dedupe at approval time. Approving a legacy
// create-deal AgentAction must not mint a duplicate buyer-rep Deal when one
// already exists for the contact.
describe("createDealFromAction — Phase D dedupe at approval (BLOCKER 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaultQueryRawPending()
  })

  it("returns executed without creating a Deal when an active buyer_rep Deal exists for the contact", async () => {
    dealFindFirst.mockResolvedValue({ id: "existing-deal" })
    agentActionUpdate.mockResolvedValue({})

    const result = await createDealFromAction(
      {
        id: "action-dup-1",
        actionType: "create-deal",
        payload: {
          contactId: "contact-1",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "showings",
          reason: "legacy pending row",
        },
      },
      "matt@nai.test"
    )

    expect(result.status).toEqual("executed")
    expect(dealCreate).not.toHaveBeenCalled()
    expect(agentActionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "action-dup-1" },
        data: expect.objectContaining({
          status: "executed",
          feedback: "duplicate-of-existing-deal",
        }),
      })
    )
  })

  it("creates the Deal when the existing buyer_rep Deal is archived (archivedAt != null)", async () => {
    // dedupe check filters archivedAt: null, so an archived Deal returns
    // null from findFirst and the create path proceeds.
    dealFindFirst.mockResolvedValue(null)
    dealCreate.mockResolvedValue({ id: "deal-new" })
    agentActionUpdate.mockResolvedValue({})

    const result = await createDealFromAction(
      {
        id: "action-dup-2",
        actionType: "create-deal",
        payload: {
          contactId: "contact-1",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "showings",
          reason: "...",
        },
      },
      "matt@nai.test"
    )

    expect(result.status).toEqual("executed")
    expect(dealCreate).toHaveBeenCalledTimes(1)
    // dedupe filter excluded archived rows
    expect(dealFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contactId: "contact-1",
          dealType: "buyer_rep",
          archivedAt: null,
        }),
      })
    )
  })

  it("creates the Deal when the existing buyer_rep Deal is closed (re-engagement allowed)", async () => {
    // dedupe filter is { stage: { not: "closed" }, archivedAt: null }, so a
    // closed Deal does NOT match and findFirst returns null.
    dealFindFirst.mockResolvedValue(null)
    dealCreate.mockResolvedValue({ id: "deal-new" })
    agentActionUpdate.mockResolvedValue({})

    const result = await createDealFromAction(
      {
        id: "action-dup-3",
        actionType: "create-deal",
        payload: {
          contactId: "contact-1",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "showings",
          reason: "...",
        },
      },
      "matt@nai.test"
    )

    expect(result.status).toEqual("executed")
    expect(dealCreate).toHaveBeenCalledTimes(1)
    expect(dealFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stage: { not: "closed" },
        }),
      })
    )
  })

  it("creates the Deal when the contact only has a seller_rep Deal (different dealType)", async () => {
    // dealType filter scopes to buyer_rep only, so a seller_rep Deal does
    // NOT match and findFirst returns null.
    dealFindFirst.mockResolvedValue(null)
    dealCreate.mockResolvedValue({ id: "deal-new" })
    agentActionUpdate.mockResolvedValue({})

    const result = await createDealFromAction(
      {
        id: "action-dup-4",
        actionType: "create-deal",
        payload: {
          contactId: "contact-1",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "showings",
          reason: "...",
        },
      },
      "matt@nai.test"
    )

    expect(result.status).toEqual("executed")
    expect(dealCreate).toHaveBeenCalledTimes(1)
    expect(dealFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dealType: "buyer_rep",
        }),
      })
    )
  })
})
