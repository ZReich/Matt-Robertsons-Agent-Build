import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const findUnique = vi.fn()
const upsert = vi.fn()

vi.mock("@/lib/prisma", () => ({
  db: {
    systemState: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
    },
  },
}))

import {
  getLastDailyListingsSweep,
  setLastDailyListingsSweep,
} from "./last-daily-listings-sweep"

beforeEach(() => {
  findUnique.mockReset()
  upsert.mockReset()
})

describe("getLastDailyListingsSweep", () => {
  it("returns null when the row does not exist", async () => {
    findUnique.mockResolvedValueOnce(null)
    const result = await getLastDailyListingsSweep()
    expect(result).toBeNull()
    expect(findUnique).toHaveBeenCalledWith({
      where: { key: "app.last_daily_listings_sweep" },
    })
  })

  it("returns the coerced row when it exists", async () => {
    findUnique.mockResolvedValueOnce({
      key: "app.last_daily_listings_sweep",
      value: {
        ranAt: "2026-05-02T15:00:00.000Z",
        candidates: 3,
        processed: 3,
        listingsParsed: 6,
        draftsCreated: 2,
        draftsSent: 0,
        errors: 0,
      },
    })
    const result = await getLastDailyListingsSweep()
    expect(result).toEqual({
      ranAt: "2026-05-02T15:00:00.000Z",
      candidates: 3,
      processed: 3,
      listingsParsed: 6,
      draftsCreated: 2,
      draftsSent: 0,
      errors: 0,
    })
  })

  it("returns null when the value is malformed", async () => {
    findUnique.mockResolvedValueOnce({
      key: "app.last_daily_listings_sweep",
      value: "not-an-object",
    })
    expect(await getLastDailyListingsSweep()).toBeNull()
  })

  it("coerces missing numeric fields to 0 but requires ranAt", async () => {
    findUnique.mockResolvedValueOnce({
      key: "app.last_daily_listings_sweep",
      value: { ranAt: "2026-05-02T15:00:00.000Z" },
    })
    expect(await getLastDailyListingsSweep()).toEqual({
      ranAt: "2026-05-02T15:00:00.000Z",
      candidates: 0,
      processed: 0,
      listingsParsed: 0,
      draftsCreated: 0,
      draftsSent: 0,
      errors: 0,
    })
  })

  it("returns null when ranAt is missing", async () => {
    findUnique.mockResolvedValueOnce({
      key: "app.last_daily_listings_sweep",
      value: { candidates: 1 },
    })
    expect(await getLastDailyListingsSweep()).toBeNull()
  })
})

describe("setLastDailyListingsSweep", () => {
  it("upserts the row at the canonical key", async () => {
    upsert.mockResolvedValueOnce({})
    const summary = {
      ranAt: "2026-05-02T15:00:00.000Z",
      candidates: 3,
      processed: 3,
      listingsParsed: 6,
      draftsCreated: 2,
      draftsSent: 0,
      errors: 1,
    }
    await setLastDailyListingsSweep(summary)
    expect(upsert).toHaveBeenCalledTimes(1)
    const args = upsert.mock.calls[0]?.[0] as {
      where: { key: string }
      create: { key: string; value: unknown }
      update: { value: unknown }
    }
    expect(args.where.key).toBe("app.last_daily_listings_sweep")
    expect(args.create).toEqual({
      key: "app.last_daily_listings_sweep",
      value: summary,
    })
    expect(args.update).toEqual({ value: summary })
  })
})
