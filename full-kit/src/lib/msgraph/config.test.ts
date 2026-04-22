import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REQUIRED_VARS = [
  "MSGRAPH_TENANT_ID",
  "MSGRAPH_CLIENT_ID",
  "MSGRAPH_CLIENT_SECRET",
  "MSGRAPH_TARGET_UPN",
  "MSGRAPH_TEST_ADMIN_TOKEN",
] as const;

describe("msgraph config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear MSGRAPH_* env vars so each test starts from a known empty baseline.
    // loadMsgraphConfig() re-reads process.env on every call, so no module
    // reset is needed — in-process mutation is observed directly.
    for (const key of REQUIRED_VARS) delete process.env[key];
    delete process.env.MSGRAPH_TEST_ROUTE_ENABLED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("parses a valid environment", async () => {
    process.env.MSGRAPH_TENANT_ID = "tenant-guid";
    process.env.MSGRAPH_CLIENT_ID = "client-guid";
    process.env.MSGRAPH_CLIENT_SECRET = "shh";
    process.env.MSGRAPH_TARGET_UPN = "matt@example.com";
    process.env.MSGRAPH_TEST_ADMIN_TOKEN = "x".repeat(32);
    process.env.MSGRAPH_TEST_ROUTE_ENABLED = "true";

    const { loadMsgraphConfig } = await import("./config");
    const cfg = loadMsgraphConfig();

    expect(cfg.tenantId).toBe("tenant-guid");
    expect(cfg.clientId).toBe("client-guid");
    expect(cfg.clientSecret).toBe("shh");
    expect(cfg.targetUpn).toBe("matt@example.com");
    expect(cfg.testAdminToken).toBe("x".repeat(32));
    expect(cfg.testRouteEnabled).toBe(true);
  });

  it("defaults testRouteEnabled to false when unset", async () => {
    process.env.MSGRAPH_TENANT_ID = "t";
    process.env.MSGRAPH_CLIENT_ID = "c";
    process.env.MSGRAPH_CLIENT_SECRET = "s";
    process.env.MSGRAPH_TARGET_UPN = "u@e.com";
    process.env.MSGRAPH_TEST_ADMIN_TOKEN = "x".repeat(32);

    const { loadMsgraphConfig } = await import("./config");
    const cfg = loadMsgraphConfig();

    expect(cfg.testRouteEnabled).toBe(false);
  });

  it.each(REQUIRED_VARS)(
    "throws a descriptive error when %s is missing",
    async (missingVar) => {
      process.env.MSGRAPH_TENANT_ID = "t";
      process.env.MSGRAPH_CLIENT_ID = "c";
      process.env.MSGRAPH_CLIENT_SECRET = "s";
      process.env.MSGRAPH_TARGET_UPN = "u@e.com";
      process.env.MSGRAPH_TEST_ADMIN_TOKEN = "x".repeat(32);
      delete process.env[missingVar];

      const { loadMsgraphConfig } = await import("./config");
      expect(() => loadMsgraphConfig()).toThrow(missingVar);
    },
  );

  it("rejects a short admin token", async () => {
    process.env.MSGRAPH_TENANT_ID = "t";
    process.env.MSGRAPH_CLIENT_ID = "c";
    process.env.MSGRAPH_CLIENT_SECRET = "s";
    process.env.MSGRAPH_TARGET_UPN = "u@e.com";
    process.env.MSGRAPH_TEST_ADMIN_TOKEN = "short";

    const { loadMsgraphConfig } = await import("./config");
    expect(() => loadMsgraphConfig()).toThrow(/MSGRAPH_TEST_ADMIN_TOKEN/);
  });
});
