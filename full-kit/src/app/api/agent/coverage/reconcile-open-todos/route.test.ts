import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ReconciliationInputError,
  reconcileOpenTodosFromOutbound,
} from "@/lib/ai/outbound-todo-reconciliation"
import { getSession } from "@/lib/auth"

import { POST } from "./route"

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }))

vi.mock("@/lib/ai/outbound-todo-reconciliation", () => ({
  ReconciliationInputError: class ReconciliationInputError extends Error {
    status = 400
  },
  reconcileOpenTodosFromOutbound: vi.fn(),
}))

describe("reconcile open todos route", () => {
  beforeEach(() => {
    delete process.env.AGENT_ACTION_REVIEWER_EMAILS
    delete process.env.AGENT_ACTION_REVIEWER_IDS
    vi.mocked(getSession).mockReset()
    vi.mocked(reconcileOpenTodosFromOutbound).mockReset()
  })

  it("requires a configured reviewer", async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await POST(request({ mode: "dry-run", limit: 1 }))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "unauthorized" })
    expect(reconcileOpenTodosFromOutbound).not.toHaveBeenCalled()
  })

  it("rejects cross-origin and non-JSON requests", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const crossOrigin = await POST(
      request({ mode: "dry-run", limit: 1 }, { origin: "https://evil.test" })
    )
    expect(crossOrigin.status).toBe(403)

    const nonJson = await POST(request("{}", { contentType: "text/plain" }))
    expect(nonJson.status).toBe(415)
    expect(reconcileOpenTodosFromOutbound).not.toHaveBeenCalled()
  })

  it("rejects unknown keys and write mode without runId", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const unknownKey = await POST(
      request({ mode: "dry-run", limit: 1, surprise: true })
    )
    expect(unknownKey.status).toBe(400)
    expect(reconcileOpenTodosFromOutbound).not.toHaveBeenCalled()

    vi.mocked(reconcileOpenTodosFromOutbound).mockRejectedValue(
      new ReconciliationInputError("runId is required for write mode")
    )
    const missingRun = await POST(request({ mode: "write", limit: 1 }))
    expect(missingRun.status).toBe(400)
  })

  it("runs dry-run and write payloads for reviewers", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(reconcileOpenTodosFromOutbound).mockResolvedValue({
      mode: "dry-run",
      runId: null,
      scannedCommunications: 1,
      candidateCount: 1,
      createdActionCount: 0,
      duplicateSuppressedCount: 0,
      nextCursor: null,
      samples: [],
    })

    const response = await POST(request({ mode: "dry-run", limit: 1 }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, candidateCount: 1 })
    expect(reconcileOpenTodosFromOutbound).toHaveBeenCalledWith({
      mode: "dry-run",
      limit: 1,
    })
  })

  it("rejects authenticated non-reviewers with 403", async () => {
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(request({ mode: "dry-run", limit: 1 }))

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "forbidden" })
    expect(reconcileOpenTodosFromOutbound).not.toHaveBeenCalled()
  })

  it("forwards write-mode payloads with runId/limit/cursor pass-through", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(reconcileOpenTodosFromOutbound).mockResolvedValue({
      mode: "write",
      runId: "run-1",
      scannedCommunications: 1,
      candidateCount: 1,
      createdActionCount: 1,
      duplicateSuppressedCount: 0,
      nextCursor: null,
      samples: [],
    })

    const response = await POST(
      request({ mode: "write", runId: "run-1", limit: 1, cursor: "abc" })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      mode: "write",
      runId: "run-1",
      createdActionCount: 1,
    })
    expect(reconcileOpenTodosFromOutbound).toHaveBeenCalledWith({
      mode: "write",
      runId: "run-1",
      limit: 1,
      cursor: "abc",
    })
  })

  it("returns 400 when the service rejects an over-limit batch", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(reconcileOpenTodosFromOutbound).mockRejectedValue(
      new ReconciliationInputError("limit must be <= 25")
    )

    const response = await POST(
      request({ mode: "write", runId: "run-1", limit: 26 })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("limit"),
    })
  })

  it("returns 400 when the service requires a prior dry run for write mode", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())
    vi.mocked(reconcileOpenTodosFromOutbound).mockRejectedValue(
      new ReconciliationInputError("dry run required before write")
    )

    const response = await POST(
      request({ mode: "write", runId: "run-1", limit: 1 })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "dry run required before write",
    })
  })

  it("rejects payloads missing required mode field", async () => {
    process.env.AGENT_ACTION_REVIEWER_EMAILS = "zach@example.com"
    vi.mocked(getSession).mockResolvedValue(session())

    const response = await POST(request({ limit: 1 }))

    expect(response.status).toBe(400)
    expect(reconcileOpenTodosFromOutbound).not.toHaveBeenCalled()
  })
})

function request(
  body: Record<string, unknown> | string,
  options: { origin?: string | null; contentType?: string } = {}
): Request {
  const headers = new Headers()
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? "https://example.test")
  }
  headers.set("content-type", options.contentType ?? "application/json")
  return new Request(
    "https://example.test/api/agent/coverage/reconcile-open-todos",
    {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers,
    }
  )
}

function session() {
  return {
    user: {
      id: "user-1",
      name: "Zach Reviewer",
      email: "zach@example.com",
      avatar: null,
      status: "ONLINE",
    },
    expires: "2026-05-27T00:00:00Z",
  }
}
