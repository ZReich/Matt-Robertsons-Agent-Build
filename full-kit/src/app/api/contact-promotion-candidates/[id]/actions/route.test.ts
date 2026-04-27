import { beforeEach, describe, expect, it, vi } from "vitest"

import { getSession } from "@/lib/auth"
import { reviewContactPromotionCandidate } from "@/lib/contact-promotion-candidates"

import { POST } from "./route"

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/contact-promotion-candidates", () => ({
  CandidateReviewError: class CandidateReviewError extends Error {
    constructor(
      message: string,
      public readonly status = 400
    ) {
      super(message)
    }
  },
  reviewContactPromotionCandidate: vi.fn(),
}))

describe("contact promotion candidate action route", () => {
  beforeEach(() => {
    delete process.env.CONTACT_CANDIDATE_REVIEWER_EMAILS
    delete process.env.CONTACT_CANDIDATE_REVIEWER_IDS
    vi.mocked(getSession).mockReset()
    vi.mocked(reviewContactPromotionCandidate).mockReset()
  })

  it("requires authentication before mutating candidates", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await POST(request({ action: "reject" }), {
      params: Promise.resolve({ id: "candidate-1" }),
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
    expect(reviewContactPromotionCandidate).not.toHaveBeenCalled()
  })

  it("rejects cross-origin state-changing requests", async () => {
    process.env.CONTACT_CANDIDATE_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Zach Reviewer",
        email: "zach@example.com",
        avatar: null,
        status: "ONLINE",
      },
      expires: "2026-05-27T00:00:00Z",
    })

    const response = await POST(
      request({ action: "reject" }, { origin: "https://malicious.example" }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "invalid origin" })
    expect(reviewContactPromotionCandidate).not.toHaveBeenCalled()
  })

  it("rejects authenticated users who are not configured reviewers", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Zach Reviewer",
        email: "zach@example.com",
        avatar: null,
        status: "ONLINE",
      },
      expires: "2026-05-27T00:00:00Z",
    })

    const response = await POST(request({ action: "reject" }), {
      params: Promise.resolve({ id: "candidate-1" }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "forbidden" })
    expect(reviewContactPromotionCandidate).not.toHaveBeenCalled()
  })

  it("does not accept agent-action reviewer aliases for contact candidate review", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Zach Reviewer",
        email: "zach@example.com",
        avatar: null,
        status: "ONLINE",
      },
      expires: "2026-05-27T00:00:00Z",
    })

    const response = await POST(request({ action: "reject" }), {
      params: Promise.resolve({ id: "candidate-1" }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "forbidden" })
    expect(reviewContactPromotionCandidate).not.toHaveBeenCalled()
  })

  it("derives reviewer from the authenticated session", async () => {
    process.env.CONTACT_CANDIDATE_REVIEWER_IDS = "user-1"
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Zach Reviewer",
        email: "zach@example.com",
        avatar: null,
        status: "ONLINE",
      },
      expires: "2026-05-27T00:00:00Z",
    })
    vi.mocked(reviewContactPromotionCandidate).mockResolvedValue({
      candidate: { id: "candidate-1" },
      contact: null,
      idempotent: false,
    } as never)

    const response = await POST(
      request({ action: "reject", reviewer: "forged", reason: "bad fit" }),
      { params: Promise.resolve({ id: "candidate-1" }) }
    )

    expect(response.status).toBe(200)
    expect(reviewContactPromotionCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "candidate-1",
        action: "reject",
        reviewer: "Zach Reviewer",
        reason: "bad fit",
      })
    )
  })
})

function request(
  body: Record<string, unknown>,
  options: { origin?: string | null } = {}
): Request {
  const headers = new Headers({ "content-type": "application/json" })
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? "https://example.test")
  }

  return new Request(
    "https://example.test/api/contact-promotion-candidates/candidate-1/actions",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    }
  )
}
