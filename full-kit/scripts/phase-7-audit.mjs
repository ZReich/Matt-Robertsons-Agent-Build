/**
 * Phase 7 audit — verifies the move-deal-stage / update-deal / create-deal
 * AgentAction handlers actually round-trip approve → execute.
 *
 * Synthesizes pending AgentAction rows against real Deal IDs, calls
 * approveAgentAction directly (the same code path the API route invokes),
 * and asserts the side-effects landed on the DB.
 *
 * Idempotent — rolls deals back to their pre-test stage at the end and
 * deletes the synthesized AgentActions.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   node scripts/phase-7-audit.mjs
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

const agentActionsMod = await jiti.import(
  path.join(SRC_DIR, "lib", "ai", "agent-actions.ts")
)
const approveAgentAction =
  agentActionsMod.approveAgentAction ?? agentActionsMod.default?.approveAgentAction
const AgentActionReviewError =
  agentActionsMod.AgentActionReviewError ?? agentActionsMod.default?.AgentActionReviewError
if (!approveAgentAction || !AgentActionReviewError) {
  console.error("could not resolve approveAgentAction / AgentActionReviewError")
  process.exit(1)
}

const { PrismaClient } = await import("@prisma/client")
const db = new PrismaClient()

const findings = []

function record(name, ok, detail) {
  findings.push({ name, ok, detail })
  const icon = ok ? "  ok" : "FAIL"
  console.log(`[${icon}] ${name}${detail ? " — " + detail : ""}`)
}

async function audit_moveDealStage() {
  const deal = await db.deal.findFirst({
    where: { stage: "marketing", archivedAt: null },
    select: { id: true, stage: true, stageChangedAt: true },
  })
  if (!deal) {
    record("A.1 move-deal-stage", false, "no marketing deal available")
    return
  }
  const originalStage = deal.stage
  const originalStageChangedAt = deal.stageChangedAt
  let actionId = null
  let cleanupAction = null
  try {
    const action = await db.agentAction.create({
      data: {
        actionType: "move-deal-stage",
        status: "pending",
        tier: "approve",
        summary: "[audit] move marketing → showings",
        payload: {
          dealId: deal.id,
          fromStage: "marketing",
          toStage: "showings",
          reason: "Phase 7 audit",
        },
      },
    })
    actionId = action.id
    const result = await approveAgentAction({ id: actionId, reviewer: "audit" })
    if (result.status !== "executed") {
      record("A.1 move-deal-stage", false, `unexpected status ${result.status}`)
      return
    }
    const after = await db.deal.findUnique({
      where: { id: deal.id },
      select: { stage: true, stageChangedAt: true },
    })
    const reread = await db.agentAction.findUnique({ where: { id: actionId } })
    const stageOk = after?.stage === "showings"
    const stampOk = !!after?.stageChangedAt && after.stageChangedAt !== originalStageChangedAt
    const actionStatusOk = reread?.status === "executed" && !!reread?.executedAt
    record(
      "A.1.a move-deal-stage executes",
      stageOk && stampOk && actionStatusOk,
      `stage=${after?.stage} stageChangedAt=${after?.stageChangedAt?.toISOString()} action.status=${reread?.status}`
    )

    // Concurrency guard: action's fromStage no longer matches.
    cleanupAction = await db.agentAction.create({
      data: {
        actionType: "move-deal-stage",
        status: "pending",
        tier: "approve",
        summary: "[audit] stage-mismatch probe",
        payload: {
          dealId: deal.id,
          fromStage: "marketing", // wrong — deal is now "showings"
          toStage: "offer",
          reason: "Phase 7 audit",
        },
      },
    })
    let mismatchOk = false
    let mismatchDetail = "no error"
    try {
      await approveAgentAction({ id: cleanupAction.id, reviewer: "audit" })
    } catch (err) {
      mismatchOk =
        err instanceof AgentActionReviewError &&
        err.status === 409 &&
        err.code === "stage_mismatch"
      mismatchDetail = `${err?.constructor?.name} status=${err?.status} code=${err?.code}`
    }
    record("A.1.b stage-mismatch returns 409", mismatchOk, mismatchDetail)
  } finally {
    // Roll back deal stage and stage timestamp.
    await db.deal.update({
      where: { id: deal.id },
      data: { stage: originalStage, stageChangedAt: originalStageChangedAt },
    })
    if (actionId)
      await db.agentAction.delete({ where: { id: actionId } }).catch(() => {})
    if (cleanupAction)
      await db.agentAction.delete({ where: { id: cleanupAction.id } }).catch(() => {})
  }
}

async function audit_updateDeal() {
  const deal = await db.deal.findFirst({
    where: { archivedAt: null },
    select: { id: true, value: true, probability: true, closingDate: true },
  })
  if (!deal) {
    record("A.2 update-deal", false, "no deal available")
    return
  }
  const original = { value: deal.value, probability: deal.probability, closingDate: deal.closingDate }
  let actionId = null
  try {
    const action = await db.agentAction.create({
      data: {
        actionType: "update-deal",
        status: "pending",
        tier: "approve",
        summary: "[audit] patch value/probability/closingDate",
        payload: {
          dealId: deal.id,
          fields: {
            value: 1234567,
            probability: 60,
            closingDate: "2026-12-31T00:00:00.000Z",
          },
          reason: "Phase 7 audit",
        },
      },
    })
    actionId = action.id
    const result = await approveAgentAction({ id: actionId, reviewer: "audit" })
    if (result.status !== "executed") {
      record("A.2.a update-deal", false, `unexpected status ${result.status}`)
      return
    }
    const after = await db.deal.findUnique({
      where: { id: deal.id },
      select: { value: true, probability: true, closingDate: true },
    })
    const reread = await db.agentAction.findUnique({ where: { id: actionId } })
    const ok =
      String(after?.value) === "1234567" &&
      Number(after?.probability) === 60 &&
      after?.closingDate?.toISOString() === "2026-12-31T00:00:00.000Z" &&
      reread?.status === "executed"
    record(
      "A.2.a update-deal executes",
      ok,
      `value=${after?.value} probability=${after?.probability} closingDate=${after?.closingDate?.toISOString()}`
    )

    // Forbidden-field probe.
    const bad = await db.agentAction.create({
      data: {
        actionType: "update-deal",
        status: "pending",
        tier: "approve",
        summary: "[audit] forbidden-field probe",
        payload: {
          dealId: deal.id,
          fields: { stage: "closed" }, // not in ALLOWED_UPDATE_FIELDS
          reason: "Phase 7 audit",
        },
      },
    })
    let forbiddenOk = false
    let forbiddenDetail = ""
    try {
      await approveAgentAction({ id: bad.id, reviewer: "audit" })
    } catch (err) {
      forbiddenOk =
        err instanceof AgentActionReviewError &&
        err.status === 400 &&
        err.code === "forbidden_update_field"
      forbiddenDetail = `${err?.constructor?.name} status=${err?.status} code=${err?.code}`
    }
    record("A.2.b update-deal forbidden-field rejected", forbiddenOk, forbiddenDetail)
    await db.agentAction.delete({ where: { id: bad.id } }).catch(() => {})
  } finally {
    await db.deal.update({
      where: { id: deal.id },
      data: original,
    })
    if (actionId)
      await db.agentAction.delete({ where: { id: actionId } }).catch(() => {})
  }
}

async function audit_createDeal() {
  // Synthesize a buyer_rep deal targeting a brand-new contact (find-or-create branch).
  const probeEmail = `phase7-audit-${Date.now()}@example.invalid`
  let actionId = null
  let createdDealId = null
  let createdContactId = null
  try {
    const action = await db.agentAction.create({
      data: {
        actionType: "create-deal",
        status: "pending",
        tier: "approve",
        summary: "[audit] create buyer-rep deal",
        payload: {
          recipientEmail: probeEmail,
          recipientDisplayName: "Phase 7 Audit",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "prospecting",
          reason: "Phase 7 audit",
        },
      },
    })
    actionId = action.id
    const result = await approveAgentAction({ id: actionId, reviewer: "audit" })
    if (result.status !== "executed") {
      record("A.2.c create-deal", false, `unexpected status ${result.status}`)
      return
    }
    createdDealId = result.todoId
    const deal = await db.deal.findUnique({
      where: { id: createdDealId },
      select: { id: true, dealType: true, dealSource: true, stage: true, contactId: true },
    })
    const contact = deal?.contactId
      ? await db.contact.findUnique({
          where: { id: deal.contactId },
          select: { id: true, email: true, name: true },
        })
      : null
    if (contact) createdContactId = contact.id
    const reread = await db.agentAction.findUnique({ where: { id: actionId } })
    const ok =
      deal?.dealType === "buyer_rep" &&
      deal?.dealSource === "buyer_rep_inferred" &&
      deal?.stage === "prospecting" &&
      contact?.email === probeEmail &&
      reread?.status === "executed"
    record(
      "A.2.c create-deal executes (find-or-create contact)",
      ok,
      `deal=${createdDealId} contact=${contact?.email} action.status=${reread?.status}`
    )
  } finally {
    if (createdDealId) await db.deal.delete({ where: { id: createdDealId } }).catch(() => {})
    if (createdContactId) await db.contact.delete({ where: { id: createdContactId } }).catch(() => {})
    if (actionId) await db.agentAction.delete({ where: { id: actionId } }).catch(() => {})
  }
}

async function audit_existingPendingCreateDeals() {
  const rows = await db.agentAction.findMany({
    where: { actionType: "create-deal", status: "pending" },
    select: {
      id: true,
      summary: true,
      payload: true,
      sourceCommunicationId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  })
  console.log("\n--- 3 sample pending create-deal payloads ---")
  for (const r of rows) {
    console.log(JSON.stringify({ id: r.id, summary: r.summary, sourceCommunicationId: r.sourceCommunicationId, payload: r.payload }, null, 2))
  }
  // Also: distinct dealType / signalType breakdown across all 306.
  const breakdown = await db.$queryRawUnsafe(`
    SELECT
      payload->>'dealType' AS deal_type,
      payload->>'signalType' AS signal_type,
      payload->>'dealSource' AS deal_source,
      COUNT(*)::int AS n
    FROM "agent_actions"
    WHERE "action_type" = 'create-deal' AND "status" = 'pending'
    GROUP BY 1,2,3
    ORDER BY n DESC
  `)
  console.log("--- breakdown of all 306 pending create-deal payloads ---")
  console.table(breakdown)

  // Flag duplicates: pending create-deal where a Deal with the same contact + dealType already exists.
  const dupCount = await db.$queryRawUnsafe(`
    WITH pending AS (
      SELECT id, payload->>'contactId' AS contact_id, payload->>'dealType' AS deal_type
      FROM "agent_actions"
      WHERE "action_type" = 'create-deal' AND "status" = 'pending'
    )
    SELECT COUNT(*)::int AS dup_count
    FROM pending p
    JOIN "deals" d ON d.contact_id::text = p.contact_id AND d.deal_type::text = p.deal_type
    WHERE d.archived_at IS NULL
  `)
  console.log("--- pending create-deal that overlap an existing Deal (same contact+type) ---")
  console.table(dupCount)
  return { samples: rows, breakdown, dupCount }
}

;(async () => {
  console.log("=== Phase 7 audit ===\n")
  await audit_moveDealStage()
  await audit_updateDeal()
  await audit_createDeal()
  console.log()
  const stats = await audit_existingPendingCreateDeals()

  console.log("\n=== summary ===")
  for (const f of findings) {
    console.log(`${f.ok ? "[ok]" : "[FAIL]"} ${f.name}`)
  }
  await db.$disconnect()

  // Persist a JSON sidecar so the audit doc can quote real numbers.
  const fs = await import("node:fs/promises")
  const out = {
    findings,
    samplePayloads: stats.samples,
    payloadBreakdown: stats.breakdown,
    duplicateCount: stats.dupCount,
    runAt: new Date().toISOString(),
  }
  const notesDir = path.join(__dirname, "..", "..", "docs", "superpowers", "notes")
  await fs.mkdir(notesDir, { recursive: true })
  await fs.writeFile(
    path.join(notesDir, "2026-05-02-phase-7-audit-results.json"),
    JSON.stringify(out, null, 2)
  )
  console.log("\nSidecar written to docs/superpowers/notes/2026-05-02-phase-7-audit-results.json")
  process.exit(findings.some((f) => !f.ok) ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
