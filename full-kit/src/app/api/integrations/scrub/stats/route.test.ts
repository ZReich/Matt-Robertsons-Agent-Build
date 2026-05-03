import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

import { authorizeScrubRequest } from "@/lib/ai"

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

describe("scrub stats route — namespaced outcome bucketing (I3)", () => {
  it("counts classifier-validation-failed in validationFailed", async () => {
    mockedFindMany.mockResolvedValue([
      row("classifier-validation-failed"),
      row("classifier-validation-failed"),
      row("validation-failed"),
    ])

    const res = await GET(
      new Request("http://localhost/api/integrations/scrub/stats")
    )
    const body = (await res.json()) as { last24h: { validationFailed: number } }
    expect(body.last24h.validationFailed).toBe(3)
  })

  it("counts extractor-validation-failed AND extractor-pdf-validation-failed in validationFailed", async () => {
    mockedFindMany.mockResolvedValue([
      row("extractor-validation-failed"),
      row("extractor-pdf-validation-failed"),
      row("extractor-pdf-validation-failed"),
    ])

    const res = await GET(
      new Request("http://localhost/api/integrations/scrub/stats")
    )
    const body = (await res.json()) as { last24h: { validationFailed: number } }
    expect(body.last24h.validationFailed).toBe(3)
  })

  it("counts classifier-ok / extractor-ok / extractor-pdf-ok in scrubbedOk", async () => {
    mockedFindMany.mockResolvedValue([
      row("classifier-ok"),
      row("extractor-ok"),
      row("extractor-pdf-ok"),
      row("scrubbed"),
    ])

    const res = await GET(
      new Request("http://localhost/api/integrations/scrub/stats")
    )
    const body = (await res.json()) as { last24h: { scrubbedOk: number } }
    expect(body.last24h.scrubbedOk).toBe(4)
  })

  it("counts classifier-/extractor-/extractor-pdf- provider-error in dbCommitFailed", async () => {
    mockedFindMany.mockResolvedValue([
      row("classifier-provider-error"),
      row("extractor-provider-error"),
      row("extractor-pdf-provider-error"),
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
