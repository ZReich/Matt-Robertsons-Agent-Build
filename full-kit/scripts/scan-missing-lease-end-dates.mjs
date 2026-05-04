#!/usr/bin/env node
/**
 * scan-missing-lease-end-dates — operator wrapper around the scanner
 * endpoint at `/api/lease/scan-missing-end-dates`.
 *
 * The endpoint is one-shot (it scans every qualifying deal in a single
 * call), so this wrapper is mostly a friendly front-end for the
 * `x-admin-token` ceremony, plus formatted output for the per-deal
 * outcomes.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   node scripts/scan-missing-lease-end-dates.mjs
 *   node scripts/scan-missing-lease-end-dates.mjs --max-messages=20 --max-pdfs=3
 *   node scripts/scan-missing-lease-end-dates.mjs --throttle-ms=2000
 *
 * Required env:
 *   MSGRAPH_TEST_ADMIN_TOKEN — must match what the server sees.
 *   APP_BASE_URL             — defaults to http://localhost:3000.
 */

const args = parseArgs(process.argv.slice(2))

const baseUrl = (
  args.url ?? process.env.APP_BASE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "")
const adminToken = process.env.MSGRAPH_TEST_ADMIN_TOKEN

const maxMessagesPerDeal = parseOptionalInt(args["max-messages"])
const maxPdfsPerDeal = parseOptionalInt(args["max-pdfs"])
const throttleMs = parseOptionalInt(args["throttle-ms"])

if (!adminToken) {
  console.error("MSGRAPH_TEST_ADMIN_TOKEN must be set in the environment")
  process.exit(1)
}

const endpoint = `${baseUrl}/api/lease/scan-missing-end-dates`

console.log(
  `[${new Date().toISOString()}] scan-missing-lease-end-dates starting`,
  JSON.stringify(
    { endpoint, maxMessagesPerDeal, maxPdfsPerDeal, throttleMs },
    null,
    2
  )
)

const callT0 = Date.now()
let response
try {
  response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
    },
    body: JSON.stringify(
      pruneUndefined({
        maxMessagesPerDeal,
        maxPdfsPerDeal,
        throttleMs,
      })
    ),
  })
} catch (err) {
  console.error(
    `network error contacting ${endpoint}:`,
    err instanceof Error ? err.message : String(err)
  )
  process.exit(2)
}

let payload
try {
  payload = await response.json()
} catch {
  console.error(`non-JSON response (status ${response.status})`)
  process.exit(2)
}

if (!response.ok || payload?.ok === false) {
  console.error(
    `scan returned error status=${response.status}:`,
    JSON.stringify(payload, null, 2)
  )
  process.exit(2)
}

const durationSec = ((Date.now() - callT0) / 1000).toFixed(1)
const totals = payload.totals ?? {}

console.log(
  `\n[${new Date().toISOString()}] scan complete in ${durationSec}s\n` +
    `  dealsConsidered:       ${payload.dealsConsidered ?? 0}\n` +
    `  updated:               ${totals.updated ?? 0}\n` +
    `  created:               ${totals.created ?? 0}\n` +
    `  no_messages:           ${totals.noMessages ?? 0}\n` +
    `  no_pdf_found:          ${totals.noPdf ?? 0}\n` +
    `  extractor_failed:      ${totals.extractorFailed ?? 0}\n` +
    `  skipped:               ${totals.skipped ?? 0}\n` +
    `  budget_capped:         ${totals.budgetCapped ?? 0}\n` +
    `  totalMessagesScanned:  ${payload.totalMessagesScanned ?? 0}\n` +
    `  totalPdfsAttempted:    ${payload.totalPdfsAttempted ?? 0}\n` +
    `  spentUsd:              $${(payload.spentUsd ?? 0).toFixed(4)}`
)

if (Array.isArray(payload.outcomes)) {
  console.log("\nPer-deal outcomes:")
  for (const o of payload.outcomes) {
    const note = o.reasoning ? ` — ${truncate(o.reasoning, 80)}` : ""
    const dates = o.leaseEndDate
      ? ` end=${o.leaseEndDate}${o.leaseStartDate ? ` start=${o.leaseStartDate}` : ""}`
      : ""
    console.log(
      `  ${o.dealId}: ${o.status}${dates}` +
        ` msg=${o.messagesScanned} pdf=${o.pdfsAttempted}${note}`
    )
  }
}

process.exit(0)

function parseArgs(argv) {
  const out = {}
  for (const a of argv) {
    if (!a.startsWith("--")) continue
    const eq = a.indexOf("=")
    if (eq === -1) {
      out[a.slice(2)] = "true"
    } else {
      out[a.slice(2, eq)] = a.slice(eq + 1)
    }
  }
  return out
}

function parseOptionalInt(raw) {
  if (raw == null) return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

function pruneUndefined(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

function truncate(s, n) {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + "…"
}
