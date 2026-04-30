// Drives runLeadApplyBackfill from the deal-pipeline-backfill branch to
// validate Phase 5 (lead → Deal) + Phase 8.4 (Buildout stage proposal)
// against the partial 7-day corpus.
//
// Usage:
//   set -a && source .env.local && set +a
//   node scripts/run-lead-apply.mjs --dry-run
//   node scripts/run-lead-apply.mjs --apply

import { createJiti } from "jiti"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.join(__dirname, "..", "src")

const apply = process.argv.includes("--apply")

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: { "@": SRC_DIR },
})

const mod = await jiti.import(
  path.join(SRC_DIR, "lib", "backfill", "lead-apply-backfill.ts")
)
const runLeadApplyBackfill = mod.runLeadApplyBackfill ?? mod.default?.runLeadApplyBackfill
if (typeof runLeadApplyBackfill !== "function") {
  console.error("runLeadApplyBackfill export not found")
  process.exit(1)
}

const t0 = Date.now()
console.log(
  `[${new Date().toISOString()}] running lead-apply-backfill (mode=${apply ? "apply" : "dry-run"})`
)

const runId = `lead-apply-validation-${new Date().toISOString().replace(/[:.]/g, "-")}`
const limit = apply ? 100 : 5000
let cursor = null
let pass = 0
let totalScanned = 0
const aggregate = {
  createdLeadContacts: 0,
  createdSenderContacts: 0,
  createdContactCandidates: 0,
  markedExistingContacts: 0,
  communicationLinked: 0,
  byOutcome: {},
}
while (true) {
  pass++
  const result = await runLeadApplyBackfill({
    request: { dryRun: !apply, limit, runId, cursor },
  })
  totalScanned += result.scanned
  aggregate.createdLeadContacts += result.createdLeadContacts
  aggregate.createdSenderContacts += result.createdSenderContacts
  aggregate.createdContactCandidates += result.createdContactCandidates
  aggregate.markedExistingContacts += result.markedExistingContacts
  aggregate.communicationLinked += result.communicationLinked
  for (const [k, v] of Object.entries(result.byOutcome)) {
    aggregate.byOutcome[k] = (aggregate.byOutcome[k] ?? 0) + v
  }
  console.log(
    `  pass ${pass}: scanned=${result.scanned} cursor=${result.nextCursor?.slice(0, 8) ?? "none"}`
  )
  if (!result.nextCursor) break
  if (result.nextCursor === cursor) {
    console.log("  cursor did not advance — stopping to avoid infinite loop")
    break
  }
  cursor = result.nextCursor
  if (!apply) break // dry-run only does one pass
}
const durationSec = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`\n[${new Date().toISOString()}] finished ${pass} pass(es) in ${durationSec}s\n`)
console.log(
  JSON.stringify({ runId, passes: pass, totalScanned, ...aggregate }, null, 2)
)
