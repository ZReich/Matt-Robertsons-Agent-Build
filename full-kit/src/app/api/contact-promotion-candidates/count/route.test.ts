import { beforeEach, describe, expect, it, vi } from "vitest"

import { getSession } from "@/lib/auth"
import { countContactPromotionCandidates } from "@/lib/contact-promotion-candidates"

import { GET } from "./route"

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/contact-promotion-candidates", () => ({
  countContactPromotionCandidates: vi.fn(),
}))

describe("contact promotion candidates count route", () => {
  beforeEach(() => {
    delete process.env.CONTACT_CANDIDATE_REVIEWER_EMAILS
    delete process.env.CONTACT_CANDIDATE_REVIEWER_IDS
    vi.mocked(getSession).mockReset()
    vi.mocked(countContactPromotionCandidates).mockReset()
  })

  it("does not expose the review count to anonymous users", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
    expect(countContactPromotionCandidates).not.toHaveBeenCalled()
  })

  it("returns the reviewable count for configured reviewers", async () => {
    process.env.CONTACT_CANDIDATE_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Zach",
        email: "zach@example.com",
        avatar: null,
        status: "ONLINE",
      },
      expires: "2026-05-27T00:00:00Z",
    })
    vi.mocked(countContactPromotionCandidates).mockResolvedValue(16)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, count: 16 })
    expect(countContactPromotionCandidates).toHaveBeenCalledWith()
  })
})
