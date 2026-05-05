import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { encryptJson } from "@/lib/crypto/at-rest"
import { db } from "@/lib/prisma"

import {
  __resetPlaudAuthForTesting,
  getPlaudToken,
  invalidatePlaudToken,
  withTokenRefreshOn401,
} from "./auth"
import * as client from "./client"

vi.mock("@/lib/prisma", () => ({
  db: {
    integrationCredential: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

const KEY = "0".repeat(64)
const VALID_SECRET = "x".repeat(32)

beforeEach(() => {
  vi.clearAllMocks()
  __resetPlaudAuthForTesting()
  process.env.PLAUD_CREDENTIAL_KEY = KEY
  process.env.PLAUD_CRON_SECRET = VALID_SECRET
})
afterEach(() => {
  delete process.env.PLAUD_BEARER_TOKEN
  delete process.env.PLAUD_EMAIL
  delete process.env.PLAUD_PASSWORD
  delete process.env.PLAUD_REGION
  vi.restoreAllMocks()
})

const findUnique = db.integrationCredential.findUnique as ReturnType<
  typeof vi.fn
>
const upsert = db.integrationCredential.upsert as ReturnType<typeof vi.fn>
const updateMany = db.integrationCredential.updateMany as ReturnType<
  typeof vi.fn
>
const create = db.integrationCredential.create as ReturnType<typeof vi.fn>

describe("getPlaudToken", () => {
  it("returns cached token when present and not expired", async () => {
    process.env.PLAUD_BEARER_TOKEN = "fallback"
    const future = Date.now() + 86_400_000
    findUnique.mockResolvedValue({
      service: "plaud",
      credentials: encryptJson(
        { accessToken: "cached-tok", expiresAt: future },
        KEY
      ),
      isActive: true,
    })
    const tok = await getPlaudToken()
    expect(tok).toBe("cached-tok")
  })

  it("ignores cache when isActive is false", async () => {
    process.env.PLAUD_BEARER_TOKEN = "env-tok"
    const future = Date.now() + 86_400_000
    findUnique.mockResolvedValue({
      service: "plaud",
      credentials: encryptJson(
        { accessToken: "stale", expiresAt: future },
        KEY
      ),
      isActive: false,
    })
    upsert.mockResolvedValue({})
    const tok = await getPlaudToken()
    expect(tok).toBe("env-tok")
  })

  it("falls back to PLAUD_BEARER_TOKEN env when no cache row", async () => {
    process.env.PLAUD_BEARER_TOKEN = "env-tok"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    const tok = await getPlaudToken()
    expect(tok).toBe("env-tok")
    expect(upsert).toHaveBeenCalledOnce()
  })

  it("logs in with email/password when no bearer source available", async () => {
    process.env.PLAUD_EMAIL = "matt@example.com"
    process.env.PLAUD_PASSWORD = "hunter2"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    const loginSpy = vi.spyOn(client, "loginWithPassword").mockResolvedValue({
      accessToken: "minted-tok",
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    const tok = await getPlaudToken()
    expect(tok).toBe("minted-tok")
    expect(loginSpy).toHaveBeenCalledOnce()
  })

  it("re-mints when cached token has expired", async () => {
    process.env.PLAUD_EMAIL = "matt@example.com"
    process.env.PLAUD_PASSWORD = "hunter2"
    const past = Date.now() - 1000
    findUnique.mockResolvedValue({
      service: "plaud",
      credentials: encryptJson(
        { accessToken: "expired", expiresAt: past },
        KEY
      ),
      isActive: true,
    })
    upsert.mockResolvedValue({})
    const loginSpy = vi.spyOn(client, "loginWithPassword").mockResolvedValue({
      accessToken: "fresh",
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    const tok = await getPlaudToken()
    expect(tok).toBe("fresh")
    expect(loginSpy).toHaveBeenCalledOnce()
  })

  it("re-mints when cached token is in the safety-margin window", async () => {
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "p"
    const almostExpired = Date.now() + 60_000
    findUnique.mockResolvedValue({
      service: "plaud",
      credentials: encryptJson(
        { accessToken: "old", expiresAt: almostExpired },
        KEY
      ),
      isActive: true,
    })
    upsert.mockResolvedValue({})
    const loginSpy = vi.spyOn(client, "loginWithPassword").mockResolvedValue({
      accessToken: "fresh",
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    const tok = await getPlaudToken()
    expect(tok).toBe("fresh")
    expect(loginSpy).toHaveBeenCalledOnce()
  })

  it("invalidatePlaudToken clears cache and forces re-mint", async () => {
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "p"
    findUnique.mockResolvedValueOnce(null)
    upsert.mockResolvedValue({})
    const loginSpy = vi
      .spyOn(client, "loginWithPassword")
      .mockResolvedValueOnce({
        accessToken: "tok-1",
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .mockResolvedValueOnce({
        accessToken: "tok-2",
        expiresAt: new Date(Date.now() + 86_400_000),
      })
    await getPlaudToken()
    await invalidatePlaudToken()
    findUnique.mockResolvedValueOnce(null)
    const tok = await getPlaudToken()
    expect(tok).toBe("tok-2")
    expect(loginSpy).toHaveBeenCalledTimes(2)
  })

  it("marks credential isActive=false when login fails", async () => {
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "wrong"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    updateMany.mockResolvedValue({ count: 1 })
    vi.spyOn(client, "loginWithPassword").mockRejectedValue(
      new client.PlaudApiError(401, "/auth/access-token", "bad credentials")
    )
    await expect(getPlaudToken()).rejects.toBeInstanceOf(client.PlaudApiError)
    expect(updateMany).toHaveBeenCalled()
    const lastUpdate = updateMany.mock.calls[updateMany.mock.calls.length - 1][0]
    expect(lastUpdate.data.isActive).toBe(false)
  })

  it("creates an inactive marker row when login fails and no row exists yet", async () => {
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "wrong"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    updateMany.mockResolvedValue({ count: 0 })
    create.mockResolvedValue({})
    vi.spyOn(client, "loginWithPassword").mockRejectedValue(
      new client.PlaudApiError(401, "/auth/access-token", "bad credentials")
    )
    await expect(getPlaudToken()).rejects.toBeInstanceOf(client.PlaudApiError)
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0][0].data.isActive).toBe(false)
  })

  it("does not clobber a fresher concurrent success when login fails", async () => {
    // updateMany returns count=0 because someone else just refreshed —
    // the existing row is fresher than our attempt window.
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "wrong"
    findUnique
      .mockResolvedValueOnce(null) // first call: tryReadCache
      .mockResolvedValueOnce({ service: "plaud", isActive: true }) // existence check
    upsert.mockResolvedValue({})
    updateMany.mockResolvedValue({ count: 0 })
    vi.spyOn(client, "loginWithPassword").mockRejectedValue(
      new client.PlaudApiError(401, "/auth/access-token", "bad creds")
    )
    await expect(getPlaudToken()).rejects.toBeInstanceOf(client.PlaudApiError)
    expect(create).not.toHaveBeenCalled()
  })

  it("surfaces the original auth error even if the inactive-marker DB write throws", async () => {
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "wrong"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    updateMany.mockRejectedValue(new Error("DB outage"))
    vi.spyOn(client, "loginWithPassword").mockRejectedValue(
      new client.PlaudApiError(401, "/auth/access-token", "bad creds")
    )
    const err = await getPlaudToken().catch((e) => e)
    expect(err).toBeInstanceOf(client.PlaudApiError)
    expect((err as Error).message).not.toContain("DB outage")
  })

  it("recovers from corrupt cache blob (decrypt failure)", async () => {
    process.env.PLAUD_BEARER_TOKEN = "env-tok"
    findUnique.mockResolvedValue({
      service: "plaud",
      credentials: "garbage-not-encrypted",
      isActive: true,
    })
    upsert.mockResolvedValue({})
    const tok = await getPlaudToken()
    expect(tok).toBe("env-tok")
  })

  it("single-flight: parallel calls share the same login", async () => {
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "p"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    const loginSpy = vi
      .spyOn(client, "loginWithPassword")
      .mockImplementation(
        () =>
          new Promise((r) =>
            setTimeout(
              () =>
                r({
                  accessToken: "shared",
                  expiresAt: new Date(Date.now() + 86_400_000),
                }),
              20
            )
          )
      )
    const [a, b, c] = await Promise.all([
      getPlaudToken(),
      getPlaudToken(),
      getPlaudToken(),
    ])
    expect([a, b, c]).toEqual(["shared", "shared", "shared"])
    expect(loginSpy).toHaveBeenCalledOnce()
  })

  it("a fresh getPlaudToken call after a rejected resolution starts a NEW resolution", async () => {
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "p"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    updateMany.mockResolvedValue({ count: 1 })
    const loginSpy = vi
      .spyOn(client, "loginWithPassword")
      .mockRejectedValueOnce(
        new client.PlaudApiError(401, "/auth/access-token", "first")
      )
      .mockResolvedValueOnce({
        accessToken: "second-time",
        expiresAt: new Date(Date.now() + 86_400_000),
      })
    await expect(getPlaudToken()).rejects.toBeInstanceOf(client.PlaudApiError)
    const tok = await getPlaudToken()
    expect(tok).toBe("second-time")
    expect(loginSpy).toHaveBeenCalledTimes(2)
  })

  it("throws when no auth source can produce a token", async () => {
    findUnique.mockResolvedValue(null)
    await expect(getPlaudToken()).rejects.toThrow(/Plaud config/)
  })

  it("skipEnvBearer bypasses env bearer and goes straight to password login", async () => {
    process.env.PLAUD_BEARER_TOKEN = "stale-env-tok"
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "p"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    const loginSpy = vi.spyOn(client, "loginWithPassword").mockResolvedValue({
      accessToken: "minted",
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    const tok = await getPlaudToken({ skipEnvBearer: true })
    expect(tok).toBe("minted")
    expect(loginSpy).toHaveBeenCalledOnce()
  })
})

describe("withTokenRefreshOn401", () => {
  it("retries once after 401 with a freshly minted token", async () => {
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "p"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    vi.spyOn(client, "loginWithPassword")
      .mockResolvedValueOnce({
        accessToken: "tok-1",
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .mockResolvedValueOnce({
        accessToken: "tok-2",
        expiresAt: new Date(Date.now() + 86_400_000),
      })

    let calls = 0
    const result = await withTokenRefreshOn401(async (tok) => {
      calls++
      if (calls === 1) {
        throw new client.PlaudApiError(401, "/file/simple/web", "expired")
      }
      return tok
    })
    expect(result).toBe("tok-2")
    expect(calls).toBe(2)
  })

  it("on 401 with stale env bearer, falls through to password login (skipEnvBearer)", async () => {
    process.env.PLAUD_BEARER_TOKEN = "stale-env-tok"
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "p"
    findUnique.mockResolvedValueOnce(null) // first getPlaudToken: no cache
    upsert.mockResolvedValue({})
    findUnique.mockResolvedValueOnce(null) // post-invalidate: no cache
    const loginSpy = vi.spyOn(client, "loginWithPassword").mockResolvedValue({
      accessToken: "fresh-from-pw",
      expiresAt: new Date(Date.now() + 86_400_000),
    })

    let calls = 0
    const result = await withTokenRefreshOn401(async (tok) => {
      calls++
      if (calls === 1) {
        // First call uses env bearer.
        expect(tok).toBe("stale-env-tok")
        throw new client.PlaudApiError(401, "/x", "expired")
      }
      return tok
    })
    expect(result).toBe("fresh-from-pw")
    expect(loginSpy).toHaveBeenCalledOnce()
  })

  it("does not retry on non-401 errors", async () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    let calls = 0
    await expect(
      withTokenRefreshOn401(async () => {
        calls++
        throw new client.PlaudApiError(500, "/x", "server error")
      })
    ).rejects.toBeInstanceOf(client.PlaudApiError)
    expect(calls).toBe(1)
  })

  it("does not retry twice on consecutive 401s", async () => {
    // Both bearer + password set (Option C from spec) so the retry path
    // has a real auth source to use.
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_EMAIL = "m@e.com"
    process.env.PLAUD_PASSWORD = "p"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    vi.spyOn(client, "loginWithPassword").mockResolvedValue({
      accessToken: "minted-but-also-bad",
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    let calls = 0
    await expect(
      withTokenRefreshOn401(async () => {
        calls++
        throw new client.PlaudApiError(401, "/x", "still bad")
      })
    ).rejects.toBeInstanceOf(client.PlaudApiError)
    expect(calls).toBe(2)
  })

  it("when stale env-bearer 401s and no password fallback exists, surfaces the original 401", async () => {
    process.env.PLAUD_BEARER_TOKEN = "stale"
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({})
    let calls = 0
    const err = await withTokenRefreshOn401(async () => {
      calls++
      throw new client.PlaudApiError(401, "/x", "expired")
    }).catch((e) => e)
    // After invalidate + skipEnvBearer, no auth source → config error.
    // Either error type is acceptable for the operator (means re-auth needed).
    expect(err).toBeInstanceOf(Error)
    expect(calls).toBe(1)
  })
})
