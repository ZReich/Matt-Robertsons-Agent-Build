# MS Graph / Outlook Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable Microsoft Graph connection layer (`src/lib/msgraph/`) and a gated `GET /api/integrations/msgraph/test` endpoint that proves end-to-end Graph connectivity against Matt Robertson's Outlook mailbox.

**Architecture:** A single library module owns all Graph plumbing. A `TokenManager` singleton caches OAuth2 client-credentials access tokens with in-flight deduplication. A stateless `graphFetch()` wrapper adds auth headers, handles 401/403/429/503/504/network retries, and throws typed `GraphError`s. A kill-switched test route calls two narrow helpers (`getMailboxInfo`, `listRecentMessages`) to demonstrate the pipe works.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Node 22 `fetch`, `zod` (already installed) for env validation, `vitest` (new) for pure-logic unit tests, Microsoft Graph REST API v1.0.

**Spec reference:** `docs/superpowers/specs/2026-04-16-msgraph-outlook-connection-design.md`

---

## File map

| Path | Purpose | Created or modified |
|---|---|---|
| `full-kit/package.json` | Add vitest dep + `test` script | Modify |
| `full-kit/vitest.config.ts` | Vitest config | Create |
| `full-kit/.env.example` | Add MSGRAPH_* placeholders | Modify |
| `full-kit/src/lib/msgraph/errors.ts` | `GraphError` class | Create |
| `full-kit/src/lib/msgraph/config.ts` | zod env schema + exported config | Create |
| `full-kit/src/lib/msgraph/config.test.ts` | Unit tests for config | Create |
| `full-kit/src/lib/msgraph/retry-after.ts` | Pure `parseRetryAfter()` helper | Create |
| `full-kit/src/lib/msgraph/retry-after.test.ts` | Unit tests for retry-after parser | Create |
| `full-kit/src/lib/msgraph/constant-time-compare.ts` | Pure length-safe string compare | Create |
| `full-kit/src/lib/msgraph/constant-time-compare.test.ts` | Unit tests for compare | Create |
| `full-kit/src/lib/msgraph/token-manager.ts` | `TokenManager` class + singleton | Create |
| `full-kit/src/lib/msgraph/token-manager.test.ts` | Unit tests w/ mocked `fetch` | Create |
| `full-kit/src/lib/msgraph/client.ts` | `graphFetch`, `getMailboxInfo`, `listRecentMessages` | Create |
| `full-kit/src/lib/msgraph/client.test.ts` | Unit tests for retry behavior w/ mocked `fetch` | Create |
| `full-kit/src/lib/msgraph/index.ts` | Barrel export | Create |
| `full-kit/src/app/api/integrations/msgraph/test/route.ts` | Test GET endpoint | Create |

---

## Task 1: Install vitest and wire up test infrastructure

**Files:**
- Modify: `full-kit/package.json`
- Create: `full-kit/vitest.config.ts`

- [ ] **Step 1: Install vitest as a dev dependency**

Run from `full-kit/`:
```bash
cd full-kit && pnpm add -D vitest @vitest/ui
```

Expected: two packages added to `devDependencies` in `package.json`, lockfile updated.

- [ ] **Step 2: Add `test` script to `package.json`**

In `full-kit/package.json`, add inside the `"scripts"` object (after `"format"`):

```json
"test": "vitest run",
"test:watch": "vitest",
```

- [ ] **Step 3: Create `vitest.config.ts`**

Create `full-kit/vitest.config.ts` with:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Next.js App Router file conventions (route.ts, etc.) don't collide with .test.ts,
    // but we exclude node_modules explicitly to be safe with monorepo hoisting.
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

The `@` alias matches what Next.js uses (via `tsconfig.json` paths), so tests can import `@/lib/msgraph/...` like app code does.

- [ ] **Step 4: Verify vitest runs with zero tests**

Run from `full-kit/`:
```bash
pnpm test
```

Expected: vitest starts, reports "No test files found, exiting with code 0" or similar, exits 0. If it exits non-zero, fix config before proceeding.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/package.json full-kit/pnpm-lock.yaml full-kit/vitest.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

## Task 2: Document MSGRAPH_* env vars in `.env.example`

**Files:**
- Modify: `full-kit/.env.example`

- [ ] **Step 1: Append MSGRAPH block to `.env.example`**

Open `full-kit/.env.example` and append at the end (keep existing content):

```
# --- Microsoft Graph (Outlook) integration ---
# Credentials issued by NAI's IT provider (Entre) for the Azure AD app registration.
# Real values live in .env.local (gitignored). These are placeholders for onboarding.
MSGRAPH_TENANT_ID=REDACTED
MSGRAPH_CLIENT_ID=REDACTED
MSGRAPH_CLIENT_SECRET=REDACTED
# Matt's Microsoft login (user principal name), e.g. matt.robertson@nai-example.com
MSGRAPH_TARGET_UPN=REDACTED
# Long random string. Required as x-admin-token header on /api/integrations/msgraph/test.
# Generate with: openssl rand -hex 32
MSGRAPH_TEST_ADMIN_TOKEN=REDACTED
# Kill switch for the test route. Must be exactly "true" to enable. Anything else => 404.
MSGRAPH_TEST_ROUTE_ENABLED=false
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/.env.example
git commit -m "docs: add MSGRAPH_* env vars to .env.example"
```

