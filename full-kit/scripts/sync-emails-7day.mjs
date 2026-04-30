/**
 * Re-runs the MS Graph email sync for an end-to-end smoke test of the
 * deal-pipeline-backfill branch (Phase 4 extractors, Phase 5 lead → Deal,
 * Phase 8 Buildout stage proposals, Phase 9 contact role sync, Phase 10
 * buyer-rep tour/LOI signals).
 *
 * Bypasses the HTTP route (300s timeout). Calls syncEmails directly with
 * forceBootstrap=true so any saved delta cursor is ignored — every run
 * starts from the configured `daysBack` window. Per-page concurrency is
 * controlled by MSGRAPH_SYNC_CONCURRENCY env var (default 10).
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   node scripts/sync-emails-7day.mjs              # 7 days
 *   node scripts/sync-emails-7day.mjs --days=14    # 14 days
 *   MSGRAPH_SYNC_CONCURRENCY=5 node scripts/sync-emails-7day.mjs
 */

import { createJiti } from "jiti"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.join(__dirname, "..", "src")

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: { "@": SRC_DIR },
})

const emailsModule = await jiti.import(
  path.join(SRC_DIR, "lib", "msgraph", "emails.ts")
)
const syncEmails =
  emailsModule.syncEmails ?? emailsModule.default?.syncEmails

if (typeof syncEmails !== "function") {
  console.error("Could not resolve syncEmails export from emails.ts")
  process.exit(1)
}

const daysArg = process.argv.find((a) => a.startsWith("--days="))
const daysBack = daysArg ? Number.parseInt(daysArg.split("=")[1], 10) : 7
if (!Number.isFinite(daysBack) || daysBack < 1) {
  console.error(`invalid --days=${daysArg}`)
  process.exit(1)
}
const forceBootstrap = !process.argv.includes("--use-cursor")

const t0 = Date.now()
console.log(
  `[${new Date().toISOString()}] starting ${daysBack}-day MS Graph email sync (forceBootstrap=${forceBootstrap}, concurrency=${process.env.MSGRAPH_SYNC_CONCURRENCY ?? "default 10"})`
)

try {
  const result = await syncEmails({
    daysBack,
    forceBootstrap,
  })
  const durationSec = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n[${new Date().toISOString()}] sync finished in ${durationSec}s`)
  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  console.error("\nsync failed:")
  console.error(err)
  process.exitCode = 1
}
