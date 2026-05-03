#!/usr/bin/env node
/**
 * Closed-deal backlog driver — operator script that loops the
 * /api/lease/process-backlog endpoint until the full Communication backlog
 * has been classified and extracted (or a stop condition fires).
 *
 * Mirrors the structure of scripts/lease-history-scan.mjs.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   node scripts/process-closed-deal-backlog.mjs
 *   node scripts/process-closed-deal-backlog.mjs --batch-size=50 --throttle-ms=250
 *   node scripts/process-closed-deal-backlog.mjs --max-batches=1 --batch-size=10 --throttle-ms=500
 *
 * Args:
 *   --batch-size      Communications per query batch. Default: 50.
 *   --throttle-ms     Per-row sleep inside the orchestrator, ms. Default: 250.
 *   --max-batches     Max outer batches per invocation. Default: unlimited
 *                     (loops until complete or budget stops it). Use 1 for
 *                     validation runs.
 *   --cursor-key      SystemState key for the cursor. Default: closed-deal-backlog-cursor.
 *   --url             Base URL of the Next.js app. Default: http://localhost:3000.
 *                     (Also reads APP_BASE_URL env var as fallback.)
 *
 * Required env:
 *   MSGRAPH_TEST_ADMIN_TOKEN — must match the value the server sees.
 *
 * Stop conditions (printed as stoppedReason):
 *   complete    — no more Communications to process
 *   budget      — daily spend cap hit; resume tomorrow, cursor is persisted
 *   max_batches — per-invocation --max-batches cap; re-run to continue
 *   error       — 5 consecutive or 50 total per-row errors; investigate logs
 *
 * Aborting: Ctrl-C is safe. The cursor in SystemState is persisted after
 * each inner batch; re-running picks up near where it left off.
 */

const args = parseArgs(process.argv.slice(2))

const batchSize = Number.parseInt(args["batch-size"] ?? "50", 10)
const throttleMs = Number.parseInt(args["throttle-ms"] ?? "250", 10)
const maxBatches =
  args["max-batches"] !== undefined
    ? Number.parseInt(args["max-batches"], 10)
    : null // null = unlimited; the server side caps per invocation anyway
const cursorKey = args["cursor-key"] ?? "closed-deal-backlog-cursor"
const baseUrl = (args.url ?? process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
)
const adminToken = process.env.MSGRAPH_TEST_ADMIN_TOKEN

// --- Validation ---

if (!Number.isFinite(batchSize) || batchSize < 1) {
  console.error(`--batch-size must be a positive integer (got: ${args["batch-size"]})`)
  process.exit(1)
}
if (!Number.isFinite(throttleMs) || throttleMs < 0) {
  console.error(`--throttle-ms must be a non-negative integer (got: ${args["throttle-ms"]})`)
  process.exit(1)
}
if (maxBatches !== null && (!Number.isFinite(maxBatches) || maxBatches < 1)) {
  console.error(`--max-batches must be a positive integer (got: ${args["max-batches"]})`)
  process.exit(1)
}
if (!adminToken) {
  console.error("MSGRAPH_TEST_ADMIN_TOKEN must be set in the environment")
  process.exit(1)
}

const endpoint = `${baseUrl}/api/lease/process-backlog`

// --- Ctrl-C handler ---
let shutdownRequested = false
process.on("SIGINT", () => {
  if (!shutdownRequested) {
    shutdownRequested = true
    console.log("\n[process-closed-deal-backlog] SIGINT received — stopping after current invocation")
  }
})

// --- Main loop ---

console.log(
  `[${new Date().toISOString()}] process-closed-deal-backlog starting`,
  JSON.stringify(
    {
      batchSize,
      throttleMs,
      maxBatches: maxBatches ?? "unlimited",
      cursorKey,
      endpoint,
    },
    null,
    2
  )
)

let invocationIdx = 0
let totalProcessed = 0
let totalLeaseRecordsCreated = 0
let totalErrors = 0
const t0 = Date.now()