**Note for the engineer:** the real values go in `full-kit/.env.local` (gitignored). Do **not** write them to any tracked file. `MSGRAPH_CLIENT_SECRET` came from Dereck @ Entre and expires 2028-04-15; add a calendar reminder for 2028-03-15 to rotate.

---

## Task 3: Implement `errors.ts`

**Files:**
- Create: `full-kit/src/lib/msgraph/errors.ts`

- [ ] **Step 1: Create the file with `GraphError` class**

Create `full-kit/src/lib/msgraph/errors.ts`:

```ts
/**
 * Error thrown for any non-2xx response from Microsoft Graph or the token endpoint.
 * Carries Graph's structured error code (e.g. "Authorization_RequestDenied"),
 * the HTTP status, and the path that was called — enough for downstream code
 * to make decisions like `if (err.status === 403) ...`.
 */
export class GraphError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    public readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "GraphError";
  }
}
```

No dedicated test — this is a 10-line class with no logic. It's covered transitively by every test that asserts on an error instance in later tasks.

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/errors.ts
git commit -m "feat(msgraph): add GraphError class"
```

---

## Task 4: Implement `config.ts` with zod validation (TDD)

**Files:**
- Create: `full-kit/src/lib/msgraph/config.test.ts`
- Create: `full-kit/src/lib/msgraph/config.ts`

- [ ] **Step 1: Write the failing test**

Create `full-kit/src/lib/msgraph/config.test.ts`:

```ts
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
    // Reset module cache so config re-evaluates env each test.
    // (zod schemas run at import time.)
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd full-kit && pnpm test src/lib/msgraph/config.test.ts
```

Expected: FAIL — "Cannot find module './config'" or similar.

- [ ] **Step 3: Implement `config.ts`**

Create `full-kit/src/lib/msgraph/config.ts`:

```ts
import { z } from "zod";

const schema = z.object({
  MSGRAPH_TENANT_ID: z.string().min(1, "MSGRAPH_TENANT_ID is required"),
  MSGRAPH_CLIENT_ID: z.string().min(1, "MSGRAPH_CLIENT_ID is required"),
  MSGRAPH_CLIENT_SECRET: z.string().min(1, "MSGRAPH_CLIENT_SECRET is required"),
  MSGRAPH_TARGET_UPN: z.string().min(1, "MSGRAPH_TARGET_UPN is required"),
  MSGRAPH_TEST_ADMIN_TOKEN: z
    .string()
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
```

Note: `loadMsgraphConfig()` is a **function**, not a module-level constant. This lets tests reset env between cases. Callers in production code call it once at import time and hold the result; see the TokenManager and route for the pattern.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd full-kit && pnpm test src/lib/msgraph/config.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/config.ts full-kit/src/lib/msgraph/config.test.ts
git commit -m "feat(msgraph): config.ts with zod env validation"
```

---

## Task 5: Implement pure helpers `parseRetryAfter` and `constantTimeCompare` (TDD)

**Files:**
- Create: `full-kit/src/lib/msgraph/retry-after.test.ts`
- Create: `full-kit/src/lib/msgraph/retry-after.ts`
- Create: `full-kit/src/lib/msgraph/constant-time-compare.test.ts`
- Create: `full-kit/src/lib/msgraph/constant-time-compare.ts`

These are small pure functions extracted for testability. `parseRetryAfter` handles both of the `Retry-After` formats Graph may send (delta-seconds or HTTP date), with a max clamp and fallback. `constantTimeCompare` protects the admin-token check on the test route from length-based timing leaks and from the `timingSafeEqual` throw-on-mismatched-lengths footgun.

- [ ] **Step 1: Write failing tests for `parseRetryAfter`**

Create `full-kit/src/lib/msgraph/retry-after.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { parseRetryAfter } from "./retry-after";

describe("parseRetryAfter", () => {
  it("returns the fallback when header is null", () => {
    expect(parseRetryAfter(null, 2000, 60_000)).toBe(2000);
  });

  it("returns the fallback when header is unparseable", () => {
    expect(parseRetryAfter("not-a-number", 2000, 60_000)).toBe(2000);
  });

  it("parses a delta-seconds value and returns ms", () => {
    expect(parseRetryAfter("30", 2000, 60_000)).toBe(30_000);
  });

  it("clamps a delta-seconds value to max", () => {
    expect(parseRetryAfter("600", 2000, 60_000)).toBe(60_000);
  });

  it("floors a negative delta-seconds value to 0", () => {
    expect(parseRetryAfter("-5", 2000, 60_000)).toBe(0);
  });

  it("parses an HTTP date value relative to now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T12:00:00Z"));

    // Header says "retry at 12:00:20" — that's 20 seconds from "now".
    const result = parseRetryAfter(
      "Thu, 16 Apr 2026 12:00:20 GMT",
      2000,
      60_000,
    );
    expect(result).toBe(20_000);

    vi.useRealTimers();
  });

  it("clamps an HTTP date value to max", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T12:00:00Z"));

    // 10 minutes in the future, but max is 60 seconds.
    const result = parseRetryAfter(
      "Thu, 16 Apr 2026 12:10:00 GMT",
      2000,
      60_000,
    );
    expect(result).toBe(60_000);

    vi.useRealTimers();
  });

  it("floors an HTTP date in the past to 0", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T12:00:00Z"));

    const result = parseRetryAfter(
      "Thu, 16 Apr 2026 11:00:00 GMT",
      2000,
      60_000,
    );
    expect(result).toBe(0);

    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test; confirm it fails**

```bash
cd full-kit && pnpm test src/lib/msgraph/retry-after.test.ts
```

Expected: FAIL — "Cannot find module './retry-after'".

- [ ] **Step 3: Implement `parseRetryAfter`**

Create `full-kit/src/lib/msgraph/retry-after.ts`:

```ts
/**
 * Parse an HTTP `Retry-After` header value. The header may be either:
 *   - a non-negative integer of seconds ("30"), or
 *   - an HTTP-date ("Thu, 16 Apr 2026 12:00:20 GMT")
 *
 * Returns the number of milliseconds to wait before retrying, clamped to
 * [0, maxMs]. Returns `fallbackMs` if the header is null, empty, or unparseable.
 *
 * Graph typically uses delta-seconds for 429 throttling; HTTP-date form is
 * included for robustness against other 5xx/proxy responses.
 */
export function parseRetryAfter(
  headerValue: string | null | undefined,
  fallbackMs: number,
  maxMs: number,
): number {
  if (!headerValue) return fallbackMs;

  const trimmed = headerValue.trim();
  if (trimmed === "") return fallbackMs;

  // Try delta-seconds first (integer or decimal)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (Number.isFinite(seconds)) {
      const ms = seconds * 1000;
      return clamp(ms, 0, maxMs);
    }
  }

  // Fall back to HTTP-date
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const deltaMs = dateMs - Date.now();
    return clamp(deltaMs, 0, maxMs);
  }

  return fallbackMs;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
