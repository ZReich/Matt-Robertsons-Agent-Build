import type { DealStage } from "@prisma/client"

const TRANSITION_RE = /was updated from\s+(\w+(?:\s\w+)*)\s+to\s+(\w+(?:\s\w+)*)/

export type BuildoutStageTransition = {
  fromStageRaw: string
  toStageRaw: string
}

export function parseBuildoutStageTransition(
  body: string
): BuildoutStageTransition | null {
  const match = body.match(TRANSITION_RE)
  if (!match) return null
  return { fromStageRaw: match[1].trim(), toStageRaw: match[2].trim() }
}

const BUILDOUT_TO_DEAL_STAGE: Record<string, DealStage> = {
  prospecting: "prospecting",
  marketing: "marketing",
  showings: "showings",
  offer: "offer",
  transacting: "under_contract",
  "under contract": "under_contract",
  "due diligence": "due_diligence",
  closing: "closing",
  closed: "closed",
}

export function mapBuildoutStageToDealStage(raw: string): DealStage | null {
  return BUILDOUT_TO_DEAL_STAGE[raw.toLowerCase()] ?? null
}