while (true) {
  if (shutdownRequested) {
    console.log(`[${new Date().toISOString()}] process-closed-deal-backlog stopped by operator (SIGINT)`)
    process.exit(0)
  }

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
        batchSize,
        throttleMs,
        // Pass maxBatches only when set; when unlimited, let the server
        // default apply (10 inner batches per call keeps individual HTTP
        // requests to ~30s and avoids Vercel's 60s serverless timeout).
        ...(maxBatches !== null ? { maxBatches } : { maxBatches: 10 }),
        cursorKey,
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
      `[invocation ${invocationIdx}] backlog returned error status=${response.status}:`,
      JSON.stringify(payload, null, 2)
    )
    process.exit(2)
  }

  const callDurationSec = ((Date.now() - callT0) / 1000).toFixed(1)
  totalProcessed += payload.processed ?? 0
  totalLeaseRecordsCreated += payload.leaseRecordsCreated ?? 0
  totalErrors += (payload.errors ?? []).length

  console.log(
    `[invocation ${invocationIdx}] ${callDurationSec}s — ` +
      `processed=${payload.processed} leaseRecordsCreated=${payload.leaseRecordsCreated} ` +
      `errors=${(payload.errors ?? []).length} ` +
      `stoppedReason=${payload.stoppedReason} ` +
      `cursor=${JSON.stringify(payload.cursor)}`
  )

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    for (const err of payload.errors) {
      console.warn(`  ! comm=${err.communicationId}: ${err.message}`)
    }
  }

  const stoppedReason = payload.stoppedReason

  if (stoppedReason === "complete") {
    const totalSec = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(
      `[${new Date().toISOString()}] process-closed-deal-backlog COMPLETE — ` +
        `invocations=${invocationIdx} processed=${totalProcessed} ` +
        `leaseRecordsCreated=${totalLeaseRecordsCreated} errors=${totalErrors} ` +
        `duration=${totalSec}s`
    )
    process.exit(0)
  }

  if (stoppedReason === "budget") {
    const totalSec = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(
      `[${new Date().toISOString()}] process-closed-deal-backlog stopped: budget — ` +
        `invocations=${invocationIdx} processed=${totalProcessed} ` +
        `leaseRecordsCreated=${totalLeaseRecordsCreated} errors=${totalErrors} ` +
        `duration=${totalSec}s — cursor persisted; re-run tomorrow`
    )
    process.exit(0)
  }

  if (stoppedReason === "error") {
    const totalSec = ((Date.now() - t0) / 1000).toFixed(1)
    console.error(
      `[${new Date().toISOString()}] process-closed-deal-backlog stopped: error — ` +
        `invocations=${invocationIdx} processed=${totalProcessed} ` +
        `leaseRecordsCreated=${totalLeaseRecordsCreated} errors=${totalErrors} ` +
        `duration=${totalSec}s — investigate logs before re-running`
    )
    process.exit(1)
  }

  if (stoppedReason === "max_batches") {
    // When the operator passed --max-batches we treat the outer loop as a
    // single invocation and exit. Without --max-batches we keep looping
    // (the server-side default of 10 inner batches per call is just a
    // chunking mechanism to keep HTTP timeouts manageable).
    if (maxBatches !== null) {
      const totalSec = ((Date.now() - t0) / 1000).toFixed(1)
      console.log(
        `[${new Date().toISOString()}] process-closed-deal-backlog stopped: max_batches — ` +
          `invocations=${invocationIdx} processed=${totalProcessed} ` +
          `leaseRecordsCreated=${totalLeaseRecordsCreated} errors=${totalErrors} ` +
          `duration=${totalSec}s`
      )
      process.exit(0)
    }
    // Unlimited mode: max_batches is just the server-side chunk cap; loop.
  }

  // Breather between outer invocations to avoid saturating the connection
  // pool between server-side inner-batch calls. The throttle-ms per-row
  // delay inside the orchestrator is the real rate-limit mechanism.
  await sleep(1500)
}

// --- Utilities ---

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
