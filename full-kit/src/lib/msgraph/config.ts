import { z } from "zod"

const schema = z.object({
  MSGRAPH_TENANT_ID: z
    .string({
      required_error: "MSGRAPH_TENANT_ID is required",
    })
    .min(1, "MSGRAPH_TENANT_ID is required"),
  MSGRAPH_CLIENT_ID: z
    .string({
      required_error: "MSGRAPH_CLIENT_ID is required",
    })
    .min(1, "MSGRAPH_CLIENT_ID is required"),
  MSGRAPH_CLIENT_SECRET: z
    .string({
      required_error: "MSGRAPH_CLIENT_SECRET is required",
    })
    .min(1, "MSGRAPH_CLIENT_SECRET is required"),
  MSGRAPH_TARGET_UPN: z
    .string({
      required_error: "MSGRAPH_TARGET_UPN is required",
    })
    .min(1, "MSGRAPH_TARGET_UPN is required"),
  MSGRAPH_TEST_ADMIN_TOKEN: z
    .string({ required_error: "MSGRAPH_TEST_ADMIN_TOKEN is required" })
    .min(32, "MSGRAPH_TEST_ADMIN_TOKEN must be at least 32 characters"),
  MSGRAPH_TEST_ROUTE_ENABLED: z.string().optional(),
  // Optional comma-separated list of additional addresses Matt sends from
  // (aliases, shared mailboxes routed through his identity). Direction
  // inference treats any of these as "outbound" instead of just the primary
  // UPN. Defaults to [targetUpn] when unset.
  MSGRAPH_SELF_ADDRESSES: z.string().optional(),
})

export interface MsgraphConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  targetUpn: string
  testAdminToken: string
  testRouteEnabled: boolean
  /**
   * Lower-cased set of addresses that count as "Matt sending it" — the
   * primary `targetUpn` plus any aliases configured via
   * `MSGRAPH_SELF_ADDRESSES`. Always includes `targetUpn`. Used by the
   * mailbox-backfill direction inference; live ingest still uses
   * folder-based direction (sentitems vs inbox) and doesn't consult this.
   */
  knownSelfAddresses: string[]
}

export function loadMsgraphConfig(): MsgraphConfig {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => issue.message)
      .join("; ")
    throw new Error(`Invalid MSGRAPH config: ${messages}`)
  }
  const env = parsed.data
  const targetUpnLower = env.MSGRAPH_TARGET_UPN.toLowerCase()
  const aliases = (env.MSGRAPH_SELF_ADDRESSES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
  // Dedupe and ensure the primary UPN is always present.
  const knownSelfAddresses = Array.from(new Set([targetUpnLower, ...aliases]))
  return {
    tenantId: env.MSGRAPH_TENANT_ID,
    clientId: env.MSGRAPH_CLIENT_ID,
    clientSecret: env.MSGRAPH_CLIENT_SECRET,
    targetUpn: env.MSGRAPH_TARGET_UPN,
    testAdminToken: env.MSGRAPH_TEST_ADMIN_TOKEN,
    testRouteEnabled: env.MSGRAPH_TEST_ROUTE_ENABLED === "true",
    knownSelfAddresses,
  }
}
