import { beforeEach, describe, expect, it, vi } from "vitest"

import { getSession } from "@/lib/auth"
import { applyCoverageReviewAction } from "@/lib/coverage/communication-coverage"
import { recordCoverageActionAudit } from "@/lib/coverage/coverage-observability"

import { POST } from "./route"

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }))

vi.mock("@/lib/coverage/communication-coverage", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    applyCoverageReviewAction: vi.fn(),
  }
})

vi.mock("@/lib/coverage/coverage-observability", () => ({
  recordCoverageActionAudit: vi.fn().mockResolvedValue({ id: "audit-1" }),
}))

describe("coverage review item actions route", () => {
  beforeEach(() => {
    delete process.env.AGENT_ACTION_REVIEWER_EMAILS
    delete process.env.AGENT_ACTION_REVIEWER_IDS
    vi.mocked(getSession).mockReset()
    vi.mocked(applyCoverageReviewAction).mockReset()
    vi.mocked(recordCoverageActionAudit).mockClear()
    vi.mocked(recordCoverageActionAudit).mockResolvedValue({ id: "audit-1" })
  })

  it("rejects unauthenticated mutations", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await POST(
      request({ action: "mark_true_noise", dryRun: true }),
      params()
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
    expect(applyCoverageReviewAction).not.toHaveBeenCalled()
  })

  it("rejects authenticated non-reviewers", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({ action: "mark_true_noise", dryRun: true }),
      params()
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "forbidden" })
    expect(applyCoverageReviewAction).not.toHaveBeenCalled()
  })

  it("rejects cross-origin mutations", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request(
        { action: "mark_true_noise", dryRun: true },
        { origin: "https://evil.example" }
      ),
      params()
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "invalid origin" })
    expect(applyCoverageReviewAction).not.toHaveBeenCalled()
  })

  it("rejects non-JSON mutations", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request("", { contentType: "text/plain" }),
      params()
    )

    expect(response.status).toBe(415)
    expect(await response.json()).toMatchObject({
      error: "invalid content type",
    })
    expect(applyCoverageReviewAction).not.toHaveBeenCalled()
  })

  it("rejects unknown body keys and invalid write-before-dry-run shape", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const unknown = await POST(
      request({
        action: "mark_true_noise",
        dryRun: true,
        reviewItemIds: ["review-1"],
      }),
      params()
    )
    const missingRun = await POST(
      request({ action: "mark_true_noise", dryRun: false }),
      params()
    )

    expect(unknown.status).toBe(400)
    expect(await unknown.json()).toMatchObject({
      error: "unknown body key: reviewItemIds",
    })
    expect(missingRun.status).toBe(400)
    expect(await missingRun.json()).toMatchObject({
      error: "runId is required when dryRun=false",
    })
    expect(applyCoverageReviewAction).not.toHaveBeenCalled()
  })

  it("runs dry-run actions as the signed-in reviewer", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(applyCoverageReviewAction).mockResolvedValue({
      ok: true,
      dryRun: true,
      action: "mark_true_noise",
      reviewItemId: "review-1",
      status: "would_update",
      reviewStatus: "open",
    })

    const response = await POST(
      request({ action: "mark_true_noise", dryRun: true, runId: "run-1" }),
      params()
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      status: "would_update",
    })
    expect(applyCoverageReviewAction).toHaveBeenCalledWith("review-1", {
      action: "mark_true_noise",
      dryRun: true,
      runId: "run-1",
      reason: null,
      snoozedUntil: null,
      reviewer: "Zach Reviewer",
    })
  })

  it("returns structured unsupported identity action responses", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(applyCoverageReviewAction).mockResolvedValue({
      ok: true,
      dryRun: true,
      action: "deterministic_link_contact",
      reviewItemId: "review-1",
      status: "unsupported",
      unsupportedReason: "deferred",
      reviewStatus: "open",
    })

    const response = await POST(
      request({
        action: "deterministic_link_contact",
        dryRun: true,
        runId: "run-1",
      }),
      params()
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: "unsupported",
      unsupportedReason: "deferred",
    })
  })

  it("forwards deterministic_link_contact dry-run with the reviewer label", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(applyCoverageReviewAction).mockResolvedValue({
      ok: true,
      dryRun: true,
      action: "deterministic_link_contact",
      reviewItemId: "review-1",
      status: "would_link",
      reviewStatus: "open",
    })

    const response = await POST(
      request({
        action: "deterministic_link_contact",
        dryRun: true,
        runId: "run-1",
      }),
      params()
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: "would_link",
    })
    expect(applyCoverageReviewAction).toHaveBeenCalledWith("review-1", {
      action: "deterministic_link_contact",
      dryRun: true,
      runId: "run-1",
      reason: null,
      snoozedUntil: null,
      reviewer: "Zach Reviewer",
    })
  })

  it("rejects malformed runId formats before invoking the service", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({
        action: "mark_true_noise",
        dryRun: false,
        runId: "spaces are illegal",
      }),
      params()
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: "invalid runId" })
    expect(applyCoverageReviewAction).not.toHaveBeenCalled()
  })

  it("rejects snoozedUntil for non-snooze/defer actions", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({
        action: "mark_true_noise",
        dryRun: true,
        snoozedUntil: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      params()
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("snoozedUntil only allowed"),
    })
    expect(applyCoverageReviewAction).not.toHaveBeenCalled()
  })

  it("accepts snooze with future snoozedUntil and forwards reviewer label", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(applyCoverageReviewAction).mockResolvedValue({
      ok: true,
      dryRun: true,
      action: "snooze",
      reviewItemId: "review-1",
      status: "would_update",
      reviewStatus: "open",
    })

    const future = new Date(Date.now() + 86_400_000).toISOString()
    const response = await POST(
      request({
        action: "snooze",
        dryRun: true,
        snoozedUntil: future,
        reason: "wait for follow-up",
      }),
      params()
    )

    expect(response.status).toBe(200)
    expect(applyCoverageReviewAction).toHaveBeenCalledWith(
      "review-1",
      expect.objectContaining({
        action: "snooze",
        dryRun: true,
        snoozedUntil: expect.any(Date),
        reviewer: "Zach Reviewer",
      })
    )
  })

  it("rejects malformed JSON bodies with a 400 instead of a 500", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request("{not valid json", { contentType: "application/json" }),
      params()
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: "invalid JSON body" })
    expect(applyCoverageReviewAction).not.toHaveBeenCalled()
  })

  it("rejects past snoozedUntil even on snooze", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({
        action: "snooze",
        dryRun: true,
        snoozedUntil: new Date(Date.now() - 86_400_000).toISOString(),
      }),
      params()
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("snoozedUntil must be in the future"),
    })
    expect(applyCoverageReviewAction).not.toHaveBeenCalled()
  })
})

function params() {
  return { params: Promise.resolve({ id: "review-1" }) }
}

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
    "https://example.test/api/agent/coverage/review-items/review-1/actions",
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
