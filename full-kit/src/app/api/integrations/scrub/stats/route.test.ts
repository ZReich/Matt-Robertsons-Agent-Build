import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authorizeScrubRequest } from "@/lib/ai"
import { db } from "@/lib/prisma"

import { GET } from "./route"

vi.mock("@/lib/prisma", () => ({
  db: {
    scrubApiCall: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/ai", () => ({
  PROMPT_VERSION: "test-version",
  authorizeScrubRequest: vi.fn(),
  getScrubCoverageStats: vi.fn(async () => ({})),
  getScrubQueueStats: vi.fn(async () => ({})),
  isCachingLive: vi.fn(async () => false),
}))

const mockedAuth = authorizeScrubRequest as unknown as ReturnType<typeof vi.fn>
const mockedFindMany = db.scrubApiCall.findMany as unknown as ReturnType<
  typeof vi.fn
>

function row(outcome: string) {
  return {
    outcome,
    tokensIn: 100,
    tokensOut: 50,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    estimatedUsd: { toString: () => "0.001" },
  }
}

beforeEach(() => {
  mockedAuth.mockReset()
  mockedFindMany.mockReset()
  mockedAuth.mockReturnValue({ ok: true, via: "admin" })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("scrub stats route — outcome bucketing", () => {
  it("scopes the findMany query to scrub-purpose rows (and pre-migration null)", async () => {
    mockedFindMany.mockResolvedValue([])

    await GET(new Request("http://localhost/api/integrations/scrub/stats"))

    // First call is the 24h window. Inspect its WHERE.
    const calls = mockedFindMany.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0][0]).toMatchObject({
      where: expect.objectContaining({
        OR: [{ purpose: "scrub" }, { purpose: null }],
      }),
    })
  })

  it("counts ok / scrubbed in scrubbedOk", async () => {
    mockedFindMany.mockResolvedValue([row("ok"), row("ok"), row("scrubbed")])

    const res = await GET(
      new Request("http://localhost/api/integrations/scrub/stats")
    )
    const body = (await res.json()) as { last24h: { scrubbedOk: number } }
    expect(body.last24h.scrubbedOk).toBe(3)
  })

  it("counts validation-failed in validationFailed", async () => {
    mockedFindMany.mockResolvedValue([
      row("validation-failed"),
      row("validation-failed"),
    ])

    const res = await GET(
      new Request("http://localhost/api/integrations/scrub/stats")
    )
    const body = (await res.json()) as { last24h: { validationFailed: number } }
    expect(body.last24h.validationFailed).toBe(2)
  })

  it("counts provider-error and db-commit-failed in dbCommitFailed", async () => {
    mockedFindMany.mockResolvedValue([
      row("provider-error"),
      row("db-commit-failed"),
      row("db-commit-failed"),
    ])

    const res = await GET(
      new Request("http://localhost/api/integrations/scrub/stats")
    )
    const body = (await res.json()) as { last24h: { dbCommitFailed: number } }
    expect(body.last24h.dbCommitFailed).toBe(3)
  })

  it("returns 401 when authorize rejects", async () => {
    mockedAuth.mockReturnValue({ ok: false, reason: "unauthorized" })
    const res = await GET(
      new Request("http://localhost/api/integrations/scrub/stats")
    )
    expect(res.status).toBe(401)
  })
})
