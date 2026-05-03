import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { processBacklogClosedDeals } from "@/lib/ai/lease-pipeline-orchestrator"

import { GET, POST } from "./route"

vi.mock("@/lib/ai/lease-pipeline-orchestrator", () => ({
  processBacklogClosedDeals: vi.fn(async () => ({
    processed: 3,
    leaseRecordsCreated: 1,
    errors: [],
    stoppedReason: "complete",
    cursor: null,
  })),
}))

const VALID_TOKEN = "test-admin-token-abc"

function makeRequest(body: unknown, token?: string): Request {
  return new Request(
    "https://example.test/api/lease/process-backlog",
    {
      method: "POST",
      headers: token ? { "x-admin-token": token } : {},
      body: JSON.stringify(body),
    }
  )
}

describe("POST /api/lease/process-backlog", () => {
  beforeEach(() => {
    process.env.MSGRAPH_TEST_ADMIN_TOKEN = VALID_TOKEN
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.MSGRAPH_TEST_ADMIN_TOKEN
  })

  it("happy path — calls orchestrator with body opts and returns result", async () => {
    const response = await POST(
      makeRequest({ batchSize: 20, throttleMs: 100, maxBatches: 5 }, VALID_TOKEN)
    )

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toMatchObject({
      ok: true,
      processed: 3,
      leaseRecordsCreated: 1,
      stoppedReason: "complete",
    })
    expect(processBacklogClosedDeals).toHaveBeenCalledWith({
      batchSize: 20,
      throttleMs: 100,
      maxBatches: 5,
      cursorKey: undefined,
    })
  })

  it("uses defaults when body is empty or omits numeric fields", async () => {
    const response = await POST(makeRequest({}, VALID_TOKEN))

    expect(response.status).toBe(200)
    expect(processBacklogClosedDeals).toHaveBeenCalledWith({
      batchSize: 50,
      throttleMs: 250,
      maxBatches: 10,
      cursorKey: undefined,
    })
  })

  it("passes cursorKey through when provided as a string", async () => {
    const response = await POST(
      makeRequest({ cursorKey: "my-custom-key" }, VALID_TOKEN)
    )

    expect(response.status).toBe(200)
    expect(processBacklogClosedDeals).toHaveBeenCalledWith(
      expect.objectContaining({ cursorKey: "my-custom-key" })
    )
  })

  it("returns 401 when x-admin-token is missing", async () => {
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json).toMatchObject({ ok: false, reason: "unauthorized" })
    expect(processBacklogClosedDeals).not.toHaveBeenCalled()
  })

  it("returns 401 when x-admin-token is wrong", async () => {
    const response = await POST(makeRequest({}, "wrong-token"))

    expect(response.status).toBe(401)
    expect(processBacklogClosedDeals).not.toHaveBeenCalled()
  })

  it("returns 401 when MSGRAPH_TEST_ADMIN_TOKEN env var is not set", async () => {
    delete process.env.MSGRAPH_TEST_ADMIN_TOKEN

    const response = await POST(makeRequest({}, VALID_TOKEN))

    expect(response.status).toBe(401)
    expect(processBacklogClosedDeals).not.toHaveBeenCalled()
  })

  it("handles invalid JSON body gracefully (treats as empty opts)", async () => {
    const response = await POST(
      new Request("https://example.test/api/lease/process-backlog", {
        method: "POST",
        headers: { "x-admin-token": VALID_TOKEN, "content-type": "text/plain" },
        body: "not-json",
      })
    )

    // Body parse failure falls back to {} so defaults apply — still 200
    expect(response.status).toBe(200)
    expect(processBacklogClosedDeals).toHaveBeenCalledWith({
      batchSize: 50,
      throttleMs: 250,
      maxBatches: 10,
      cursorKey: undefined,
    })
  })
})

describe("GET /api/lease/process-backlog", () => {
  it("returns 405", async () => {
    const response = await GET()
    expect(response.status).toBe(405)
  })
})
