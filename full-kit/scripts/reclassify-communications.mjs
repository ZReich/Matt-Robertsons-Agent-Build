/**
 * Re-runs the current rule-based classifier against every email Communication
 * row and reports what would change. With --apply, writes the new
 * classification + tier1Rule + classifierRuleSetVersion to metadata so the
 * row's classifier version is recoverable going forward.
 *
 * Idempotent: re-running with the same classifier code is a no-op for any row
 * already stamped with the current ruleSetVersion.
 *
 * Why this exists:
 *   The 22.5k email rows ingested on 2026-04-23/24 were classified by an
 *   older revision of the rule set. Rules have shifted since (notably Buildout
 *   lead handling on 2026-04-27), but no version stamp existed on the rows.
 *   This script reclassifies in place and writes EMAIL_FILTER_RULE_SET_VERSION
 *   into metadata.classifierRuleSetVersion so future drift is auditable.
 *
 * The classifier (src/lib/msgraph/email-filter.ts:classifyEmail) takes
 *   (message: GraphEmailMessage, context: FilterContext)
 * not a flat field list. We reconstruct both shapes from stored metadata,
 * mirroring src/lib/msgraph/email-filter-audit-runner.ts which already does
 * this for the dry-run audit pipeline.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   node scripts/reclassify-communications.mjs            # dry-run
 *   node scripts/reclassify-communications.mjs --apply    # write
 *   node scripts/reclassify-communications.mjs --batch=500 --apply
 */

import { createJiti } from "jiti"
import path from "node:path"
import { fileURLToPath } from "node:url"

import pkg from "@prisma/client"
const { PrismaClient } = pkg

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// jiti lets us import the project's TypeScript modules directly without a
// build step. Path aliases (@/...) are not used in the classifier's import
// chain, so default jiti config is enough.
const jiti = createJiti(import.meta.url, { interopDefault: true })

const filterModule = await jiti.import(
  path.join(__dirname, "..", "src", "lib", "msgraph", "email-filter.ts")
)
const rulesModule = await jiti.import(
  path.join(__dirname, "..", "src", "lib", "msgraph", "email-filter-rules.ts")
)

const classifyEmail = filterModule.classifyEmail
const domainIsLargeCreBroker = filterModule.domainIsLargeCreBroker
const EMAIL_FILTER_RULE_SET_VERSION = rulesModule.EMAIL_FILTER_RULE_SET_VERSION

if (typeof classifyEmail !== "function") {
  throw new Error("Failed to load classifyEmail from email-filter.ts")
}
if (!EMAIL_FILTER_RULE_SET_VERSION) {
  throw new Error("Failed to load EMAIL_FILTER_RULE_SET_VERSION")
}

const args = process.argv.slice(2)
const apply = args.includes("--apply")
const batchSize = Number(
  args.find((a) => a.startsWith("--batch="))?.split("=")[1] ?? 1000
)

const TARGET_UPN =
  process.env.MSGRAPH_TARGET_UPN ??
  process.env.MSGRAPH_TARGETUPN ??
  process.env.GRAPH_TARGET_UPN ??
  ""

const db = new PrismaClient()

function metadataObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {}
}

function stringField(record, key) {
  const v = record[key]
  return typeof v === "string" ? v : null
}

function objectField(record, key) {
  const v = record[key]
  return v && typeof v === "object" && !Array.isArray(v) ? v : {}
}

function arrayObjectField(record, key) {
  const v = record[key]
  return Array.isArray(v) ? v : []
}

function booleanField(record, key) {
  return record[key] === true
}

/**
 * Rebuild the (message, context) pair classifyEmail expects from a stored
 * Communication row. Mirrors email-filter-audit-runner.ts so reclassification
 * sees the same inputs the audit pipeline would. Some hints (mattRepliedBefore,
 * threadSize) are taken from the previously persisted behavioralHints when
 * available, falling back to source-driven heuristics.
 */
