import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { PlaudRecording } from "./types"

const {
  listRecordingsMock,
  getRecordingDetailMock,
  cleanMock,
  extractMock,
  suggestContactsMock,
  sensitiveMock,
  dbMock,
} = vi.hoisted(() => ({
  listRecordingsMock: vi.fn(),
  getRecordingDetailMock: vi.fn(),
  cleanMock: vi.fn(),
  extractMock: vi.fn(),
  suggestContactsMock: vi.fn().mockReturnValue([]),
  sensitiveMock: vi.fn().mockReturnValue({ tripped: false, reasons: [] }),
  dbMock: {
    externalSync: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({ id: "es-1" }),
    },
    contact: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    meeting: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    systemState: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    communication: {
      create: vi.fn().mockResolvedValue({ id: "comm-1" }),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}))

vi.mock("./auth", () => ({
  withTokenRefreshOn401: <T>(fn: (t: string) => Promise<T>) => fn("tok"),
}))

vi.mock("./client", async () => {
  const actual =
    await vi.importActual<typeof import("./client")>("./client")
  return {
    ...actual,
    listRecordings: listRecordingsMock,
    getRecordingDetail: getRecordingDetailMock,
  }
})

vi.mock("./ai-passes", () => ({
  cleanTranscript: cleanMock,
  extractSignals: extractMock,
}))

vi.mock("./matcher", () => ({
  suggestContacts: suggestContactsMock,
}))

vi.mock("@/lib/ai/sensitive-filter", () => ({
  containsSensitiveContent: sensitiveMock,
}))

vi.mock("@/lib/prisma", () => ({ db: dbMock }))

import { syncPlaud } from "./sync"

const mkRec = (overrides: Partial<PlaudRecording> = {}): PlaudRecording => ({
  id: "rec-1",
  filename: "Call",
  filesize: 100,
  durationSeconds: 60,
  startTime: new Date("2026-05-04T14:00:00Z"),
  endTime: new Date("2026-05-04T14:01:00Z"),
  isTranscribed: true,
  isSummarized: true,
  tagIds: [],
  keywords: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PLAUD_CREDENTIAL_KEY = "0".repeat(64)
  process.env.PLAUD_CRON_SECRET = "x".repeat(32)
  process.env.PLAUD_BEARER_TOKEN = "tok"
  // Default: lock is acquired; no high-water-mark exists yet.
  dbMock.$queryRaw.mockImplementation(
    async (templateOrParts: TemplateStringsArray | string) => {
      const sql = Array.isArray(templateOrParts)
        ? Array.from(templateOrParts).join("?")
        : (templateOrParts as string)
      if (sql.includes("pg_try_advisory_lock")) return [{ got: true }]
      if (sql.includes("pg_advisory_unlock")) return [{}]
      return []
    }
  )
  dbMock.$transaction.mockImplementation(
    async (fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock)
  )
  cleanMock.mockResolvedValue({
    cleanedText: "Speaker 1: hi.",
    cleanedTurns: [
      { speaker: "Speaker 1", content: "hi.", startMs: 0, endMs: 1000 },
    ],
  })
  extractMock.mockResolvedValue({
    counterpartyName: null,
    topic: null,
    mentionedCompanies: [],
    mentionedProperties: [],
    tailSynopsis: null,
  })
  getRecordingDetailMock.mockImplementation(async ({ recordingId }) => ({
    recordingId,
    turns: [
      { speaker: "Speaker 1", content: "hi", startMs: 0, endMs: 1000 },
    ],
    aiContentRaw: null,
    summaryList: [],
  }))
})

afterEach(() => {
  delete process.env.PLAUD_BEARER_TOKEN
})

describe("syncPlaud", () => {
  it("inserts a Communication + ExternalSync per new recording", async () => {
    listRecordingsMock.mockResolvedValueOnce({
      items: [mkRec({ id: "rec-1" }), mkRec({ id: "rec-2" })],
    })
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    dbMock.externalSync.findUnique.mockResolvedValue(null)

    const result = await syncPlaud()
    expect(result.added).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toBe(0)
    expect(dbMock.communication.create).toHaveBeenCalledTimes(2)
    expect(dbMock.externalSync.upsert).toHaveBeenCalledTimes(2)
  })

  it("skips recordings already present in ExternalSync", async () => {
    listRecordingsMock.mockResolvedValueOnce({
      items: [mkRec({ id: "rec-1" }), mkRec({ id: "rec-2" })],
    })
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    dbMock.externalSync.findUnique
      .mockResolvedValueOnce({ id: "es-1", status: "synced" })
      .mockResolvedValueOnce(null)

    const result = await syncPlaud()
    expect(result.added).toBe(1)
    expect(result.skipped).toBe(1)
  })

  it("returns already_running when advisory lock not acquired", async () => {
    dbMock.$queryRaw.mockImplementationOnce(async () => [{ got: false }])
    const result = await syncPlaud()
    expect(result.skipped).toBe("already_running")
    expect(listRecordingsMock).not.toHaveBeenCalled()
  })

  it("releases the advisory lock even on internal error", async () => {
    listRecordingsMock.mockRejectedValueOnce(new Error("network down"))
    await expect(syncPlaud()).rejects.toThrow(/network down/)
    // unlock query was issued
    const calls = dbMock.$queryRaw.mock.calls.map((c) =>
      Array.isArray(c[0]) ? c[0].join("?") : String(c[0])
    )
    expect(calls.some((s) => s.includes("pg_advisory_unlock"))).toBe(true)
  })

  it("advances the high-water-mark to the latest startTime seen", async () => {
    const old = mkRec({
      id: "old",
      startTime: new Date("2026-04-01T00:00:00Z"),
    })
    const newer = mkRec({
      id: "new",
      startTime: new Date("2026-05-01T00:00:00Z"),
    })
    listRecordingsMock.mockResolvedValueOnce({ items: [newer, old] })
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    dbMock.externalSync.findUnique.mockResolvedValue(null)
    await syncPlaud()
    expect(dbMock.systemState.upsert).toHaveBeenCalled()
    const upsertCall = dbMock.systemState.upsert.mock.calls[0][0]
    expect(upsertCall.where.key).toBe("plaud:last_sync_at")
    expect(upsertCall.update.value).toBe(newer.startTime.toISOString())
  })

  it("stops paging when an entire page is older than the high-water-mark", async () => {
    dbMock.systemState.findUnique.mockResolvedValueOnce({
      key: "plaud:last_sync_at",
      value: "2026-05-01T00:00:00.000Z",
    })
    listRecordingsMock.mockResolvedValueOnce({
      items: [
        mkRec({ id: "r-old-1", startTime: new Date("2026-04-30T00:00:00Z") }),
        mkRec({ id: "r-old-2", startTime: new Date("2026-04-29T00:00:00Z") }),
      ],
    })
    dbMock.externalSync.findUnique.mockResolvedValue(null)

    const result = await syncPlaud()
    expect(result.added).toBe(0)
    expect(listRecordingsMock).toHaveBeenCalledTimes(1)
  })

  it("skips AI pass-2 when sensitive filter trips, marks aiSkipReason", async () => {
    sensitiveMock.mockReturnValue({
      tripped: true,
      reasons: ["keyword:wire instructions"],
    })
    listRecordingsMock.mockResolvedValueOnce({ items: [mkRec()] })
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    dbMock.externalSync.findUnique.mockResolvedValue(null)

    await syncPlaud()
    expect(extractMock).not.toHaveBeenCalled()
    const create = dbMock.communication.create.mock.calls[0][0]
    expect(create.data.metadata.aiSkipReason).toBe("sensitive_keywords")
    expect(create.data.metadata.extractedSignals).toBeNull()
  })

  it("counts per-recording errors without aborting the sync", async () => {
    listRecordingsMock.mockResolvedValueOnce({
      items: [
        mkRec({ id: "ok-1" }),
        mkRec({ id: "fail-1" }),
        mkRec({ id: "ok-2" }),
      ],
    })
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    dbMock.externalSync.findUnique.mockResolvedValue(null)
    getRecordingDetailMock.mockImplementation(async ({ recordingId }) => {
      if (recordingId === "fail-1") throw new Error("transcript fetch failed")
      return {
        recordingId,
        turns: [],
        aiContentRaw: null,
        summaryList: [],
      }
    })

    const result = await syncPlaud()
    expect(result.added).toBe(2)
    expect(result.errors).toBe(1)
  })

  it("paginates across multiple pages", async () => {
    listRecordingsMock
      .mockResolvedValueOnce({ items: [mkRec({ id: "p1-1" }), mkRec({ id: "p1-2" })] })
      .mockResolvedValueOnce({ items: [mkRec({ id: "p2-1" })] })
      .mockResolvedValueOnce({ items: [] })
    dbMock.externalSync.findUnique.mockResolvedValue(null)

    const result = await syncPlaud()
    expect(result.added).toBe(3)
    expect(listRecordingsMock).toHaveBeenCalledTimes(3)
  })

  it("does NOT advance watermark past a failed mid-page recording", async () => {
    const oldOk = mkRec({
      id: "old-ok",
      startTime: new Date("2026-05-01T00:00:00Z"),
    })
    const failed = mkRec({
      id: "fail-mid",
      startTime: new Date("2026-05-02T00:00:00Z"),
    })
    const newOk = mkRec({
      id: "new-ok",
      startTime: new Date("2026-05-03T00:00:00Z"),
    })
    listRecordingsMock.mockResolvedValueOnce({ items: [oldOk, failed, newOk] })
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    dbMock.externalSync.findUnique.mockResolvedValue(null)
    getRecordingDetailMock.mockImplementation(async ({ recordingId }) => {
      if (recordingId === "fail-mid") throw new Error("boom")
      return {
        recordingId,
        turns: [],
        aiContentRaw: null,
        summaryList: [],
      }
    })
    await syncPlaud()
    // Watermark must be ≤ failed.startTime (exclusive) so next sync re-tries.
    if (dbMock.systemState.upsert.mock.calls.length > 0) {
      const updateValue =
        dbMock.systemState.upsert.mock.calls[0][0].update.value
      expect(new Date(updateValue).getTime()).toBeLessThan(
        failed.startTime.getTime()
      )
    }
  })

  it("does NOT write watermark when nothing actually advances", async () => {
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    await syncPlaud()
    expect(dbMock.systemState.upsert).not.toHaveBeenCalled()
  })

  it("recovers from unlock failure without masking the original result", async () => {
    let unlockCalled = false
    dbMock.$queryRaw.mockImplementation(
      async (templateOrParts: TemplateStringsArray | string) => {
        const sql = Array.isArray(templateOrParts)
          ? Array.from(templateOrParts).join("?")
          : (templateOrParts as string)
        if (sql.includes("pg_try_advisory_lock")) return [{ got: true }]
        if (sql.includes("pg_advisory_unlock")) {
          unlockCalled = true
          throw new Error("connection lost")
        }
        return []
      }
    )
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    const result = await syncPlaud()
    // Original result still surfaces despite unlock failure.
    expect(result.added).toBe(0)
    expect(unlockCalled).toBe(true)
  })

  it("does not store rawTurns in Communication.metadata (kept on ExternalSync.rawData only)", async () => {
    listRecordingsMock.mockResolvedValueOnce({ items: [mkRec()] })
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    dbMock.externalSync.findUnique.mockResolvedValue(null)
    await syncPlaud()
    const create = dbMock.communication.create.mock.calls[0][0]
    expect(create.data.metadata).not.toHaveProperty("rawTurns")
    expect(create.data.metadata).toHaveProperty("cleanedTurns")
  })

  it("manual=true is reflected in the result for telemetry", async () => {
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    const result = await syncPlaud({ manual: true })
    expect(result.manual).toBe(true)
  })
})