```

- [ ] **Step 4: Run test; confirm all pass**

```bash
cd full-kit && pnpm test src/lib/msgraph/retry-after.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Write failing tests for `constantTimeCompare`**

Create `full-kit/src/lib/msgraph/constant-time-compare.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { constantTimeCompare } from "./constant-time-compare";

describe("constantTimeCompare", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeCompare("hello", "hello")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(constantTimeCompare("hello", "world")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(constantTimeCompare("a", "ab")).toBe(false);
  });

  it("returns false when one argument is empty", () => {
    expect(constantTimeCompare("", "a")).toBe(false);
    expect(constantTimeCompare("a", "")).toBe(false);
  });

  it("returns true when both arguments are empty", () => {
    expect(constantTimeCompare("", "")).toBe(true);
  });

  it("does not throw on length mismatch (unlike raw timingSafeEqual)", () => {
    expect(() => constantTimeCompare("short", "much-longer-value")).not.toThrow();
  });
});
```

- [ ] **Step 6: Run test; confirm it fails**

```bash
cd full-kit && pnpm test src/lib/msgraph/constant-time-compare.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement `constantTimeCompare`**

Create `full-kit/src/lib/msgraph/constant-time-compare.ts`:

```ts
import { timingSafeEqual } from "node:crypto";

