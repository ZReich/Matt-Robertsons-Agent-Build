import type { DealOutcome, DealStage } from "@prisma/client"

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

/**
 * Map Buildout's pipeline stage labels to our internal DealStage enum.
 *
 * Buildout's actual labels (as observed in the live email corpus 2026-01 → 04):
 *   Sourcing, Evaluating, Marketing, Showings, Offer, Transacting, Closed, Dead
 *
 * Notes:
 *  - "Sourcing" + "Evaluating" both collapse to `prospecting` — Matt's
 *    pipeline doesn't distinguish between "we identified the prospect" and
 *    "we're evaluating whether to take the listing." Both are pre-listing
 *    activity.
 *  - "Dead" maps to `closed`. The won/lost distinction lives in DealOutcome
 *    (see `mapBuildoutStageToDealOutcome`).
 */
const BUILDOUT_TO_DEAL_STAGE: Record<string, DealStage> = {
  prospecting: "prospecting",
  sourcing: "prospecting",
  evaluating: "prospecting",
  listing: "listing",
  marketing: "marketing",
  showings: "showings",
  offer: "offer",
  transacting: "under_contract",
  "under contract": "under_contract",
  "due diligence": "due_diligence",
  closing: "closing",
  closed: "closed",
  // "Dead" in Buildout = the deal didn't happen. We treat it as `closed` and
  // tag DealOutcome="lost" via mapBuildoutStageToDealOutcome.
  dead: "closed",
}

export function mapBuildoutStageToDealStage(raw: string): DealStage | null {
  return BUILDOUT_TO_DEAL_STAGE[raw.toLowerCase()] ?? null
}

/**
 * Outcome implied by a Buildout target stage. "Dead" → lost; "Closed" →
 * won (terminal happy path). Anything else returns null and the caller
 * should leave outcome unset.
 */
export function mapBuildoutStageToDealOutcome(
  rawTo: string
): DealOutcome | null {
  const k = rawTo.toLowerCase()
  if (k === "closed") return "won"
  if (k === "dead") return "lost"
  return null
}
