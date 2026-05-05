import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as ClientModule from "./client"
import type { PlaudRecording } from "./types"

import { syncPlaud } from "./sync"

const {
  listRecordingsMock,
  getRecordingDetailMock,
  startTranscriptionMock,
  getTranscriptionStatusMock,
  saveTranscriptionResultMock,
  cleanMock,
  extractMock,
  suggestContactsMock,
  suggestDealsMock,
  dbMock,
} = vi.hoisted(() => ({
  listRecordingsMock: vi.fn(),
  getRecordingDetailMock: vi.fn(),
  startTranscriptionMock: vi.fn().mockResolvedValue(undefined),
  getTranscriptionStatusMock: vi.fn(),
  saveTranscriptionResultMock: vi.fn().mockResolvedValue(undefined),
  cleanMock: vi.fn(),
  extractMock: vi.fn(),
  suggestContactsMock: vi.fn().mockReturnValue([]),
  suggestDealsMock: vi.fn().mockReturnValue([]),
  dbMock: {
    externalSync: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({ id: "es-1" }),
      create: vi.fn().mockResolvedValue({ id: "es-pending" }),
    },
    contact: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    deal: {
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
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "comm-1" }),
      update: vi.fn().mockResolvedValue({ id: "comm-1" }),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}))

vi.mock("./auth", () => ({
  withTokenRefreshOn401: <T>(fn: (t: string) => Promise<T>) => fn("tok"),
}))

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof ClientModule>("./client")
  return {
    ...actual,
    listRecordings: listRecordingsMock,
    getRecordingDetail: getRecordingDetailMock,
    startTranscription: startTranscriptionMock,
    getTranscriptionStatus: getTranscriptionStatusMock,
    saveTranscriptionResult: saveTranscriptionResultMock,
  }
})

vi.mock("./ai-passes", () => ({
  cleanTranscript: cleanMock,
  extractSignals: extractMock,
}))

vi.mock("./matcher", () => ({
  suggestContacts: suggestContactsMock,
  suggestDeals: suggestDealsMock,
}))

vi.mock("./vault-import", () => ({
  importVaultPlaudNotes: vi.fn().mockResolvedValue({
    imported: 0,
    skipped: 0,
    errors: 0,
  }),
}))