function buildClassifierInputs(row) {
  const metadata = metadataObject(row.metadata)
  const conversationId = stringField(metadata, "conversationId")
  const storedSource = stringField(metadata, "source") ?? "layer-c"
  const from = objectField(metadata, "from")
  const senderAddress = stringField(from, "address") ?? ""
  const senderDomain = senderAddress.includes("@")
    ? senderAddress.split("@")[1]
    : undefined
  const toRecipients = arrayObjectField(metadata, "toRecipients")
  const ccRecipients = arrayObjectField(metadata, "ccRecipients")
  const storedHints = objectField(metadata, "behavioralHints")
  const hasListUnsubscribe = storedSource === "layer-b-unsubscribe-header"

  const message = {
    id: row.externalMessageId ?? row.id,
    internetMessageId: stringField(metadata, "internetMessageId") ?? undefined,
    conversationId: conversationId ?? undefined,
    parentFolderId: stringField(metadata, "parentFolderId") ?? undefined,
    subject: row.subject,
    receivedDateTime: row.date.toISOString(),
    toRecipients,
    ccRecipients,
    hasAttachments: booleanField(metadata, "hasAttachments"),
    importance: stringField(metadata, "importance") ?? "normal",
    isRead: booleanField(metadata, "isRead"),
    body: row.body
      ? { contentType: "text", content: row.body }
      : undefined,
    internetMessageHeaders: hasListUnsubscribe
      ? [{ name: "List-Unsubscribe", value: "stored-classification" }]
      : undefined,
  }

  const folder =
    row.direction === "outbound" ? "sentitems" : "inbox"

  // Prefer stored hints (computed at ingest time against full thread state);
  // fall back to source-driven inference for legacy rows that lack them.
  const mattRepliedBefore =
    typeof storedHints["mattRepliedBefore"] === "boolean"
      ? storedHints["mattRepliedBefore"]
      : storedSource === "known-counterparty" ||
        row.direction === "outbound"
  const senderInContacts =
    typeof storedHints["senderInContacts"] === "boolean"
      ? storedHints["senderInContacts"]
      : !!row.contactId || storedSource === "known-counterparty"
  const threadSize =
    typeof storedHints["threadSize"] === "number"
      ? storedHints["threadSize"]
      : storedSource === "known-counterparty"
        ? 2
        : 1

  const context = {
    folder,
    targetUpn: TARGET_UPN,
    normalizedSender: {
      address: senderAddress,
      displayName: stringField(from, "displayName") ?? "",
      isInternal: booleanField(from, "isInternal"),
      normalizationFailed: booleanField(metadata, "senderNormalizationFailed"),
    },
    hints: {
      senderInContacts,
      mattRepliedBefore,
      directOutboundCount:
        typeof storedHints["directOutboundCount"] === "number"
          ? storedHints["directOutboundCount"]
          : undefined,
      threadOutboundCount:
        typeof storedHints["threadOutboundCount"] === "number"
          ? storedHints["threadOutboundCount"]
          : undefined,
      threadSize,
      domainIsLargeCreBroker: domainIsLargeCreBroker(senderDomain),
    },
  }

  return { message, context }
}

async function main() {
  if (!TARGET_UPN) {
    console.warn(
      "Warning: MSGRAPH_TARGET_UPN env var not set. The 'nai-internal' rule depends on it; some rows that were originally signal may now miss that path. Set MSGRAPH_TARGET_UPN before --apply."
    )
  }

  const total = await db.communication.count({ where: { channel: "email" } })
  console.log(
    `Total email rows: ${total}; mode: ${apply ? "APPLY" : "DRY-RUN"}; batch: ${batchSize}; ruleSetVersion: ${EMAIL_FILTER_RULE_SET_VERSION}`
  )

  const counters = {
    examined: 0,
    skippedAlreadyCurrent: 0,
    classificationChanged: 0,
    tier1RuleChanged: 0,
    sourceChanged: 0,
    unchanged: 0,
    written: 0,
  }
  const transitions = new Map()
  const ruleTransitions = new Map()

  let cursor = null
  while (true) {
    const rows = await db.communication.findMany({
      where: { channel: "email" },
      select: {
        id: true,
        externalMessageId: true,
        subject: true,
        body: true,
        date: true,
        direction: true,
        metadata: true,
        contactId: true,
      },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1].id

    for (const row of rows) {
      counters.examined++
      const meta = metadataObject(row.metadata)
      const stampedVersion = meta["classifierRuleSetVersion"]
      if (stampedVersion === EMAIL_FILTER_RULE_SET_VERSION) {
        counters.skippedAlreadyCurrent++
        continue
      }

      const { message, context } = buildClassifierInputs(row)
      const result = classifyEmail(message, context)

      const oldCls = stringField(meta, "classification") ?? "unclassified"
      const oldRule = stringField(meta, "tier1Rule") ?? "unknown"
      const oldSource = stringField(meta, "source") ?? "unknown"
      const clsChanged = oldCls !== result.classification
      const ruleChanged = oldRule !== result.tier1Rule
      const srcChanged = oldSource !== result.source
      if (clsChanged) counters.classificationChanged++
      if (ruleChanged) counters.tier1RuleChanged++
      if (srcChanged) counters.sourceChanged++
      if (!clsChanged && !ruleChanged && !srcChanged) counters.unchanged++

      const tKey = `${oldCls}->${result.classification}`
      transitions.set(tKey, (transitions.get(tKey) ?? 0) + 1)
      if (ruleChanged) {
        const rKey = `${oldRule}->${result.tier1Rule}`
        ruleTransitions.set(rKey, (ruleTransitions.get(rKey) ?? 0) + 1)
      }

      if (apply) {
        await db.communication.update({
          where: { id: row.id },
          data: {
            metadata: {
              ...meta,
              classification: result.classification,
              source: result.source,
              tier1Rule: result.tier1Rule,
              classifierRuleSetVersion: EMAIL_FILTER_RULE_SET_VERSION,
              reclassifiedAt: new Date().toISOString(),
            },
          },
        })
        counters.written++
      }
    }

    process.stdout.write(`\rprocessed: ${counters.examined}/${total}`)
  }
  console.log("\n--- summary ---")
  console.log(
    JSON.stringify(
      {
        ruleSetVersion: EMAIL_FILTER_RULE_SET_VERSION,
        counters,
        transitions: Object.fromEntries(transitions),
        ruleTransitions: Object.fromEntries(ruleTransitions),
      },
      null,
      2
    )
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
