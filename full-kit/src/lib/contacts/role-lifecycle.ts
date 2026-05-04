import type { ClientType, DealOutcome, DealType } from "@prisma/client"

/**
 * Minimal Deal shape required by `nextClientType`. Pure-function input —
 * doesn't touch Prisma directly so it's trivially unit-testable.
 */
export type RoleLifecycleDeal = {
  dealType: DealType
  /** DealStage as a string ("closed" is the terminal stage). */
  stage: string
  outcome: DealOutcome | null
  /** When the deal entered `closed` stage. May be null on legacy rows. */
  closedAt: Date | null
}

/**
 * Pure function: given a contact's deal portfolio, return the ClientType
 * that role-lifecycle should set, or null if the contact has no deals.
 *
 * Rules:
 *   - No deals → null (don't infer a role).
 *   - Any active buyer-side deal (buyer_rep or tenant_rep) → active_buyer_rep_client.
 *     Buyer-side wins over an active listing because Matt's buyer-rep work is
 *     more relationship-driven and we want it surfaced first.
 *   - Else any active seller_rep deal → active_listing_client.
 *   - Else (all deals closed):
 *       - Most-recent-closed deal's type decides:
 *         seller_rep → past_listing_client
 *         buyer_rep / tenant_rep → past_buyer_client
 *       - "Most recent" uses closedAt; null closedAt sorts as oldest so the
 *         tiebreaker becomes input order. (Legacy rows missing closedAt
 *         shouldn't outrank rows that have it.)
 *       - Outcome (won/lost/withdrawn/expired) does NOT change the bucket —
 *         a closed deal is past-client regardless. Won/lost detail lives on
 *         the Deal row.
 */
export function nextClientType(deals: RoleLifecycleDeal[]): ClientType | null {
  if (deals.length === 0) return null

  const hasActiveBuyerSide = deals.some(
    (d) =>
      (d.dealType === "buyer_rep" || d.dealType === "tenant_rep") &&
      d.stage !== "closed"
  )
  if (hasActiveBuyerSide) return "active_buyer_rep_client"

  const hasActiveListing = deals.some(
    (d) => d.dealType === "seller_rep" && d.stage !== "closed"
  )
  if (hasActiveListing) return "active_listing_client"

  // All deals closed. Pick the most-recent-closed deal's side.
  const closed = deals.filter((d) => d.stage === "closed")
  if (closed.length === 0) {
    // No active and nothing flagged closed — degenerate (e.g. all stages are
    // mid-funnel non-active by some upstream definition we don't know about).
    // Treat as "no decision" rather than guessing.
    return null
  }

  // Sort: rows with closedAt come first (descending by closedAt). Null
  // closedAt rows fall to the end and break ties by input order.
  const sorted = [...closed].sort((a, b) => {
    const aTs = a.closedAt ? a.closedAt.getTime() : -Infinity
    const bTs = b.closedAt ? b.closedAt.getTime() : -Infinity
    return bTs - aTs
  })

  const winner = sorted[0]
  if (winner.dealType === "seller_rep") return "past_listing_client"
  // buyer_rep and tenant_rep both map to past_buyer_client.
  return "past_buyer_client"
}
