-- Audit ledger for reviewer-driven coverage actions and outbound-todo reconciliation runs.
-- Stores aggregate counts and minimal identifiers ONLY. Raw bodies, recipients,
-- Graph IDs, internetMessageId values, and operator notes MUST NOT be persisted here.

CREATE TABLE "coverage_action_audit_logs" (
  "id" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "actor_hash" TEXT,
  "anonymized_at" TIMESTAMP(3),
  "action" TEXT NOT NULL,
  "run_id" TEXT,
  "dry_run" BOOLEAN NOT NULL,
  "policy_version" TEXT NOT NULL,
  "review_item_ids" JSONB NOT NULL DEFAULT '[]',
  "outcome_summary" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "coverage_action_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coverage_action_audit_logs_created_at_idx"
  ON "coverage_action_audit_logs" ("created_at");

CREATE INDEX "coverage_action_audit_logs_run_id_idx"
  ON "coverage_action_audit_logs" ("run_id");
