import { describe, expect, it } from "vitest"

import type { RoleLifecycleDeal } from "./role-lifecycle"

import { nextClientType } from "./role-lifecycle"

const NOW = new Date("2026-05-01T00:00:00Z")
const EARLIER = new Date("2026-01-01T00:00:00Z")

function deal(partial: Partial<RoleLifecycleDeal>): RoleLifecycleDeal {
  return {
    dealType: "seller_rep",
    stage: "marketing",
    outcome: null,
    closedAt: null,
    ...partial,
  }
}

describe("nextClientType", () => {
  // -------- empty state --------
  it("returns null when contact has no deals", () => {
    expect(nextClientType([])).toBeNull()
  })

  // -------- active wins over closed --------
  it("returns active_listing_client for an active seller_rep deal", () => {
    expect(
      nextClientType([deal({ dealType: "seller_rep", stage: "marketing" })])
    ).toBe("active_listing_client")
  })

  it("returns active_buyer_rep_client for an active buyer_rep deal", () => {
    expect(
      nextClientType([deal({ dealType: "buyer_rep", stage: "showings" })])
    ).toBe("active_buyer_rep_client")
  })

  it("treats tenant_rep as buyer-side (active_buyer_rep_client)", () => {
    expect(
      nextClientType([deal({ dealType: "tenant_rep", stage: "offer" })])
    ).toBe("active_buyer_rep_client")
  })

  it("prefers active_buyer_rep_client when both flows are active", () => {
    expect(
      nextClientType([
        deal({ dealType: "seller_rep", stage: "marketing" }),
        deal({ dealType: "buyer_rep", stage: "offer" }),
      ])
    ).toBe("active_buyer_rep_client")
  })

  it("ignores closed deals when an active deal exists", () => {
    expect(
      nextClientType([
        deal({
          dealType: "buyer_rep",
          stage: "closed",
          outcome: "won",
          closedAt: EARLIER,
        }),
        deal({ dealType: "seller_rep", stage: "marketing" }),
      ])
    ).toBe("active_listing_client")
  })

  // -------- past clients (split) --------
  it("returns past_listing_client when only a closed seller_rep deal exists", () => {
    expect(
      nextClientType([
        deal({
          dealType: "seller_rep",
          stage: "closed",
          outcome: "won",
          closedAt: NOW,
        }),
      ])
    ).toBe("past_listing_client")
  })

  it("returns past_buyer_client when only a closed buyer_rep deal exists", () => {
    expect(
      nextClientType([
        deal({
          dealType: "buyer_rep",
          stage: "closed",
          outcome: "won",
          closedAt: NOW,
        }),
      ])
    ).toBe("past_buyer_client")
  })

  it("returns past_buyer_client for a closed tenant_rep deal", () => {
    expect(
      nextClientType([
        deal({
          dealType: "tenant_rep",
          stage: "closed",
          outcome: "won",
          closedAt: NOW,
        }),
      ])
    ).toBe("past_buyer_client")
  })

  it("uses outcome regardless of won/lost — past_*_client still applies", () => {
    expect(
      nextClientType([
        deal({
          dealType: "seller_rep",
          stage: "closed",
          outcome: "lost",
          closedAt: NOW,
        }),
      ])
    ).toBe("past_listing_client")
  })

  it("uses outcome=null for closed-but-not-won — still past_*_client", () => {
    // Repro of the buggy backfill's `prospect` fallback. Closed is closed.
    expect(
      nextClientType([
        deal({
          dealType: "buyer_rep",
          stage: "closed",
          outcome: null,
          closedAt: NOW,
        }),
      ])
    ).toBe("past_buyer_client")
  })

  // -------- mixed-history tiebreaker (most-recent-closed wins) --------
  it("uses most-recent closedAt to break ties between mixed past deals", () => {
    expect(
      nextClientType([
        deal({
          dealType: "seller_rep",
          stage: "closed",
          outcome: "won",
          closedAt: EARLIER,
        }),
        deal({
          dealType: "buyer_rep",
          stage: "closed",
          outcome: "won",
          closedAt: NOW,
        }),
      ])
    ).toBe("past_buyer_client")
  })

  it("flips the tiebreaker when seller-side is more recent", () => {
    expect(
      nextClientType([
        deal({
          dealType: "buyer_rep",
          stage: "closed",
          outcome: "won",
          closedAt: EARLIER,
        }),
        deal({
          dealType: "seller_rep",
          stage: "closed",
          outcome: "won",
          closedAt: NOW,
        }),
      ])
    ).toBe("past_listing_client")
  })

  it("falls back to first-seen when closedAt is missing on closed deals", () => {
    // Legacy data: stage=closed but closed_at never populated. Must still
    // pick a side. Seller-rep listed first → past_listing_client.
    expect(
      nextClientType([
        deal({
          dealType: "seller_rep",
          stage: "closed",
          outcome: "won",
          closedAt: null,
        }),
        deal({
          dealType: "buyer_rep",
          stage: "closed",
          outcome: "won",
          closedAt: null,
        }),
      ])
    ).toBe("past_listing_client")
  })
})
