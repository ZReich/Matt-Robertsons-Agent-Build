import { beforeEach, describe, expect, it, vi } from "vitest"

import { getSession } from "@/lib/auth"
import { db } from "@/lib/prisma"

import { GET } from "./route"

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  db: {
    agentAction: { findMany: vi.fn() },
  },
}))

describe("agent actions list route", () => {
  beforeEach(() => {
    delete process.env.AGENT_ACTION_REVIEWER_EMAILS
    delete process.env.AGENT_ACTION_REVIEWER_IDS
    vi.mocked(getSession).mockReset()
    vi.mocked(db.agentAction.findMany).mockReset()
  })

  it("requires an authenticated configured reviewer", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
    expect(db.agentAction.findMany).not.toHaveBeenCalled()
  })

  it("returns the most recent bounded Prisma actions for reviewers", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(db.agentAction.findMany).mockResolvedValue([{ id: "action-1" }])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ actions: [{ id: "action-1" }] })
    expect(db.agentAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    )
  })
})

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
