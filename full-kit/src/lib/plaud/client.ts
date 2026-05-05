import {
  PLAUD_BASE_URLS,
  type PlaudRecording,
  type PlaudRegion,
  type PlaudTranscript,
} from "./types"

/**
 * Errors from the Plaud HTTP API. Carries the HTTP status when available
 * and an upstream `msg` if one was returned. The constructor sanitizes
 * `message` to prevent credential reflection from a hostile or buggy
 * upstream — see `sanitizeUpstreamMessage`.
 */
export class PlaudApiError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    message: string
  ) {
    super(`Plaud ${endpoint} ${status}: ${sanitizeUpstreamMessage(message)}`)
    this.name = "PlaudApiError"
  }
}

const DEFAULT_RETRY_DELAY_MS = 500
const DEFAULT_MAX_RETRIES = 5
const MAX_BACKOFF_MS = 30_000
const MAX_UPSTREAM_MSG_LEN = 200
const MAX_JWT_PAYLOAD_LEN = 4096
// Hosts we will accept as a region-redirect target. Anything else is rejected.
const ALLOWED_REDIRECT_HOSTS: ReadonlyArray<string> = [
  "api.plaud.ai",
  "api-euc1.plaud.ai",
  "api-apse1.plaud.ai",
]

interface FetchOpts {
  token: string
  region: PlaudRegion
  retryDelayMs?: number
  maxRetries?: number
}

/**
 * Authenticated request with retry and region-redirect handling.
 *
 * Retries on 429 and 5xx with exponential backoff up to `maxRetries`.
 * Switches region and retries (no backoff) on `status === -302` from a
 * 200 response — but only when the redirect target is an allowed Plaud
 * host. Never retries on 4xx (other than 429) — those are real errors
 * the caller must surface.
 *
 * The retry budget is shared between transient HTTP failures and region
 * redirects so a misbehaving server cannot pingpong us indefinitely.
 */
