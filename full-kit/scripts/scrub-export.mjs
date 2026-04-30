/**
 * Claims N pending scrub queue rows (or specific communicationIds), builds
 * the same perEmailPrompt + globalMemory the real provider uses, and writes
 * a JSONL to tmp/scrub-batch-<runId>.jsonl. The Claude Code session reads
 * that file and writes a results JSONL.
 *
 * Why this exists:
 *   Phase 11 of the deal-pipeline-and-ai-backfill plan needs a way to
 *   validate AI scrub output quality on 50-100 representative emails BEFORE
 *   committing to bulk API spend. The user drives the AI in-conversation via
 *   their Claude Code subscription ($0 marginal cost). This script + its
 *   companion `scrub-import.mjs` are the file-handoff between the DB-side
 *   queue/applier pipeline and the in-conversation operator.
 *
 * The subscription path bypasses the `ScrubApiCall` audit row entirely
 * (that's the real provider's job — claude.ts / openai.ts). The runId in the
 * batch filenames + the commit log are the equivalent audit trail.
 *
 * Usage:
 *   cd full-kit
 *   set -a && source .env.local && set +a
 *   node scripts/scrub-export.mjs --limit=25 --runId=batch-001
 *   node scripts/scrub-export.mjs --communicationIds=id1,id2,id3 --runId=batch-002
 */

import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createJiti } from "jiti"
import pkg from "@prisma/client"

const { PrismaClient } = pkg

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fullKitRoot = path.resolve(__dirname, "..")

// jiti loads project TS modules at runtime so we can reuse claimScrubQueueRows
// and buildPromptInputs without a build step. The `alias` config maps the
// `@/...` tsconfig path so the AI module's `import { db } from "@/lib/prisma"`
// resolves correctly.
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: {
    "@": path.join(fullKitRoot, "src"),
  },
})

const queueModule = await jiti.import(
  path.join(fullKitRoot, "src", "lib", "ai", "scrub-queue.ts")
)
const scrubModule = await jiti.import(
  path.join(fullKitRoot, "src", "lib", "ai", "scrub.ts")
)

const { claimScrubQueueRows } = queueModule
const { buildPromptInputs } = scrubModule

if (typeof claimScrubQueueRows !== "function") {
  throw new Error("Failed to load claimScrubQueueRows from scrub-queue.ts")
}
if (typeof buildPromptInputs !== "function") {
  throw new Error("Failed to load buildPromptInputs from scrub.ts")
}

const args = process.argv.slice(2)
const limit = Number(
  args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 25
)
const idsArg = args.find((a) => a.startsWith("--communicationIds="))
const ids = idsArg ? idsArg.split("=")[1].split(",").filter(Boolean) : null
const runId =
  args.find((a) => a.startsWith("--runId="))?.split("=")[1] ??
  `batch-${Date.now()}`

const db = new PrismaClient()

async function main() {
  const claimArgs = { limit }
  if (ids) claimArgs.communicationIds = ids

  const claimed = await claimScrubQueueRows(claimArgs)
  if (claimed.length === 0) {
    console.log("Nothing to claim.")
    return
  }

  const tmpDir = path.join(fullKitRoot, "tmp")
  mkdirSync(tmpDir, { recursive: true })
  const outPath = path.join(tmpDir, `scrub-batch-${runId}.jsonl`)

  const lines = []
  for (const claim of claimed) {
    const inputs = await buildPromptInputs(claim.communicationId)
    lines.push(
      JSON.stringify({
        queueRowId: claim.id,
        communicationId: claim.communicationId,
        leaseToken: claim.leaseToken,
        promptVersion: inputs.promptVersion,
        perEmailPrompt: inputs.perEmailPrompt,
        globalMemory: inputs.globalMemory,
        scrubToolSchema: inputs.scrubToolSchema,
      })
    )
  }
  writeFileSync(outPath, lines.join("\n") + "\n")
  console.log(`Wrote ${lines.length} rows to ${outPath}`)
  console.log(`runId: ${runId}`)
  console.log(
    `Note: queue rows are now in_flight with leases. Either produce results ` +
      `JSONL and run scrub-import.mjs --runId=${runId}, or wait for the ` +
      `lease to expire (default 5 min) before re-claiming.`
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
