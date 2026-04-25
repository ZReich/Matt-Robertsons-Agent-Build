import { describe, expect, it } from "vitest"

import { isUnread } from "./unread"

function comm(
  direction: "inbound" | "outbound",
  minutesAgo: number
): { direction: "inbound" | "outbound"; date: Date } {
  return {
    direction,
    date: new Date(Date.now() - minutesAgo * 60_000),
  }
}

describe("isUnread", () => {
  it("returns true when leadStatus is new regardless of views", () => {
    expect(
      isUnread({
        leadStatus: "new",
        leadAt: new Date("2026-04-20T00:00:00Z"),
        leadLastViewedAt: new Date("2026-04-23T00:00:00Z"),
        communications: [],
      })
    ).toBe(true)
  })

  it("returns false when status is past new and no inbound is newer than the last view", () => {
    expect(
      isUnread({
        leadStatus: "vetted",
        leadAt: new Date("2026-04-20T00:00:00Z"),
        leadLastViewedAt: new Date(),
        communications: [comm("inbound", 120)],
      })
    ).toBe(false)
  })

  it("returns true when an inbound communication arrived after last view", () => {
    expect(
      isUnread({
        leadStatus: "contacted",
        leadAt: new Date("2026-04-20T00:00:00Z"),
        leadLastViewedAt: new Date(Date.now() - 3 * 3600_000),
        communications: [comm("inbound", 60)],
      })
    ).toBe(true)
  })

  it("ignores outbound communications for unread computation", () => {
    expect(
      isUnread({
        leadStatus: "contacted",
        leadAt: new Date("2026-04-20T00:00:00Z"),
        leadLastViewedAt: new Date(Date.now() - 3 * 3600_000),
        communications: [comm("outbound", 60)],
      })
    ).toBe(false)
  })

  it("uses leadAt as the comparison baseline when never viewed", () => {
    expect(
      isUnread({
        leadStatus: "vetted",
        leadAt: new Date(Date.now() - 2 * 3600_000),
        leadLastViewedAt: null,
        communications: [comm("inbound", 60)],
      })
    ).toBe(true)
  })

  it("returns false when viewed once and no new inbound has arrived", () => {
    expect(
      isUnread({
        leadStatus: "vetted",
        leadAt: new Date(Date.now() - 4 * 3600_000),
        leadLastViewedAt: new Date(Date.now() - 1 * 3600_000),
        communications: [comm("inbound", 3 * 60)],
      })
    ).toBe(false)
  })
})
