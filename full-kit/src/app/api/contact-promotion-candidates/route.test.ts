import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getSession } from "@/lib/auth"
import { listContactPromotionCandidates } from "@/lib/contact-promotion-candidates"

import { GET } from "./route"

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/contact-promotion-candidates", () => ({
  listContactPromotionCandidates: vi.fn(),
}))

describe("contact promotion candidates route", () => {
  beforeEach(() => {
    delete process.env.CONTACT_CANDIDATE_REVIEWER_EMAILS
    delete process.env.CONTACT_CANDIDATE_REVIEWER_IDS
    vi.mocked(getSession).mockReset()
    vi.mocked(listContactPromotionCandidates).mockReset()
  })

  it("requires an authenticated session before returning candidate evidence", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(
      new NextRequest("https://example.test/api/contact-promotion-candidates")
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
    expect(listContactPromotionCandidates).not.toHaveBeenCalled()
  })

  it("rejects authenticated users who are not configured reviewers", async () => {
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

    const response = await GET(
      new NextRequest("https://example.test/api/contact-promotion-candidates")
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "forbidden" })
    expect(listContactPromotionCandidates).not.toHaveBeenCalled()
  })

  it("lists candidates for configured reviewers", async () => {
    process.env.CONTACT_CANDIDATE_REVIEWER_EMAILS =
      "other@example.com, ZACH@example.com "
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
    vi.mocked(listContactPromotionCandidates).mockResolvedValue([])

    const response = await GET(
      new NextRequest(
        "https://example.test/api/contact-promotion-candidates?status=pending"
      )
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ candidates: [] })
    expect(listContactPromotionCandidates).toHaveBeenCalledWith({
      status: "pending",
      includeTerminal: false,
    })
  })
})
