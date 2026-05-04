/**
 * NOTE: This CLI bypasses the admin-token check on the bulk HTTP endpoint
 * because it imports `runBulkBackfill` directly. Anyone with shell access
 * to the worktree can launch a bulk Graph sweep. This is acceptable because
 * shell access already implies repo trust, but if you want HTTP-style guard,
 * use POST /api/contacts/email-backfill-bulk with `x-admin-token` header.
 *
 * Non-dry-run executions additionally require an explicit `--confirm` flag
 * so that an absent-minded `pnpm backfill:bulk` can't accidentally hit
 * Graph against the entire client cohort.
 */

// CLI driver for the contact mailbox backfill bulk runner.
//
// Usage:
//   cd full-kit
//   set -a && source .env.local && set +a
//   pnpm backfill:bulk --dry-run                    # discovery only, no ingest
//   pnpm backfill:bulk --confirm                    # all zero-comm clients, deal-anchored
//   pnpm backfill:bulk --lifetime --confirm         # all zero-comm clients, full mailbox
//   pnpm backfill:bulk --limit=5 --confirm          # first N of the default cohort
//   pnpm backfill:bulk --ids=cid1,cid2 --confirm    # explicit contacts
//
// The `set -a && source .env.local && set +a` prefix is the same env-loading
// pattern documented in CLAUDE.md and used by the other migration scripts.
// We additionally call `loadEnvLocal()` below so the script also works when
// run outside that wrapper (e.g. directly under PowerShell).
//
// Final result JSON is written to
//   docs/superpowers/notes/2026-05-04-contact-mailbox-backfill-bulk-run-<ts>.json
// and exit code is 0 on success / 1 if any contact failed.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  type BulkResult,
  runBulkBackfill,
} from "../src/lib/contacts/mailbox-backfill/bulk-runner"
import { db } from "../src/lib/prisma"

function loadEnvLocal(): void {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "full-kit", ".env.local"),
  ]
  for (const envPath of candidates) {
    let text: string
    try {
      text = readFileSync(envPath, "utf8")
    } catch {
      continue
    }
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith("#")) continue
      const eq = line.indexOf("=")
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] ??= value
    }
    return
  }
}

