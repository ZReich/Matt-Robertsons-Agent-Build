import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getRecordingDetail,
  listRecordings,
  loginWithPassword,
  parseAiContent,
  PlaudApiError,
} from "./client"

let originalFetch: typeof fetch
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  originalFetch = global.fetch
  fetchMock = vi.fn()
  global.fetch = fetchMock as unknown as typeof fetch
})
afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

describe("listRecordings", () => {
  it("sends bearer auth, query params, and parses recording shape", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data_file_list: [
          {
            id: "rec-1",
            filename: "Call with Bob",
            filesize: 12345,
            duration: 600000, // ms
            start_time: 1714435200000,
            end_time: 1714435800000,
            is_trans: 1,
            is_summary: 1,
            filetag_id_list: ["tag-A"],
            keywords: ["acme"],
            is_trash: 0,
          },
        ],
      })
    )
    const result = await listRecordings({
      token: "tok-123",
      region: "us",
      skip: 0,
      limit: 50,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(
      /^https:\/\/api\.plaud\.ai\/file\/simple\/web\?.*sort_by=start_time/
    )
    expect((init as RequestInit).method).toBe("GET")
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-123"
    )
    expect(result.items[0].id).toBe("rec-1")
    expect(result.items[0].durationSeconds).toBe(600)
    expect(result.items[0].startTime.getTime()).toBe(1714435200000)
    expect(result.items[0].isTranscribed).toBe(true)
    expect(result.items[0].tagIds).toEqual(["tag-A"])
  })

  it("filters out trashed recordings client-side as a defense-in-depth", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data_file_list: [
          {
            id: "rec-keep",
            filename: "x",
            filesize: 1,
            duration: 1000,
            start_time: 0,
            end_time: 0,
            is_trans: 1,
            is_summary: 0,
            filetag_id_list: [],
            keywords: [],
            is_trash: 0,
          },
          {
            id: "rec-trash",
            filename: "y",
            filesize: 1,
            duration: 1000,
            start_time: 0,
            end_time: 0,
            is_trans: 1,
            is_summary: 0,
            filetag_id_list: [],
            keywords: [],
            is_trash: 1,
          },
        ],
      })
    )
    const result = await listRecordings({ token: "t", region: "us" })
    expect(result.items.map((r) => r.id)).toEqual(["rec-keep"])
  })

  it("retries on 429 with exponential backoff", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ data_file_list: [] }))
    const result = await listRecordings({
      token: "t",
      region: "us",
      retryDelayMs: 1,
    })
    expect(result.items).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("retries on 5xx", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ data_file_list: [] }))
    const result = await listRecordings({
      token: "t",
      region: "us",
      retryDelayMs: 1,
    })
    expect(result.items).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("throws PlaudApiError with status 401 on unauth", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 401, msg: "unauthorized" }, { status: 401 })
    )
    const err = await listRecordings({ token: "t", region: "us" }).catch(
      (e) => e
    )
    expect(err).toBeInstanceOf(PlaudApiError)
    expect((err as PlaudApiError).status).toBe(401)
  })

  it("retries against the redirected region on -302 and retains the redirect base for the rest of the call", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          status: -302,
          data: { domains: { api: "api-euc1.plaud.ai" } },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ data_file_list: [] }))
    const result = await listRecordings({
      token: "t",
      region: "us",
      retryDelayMs: 1,
    })
    expect(result.items).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toMatch(/api-euc1\.plaud\.ai/)
  })

  it("gives up after maxRetries", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 429 }))
    const err = await listRecordings({
      token: "t",
      region: "us",
      retryDelayMs: 1,
      maxRetries: 2,
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect(fetchMock.mock.calls.length).toBe(3) // initial + 2 retries
  })
})

