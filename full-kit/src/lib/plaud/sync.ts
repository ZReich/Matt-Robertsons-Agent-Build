import { Prisma } from "@prisma/client"

import { containsSensitiveContent } from "@/lib/ai/sensitive-filter"
import { db } from "@/lib/prisma"

import { cleanTranscript, extractSignals } from "./ai-passes"
import { withTokenRefreshOn401 } from "./auth"
import { getRecordingDetail, listRecordings } from "./client"
import { loadPlaudConfig } from "./config"
import {
  suggestContacts,
  type ContactRef,
  type MatcherInput,
} from "./matcher"
import type {
  ExtractedSignals,
  MatchSuggestion,
  PlaudRecording,
  PlaudTranscript,
} from "./types"

const ADVISORY_LOCK_KEY = "plaud-sync"
const HIGH_WATER_KEY = "plaud:last_sync_at"
const TAG_MAP_KEY = "plaud:tag_map"
// First-run high-water-mark: pull last 90 days. We don't want to pull
// the entire backlog of a brand-new install in one go.
const DEFAULT_LOOKBACK_MS = 90 * 86_400_000
const PAGE_LIMIT = 50
// Hard cap on total pages per sync run, defensive against pagination
// bugs that would loop forever.
const MAX_PAGES = 200

export interface SyncResult {
  added: number
  skipped: number | "already_running"
  errors: number
  durationMs: number
  manual?: boolean
}

export interface SyncOpts {
  manual?: boolean
}

/**
 * Pull new Plaud recordings since the last high-water-mark, run the
 * two-pass DeepSeek AI, compute match suggestions, and write a
 * Communication + ExternalSync row per new recording.
 *
 * Idempotency: `(source="plaud", externalId)` is unique on
 * ExternalSync. A partial-failure mid-run leaves earlier rows committed
 * and resumes cleanly on the next call.
 *
 * Concurrency: Postgres advisory lock keyed on `plaud-sync`. A second
 * concurrent caller returns immediately with `skipped: "already_running"`
 * — no work duplicated.
 */
export async function syncPlaud(opts: SyncOpts = {}): Promise<SyncResult> {
  const t0 = Date.now()

  const lockRows = (await db.$queryRaw`
    SELECT pg_try_advisory_lock(hashtext(${ADVISORY_LOCK_KEY})) AS got
  `) as Array<{ got: boolean }>
  if (!lockRows[0]?.got) {
    return {
      added: 0,
      skipped: "already_running",
      errors: 0,
      durationMs: Date.now() - t0,
      manual: opts.manual,
    }
  }

  try {
    return await runSync(t0, opts)
  } finally {
    // Best-effort unlock. Advisory locks auto-release on session/connection
    // close, so swallowing here is safe and ensures the original
    // success/error from runSync survives even if the DB has gone away.
    try {
      await db.$queryRaw`
        SELECT pg_advisory_unlock(hashtext(${ADVISORY_LOCK_KEY}))
      `
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        "[plaud-sync] unlock failed (lock will auto-release on session end):",
        e instanceof Error ? e.name : String(e)
      )
    }
  }
}

