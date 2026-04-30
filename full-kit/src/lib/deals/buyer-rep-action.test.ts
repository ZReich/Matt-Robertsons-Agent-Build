import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { proposeBuyerRepDeal } from "./buyer-rep-action"

vi.mock("@/lib/prisma", () => ({
  db: {
    agentAction: { create: vi.fn() },
  },
}))

const agentActionCreate = db.agentAction.create as unknown as ReturnType<
  typeof vi.fn
>

describe("proposeBuyerRepDeal", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a create-deal AgentAction at tier=approve for tour signal", async () => {
    agentActionCreate.mockResolvedValue({ id: "action-1" })
    const result = await proposeBuyerRepDeal({
      communicationId: "comm-1",
      contactId: "contact-1",
      signalType: "tour",
      proposedStage: "showings",
      confidence: 0.75,
    })
    expect(result.created).toBe(true)
    expect(agentActionCreate).toHaveBeenCalledWith({
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
})
