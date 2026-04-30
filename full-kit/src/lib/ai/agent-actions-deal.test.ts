import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  moveDealStageFromAction,
  updateDealFromAction,
} from "./agent-actions-deal"

vi.mock("@/lib/prisma", () => ({
  db: {
    deal: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    agentAction: {
      update: vi.fn(),
    },
  },
}))

describe("moveDealStageFromAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("transitions stage and stamps stageChangedAt", async () => {
    db.deal.findUnique.mockResolvedValue({
      id: "deal-1",
      stage: "offer",
    })
    db.deal.update.mockResolvedValue({})
    db.agentAction.update.mockResolvedValue({})

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
  })

  it("rejects when fromStage doesn't match current stage (concurrency safety)", async () => {
    db.deal.findUnique.mockResolvedValue({
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
    db.deal.findUnique.mockResolvedValue({ id: "deal-1", stage: "closing" })
    db.deal.update.mockResolvedValue({})
    db.agentAction.update.mockResolvedValue({})

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
    db.deal.findUnique.mockResolvedValue({ id: "deal-1" })
    db.deal.update.mockResolvedValue({})
    db.agentAction.update.mockResolvedValue({})

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
    db.deal.findUnique.mockResolvedValue({ id: "deal-1" })
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
