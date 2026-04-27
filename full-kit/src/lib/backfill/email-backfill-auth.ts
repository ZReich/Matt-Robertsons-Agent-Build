import { constantTimeCompare } from "@/lib/msgraph/constant-time-compare"

export type EmailBackfillRouteConfig = {
  enabled: boolean
  adminToken?: string
}

export type EmailBackfillAuthResult =
  | { ok: true; via: "admin" }
  | { ok: false; reason: "disabled" | "unauthorized" }

export function loadEmailBackfillRouteConfig(
  env: Record<string, string | undefined> = process.env
): EmailBackfillRouteConfig {
  return {
    enabled: env.EMAIL_BACKFILL_ROUTES_ENABLED === "true",
    adminToken: env.EMAIL_BACKFILL_ADMIN_TOKEN,
  }
}

export function authorizeEmailBackfillRequest(
  headers: Headers,
  config: EmailBackfillRouteConfig = loadEmailBackfillRouteConfig()
): EmailBackfillAuthResult {
  if (!config.enabled) return { ok: false, reason: "disabled" }

  const adminToken = headers.get("x-admin-token")
  if (
    adminToken &&
    config.adminToken &&
    constantTimeCompare(adminToken, config.adminToken)
  ) {
    return { ok: true, via: "admin" }
  }

  return { ok: false, reason: "unauthorized" }
}
