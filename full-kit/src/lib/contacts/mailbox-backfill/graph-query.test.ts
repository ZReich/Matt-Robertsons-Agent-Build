import { describe, it, expect, vi } from "vitest"

import { fetchMessagesForContactWindow } from "./graph-query"

// Mock loadMsgraphConfig so the module can resolve targetUpn without a real env.
vi.mock("@/lib/msgraph/config", () => ({
  loadMsgraphConfig: vi.fn(() => ({
    tenantId: "t",
    clientId: "c",
    clientSecret: "s",
    targetUpn: "matt@example.com",
    testAdminToken: "x".repeat(32),
    testRouteEnabled: false,
  })),
}))

// Mock graphFetch (default) — most tests inject fetchImpl directly.
vi.mock("@/lib/msgraph/client", () => ({
  graphFetch: vi.fn(),
}))

interface MockGraphPage {
  value: unknown[]
  "@odata.nextLink"?: string
}

type FetchImpl = <T>(path: string, opts?: unknown) => Promise<T>

function makePagedFetch(pages: MockGraphPage[]): FetchImpl & ReturnType<typeof vi.fn> {
  let idx = 0
  const fn = vi.fn(async () => {
    const page = pages[idx] ?? { value: [] }
    idx += 1
    return page
  }) as unknown as FetchImpl & ReturnType<typeof vi.fn>
  return fn
}

describe("fetchMessagesForContactWindow", () => {
  it("returns empty array for window with no results", async () => {
    const fetchImpl = makePagedFetch([{ value: [] }])
    const out = await fetchMessagesForContactWindow({
      email: "alice@buyer.com",
      window: { start: new Date("2023-01-01"), end: new Date("2024-01-01") },
      fetchImpl,
    })
    expect(out).toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("paginates until @odata.nextLink absent", async () => {
    const msg = (id: string) => ({
      id,
      subject: "x",
      receivedDateTime: "2023-06-01T00:00:00Z",
    })
    const fetchImpl = makePagedFetch([
      { value: [msg("1"), msg("2")], "@odata.nextLink": "/users/matt@example.com/messages?$skiptoken=abc" },
      { value: [msg("3")] },
    ])
    const out = await fetchMessagesForContactWindow({
      email: "alice@buyer.com",
      window: { start: new Date("2023-01-01"), end: new Date("2024-01-01") },
      fetchImpl,
    })
    expect(out).toHaveLength(3)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("builds correct $search query for from/to/cc on the first request", async () => {
    const fetchImpl = makePagedFetch([{ value: [] }])
    await fetchMessagesForContactWindow({
      email: "alice@buyer.com",
      window: { start: new Date("2023-01-01"), end: new Date("2024-01-01") },
      fetchImpl,
    })
    const firstCallPath = fetchImpl.mock.calls[0][0] as string
    // URLSearchParams encodes ":" → "%3A" — search for the encoded variant.
    expect(firstCallPath).toContain("from%3Aalice%40buyer.com")
    expect(firstCallPath).toContain("to%3Aalice%40buyer.com")
    expect(firstCallPath).toContain("cc%3Aalice%40buyer.com")
  })

  it("applies receivedDateTime filter for window bounds", async () => {
    const fetchImpl = makePagedFetch([{ value: [] }])
    await fetchMessagesForContactWindow({
      email: "alice@buyer.com",
      window: { start: new Date("2023-01-01"), end: new Date("2024-01-01") },
      fetchImpl,
    })
    const firstCallPath = fetchImpl.mock.calls[0][0] as string
    expect(firstCallPath).toContain("2023-01-01")
    expect(firstCallPath).toContain("2024-01-01")
    expect(firstCallPath).toContain("receivedDateTime")
  })

  it("includes ConsistencyLevel: eventual header (required for $search)", async () => {
    const fetchImpl = makePagedFetch([{ value: [] }])
    await fetchMessagesForContactWindow({
      email: "alice@buyer.com",
      window: { start: new Date("2023-01-01"), end: new Date("2024-01-01") },
      fetchImpl,
    })
    const opts = fetchImpl.mock.calls[0][1] as { headers?: Record<string, string> }
    expect(opts.headers?.ConsistencyLevel).toBe("eventual")
  })

  it("targets the configured user's mailbox", async () => {
    const fetchImpl = makePagedFetch([{ value: [] }])
    await fetchMessagesForContactWindow({
      email: "alice@buyer.com",
      window: { start: new Date("2023-01-01"), end: new Date("2024-01-01") },
      fetchImpl,
    })
    const firstCallPath = fetchImpl.mock.calls[0][0] as string
    expect(firstCallPath).toContain("/users/")
    expect(firstCallPath).toContain("matt%40example.com")
    expect(firstCallPath).toContain("/messages")
  })
})