describe("getRecordingDetail", () => {
  it("POSTs /file/list with [id] and maps trans_result to typed turns", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data_file_list: [
          {
            id: "rec-1",
            trans_result: [
              {
                speaker: "Alice",
                content: "Good morning.",
                start_time: 0,
                end_time: 3000,
              },
              {
                speaker: "Bob",
                content: "Morning.",
                start_time: 3100,
                end_time: 6000,
              },
            ],
            ai_content: '{"markdown":"## Summary"}',
            summary_list: [],
          },
        ],
      })
    )
    const t = await getRecordingDetail({
      token: "tok",
      region: "us",
      recordingId: "rec-1",
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.plaud.ai/file/list")
    expect((init as RequestInit).method).toBe("POST")
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(["rec-1"])
    expect(t.recordingId).toBe("rec-1")
    expect(t.turns).toHaveLength(2)
    expect(t.turns[0]).toEqual({
      speaker: "Alice",
      content: "Good morning.",
      startMs: 0,
      endMs: 3000,
    })
    expect(t.aiContentRaw).toBe('{"markdown":"## Summary"}')
  })

  it("throws PlaudApiError 404 when /file/list returns empty", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data_file_list: [] })
    )
    const err = await getRecordingDetail({
      token: "t",
      region: "us",
      recordingId: "missing",
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect((err as PlaudApiError).status).toBe(404)
  })

  it("treats missing trans_result as empty turns", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data_file_list: [{ id: "r", ai_content: null, summary_list: [] }],
      })
    )
    const t = await getRecordingDetail({
      token: "t",
      region: "us",
      recordingId: "r",
    })
    expect(t.turns).toEqual([])
    expect(t.aiContentRaw).toBeNull()
  })
})

describe("loginWithPassword", () => {
  it("POSTs form-urlencoded with username field and parses JWT-decoded expiry", async () => {
    // JWT with exp = 2000000000 (year 2033-05-18) — secs not ms.
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      Buffer.from(JSON.stringify({ iat: 1700000000, exp: 2000000000 }))
        .toString("base64url")
        .replace(/=+$/, "") +
      ".sig"
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 0,
        msg: "ok",
        access_token: jwt,
        token_type: "Bearer",
      })
    )
    const result = await loginWithPassword({
      email: "matt@example.com",
      password: "hunter2",
      region: "us",
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.plaud.ai/auth/access-token")
    expect((init as RequestInit).method).toBe("POST")
    expect(
      ((init as RequestInit).headers as Record<string, string>)["Content-Type"]
    ).toBe("application/x-www-form-urlencoded")
    const body = (init as RequestInit).body as string
    const params = new URLSearchParams(body)
    expect(params.get("username")).toBe("matt@example.com")
    expect(params.get("password")).toBe("hunter2")
    expect(result.accessToken).toBe(jwt)
    expect(result.expiresAt.getTime()).toBe(2000000000 * 1000)
  })

  it("throws on status !== 0 even with HTTP 200", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: -1, msg: "bad credentials" })
    )
    const err = await loginWithPassword({
      email: "x",
      password: "y",
      region: "us",
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect((err as PlaudApiError).message).toMatch(/bad credentials/)
  })

  it("does NOT retry on 401 (bad credentials are not transient)", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }))
    const err = await loginWithPassword({
      email: "x",
      password: "y",
      region: "us",
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("uses the eu region base URL", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 0,
        msg: "ok",
        access_token:
          "x." +
          Buffer.from(JSON.stringify({ iat: 0, exp: 2000000000 }))
            .toString("base64url")
            .replace(/=+$/, "") +
          ".y",
        token_type: "Bearer",
      })
    )
    await loginWithPassword({
      email: "matt@example.com",
      password: "hunter2",
      region: "eu",
    })
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api-euc1.plaud.ai/auth/access-token"
    )
  })

  it("throws when access_token is missing even if status === 0", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 0, msg: "ok", token_type: "Bearer" })
    )
    const err = await loginWithPassword({
      email: "x",
      password: "y",
      region: "us",
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect((err as PlaudApiError).message).toMatch(/access_token/)
  })

  it("throws when JWT cannot be decoded", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 0,
        msg: "ok",
        access_token: "not-a-jwt",
        token_type: "Bearer",
      })
    )
    const err = await loginWithPassword({
      email: "x",
      password: "y",
      region: "us",
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect((err as PlaudApiError).message).toMatch(/JWT/i)
  })
})

describe("parseAiContent", () => {
  it("returns plain markdown unchanged", () => {
    expect(parseAiContent("## Hello")).toBe("## Hello")
  })

  it("extracts markdown from {markdown}", () => {
    expect(parseAiContent('{"markdown":"## h"}')).toBe("## h")
  })

  it("extracts content.markdown when present", () => {
    expect(parseAiContent('{"content":{"markdown":"## c"}}')).toBe("## c")
  })

  it("extracts summary when present", () => {
    expect(parseAiContent('{"summary":"plain"}')).toBe("plain")
  })

  it("returns the input unchanged when JSON parse fails", () => {
    expect(parseAiContent('{not json')).toBe('{not json')
  })

  it("returns empty string for null/empty", () => {
    expect(parseAiContent(null)).toBe("")
    expect(parseAiContent("")).toBe("")
  })
})

