import { Prisma } from "@prisma/client"

import { decryptJson, encryptJson } from "@/lib/crypto/at-rest"
import { db } from "@/lib/prisma"

import { loginWithPassword, PlaudApiError } from "./client"
import { loadPlaudConfig } from "./config"

const SERVICE = "plaud"
// Refresh tokens this far ahead of stated expiry so an in-flight request
// doesn't get caught by a token that expires mid-call.
const SAFETY_MARGIN_MS = 5 * 60 * 1000
// Cache lifetime to assume for env-supplied bearer tokens (DevTools tokens
// last ~300 days). Real expiry comes from the server on the password path
// where we actually decode the JWT.
const ENV_BEARER_ASSUMED_TTL_MS = 300 * 86_400_000

interface CachedTokenBlob {
  accessToken: string
  expiresAt: number // epoch ms
}

interface ResolveOpts {
  /**
   * Skip the env-bearer source. Used by `withTokenRefreshOn401` so a stale
   * `PLAUD_BEARER_TOKEN` doesn't get re-cached after we just invalidated
   * the same token.
   */
  skipEnvBearer?: boolean
}

let inflight: Promise<string> | null = null

/**
 * Test-only: clear the in-process inflight promise so repeated tests can
 * exercise concurrent-call shapes without leaking state.
 */
export function __resetPlaudAuthForTesting(): void {
  inflight = null
}

/**
 * Single-flight: parallel callers share one resolution. The `.finally`
 * runs after `resolveToken` settles (success or failure); a caller that
 * arrives between settle and `.finally` sees the rejection like everyone
 * else (which is correct — the bearer/login path shouldn't be re-tried
 * silently right after a failure). A caller arriving AFTER `.finally`
 * starts a fresh resolution.
 */
export async function getPlaudToken(opts: ResolveOpts = {}): Promise<string> {
  // skipEnvBearer is a one-shot signal from withTokenRefreshOn401 — it
  // should not piggyback on an existing inflight resolution that may have
  // started before the 401 happened.
  if (inflight && !opts.skipEnvBearer) return inflight
  const promise = resolveToken(opts).finally(() => {
    if (inflight === promise) inflight = null
  })
  inflight = promise
  return promise
}

async function resolveToken(opts: ResolveOpts): Promise<string> {
  const cfg = loadPlaudConfig()
  const attemptStartedAt = new Date()

  // 1. Try the encrypted DB cache.
  const cached = await tryReadCache(cfg.credentialKey)
  if (cached && cached.expiresAt > Date.now() + SAFETY_MARGIN_MS) {
    return cached.accessToken
  }

  // 2. Try env bearer token (unless caller asked us to skip it — see
  // withTokenRefreshOn401's retry path).
  if (cfg.bearerToken && !opts.skipEnvBearer) {
    await persistToken(
      {
        accessToken: cfg.bearerToken,
        expiresAt: Date.now() + ENV_BEARER_ASSUMED_TTL_MS,
      },
      cfg.credentialKey
    )
    return cfg.bearerToken
  }

  // 3. Mint via password login.
  if (!cfg.email || !cfg.password) {
    throw new Error(
      "Plaud config: no cached token, no PLAUD_BEARER_TOKEN, and no PLAUD_EMAIL+PLAUD_PASSWORD"
    )
  }
  try {
    const minted = await loginWithPassword({
      email: cfg.email,
      password: cfg.password,
      region: cfg.region,
    })
    await persistToken(
      {
        accessToken: minted.accessToken,
        expiresAt: minted.expiresAt.getTime(),
      },
      cfg.credentialKey
    )
    return minted.accessToken
  } catch (err) {
    // Best-effort: mark inactive so the UI/route can surface a re-auth
    // banner. Wrap so a DB outage during the marker doesn't mask the
    // original auth error. Use updateMany with a `lastRefreshed` guard so
    // we don't clobber a successful concurrent resolution that already
    // wrote a fresh token after our attempt began.
    try {
      const updated = await db.integrationCredential.updateMany({
        where: {
          service: SERVICE,
          OR: [
            { lastRefreshed: null },
            { lastRefreshed: { lt: attemptStartedAt } },
          ],
        },
        data: { isActive: false, credentials: Prisma.JsonNull },
      })
      // If no row matched (either none exists yet, or a concurrent success
      // refreshed it), only create when there's no row at all.
      if (updated.count === 0) {
        const exists = await db.integrationCredential.findUnique({
          where: { service: SERVICE },
        })
        if (!exists) {
          await db.integrationCredential.create({
            data: {
              service: SERVICE,
              credentials: Prisma.JsonNull,
              isActive: false,
            },
          })
        }
      }
    } catch {
      // Swallow — we MUST surface the original auth error to the caller.
    }
    throw err
  }
}

async function tryReadCache(
  keyHex: string
): Promise<CachedTokenBlob | null> {
  const row = await db.integrationCredential.findUnique({
    where: { service: SERVICE },
  })
  if (!row || !row.isActive) return null
  if (typeof row.credentials !== "string" || row.credentials.length === 0) {
    // Includes JsonNull (deserialized as null) and our `{}` placeholder.
    return null
  }
  try {
    return decryptJson<CachedTokenBlob>(row.credentials, keyHex)
  } catch {
    // Corrupt blob — fall through to env/login. Don't surface the decrypt
    // failure (it would leak which key shape we expect).
    return null
  }
}

async function persistToken(
  blob: CachedTokenBlob,
  key: string
): Promise<void> {
  const encrypted = encryptJson(blob, key)
  await db.integrationCredential.upsert({
    where: { service: SERVICE },
    create: {
      service: SERVICE,
      credentials: encrypted,
      isActive: true,
      encryptedAt: new Date(),
      lastRefreshed: new Date(),
    },
    update: {
      credentials: encrypted,
      isActive: true,
      encryptedAt: new Date(),
      lastRefreshed: new Date(),
    },
  })
}

export async function invalidatePlaudToken(): Promise<void> {
  await db.integrationCredential.upsert({
    where: { service: SERVICE },
    create: {
      service: SERVICE,
      credentials: Prisma.JsonNull,
      isActive: false,
    },
    update: { credentials: Prisma.JsonNull, isActive: false },
  })
}

/**
 * Wrap any Plaud API call so a 401 invalidates the cached token and
 * retries exactly once with a freshly minted one. The retry passes
 * `skipEnvBearer: true` so a stale `PLAUD_BEARER_TOKEN` env var doesn't
 * get re-cached and re-tried — falls through to the password login.
 *
 * A second 401 surfaces to the caller (real auth failure that needs
 * operator action — e.g. wrong env vars or a banned account).
 */
export async function withTokenRefreshOn401<T>(
  fn: (token: string) => Promise<T>
): Promise<T> {
  const tok = await getPlaudToken()
  try {
    return await fn(tok)
  } catch (err) {
    if (err instanceof PlaudApiError && err.status === 401) {
      await invalidatePlaudToken()
      const fresh = await getPlaudToken({ skipEnvBearer: true })
      return fn(fresh)
    }
    throw err
  }
}
