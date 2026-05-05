import { randomUUID } from "node:crypto"

import type { Prisma } from "@prisma/client"
import type { ContactRef, DealRef, MatcherInput } from "./matcher"
import type {
  DealMatchSuggestion,
  ExtractedSignals,
  MatchSuggestion,
  PlaudRecording,
  PlaudTranscript,
} from "./types"

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
import { suggestContacts, suggestDeals } from "./matcher"
import { importVaultPlaudNotes } from "./vault-import"

const LOCK_KEY = "plaud:sync_lock"
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
const MANUAL_SYNC_BUDGET_MS = 150_000
const CRON_SYNC_BUDGET_MS = 270_000
const MANUAL_RECORDING_BUDGET_MS = 130_000
const MANUAL_MAX_RECORDINGS = 3
const MANUAL_LEGACY_BACKFILL_LIMIT = 1
const CRON_LEGACY_BACKFILL_LIMIT = 5
const LEGACY_REPROCESS_ROW_BUDGET_MS = 100_000
const SUGGESTION_REFRESH_LIMIT = 200
const LOCK_LEASE_MS = 10 * 60_000

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
  vaultImported?: number
  vaultImportErrors?: number
  timedOut?: boolean
  legacyReprocessed?: number
  legacyReprocessErrors?: number
  suggestionsRefreshed?: number
  suggestionRefreshErrors?: number
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
 * Concurrency: expiring SystemState lease keyed on `plaud:sync_lock`. A second
 * concurrent caller returns immediately with `skipped: "already_running"`
 * -- no work duplicated.
 */
export async function syncPlaud(opts: SyncOpts = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const owner = randomUUID()

  const leaseAcquired = await acquireSyncLease(owner)
  if (!leaseAcquired) {
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
    // Best-effort lease release. The lease has an expiry so a crashed process
    // cannot strand the sync forever even if this cleanup fails.
    try {
      await releaseSyncLease(owner)
    } catch (e) {
      console.error(
        "[plaud-sync] lease release failed (lease will expire):",
        e instanceof Error ? e.name : String(e)
      )
    }
  }
}

async function acquireSyncLease(owner: string): Promise<boolean> {
  const expiresAt = new Date(Date.now() + LOCK_LEASE_MS).toISOString()
  const affected = await db.$executeRaw`
    INSERT INTO system_state (key, value, updated_at)
    VALUES (
      ${LOCK_KEY},
      jsonb_build_object('owner', ${owner}, 'expiresAt', ${expiresAt}),
      now()
    )
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = now()
      WHERE
        COALESCE((system_state.value->>'expiresAt')::timestamptz, '-infinity'::timestamptz) < now()
        OR system_state.value->>'owner' = ${owner}
  `
  return affected > 0
}

async function releaseSyncLease(owner: string): Promise<void> {
  await db.$executeRaw`
    DELETE FROM system_state
    WHERE key = ${LOCK_KEY}
      AND value->>'owner' = ${owner}
  `
}

