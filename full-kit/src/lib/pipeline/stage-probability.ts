import type { DealStage } from "@prisma/client"

export const DEAL_STAGES = [
  "prospecting",
  "listing",
  "marketing",
  "showings",
  "offer",
  "under_contract",
  "due_diligence",
  "closing",
  "closed",
] as const satisfies readonly DealStage[]

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  prospecting: "Prospecting",
  listing: "Listing",
  marketing: "Marketing",
  showings: "Showings",
  offer: "Offer",
  under_contract: "Under Contract",
  due_diligence: "Due Diligence",
  closing: "Closing",
  closed: "Closed",
}

export const DEAL_STAGE_PROBABILITY: Record<DealStage, number> = {
  prospecting: 10,
  listing: 20,
  marketing: 30,
  showings: 40,
  offer: 60,
  under_contract: 75,
  due_diligence: 85,
  closing: 95,
  closed: 100,
}

export function getStageProbability(
  stage: DealStage,
  override?: number | null
) {
  return override ?? DEAL_STAGE_PROBABILITY[stage]
}
