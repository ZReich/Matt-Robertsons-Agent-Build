import { loadMsgraphConfig } from "./config"
import { GraphError } from "./errors"

interface TokenManagerConfig {
  tenantId: string
  clientId: string
  clientSecret: string
}

interface CachedToken {
  token: string
  expiresAt: number // epoch ms
}

const SAFETY_MARGIN_MS = 5 * 60 * 1000 // refresh 5 min before expiry

export class TokenManager {
  private cached: CachedToken | null = null
  private inflight: Promise<CachedToken> | null = null

  constructor(private readonly config: TokenManagerConfig) {}

  async getAccessToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt > Date.now() + SAFETY_MARGIN_MS) {
      return this.cached.token
    }

    if (this.inflight) {
      const fresh = await this.inflight
      return fresh.token
    }

    this.inflight = this.fetchNewToken()
    try {
      const fresh = await this.inflight
      this.cached = fresh
      return fresh.token
    } finally {
      // MUST be in finally — a failed fetch that rejected must not leave
      // future callers awaiting a rejected promise forever.
      this.inflight = null
    }
  }

  invalidate(): void {
    this.cached = null
  }

  private async fetchNewToken(): Promise<CachedToken> {
    const url = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: "https://graph.microsoft.com/.default",
    })

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })

    if (!res.ok) {
      // Parse error body if possible, but NEVER include the client secret.
      let message = `Token endpoint returned ${res.status}`
      let code: string | undefined
      try {
        const data = (await res.json()) as {
          error?: string
          error_description?: string
        }
        if (data.error) code = data.error
        if (data.error_description) {
          message = `${message}: ${data.error_description}`
        }
      } catch {
        // non-JSON body; ignore
      }
      throw new GraphError(res.status, code, "/oauth2/v2.0/token", message)
    }

    const data = (await res.json()) as {
      access_token: string
      expires_in: number
    }
    return {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }
  }
}

/** Process-wide singleton. Construct lazily so tests can use their own instance. */
let singleton: TokenManager | null = null

export function getTokenManager(): TokenManager {
  if (!singleton) {
    const cfg = loadMsgraphConfig()
    singleton = new TokenManager({
      tenantId: cfg.tenantId,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
    })
  }
  return singleton
}

/**
 * Convenience: resolve a fresh access token from the process-wide
 * singleton. Sibling modules that issue their own `fetch` calls
 * (`download-attachment.ts`, etc.) use this so they don't have to
 * thread the `TokenManager` through their call signatures.
 */
export async function getAccessToken(): Promise<string> {
  return getTokenManager().getAccessToken()
}