async function authedRequest(
  endpointPath: string,
  init: Omit<RequestInit, "headers"> & {
    headers?: Record<string, string>
  } & FetchOpts
): Promise<unknown> {
  const {
    token,
    region: initialRegion,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    headers = {},
    ...rest
  } = init

  let region = initialRegion
  let attempt = 0

  while (true) {
    const url = `${PLAUD_BASE_URLS[region]}${endpointPath}`
    const res = await fetch(url, {
      ...rest,
      headers: {
        ...headers,
        Authorization: `Bearer ${token}`,
      },
    })

    if (res.status === 429 || res.status >= 500) {
      attempt += 1
      if (attempt > maxRetries) {
        throw new PlaudApiError(
          res.status,
          endpointPath,
          `retry budget exhausted (${maxRetries} attempts)`
        )
      }
      const delay = Math.min(
        retryDelayMs * 2 ** (attempt - 1),
        MAX_BACKOFF_MS
      )
      await sleep(delay)
      continue
    }

    if (!res.ok) {
      const detail = await readErrorDetail(res)
      throw new PlaudApiError(res.status, endpointPath, detail)
    }

    const data = (await res.json().catch(() => null)) as
      | {
          status?: number
          data?: { domains?: { api?: string } }
          msg?: string
        }
      | null

    // Region redirect: switch base and retry.
    if (data && data.status === -302) {
      const newApi = data.data?.domains?.api
      if (typeof newApi !== "string" || newApi.length === 0) {
        throw new PlaudApiError(
          -302,
          endpointPath,
          "region redirect missing data.domains.api"
        )
      }
      // Strip protocol if present, then exact-match the host against allowlist.
      const newHost = newApi.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
      if (!ALLOWED_REDIRECT_HOSTS.includes(newHost)) {
        throw new PlaudApiError(
          -302,
          endpointPath,
          "region redirect target not in allowlist"
        )
      }
      const newRegion: PlaudRegion =
        newHost === "api-euc1.plaud.ai"
          ? "eu"
          : newHost === "api-apse1.plaud.ai"
            ? "ap"
            : "us"
      const currentHost = PLAUD_BASE_URLS[region].replace(/^https:\/\//, "")
      if (newHost === currentHost) {
        throw new PlaudApiError(
          -302,
          endpointPath,
          "region redirect to same host (loop)"
        )
      }
      region = newRegion
      attempt += 1
      if (attempt > maxRetries) {
        throw new PlaudApiError(
          -302,
          endpointPath,
          "region redirect retry budget exhausted"
        )
      }
      continue
    }

    if (
      data &&
      typeof data.status === "number" &&
      data.status !== 0 &&
      data.status !== 1
    ) {
      throw new PlaudApiError(
        data.status,
        endpointPath,
        data.msg ?? `upstream status=${data.status}`
      )
    }

    return data
  }
}

/**
 * Reduce risk that an upstream-controlled message reflects a credential.
 * Caps length and drops content known to indicate a credential echo.
 */
function sanitizeUpstreamMessage(msg: string): string {
  if (typeof msg !== "string") return ""
  let s = msg.replace(/[\r\n\t]+/g, " ")
  if (s.length > MAX_UPSTREAM_MSG_LEN) {
    s = `${s.slice(0, MAX_UPSTREAM_MSG_LEN)}…`
  }
  // Suspicious tokens: if the upstream message looks like it's quoting a
  // bearer or a form-encoded password back at us, redact it entirely. We
  // can't know the actual secret here, but echoing a `Bearer <jwt>` or
  // `password=` substring is never legitimate from an error path.
  if (/Bearer\s+[A-Za-z0-9._-]+/.test(s)) return "<redacted: bearer-shaped>"
  if (/password=/i.test(s)) return "<redacted: password-shaped>"
  return s
}

async function readErrorDetail(res: Response): Promise<string> {
  // Cache the body as text first so we can fall back when JSON parse fails
  // without trying to read the body twice.
  const text = await res.text().catch(() => "")
  try {
    const body = JSON.parse(text) as { msg?: string; error?: string }
    if (typeof body.msg === "string") return body.msg
    if (typeof body.error === "string") return body.error
  } catch {
    // not JSON
  }
  if (text.length > 0) {
    return text.slice(0, MAX_UPSTREAM_MSG_LEN)
  }
  return res.statusText || `HTTP ${res.status}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// Recording list
// ---------------------------------------------------------------------------

interface RawRecording {
  id?: unknown
  filename?: unknown
  filesize?: unknown
  duration?: unknown
  start_time?: unknown
  end_time?: unknown
  is_trans?: unknown
  is_summary?: unknown
  is_trash?: unknown
  filetag_id_list?: unknown
  keywords?: unknown
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback
}
function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
}
function asPlaudFlag(v: unknown): boolean {
  if (v === true || v === 1) return true
  if (v === false || v === 0 || v === null || v === undefined) return false
  if (typeof v === "string") {
    const s = v.trim().toLowerCase()
    return s === "1" || s === "true"
  }
  return false
}

function toRecording(raw: RawRecording): PlaudRecording | null {
  const id = asString(raw.id, "")
  if (!id) return null
  return {
    id,
    filename: asString(raw.filename, ""),
    filesize: asNumber(raw.filesize, 0),
    durationSeconds: Math.round(asNumber(raw.duration, 0) / 1000),
    startTime: new Date(asNumber(raw.start_time, 0)),
    endTime: raw.end_time ? new Date(asNumber(raw.end_time, 0)) : null,
    isTranscribed: asPlaudFlag(raw.is_trans),
    isSummarized: asPlaudFlag(raw.is_summary),
    tagIds: asStringArray(raw.filetag_id_list),
    keywords: asStringArray(raw.keywords),
  }
}

export async function listRecordings(opts: {
  token: string
  region: PlaudRegion
  skip?: number
  limit?: number
  retryDelayMs?: number
  maxRetries?: number
}): Promise<{ items: PlaudRecording[] }> {
  const params = new URLSearchParams({
    skip: String(opts.skip ?? 0),
    limit: String(opts.limit ?? 50),
    is_trash: "0",
    sort_by: "start_time",
    is_desc: "true",
  })
  const data = (await authedRequest(`/file/simple/web?${params.toString()}`, {
    method: "GET",
    token: opts.token,
    region: opts.region,
    retryDelayMs: opts.retryDelayMs,
    maxRetries: opts.maxRetries,
  })) as { data_file_list?: unknown } | null
  const list = Array.isArray(data?.data_file_list)
    ? (data!.data_file_list as RawRecording[])
    : []
  // Defense-in-depth: filter out trashed entries and items without an id.
  const items: PlaudRecording[] = []
  for (const raw of list) {
    if (raw && typeof raw === "object" && asPlaudFlag(raw.is_trash)) continue
    const mapped = toRecording(raw)
    if (mapped) items.push(mapped)
  }
  return { items }
}

// ---------------------------------------------------------------------------
// Recording detail (transcript + ai_content)
// ---------------------------------------------------------------------------

interface RawTurn {
  speaker?: unknown
  content?: unknown
  start_time?: unknown
  end_time?: unknown
}

interface RawDetail {
  id?: unknown
  trans_result?: unknown
  ai_content?: unknown
  summary_list?: unknown
}

export async function getRecordingDetail(opts: {
  token: string
  region: PlaudRegion
  recordingId: string
  retryDelayMs?: number
  maxRetries?: number
}): Promise<PlaudTranscript> {
  const data = (await authedRequest("/file/list", {
    method: "POST",
    body: JSON.stringify([opts.recordingId]),
    headers: { "Content-Type": "application/json" },
    token: opts.token,
    region: opts.region,
    retryDelayMs: opts.retryDelayMs,
    maxRetries: opts.maxRetries,
  })) as { data_file_list?: unknown } | null
  const list = Array.isArray(data?.data_file_list)
    ? (data!.data_file_list as RawDetail[])
    : []
  if (list.length === 0) {
    throw new PlaudApiError(
      404,
      "/file/list",
      `recording ${opts.recordingId} not found`
    )
  }
  const raw = list[0] ?? {}
  const turns = Array.isArray(raw.trans_result)
    ? (raw.trans_result as RawTurn[])
    : []
  const aiContentRaw =
    typeof raw.ai_content === "string" ? raw.ai_content : null
  const summaryList = Array.isArray(raw.summary_list)
    ? raw.summary_list.filter((x): x is string => typeof x === "string")
    : []
  return {
    recordingId: opts.recordingId,
    turns: turns.map((t) => ({
      speaker: asString(t.speaker, ""),
      content: asString(t.content, ""),
      startMs: asNumber(t.start_time, 0),
      endMs: asNumber(t.end_time, 0),
    })),
    aiContentRaw,
    summaryList,
  }
}

// ---------------------------------------------------------------------------
// Transcription lifecycle (mirrors the Python toolkit's start → wait →
// save_results pattern). Plaud doesn't auto-transcribe recordings —
// is_trans=false stays false until a client kicks off analysis AND
// PATCHes the result back. We do all three steps server-side so Matt
// doesn't have to open the Plaud app.
// ---------------------------------------------------------------------------

const TRANSCRIPTION_LANGUAGE = "en"
const TRANSCRIPTION_TYPE = "REASONING-NOTE"
const TRANSCRIPTION_INFO = JSON.stringify({
  language: TRANSCRIPTION_LANGUAGE,
  diarization: 1,
  llm: "auto",
})

export async function startTranscription(opts: {
  token: string
  region: PlaudRegion
  recordingId: string
}): Promise<void> {
  await authedRequest(`/file/${encodeURIComponent(opts.recordingId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      extra_data: {
        tranConfig: {
          language: TRANSCRIPTION_LANGUAGE,
          type_type: "system",
          type: TRANSCRIPTION_TYPE,
          diarization: 1,
          llm: "auto",
        },
      },
    }),
    headers: { "Content-Type": "application/json" },
    token: opts.token,
    region: opts.region,
  })
}