async function runSync(t0: number, opts: SyncOpts): Promise<SyncResult> {
  const cfg = loadPlaudConfig()
  const vaultImport = await importVaultPlaudNotes()

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
  const deadlineMs =
    t0 + (opts.manual ? MANUAL_SYNC_BUDGET_MS : CRON_SYNC_BUDGET_MS)
  const suggestionRefresh = await refreshExistingSuggestionRows({
    contacts,
    deals,
    scheduledMeetings,
    tagToContactMap,
    limit: SUGGESTION_REFRESH_LIMIT,
  })
  const legacyBackfill = await reprocessLegacyAiSkippedRows({
    contacts,
    deals,
    scheduledMeetings,
    tagToContactMap,
    limit: opts.manual
      ? MANUAL_LEGACY_BACKFILL_LIMIT
      : CRON_LEGACY_BACKFILL_LIMIT,
    deadlineMs,
  })

  let added = 0
  let skipped = 0
  let recordingErrors = 0
  let queued = 0
  let pending = 0
  let timedOut = legacyBackfill.timedOut
  // Collect successful startTimes and the earliest unprocessed startTime
  // so we can advance the watermark only past a contiguous prefix of
  // successes. This avoids silently dropping failures or recordings still
  // waiting on Plaud transcription — they need to be re-pulled next sync.
  let earliestUnprocessedMs: number | null = null
  const successStartMs: number[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() >= deadlineMs) {
      timedOut = true
      break
    }
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
    const allOlder = result.items.every((r) => r.startTime.getTime() <= sinceMs)
    if (allOlder) break

    for (const recording of result.items) {
      const processed = added + skipped + queued + pending + recordingErrors
      if (
        opts.manual &&
        (processed >= MANUAL_MAX_RECORDINGS ||
          Date.now() + MANUAL_RECORDING_BUDGET_MS >= deadlineMs)
      ) {
        timedOut = true
        const ms = recording.startTime.getTime()
        if (earliestUnprocessedMs === null || ms < earliestUnprocessedMs) {
          earliestUnprocessedMs = ms
        }
        break
      }
      if (Date.now() >= deadlineMs) {
        timedOut = true
        const ms = recording.startTime.getTime()
        if (earliestUnprocessedMs === null || ms < earliestUnprocessedMs) {
          earliestUnprocessedMs = ms
        }
        break
      }
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
        recordingErrors++
        const failedMs = recording.startTime.getTime()
        if (
          earliestUnprocessedMs === null ||
          failedMs < earliestUnprocessedMs
        ) {
          earliestUnprocessedMs = failedMs
        }
        console.error(
          `[plaud-sync] recording ${recording.id} failed:`,
          err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
        )
      }
    }
    if (timedOut) break
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
    errors: legacyBackfill.errors + suggestionRefresh.errors + recordingErrors,
    queued,
    pending,
    durationMs: Date.now() - t0,
    manual: opts.manual,
    vaultImported: vaultImport.imported,
    vaultImportErrors: vaultImport.errors,
    timedOut,
    legacyReprocessed: legacyBackfill.updated,
    legacyReprocessErrors: legacyBackfill.errors,
    suggestionsRefreshed: suggestionRefresh.updated,
    suggestionRefreshErrors: suggestionRefresh.errors,
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
  if (existing && existing.status === "synced") {
    const row = await db.communication.findUnique({
      where: { externalSyncId: existing.id },
      select: { metadata: true },
    })
    const meta = asRecord(row?.metadata)
    if (meta.aiSkipReason !== "sensitive_keywords") return "skipped"
  }

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
  const signals: ExtractedSignals & { aiError?: string } = await extractSignals(
    { cleanedText: cleaned.cleanedText }
  )

  const matcherInput: MatcherInput = {
    recording: opts.recording,
    cleanedText: cleaned.cleanedText,
    extractedSignals: signals,
    contacts: opts.contacts,
    deals: opts.deals,
    scheduledMeetings: opts.scheduledMeetings,
    tagToContactMap: opts.tagToContactMap,
  }
  const suggestions: MatchSuggestion[] = suggestContacts(matcherInput)
  const dealSuggestions: DealMatchSuggestion[] = suggestDeals(matcherInput)
  const dealReviewStatus = dealSuggestions.length > 0 ? "needed" : "none"

  await db.$transaction(async (tx) => {
    const externalSync = await tx.externalSync.upsert({
      where: {
        source_externalId: { source: "plaud", externalId: opts.recording.id },
      },
      create: {
        source: "plaud",
        externalId: opts.recording.id,
        entityType: "communication",
        rawData: serializeRaw(
          opts.recording,
          transcript
        ) as Prisma.InputJsonValue,
        status: "synced",
      },
      update: {
        rawData: serializeRaw(
          opts.recording,
          transcript
        ) as Prisma.InputJsonValue,
        status: "synced",
        errorMsg: null,
      },
    })

    const existingComm = await tx.communication.findUnique({
      where: { externalSyncId: externalSync.id },
      select: { metadata: true },
    })
    const metadata: Record<string, unknown> = {
      ...asRecord(existingComm?.metadata),
      source: "plaud",
      plaudId: opts.recording.id,
      plaudFilename: opts.recording.filename,
      plaudTagIds: opts.recording.tagIds,
      cleanedTurns: capMetadataTurns(cleaned.cleanedTurns),
      aiSummaryRaw: transcript.aiContentRaw,
      extractedSignals: signals,
      suggestions,
      dealSuggestions,
      dealReviewStatus,
      ...(cleaned.aiError ? { aiCleanError: cleaned.aiError } : {}),
      ...(signals.aiError ? { aiExtractError: signals.aiError } : {}),
    }
    delete metadata.aiSkipReason

    const data = {
      channel: "call" as const,
      subject: opts.recording.filename || null,
      body: cleaned.cleanedText,
      date: opts.recording.startTime,
      durationSeconds: opts.recording.durationSeconds,
      metadata: metadata as unknown as Prisma.InputJsonValue,
    }
    if (existingComm) {
      await tx.communication.update({
        where: { externalSyncId: externalSync.id },
        data,
      })
    } else {
      await tx.communication.create({
        data: {
          ...data,
          externalSyncId: externalSync.id,
        },
      })
    }
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

async function reprocessLegacyAiSkippedRows(opts: {
  contacts: ContactRef[]
  deals: DealRef[]
  scheduledMeetings: MatcherInput["scheduledMeetings"]
  tagToContactMap: Record<string, string>
  limit: number
  deadlineMs: number
}): Promise<{ updated: number; errors: number; timedOut: boolean }> {
  const rows = await db.communication.findMany({
    where: {
      channel: "call",
      metadata: { path: ["aiSkipReason"], equals: "sensitive_keywords" },
      externalSync: { source: "plaud" },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: opts.limit,
    select: {
      id: true,
      subject: true,
      date: true,
      durationSeconds: true,
      metadata: true,
      dealId: true,
      externalSync: { select: { rawData: true } },
    },
  })

  let updated = 0
  let errors = 0
  let timedOut = false
  for (const row of rows) {
    if (Date.now() + LEGACY_REPROCESS_ROW_BUDGET_MS >= opts.deadlineMs) {
      timedOut = true
      break
    }
    try {
      const raw = asRecord(row.externalSync?.rawData)
      const recording = recordingFromRaw(raw.recording, row)
      const transcript = transcriptFromRaw(raw.transcript, recording.id)
      const cleaned = await cleanTranscript({ speakerTurns: transcript.turns })
      const signals = await extractSignals({ cleanedText: cleaned.cleanedText })
      const matcherInput: MatcherInput = {
        recording,
        cleanedText: cleaned.cleanedText,
        extractedSignals: signals,
        contacts: opts.contacts,
        deals: opts.deals,
        scheduledMeetings: opts.scheduledMeetings,
        tagToContactMap: opts.tagToContactMap,
      }
      const suggestions = suggestContacts(matcherInput)
      const dealSuggestions = suggestDeals(matcherInput)
      const existingDealReviewStatus = asString(
        asRecord(row.metadata).dealReviewStatus
      )
      const dealReviewStatus = row.dealId
        ? "linked"
        : existingDealReviewStatus === "skipped"
          ? "skipped"
          : dealSuggestions.length > 0
            ? "needed"
            : "none"
      const metadata: Record<string, unknown> = {
        ...asRecord(row.metadata),
        source: "plaud",
        plaudId: recording.id,
        plaudFilename: recording.filename,
        plaudTagIds: recording.tagIds,
        cleanedTurns: capMetadataTurns(cleaned.cleanedTurns),
        extractedSignals: signals,
        suggestions,
        dealSuggestions,
        dealReviewStatus,
        ...(cleaned.aiError ? { aiCleanError: cleaned.aiError } : {}),
        ...(signals.aiError ? { aiExtractError: signals.aiError } : {}),
      }
      delete metadata.aiSkipReason

      await db.communication.update({
        where: { id: row.id },
        data: {
          subject: recording.filename || row.subject,
          body: cleaned.cleanedText,
          durationSeconds: recording.durationSeconds,
          metadata: metadata as unknown as Prisma.InputJsonValue,
        },
      })
      updated++
    } catch (err) {
      errors++
      console.error(
        `[plaud-sync] legacy AI-skipped row ${row.id} failed:`,
        err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
      )
    }
  }
  return { updated, errors, timedOut }
}

async function refreshExistingSuggestionRows(opts: {
  contacts: ContactRef[]
  deals: DealRef[]
  scheduledMeetings: MatcherInput["scheduledMeetings"]
  tagToContactMap: Record<string, string>
  limit: number
}): Promise<{ updated: number; errors: number }> {
  const rows = await db.communication.findMany({
    where: {
      channel: "call",
      archivedAt: null,
      metadata: { path: ["source"], equals: "plaud" },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: opts.limit,
    select: {
      id: true,
      subject: true,
      body: true,
      date: true,
      durationSeconds: true,
      contactId: true,
      dealId: true,
      metadata: true,
      externalSync: { select: { rawData: true } },
    },
  })

  let updated = 0
  let errors = 0
  for (const row of rows) {
    try {
      const metadata = asRecord(row.metadata)
      if (metadata.aiSkipReason === "sensitive_keywords") continue
      const signals = signalsFromRaw(metadata.extractedSignals)
      if (!signals) continue

      const raw = asRecord(row.externalSync?.rawData)
      const recording = recordingFromRaw(raw.recording, row)
      const plaudId = asString(metadata.plaudId)
      const plaudFilename = asString(metadata.plaudFilename)
      const plaudTagIds = asStringArray(metadata.plaudTagIds)
      const matcherInput: MatcherInput = {
        recording: {
          ...recording,
          id: plaudId ?? recording.id,
          filename: plaudFilename ?? recording.filename,
          tagIds: plaudTagIds.length > 0 ? plaudTagIds : recording.tagIds,
        },
        cleanedText: row.body ?? "",
        extractedSignals: signals,
        contacts: opts.contacts,
        deals: opts.deals,
        scheduledMeetings: opts.scheduledMeetings,
        tagToContactMap: opts.tagToContactMap,
      }
      const suggestions = row.contactId ? [] : suggestContacts(matcherInput)
      const dealSuggestions = row.dealId ? [] : suggestDeals(matcherInput)
      const existingDealReviewStatus = asString(metadata.dealReviewStatus)
      const dealReviewStatus = row.dealId
        ? "linked"
        : existingDealReviewStatus === "skipped"
          ? "skipped"
          : dealSuggestions.length > 0
            ? "needed"
            : "none"

      if (
        sameJson(metadata.suggestions, suggestions) &&
        sameJson(metadata.dealSuggestions, dealSuggestions) &&
        metadata.dealReviewStatus === dealReviewStatus
      ) {
        continue
      }

      await db.communication.update({
        where: { id: row.id },
        data: {
          metadata: {
            ...metadata,
            suggestions,
            dealSuggestions,
            dealReviewStatus,
          } as unknown as Prisma.InputJsonValue,
        },
      })
      updated++
    } catch (err) {
      errors++
      console.error(
        `[plaud-sync] suggestion refresh row ${row.id} failed:`,
        err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
      )
    }
  }
  return { updated, errors }
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
    transcript: {
      turns: transcript.turns,
      summaryList: transcript.summaryList,
    },
  }
}

function recordingFromRaw(
  value: unknown,
  fallback: {
    id: string
    subject: string | null
    date: Date
    durationSeconds: number | null
  }
): PlaudRecording {
  const raw = asRecord(value)
  return {
    id: asString(raw.id) ?? fallback.id,
    filename: asString(raw.filename) ?? fallback.subject ?? "",
    filesize: asNumber(raw.filesize) ?? 0,
    durationSeconds:
      asNumber(raw.durationSeconds) ?? fallback.durationSeconds ?? 0,
    startTime: asDate(raw.startTime) ?? fallback.date,
    endTime: asDate(raw.endTime),
    isTranscribed: true,
    isSummarized: true,
    tagIds: asStringArray(raw.tagIds),
    keywords: asStringArray(raw.keywords),
  }
}

function transcriptFromRaw(
  value: unknown,
  recordingId: string
): PlaudTranscript {
  const raw = asRecord(value)
  const turnsRaw = Array.isArray(raw.turns)
    ? (raw.turns as Array<Record<string, unknown>>)
    : []
  return {
    recordingId,
    turns: turnsRaw.map((turn) => ({
      speaker: asString(turn.speaker) ?? "",
      content: asString(turn.content) ?? "",
      startMs: asNumber(turn.startMs) ?? 0,
      endMs: asNumber(turn.endMs) ?? 0,
    })),
    aiContentRaw: asString(raw.aiContentRaw),
    summaryList: asStringArray(raw.summaryList),
  }
}

function signalsFromRaw(value: unknown): ExtractedSignals | null {
  const raw = asRecord(value)
  if (Object.keys(raw).length === 0) return null
  return {
    counterpartyName: asString(raw.counterpartyName),
    topic: asString(raw.topic),
    mentionedCompanies: asStringArray(raw.mentionedCompanies),
    mentionedProperties: asStringArray(raw.mentionedProperties),
    tailSynopsis: asString(raw.tailSynopsis),
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string") return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}
