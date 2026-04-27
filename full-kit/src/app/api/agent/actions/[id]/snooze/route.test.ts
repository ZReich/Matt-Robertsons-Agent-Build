import { beforeEach, describe, expect, it, vi } from "vitest"

import { snoozeAgentAction } from "@/lib/ai/agent-actions"
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
  snoozeAgentAction: vi.fn(),
}))

describe("agent action snooze route", () => {
  beforeEach(() => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockReset()
    vi.mocked(snoozeAgentAction).mockReset()
  })

  it("rejects invalid snooze dates", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request({ snoozedUntil: "not-a-date" }),
      params()
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "invalid snoozedUntil",
    })
    expect(snoozeAgentAction).not.toHaveBeenCalled()
  })

  it("snoozes using the requested date", async () => {
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(snoozeAgentAction).mockResolvedValue({
      status: "snoozed",
      actionId: "action-1",
      snoozedUntil: "2026-04-28T12:00:00.000Z",
    })

    const response = await POST(
      request({ snoozedUntil: "2026-04-28T12:00:00.000Z" }),
      params()
    )

    expect(response.status).toBe(200)
    expect(snoozeAgentAction).toHaveBeenCalledWith({
      id: "action-1",
      snoozedUntil: new Date("2026-04-28T12:00:00.000Z"),
      reviewer: "Zach Reviewer",
    })
  })

  it("rejects cross-origin snooze requests", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request(
        { snoozedUntil: "2026-04-28T12:00:00.000Z" },
        { origin: "https://malicious.example" }
      ),
      params()
    )

    expect(response.status).toBe(403)
    expect(snoozeAgentAction).not.toHaveBeenCalled()
  })

  it("rejects non-JSON snooze requests", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(
      request("", { contentType: "text/plain" }),
      params()
    )

    expect(response.status).toBe(415)
    expect(snoozeAgentAction).not.toHaveBeenCalled()
  })
})

function params() {
  return { params: Promise.resolve({ id: "action-1" }) }
}

function request(
  body: Record<string, unknown> | string,
  options: { origin?: string; contentType?: string } = {}
): Request {
  return new Request("https://example.test/api/agent/actions/action-1/snooze", {
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