async function runSync(t0: number, opts: SyncOpts): Promise<SyncResult> {
  const cfg = loadPlaudConfig()

  const sinceRow = await db.systemState.findUnique({
    where: { key: HIGH_WATER_KEY },
  })
  const since = sinceRow?.value
    ? new Date(String(sinceRow.value))
    : new Date(Date.now() - DEFAULT_LOOKBACK_MS)
  const sinceMs = since.getTime()

  const tagMapRow = await db.systemState.findUnique({
    where: { key: TAG_MAP_KEY },
  })
  const tagToContactMap = parseTagMap(tagMapRow?.value)

  const contacts: ContactRef[] = (
    await db.contact.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
    })
  ).map((c) => ({ id: c.id, fullName: c.name ?? "", aliases: [] }))

  // Pull recent meetings (window: ±2h around any recording in this run).
  // We over-fetch the last 90d of meetings; the matcher does the time-window
  // filter per recording.
  const scheduledMeetings = await loadRecentMeetings(since)

  let added = 0
  let skipped = 0
  let errors = 0
  // Collect successful startTimes and the earliest failed startTime so we
  // can advance the watermark only past a contiguous prefix of successes.
  // This avoids the "silently dropped failure" bug where a mid-page failure
  // would otherwise let the watermark jump past it and the failed recording
  // would never be retried.
  let earliestFailureMs: number | null = null
  const successStartMs: number[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await withTokenRefreshOn401((token) =>
      listRecordings({
        token,
        region: cfg.region,
        skip: page * PAGE_LIMIT,
        limit: PAGE_LIMIT,
      })
    )
    if (result.items.length === 0) break

    // Plaud returns most-recent-first. If the entire page is older than
    // the high-water-mark, we're done.
    const allOlder = result.items.every(
      (r) => r.startTime.getTime() <= sinceMs
    )
    if (allOlder) break

    for (const recording of result.items) {
      if (recording.startTime.getTime() <= sinceMs) {
        // older than our cutoff — skip silently (idempotent on next run)
        continue
      }
      try {
        const status = await processRecording({
          recording,
          contacts,
          scheduledMeetings,
          tagToContactMap,
          region: cfg.region,
        })
        if (status === "skipped") skipped++
        else added++
        successStartMs.push(recording.startTime.getTime())
      } catch (err) {
        errors++
        const failedMs = recording.startTime.getTime()
        if (earliestFailureMs === null || failedMs < earliestFailureMs) {
          earliestFailureMs = failedMs
        }
        // eslint-disable-next-line no-console
        console.error(
          `[plaud-sync] recording ${recording.id} failed:`,
          err instanceof Error ? err.name : "unknown"
        )
      }
    }
    // Always page to the next batch; the loop terminates when the API
    // returns an empty page or when an entire page is older than the
    // high-water-mark. We deliberately don't shortcut on short pages —
    // a partial page can still be followed by another page in some
    // upstream pagination implementations, and the cost of one extra
    // HTTP call to confirm "really done" is negligible.
  }

  // Compute the new watermark: highest success that is OLDER than the
  // earliest failure. If no failures, it's just max(successes). If all
  // successes are newer than the earliest failure, watermark stays at
  // `since` (don't advance — next sync re-attempts the failed recording).
  const eligibleSuccesses = successStartMs.filter(
    (ms) => earliestFailureMs === null || ms < earliestFailureMs
  )
  const newWatermarkMs =
    eligibleSuccesses.length > 0 ? Math.max(...eligibleSuccesses) : sinceMs
  if (newWatermarkMs > sinceMs) {
    const value = new Date(newWatermarkMs).toISOString()
    await db.systemState.upsert({
      where: { key: HIGH_WATER_KEY },
      create: { key: HIGH_WATER_KEY, value },
      update: { value },
    })
  }

  return {
    added,
    skipped,
    errors,
    durationMs: Date.now() - t0,
    manual: opts.manual,
  }
}

interface ProcessRecordingInput {
  recording: PlaudRecording
  contacts: ContactRef[]
  scheduledMeetings: MatcherInput["scheduledMeetings"]
  tagToContactMap: Record<string, string>
  region: ReturnType<typeof loadPlaudConfig>["region"]
}

