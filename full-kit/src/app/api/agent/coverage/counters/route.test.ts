import { beforeEach, describe, expect, it, vi } from "vitest"

import { getSession } from "@/lib/auth"
import { getCoverageObservabilityCounters } from "@/lib/coverage/coverage-observability"

import { GET } from "./route"

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }))

vi.mock("@/lib/coverage/coverage-observability", () => ({
  getCoverageObservabilityCounters: vi.fn(),
}))

describe("coverage counters route", () => {
  beforeEach(() => {
    delete process.env.AGENT_ACTION_REVIEWER_EMAILS
    delete process.env.AGENT_ACTION_REVIEWER_IDS
    vi.mocked(getSession).mockReset()
    vi.mocked(getCoverageObservabilityCounters).mockReset()
  })

  it("returns 401 for unauthenticated callers", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    expect(getCoverageObservabilityCounters).not.toHaveBeenCalled()
  })

  it("returns 403 for authenticated non-reviewers", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await GET(makeRequest())

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "forbidden" })
    expect(getCoverageObservabilityCounters).not.toHaveBeenCalled()
  })

  it("returns 200 with counters for reviewers", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(getCoverageObservabilityCounters).mockResolvedValue({
      generatedAt: "2026-04-29T12:00:00Z",
      since: null,
      drilldownByType: {
        never_queued: 0,
        missed_eligible: 4,
        suspicious_noise: 2,
        orphaned_context: 0,
        failed_scrub: 0,
        stale_queue: 0,
        pending_mark_done: 1,
      },
      reviewedTrueNoise: 7,
      reviewedFalseNegative: 3,
      pendingMarkDoneProposals: 5,
      duplicateContactBlocks: 6,
      profileFacts: { saved: 9, reviewed: 4, dropped: 0 },
    })

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      reviewedTrueNoise: 7,
      reviewedFalseNegative: 3,
      pendingMarkDoneProposals: 5,
      duplicateContactBlocks: 6,
      profileFacts: { saved: 9, reviewed: 4, dropped: 0 },
    })
    // Aggregates only — no per-row email content fields.
    const serialized = JSON.stringify(body)
    for (const forbidden of [
      "subject",
      "body",
      "bodyPreview",
      "recipients",
      "from",
      "to",
      "graphId",
      "internetMessageId",
      "operatorNotes",
    ]) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it("forwards the since parameter to the helper", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(getCoverageObservabilityCounters).mockResolvedValue({
      generatedAt: "2026-04-29T12:00:00Z",
      since: "2026-04-01T00:00:00.000Z",
      drilldownByType: {
        never_queued: 0,
        missed_eligible: 0,
        suspicious_noise: 0,
        orphaned_context: 0,
        failed_scrub: 0,
        stale_queue: 0,
        pending_mark_done: 0,
      },
      reviewedTrueNoise: 0,
      reviewedFalseNegative: 0,
      pendingMarkDoneProposals: 0,
      duplicateContactBlocks: 0,
      profileFacts: { saved: 0, reviewed: 0, dropped: 0 },
    })

    const response = await GET(makeRequest("?since=2026-04-01T00:00:00.000Z"))

    expect(response.status).toBe(200)
    expect(getCoverageObservabilityCounters).toHaveBeenCalledWith({
      since: "2026-04-01T00:00:00.000Z",
    })
  })

  it("rejects unknown query parameters", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await GET(makeRequest("?surprise=1"))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("unknown query parameter"),
    })
    expect(getCoverageObservabilityCounters).not.toHaveBeenCalled()
  })

  it("rejects malformed since values", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await GET(makeRequest("?since=not-a-date"))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: "invalid since" })
    expect(getCoverageObservabilityCounters).not.toHaveBeenCalled()
  })
})

function makeRequest(query = ""): Request {
  return new Request(
    `https://example.test/api/agent/coverage/counters${query}`,
    { method: "GET" }
  )
}

function session() {
  return {
    user: {
      id: "user-1",
      name: "Zach Reviewer",
      email: "zach@example.com",
      avatar: null,
      status: "ONLINE",
    },
    expires: "2026-05-27T00:00:00Z",
  }
}
