import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { proposeStageMoveFromBuildoutEmail } from "./buildout-stage-action"

vi.mock("@/lib/prisma", () => ({
  db: {
    deal: { findFirst: vi.fn() },
    agentAction: { create: vi.fn() },
  },
}))

describe("proposeStageMoveFromBuildoutEmail", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a move-deal-stage AgentAction when a deal matches by name", async () => {
    ;(db.deal.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "deal-1",
      stage: "offer",
    })
    ;(db.agentAction.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "action-1",
    })

    const result = await proposeStageMoveFromBuildoutEmail({
      communicationId: "comm-1",
      propertyName: "Alpenglow Healthcare LLC Lease",
      fromStageRaw: "Transacting",
      toStageRaw: "Closed",
    })

    expect(result.created).toBe(true)
    expect(db.agentAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: "move-deal-stage",
        status: "pending",
        tier: "approve",
        sourceCommunicationId: "comm-1",
        payload: expect.objectContaining({
          dealId: "deal-1",
          fromStage: "under_contract",
          toStage: "closed",
          outcome: "won",
        }),
      }),
    })
  })

  it("returns no-action when no deal matches", async () => {
    ;(db.deal.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await proposeStageMoveFromBuildoutEmail({
      communicationId: "comm-1",
      propertyName: "Unknown Building",
      fromStageRaw: "Marketing",
      toStageRaw: "Showings",
    })
    expect(result.created).toBe(false)
    expect(db.agentAction.create).not.toHaveBeenCalled()
  })

  it("returns no-action when toStage is unmappable", async () => {
    const result = await proposeStageMoveFromBuildoutEmail({
      communicationId: "comm-1",
      propertyName: "Whatever",
      fromStageRaw: "Marketing",
      toStageRaw: "FrobnicationStage",
    })
    expect(result.created).toBe(false)
  })
})
