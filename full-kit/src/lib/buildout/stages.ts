export const CANONICAL_DEAL_STAGES = [
  "unknown",
  "prospect",
  "sourcing",
  "evaluating",
  "touring",
  "listing",
  "marketing",
  "loi_offer",
  "transacting",
  "under_contract",
  "due_diligence",
  "contingent",
  "closing",
  "closed",
  "dead",
  "nurture",
  "commission_realized",
] as const

export type CanonicalDealStage = (typeof CANONICAL_DEAL_STAGES)[number]

const BUILDOUT_STAGE_MAP: Record<string, CanonicalDealStage> = {
  prospect: "prospect",
  prospecting: "prospect",
  sourcing: "sourcing",
  source: "sourcing",
  evaluating: "evaluating",
  evaluation: "evaluating",
  touring: "touring",
  tour: "touring",
  listing: "listing",
  listed: "listing",
  marketing: "marketing",
  loi: "loi_offer",
  loi_offer: "loi_offer",
  offer: "loi_offer",
  transacting: "transacting",
  under_contract: "under_contract",
  pending: "under_contract",
  due_diligence: "due_diligence",
  dd: "due_diligence",
  contingent: "contingent",
  closing: "closing",
  closed: "closed",
  paid: "commission_realized",
  commission_realized: "commission_realized",
  commission_paid: "commission_realized",
  dead: "dead",
  nurture: "nurture",
}

export type StageMapResult = {
  sourceStageRaw: string
  canonicalStage: CanonicalDealStage
  confidence: number
  reason: string
}

export function mapBuildoutStage(
  stage: string | null | undefined
): StageMapResult {
  const sourceStageRaw = (stage ?? "").trim()
  if (!sourceStageRaw) {
    return {
      sourceStageRaw,
      canonicalStage: "unknown",
      confidence: 0,
      reason: "missing-stage",
    }
  }

  const key = normalizeStageKey(sourceStageRaw)
  const canonicalStage = BUILDOUT_STAGE_MAP[key] ?? "unknown"
  return {
    sourceStageRaw,
    canonicalStage,
    confidence: canonicalStage === "unknown" ? 0.25 : 1,
    reason:
      canonicalStage === "unknown"
        ? "unmapped-buildout-stage"
        : "mapped-buildout-stage",
  }
}

export function normalizeStageKey(stage: string): string {
  return stage
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_")
}

export type StageTransition = {
  previousStageRaw?: string
  newStageRaw?: string
  previousCanonicalStage?: CanonicalDealStage
  newCanonicalStage?: CanonicalDealStage
}

export function mapBuildoutStageTransition({
  previousStageRaw,
  newStageRaw,
}: Pick<StageTransition, "previousStageRaw" | "newStageRaw">): StageTransition {
  const previous = previousStageRaw ? mapBuildoutStage(previousStageRaw) : null
  const next = newStageRaw ? mapBuildoutStage(newStageRaw) : null
  return {
    previousStageRaw: previous?.sourceStageRaw,
    newStageRaw: next?.sourceStageRaw,
    previousCanonicalStage: previous?.canonicalStage,
    newCanonicalStage: next?.canonicalStage,
  }
}
