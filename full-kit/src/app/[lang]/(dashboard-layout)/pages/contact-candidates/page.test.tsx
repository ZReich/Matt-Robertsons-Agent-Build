import { describe, expect, it, vi } from "vitest"

import { getSession } from "@/lib/auth"
import { listContactPromotionCandidates } from "@/lib/contact-promotion-candidates"

import ContactCandidatesPage from "./page"

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/contact-promotion-candidates", () => ({
  listContactPromotionCandidates: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  db: {
    contact: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`)
  }),
}))

describe("ContactCandidatesPage", () => {
  it("redirects before reading PII when no session is present", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    await expect(
      ContactCandidatesPage({
        params: Promise.resolve({ lang: "en" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("redirect:/en/sign-in")

    expect(listContactPromotionCandidates).not.toHaveBeenCalled()
  })
})
