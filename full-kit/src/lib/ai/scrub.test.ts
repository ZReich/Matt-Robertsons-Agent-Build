import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ClaudeScrubResponse } from "./claude"
import type { ClaimedScrubQueueRow } from "./scrub-types"

import { db } from "@/lib/prisma"

import { scrubEmailBatch } from "./scrub"

/**
 * These tests exercise real control flow paths that the mock-heavy unit
 * tests miss: the ScrubApiCall outcome lifecycle on failure branches,
 * the fenced-out path, strict-mode partial-success vs relaxed, and the
 * caching-live warning. Each test sets up mocked Prisma methods narrowly
 * and drives scrubEmailBatch end-to-end.
 */

vi.mock("@/lib/prisma", () => ({
  db: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    communication: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    contact: { findMany: vi.fn() },
    deal: { findMany: vi.fn() },
    agentMemory: { findMany: vi.fn() },
    scrubQueue: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    scrubApiCall: {
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    agentAction: { create: vi.fn() },
    systemState: { findUnique: vi.fn(), delete: vi.fn() },
  },
}))

// Minimal helper: Prisma mock where $transaction just invokes its callback
// with the mocked `db` as the "tx". This lets us test real control flow
// through applier/queue without a real DB.
function configureBasicPrismaMock(
  claimedRows: Array<{ id: string; communicationId: string }>
) {
  ;(db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(db)
  )
  ;(db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue(
    claimedRows.map((r) => ({ id: r.id, communication_id: r.communicationId }))
  )
  ;(db.communication.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
    async ({ where: { id } }: { where: { id: string } }) => ({
      id,
      subject: `Subject ${id}`,
      body: `Body ${id}`,
      date: new Date("2026-04-24T10:00:00Z"),
      metadata: { classification: "signal" },
    })
  )
  ;(db.systemState.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
    null
  )
  ;(db.scrubApiCall.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
    _sum: { estimatedUsd: 0 },
  })
  ;(db.scrubApiCall.create as ReturnType<typeof vi.fn>).mockImplementation(
    async () => ({ id: `apicall-${Math.random()}` })
  )
  ;(db.scrubApiCall.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(db.scrubQueue.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([])
  // The heuristic linker + memory/thread loaders all call into Prisma.
  // Stub each out as empty-result so scrubOne proceeds to the Anthropic
  // call path under test.
  ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(db.deal.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(db.agentMemory.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(db.communication.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(db.scrubQueue.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
}

function validClaudeResponse(): ClaudeScrubResponse {
  return {
    toolInput: {
      summary: "Test summary.",
      topicTags: ["showing-scheduling"],
      urgency: "normal",
      replyRequired: false,
      sentiment: "neutral",
      linkedContactCandidates: [],
      linkedDealCandidates: [],
      suggestedActions: [],
    },
    modelUsed: "claude-haiku-4-5-20251001",
    usage: {
      tokensIn: 500,
      tokensOut: 100,
      cacheReadTokens: 3500,
      cacheWriteTokens: 0,
    },
  }
}

describe("scrubEmailBatch — real-path integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SCRUB_DAILY_BUDGET_USD
    delete process.env.SCRUB_STRICT_MODE
  })

  it("happy path: writes pending-validation ScrubApiCall BEFORE validation, then transitions to scrubbed", async () => {
    configureBasicPrismaMock([{ id: "q-1", communicationId: "c-1" }])
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    const scrubClient = vi.fn().mockResolvedValue(validClaudeResponse())

    const summary = await scrubEmailBatch({ scrubClient, mode: "relaxed" })

    // Sequence: insert pending-validation, then update to scrubbed.
    const createCalls = (db.scrubApiCall.create as ReturnType<typeof vi.fn>)
      .mock.calls
    const updateCalls = (db.scrubApiCall.update as ReturnType<typeof vi.fn>)
      .mock.calls
    expect(createCalls).toHaveLength(1)
    expect(createCalls[0]?.[0]?.data?.outcome).toBe("pending-validation")
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0]?.[0]?.data?.outcome).toBe("scrubbed")

    expect(summary.succeeded).toBe(1)
    expect(summary.failed).toBe(0)
  })

  it("validation-failed path: updates the pending-validation row's outcome so spend is correctly attributed", async () => {
    configureBasicPrismaMock([{ id: "q-1", communicationId: "c-1" }])
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    // Return a response whose toolInput lacks the required `summary` field
    // — triggers outer-shape validation failure, followed by a correction
    // retry that also fails.
    const bad = validClaudeResponse()
    ;(bad.toolInput as Record<string, unknown>).summary = undefined
    const scrubClient = vi.fn().mockResolvedValue(bad)

    const summary = await scrubEmailBatch({ scrubClient, mode: "strict" })

    // Two API calls logged (first + correction retry), and the LAST
    // outcome update lands as validation-failed — NOT orphaned as
    // pending-validation.
    const updateCalls = (db.scrubApiCall.update as ReturnType<typeof vi.fn>)
      .mock.calls
    const lastOutcome = updateCalls[updateCalls.length - 1]?.[0]?.data?.outcome
    expect(lastOutcome).toBe("validation-failed")

    expect(summary.succeeded).toBe(0)
    expect(summary.failed).toBe(1)
  })

  it("fenced-out path: counts spend exactly once (no duplicate ScrubApiCall rows) and does NOT write AgentActions", async () => {
    configureBasicPrismaMock([{ id: "q-1", communicationId: "c-1" }])
    // Applier's fence `updateMany` returns count=0 — another worker holds it.
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 0,
    })

    const scrubClient = vi.fn().mockResolvedValue(validClaudeResponse())

    const summary = await scrubEmailBatch({ scrubClient, mode: "relaxed" })

    // Exactly ONE ScrubApiCall row created (regression test for the
    // earlier bug where fenced-out path double-logged the call).
    expect(db.scrubApiCall.create).toHaveBeenCalledTimes(1)
    // Its final outcome reads "fenced-out" via the update path.
    const updateCalls = (db.scrubApiCall.update as ReturnType<typeof vi.fn>)
      .mock.calls
    expect(updateCalls[updateCalls.length - 1]?.[0]?.data?.outcome).toBe(
      "fenced-out"
    )
    // No Communication.update or AgentAction.create on the fenced-out path.
    expect(db.communication.update).not.toHaveBeenCalled()
    expect(db.agentAction.create).not.toHaveBeenCalled()

    expect(summary.succeeded).toBe(0)
    expect(summary.failed).toBe(1)
  })

  it("strict mode halts the batch after 5 consecutive validation failures", async () => {
    const rows: ClaimedScrubQueueRow[] = Array.from({ length: 10 }, (_, i) => ({
      id: `q-${i}`,
      communicationId: `c-${i}`,
      leaseToken: `t-${i}`,
    }))
    configureBasicPrismaMock(
      rows.map((r) => ({ id: r.id, communicationId: r.communicationId }))
    )
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    const bad = validClaudeResponse()
    ;(bad.toolInput as Record<string, unknown>).summary = undefined
    const scrubClient = vi.fn().mockResolvedValue(bad)

    const summary = await scrubEmailBatch({ scrubClient, mode: "strict" })

    // Strict-mode 5-consecutive halt: we stopped after 5 attempts, not 10.
    expect(summary.status).toBe("strict-consecutive-halt")
    expect(summary.failed).toBe(5)
    expect(summary.processed).toBe(10)
  })

  it("caching-not-live: marks the batch status when recent calls show cache_read_tokens=0", async () => {
    configureBasicPrismaMock([{ id: "q-1", communicationId: "c-1" }])
    ;(db.scrubQueue.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    })

    const uncachedResponse = validClaudeResponse()
    uncachedResponse.usage.cacheReadTokens = 0
    const scrubClient = vi.fn().mockResolvedValue(uncachedResponse)

    // After the scrub lands, isCachingLive() reads findMany of recent
    // "scrubbed" calls. Return 5 calls all with cacheReadTokens=0 to
    // simulate a silently-not-caching prompt.
    ;(db.scrubApiCall.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { cacheReadTokens: 0 },
      { cacheReadTokens: 0 },
      { cacheReadTokens: 0 },
      { cacheReadTokens: 0 },
      { cacheReadTokens: 0 },
    ])

    const summary = await scrubEmailBatch({ scrubClient, mode: "relaxed" })
    expect(summary.status).toBe("caching-not-live")
    expect(summary.cachingLive).toBe(false)
  })
})