describe("PlaudApiError does not leak credentials in messages", () => {
  it("login error does not echo password", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: -1, msg: "auth failed" })
    )
    let caught: unknown
    try {
      await loginWithPassword({
        email: "x",
        password: "VERY-SECRET-PASSWORD",
        region: "us",
      })
    } catch (e) {
      caught = e
    }
    expect((caught as Error).message).not.toContain("VERY-SECRET-PASSWORD")
  })

  it("list error does not echo bearer token", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }))
    let caught: unknown
    try {
      await listRecordings({ token: "VERY-SECRET-BEARER-TOK", region: "us" })
    } catch (e) {
      caught = e
    }
    expect((caught as Error).message).not.toContain("VERY-SECRET-BEARER-TOK")
  })

  it("redacts upstream msg that echoes a Bearer token shape", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          msg: "Authorization: Bearer leaked.jwt.token-from-an-evil-mirror",
        },
        { status: 400 }
      )
    )
    const err = await listRecordings({ token: "t", region: "us" }).catch(
      (e) => e
    )
    expect((err as Error).message).toContain("<redacted")
    expect((err as Error).message).not.toContain("leaked.jwt.token")
  })

  it("redacts upstream msg that echoes password=", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { msg: "rejected: password=hunter2 invalid" },
        { status: 400 }
      )
    )
    const err = await listRecordings({ token: "t", region: "us" }).catch(
      (e) => e
    )
    expect((err as Error).message).toContain("<redacted")
    expect((err as Error).message).not.toContain("hunter2")
  })

  it("caps oversized upstream msg", async () => {
    const huge = "X".repeat(5000)
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ msg: huge }, { status: 400 })
    )
    const err = await listRecordings({ token: "t", region: "us" }).catch(
      (e) => e
    )
    // message includes prefix + truncated body + ellipsis
    expect((err as Error).message.length).toBeLessThan(400)
  })
})

describe("region redirect hardening", () => {
  it("rejects -302 with missing domains.api", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: -302, data: {} })
    )
    const err = await listRecordings({
      token: "t",
      region: "us",
      retryDelayMs: 1,
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect((err as PlaudApiError).status).toBe(-302)
  })

  it("rejects -302 redirect to a non-allowlisted host", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: -302,
        data: { domains: { api: "evil.com" } },
      })
    )
    const err = await listRecordings({
      token: "t",
      region: "us",
      retryDelayMs: 1,
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect((err as Error).message).toMatch(/allowlist/)
  })

  it("rejects -302 redirect to the same host (loop)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: -302,
        data: { domains: { api: "api.plaud.ai" } },
      })
    )
    const err = await listRecordings({
      token: "t",
      region: "us",
      retryDelayMs: 1,
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect((err as Error).message).toMatch(/loop/)
  })

  it("strips protocol from redirect host before allowlist check", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          status: -302,
          data: { domains: { api: "https://api-euc1.plaud.ai" } },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ data_file_list: [] }))
    const result = await listRecordings({
      token: "t",
      region: "us",
      retryDelayMs: 1,
    })
    expect(result.items).toEqual([])
  })

  it("region redirect counts toward retry budget (no infinite ping-pong)", async () => {
    // Each call must return a fresh Response — bodies are read-once. A real
    // upstream that flips us→eu and then eu→us would still get caught by
    // either the same-host loop check or the retry budget.
    fetchMock.mockImplementation(() => {
      // Always redirect to the OPPOSITE of the current request host so we
      // ping-pong; the retry budget should bail.
      return Promise.resolve(
        jsonResponse({
          status: -302,
          data: { domains: { api: "api-euc1.plaud.ai" } },
        })
      )
    })
    const err = await listRecordings({
      token: "t",
      region: "us",
      retryDelayMs: 1,
      maxRetries: 2,
    }).catch((e) => e)
    // Either loop-detection or retry-budget bails — both are PlaudApiError.
    expect(err).toBeInstanceOf(PlaudApiError)
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4)
  })
})