/**
 * Compare two strings in a way that doesn't leak their contents via timing.
 * Always runs the timing-safe path; returns false immediately on length mismatch.
 *
 * Why not just call crypto.timingSafeEqual directly? It throws if the two
 * Buffers have different lengths — both a footgun (unhandled exception) and
 * a subtle length-leak (the throw itself is observable). Checking length
 * first is the standard workaround.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
```

- [ ] **Step 8: Run both helper test files**

```bash
cd full-kit && pnpm test src/lib/msgraph/retry-after.test.ts src/lib/msgraph/constant-time-compare.test.ts
```

Expected: PASS, 14 tests total.

- [ ] **Step 9: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/retry-after.ts full-kit/src/lib/msgraph/retry-after.test.ts full-kit/src/lib/msgraph/constant-time-compare.ts full-kit/src/lib/msgraph/constant-time-compare.test.ts
git commit -m "feat(msgraph): parseRetryAfter and constantTimeCompare helpers"
```

---

## Task 6: Implement `TokenManager` with caching and in-flight dedup (TDD)

**Files:**
- Create: `full-kit/src/lib/msgraph/token-manager.test.ts`
- Create: `full-kit/src/lib/msgraph/token-manager.ts`

The TokenManager is the trickiest piece because it has three concurrency concerns: (1) return cached tokens when fresh, (2) dedupe concurrent refreshes into a single in-flight request, and (3) clear the in-flight slot in `finally` so a failed fetch doesn't poison future calls. All three are unit-testable with a mocked `global.fetch`.

- [ ] **Step 1: Write failing tests**

Create `full-kit/src/lib/msgraph/token-manager.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TokenManager } from "./token-manager";

const TEST_CONFIG = {
  tenantId: "tenant-guid",
  clientId: "client-guid",
  clientSecret: "shh",
};

function mockTokenResponse(
  accessToken: string,
  expiresInSeconds: number,
): Response {
  return new Response(
    JSON.stringify({
      access_token: accessToken,
      expires_in: expiresInSeconds,
      token_type: "Bearer",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("TokenManager", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T12:00:00Z"));
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchSpy.mockRestore();
  });

  it("fetches a token on first call and caches it", async () => {
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600));
    const tm = new TokenManager(TEST_CONFIG);

    const a = await tm.getAccessToken();
    const b = await tm.getAccessToken();

    expect(a).toBe("tok-1");
    expect(b).toBe("tok-1");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("POSTs to the correct token endpoint with form-encoded body", async () => {
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600));
    const tm = new TokenManager(TEST_CONFIG);

    await tm.getAccessToken();

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://login.microsoftonline.com/tenant-guid/oauth2/v2.0/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      }),
    );
    const call = fetchSpy.mock.calls[0];
    const body = (call[1] as RequestInit).body as string;
    expect(body).toContain("grant_type=client_credentials");
    expect(body).toContain("client_id=client-guid");
    expect(body).toContain("client_secret=shh");
    expect(body).toContain("scope=https%3A%2F%2Fgraph.microsoft.com%2F.default");
  });

  it("refreshes when cached token is within 5 minutes of expiry", async () => {
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600));
    const tm = new TokenManager(TEST_CONFIG);
    await tm.getAccessToken();

    // Advance time to 56 minutes in — cached token expires at 60 min,
    // 5-min margin means refresh kicks in at 55 min.
    vi.setSystemTime(new Date("2026-04-16T12:56:00Z"));
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-2", 3600));

    const tok = await tm.getAccessToken();

    expect(tok).toBe("tok-2");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent refreshes into a single fetch", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    fetchSpy.mockReturnValueOnce(pending as unknown as Promise<Response>);

    const tm = new TokenManager(TEST_CONFIG);
    const a = tm.getAccessToken();
    const b = tm.getAccessToken();
    const c = tm.getAccessToken();

    // All three callers see only ONE fetch in flight.
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    resolveFetch(mockTokenResponse("tok-shared", 3600));
    const [ra, rb, rc] = await Promise.all([a, b, c]);

    expect(ra).toBe("tok-shared");
    expect(rb).toBe("tok-shared");
    expect(rc).toBe("tok-shared");
  });

  it("clears inflight on fetch failure so next call can retry", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("network down"));
    const tm = new TokenManager(TEST_CONFIG);

    await expect(tm.getAccessToken()).rejects.toThrow("network down");

    // Subsequent call must NOT be stuck awaiting a rejected promise forever.
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-recovered", 3600));
    const tok = await tm.getAccessToken();
    expect(tok).toBe("tok-recovered");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws GraphError on non-2xx from token endpoint", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "invalid_client", error_description: "bad secret" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
    const tm = new TokenManager(TEST_CONFIG);

    await expect(tm.getAccessToken()).rejects.toMatchObject({
      name: "GraphError",
      status: 400,
    });
  });

  it("invalidate() forces a fresh token on next call", async () => {
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-1", 3600));
    const tm = new TokenManager(TEST_CONFIG);
    await tm.getAccessToken();

    tm.invalidate();
    fetchSpy.mockResolvedValueOnce(mockTokenResponse("tok-2", 3600));
    const tok = await tm.getAccessToken();

    expect(tok).toBe("tok-2");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test; confirm it fails**

```bash
cd full-kit && pnpm test src/lib/msgraph/token-manager.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TokenManager`**

Create `full-kit/src/lib/msgraph/token-manager.ts`:

```ts
import { loadMsgraphConfig } from "./config";
import { GraphError } from "./errors";

interface TokenManagerConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

const SAFETY_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export class TokenManager {
  private cached: CachedToken | null = null;
  private inflight: Promise<CachedToken> | null = null;

  constructor(private readonly config: TokenManagerConfig) {}

  async getAccessToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt > Date.now() + SAFETY_MARGIN_MS) {
      return this.cached.token;
    }

    if (this.inflight) {
      const fresh = await this.inflight;
      return fresh.token;
    }

    this.inflight = this.fetchNewToken();
    try {
      const fresh = await this.inflight;
      this.cached = fresh;
      return fresh.token;
    } finally {
      // MUST be in finally — a failed fetch that rejected must not leave
      // future callers awaiting a rejected promise forever.
      this.inflight = null;
    }
  }

  invalidate(): void {
    this.cached = null;
  }

  private async fetchNewToken(): Promise<CachedToken> {
    const url = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: "https://graph.microsoft.com/.default",
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      // Parse error body if possible, but NEVER include the client secret.
      let message = `Token endpoint returned ${res.status}`;
      let code: string | undefined;
      try {
        const data = (await res.json()) as {
          error?: string;
          error_description?: string;
        };
        if (data.error) code = data.error;
        if (data.error_description) {
          message = `${message}: ${data.error_description}`;
        }
      } catch {
        // non-JSON body; ignore
      }
      throw new GraphError(res.status, code, "/oauth2/v2.0/token", message);
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    return {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }
}

/** Process-wide singleton. Construct lazily so tests can use their own instance. */
let singleton: TokenManager | null = null;

