import { beforeEach, describe, expect, it, vi } from "vitest"

import { approveAgentAction } from "@/lib/ai/agent-actions"
import { getSession } from "@/lib/auth"

import { POST } from "./route"

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }))

vi.mock("@/lib/ai/agent-actions", () => ({
  AgentActionReviewError: class AgentActionReviewError extends Error {
    constructor(
      message: string,
      public readonly status = 400,
      public readonly code = "agent_action_error"
    ) {
      super(message)
    }
  },
  approveAgentAction: vi.fn(),
}))

describe("agent action approve route", () => {
  beforeEach(() => {
    delete process.env.AGENT_ACTION_REVIEWER_EMAILS
    delete process.env.AGENT_ACTION_REVIEWER_IDS
    vi.mocked(getSession).mockReset()
    vi.mocked(approveAgentAction).mockReset()
  })

  it("rejects unauthenticated approvals", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await POST(request({}), params())

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
    expect(approveAgentAction).not.toHaveBeenCalled()
  })

  it("rejects cross-origin state-changing requests", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({}, { origin: "https://malicious.example" }),
      params()
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "invalid origin" })
    expect(approveAgentAction).not.toHaveBeenCalled()
  })

  it("rejects non-JSON approval requests", async () => {
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
    expect(approveAgentAction).not.toHaveBeenCalled()
  })

  it("approves as the signed-in reviewer", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(approveAgentAction).mockResolvedValue({
      status: "executed",
      todoId: "todo-1",
      actionId: "action-1",
    })

    const response = await POST(request({}), params())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      status: "executed",
      todoId: "todo-1",
    })
    expect(approveAgentAction).toHaveBeenCalledWith({
      id: "action-1",
      reviewer: "Zach Reviewer",
    })
  })
})

function params() {
  return { params: Promise.resolve({ id: "action-1" }) }
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
    "https://example.test/api/agent/actions/action-1/approve",
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
