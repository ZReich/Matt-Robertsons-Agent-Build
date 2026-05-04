#!/usr/bin/env node
/**
 * backfill-property-collapse — operator wrapper around the route at
 * `/api/lease/backfill-property-collapse`.
 *
 * The endpoint walks every Deal with `created_by='buildout-csv-import'` and
 * reassigns each one to the canonical `(propertyKey, unit)` Property,
 * splitting out new Property rows from the legacy collapsed `unit=NULL`
 * parents and archiving the now-orphaned parents.
 *
 * Run dry-run first:
 *   set -a && source .env.local && set +a
 *   node scripts/backfill-property-collapse.mjs --dry-run
 *   node scripts/backfill-property-collapse.mjs --dry-run --limit=20
 *
 * Then the real run:
 *   node scripts/backfill-property-collapse.mjs
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

const dryRun = args["dry-run"] === "true"
const limit = parseOptionalInt(args.limit)
const throttleMs = parseOptionalInt(args["throttle-ms"])

if (!adminToken) {
  console.error("MSGRAPH_TEST_ADMIN_TOKEN must be set in the environment")
  process.exit(1)
}

const endpoint = `${baseUrl}/api/lease/backfill-property-collapse`

console.log(
  `[${new Date().toISOString()}] backfill-property-collapse starting`,
  JSON.stringify({ endpoint, dryRun, limit, throttleMs }, null, 2)
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
    body: JSON.stringify(pruneUndefined({ dryRun, limit, throttleMs })),
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
    `backfill returned error status=${response.status}:`,
    JSON.stringify(payload, null, 2)
  )
  process.exit(2)
}

const durationSec = ((Date.now() - callT0) / 1000).toFixed(1)

console.log(
  `\n[${new Date().toISOString()}] backfill complete in ${durationSec}s\n` +
    `  dryRun:                ${payload.dryRun}\n` +
    `  dealsConsidered:       ${payload.dealsConsidered ?? 0}\n` +
    `  dealsReassigned:       ${payload.dealsReassigned ?? 0}\n` +
    `  dealsAlreadyCanonical: ${payload.dealsAlreadyCanonical ?? 0}\n` +
    `  propertiesCreated:     ${payload.propertiesCreated ?? 0}\n` +
    `  propertiesArchived:    ${payload.propertiesArchived ?? 0}\n` +
    `  errors:                ${(payload.errors ?? []).length}`
)

if (Array.isArray(payload.errors) && payload.errors.length > 0) {
  console.log("\nErrors:")
  for (const e of payload.errors) {
    console.log(
      `  ${e.dealId ?? e.propertyId ?? "(global)"}: ${e.reason}`
    )
  }
}

if (Array.isArray(payload.reassignments) && payload.reassignments.length > 0) {
  const limitToShow = 20
  console.log(
    `\nReassignments (showing first ${Math.min(
      limitToShow,
      payload.reassignments.length
    )}):`
  )
  for (const r of payload.reassignments.slice(0, limitToShow)) {
    console.log(
      `  deal=${r.dealId} ${r.fromPropertyId ?? "(none)"} -> ${r.toPropertyId}` +
        ` key=${r.propertyKey} unit=${r.unit ?? "(none)"}` +
        ` lr=${r.leaseRecordsUpdated} ce=${r.calendarEventsUpdated}` +
        (r.createdNewProperty ? " [NEW]" : "")
    )
  }
}

if (Array.isArray(payload.archived) && payload.archived.length > 0) {
  const limitToShow = 20
  console.log(
    `\nArchived properties (showing first ${Math.min(
      limitToShow,
      payload.archived.length
    )}):`
  )
  for (const a of payload.archived.slice(0, limitToShow)) {
    console.log(
      `  ${a.propertyId} key=${a.propertyKey} addr="${a.address}"` +
        ` unit=${a.unit ?? "(none)"}`
    )
  }
}

if (payload.stoppedEarlyReason) {
  console.error(`\nSTOPPED EARLY: ${payload.stoppedEarlyReason}`)
  process.exit(3)
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