describe("recording shape validation", () => {
  it("drops recordings without a string id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data_file_list: [
          { id: 123, filename: "no-string-id" },
          { filename: "missing-id" },
          {
            id: "good",
            filename: "good",
            duration: 1000,
            start_time: 0,
            end_time: 1000,
            is_trans: 1,
            is_summary: 0,
            filetag_id_list: [],
            keywords: [],
          },
        ],
      })
    )
    const result = await listRecordings({ token: "t", region: "us" })
    expect(result.items.map((r) => r.id)).toEqual(["good"])
  })

  it("treats data_file_list of wrong type as empty", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data_file_list: "oops" }))
    const result = await listRecordings({ token: "t", region: "us" })
    expect(result.items).toEqual([])
  })

  it("maps endTime when present", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data_file_list: [
          {
            id: "r",
            duration: 1000,
            start_time: 1000,
            end_time: 2000,
            is_trans: 0,
            is_summary: 0,
            filetag_id_list: [],
            keywords: [],
          },
        ],
      })
    )
    const result = await listRecordings({ token: "t", region: "us" })
    expect(result.items[0].endTime?.getTime()).toBe(2000)
  })

  it("getRecordingDetail handles non-array trans_result", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data_file_list: [{ id: "r", trans_result: "garbage", ai_content: null }],
      })
    )
    const t = await getRecordingDetail({
      token: "t",
      region: "us",
      recordingId: "r",
    })
    expect(t.turns).toEqual([])
  })
})

describe("login behavior", () => {
  it("does NOT include Authorization header on the login request", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 0,
        msg: "ok",
        access_token:
          "x." +
          Buffer.from(JSON.stringify({ iat: 0, exp: 2000000000 }))
            .toString("base64url")
            .replace(/=+$/, "") +
          ".y",
        token_type: "Bearer",
      })
    )
    await loginWithPassword({
      email: "matt@example.com",
      password: "hunter2",
      region: "us",
    })
    const headers = (fetchMock.mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it("rejects JWT with exp in the past", async () => {
    const expired =
      "x." +
      Buffer.from(JSON.stringify({ iat: 0, exp: 1 }))
        .toString("base64url")
        .replace(/=+$/, "") +
      ".y"
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 0,
        msg: "ok",
        access_token: expired,
        token_type: "Bearer",
      })
    )
    const err = await loginWithPassword({
      email: "x",
      password: "y",
      region: "us",
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect((err as Error).message).toMatch(/exp is in the past/)
  })

  it("rejects JWT with absurdly far-future exp", async () => {
    const farFuture =
      "x." +
      Buffer.from(
        JSON.stringify({ iat: 0, exp: Math.floor(Date.now() / 1000) + 100 * 365 * 86400 })
      )
        .toString("base64url")
        .replace(/=+$/, "") +
      ".y"
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 0,
        msg: "ok",
        access_token: farFuture,
        token_type: "Bearer",
      })
    )
    const err = await loginWithPassword({
      email: "x",
      password: "y",
      region: "us",
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect((err as Error).message).toMatch(/implausibly far/)
  })

  it("rejects oversized JWT payload", async () => {
    const huge =
      "x." +
      Buffer.from("X".repeat(8192)).toString("base64url").replace(/=+$/, "") +
      ".y"
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 0,
        msg: "ok",
        access_token: huge,
        token_type: "Bearer",
      })
    )
    const err = await loginWithPassword({
      email: "x",
      password: "y",
      region: "us",
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
    expect((err as Error).message).toMatch(/payload too large/)
  })
})

describe("non-JSON error responses", () => {
  it("falls back to truncated text body when error is HTML", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html><body>Cloudflare gateway timeout</body></html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      })
    )
    // 502 is retried — make all attempts return the same HTML to exhaust the budget.
    fetchMock.mockResolvedValue(
      new Response("<html><body>Cloudflare gateway timeout</body></html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      })
    )
    const err = await listRecordings({
      token: "t",
      region: "us",
      retryDelayMs: 1,
      maxRetries: 1,
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PlaudApiError)
  })
})

describe("parseAiContent edge cases", () => {
  it("ignores non-string markdown field", () => {
    expect(parseAiContent('{"markdown": 42}')).toBe('{"markdown": 42}')
  })

  it("ignores non-string content.markdown", () => {
    expect(parseAiContent('{"content": {"markdown": 42}}')).toBe(
      '{"content": {"markdown": 42}}'
    )
  })

  it("ignores non-string summary", () => {
    expect(parseAiContent('{"summary": [1,2,3]}')).toBe('{"summary": [1,2,3]}')
  })
})
