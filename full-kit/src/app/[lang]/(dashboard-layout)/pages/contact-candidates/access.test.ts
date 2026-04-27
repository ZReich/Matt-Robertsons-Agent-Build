import { beforeEach, describe, expect, it, vi } from "vitest"

import { getSession } from "@/lib/auth"

import {
  contactCandidateSignInUrl,
  resolveContactCandidatePageAccess,
} from "./access"

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`)
  }),
}))

describe("contact candidate page access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CONTACT_CANDIDATE_REVIEWER_EMAILS
    delete process.env.CONTACT_CANDIDATE_REVIEWER_IDS
  })

  it("builds the sign-in URL with the contact-candidates return path", () => {
    expect(contactCandidateSignInUrl("en")).toBe(
      "/en/sign-in?redirectTo=%2Fen%2Fpages%2Fcontact-candidates"
    )
  })

  it("redirects anonymous users to sign in", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    await expect(resolveContactCandidatePageAccess("en")).rejects.toThrow(
      "redirect:/en/sign-in?redirectTo=%2Fen%2Fpages%2Fcontact-candidates"
    )
  })

  it("returns forbidden instead of redirecting signed-in non-reviewers", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "local:john.doe@example.com",
        email: "john.doe@example.com",
        name: "John Doe",
        avatar: null,
        status: "active",
      },
      expires: "2026-05-27T00:00:00.000Z",
    })

    await expect(resolveContactCandidatePageAccess("en")).resolves.toEqual({
      allowed: false,
    })
  })

  it("allows configured reviewer emails", async () => {
    process.env.CONTACT_CANDIDATE_REVIEWER_EMAILS =
      "zreichert@rovevaluations.com"
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "local:zreichert@rovevaluations.com",
        email: "zreichert@rovevaluations.com",
        name: "Zach Reichert",
        avatar: null,
        status: "active",
      },
      expires: "2026-05-27T00:00:00.000Z",
    })

    await expect(resolveContactCandidatePageAccess("en")).resolves.toEqual({
      allowed: true,
    })
  })
})