export function getTokenManager(): TokenManager {
  if (!singleton) {
    const cfg = loadMsgraphConfig();
    singleton = new TokenManager({
      tenantId: cfg.tenantId,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
    });
  }
  return singleton;
}
```

- [ ] **Step 4: Run the test; confirm all pass**

```bash
cd full-kit && pnpm test src/lib/msgraph/token-manager.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/token-manager.ts full-kit/src/lib/msgraph/token-manager.test.ts
git commit -m "feat(msgraph): TokenManager with cache and in-flight dedup"
```

---

## Task 7: Implement `graphFetch`, helpers, and barrel export (TDD)

**Files:**
- Create: `full-kit/src/lib/msgraph/client.test.ts`
- Create: `full-kit/src/lib/msgraph/client.ts`
- Create: `full-kit/src/lib/msgraph/index.ts`

Unit tests here cover **retry behavior only** — 401 → invalidate + retry once, 429 → Retry-After wait + retry once, 403 → throw immediately. The happy-path and "real mailbox" integration testing happens via the test route in Task 8.

- [ ] **Step 1: Write failing tests**

Create `full-kit/src/lib/msgraph/client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GraphError } from "./errors";

// We want a fresh, deterministic TokenManager in each test.
// Inject via the internal factory so we don't touch real env.
import { TokenManager } from "./token-manager";

const TEST_TOKEN_CONFIG = {
  tenantId: "t",
  clientId: "c",
  clientSecret: "s",
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function graphErrorResponse(
  status: number,
  code: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({ error: { code, message: `mocked ${code}` } }),
    {
      status,
      headers: { "Content-Type": "application/json", ...extraHeaders },
    },
  );
}

