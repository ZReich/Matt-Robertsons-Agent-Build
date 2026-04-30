import { db } from "@/lib/prisma"

import { mapBuildoutStageToDealStage } from "@/lib/msgraph/buildout-stage-parser"

export type ProposeStageMoveInput = {
  communicationId: string
  propertyName: string
  fromStageRaw: string
  toStageRaw: string
}

export async function proposeStageMoveFromBuildoutEmail(
  input: ProposeStageMoveInput
): Promise<{ created: boolean; actionId: string | null }> {
  const toStage = mapBuildoutStageToDealStage(input.toStageRaw)
  const fromStage = mapBuildoutStageToDealStage(input.fromStageRaw)
  if (!toStage || !fromStage) return { created: false, actionId: null }

  const deal = await db.deal.findFirst({
    where: {
      OR: [
        {
          propertyAddress: {
            contains: input.propertyName,
            mode: "insensitive",
          },
        },
        { propertyAliases: { array_contains: [input.propertyName] } },
      ],
      archivedAt: null,
    },
    select: { id: true, stage: true },
  })
  if (!deal) return { created: false, actionId: null }

  const outcome = toStage === "closed" ? "won" : undefined
  const summary = `Mirror Buildout stage move: ${input.propertyName} → ${toStage}`
  const action = await db.agentAction.create({
    data: {
      actionType: "move-deal-stage",
      status: "pending",
      tier: "approve",
      summary,
      sourceCommunicationId: input.communicationId,
      payload: {
        dealId: deal.id,
        fromStage,
        toStage,
        reason: `Buildout email reported transition from ${input.fromStageRaw} to ${input.toStageRaw}`,
        ...(outcome ? { outcome } : {}),
      },
    },
  })
  return { created: true, actionId: action.id }
}
