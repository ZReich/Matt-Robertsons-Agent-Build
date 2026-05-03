#!/usr/bin/env node
/**
 * Lease history scan — operator script that loops the email-history backfill
 * until every month between --start-year and --end-year has been processed.
 *
 * Speaks to the API endpoint (which goes through the auth/kill-switch gates)
 * rather than hitting the engine directly. Re-invokes whenever the response
 * indicates more work to do (`done === false`), printing per-call progress.
 *
 * Stream D of docs/superpowers/plans/2026-05-02-lease-lifecycle.md.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   node scripts/lease-history-scan.mjs --start-year=2026 --end-year=2016
 *   node scripts/lease-history-scan.mjs --start-year=2026 --end-year=2016 --folder=sentitems
 *   node scripts/lease-history-scan.mjs --start-year=2026 --end-year=2016 --max-batches=20
 *
 * Required env:
 *   MSGRAPH_TEST_ADMIN_TOKEN — must match the value the server sees.
 *   APP_BASE_URL             — e.g. https://localhost:3000 (default).
 *
 * Aborting: Ctrl-C is safe. Cursor in SystemState records progress; the
 * next run picks up from the most-recent unfinished month.
 */

const args = parseArgs(process.argv.slice(2))

const startYear = Number.parseInt(args["start-year"] ?? "", 10)
const endYear = Number.parseInt(args["end-year"] ?? "", 10)
const folder = args.folder ?? "inbox"
const maxBatches = Number.parseInt(args["max-batches"] ?? "50", 10)
const baseUrl = (args.url ?? process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
)
const adminToken = process.env.MSGRAPH_TEST_ADMIN_TOKEN

if (!Number.isFinite(startYear) || startYear < 1990 || startYear > 9999) {
  console.error("--start-year is required (e.g. --start-year=2026)")
  process.exit(1)
}
if (!Number.isFinite(endYear) || endYear < 1990 || endYear > 9999) {
  console.error("--end-year is required (e.g. --end-year=2016)")
  process.exit(1)
}
if (endYear > startYear) {
  console.error(
    `--end-year (${endYear}) must be <= --start-year (${startYear}); we walk newest → oldest`
  )
  process.exit(1)
}
if (folder !== "inbox" && folder !== "sentitems") {
  console.error(`--folder must be 'inbox' or 'sentitems' (got: ${folder})`)
  process.exit(1)
}
if (!Number.isFinite(maxBatches) || maxBatches < 1) {
  console.error(`--max-batches must be a positive integer (got: ${args["max-batches"]})`)
  process.exit(1)
}
if (!adminToken) {
  console.error("MSGRAPH_TEST_ADMIN_TOKEN must be set in the environment")
  process.exit(1)
}

const startMonth = `${pad4(startYear)}-12`
const endMonth = `${pad4(endYear)}-01`

const endpoint = `${baseUrl}/api/integrations/msgraph/email-history-backfill`

console.log(
  `[${new Date().toISOString()}] lease-history-scan starting`,
  JSON.stringify(
    {
      folder,
      startMonth,
      endMonth,
      maxBatches,
      endpoint,
    },
    null,
    2
  )
)

let invocationIdx = 0
let totalSeen = 0
let totalInserted = 0
const t0 = Date.now()

while (true) {
  invocationIdx += 1
  const callT0 = Date.now()
  let response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify({
        startMonth,
        endMonth,
        folder,
        maxBatches,
      }),
    })
  } catch (err) {
    console.error(
      `[invocation ${invocationIdx}] network error contacting ${endpoint}:`,
      err instanceof Error ? err.message : String(err)
    )
    process.exit(2)
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    console.error(
      `[invocation ${invocationIdx}] non-JSON response (status ${response.status})`
    )
    process.exit(2)
  }

  if (!response.ok || payload?.ok === false) {
    console.error(
      `[invocation ${invocationIdx}] backfill returned error status=${response.status}:`,
      JSON.stringify(payload, null, 2)
    )
    process.exit(2)
  }

  const callDurationSec = ((Date.now() - callT0) / 1000).toFixed(1)
  totalSeen += payload.messagesSeen ?? 0
  totalInserted += payload.messagesInserted ?? 0

  console.log(
    `[invocation ${invocationIdx}] ${callDurationSec}s — ` +
      `seen=${payload.messagesSeen} inserted=${payload.messagesInserted} ` +
      `monthsProcessed=${(payload.monthsProcessed ?? []).length} ` +
      `monthsSkipped=${(payload.monthsSkipped ?? []).length} ` +
      `errors=${(payload.errors ?? []).length} ` +
      `lastCompletedMonth=${payload.cursor?.lastCompletedMonth ?? "(none)"} ` +
      `done=${payload.done}`
  )

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    for (const err of payload.errors) {
      console.warn(`  ! ${err.month}: ${err.message}`)
    }
  }

  if (payload.done === true) {
    const totalSec = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(
      `[${new Date().toISOString()}] lease-history-scan complete — ` +
        `invocations=${invocationIdx} totalSeen=${totalSeen} totalInserted=${totalInserted} totalDuration=${totalSec}s`
    )
    process.exit(0)
  }

  // Tiny breather between invocations so a tight HTTP loop doesn't rack up
  // overlapping per-process sessions on the server. The 1s/request rate
  // limit inside the engine itself is the real Graph protection.
  await sleep(1500)
}

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

function pad4(n) {
  return String(n).padStart(4, "0")
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
