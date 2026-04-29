-- Operational review ledger for coverage follow-ups and todo reconciliation proposals.

CREATE TYPE "OperationalEmailReviewType" AS ENUM (
  'suspicious_noise',
  'never_queued',
  'missed_eligible',
  'orphaned_context',
  'failed_scrub',
  'stale_queue',
  'pending_mark_done'
);

CREATE TYPE "OperationalEmailReviewStatus" AS ENUM (
  'open',
  'resolved',
  'snoozed',
  'ignored'
);

CREATE TABLE "operational_email_reviews" (
  "id" TEXT NOT NULL,
  "communication_id" TEXT NOT NULL,
  "email_filter_audit_id" TEXT,
  "subject_entity_kind" TEXT,
  "subject_entity_id" TEXT,
  "agent_action_id" TEXT,
  "type" "OperationalEmailReviewType" NOT NULL,
  "status" "OperationalEmailReviewStatus" NOT NULL DEFAULT 'open',
  "risk_score" INTEGER NOT NULL DEFAULT 0,
  "reason_codes" JSONB NOT NULL DEFAULT '[]',
  "reason_key" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "recommended_action" TEXT NOT NULL,
  "operator_outcome" TEXT,
  "operator_notes" TEXT,
  "snoozed_until" TIMESTAMP(3),
  "policy_version" TEXT NOT NULL,
  "prompt_version" TEXT,
  "created_from_run_id" TEXT,
  "resolved_by" TEXT,
  "resolved_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "operational_email_reviews_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "operational_email_reviews"
ADD CONSTRAINT "operational_email_reviews_pending_mark_done_subject_check"
CHECK (
  "type" <> 'pending_mark_done'
  OR ("subject_entity_kind" = 'todo' AND "subject_entity_id" IS NOT NULL)
);

CREATE UNIQUE INDEX "operational_email_reviews_open_dedupe"
ON "operational_email_reviews" ("dedupe_key")
WHERE "status" = 'open';

CREATE UNIQUE INDEX "agent_actions_pending_mark_todo_done_one_per_todo"
ON "agent_actions" ("target_entity")
WHERE "action_type" = 'mark-todo-done'
  AND "status" = 'pending'
  AND "target_entity" IS NOT NULL;

CREATE INDEX "operational_email_reviews_communication_id_idx"
ON "operational_email_reviews" ("communication_id");

CREATE INDEX "operational_email_reviews_email_filter_audit_id_idx"
ON "operational_email_reviews" ("email_filter_audit_id");

CREATE INDEX "operational_email_reviews_subject_entity_kind_subject_entity_id_idx"
ON "operational_email_reviews" ("subject_entity_kind", "subject_entity_id");

CREATE INDEX "operational_email_reviews_agent_action_id_idx"
ON "operational_email_reviews" ("agent_action_id");

CREATE INDEX "operational_email_reviews_type_status_idx"
ON "operational_email_reviews" ("type", "status");

CREATE INDEX "operational_email_reviews_created_from_run_id_idx"
ON "operational_email_reviews" ("created_from_run_id");

ALTER TABLE "operational_email_reviews"
ADD CONSTRAINT "operational_email_reviews_communication_id_fkey"
FOREIGN KEY ("communication_id") REFERENCES "communications"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_email_reviews"
ADD CONSTRAINT "operational_email_reviews_email_filter_audit_id_fkey"
FOREIGN KEY ("email_filter_audit_id") REFERENCES "email_filter_audits"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operational_email_reviews"
ADD CONSTRAINT "operational_email_reviews_agent_action_id_fkey"
FOREIGN KEY ("agent_action_id") REFERENCES "agent_actions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
