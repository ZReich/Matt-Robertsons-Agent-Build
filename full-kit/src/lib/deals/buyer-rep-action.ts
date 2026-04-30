import type { DealStage } from "@prisma/client"

import { db } from "@/lib/prisma"

export type ProposeBuyerRepInput = {
  communicationId: string
  // At least ONE of contactId / recipientEmail must be set. The hook
  // tries to match an existing Contact by recipient email; if it finds
  // one, contactId is set. Otherwise recipientEmail flows through to
  // approval-time resolution (find-or-create Contact in createDealFromAction).
  contactId?: string | null
  recipientEmail?: string | null
  recipientDisplayName?: string | null
  signalType: "tour" | "loi"
  proposedStage: DealStage
  confidence: number
}

export async function proposeBuyerRepDeal(
  input: ProposeBuyerRepInput
): Promise<{ created: boolean; actionId: string | null }> {
  if (!input.contactId && !input.recipientEmail) {
    throw new Error(
      "proposeBuyerRepDeal requires at least one of contactId or recipientEmail"
    )
  }
  const reason = `Buyer-rep ${input.signalType} signal detected with confidence ${input.confidence}`
  const action = await db.agentAction.create({
    data: {
      actionType: "create-deal",
      status: "pending",
      tier: "approve",
      summary: `Propose buyer-rep deal at ${input.proposedStage} from ${input.signalType} signal`,
      sourceCommunicationId: input.communicationId,
      payload: {
        contactId: input.contactId ?? null,
        recipientEmail: input.recipientEmail ?? null,
        recipientDisplayName: input.recipientDisplayName ?? null,
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
