import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { loadPlaudConfig } from "./config"

const CLEAN_KEYS = [
  "PLAUD_BEARER_TOKEN",
  "PLAUD_EMAIL",
  "PLAUD_PASSWORD",
  "PLAUD_CREDENTIAL_KEY",
  "PLAUD_CRON_SECRET",
  "PLAUD_REGION",
] as const

const VALID_KEY = "0".repeat(64)
const VALID_SECRET = "x".repeat(32)

beforeEach(() => {
  for (const k of CLEAN_KEYS) delete process.env[k]
})
afterEach(() => {
  for (const k of CLEAN_KEYS) delete process.env[k]
})

describe("loadPlaudConfig", () => {
  it("requires PLAUD_CREDENTIAL_KEY", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    expect(() => loadPlaudConfig()).toThrow(/PLAUD_CREDENTIAL_KEY/)
  })

  it("rejects PLAUD_CREDENTIAL_KEY that isn't 64 hex chars", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_CREDENTIAL_KEY = "deadbeef"
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    expect(() => loadPlaudConfig()).toThrow(/PLAUD_CREDENTIAL_KEY/)
  })

  it("accepts uppercase hex in PLAUD_CREDENTIAL_KEY", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_CREDENTIAL_KEY = "AB".repeat(32)
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    const cfg = loadPlaudConfig()
    expect(cfg.credentialKey).toBe("AB".repeat(32))
  })

  it("requires PLAUD_CRON_SECRET >= 32 chars", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = "short"
    expect(() => loadPlaudConfig()).toThrow(/PLAUD_CRON_SECRET/)
  })

  it("requires at least one auth source (bearer OR email+password)", () => {
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    expect(() => loadPlaudConfig()).toThrow(/PLAUD_BEARER_TOKEN/)
  })

  it("requires both PLAUD_EMAIL and PLAUD_PASSWORD when using password auth (no bearer)", () => {
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    process.env.PLAUD_EMAIL = "matt@example.com"
    expect(() => loadPlaudConfig()).toThrow(/PLAUD_PASSWORD/)
  })

  it("requires both PLAUD_EMAIL and PLAUD_PASSWORD (only password set, no bearer)", () => {
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    process.env.PLAUD_PASSWORD = "hunter2"
    expect(() => loadPlaudConfig()).toThrow(/PLAUD_EMAIL/)
  })

  it("accepts bearer + stray email (no password) — half-credential is unused but not an error", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_EMAIL = "matt@example.com"
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    const cfg = loadPlaudConfig()
    expect(cfg.bearerToken).toBe("tok")
    expect(cfg.email).toBe("matt@example.com")
    expect(cfg.password).toBeUndefined()
  })

  it("accepts bearer + stray password (no email) — half-credential is unused but not an error", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_PASSWORD = "hunter2"
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    const cfg = loadPlaudConfig()
    expect(cfg.bearerToken).toBe("tok")
    expect(cfg.password).toBe("hunter2")
    expect(cfg.email).toBeUndefined()
  })

  it("accepts bearer token alone", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    const cfg = loadPlaudConfig()
    expect(cfg.bearerToken).toBe("tok")
    expect(cfg.email).toBeUndefined()
    expect(cfg.password).toBeUndefined()
  })

  it("accepts email+password alone", () => {
    process.env.PLAUD_EMAIL = "matt@example.com"
    process.env.PLAUD_PASSWORD = "hunter2"
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    const cfg = loadPlaudConfig()
    expect(cfg.email).toBe("matt@example.com")
    expect(cfg.password).toBe("hunter2")
    expect(cfg.bearerToken).toBeUndefined()
  })

  it("accepts both bearer and password (bearer is hot path, password is fallback)", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_EMAIL = "matt@example.com"
    process.env.PLAUD_PASSWORD = "hunter2"
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    const cfg = loadPlaudConfig()
    expect(cfg.bearerToken).toBe("tok")
    expect(cfg.email).toBe("matt@example.com")
    expect(cfg.password).toBe("hunter2")
  })

  it("defaults region to us", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    const cfg = loadPlaudConfig()
    expect(cfg.region).toBe("us")
  })

  it("accepts PLAUD_REGION=eu", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    process.env.PLAUD_REGION = "eu"
    const cfg = loadPlaudConfig()
    expect(cfg.region).toBe("eu")
  })

  it("rejects an unknown PLAUD_REGION with a specific message", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok"
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    process.env.PLAUD_REGION = "ap"
    expect(() => loadPlaudConfig()).toThrow(
      /PLAUD_REGION.*must be 'us' or 'eu'/
    )
  })

  it("trims surrounding whitespace from credentials", () => {
    process.env.PLAUD_BEARER_TOKEN = "  tok  "
    process.env.PLAUD_EMAIL = "  matt@example.com  "
    process.env.PLAUD_PASSWORD = "  hunter2  "
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    const cfg = loadPlaudConfig()
    expect(cfg.bearerToken).toBe("tok")
    expect(cfg.email).toBe("matt@example.com")
    expect(cfg.password).toBe("hunter2")
  })

  it("trims trailing newlines from credentials (common when sourced from .env files)", () => {
    process.env.PLAUD_BEARER_TOKEN = "tok\n"
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY + "\n"
    process.env.PLAUD_CRON_SECRET = VALID_SECRET + "\n"
    const cfg = loadPlaudConfig()
    expect(cfg.bearerToken).toBe("tok")
    expect(cfg.credentialKey).toBe(VALID_KEY)
    expect(cfg.cronSecret).toBe(VALID_SECRET)
  })

  it("rejects whitespace-only credential vars (likely misconfig)", () => {
    process.env.PLAUD_BEARER_TOKEN = "   "
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    expect(() => loadPlaudConfig()).toThrow(/PLAUD_BEARER_TOKEN.*blank/)
  })

  it("rejects whitespace-only PLAUD_EMAIL when password is set", () => {
    process.env.PLAUD_EMAIL = "   "
    process.env.PLAUD_PASSWORD = "hunter2"
    process.env.PLAUD_CREDENTIAL_KEY = VALID_KEY
    process.env.PLAUD_CRON_SECRET = VALID_SECRET
    expect(() => loadPlaudConfig()).toThrow(/PLAUD_EMAIL.*blank/)
  })

  it("error messages do not echo bearer/password/key values", () => {
    const SECRET_TOK = "SUPER-SECRET-PLAUD-TOKEN-DO-NOT-LEAK"
    process.env.PLAUD_BEARER_TOKEN = SECRET_TOK
    // Force a different failure (missing CRON_SECRET).
    let caught: unknown
    try {
      loadPlaudConfig()
    } catch (err) {
      caught = err
    }
    const msg = (caught as Error).message
    expect(msg).not.toContain(SECRET_TOK)
  })
})