/**
 * Poll the transcription status. Returns `complete: true` when Plaud has
 * finished analysis; the caller still needs to call
 * `saveTranscriptionResult` to persist it back onto the recording.
 *
 * Upstream uses `status === 1` to indicate "task complete" on this
 * endpoint (note: different from login's `status === 0` success). The
 * full result payload comes back as `rawData` for use with
 * `saveTranscriptionResult`.
 */
export async function getTranscriptionStatus(opts: {
  token: string
  region: PlaudRegion
  recordingId: string
}): Promise<{
  complete: boolean
  message: string
  rawData: Record<string, unknown>
}> {
  const data = (await authedRequest(
    `/ai/transsumm/${encodeURIComponent(opts.recordingId)}`,
    {
      method: "POST",
      body: JSON.stringify({
        is_reload: 0,
        summ_type: TRANSCRIPTION_TYPE,
        summ_type_type: "system",
        info: TRANSCRIPTION_INFO,
        support_mul_summ: true,
      }),
      headers: { "Content-Type": "application/json" },
      token: opts.token,
      region: opts.region,
    }
  )) as Record<string, unknown> | null
  const raw = data ?? {}
  return {
    complete: raw.status === 1,
    message: typeof raw.msg === "string" ? raw.msg : "",
    rawData: raw,
  }
}

