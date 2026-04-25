import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TokenManager } from "./token-manager"

const TEST_CONFIG = {
  tenantId: "tenant-guid",
  clientId: "client-guid",
  clientSecret: "shh",
}

function mockTokenResponse(
  accessToken: string,
  expiresInSeconds: number
): Response {
  return new Response(
    JSON.stringify({
      access_token: accessToken,
      expires_in: expiresInSeconds,
      token_type: "Bearer",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}

describe("TokenManager", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-16T12:00:00Z"))
    fetchSpy = vi.spyOn(global, "fetch")
  })

  afterEach(() => {
    vi.useRealTimers()
    fetchSpy.mockRestore()
  })

  it("fetches a token on first call and caches it", async () => {
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600))
    const tm = new TokenManager(TEST_CONFIG)

    const a = await tm.getAccessToken()
    const b = await tm.getAccessToken()

    expect(a).toBe("tok-1")
    expect(b).toBe("tok-1")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("POSTs to the correct token endpoint with form-encoded body", async () => {
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600))
    const tm = new TokenManager(TEST_CONFIG)

    await tm.getAccessToken()

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://login.microsoftonline.com/tenant-guid/oauth2/v2.0/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      })
    )
    const call = fetchSpy.mock.calls[0]
    const body = (call[1] as RequestInit).body as string
    expect(body).toContain("grant_type=client_credentials")
    expect(body).toContain("client_id=client-guid")
    expect(body).toContain("client_secret=shh")
    expect(body).toContain("scope=https%3A%2F%2Fgraph.microsoft.com%2F.default")
  })

  it("refreshes when cached token is within 5 minutes of expiry", async () => {
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600))
    const tm = new TokenManager(TEST_CONFIG)
    await tm.getAccessToken()

    // Advance time to 56 minutes in — cached token expires at 60 min,
    // 5-min margin means refresh kicks in at 55 min.
    vi.setSystemTime(new Date("2026-04-16T12:56:00Z"))
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-2", 3600))

    const tok = await tm.getAccessToken()

    expect(tok).toBe("tok-2")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("dedupes concurrent refreshes into a single fetch", async () => {
    let resolveFetch: (r: Response) => void = () => {}
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    fetchSpy.mockReturnValueOnce(pending as unknown as Promise<Response>)

    const tm = new TokenManager(TEST_CONFIG)
    const a = tm.getAccessToken()
    const b = tm.getAccessToken()
    const c = tm.getAccessToken()

    // All three callers see only ONE fetch in flight.
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    resolveFetch(mockTokenResponse("tok-shared", 3600))
    const [ra, rb, rc] = await Promise.all([a, b, c])

    expect(ra).toBe("tok-shared")
    expect(rb).toBe("tok-shared")
    expect(rc).toBe("tok-shared")
  })

  it("clears inflight on fetch failure so next call can retry", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("network down"))
    const tm = new TokenManager(TEST_CONFIG)

    await expect(tm.getAccessToken()).rejects.toThrow("network down")

    // Subsequent call must NOT be stuck awaiting a rejected promise forever.
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-recovered", 3600))
    const tok = await tm.getAccessToken()
    expect(tok).toBe("tok-recovered")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("throws GraphError on non-2xx from token endpoint", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "invalid_client",
          error_description: "bad secret",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    )
    const tm = new TokenManager(TEST_CONFIG)

    await expect(tm.getAccessToken()).rejects.toMatchObject({
      name: "GraphError",
      status: 400,
    })
  })

  it("invalidate() forces a fresh token on next call", async () => {
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600))
    const tm = new TokenManager(TEST_CONFIG)
    await tm.getAccessToken()

    tm.invalidate()
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-2", 3600))
    const tok = await tm.getAccessToken()

    expect(tok).toBe("tok-2")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
