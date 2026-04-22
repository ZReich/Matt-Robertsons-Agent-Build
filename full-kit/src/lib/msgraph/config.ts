import { z } from "zod";

const schema = z.object({
  MSGRAPH_TENANT_ID: z.string({
    required_error: "MSGRAPH_TENANT_ID is required",
  }).min(1, "MSGRAPH_TENANT_ID is required"),
  MSGRAPH_CLIENT_ID: z.string({
    required_error: "MSGRAPH_CLIENT_ID is required",
  }).min(1, "MSGRAPH_CLIENT_ID is required"),
  MSGRAPH_CLIENT_SECRET: z.string({
    required_error: "MSGRAPH_CLIENT_SECRET is required",
  }).min(1, "MSGRAPH_CLIENT_SECRET is required"),
  MSGRAPH_TARGET_UPN: z.string({
    required_error: "MSGRAPH_TARGET_UPN is required",
  }).min(1, "MSGRAPH_TARGET_UPN is required"),
  MSGRAPH_TEST_ADMIN_TOKEN: z
    .string({ required_error: "MSGRAPH_TEST_ADMIN_TOKEN is required" })
    .min(32, "MSGRAPH_TEST_ADMIN_TOKEN must be at least 32 characters"),
  MSGRAPH_TEST_ROUTE_ENABLED: z.string().optional(),
});

export interface MsgraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  targetUpn: string;
  testAdminToken: string;
  testRouteEnabled: boolean;
}

export function loadMsgraphConfig(): MsgraphConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => issue.message)
      .join("; ");
    throw new Error(`Invalid MSGRAPH config: ${messages}`);
  }
  const env = parsed.data;
  return {
    tenantId: env.MSGRAPH_TENANT_ID,
    clientId: env.MSGRAPH_CLIENT_ID,
    clientSecret: env.MSGRAPH_CLIENT_SECRET,
    targetUpn: env.MSGRAPH_TARGET_UPN,
    testAdminToken: env.MSGRAPH_TEST_ADMIN_TOKEN,
    testRouteEnabled: env.MSGRAPH_TEST_ROUTE_ENABLED === "true",
  };
}