vi.mock("@/lib/prisma", () => ({ db: dbMock }))

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
  dbMock.communication.findUnique.mockResolvedValue(null)
  dbMock.communication.findMany.mockResolvedValue([])
  dbMock.communication.create.mockResolvedValue({ id: "comm-1" })
  dbMock.communication.update.mockResolvedValue({ id: "comm-1" })
  process.env.PLAUD_CREDENTIAL_KEY = "0".repeat(64)
  process.env.PLAUD_CRON_SECRET = "x".repeat(32)
  process.env.PLAUD_BEARER_TOKEN = "tok"
  // Default: lease is acquired/released; no high-water-mark exists yet.
  dbMock.$executeRaw.mockResolvedValue(1)
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
    turns: [{ speaker: "Speaker 1", content: "hi", startMs: 0, endMs: 1000 }],
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

  it("reprocesses legacy AI-skipped rows instead of skipping forever", async () => {
    dbMock.communication.findMany.mockResolvedValueOnce([])
    listRecordingsMock.mockResolvedValueOnce({ items: [mkRec({ id: "old" })] })
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    dbMock.externalSync.findUnique.mockResolvedValue({
      id: "es-old",
      status: "synced",
    })
    dbMock.communication.findUnique.mockResolvedValue({
      metadata: {
        source: "plaud",
        aiSkipReason: "sensitive_keywords",
        attachedAt: "2026-05-01T00:00:00.000Z",
      },
    })

    const result = await syncPlaud()

    expect(result.added).toBe(1)
    expect(extractMock).toHaveBeenCalled()
    expect(dbMock.communication.update).toHaveBeenCalled()
    const update = dbMock.communication.update.mock.calls[0][0]
    expect(update.where.externalSyncId).toBe("es-1")
    expect(update.data.metadata.aiSkipReason).toBeUndefined()
    expect(update.data.metadata.attachedAt).toBe("2026-05-01T00:00:00.000Z")
    expect(update.data.metadata.extractedSignals).toBeTruthy()
  })

  it("preserves linked deal review state when reprocessing legacy AI-skipped rows", async () => {
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    dbMock.communication.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "comm-linked",
          subject: "Legacy linked transcript",
          date: new Date("2026-05-01T15:00:00Z"),
          durationSeconds: 300,
          dealId: "deal-linked",
          metadata: {
            source: "plaud",
            aiSkipReason: "sensitive_keywords",
            dealReviewStatus: "linked",
          },
          externalSync: {
            rawData: {
              recording: {
                id: "rec-linked",
                filename: "Legacy linked transcript",
                startTime: "2026-05-01T15:00:00.000Z",
                durationSeconds: 300,
              },
              transcript: {
                turns: [
                  {
                    speaker: "Speaker 1",
                    content: "hi",
                    startMs: 0,
                    endMs: 1000,
                  },
                ],
              },
            },
          },
        },
      ])

    const result = await syncPlaud()

    expect(result.legacyReprocessed).toBe(1)
    const update = dbMock.communication.update.mock.calls[0][0]
    expect(update.data.metadata.dealReviewStatus).toBe("linked")
  })

  it("manual sync recording cap ignores background suggestion-refresh errors", async () => {
    listRecordingsMock.mockResolvedValueOnce({
      items: [mkRec({ id: "new-after-refresh-errors" })],
    })
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    dbMock.communication.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 3 }, (_, i) => ({
          id: `comm-refresh-error-${i}`,
          subject: "Needs refresh",
          body: "Speaker 1: Michelle",
          date: new Date("2026-05-01T15:00:00Z"),
          durationSeconds: 300,
          contactId: null,
          dealId: null,
          metadata: {
            source: "plaud",
            extractedSignals: {
              counterpartyName: "Michelle",
              topic: null,
              mentionedCompanies: [],
              mentionedProperties: [],
              tailSynopsis: null,
            },
            suggestions: [],
          },
          externalSync: { rawData: null },
        }))
      )
      .mockResolvedValueOnce([])
    dbMock.communication.update
      .mockRejectedValueOnce(new Error("refresh failed 1"))
      .mockRejectedValueOnce(new Error("refresh failed 2"))
      .mockRejectedValueOnce(new Error("refresh failed 3"))
      .mockResolvedValue({ id: "comm-new" })
    dbMock.externalSync.findUnique.mockResolvedValue(null)

    const result = await syncPlaud({ manual: true })

    expect(result.suggestionRefreshErrors).toBe(3)
    expect(result.added).toBe(1)
    expect(getRecordingDetailMock).toHaveBeenCalledWith(
      expect.objectContaining({ recordingId: "new-after-refresh-errors" })
    )
  })

  it("refreshes stored suggestions for already-processed Plaud rows", async () => {
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    dbMock.communication.findMany
      .mockResolvedValueOnce([
        {
          id: "comm-old-suggestion",
          subject: "Call with Michelle",
          body: "Speaker 1: call with Michelle about a land lease.",
          date: new Date("2026-05-01T15:00:00Z"),
          durationSeconds: 300,
          contactId: null,
          dealId: null,
          metadata: {
            source: "plaud",
            plaudId: "rec-old-suggestion",
            plaudFilename: "Call with Michelle",
            extractedSignals: {
              counterpartyName: "Michelle",
              topic: "land lease",
              mentionedCompanies: [],
              mentionedProperties: [],
              tailSynopsis: null,
            },
            suggestions: [],
          },
          externalSync: { rawData: null },
        },
      ])
      .mockResolvedValueOnce([])
    suggestContactsMock.mockReturnValueOnce([
      {
        contactId: "contact-michelle",
        score: 43,
        reason: 'AI extracted counterparty "Michelle"; verify before attaching',
        source: "counterparty_candidate",
      },
    ])

    const result = await syncPlaud()

    expect(result.suggestionsRefreshed).toBe(1)
    expect(dbMock.communication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "comm-old-suggestion" },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            suggestions: [
              expect.objectContaining({
                contactId: "contact-michelle",
                source: "counterparty_candidate",
              }),
            ],
          }),
        }),
      })
    )
  })

  it("returns already_running when sync lease not acquired", async () => {
    dbMock.$executeRaw.mockResolvedValueOnce(0)
    const result = await syncPlaud()
    expect(result.skipped).toBe("already_running")
    expect(listRecordingsMock).not.toHaveBeenCalled()
  })

  it("releases the sync lease even on internal error", async () => {
    listRecordingsMock.mockRejectedValueOnce(new Error("network down"))
    await expect(syncPlaud()).rejects.toThrow(/network down/)
    const calls = dbMock.$executeRaw.mock.calls.map((c) =>
      Array.isArray(c[0]) ? c[0].join("?") : String(c[0])
    )
    expect(calls.some((s) => s.includes("DELETE FROM system_state"))).toBe(true)
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
      .mockResolvedValueOnce({
        items: [mkRec({ id: "p1-1" }), mkRec({ id: "p1-2" })],
      })
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

  it("recovers from lease release failure without masking the original result", async () => {
    let releaseCalled = false
    dbMock.$executeRaw.mockImplementation(
      async (templateOrParts: TemplateStringsArray | string) => {
        const sql = Array.isArray(templateOrParts)
          ? Array.from(templateOrParts).join("?")
          : (templateOrParts as string)
        if (sql.includes("INSERT INTO system_state")) return 1
        if (sql.includes("DELETE FROM system_state")) {
          releaseCalled = true
          throw new Error("connection lost")
        }
        return 1
      }
    )
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    const result = await syncPlaud()
    expect(result.added).toBe(0)
    expect(releaseCalled).toBe(true)
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

  describe("auto-transcribe (un-transcribed recordings)", () => {
    it("triggers Plaud transcription and creates a pending ExternalSync row when no prior trigger exists", async () => {
      listRecordingsMock.mockResolvedValueOnce({
        items: [mkRec({ id: "untranscribed", isTranscribed: false })],
      })
      listRecordingsMock.mockResolvedValueOnce({ items: [] })
      dbMock.externalSync.findUnique.mockResolvedValue(null)

      const result = await syncPlaud()
      expect(result.queued).toBe(1)
      expect(result.added).toBe(0)
      expect(startTranscriptionMock).toHaveBeenCalledOnce()
      expect(dbMock.externalSync.create).toHaveBeenCalledOnce()
      const created = dbMock.externalSync.create.mock.calls[0][0]
      expect(created.data.status).toBe("pending")
      expect(dbMock.communication.create).not.toHaveBeenCalled()
    })

    it("queued recordings hold the watermark back so next sync re-encounters them", async () => {
      listRecordingsMock.mockResolvedValueOnce({
        items: [
          mkRec({
            id: "untranscribed-only",
            isTranscribed: false,
            startTime: new Date("2026-05-04T14:00:00Z"),
          }),
        ],
      })
      listRecordingsMock.mockResolvedValueOnce({ items: [] })
      dbMock.externalSync.findUnique.mockResolvedValue(null)
      await syncPlaud()
      // Queued-only run should not advance the watermark.
      expect(dbMock.systemState.upsert).not.toHaveBeenCalled()
    })

    it("polls status when ExternalSync is pending; returns 'pending' when not yet complete", async () => {
      listRecordingsMock.mockResolvedValueOnce({
        items: [mkRec({ id: "still-processing", isTranscribed: false })],
      })
      listRecordingsMock.mockResolvedValueOnce({ items: [] })
      dbMock.externalSync.findUnique.mockResolvedValue({
        id: "es-pending-1",
        status: "pending",
        rawData: { triggeredAt: "2026-05-04T13:00:00Z" },
      })
      getTranscriptionStatusMock.mockResolvedValueOnce({
        complete: false,
        message: "task processing",
        rawData: {},
      })

      const result = await syncPlaud()
      expect(result.pending).toBe(1)
      expect(result.added).toBe(0)
      expect(saveTranscriptionResultMock).not.toHaveBeenCalled()
      expect(dbMock.communication.create).not.toHaveBeenCalled()
    })

    it("when polling finds 'complete', persists the result and processes via the standard path", async () => {
      listRecordingsMock.mockResolvedValueOnce({
        items: [mkRec({ id: "now-done", isTranscribed: false })],
      })
      listRecordingsMock.mockResolvedValueOnce({ items: [] })
      dbMock.externalSync.findUnique.mockResolvedValue({
        id: "es-pending-2",
        status: "pending",
        rawData: { triggeredAt: "2026-05-04T13:00:00Z" },
      })
      getTranscriptionStatusMock.mockResolvedValueOnce({
        complete: true,
        message: "task complete",
        rawData: {
          status: 1,
          data_result: [
            {
              speaker: "Speaker 1",
              content: "Hi",
              start_time: 0,
              end_time: 1000,
            },
          ],
          data_result_summ: '{"markdown":"summary"}',
        },
      })

      const result = await syncPlaud()
      expect(saveTranscriptionResultMock).toHaveBeenCalledOnce()
      expect(getRecordingDetailMock).toHaveBeenCalledOnce()
      expect(result.added).toBe(1)
      expect(result.pending).toBe(0)
      expect(dbMock.communication.create).toHaveBeenCalledOnce()
    })

    it("transient poll failure leaves the row pending without advancing watermark", async () => {
      listRecordingsMock.mockResolvedValueOnce({
        items: [mkRec({ id: "poll-fail", isTranscribed: false })],
      })
      listRecordingsMock.mockResolvedValueOnce({ items: [] })
      dbMock.externalSync.findUnique.mockResolvedValue({
        id: "es-pending-3",
        status: "pending",
        rawData: {},
      })
      getTranscriptionStatusMock.mockRejectedValueOnce(
        new Error("network blip")
      )

      const result = await syncPlaud()
      expect(result.pending).toBe(1)
      expect(saveTranscriptionResultMock).not.toHaveBeenCalled()
      expect(dbMock.systemState.upsert).not.toHaveBeenCalled()
    })
  })

  it("manual=true is reflected in the result for telemetry", async () => {
    listRecordingsMock.mockResolvedValueOnce({ items: [] })
    const result = await syncPlaud({ manual: true })
    expect(result.manual).toBe(true)
  })
})
