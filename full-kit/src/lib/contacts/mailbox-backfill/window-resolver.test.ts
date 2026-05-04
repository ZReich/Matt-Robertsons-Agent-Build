import { describe, expect, it } from "vitest"

import { resolveBackfillWindows } from "./window-resolver"

describe("resolveBackfillWindows", () => {
  const FAR_PAST = new Date("1970-01-01T00:00:00Z")
  const NOW = new Date("2026-05-04T00:00:00Z")

  it("lifetime mode returns single far-past-to-now window", () => {
    expect(
      resolveBackfillWindows({
        mode: "lifetime",
        deals: [],
        comms: [],
        now: NOW,
      })
    ).toEqual([{ start: FAR_PAST, end: NOW, source: "lifetime" }])
  })

  it("deal-anchored single deal expands ±24mo around closedAt", () => {
    const deals = [
      { createdAt: new Date("2023-01-15"), closedAt: new Date("2023-03-30") },
    ]
    const windows = resolveBackfillWindows({
      mode: "deal-anchored",
      deals,
      comms: [],
      now: NOW,
    })
    expect(windows).toHaveLength(1)
    expect(windows[0].start.toISOString()).toBe("2021-01-15T00:00:00.000Z")
    expect(windows[0].end.toISOString()).toBe("2025-03-30T00:00:00.000Z")
    expect(windows[0].source).toBe("deal")
  })

  it("deal-anchored open deal extends end to now+24mo", () => {
    const deals = [{ createdAt: new Date("2024-06-01"), closedAt: null }]
    const windows = resolveBackfillWindows({
      mode: "deal-anchored",
      deals,
      comms: [],
      now: NOW,
    })
    expect(windows[0].end.toISOString()).toBe("2028-05-04T00:00:00.000Z")
  })

  it("deal-anchored multiple deals union into one or more windows", () => {
    const deals = [
      { createdAt: new Date("2020-01-01"), closedAt: new Date("2020-06-01") },
      { createdAt: new Date("2024-01-01"), closedAt: new Date("2024-06-01") },
    ]
    const windows = resolveBackfillWindows({
      mode: "deal-anchored",
      deals,
      comms: [],
      now: NOW,
    })
    // Per the per-deal rule (start = createdAt - 24mo, end = closedAt + 24mo):
    // Deal 1 → 2018-01-01 to 2022-06-01; Deal 2 → 2022-01-01 to 2026-06-01.
    // Both overlap on 2022 → union to single window 2018-01-01 to 2026-06-01,
    // which spans 8.4 years — clamped to 8 calendar years (start pulled forward).
    expect(windows).toHaveLength(1)
    expect(windows[0].end.toISOString()).toBe("2026-06-01T00:00:00.000Z")
    expect(windows[0].start.toISOString()).toBe("2018-06-01T00:00:00.000Z")
  })

  it("deal-anchored disjoint deals stay as separate windows", () => {
    const deals = [
      { createdAt: new Date("2018-01-01"), closedAt: new Date("2018-02-01") },
      { createdAt: new Date("2024-01-01"), closedAt: new Date("2024-02-01") },
    ]
    const windows = resolveBackfillWindows({
      mode: "deal-anchored",
      deals,
      comms: [],
      now: NOW,
    })
    expect(windows.length).toBeGreaterThan(1)
  })

  it("deal-anchored with no deals falls back to comm window", () => {
    const comms = [{ date: new Date("2023-06-01") }]
    const windows = resolveBackfillWindows({
      mode: "deal-anchored",
      deals: [],
      comms,
      now: NOW,
    })
    expect(windows[0].source).toBe("comm")
    expect(windows[0].start.toISOString()).toBe("2021-06-01T00:00:00.000Z")
  })

  it("deal-anchored with neither returns empty array", () => {
    expect(
      resolveBackfillWindows({
        mode: "deal-anchored",
        deals: [],
        comms: [],
        now: NOW,
      })
    ).toEqual([])
  })

  it("clamps total span to 8 years per window", () => {
    const deals = [
      { createdAt: new Date("2010-01-01"), closedAt: new Date("2024-01-01") },
    ]
    const windows = resolveBackfillWindows({
      mode: "deal-anchored",
      deals,
      comms: [],
      now: NOW,
    })
    const span = windows[0].end.getTime() - windows[0].start.getTime()
    const eightYears = 8 * 365 * 24 * 60 * 60 * 1000
    expect(span).toBeLessThanOrEqual(eightYears + 2 * 24 * 60 * 60 * 1000) // +2 days slack for leap-year padding
  })
})
