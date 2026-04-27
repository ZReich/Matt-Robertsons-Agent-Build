import { beforeEach, describe, expect, it, vi } from "vitest"

import { rejectAgentAction } from "@/lib/ai/agent-actions"
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
  rejectAgentAction: vi.fn(),
}))

describe("agent action reject route", () => {
  beforeEach(() => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockReset()
    vi.mocked(rejectAgentAction).mockReset()
  })

  it("rejects non-reviewers", async () => {
    delete process.env.AGENT_ACTION_REVIEWER_EMAILS
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(request({ feedback: "no" }), params())

    expect(response.status).toBe(403)
    expect(rejectAgentAction).not.toHaveBeenCalled()
  })

  it("passes reviewer feedback through to the executor", async () => {
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(rejectAgentAction).mockResolvedValue({
      status: "rejected",
      actionId: "action-1",
    })

    const response = await POST(request({ feedback: "not useful" }), params())

    expect(response.status).toBe(200)
    expect(rejectAgentAction).toHaveBeenCalledWith({
      id: "action-1",
      reviewer: "Zach Reviewer",
      feedback: "not useful",
    })
  })

  it("rejects cross-origin reject requests", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({ feedback: "no" }, { origin: "https://malicious.example" }),
      params()
    )

    expect(response.status).toBe(403)
    expect(rejectAgentAction).not.toHaveBeenCalled()
  })

  it("rejects non-JSON reject requests", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request("", { contentType: "text/plain" }),
      params()
    )

    expect(response.status).toBe(415)
    expect(rejectAgentAction).not.toHaveBeenCalled()
  })
})

function params() {
  return { params: Promise.resolve({ id: "action-1" }) }
}

function request(
  body: Record<string, unknown> | string,
  options: { origin?: string; contentType?: string } = {}
): Request {
  return new Request("https://example.test/api/agent/actions/action-1/reject", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": options.contentType ?? "application/json",
      origin: options.origin ?? "https://example.test",
    },
  })
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
