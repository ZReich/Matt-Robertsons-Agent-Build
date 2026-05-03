import type { ClientType } from "@prisma/client"

/**
 * Pure helper: derive `Contact.clientType` from a single closed-deal /
 * closed-lease extraction. Distinct from `nextClientType` (in
 * `./role-lifecycle.ts`) which infers from the full Deal portfolio — the
 * lease pipeline operates on a `LeaseRecord` that may have no Deal row,
 * so we infer directly from the extraction's `dealKind` + `mattRepresented`
 * + close-date timing.
 *
 * Mapping (using the `ClientType` enum values that actually exist on the
 * schema today — there is no `active_tenant_client` or `past_tenant_client`
 * value, so tenant-side rolls into the buyer-rep buckets):
 *
 *   future close-date (or no close-date yet):
 *     lease + tenant   → active_buyer_rep_client
 *     lease + owner    → active_listing_client
 *     lease + both     → active_listing_client (Matt usually books these
 *                        as listing-side for cohort purposes)
 *     sale  + tenant   → active_buyer_rep_client (rare — buyer-side sale)
 *     sale  + owner    → active_listing_client
 *
 *   past close-date:
 *     lease + tenant   → past_buyer_client
 *     lease + owner    → past_listing_client
 *     lease + both     → past_listing_client
 *     sale  + tenant   → past_buyer_client
 *     sale  + owner    → past_listing_client
 *
 *   `mattRepresented === null` → null (no decision; preserve current role).
 *
 * Note on `both`: when Matt represented both sides of a deal, listing-side
 * is the right cohort because the post-close mailer / Christmas-card
 * flow treats the property owner as the long-term touchpoint.
 */
export type LeaseLifecycleInput = {
  dealKind: "lease" | "sale"
  mattRepresented: "owner" | "tenant" | "both" | null
  closeDate: Date | null
  /** "Now" — for testability. Defaults handled by the caller. */
  now: Date
}

export function nextClientTypeForLease(
  input: LeaseLifecycleInput
): ClientType | null {
  if (!input.mattRepresented) return null

  const isPast =
    input.closeDate !== null &&
    input.closeDate.getTime() < input.now.getTime()

  if (isPast) {
    if (input.mattRepresented === "tenant") return "past_buyer_client"
    return "past_listing_client" // owner | both
  }

  // Future close (or no close date yet) — still active.
  if (input.mattRepresented === "tenant") return "active_buyer_rep_client"
  return "active_listing_client" // owner | both
}
