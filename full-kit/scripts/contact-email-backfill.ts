// CLI driver for the contact mailbox backfill bulk runner.
//
// Usage:
//   cd full-kit
//   set -a && source .env.local && set +a
//   pnpm backfill:bulk                              # all zero-comm clients, deal-anchored
//   pnpm backfill:bulk --lifetime                   # all zero-comm clients, full mailbox
//   pnpm backfill:bulk --dry-run                    # discovery only, no ingest
//   pnpm backfill:bulk --limit=5                    # first N of the default cohort
//   pnpm backfill:bulk --ids=cid1,cid2              # explicit contacts
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

import { runBulkBackfill } from "../src/lib/contacts/mailbox-backfill/bulk-runner"

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
    const { db } = await import("../src/lib/prisma")
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

  // Per-contact progress logging: monkey-patch the bulk runner via a thin
  // wrapper. Easiest path is to re-wrap backfillMailboxForContact, but the
  // bulk-runner imports it directly. Instead we just iterate the input ids
  // ourselves when we have them, otherwise print a single "starting" line
  // and let the runner work — the result JSON has per-contact detail.
  let result
  if (contactIds && contactIds.length > 0) {
    // Process serially in our own loop so we can log progress, calling the
    // bulk runner once per id. This adds one parent BackfillRun per contact
    // which is noisier than ideal but gives the operator real-time feedback.
    // If quiet mode is desired, the API endpoint or a single bulk call is
    // available.
    const aggregated = {
      parentRunIds: [] as string[],
      totalContacts: contactIds.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      totalMessagesIngested: 0,
      totalScrubQueued: 0,
      failures: [] as Array<{ contactId: string; error: string }>,
      skips: [] as Array<{ contactId: string; reason: string }>,
      perContact: [] as Array<{
        contactId: string
        succeeded: number
        failed: number
        skipped: number
        ingested: number
        scrubQueued: number
      }>,
    }

    for (let i = 0; i < contactIds.length; i++) {
      const cid = contactIds[i]
      const t0 = Date.now()
      console.log(
        `[backfill] [${i + 1}/${contactIds.length}] processing ${cid}`
      )
      const r = await runBulkBackfill({
        contactIds: [cid],
        mode,
        dryRun,
        trigger: "cli",
        delayBetweenMs: 0,
      })
      aggregated.parentRunIds.push(r.parentRunId)
      aggregated.succeeded += r.succeeded
      aggregated.failed += r.failed
      aggregated.skipped += r.skipped
      aggregated.totalMessagesIngested += r.totalMessagesIngested
      aggregated.totalScrubQueued += r.totalScrubQueued
      aggregated.failures.push(...r.failures)
      aggregated.skips.push(...r.skips)
      aggregated.perContact.push({
        contactId: cid,
        succeeded: r.succeeded,
        failed: r.failed,
        skipped: r.skipped,
        ingested: r.totalMessagesIngested,
        scrubQueued: r.totalScrubQueued,
      })
      const took = ((Date.now() - t0) / 1000).toFixed(1)
      const status =
        r.succeeded > 0 ? "ok" : r.skipped > 0 ? "skipped" : "failed"
      console.log(
        `[backfill] [${i + 1}/${contactIds.length}] ${cid} ${status} in ${took}s — ingested=${r.totalMessagesIngested} scrub=${r.totalScrubQueued}`
      )
      // Throttle between contacts (skip after the last one).
      if (i < contactIds.length - 1) {
        await new Promise((res) => setTimeout(res, 500))
      }
    }
    result = aggregated
  } else {
    console.log(
      "[backfill] no --ids/--limit; delegating to default zero-comm cohort selector"
    )
    result = await runBulkBackfill({
      mode,
      dryRun,
      trigger: "cli",
      delayBetweenMs: 500,
    })
  }

  console.log("[backfill] complete", {
    totalContacts:
      "totalContacts" in result ? result.totalContacts : undefined,
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
