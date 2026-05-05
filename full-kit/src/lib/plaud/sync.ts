import { Prisma } from "@prisma/client"

import { containsSensitiveContent } from "@/lib/ai/sensitive-filter"
import { db } from "@/lib/prisma"

import { cleanTranscript, extractSignals } from "./ai-passes"
import { withTokenRefreshOn401 } from "./auth"
import {
  getRecordingDetail,
  getTranscriptionStatus,
  listRecordings,
  saveTranscriptionResult,
  startTranscription,
} from "./client"
import { loadPlaudConfig } from "./config"
import {
  suggestContacts,
  suggestDeals,
  type ContactRef,
  type DealRef,
  type MatcherInput,
} from "./matcher"
import type {
  DealMatchSuggestion,
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
const MAX_METADATA_TURNS = 2000
const MAX_METADATA_TURN_CHARS = 4000

export interface SyncResult {
  added: number
  skipped: number | "already_running"
  errors: number
  /** Recordings we just triggered Plaud transcription on this run. */
  queued?: number
  /** Recordings still waiting on Plaud transcription from a previous run. */
  pending?: number
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
      select: { id: true, name: true, company: true, phone: true, tags: true },
    })
  ).map((c) => ({
    id: c.id,
    fullName: c.name ?? "",
    aliases: [
      c.company,
      c.phone,
      ...(Array.isArray(c.tags)
        ? c.tags.filter((tag): tag is string => typeof tag === "string")
        : []),
    ].filter((alias): alias is string => Boolean(alias && alias.trim())),
  }))

  const deals: DealRef[] = (
    await db.deal.findMany({
      where: { archivedAt: null, closedAt: null },
      select: {
        id: true,
        contactId: true,
        propertyAddress: true,
        propertyAliases: true,
        contact: { select: { name: true } },
      },
    })
  ).map((d) => ({
    id: d.id,
    contactId: d.contactId,
    contactName: d.contact?.name ?? null,
    propertyAddress: d.propertyAddress,
    propertyAliases: Array.isArray(d.propertyAliases)
      ? d.propertyAliases.filter((s): s is string => typeof s === "string")
      : [],
  }))

  // Pull recent meetings (window: ±2h around any recording in this run).
  // We over-fetch the last 90d of meetings; the matcher does the time-window
  // filter per recording.
  const scheduledMeetings = await loadRecentMeetings(since)

  let added = 0
  let skipped = 0
  let errors = 0
  let queued = 0
  let pending = 0
  // Collect successful startTimes and the earliest unprocessed startTime
  // so we can advance the watermark only past a contiguous prefix of
  // successes. This avoids silently dropping failures or recordings still
  // waiting on Plaud transcription — they need to be re-pulled next sync.
  let earliestUnprocessedMs: number | null = null
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
          deals,
          scheduledMeetings,
          tagToContactMap,
          region: cfg.region,
        })
        if (status === "skipped") {
          skipped++
          successStartMs.push(recording.startTime.getTime())
        } else if (status === "added") {
          added++
          successStartMs.push(recording.startTime.getTime())
        } else if (status === "queued") {
          queued++
          // Hold watermark — we want to re-encounter this on the next sync.
          const ms = recording.startTime.getTime()
          if (earliestUnprocessedMs === null || ms < earliestUnprocessedMs) {
            earliestUnprocessedMs = ms
          }
        } else if (status === "pending") {
          pending++
          const ms = recording.startTime.getTime()
          if (earliestUnprocessedMs === null || ms < earliestUnprocessedMs) {
            earliestUnprocessedMs = ms
          }
        }
      } catch (err) {
        errors++
        const failedMs = recording.startTime.getTime()
        if (earliestUnprocessedMs === null || failedMs < earliestUnprocessedMs) {
          earliestUnprocessedMs = failedMs
        }
        // eslint-disable-next-line no-console
        console.error(
          `[plaud-sync] recording ${recording.id} failed:`,
          err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
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
  // earliest unprocessed (failed OR pending OR queued-this-run). If no
  // unprocessed, it's just max(successes). If all successes are newer
  // than the earliest unprocessed, watermark stays at `since` so the
  // next sync re-encounters them.
  const eligibleSuccesses = successStartMs.filter(
    (ms) => earliestUnprocessedMs === null || ms < earliestUnprocessedMs
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
    queued,
    pending,
    durationMs: Date.now() - t0,
    manual: opts.manual,
  }
}

interface ProcessRecordingInput {
  recording: PlaudRecording
  contacts: ContactRef[]
  deals: DealRef[]
  scheduledMeetings: MatcherInput["scheduledMeetings"]
  tagToContactMap: Record<string, string>
  region: ReturnType<typeof loadPlaudConfig>["region"]
}

type ProcessStatus = "added" | "skipped" | "queued" | "pending"

async function processRecording(
  opts: ProcessRecordingInput
): Promise<ProcessStatus> {
  const existing = await db.externalSync.findUnique({
    where: {
      source_externalId: { source: "plaud", externalId: opts.recording.id },
    },
  })
  if (existing && existing.status === "synced") return "skipped"

  // Auto-transcribe path: when Plaud hasn't transcribed yet, kick off
  // its analysis (or check progress on a previously-triggered one).
  if (!opts.recording.isTranscribed) {
    // No prior trigger: kick off Plaud's transcription and remember we did.
    if (!existing) {
      await withTokenRefreshOn401((token) =>
        startTranscription({
          token,
          region: opts.region,
          recordingId: opts.recording.id,
        })
      )
      await db.externalSync.create({
        data: {
          source: "plaud",
          externalId: opts.recording.id,
          entityType: "communication",
          rawData: {
            triggeredAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
          status: "pending",
        },
      })
      return "queued"
    }
    // Prior trigger exists: poll status. Plaud's `status === 1` on the
    // transsumm endpoint = "complete" (different sentinel from /auth login).
    let statusResult: Awaited<ReturnType<typeof getTranscriptionStatus>>
    try {
      statusResult = await withTokenRefreshOn401((token) =>
        getTranscriptionStatus({
          token,
          region: opts.region,
          recordingId: opts.recording.id,
        })
      )
    } catch {
      // transient — leave row pending, try again next sync
      return "pending"
    }
    if (!statusResult.complete) return "pending"

    // Persist the result back onto the recording so is_trans flips true,
    // then fall through to the standard path which re-fetches detail.
    await withTokenRefreshOn401((token) =>
      saveTranscriptionResult({
        token,
        region: opts.region,
        recordingId: opts.recording.id,
        analysisResult: statusResult.rawData,
      })
    )
    // Fall through with isTranscribed forced true so the standard path
    // re-fetches the (now-populated) detail. Note: `existing` is the
    // pending row and `processTranscribedRecording` will upsert it to
    // status="synced".
    return await processTranscribedRecording({
      ...opts,
      recording: { ...opts.recording, isTranscribed: true },
    })
  }

  // Standard path — recording is already transcribed in Plaud.
  return await processTranscribedRecording(opts)
}

async function processTranscribedRecording(
  opts: ProcessRecordingInput
): Promise<ProcessStatus> {
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

  const matcherInput: MatcherInput = {
    recording: opts.recording,
    cleanedText: cleaned.cleanedText,
    extractedSignals: signals,
    contacts: opts.contacts,
    deals: opts.deals,
    scheduledMeetings: opts.scheduledMeetings,
    tagToContactMap: opts.tagToContactMap,
  }
  const suggestions: MatchSuggestion[] = sens.tripped
    ? []
    : suggestContacts(matcherInput)
  const dealSuggestions: DealMatchSuggestion[] = sens.tripped
    ? []
    : suggestDeals(matcherInput)
  const dealReviewStatus =
    dealSuggestions.length > 0 ? "needed" : "none"

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
          cleanedTurns: capMetadataTurns(cleaned.cleanedTurns),
          aiSummaryRaw: transcript.aiContentRaw,
          extractedSignals: aiSkipReason ? null : signals,
          ...(aiSkipReason ? { aiSkipReason } : {}),
          ...(cleaned.aiError ? { aiCleanError: cleaned.aiError } : {}),
          ...(signals.aiError ? { aiExtractError: signals.aiError } : {}),
          suggestions,
          dealSuggestions,
          dealReviewStatus,
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

function capMetadataTurns(
  turns: PlaudTranscript["turns"]
): PlaudTranscript["turns"] {
  return turns.slice(0, MAX_METADATA_TURNS).map((turn) => ({
    ...turn,
    content:
      turn.content.length > MAX_METADATA_TURN_CHARS
        ? `${turn.content.slice(0, MAX_METADATA_TURN_CHARS)}...`
        : turn.content,
  }))
}