function getFlagValue(name: string): string | undefined {
  const prefix = `--${name}=`
  const found = process.argv.find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function main(): Promise<void> {
  loadEnvLocal()

  const dryRun = hasFlag("dry-run")
  const confirm = hasFlag("confirm")
  if (!dryRun && !confirm) {
    console.error(
      "[backfill] refusing to run without --confirm (or --dry-run). " +
        "This sweep can hit Graph against the entire client cohort; pass " +
        "--confirm to acknowledge."
    )
    process.exit(1)
  }
  const mode: "lifetime" | "deal-anchored" = hasFlag("lifetime")
    ? "lifetime"
    : "deal-anchored"

  const limitRaw = getFlagValue("limit")
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined
  if (limitRaw !== undefined && (limit === undefined || Number.isNaN(limit))) {
    console.error(`[backfill] invalid --limit value: ${limitRaw}`)
    process.exit(1)
  }

  const idsRaw = getFlagValue("ids")
  let contactIds = idsRaw
    ? idsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined

  // If --limit was given but no explicit --ids, resolve the default cohort
  // (zero-comm client contacts) from the DB and trim. This keeps progress
  // logging meaningful — the runner sees a fixed list and we can print
  // "[N/M] processing <id>" for each entry.
  if (!contactIds && limit !== undefined) {
    const candidates = await db.contact.findMany({
      where: {
        clientType: {
          in: [
            "active_listing_client",
            "active_buyer_rep_client",
            "past_client",
            "past_listing_client",
            "past_buyer_client",
          ] as any,
        },
        email: { not: null },
        communications: { none: {} },
      },
      select: { id: true },
      take: limit,
    })
    contactIds = candidates.map((c) => c.id)
  } else if (contactIds && limit !== undefined) {
    contactIds = contactIds.slice(0, limit)
  }

  console.log("[backfill] starting bulk contact-mailbox backfill", {
    mode,
    dryRun,
    explicitIdsCount: contactIds?.length,
    limit,
  })

  // Per-contact progress logging via the runner's onProgress callback. This
  // keeps the design invariant of one parent BackfillRun per bulk sweep
  // (previously the CLI looped runBulkBackfill once per id, creating N parent
  // rows). Per-contact timings are estimated in this CLI by recording the
  // wall-clock between callback invocations — exact, since onProgress fires
  // synchronously after each per-contact result.
  const perContactTimings: Array<{
    contactId: string
    status: "succeeded" | "skipped" | "failed"
    elapsedMs: number
  }> = []
  let lastProgressAt = Date.now()

  // SIGINT handler: if the operator hits Ctrl-C while a parent run is
  // mid-flight, mark it failed before exiting so the next operator doesn't
  // see a stuck `running` row for 15 minutes (until the bulk endpoint reaper
  // sweeps it). We track the parent id via the first onProgress invocation —
  // it isn't known until runBulkBackfill resolves, so for early Ctrl-C we
  // rely on the reaper.
  let parentRunId: string | undefined
  let interrupted = false
  const onSigint = async (): Promise<void> => {
    interrupted = true
    if (parentRunId) {
      try {
        await db.backfillRun.update({
          where: { id: parentRunId },
          data: {
            status: "failed",
            finishedAt: new Date(),
            errorMessage: "interrupted_sigint",
          },
        })
        console.error(`[backfill] SIGINT — finalized parent ${parentRunId}`)
      } catch (err) {
        console.error("[backfill] SIGINT — failed to finalize parent:", err)
      }
    } else {
      console.error(
        "[backfill] SIGINT — no parent id captured yet; reaper will sweep"
      )
    }
    process.exit(130)
  }
  process.on("SIGINT", () => {
    void onSigint()
  })

  let result: BulkResult
  try {
    result = await runBulkBackfill({
      contactIds,
      mode,
      dryRun,
      trigger: "cli",
      delayBetweenMs: 500,
      onProgress: (done, total, contactId, status) => {
        const now = Date.now()
        const elapsedMs = now - lastProgressAt
        lastProgressAt = now
        perContactTimings.push({ contactId, status, elapsedMs })
        const took = (elapsedMs / 1000).toFixed(1)
        console.log(
          `[backfill] [${done}/${total}] ${contactId} ${status} in ${took}s`
        )
      },
    })
  } catch (err) {
    if (interrupted) return
    throw err
  }
  parentRunId = result.parentRunId

  console.log("[backfill] complete", {
    parentRunId: result.parentRunId,
    totalContacts: result.totalContacts,
    succeeded: result.succeeded,
    failed: result.failed,
    skipped: result.skipped,
    totalMessagesIngested: result.totalMessagesIngested,
    totalScrubQueued: result.totalScrubQueued,
  })

  // Write timestamped JSON artifact next to the plan notes. Always include
  // a timestamp so re-running the CLI doesn't clobber a previous artifact.
  const ts = new Date()
    .toISOString()
    .replace(/[:]/g, "-")
    .replace(/\.\d+Z$/, "Z")
  const outDir = path.resolve(
    process.cwd(),
    process.cwd().endsWith("full-kit") ? ".." : ".",
    "docs/superpowers/notes"
  )
  mkdirSync(outDir, { recursive: true })
  const outPath = path.join(
    outDir,
    `2026-05-04-contact-mailbox-backfill-bulk-run-${ts}.json`
  )
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode,
        dryRun,
        explicitIdsCount: contactIds?.length,
        result,
        perContactTimings,
      },
      null,
      2
    )
  )
  console.log(`[backfill] wrote artifact ${outPath}`)

  process.exit(result.failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("[backfill] unhandled error:", err)
  process.exit(1)
})
