import { existsSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { getSession } from "@/lib/auth"
import { listCoverageReviewItems } from "@/lib/coverage/communication-coverage"

import { GET } from "./route"

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }))

vi.mock("@/lib/coverage/communication-coverage", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    listCoverageReviewItems: vi.fn(),
  }
})

describe("coverage review-items route", () => {
  beforeEach(() => {
    delete process.env.AGENT_ACTION_REVIEWER_EMAILS
    delete process.env.AGENT_ACTION_REVIEWER_IDS
    vi.mocked(getSession).mockReset()
    vi.mocked(listCoverageReviewItems).mockReset()
  })

  it("requires an authenticated configured reviewer", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(request("filter=missed_eligible"))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
    expect(listCoverageReviewItems).not.toHaveBeenCalled()
  })

  it("rejects authenticated non-reviewers", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await GET(request("filter=missed_eligible"))

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "forbidden" })
    expect(listCoverageReviewItems).not.toHaveBeenCalled()
  })

  it("rejects unknown query parameters before service execution", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await GET(request("filter=missed_eligible&export=csv"))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "unknown query parameter: export",
    })
    expect(listCoverageReviewItems).not.toHaveBeenCalled()
  })

  it("returns minimized service DTOs for reviewers", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(listCoverageReviewItems).mockResolvedValue({
      items: [
        {
          id: "review-1",
          communicationId: "comm-1",
          type: "missed_eligible",
          status: "open",
          coarseDate: "2026-04-29",
          subject: "Lease offer",
          senderDomain: "example.com",
          classification: "signal",
          queueState: {
            id: null,
            status: null,
            attempts: null,
            enqueuedAt: null,
            lockedUntil: null,
          },
          scrubState: "unscrubbed",
          contactState: { contactId: null, linked: false },
          actionState: {
            agentActionId: null,
            actionType: null,
            status: null,
            targetEntity: null,
          },
          riskScore: 90,
          reasonCodes: ["signal_without_queue"],
          reasonKey: "signal_without_queue",
          recommendedAction: "enqueue_or_requeue_scrub",
          policyVersion: "coverage-review-v1",
          evidenceSnippets: [],
          createdAt: "2026-04-29T12:00:00.000Z",
        },
      ],
      pageInfo: { nextCursor: null, limit: 25, sort: "risk_desc" },
    })

    const response = await GET(request("filter=missed_eligible"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items[0]).toMatchObject({
      id: "review-1",
      senderDomain: "example.com",
    })
    expect(JSON.stringify(body)).not.toContain("bodyPreview")
    expect(JSON.stringify(body)).not.toContain("internetMessageId")
    expect(listCoverageReviewItems).toHaveBeenCalledWith({
      filter: "missed_eligible",
      cursor: null,
      limit: 25,
      sort: "risk_desc",
    })
  })

  it("does not expose a coverage CSV/export route in this lane", () => {
    expect(
      existsSync(
        join(
          process.cwd(),
          "src",
          "app",
          "api",
          "agent",
          "coverage",
          "review-items",
          "export",
          "route.ts"
        )
      )
    ).toBe(false)
    // Also reject the obvious sibling shapes a future regression might add.
    for (const slug of ["csv", "download", "export-csv"]) {
      expect(
        existsSync(
          join(
            process.cwd(),
            "src",
            "app",
            "api",
            "agent",
            "coverage",
            "review-items",
            slug,
            "route.ts"
          )
        )
      ).toBe(false)
    }
  })

  it("rejects tampered cursor payloads at the route boundary", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await GET(
      request("filter=missed_eligible&cursor=not-a-base64-cursor")
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: "invalid cursor" })
    expect(listCoverageReviewItems).not.toHaveBeenCalled()
  })

  it("rejects invalid sort enum values", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await GET(
      request("filter=missed_eligible&sort=created_asc")
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: "invalid sort" })
    expect(listCoverageReviewItems).not.toHaveBeenCalled()
  })

  it("rejects invalid filter enum values without invoking the service", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await GET(request("filter=mark_done"))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: "invalid filter" })
    expect(listCoverageReviewItems).not.toHaveBeenCalled()
  })

  it("returns DTOs with only the documented allowlist of fields", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(listCoverageReviewItems).mockResolvedValue({
      items: [
        {
          id: "review-1",
          communicationId: "comm-1",
          type: "missed_eligible",
          status: "open",
          coarseDate: "2026-04-29",
          subject: "Lease offer",
          senderDomain: "example.com",
          classification: "signal",
          queueState: {
            id: null,
            status: null,
            attempts: null,
            enqueuedAt: null,
            lockedUntil: null,
          },
          scrubState: "unscrubbed",
          contactState: { contactId: null, linked: false },
          actionState: {
            agentActionId: null,
            actionType: null,
            status: null,
            targetEntity: null,
          },
          riskScore: 90,
          reasonCodes: ["signal_without_queue"],
          reasonKey: "signal_without_queue",
          recommendedAction: "enqueue_or_requeue_scrub",
          policyVersion: "coverage-review-v1",
          evidenceSnippets: [],
          createdAt: "2026-04-29T12:00:00.000Z",
        },
      ],
      pageInfo: { nextCursor: null, limit: 25, sort: "risk_desc" },
    })

    const response = await GET(request("filter=missed_eligible"))
    const body = (await response.json()) as { items: Record<string, unknown>[] }

    const allowed = new Set([
      "id",
      "communicationId",
      "type",
      "status",
      "coarseDate",
      "subject",
      "senderDomain",
      "classification",
      "queueState",
      "scrubState",
      "contactState",
      "actionState",
      "riskScore",
      "reasonCodes",
      "reasonKey",
      "recommendedAction",
      "policyVersion",
      "evidenceSnippets",
      "createdAt",
    ])
    const itemKeys = new Set(Object.keys(body.items[0]))
    expect(new Set([...itemKeys].filter((k) => !allowed.has(k)))).toEqual(
      new Set()
    )
    for (const forbidden of [
      "senderEmail",
      "body",
      "bodyPreview",
      "graphId",
      "internetMessageId",
      "recipients",
      "toRecipients",
      "ccRecipients",
      "rawData",
    ]) {
      expect(JSON.stringify(body)).not.toContain(forbidden)
    }
  })

  it("returns pending_mark_done DTOs whose snapshot only contains the documented allowlist", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(listCoverageReviewItems).mockResolvedValue({
      items: [
        {
          id: "review-pmd",
          communicationId: "comm-pmd",
          type: "pending_mark_done",
          status: "open",
          coarseDate: "2026-04-29",
          subject: "Status update",
          senderDomain: "example.com",
          classification: "signal",
          queueState: {
            id: null,
            status: null,
            attempts: null,
            enqueuedAt: null,
            lockedUntil: null,
          },
          scrubState: "unscrubbed",
          contactState: { contactId: "contact-1", linked: true },
          actionState: {
            agentActionId: "action-pmd",
            actionType: "mark-todo-done",
            status: "pending",
            targetEntity: "todo:todo-pmd",
          },
          riskScore: 60,
          reasonCodes: ["pending_mark_done"],
          reasonKey: "pending_mark_done",
          recommendedAction: "review_todo_completion",
          policyVersion: "coverage-review-v1",
          evidenceSnippets: [],
          createdAt: "2026-04-29T12:00:00.000Z",
          pendingMarkDoneSnapshot: {
            todoId: "todo-pmd",
            todoTitle: "Follow up on Smith lease",
            todoCreatedAt: "2026-04-29",
            todoUpdatedAt: "2026-04-29",
            sourceCommunicationId: "comm-pmd",
            reason: "Tenant signed lease.",
          },
        },
      ],
      pageInfo: { nextCursor: null, limit: 25, sort: "risk_desc" },
    })

    const response = await GET(request("filter=pending_mark_done"))
    const body = (await response.json()) as { items: Record<string, unknown>[] }

    const allowedItem = new Set([
      "id",
      "communicationId",
      "type",
      "status",
      "coarseDate",
      "subject",
      "senderDomain",
      "classification",
      "queueState",
      "scrubState",
      "contactState",
      "actionState",
      "riskScore",
      "reasonCodes",
      "reasonKey",
      "recommendedAction",
      "policyVersion",
      "evidenceSnippets",
      "createdAt",
      "pendingMarkDoneSnapshot",
    ])
    const itemKeys = new Set(Object.keys(body.items[0]))
    expect(new Set([...itemKeys].filter((k) => !allowedItem.has(k)))).toEqual(
      new Set()
    )
    expect(allowedItem.size).toBe(itemKeys.size)

    const allowedSnapshot = new Set([
      "todoId",
      "todoTitle",
      "todoCreatedAt",
      "todoUpdatedAt",
      "sourceCommunicationId",
      "reason",
    ])
    const snapshot = body.items[0].pendingMarkDoneSnapshot as Record<
      string,
      unknown
    >
    const snapshotKeys = new Set(Object.keys(snapshot))
    expect(
      new Set([...snapshotKeys].filter((k) => !allowedSnapshot.has(k)))
    ).toEqual(new Set())
    expect(allowedSnapshot.size).toBe(snapshotKeys.size)

    for (const forbidden of [
      "bodyPreview",
      "internetMessageId",
      "graphId",
      "dealId",
      "rawData",
      "senderEmail",
    ]) {
      expect(JSON.stringify(body)).not.toContain(forbidden)
    }
  })
})

function request(query: string): Request {
  return new Request(
    `https://example.test/api/agent/coverage/review-items?${query}`,
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
