import { describe, expect, it } from "vitest"

import { isDailyListingsEmail } from "./classifier"

describe("isDailyListingsEmail", () => {
  it("matches the canonical sender + subject", () => {
    expect(
      isDailyListingsEmail({
        subject: "Daily Listings",
        metadata: { from: { address: "data@naibusinessproperties.com" } },
      })
    ).toBe(true)
  })

  it("matches case-insensitively on subject", () => {
    expect(
      isDailyListingsEmail({
        subject: "daily listings",
        metadata: { from: { address: "data@naibusinessproperties.com" } },
      })
    ).toBe(true)
  })

  it("matches subject prefixed with date suffix", () => {
    expect(
      isDailyListingsEmail({
        subject: "Daily Listings - May 1, 2026",
        metadata: { from: { address: "data@naibusinessproperties.com" } },
      })
    ).toBe(true)
  })

  it("rejects unrelated subjects from the same sender", () => {
    expect(
      isDailyListingsEmail({
        subject: "Re: marketing proposal",
        metadata: { from: { address: "data@naibusinessproperties.com" } },
      })
    ).toBe(false)
  })

  it("rejects matching subjects from a different sender", () => {
    expect(
      isDailyListingsEmail({
        subject: "Daily Listings",
        metadata: { from: { address: "marketing@somewhere-else.com" } },
      })
    ).toBe(false)
  })

  it("falls back to subject-only when metadata sender is missing", () => {
    expect(
      isDailyListingsEmail({ subject: "Daily Listings", metadata: null })
    ).toBe(true)
    expect(
      isDailyListingsEmail({ subject: "Daily Listings", metadata: {} })
    ).toBe(true)
  })

  it("returns false on null/empty subject", () => {
    expect(isDailyListingsEmail({ subject: null, metadata: null })).toBe(false)
    expect(isDailyListingsEmail({ subject: "", metadata: null })).toBe(false)
  })
})
