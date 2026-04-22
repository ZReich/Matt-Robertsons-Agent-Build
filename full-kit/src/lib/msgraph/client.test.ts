import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

    await expect(mod.graphFetch("/users/x")).rejects.toMatchObject({
      name: "GraphError",
      status: 403,
      code: "Authorization_RequestDenied",
    });
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