async function processRecording(
  opts: ProcessRecordingInput
): Promise<"added" | "skipped"> {
  const existing = await db.externalSync.findUnique({
    where: {
      source_externalId: { source: "plaud", externalId: opts.recording.id },
    },
  })
  if (existing && existing.status === "synced") return "skipped"

  // Network-heavy work BEFORE the transaction.
  const transcript = await withTokenRefreshOn401((token) =>
    getRecordingDetail({
      token,
      region: opts.region,
      recordingId: opts.recording.id,
    })
  )

  const cleaned = await cleanTranscript({ speakerTurns: transcript.turns })

  const sens = containsSensitiveContent(
    opts.recording.filename,
    cleaned.cleanedText
  )
  let signals: ExtractedSignals & { aiError?: string } = {
    counterpartyName: null,
    topic: null,
    mentionedCompanies: [],
    mentionedProperties: [],
    tailSynopsis: null,
  }
  let aiSkipReason: string | undefined
  if (sens.tripped) {
    aiSkipReason = "sensitive_keywords"
  } else {
    signals = await extractSignals({ cleanedText: cleaned.cleanedText })
  }

  const suggestions: MatchSuggestion[] = sens.tripped
    ? []
    : suggestContacts({
        recording: opts.recording,
        cleanedText: cleaned.cleanedText,
        extractedSignals: signals,
        contacts: opts.contacts,
        scheduledMeetings: opts.scheduledMeetings,
        tagToContactMap: opts.tagToContactMap,
      })

  await db.$transaction(async (tx) => {
    const externalSync = await tx.externalSync.upsert({
      where: {
        source_externalId: { source: "plaud", externalId: opts.recording.id },
      },
      create: {
        source: "plaud",
        externalId: opts.recording.id,
        entityType: "communication",
        rawData: serializeRaw(opts.recording, transcript) as Prisma.InputJsonValue,
        status: "synced",
      },
      update: {
        rawData: serializeRaw(opts.recording, transcript) as Prisma.InputJsonValue,
        status: "synced",
        errorMsg: null,
      },
    })

    // Note: raw turns live on ExternalSync.rawData (audit trail). The
    // Communication.metadata only stores cleanedTurns to keep the row
    // small for fast list/timeline queries — UI can fetch the raw via
    // ExternalSync if needed.
    await tx.communication.create({
      data: {
        channel: "call",
        subject: opts.recording.filename || null,
        body: cleaned.cleanedText,
        date: opts.recording.startTime,
        durationSeconds: opts.recording.durationSeconds,
        externalSyncId: externalSync.id,
        metadata: {
          source: "plaud",
          plaudId: opts.recording.id,
          plaudFilename: opts.recording.filename,
          plaudTagIds: opts.recording.tagIds,
          cleanedTurns: cleaned.cleanedTurns,
          aiSummaryRaw: transcript.aiContentRaw,
          extractedSignals: aiSkipReason ? null : signals,
          ...(aiSkipReason ? { aiSkipReason } : {}),
          ...(cleaned.aiError ? { aiCleanError: cleaned.aiError } : {}),
          ...(signals.aiError ? { aiExtractError: signals.aiError } : {}),
          suggestions,
        } as unknown as Prisma.InputJsonValue,
      },
    })
  })

  return "added"
}

async function loadRecentMeetings(
  since: Date
): Promise<MatcherInput["scheduledMeetings"]> {
  const rows = await db.meeting.findMany({
    where: {
      archivedAt: null,
      date: { gte: since },
    },
    select: {
      date: true,
      attendees: { select: { contactId: true } },
    },
  })
  const out: MatcherInput["scheduledMeetings"] = []
  for (const m of rows) {
    for (const a of m.attendees) {
      if (a.contactId) out.push({ contactId: a.contactId, date: m.date })
    }
  }
  return out
}

function parseTagMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.create(null) as Record<string, string>
  }
  // Object.create(null) prevents `__proto__` / `constructor` lookups from
  // returning the Object prototype if those literal strings ever appear
  // as Plaud tag IDs.
  const out: Record<string, string> = Object.create(null)
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // Don't trust __proto__/constructor/prototype keys at all.
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue
    if (typeof v === "string" && v.length > 0) out[k] = v
  }
  return out
}

function serializeRaw(
  rec: PlaudRecording,
  transcript: PlaudTranscript
): Record<string, unknown> {
  return {
    recording: {
      id: rec.id,
      filename: rec.filename,
      filesize: rec.filesize,
      durationSeconds: rec.durationSeconds,
      startTime: rec.startTime.toISOString(),
      endTime: rec.endTime ? rec.endTime.toISOString() : null,
      tagIds: rec.tagIds,
      keywords: rec.keywords,
    },
    transcript: { turns: transcript.turns, summaryList: transcript.summaryList },
  }
}