describe("graphFetch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(global, "fetch");

    // Clear module cache so the client picks up a fresh tokenManager.
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchSpy.mockRestore();
  });

  async function loadClientWithTokenManager() {
    const tm = new TokenManager(TEST_TOKEN_CONFIG);
    // Stub getAccessToken so we don't hit the token endpoint in client tests.
    vi.spyOn(tm, "getAccessToken").mockResolvedValue("test-access-token");
    vi.spyOn(tm, "invalidate");

    const mod = await import("./client");
    mod.__setTokenManagerForTests(tm);
    return { mod, tm };
  }

  it("returns parsed JSON on 2xx", async () => {
    const { mod } = await loadClientWithTokenManager();
    fetchSpy.mockResolvedValueOnce(jsonResponse({ hello: "world" }));

    const out = await mod.graphFetch<{ hello: string }>("/users/x");

    expect(out).toEqual({ hello: "world" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://graph.microsoft.com/v1.0/users/x",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );
  });

  it("throws GraphError with parsed code on 4xx", async () => {
    const { mod } = await loadClientWithTokenManager();
    fetchSpy.mockResolvedValueOnce(
      graphErrorResponse(404, "ResourceNotFound"),
    );

    await expect(mod.graphFetch("/users/missing")).rejects.toMatchObject({
      name: "GraphError",
      status: 404,
      code: "ResourceNotFound",
    });
  });

  it("throws immediately on 403 without retry", async () => {
    const { mod } = await loadClientWithTokenManager();
    fetchSpy.mockResolvedValueOnce(
      graphErrorResponse(403, "Authorization_RequestDenied"),
    );

    await expect(mod.graphFetch("/users/x")).rejects.toBeInstanceOf(GraphError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("invalidates token and retries once on 401, then succeeds", async () => {
    const { mod, tm } = await loadClientWithTokenManager();
    fetchSpy
      .mockResolvedValueOnce(graphErrorResponse(401, "InvalidAuthenticationToken"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const out = await mod.graphFetch<{ ok: boolean }>("/users/x");

    expect(out).toEqual({ ok: true });
    expect(tm.invalidate).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws on a second 401 after retry", async () => {
    const { mod } = await loadClientWithTokenManager();
    fetchSpy
      .mockResolvedValueOnce(graphErrorResponse(401, "InvalidAuthenticationToken"))
      .mockResolvedValueOnce(graphErrorResponse(401, "InvalidAuthenticationToken"));

    await expect(mod.graphFetch("/users/x")).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("waits Retry-After seconds on 429 then retries once", async () => {
    const { mod } = await loadClientWithTokenManager();
    fetchSpy
      .mockResolvedValueOnce(
        graphErrorResponse(429, "TooManyRequests", { "Retry-After": "2" }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const promise = mod.graphFetch<{ ok: boolean }>("/users/x");

    // Advance fake timers past the 2-second retry-after.
    await vi.advanceTimersByTimeAsync(2100);
    const out = await promise;

    expect(out).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("retries once on 503, then throws if still failing", async () => {
    const { mod } = await loadClientWithTokenManager();
    fetchSpy
      .mockResolvedValueOnce(graphErrorResponse(503, "ServiceUnavailable"))
      .mockResolvedValueOnce(graphErrorResponse(503, "ServiceUnavailable"));

    const promise = mod.graphFetch("/users/x");
    await vi.advanceTimersByTimeAsync(3000); // past default 2s fallback
    await expect(promise).rejects.toMatchObject({ status: 503 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test; confirm it fails**

```bash
cd full-kit && pnpm test src/lib/msgraph/client.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `client.ts`**

Create `full-kit/src/lib/msgraph/client.ts`:

```ts
import { GraphError } from "./errors";
import { parseRetryAfter } from "./retry-after";
import { getTokenManager, TokenManager } from "./token-manager";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const RETRY_AFTER_DEFAULT_MS = 2000;
const RETRY_AFTER_MAX_MS = 60_000;

// --- narrow types: only the fields we actually consume ---

export interface GraphMailboxInfo {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}

export interface GraphMessage {
  id: string;
  subject: string | null;
  from: {
    emailAddress: { name: string; address: string };
  } | null;
  receivedDateTime: string;
}

// --- test-only seam: allow tests to inject a stubbed TokenManager ---

let injectedTokenManager: TokenManager | null = null;
/** @internal — for tests only. Not exported from index.ts. */
export function __setTokenManagerForTests(tm: TokenManager | null): void {
  injectedTokenManager = tm;
}
function activeTokenManager(): TokenManager {
  return injectedTokenManager ?? getTokenManager();
}

// --- main wrapper ---

interface GraphFetchOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
}

export async function graphFetch<T>(
  path: string,
  options: GraphFetchOptions = {},
): Promise<T> {
  return doGraphFetch<T>(path, options, /*isRetry*/ false);
}

async function doGraphFetch<T>(
  path: string,
  options: GraphFetchOptions,
  isRetry: boolean,
): Promise<T> {
  const tm = activeTokenManager();
  const token = await tm.getAccessToken();

  const url = new URL(GRAPH_BASE + path);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body,
    });
  } catch (networkErr) {
    // Network failure: retry once, then give up.
    if (!isRetry) {
      await sleep(RETRY_AFTER_DEFAULT_MS);
      return doGraphFetch<T>(path, options, /*isRetry*/ true);
    }
    throw new GraphError(
      0,
      "NetworkError",
      path,
      networkErr instanceof Error ? networkErr.message : String(networkErr),
    );
  }

  if (res.ok) {
    return (await res.json()) as T;
  }

  // --- error handling ---
  if (res.status === 401 && !isRetry) {
    tm.invalidate();
    return doGraphFetch<T>(path, options, /*isRetry*/ true);
  }

  if (res.status === 403) {
    throw await buildGraphError(res, path);
  }

  if ((res.status === 429 || res.status === 503 || res.status === 504) && !isRetry) {
    const waitMs = parseRetryAfter(
      res.headers.get("Retry-After"),
      RETRY_AFTER_DEFAULT_MS,
      RETRY_AFTER_MAX_MS,
    );
    await sleep(waitMs);
    return doGraphFetch<T>(path, options, /*isRetry*/ true);
  }

  throw await buildGraphError(res, path);
}

async function buildGraphError(res: Response, path: string): Promise<GraphError> {
  let code: string | undefined;
  let message = `Graph returned ${res.status}`;
  try {
    const data = (await res.json()) as {
      error?: { code?: string; message?: string };
    };
    if (data.error?.code) code = data.error.code;
    if (data.error?.message) message = data.error.message;
  } catch {
    // non-JSON body; keep default message
  }
  return new GraphError(res.status, code, path, message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- narrow helpers ---

export async function getMailboxInfo(upn: string): Promise<GraphMailboxInfo> {
  return graphFetch<GraphMailboxInfo>(
    `/users/${encodeURIComponent(upn)}/mailFolders/inbox`,
  );
}

export async function listRecentMessages(
  upn: string,
  top: number,
): Promise<GraphMessage[]> {
  const res = await graphFetch<{ value: GraphMessage[] }>(
    `/users/${encodeURIComponent(upn)}/messages`,
    {
      query: {
        $top: String(top),
        $select: "id,subject,from,receivedDateTime",
        $orderby: "receivedDateTime desc",
      },
    },
  );
  return res.value;
}
```

- [ ] **Step 4: Run the test; confirm all pass**

```bash
cd full-kit && pnpm test src/lib/msgraph/client.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Create the barrel export**

Create `full-kit/src/lib/msgraph/index.ts`:

```ts
export { GraphError } from "./errors";
export {
  graphFetch,
  getMailboxInfo,
  listRecentMessages,
} from "./client";
export type { GraphMailboxInfo, GraphMessage } from "./client";
export { loadMsgraphConfig } from "./config";
export type { MsgraphConfig } from "./config";
export { constantTimeCompare } from "./constant-time-compare";
```

Note: `__setTokenManagerForTests` is intentionally NOT exported. TokenManager and parseRetryAfter are internal.

- [ ] **Step 6: Run the full test suite to confirm nothing regressed**

```bash
cd full-kit && pnpm test
```

Expected: PASS, all ~30 tests across all files.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/lib/msgraph/client.ts full-kit/src/lib/msgraph/client.test.ts full-kit/src/lib/msgraph/index.ts
git commit -m "feat(msgraph): graphFetch with retry/401 handling + helpers"
```

---

## Task 8: Implement the test API route

**Files:**
- Create: `full-kit/src/app/api/integrations/msgraph/test/route.ts`

This is the decisive slice. No unit tests — this IS the integration test. It will be exercised manually in Task 9 against the real Graph API.

- [ ] **Step 1: Create the route file**

Create `full-kit/src/app/api/integrations/msgraph/test/route.ts`:

```ts
import { NextResponse } from "next/server";

import {
  constantTimeCompare,
  getMailboxInfo,
  GraphError,
  listRecentMessages,
  loadMsgraphConfig,
} from "@/lib/msgraph";

export const dynamic = "force-dynamic"; // never cache this

export async function GET(request: Request): Promise<Response> {
  // 1. Kill switch. Evaluated FIRST, before anything else.
  //    404 — indistinguishable from a route that doesn't exist.
  let config;
  try {
    config = loadMsgraphConfig();
  } catch (err) {
    // If env vars are missing in prod, don't leak that fact via a 500.
    // Fall through to 404 as if the route isn't deployed.
    return new NextResponse(null, { status: 404 });
  }
  if (!config.testRouteEnabled) {
    return new NextResponse(null, { status: 404 });
  }

  // 2. Auth gate — shared-secret header, constant-time comparison.
  const provided = request.headers.get("x-admin-token");
  if (!provided || !constantTimeCompare(provided, config.testAdminToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  // 3. Do the two Graph calls in order.
  try {
    const mailbox = await getMailboxInfo(config.targetUpn);
    const messagesRaw = await listRecentMessages(config.targetUpn, 10);

    const recentMessages = messagesRaw.map((m) => ({
      id: m.id,
      subject: m.subject,
      from: m.from?.emailAddress
        ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>`
        : null,
      receivedAt: m.receivedDateTime,
    }));

    return NextResponse.json({
      ok: true,
      mailbox: {
        displayName: mailbox.displayName,
        totalItemCount: mailbox.totalItemCount,
        unreadItemCount: mailbox.unreadItemCount,
      },
      recentMessages,
    });
  } catch (err) {
    if (err instanceof GraphError) {
      return NextResponse.json(
        {
          ok: false,
          status: err.status,
          code: err.code,
          path: err.path,
          message: err.message,
        },
        { status: err.status >= 400 && err.status < 600 ? err.status : 500 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "unexpected", message: String(err) },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Run the unit-test suite to confirm no regressions**

```bash
cd full-kit && pnpm test
```

Expected: all tests still pass.

- [ ] **Step 3: Run the type-checker / build to catch any TS errors**

```bash
cd full-kit && pnpm build
```

Expected: build succeeds with no TypeScript errors. (If this takes too long in dev, `pnpm exec tsc --noEmit` is an acceptable faster alternative.)

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git add full-kit/src/app/api/integrations/msgraph/test/route.ts
git commit -m "feat(msgraph): gated test endpoint for Graph smoke check"
```

---

## Task 9: Manual end-to-end verification against live Graph

This task is executed by the developer at the terminal — there is no code to write or commit.

- [ ] **Step 1: Populate `full-kit/.env.local` with the real MSGRAPH values**

Open `full-kit/.env.local` (create if missing — it's gitignored) and add:

```
MSGRAPH_TENANT_ID=<real tenant GUID from Dereck>
MSGRAPH_CLIENT_ID=<real client GUID from Dereck>
MSGRAPH_CLIENT_SECRET=<real client secret from Dereck>
MSGRAPH_TARGET_UPN=<matt's UPN>
MSGRAPH_TEST_ADMIN_TOKEN=<a random 32+ char string; generate with `openssl rand -hex 32`>
MSGRAPH_TEST_ROUTE_ENABLED=true
```

**Never commit this file.** Verify with `git status` that `.env.local` does not appear as an untracked/modified file.

- [ ] **Step 2: Start the dev server**

```bash
cd full-kit && pnpm dev
```

Expected: Next.js starts without errors. Keep this running; open a second terminal for the remaining steps.

- [ ] **Step 3: Verify the kill-switch path**

In `full-kit/.env.local`, temporarily change `MSGRAPH_TEST_ROUTE_ENABLED=true` to `MSGRAPH_TEST_ROUTE_ENABLED=false`. Restart `pnpm dev`. Then:

```bash
curl -i http://localhost:3000/api/integrations/msgraph/test
```

Expected: `HTTP/1.1 404 Not Found`, empty body. (Indistinguishable from a route that isn't deployed.)

Restore `MSGRAPH_TEST_ROUTE_ENABLED=true` and restart `pnpm dev` before proceeding.

- [ ] **Step 4: Verify the auth gate**

```bash
curl -i http://localhost:3000/api/integrations/msgraph/test
```

Expected: `HTTP/1.1 401 Unauthorized`, body `{"ok":false,"error":"unauthorized"}`.

With a wrong token:
```bash
curl -i -H "x-admin-token: wrong" http://localhost:3000/api/integrations/msgraph/test
```

Expected: same `401`.

- [ ] **Step 5: THE DECISIVE TEST — real mailbox round trip**

```bash
curl -i -H "x-admin-token: <your-real-MSGRAPH_TEST_ADMIN_TOKEN>" \
  http://localhost:3000/api/integrations/msgraph/test
```

Expected: `HTTP/1.1 200 OK`, JSON body of the shape:

```json
{
  "ok": true,
  "mailbox": {
    "displayName": "Inbox",
    "totalItemCount": <some number>,
    "unreadItemCount": <some number>
  },
  "recentMessages": [
    { "id": "...", "subject": "...", "from": "...", "receivedAt": "2026-..." },
    ... (up to 10 items)
  ]
}
```

If this passes: **end-to-end plumbing is proven.** Tenant, app registration, secret, admin consent, Application Access Policy, network path, token exchange, Graph API call, response parsing — all working.

If it fails, the response body tells you which layer. Common cases:
- `{ ok: false, status: 401, code: "invalid_client", ... }` → client secret is wrong.
- `{ ok: false, status: 403, code: "Authorization_RequestDenied", ... }` → permissions missing on the app registration, or admin consent not granted, or Application Access Policy excludes Matt's mailbox. This is a message-back-to-Dereck condition.
- `{ ok: false, status: 404, code: "ResourceNotFound", ... }` → `MSGRAPH_TARGET_UPN` is wrong.

- [ ] **Step 6: Failure-mode sanity checks (optional but recommended)**

In `full-kit/.env.local`, set `MSGRAPH_CLIENT_SECRET=garbage`. Restart `pnpm dev`. Repeat the curl from Step 5. Expect a clear non-2xx body mentioning `invalid_client` or similar. Restore the real secret.

Set `MSGRAPH_TARGET_UPN=doesnotexist@example.com`. Restart `pnpm dev`. Repeat the curl. Expect `404` with `ResourceNotFound`. Restore Matt's real UPN.

- [ ] **Step 7: Update the open-items list**

Check the assumptions from the spec against what you saw:

- Application permissions (not Delegated)? → confirmed if Step 5 succeeded without any consent URL flow.
- Admin consent granted? → confirmed if Step 5 succeeded.
- Application Access Policy scopes to Matt only? → **cannot confirm from these tests alone.** Requires asking Dereck or testing with a non-Matt UPN (which you should NOT do without IT approval). Track as an open item.
- No IP allowlisting blocking Vercel? → not tested yet; will be verified when the app is deployed to Vercel. Track as open item.

When Dereck's follow-up reply arrives, cross-check it against the five assumption bullets in the spec. If any diverge from what we assumed, open a new spec to address the divergence before building the next layer.

- [ ] **Step 8: Final commit — mark the slice complete**

No code changes, but commit any stray `.env.example` tweaks or doc updates made during verification. If nothing needs committing, this step is a no-op and you're done.

```bash
cd "C:/Users/Zach Reichert/Documents/Matt-Robertsons-Agent-Build"
git status
```

Expected: clean tree (except `.env.local`, which is gitignored).

---

## What's next (after this plan is complete)

The spec's open-items list governs the follow-up work. In priority order:

1. **Email ingestion spec** — turn a Graph message payload into a `Communication` row + contact resolution. Consumes `graphFetch` and `listRecentMessages` from this slice.
2. **Contact seeding spec** — one-time import of Matt's Outlook contacts using `Contacts.Read`.
3. **Vault markdown mirror spec** — writes `vault/communications/*.md` files alongside DB rows.
4. **Historical backfill spec** — volume-aware sweep of existing inbox.
5. **Ongoing sync spec** — Graph webhooks vs. delta-query cron.
6. **Credential encryption spec** — move `MSGRAPH_CLIENT_SECRET` from `.env.local` into `IntegrationCredential` with app-layer encryption.
7. **Calendar writes spec** — uses `Calendars.ReadWrite` for auto-event creation.

Each gets its own brainstorming → spec → plan cycle.
