import { beforeEach, describe, expect, it, vi } from "vitest"

import { getSession } from "@/lib/auth"
import {
  COVERAGE_BATCH_ACTION_MAX,
  applyCoverageReviewActionBatch,
} from "@/lib/coverage/communication-coverage"

import { POST } from "./route"

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }))

vi.mock("@/lib/coverage/communication-coverage", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    applyCoverageReviewActionBatch: vi.fn(),
  }
})

describe("coverage review item batch actions route", () => {
  beforeEach(() => {
    delete process.env.AGENT_ACTION_REVIEWER_EMAILS
    delete process.env.AGENT_ACTION_REVIEWER_IDS
    vi.mocked(getSession).mockReset()
    vi.mocked(applyCoverageReviewActionBatch).mockReset()
  })

  it("rejects unauthenticated mutations", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await POST(
      request({
        action: "mark_true_noise",
        reviewItemIds: ["review-1"],
        dryRun: true,
      })
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
    expect(applyCoverageReviewActionBatch).not.toHaveBeenCalled()
  })

  it("rejects authenticated non-reviewers", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({
        action: "mark_true_noise",
        reviewItemIds: ["review-1"],
        dryRun: true,
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "forbidden" })
    expect(applyCoverageReviewActionBatch).not.toHaveBeenCalled()
  })

  it("rejects cross-origin mutations", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request(
        {
          action: "mark_true_noise",
          reviewItemIds: ["review-1"],
          dryRun: true,
        },
        { origin: "https://evil.example" }
      )
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "invalid origin" })
    expect(applyCoverageReviewActionBatch).not.toHaveBeenCalled()
  })

  it("rejects non-JSON mutations", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(request("", { contentType: "text/plain" }))

    expect(response.status).toBe(415)
    expect(await response.json()).toMatchObject({
      error: "invalid content type",
    })
    expect(applyCoverageReviewActionBatch).not.toHaveBeenCalled()
  })

  it("rejects unknown body keys", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({
        action: "mark_true_noise",
        reviewItemIds: ["review-1"],
        dryRun: true,
        selectAll: true,
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "unknown body key: selectAll",
    })
    expect(applyCoverageReviewActionBatch).not.toHaveBeenCalled()
  })

  it("rejects empty reviewItemIds", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({
        action: "mark_true_noise",
        reviewItemIds: [],
        dryRun: true,
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "reviewItemIds is required",
    })
    expect(applyCoverageReviewActionBatch).not.toHaveBeenCalled()
  })

  it("rejects over-cap reviewItemIds", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const oversize = Array.from(
      { length: COVERAGE_BATCH_ACTION_MAX + 1 },
      (_, i) => `review-${i}`
    )
    const response = await POST(
      request({
        action: "mark_true_noise",
        reviewItemIds: oversize,
        dryRun: true,
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("reviewItemIds exceeds batch cap"),
    })
    expect(applyCoverageReviewActionBatch).not.toHaveBeenCalled()
  })

  it("rejects missing runId on dryRun=false", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({
        action: "mark_true_noise",
        reviewItemIds: ["review-1"],
        dryRun: false,
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "runId is required when dryRun=false",
    })
    expect(applyCoverageReviewActionBatch).not.toHaveBeenCalled()
  })

  it("rejects malformed runId", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({
        action: "mark_true_noise",
        reviewItemIds: ["review-1"],
        dryRun: false,
        runId: "spaces are illegal",
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: "invalid runId" })
    expect(applyCoverageReviewActionBatch).not.toHaveBeenCalled()
  })

  it("rejects snoozedUntil for non-snooze actions", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({
        action: "mark_true_noise",
        reviewItemIds: ["review-1"],
        dryRun: true,
        snoozedUntil: new Date(Date.now() + 86_400_000).toISOString(),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("snoozedUntil only allowed"),
    })
    expect(applyCoverageReviewActionBatch).not.toHaveBeenCalled()
  })

  it("returns dry-run summary for three review items", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(applyCoverageReviewActionBatch).mockResolvedValue({
      ok: true,
      dryRun: true,
      runId: "run-1",
      results: [
        {
          reviewItemId: "review-1",
          status: "would_update",
          reviewStatus: "open",
        },
        {
          reviewItemId: "review-2",
          status: "would_update",
          reviewStatus: "open",
        },
        { reviewItemId: "review-3", status: "noop", reviewStatus: "resolved" },
      ],
      summary: { count: 3, applied: 2, skipped: 1, unsupported: 0 },
    })

    const response = await POST(
      request({
        action: "mark_true_noise",
        reviewItemIds: ["review-1", "review-2", "review-3"],
        dryRun: true,
        runId: "run-1",
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      ok: true,
      dryRun: true,
      runId: "run-1",
      summary: { count: 3, applied: 2, skipped: 1, unsupported: 0 },
    })
    expect(body.results).toHaveLength(3)
    expect(applyCoverageReviewActionBatch).toHaveBeenCalledWith(
      ["review-1", "review-2", "review-3"],
      expect.objectContaining({
        action: "mark_true_noise",
        dryRun: true,
        runId: "run-1",
        reviewer: "Zach Reviewer",
      })
    )
  })

  it("forwards write-mode results and is idempotent on re-run", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(applyCoverageReviewActionBatch)
      .mockResolvedValueOnce({
        ok: true,
        dryRun: false,
        runId: "run-1",
        results: [
          {
            reviewItemId: "review-1",
            status: "updated",
            reviewStatus: "resolved",
          },
          {
            reviewItemId: "review-2",
            status: "updated",
            reviewStatus: "resolved",
          },
        ],
        summary: { count: 2, applied: 2, skipped: 0, unsupported: 0 },
      })
      .mockResolvedValueOnce({
        ok: true,
        dryRun: false,
        runId: "run-1",
        results: [
          {
            reviewItemId: "review-1",
            status: "noop",
            reviewStatus: "resolved",
          },
          {
            reviewItemId: "review-2",
            status: "noop",
            reviewStatus: "resolved",
          },
        ],
        summary: { count: 2, applied: 0, skipped: 2, unsupported: 0 },
      })

    const body = {
      action: "mark_true_noise",
      reviewItemIds: ["review-1", "review-2"],
      dryRun: false,
      runId: "run-1",
      reason: "confirmed",
    }
    const first = await POST(request(body))
    const second = await POST(request(body))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await first.json()).toMatchObject({
      summary: { count: 2, applied: 2, skipped: 0, unsupported: 0 },
    })
    expect(await second.json()).toMatchObject({
      summary: { count: 2, applied: 0, skipped: 2, unsupported: 0 },
    })
    expect(applyCoverageReviewActionBatch).toHaveBeenCalledTimes(2)
  })

  it("reports both noop and updated rows in mixed results", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(applyCoverageReviewActionBatch).mockResolvedValue({
      ok: true,
      dryRun: false,
      runId: "run-1",
      results: [
        { reviewItemId: "review-1", status: "noop", reviewStatus: "resolved" },
        {
          reviewItemId: "review-2",
          status: "updated",
          reviewStatus: "resolved",
        },
      ],
      summary: { count: 2, applied: 1, skipped: 1, unsupported: 0 },
    })

    const response = await POST(
      request({
        action: "mark_true_noise",
        reviewItemIds: ["review-1", "review-2"],
        dryRun: false,
        runId: "run-1",
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.results).toEqual([
      { reviewItemId: "review-1", status: "noop", reviewStatus: "resolved" },
      {
        reviewItemId: "review-2",
        status: "updated",
        reviewStatus: "resolved",
      },
    ])
    expect(body.summary).toEqual({
      count: 2,
      applied: 1,
      skipped: 1,
      unsupported: 0,
    })
  })
})

function request(
  body: Record<string, unknown> | string,
  options: { origin?: string | null; contentType?: string } = {}
): Request {
  const headers = new Headers()
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? "https://example.test")
  }
  headers.set("content-type", options.contentType ?? "application/json")
  return new Request(
    "https://example.test/api/agent/coverage/review-items/actions",
    {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers,
    }
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