/**
 * Persist a completed transcription result back onto the recording.
 * After this PATCH, the recording's `is_trans` will be true and the
 * standard `getRecordingDetail` call returns the populated turns.
 *
 * `analysisResult` is the `rawData` returned by `getTranscriptionStatus`
 * once `complete` flipped true.
 */
export async function saveTranscriptionResult(opts: {
  token: string
  region: PlaudRegion
  recordingId: string
  analysisResult: Record<string, unknown>
}): Promise<void> {
  const trans_result = Array.isArray(opts.analysisResult.data_result)
    ? opts.analysisResult.data_result
    : []
  const rawAi =
    typeof opts.analysisResult.data_result_summ === "string"
      ? opts.analysisResult.data_result_summ
      : ""
  // Python toolkit unwraps JSON-shaped ai_content into the markdown
  // body before persisting; mirror that so the saved field is the
  // human-readable text rather than a JSON string.
  let aiContent: string = rawAi
  let aiContentHeader: Record<string, unknown> = {}
  if (rawAi.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawAi) as Record<string, unknown>
      if (typeof parsed.markdown === "string") {
        aiContent = parsed.markdown
      } else if (
        parsed.content &&
        typeof parsed.content === "object" &&
        typeof (parsed.content as Record<string, unknown>).markdown ===
          "string"
      ) {
        aiContent = (parsed.content as { markdown: string }).markdown
      } else if (typeof parsed.summary === "string") {
        aiContent = parsed.summary
      }
      if (
        parsed.header &&
        typeof parsed.header === "object" &&
        !Array.isArray(parsed.header)
      ) {
        aiContentHeader = parsed.header as Record<string, unknown>
      }
    } catch {
      // leave aiContent as raw
    }
  }
  const outline_result = Array.isArray(opts.analysisResult.outline_result)
    ? opts.analysisResult.outline_result
    : []
  const task_id_info =
    opts.analysisResult.task_id_info &&
    typeof opts.analysisResult.task_id_info === "object"
      ? opts.analysisResult.task_id_info
      : {}

  await authedRequest(`/file/${encodeURIComponent(opts.recordingId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      trans_result,
      ai_content: aiContent,
      outline_result,
      support_mul_summ: true,
      extra_data: {
        task_id_info,
        aiContentHeader,
      },
    }),
    headers: { "Content-Type": "application/json" },
    token: opts.token,
    region: opts.region,
  })
}

// ---------------------------------------------------------------------------
// Login (no auth header, separate path; intentionally NOT retried — bad
// credentials and rate-limited login are both non-transient enough that a
// retry would only delay user feedback. Called by the auth resolver which
// owns its own caching / single-flight.)
// ---------------------------------------------------------------------------

interface LoginResponse {
  status?: number
  msg?: string
  access_token?: string
  token_type?: string
}

export async function loginWithPassword(opts: {
  email: string
  password: string
  region: PlaudRegion
}): Promise<{ accessToken: string; expiresAt: Date }> {
  const url = `${PLAUD_BASE_URLS[opts.region]}/auth/access-token`
  const body = new URLSearchParams({
    username: opts.email,
    password: opts.password,
  }).toString()

  const res = await fetch(url, {
    method: "POST",
    // Login MUST NOT send Authorization header — it's the path that mints one.
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    const detail = await readErrorDetail(res)
    throw new PlaudApiError(res.status, "/auth/access-token", detail)
  }
  const data = (await res.json().catch(() => null)) as LoginResponse | null
  if (!data) {
    throw new PlaudApiError(
      0,
      "/auth/access-token",
      "non-JSON login response"
    )
  }
  if (data.status !== 0) {
    throw new PlaudApiError(
      0,
      "/auth/access-token",
      data.msg ?? `login status=${data.status}`
    )
  }
  if (!data.access_token) {
    throw new PlaudApiError(
      0,
      "/auth/access-token",
      "missing access_token in response"
    )
  }
  const expSec = decodeJwtExp(data.access_token)
  return {
    accessToken: data.access_token,
    expiresAt: new Date(expSec * 1000),
  }
}

function decodeJwtExp(jwt: string): number {
  const parts = jwt.split(".")
  if (parts.length !== 3) {
    throw new PlaudApiError(
      0,
      "/auth/access-token",
      "invalid JWT shape — expected 3 segments"
    )
  }
  if (parts[1].length > MAX_JWT_PAYLOAD_LEN) {
    throw new PlaudApiError(
      0,
      "/auth/access-token",
      "invalid JWT — payload too large"
    )
  }
  let payload: { iat?: unknown; exp?: unknown }
  try {
    payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as { iat?: unknown; exp?: unknown }
  } catch {
    throw new PlaudApiError(
      0,
      "/auth/access-token",
      "invalid JWT payload — base64/JSON decode failed"
    )
  }
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new PlaudApiError(
      0,
      "/auth/access-token",
      "invalid JWT payload — missing or non-numeric exp claim"
    )
  }
  const nowSec = Math.floor(Date.now() / 1000)
  // Reject tokens that are already expired or that claim absurd futures
  // (more than ~10 years out — Plaud tokens are ≤ 1 year).
  if (payload.exp <= nowSec) {
    throw new PlaudApiError(
      0,
      "/auth/access-token",
      "invalid JWT payload — exp is in the past"
    )
  }
  if (payload.exp > nowSec + 10 * 365 * 86_400) {
    throw new PlaudApiError(
      0,
      "/auth/access-token",
      "invalid JWT payload — exp is implausibly far in the future"
    )
  }
  return payload.exp
}

// ---------------------------------------------------------------------------
// AI content normalization
// ---------------------------------------------------------------------------

/**
 * Plaud's `ai_content` field can be plain markdown OR a JSON-wrapped
 * string with one of several shapes (see UPSTREAM_NOTES). This returns
 * the most likely human-readable markdown body, falling back to the raw
 * input on parse failure or unknown shape.
 */
export function parseAiContent(raw: string | null | undefined): string {
  if (!raw) return ""
  if (!raw.trim().startsWith("{")) return raw
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed.markdown === "string") return parsed.markdown
    if (
      parsed.content &&
      typeof parsed.content === "object" &&
      typeof (parsed.content as Record<string, unknown>).markdown === "string"
    ) {
      return (parsed.content as { markdown: string }).markdown
    }
    if (typeof parsed.summary === "string") return parsed.summary
    return raw
  } catch {
    return raw
  }
}
