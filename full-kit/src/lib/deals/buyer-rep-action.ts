import type { DealStage } from "@prisma/client"

import { db } from "@/lib/prisma"

export type ProposeBuyerRepInput = {
  communicationId: string
  contactId: string
  signalType: "tour" | "loi"
  proposedStage: DealStage
  confidence: number
}

export async function proposeBuyerRepDeal(
  input: ProposeBuyerRepInput
): Promise<{ created: boolean; actionId: string | null }> {
  const reason = `Buyer-rep ${input.signalType} signal detected with confidence ${input.confidence}`
  const action = await db.agentAction.create({
    data: {
      actionType: "create-deal",
      status: "pending",
      tier: "approve",
      summary: `Propose buyer-rep deal at ${input.proposedStage} from ${input.signalType} signal`,
      sourceCommunicationId: input.communicationId,
      payload: {
        contactId: input.contactId,
        dealType: "buyer_rep",
        dealSource: "buyer_rep_inferred",
        stage: input.proposedStage,
        signalType: input.signalType,
        confidence: input.confidence,
        reason,
      },
    },
  })
  return { created: true, actionId: action.id }
}
