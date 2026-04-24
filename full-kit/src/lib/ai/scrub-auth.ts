import { constantTimeCompare } from "@/lib/msgraph/constant-time-compare"

export type ScrubRouteConfig = {
  enabled: boolean
  adminToken?: string
  cronSecret?: string
}

export type ScrubAuthResult =
  | { ok: true; via: "admin" | "cron" }
  | { ok: false; reason: "disabled" | "unauthorized" }

export function loadScrubRouteConfig(
  env: Record<string, string | undefined> = process.env
): ScrubRouteConfig {
  return {
    enabled: env.SCRUB_ROUTES_ENABLED === "true",
    adminToken: env.SCRUB_ADMIN_TOKEN,
    cronSecret: env.SCRUB_CRON_SECRET,
  }
}

export function authorizeScrubRequest(
  headers: Headers,
  config: ScrubRouteConfig = loadScrubRouteConfig(),
  options: { allowCron: boolean }
): ScrubAuthResult {
  if (!config.enabled) return { ok: false, reason: "disabled" }

  const adminToken = headers.get("x-admin-token")
  if (
    adminToken &&
    config.adminToken &&
    constantTimeCompare(adminToken, config.adminToken)
  ) {
    return { ok: true, via: "admin" }
  }

  const auth = headers.get("authorization")
  const bearerPrefix = "Bearer "
  if (
    options.allowCron &&
    auth?.startsWith(bearerPrefix) &&
    config.cronSecret &&
    constantTimeCompare(auth.slice(bearerPrefix.length), config.cronSecret)
  ) {
    return { ok: true, via: "cron" }
  }

  return { ok: false, reason: "unauthorized" }
}
