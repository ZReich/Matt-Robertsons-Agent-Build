import { beforeEach, describe, expect, it, vi } from "vitest"

import type { HistoryBackfillCursorState } from "./email-history-backfill"
import type { GraphEmailMessage } from "./email-types"

import {
  enumerateMonthsDescending,
  runEmailHistoryBackfill,
} from "./email-history-backfill"

vi.mock("./config", () => ({
  loadMsgraphConfig: vi.fn(() => ({
    tenantId: "t",
    clientId: "c",
    clientSecret: "s",
    targetUpn: "matt@example.com",
    testAdminToken: "x".repeat(32),
    testRouteEnabled: true,
  })),
}))

// We don't want the real graphFetch / processOneMessage / db — we're testing
// the orchestration. All deps are passed via the fetchImpl/processOneMessageImpl/
// cursorIO seams.
vi.mock("./client", () => ({
  graphFetch: vi.fn(),
}))
vi.mock("./emails", () => ({
  EMAIL_METADATA_SELECT_FIELDS: "id,internetMessageId,receivedDateTime",
  processOneMessage: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  db: {
    systemState: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessage(id: string, isoDate: string): GraphEmailMessage {
  return {
    id,
    receivedDateTime: isoDate,
  } as unknown as GraphEmailMessage
}

interface InMemoryCursor {
  state: HistoryBackfillCursorState | null
}

function makeCursorIO(initial: HistoryBackfillCursorState | null = null) {
  const ref: InMemoryCursor = { state: initial }
  return {
    ref,
    cursorIO: {
      load: vi.fn(async () => ref.state),
      save: vi.fn(async (_folder, next) => {
        ref.state = { ...next }
      }),
    },
  }
}

function makeProcessOneMessageImpl(opts: { insertEvery?: number } = {}) {
  const { insertEvery = 1 } = opts
  let n = 0
  return vi.fn(async () => {
    n += 1
    return {
      classification: "noise" as const,
      extractedPlatform: null,
      contactCreated: false,
      leadCreated: false,
      inserted: insertEvery > 0 && n % insertEvery === 0,
    }
  })
}

interface ScriptedPage {
  monthFilter: string // substring expected to appear in URL
  value: GraphEmailMessage[]
  nextLink?: string
}

/**
 * Build a fetchImpl that hands out scripted pages keyed by the
 * lower-bound ISO date of the filter (e.g. "2025-03-01" for the
 * filter-clause `receivedDateTime ge 2025-03-01...`).
 *
 * We match on `ge%20<key>` (URL-encoded space + key) because the
 * upper-bound also contains an ISO month-start substring; only the
 * `ge` clause uniquely identifies which month we're scanning.
 */
function makeScriptedFetch(scripts: Record<string, ScriptedPage[]>) {
  const calls: string[] = []
  const cursorByMonth: Record<string, number> = {}
  const fetchImpl = vi.fn(async (url: string) => {
    calls.push(url)
    for (const [key, pages] of Object.entries(scripts)) {
      // Prefer the `ge` lower-bound match — that's unique per month.
      // Fall back to nextLink sentinel + `lt` upper bound only when
      // nothing else matches.
      const geNeedle = encodeURIComponent(`ge ${key}`)
      const ltNeedle = encodeURIComponent(`lt ${key}`)
      const matchesGe = url.includes(geNeedle) || url.includes(`ge%20${key}`)
      const matchesNextlink = url.includes(`__nextlink__${key}__`)
      if (matchesGe || matchesNextlink) {
        const idx = cursorByMonth[key] ?? 0
        const page = pages[idx]
        cursorByMonth[key] = idx + 1
        if (!page) {
          return { value: [] }
        }
        return {
          value: page.value,
          ...(page.nextLink ? { "@odata.nextLink": page.nextLink } : {}),
        }
      }
      // Suppress unused-binding warning while still keeping the alt-form
      // reference in case someone wants to extend the matcher later.
      void ltNeedle
    }
    return { value: [] }
  })
  return { fetchImpl, calls }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("enumerateMonthsDescending", () => {
  it("walks newest → oldest inclusive across a year boundary", () => {
    expect(enumerateMonthsDescending("2026-02", "2025-11")).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
    ])
  })

  it("returns a single element when start === end", () => {
    expect(enumerateMonthsDescending("2026-05", "2026-05")).toEqual(["2026-05"])
  })

  it("returns empty when start is older than end", () => {
    expect(enumerateMonthsDescending("2024-01", "2025-01")).toEqual([])
  })
})

describe("runEmailHistoryBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("processes every month from start → end with no prior cursor (boundary)", async () => {
    const { cursorIO, ref } = makeCursorIO(null)
    const { fetchImpl } = makeScriptedFetch({
      "2026-03-01": [
        {
          monthFilter: "2026-03-01",
          value: [makeMessage("a", "2026-03-15T00:00:00Z")],
        },
      ],
      "2026-02-01": [
        {
          monthFilter: "2026-02-01",
          value: [makeMessage("b", "2026-02-15T00:00:00Z")],
        },
      ],
      "2026-01-01": [
        {
          monthFilter: "2026-01-01",
          value: [makeMessage("c", "2026-01-15T00:00:00Z")],
        },
      ],
    })
    const processOneMessageImpl = makeProcessOneMessageImpl()

    const result = await runEmailHistoryBackfill({
      startMonth: "2026-03",
      endMonth: "2026-01",
      folder: "inbox",
      maxBatches: 100,
      rateLimitMs: 0,
      fetchImpl,
      processOneMessageImpl,
      cursorIO,
    })

    expect(result.monthsProcessed).toEqual(["2026-03", "2026-02", "2026-01"])
    expect(result.monthsSkipped).toEqual([])
    expect(result.messagesSeen).toBe(3)
    expect(result.messagesInserted).toBe(3)
    expect(result.done).toBe(true)
    expect(result.reachedBatchCap).toBe(false)
    expect(processOneMessageImpl).toHaveBeenCalledTimes(3)
    // Cursor should reflect the OLDEST month we finished.
    expect(ref.state?.lastCompletedMonth).toBe("2026-01")
    expect(ref.state?.processedCount).toBe(3)
  })

  it("skips months whose lastCompletedMonth indicates already-done (resume)", async () => {
    // Cursor says we already finished through 2026-02 (oldest done).
    // So when run with startMonth=2026-03 endMonth=2026-01, only 2026-03 and
    // 2026-01 should be skipped (those are >= lastCompletedMonth=2026-02 in
    // the descending walk semantics: we skip months we've already processed.)
    //
    // Wait — re-read the engine: skip when month >= lastCompletedMonth.
    // 2026-03 >= 2026-02 → skip. 2026-02 >= 2026-02 → skip. 2026-01 < 2026-02 → process.
    const { cursorIO, ref } = makeCursorIO({
      lastCompletedMonth: "2026-02",
      processedCount: 50,
      updatedAt: new Date(0).toISOString(),
    })
    const { fetchImpl } = makeScriptedFetch({
      "2026-01-01": [
        {
          monthFilter: "2026-01-01",
          value: [makeMessage("a", "2026-01-15T00:00:00Z")],
        },
      ],
    })
    const processOneMessageImpl = makeProcessOneMessageImpl()

    const result = await runEmailHistoryBackfill({
      startMonth: "2026-03",
      endMonth: "2026-01",
      folder: "inbox",
      maxBatches: 100,
      rateLimitMs: 0,
      fetchImpl,
      processOneMessageImpl,
      cursorIO,
    })

    expect(result.monthsSkipped).toEqual(["2026-03", "2026-02"])
    expect(result.monthsProcessed).toEqual(["2026-01"])
    expect(result.messagesSeen).toBe(1)
    expect(processOneMessageImpl).toHaveBeenCalledTimes(1)
    expect(ref.state?.lastCompletedMonth).toBe("2026-01")
    // processedCount accumulates across runs.
    expect(ref.state?.processedCount).toBe(51)
  })

  it("calls the rate-limit sleep between Graph requests within a month", async () => {
    const { cursorIO } = makeCursorIO(null)
    const sleepImpl = vi.fn(async () => {})
    // One month with two pages — should call sleep once between them.
    const { fetchImpl } = makeScriptedFetch({
      "2026-04-01": [
        {
          monthFilter: "2026-04-01",
          value: [makeMessage("a", "2026-04-10T00:00:00Z")],
          nextLink:
            "https://graph.microsoft.com/v1.0/__nextlink__2026-04-01__page2",
        },
        {
          monthFilter: "2026-04-01",
          value: [makeMessage("b", "2026-04-20T00:00:00Z")],
        },
      ],
    })
    const processOneMessageImpl = makeProcessOneMessageImpl()

    const result = await runEmailHistoryBackfill({
      startMonth: "2026-04",
      endMonth: "2026-04",
      folder: "inbox",
      maxBatches: 100,
      rateLimitMs: 1000,
      fetchImpl,
      sleepImpl,
      processOneMessageImpl,
      cursorIO,
    })

    expect(result.messagesSeen).toBe(2)
    expect(result.batchesUsed).toBe(2)
    // Two pages in one month → exactly one inter-request sleep at the
    // configured rate-limit duration.
    expect(sleepImpl).toHaveBeenCalledTimes(1)
    expect(sleepImpl).toHaveBeenCalledWith(1000)
  })

  it("treats an empty month as completed and advances the cursor past it", async () => {
    const { cursorIO, ref } = makeCursorIO(null)
    const { fetchImpl } = makeScriptedFetch({
      "2025-07-01": [{ monthFilter: "2025-07-01", value: [] }],
    })
    const processOneMessageImpl = makeProcessOneMessageImpl()

    const result = await runEmailHistoryBackfill({
      startMonth: "2025-07",
      endMonth: "2025-07",
      folder: "sentitems",
      maxBatches: 100,
      rateLimitMs: 0,
      fetchImpl,
      processOneMessageImpl,
      cursorIO,
    })

    expect(result.monthsProcessed).toEqual(["2025-07"])
    expect(result.messagesSeen).toBe(0)
    expect(result.messagesInserted).toBe(0)
    expect(processOneMessageImpl).not.toHaveBeenCalled()
    expect(ref.state?.lastCompletedMonth).toBe("2025-07")
    expect(result.done).toBe(true)
  })

  it("records an error mid-batch but keeps processing, and does not advance the cursor when a fetch fails", async () => {
    const { cursorIO, ref } = makeCursorIO(null)
    // 2026-06 has one good message, 2026-05 throws on fetch.
    let callCount = 0
    const fetchImpl = vi.fn(async (url: string) => {
      callCount += 1
      // Match on the `ge` clause to disambiguate from the `lt` upper bound
      // (which is the next-month's first day).
      if (url.includes(encodeURIComponent("ge 2026-06-01"))) {
        return { value: [makeMessage("ok-1", "2026-06-10T00:00:00Z")] }
      }
      if (url.includes(encodeURIComponent("ge 2026-05-01"))) {
        throw new Error("graph 503")
      }
      return { value: [] }
    })
    const processOneMessageImpl = makeProcessOneMessageImpl()

    const result = await runEmailHistoryBackfill({
      startMonth: "2026-06",
      endMonth: "2026-05",
      folder: "inbox",
      maxBatches: 100,
      rateLimitMs: 0,
      fetchImpl,
      processOneMessageImpl,
      cursorIO,
    })

    expect(callCount).toBeGreaterThanOrEqual(2)
    expect(result.monthsProcessed).toEqual(["2026-06"])
    expect(result.errors.length).toBe(1)
    expect(result.errors[0]?.month).toBe("2026-05")
    expect(result.errors[0]?.message).toContain("graph 503")
    // Cursor stops at 2026-06 (the successfully-finished month). It does NOT
    // advance into 2026-05 since the fetch failed there.
    expect(ref.state?.lastCompletedMonth).toBe("2026-06")
    expect(ref.state?.lastError).toContain("graph 503")
  })

  it("records per-message processing errors without advancing past the month", async () => {
    const { cursorIO, ref } = makeCursorIO(null)
    const { fetchImpl } = makeScriptedFetch({
      "2026-04-01": [
        {
          monthFilter: "2026-04-01",
          value: [
            makeMessage("good-1", "2026-04-05T00:00:00Z"),
            makeMessage("bad-2", "2026-04-06T00:00:00Z"),
            makeMessage("good-3", "2026-04-07T00:00:00Z"),
          ],
        },
      ],
    })

    const processOneMessageImpl = vi.fn(async (msg: GraphEmailMessage) => {
      if (msg.id === "bad-2") throw new Error("persist failed")
      return {
        classification: "noise" as const,
        extractedPlatform: null,
        contactCreated: false,
        leadCreated: false,
        inserted: true,
      }
    })

    const result = await runEmailHistoryBackfill({
      startMonth: "2026-04",
      endMonth: "2026-04",
      folder: "inbox",
      maxBatches: 100,
      rateLimitMs: 0,
      fetchImpl,
      processOneMessageImpl,
      cursorIO,
    })

    expect(result.messagesSeen).toBe(3)
    expect(result.messagesInserted).toBe(2)
    expect(result.errors.length).toBe(1)
    expect(result.errors[0]?.message).toContain("persist failed")
    // Per-message errors do NOT block advancing — the month still completes,
    // and the cursor moves. This matches the existing emails.ts behavior of
    // recording per-message failures and pressing on.
    expect(result.monthsProcessed).toEqual(["2026-04"])
    expect(ref.state?.lastCompletedMonth).toBe("2026-04")
  })

  it("stops at the maxBatches cap mid-month and does not advance the cursor", async () => {
    const { cursorIO, ref } = makeCursorIO(null)
    // One page of 100 messages for one month → batch cap of 1 should mean
    // we process exactly 100 messages and then stop without finishing the
    // month (since there's a nextLink that promises more).
    const firstPage = Array.from({ length: 100 }, (_, i) =>
      makeMessage(`m-${i}`, "2026-03-15T00:00:00Z")
    )
    const { fetchImpl } = makeScriptedFetch({
      "2026-03-01": [
        {
          monthFilter: "2026-03-01",
          value: firstPage,
          nextLink:
            "https://graph.microsoft.com/v1.0/__nextlink__2026-03-01__page2",
        },
        {
          monthFilter: "2026-03-01",
          value: [makeMessage("m-100", "2026-03-16T00:00:00Z")],
        },
      ],
    })
    const processOneMessageImpl = makeProcessOneMessageImpl()

    const result = await runEmailHistoryBackfill({
      startMonth: "2026-03",
      endMonth: "2026-03",
      folder: "inbox",
      maxBatches: 1,
      rateLimitMs: 0,
      fetchImpl,
      processOneMessageImpl,
      cursorIO,
    })

    expect(result.messagesSeen).toBe(100)
    expect(result.reachedBatchCap).toBe(true)
    expect(result.done).toBe(false)
    expect(result.monthsProcessed).toEqual([])
    expect(ref.state?.lastCompletedMonth).toBeNull()
    // processedCount tracks partial month progress.
    expect(ref.state?.processedCount).toBe(100)
  })
})
