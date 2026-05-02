import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const processUnprocessedDailyListings = vi.fn()
const setLastDailyListingsSweep = vi.fn()

vi.mock("@/lib/daily-listings/processor", () => ({
  processUnprocessedDailyListings: (...args: unknown[]) =>
    processUnprocessedDailyListings(...args),
}))

vi.mock("@/lib/system-state/last-daily-listings-sweep", () => ({
  setLastDailyListingsSweep: (...args: unknown[]) =>
    setLastDailyListingsSweep(...args),
}))

import { GET } from "./route"

const SECRET = "test-cron-secret-1234567890abcdef"
const ORIGINAL_ENV = process.env.DAILY_LISTINGS_CRON_SECRET
const ORIGINAL_VERCEL_CRON = process.env.CRON_SECRET

beforeEach(() => {
  process.env.DAILY_LISTINGS_CRON_SECRET = SECRET
  delete process.env.CRON_SECRET
  processUnprocessedDailyListings.mockReset()
  setLastDailyListingsSweep.mockReset()
})

afterEach(() => {
  process.env.DAILY_LISTINGS_CRON_SECRET = ORIGINAL_ENV
  if (ORIGINAL_VERCEL_CRON === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = ORIGINAL_VERCEL_CRON
})

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/cron/daily-listings", {
    method: "GET",
    headers,
  })
}

describe("GET /api/cron/daily-listings", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
    expect(processUnprocessedDailyListings).not.toHaveBeenCalled()
    expect(setLastDailyListingsSweep).not.toHaveBeenCalled()
  })

  it("returns 401 when bearer token does not match", async () => {
    const res = await GET(
      makeReq({ Authorization: "Bearer wrong-secret-aaaaaaaaaaaaaaaaaaaa" })
    )
    expect(res.status).toBe(401)
    expect(processUnprocessedDailyListings).not.toHaveBeenCalled()
  })

  it("returns 503 when neither cron secret env var is configured", async () => {
    delete process.env.DAILY_LISTINGS_CRON_SECRET
    delete process.env.CRON_SECRET
    const res = await GET(makeReq({ Authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(503)
    expect(processUnprocessedDailyListings).not.toHaveBeenCalled()
  })

  it("falls back to Vercel-injected CRON_SECRET when DAILY_LISTINGS_CRON_SECRET is unset", async () => {
    delete process.env.DAILY_LISTINGS_CRON_SECRET
    process.env.CRON_SECRET = SECRET
    processUnprocessedDailyListings.mockResolvedValueOnce({
      candidates: 0,
      processed: 0,
      results: [],
    })
    const res = await GET(makeReq({ Authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(200)
    expect(processUnprocessedDailyListings).toHaveBeenCalledOnce()
  })

  it("runs the sweep and persists last-run state on success", async () => {
    processUnprocessedDailyListings.mockResolvedValueOnce({
      candidates: 2,
      processed: 2,
      results: [
        {
          ok: true,
          communicationId: "c1",
          parsed: 5,
          newProperties: 3,
          existingProperties: 2,
          matchesEvaluated: 4,
          draftsCreated: 1,
          draftsSent: 0,
          errors: [],
        },
        {
          ok: true,
          communicationId: "c2",
          parsed: 1,
          newProperties: 0,
          existingProperties: 1,
          matchesEvaluated: 1,
          draftsCreated: 1,
          draftsSent: 1,
          errors: ["one error"],
        },
      ],
    })
    setLastDailyListingsSweep.mockResolvedValueOnce({})

    const res = await GET(makeReq({ Authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      candidates: number
      processed: number
      listingsParsed: number
      draftsCreated: number
      draftsSent: number
      errors: number
      ranAt: string
    }
    expect(body.ok).toBe(true)
    expect(body.candidates).toBe(2)
    expect(body.processed).toBe(2)
    expect(body.listingsParsed).toBe(6)
    expect(body.draftsCreated).toBe(2)
    expect(body.draftsSent).toBe(1)
    expect(body.errors).toBe(1)
    expect(typeof body.ranAt).toBe("string")
    expect(processUnprocessedDailyListings).toHaveBeenCalledWith({
      lookbackDays: 1,
    })
    expect(setLastDailyListingsSweep).toHaveBeenCalledTimes(1)
    const summary = setLastDailyListingsSweep.mock.calls[0]?.[0]
    expect(summary).toMatchObject({
      candidates: 2,
      processed: 2,
      listingsParsed: 6,
      draftsCreated: 2,
      draftsSent: 1,
      errors: 1,
    })
  })

  it("returns 500 when the processor throws", async () => {
    processUnprocessedDailyListings.mockRejectedValueOnce(new Error("boom"))
    const res = await GET(makeReq({ Authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(500)
    expect(setLastDailyListingsSweep).not.toHaveBeenCalled()
  })

  it("rejects bearer when env var is empty string", async () => {
    process.env.DAILY_LISTINGS_CRON_SECRET = ""
    const res = await GET(makeReq({ Authorization: "Bearer " }))
    expect(res.status).toBe(503)
  })
})
