/**
 * Reads tmp/scrub-results-<runId>.jsonl and feeds each row through the
 * existing scrub-validator + scrub-applier pipeline. The toolInput is
 * validated, then the validated result is split into scrubOutput +
 * suggestedActions to match applyScrubResult's actual signature. No
 * ScrubApiCall row is written (that's the real provider's job — the
 * subscription path bypasses token-budget tracking entirely; the runId is
 * the audit trail).
 *
 * Why the "extra" reconstruct step:
 *   applyScrubResult requires a full ScrubOutput shape (with modelUsed,
 *   promptVersion, scrubbedAt, tokens*, cacheHitTokens), but the validator
 *   returns only the structural fields (Omit<ScrubOutput, "modelUsed" |
 *   "promptVersion" | ...>). We synthesize the audit fields here using a
 *   subscription-path label and zeroed token counts. We also re-run
 *   `bindMarkTodoDoneActions` against fresh openTodos so any mark-todo-done
 *   actions in the JSONL get their payloads bound the same way scrubOne
 *   does — otherwise the applier will reject them.
 *
 * Each input JSONL line should look like:
 *   {
 *     "queueRowId": "...",
 *     "communicationId": "...",
 *     "leaseToken": "...",
 *     "toolInput": { ...record_email_scrub tool input... },
 *     "modelUsed": "claude-code-opus-4.7"  // optional audit label
 *   }
 *
 * Usage:
 *   cd full-kit
 *   set -a && source .env.local && set +a
 *   node scripts/scrub-import.mjs --runId=batch-001
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createJiti } from "jiti"
import pkg from "@prisma/client"

const { PrismaClient } = pkg

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fullKitRoot = path.resolve(__dirname, "..")

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: {
    "@": path.join(fullKitRoot, "src"),
  },
})

const validatorModule = await jiti.import(
  path.join(fullKitRoot, "src", "lib", "ai", "scrub-validator.ts")
)
const applierModule = await jiti.import(
  path.join(fullKitRoot, "src", "lib", "ai", "scrub-applier.ts")
)
const linkerModule = await jiti.import(
  path.join(fullKitRoot, "src", "lib", "ai", "scrub-linker.ts")
)
const scrubModule = await jiti.import(
  path.join(fullKitRoot, "src", "lib", "ai", "scrub.ts")
)
const typesModule = await jiti.import(
  path.join(fullKitRoot, "src", "lib", "ai", "scrub-types.ts")
)

const { validateScrubToolInput, ScrubValidationError } = validatorModule
const { applyScrubResult } = applierModule
const {
  runHeuristicLinker,
  loadOpenTodoCandidates,
  hasThreadOutboundEvidence,
} = linkerModule
const { bindMarkTodoDoneActions } = scrubModule
const { PROMPT_VERSION } = typesModule

if (typeof validateScrubToolInput !== "function") {
  throw new Error("Failed to load validateScrubToolInput")
}
if (typeof applyScrubResult !== "function") {
  throw new Error("Failed to load applyScrubResult")
}
if (typeof bindMarkTodoDoneActions !== "function") {
  throw new Error("Failed to load bindMarkTodoDoneActions")
}

const args = process.argv.slice(2)
const runId = args.find((a) => a.startsWith("--runId="))?.split("=")[1]
if (!runId) {
  console.error("--runId required")
  process.exit(1)
}

// Mode controls whether per-action validation failures throw (strict) or
// drop the bad action and keep the row (relaxed). For the subscription
// review path we default strict — the operator should fix the row in the
// results JSONL rather than silently dropping actions.
const mode = args.includes("--relaxed") ? "relaxed" : "strict"

const db = new PrismaClient()

async function processOne(line) {
  const parsed = JSON.parse(line)
  const {
    queueRowId,
    communicationId,
    leaseToken,
    toolInput,
    modelUsed = "claude-code-subscription",
  } = parsed

  if (!queueRowId || !communicationId || !leaseToken || !toolInput) {
    throw new Error(
      `missing required fields in result row (queueRowId/communicationId/leaseToken/toolInput)`
    )
  }

  let validated
  try {
    validated = validateScrubToolInput(toolInput, { mode })
  } catch (err) {
    if (err instanceof ScrubValidationError) {
      return { kind: "validationFailed", communicationId, message: err.message }
    }
    throw err
  }

  // Reconstruct the same source context scrubOne uses to bind mark-todo-done
  // payloads. Without this, any mark-todo-done action in the JSONL will be
  // rejected by the applier (or — worse — applied with a prompt-supplied
  // todoId that wasn't validated against the open-todo set).
  const comm = await db.communication.findUnique({
    where: { id: communicationId },
    select: {
      id: true,
      subject: true,
      body: true,
      date: true,
      metadata: true,
      conversationId: true,
      direction: true,
      contactId: true,
      dealId: true,
    },
  })
  if (!comm) {
    return {
      kind: "error",
      communicationId,
      message: "communication vanished after export",
    }
  }

  const matches = await runHeuristicLinker(comm)
  const [openTodos, threadHasOutboundEvidence] = await Promise.all([
    loadOpenTodoCandidates(comm, matches),
    hasThreadOutboundEvidence(comm),
  ])

  const boundActions = bindMarkTodoDoneActions(
    validated.suggestedActions,
    openTodos,
    {
      communicationId: comm.id,
      communicationDate: comm.date,
      direction: comm.direction,
      hasThreadOutboundEvidence: threadHasOutboundEvidence,
    }
  )

  await applyScrubResult({
    communicationId,
    queueRowId,
    leaseToken,
    scrubOutput: {
      ...validated.scrubOutput,
      modelUsed,
      promptVersion: PROMPT_VERSION,
      scrubbedAt: new Date().toISOString(),
      // Subscription-path token counters are zero by design — the real
      // provider writes ScrubApiCall rows; we bypass that audit row.
      tokensIn: 0,
      tokensOut: 0,
      cacheHitTokens: 0,
    },
    suggestedActions: boundActions,
  })

  return {
    kind: "applied",
    communicationId,
    droppedActions: validated.droppedActions,
    actionsApplied: boundActions.length,
  }
}

async function main() {
  const inPath = path.join(fullKitRoot, "tmp", `scrub-results-${runId}.jsonl`)
  const content = readFileSync(inPath, "utf8")
  const lines = content.split("\n").filter(Boolean)
  console.log(`Importing ${lines.length} results from ${inPath} (mode=${mode})`)

  const counters = {
    applied: 0,
    validationFailed: 0,
    errors: 0,
    droppedActions: 0,
  }
  for (const line of lines) {
    try {
      const result = await processOne(line)
      if (result.kind === "applied") {
        counters.applied++
        counters.droppedActions += result.droppedActions ?? 0
      } else if (result.kind === "validationFailed") {
        counters.validationFailed++
        console.error(
          `Validation failed for ${result.communicationId}: ${result.message}`
        )
      } else {
        counters.errors++
        console.error(`Error for ${result.communicationId}: ${result.message}`)
      }
    } catch (err) {
      counters.errors++
      console.error("Import error:", err instanceof Error ? err.message : err)
    }
  }
  console.log(JSON.stringify(counters, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
