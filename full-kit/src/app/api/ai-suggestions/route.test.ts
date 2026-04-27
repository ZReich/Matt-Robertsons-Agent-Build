import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AiSuggestionState } from "@/lib/ai/suggestions"

import { getAiSuggestionState } from "@/lib/ai/suggestions"
import { getSession } from "@/lib/auth"

import { GET } from "./route"

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }))

vi.mock("@/lib/ai/suggestions", () => ({
  getAiSuggestionState: vi.fn(),
}))

describe("AI suggestions read route", () => {
  beforeEach(() => {
    delete process.env.AGENT_ACTION_REVIEWER_EMAILS
    delete process.env.AGENT_ACTION_REVIEWER_IDS
    delete process.env.CONTACT_CANDIDATE_REVIEWER_EMAILS
    delete process.env.CONTACT_CANDIDATE_REVIEWER_IDS
    vi.mocked(getSession).mockReset()
    vi.mocked(getAiSuggestionState).mockReset()
  })

  it("requires authentication before returning scrub evidence", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
    expect(getAiSuggestionState).not.toHaveBeenCalled()
  })

  it("requires a configured agent reviewer", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "forbidden" })
    expect(getAiSuggestionState).not.toHaveBeenCalled()
  })

  it("returns suggestion state for an allowed reviewer", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    const suggestionState: AiSuggestionState = {
      entityType: "contact",
      entityId: "contact-1",
      surface: "lead",
      queue: { notQueued: 0, pending: 0, inFlight: 0, done: 1, failed: 0 },
      scrubbedCommunications: [],
      actions: [],
    }
    vi.mocked(getAiSuggestionState).mockResolvedValue(suggestionState)

    const response = await GET(
      request(
        "https://example.test/api/ai-suggestions?entityType=contact&entityId=contact-1&surface=lead"
      )
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      entityType: "contact",
      queue: { notQueued: 0, done: 1 },
      actions: [],
    })
    expect(getAiSuggestionState).toHaveBeenCalledWith({
      entityType: "contact",
      entityId: "contact-1",
      surface: "lead",
    })
  })
})

function request(
  url = "https://example.test/api/ai-suggestions?entityType=contact&entityId=contact-1"
): Request {
  return new Request(url)
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
