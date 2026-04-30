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

  it("creates AgentAction with contactId when contactId is provided", async () => {
    agentActionCreate.mockResolvedValue({ id: "action-2" })
    await proposeBuyerRepDeal({
      communicationId: "comm-2",
      contactId: "contact-7",
      recipientEmail: "agent@cushwake.com",
      recipientDisplayName: "Agent",
      signalType: "loi",
      proposedStage: "offer",
      confidence: 0.9,
    })
    const call = agentActionCreate.mock.calls[0]?.[0]
    expect(call.data.payload.contactId).toBe("contact-7")
    expect(call.data.payload.recipientEmail).toBe("agent@cushwake.com")
    expect(call.data.payload.recipientDisplayName).toBe("Agent")
  })

  it("creates AgentAction with recipientEmail when contactId is null", async () => {
    agentActionCreate.mockResolvedValue({ id: "action-3" })
    await proposeBuyerRepDeal({
      communicationId: "comm-3",
      contactId: null,
      recipientEmail: "newbroker@example.com",
      recipientDisplayName: "New Broker",
      signalType: "tour",
      proposedStage: "showings",
      confidence: 0.6,
    })
    const call = agentActionCreate.mock.calls[0]?.[0]
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
    expect(agentActionCreate).not.toHaveBeenCalled()
  })
})
