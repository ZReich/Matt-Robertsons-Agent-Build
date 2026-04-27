-- Email filter hardening audit contract for observe-first Graph ingestion.

CREATE TYPE "EmailFilterRuleMode" AS ENUM ('draft', 'classification_only', 'observe_only', 'quarantine_candidate', 'promoted_exact', 'limited_rollout', 'active', 'disabled', 'retired');
CREATE TYPE "EmailBodyDecision" AS ENUM ('fetch_body', 'metadata_only_quarantine', 'safe_body_skip');
CREATE TYPE "EmailFilterRunMode" AS ENUM ('dry_run', 'observe', 'quarantine_only', 'promoted_rules_limited', 'active');
CREATE TYPE "EmailFilterAuditDisposition" AS ENUM ('observed', 'quarantined', 'fetched_body', 'body_fetch_failed', 'safe_skip_proposed', 'safe_skip_applied', 'restored', 'false_negative', 'true_noise', 'uncertain');

CREATE TABLE "email_filter_rules" (
  "id" TEXT NOT NULL,
  "rule_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "mode" "EmailFilterRuleMode" NOT NULL DEFAULT 'draft',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "rollout_percent" INTEGER NOT NULL DEFAULT 0,
  "owner" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "match_definition" JSONB NOT NULL DEFAULT '{}',
  "evidence_required" JSONB NOT NULL DEFAULT '{}',
  "rescue_conditions" JSONB NOT NULL DEFAULT '[]',
  "sample_policy" JSONB NOT NULL DEFAULT '{}',
  "promotion_criteria" JSONB NOT NULL DEFAULT '{}',
  "demotion_policy" JSONB NOT NULL DEFAULT '{}',
  "false_positive_count" INTEGER NOT NULL DEFAULT 0,
  "false_negative_count" INTEGER NOT NULL DEFAULT 0,
  "reviewed_sample_count" INTEGER NOT NULL DEFAULT 0,
  "created_by" TEXT,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "last_reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_filter_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_filter_rules_rule_id_version_key" ON "email_filter_rules"("rule_id", "version");
CREATE INDEX "email_filter_rules_mode_idx" ON "email_filter_rules"("mode");
CREATE INDEX "email_filter_rules_enabled_idx" ON "email_filter_rules"("enabled");
CREATE INDEX "email_filter_rules_rule_id_idx" ON "email_filter_rules"("rule_id");

CREATE TABLE "email_filter_runs" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "mode" "EmailFilterRunMode" NOT NULL,
  "rule_set_version" TEXT NOT NULL,
  "mailbox_id" TEXT NOT NULL,
  "folder_scope" TEXT,
  "date_from" TIMESTAMP(3),
  "date_to" TIMESTAMP(3),
  "dry_run" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "requested_by" TEXT,
  "stop_reason" TEXT,
  "messages_seen" INTEGER NOT NULL DEFAULT 0,
  "metadata_fetched" INTEGER NOT NULL DEFAULT 0,
  "body_fetch_attempted" INTEGER NOT NULL DEFAULT 0,
  "body_fetch_succeeded" INTEGER NOT NULL DEFAULT 0,
  "body_fetch_failed" INTEGER NOT NULL DEFAULT 0,
  "quarantine_count" INTEGER NOT NULL DEFAULT 0,
  "safe_skip_proposed_count" INTEGER NOT NULL DEFAULT 0,
  "safe_skip_applied_count" INTEGER NOT NULL DEFAULT 0,
  "critical_false_negative_count" INTEGER NOT NULL DEFAULT 0,
  "gate_results" JSONB NOT NULL DEFAULT '{}',
  "rule_version_snapshot" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_filter_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_filter_runs_run_id_key" ON "email_filter_runs"("run_id");
CREATE INDEX "email_filter_runs_mode_idx" ON "email_filter_runs"("mode");
CREATE INDEX "email_filter_runs_status_idx" ON "email_filter_runs"("status");
CREATE INDEX "email_filter_runs_started_at_idx" ON "email_filter_runs"("started_at");

CREATE TABLE "email_filter_chunks" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "chunk_id" TEXT NOT NULL,
  "cursor_before" TEXT,
  "cursor_after" TEXT,
  "cursor_committed" BOOLEAN NOT NULL DEFAULT false,
  "date_from" TIMESTAMP(3),
  "date_to" TIMESTAMP(3),
  "folder" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "messages_seen" INTEGER NOT NULL DEFAULT 0,
  "metadata_fetched" INTEGER NOT NULL DEFAULT 0,
  "body_fetch_attempted" INTEGER NOT NULL DEFAULT 0,
  "body_fetch_succeeded" INTEGER NOT NULL DEFAULT 0,
  "body_fetch_failed" INTEGER NOT NULL DEFAULT 0,
  "quarantine_count" INTEGER NOT NULL DEFAULT 0,
  "safe_skip_proposed_count" INTEGER NOT NULL DEFAULT 0,
  "safe_skip_applied_count" INTEGER NOT NULL DEFAULT 0,
  "graph_429_count" INTEGER NOT NULL DEFAULT 0,
  "graph_5xx_count" INTEGER NOT NULL DEFAULT 0,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "stop_gate_triggered" BOOLEAN NOT NULL DEFAULT false,
  "stop_gate_reason" TEXT,
  CONSTRAINT "email_filter_chunks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_filter_chunks_run_id_chunk_id_key" ON "email_filter_chunks"("run_id", "chunk_id");
CREATE INDEX "email_filter_chunks_run_id_idx" ON "email_filter_chunks"("run_id");
CREATE INDEX "email_filter_chunks_status_idx" ON "email_filter_chunks"("status");

CREATE TABLE "email_filter_audits" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "chunk_id" TEXT NOT NULL,
  "external_message_id" TEXT NOT NULL,
  "internet_message_id" TEXT,
  "communication_id" TEXT,
  "external_sync_id" TEXT,
  "rule_id" TEXT NOT NULL,
  "rule_version" INTEGER NOT NULL,
  "classification" TEXT NOT NULL,
  "body_decision" "EmailBodyDecision" NOT NULL,
  "disposition" "EmailFilterAuditDisposition" NOT NULL,
  "risk_flags" JSONB NOT NULL DEFAULT '[]',
  "rescue_flags" JSONB NOT NULL DEFAULT '[]',
  "evidence_snapshot" JSONB NOT NULL DEFAULT '{}',
  "sample_bucket" TEXT,
  "sampled" BOOLEAN NOT NULL DEFAULT false,
  "sample_reviewed_by" TEXT,
  "sample_reviewed_at" TIMESTAMP(3),
  "review_outcome" TEXT NOT NULL DEFAULT 'not_reviewed',
  "body_available" BOOLEAN NOT NULL DEFAULT false,
  "body_hash" TEXT,
  "body_length" INTEGER NOT NULL DEFAULT 0,
  "body_content_type" TEXT,
  "redaction_version" TEXT,
  "redaction_status" TEXT NOT NULL DEFAULT 'not_required',
  "graph_fetch_status" TEXT,
  "graph_error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_filter_audits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_filter_audits_run_id_idx" ON "email_filter_audits"("run_id");
CREATE INDEX "email_filter_audits_chunk_id_idx" ON "email_filter_audits"("chunk_id");
CREATE INDEX "email_filter_audits_rule_id_rule_version_idx" ON "email_filter_audits"("rule_id", "rule_version");
CREATE INDEX "email_filter_audits_classification_idx" ON "email_filter_audits"("classification");
CREATE INDEX "email_filter_audits_body_decision_idx" ON "email_filter_audits"("body_decision");
CREATE INDEX "email_filter_audits_review_outcome_idx" ON "email_filter_audits"("review_outcome");

CREATE TABLE "email_raw_body_retention" (
  "id" TEXT NOT NULL,
  "external_sync_id" TEXT NOT NULL,
  "communication_id" TEXT,
  "run_id" TEXT NOT NULL,
  "chunk_id" TEXT NOT NULL,
  "raw_body_retained" BOOLEAN NOT NULL DEFAULT false,
  "raw_body_storage_location" TEXT,
  "raw_body_retention_expires_at" TIMESTAMP(3),
  "redacted_body_retained" BOOLEAN NOT NULL DEFAULT false,
  "redacted_body_storage_location" TEXT,
  "redacted_body" TEXT,
  "body_hash" TEXT,
  "body_length" INTEGER NOT NULL DEFAULT 0,
  "body_content_type" TEXT,
  "redaction_version" TEXT,
  "redaction_status" TEXT NOT NULL DEFAULT 'not_required',
  "redaction_error" TEXT,
  "access_policy" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_raw_body_retention_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_raw_body_retention_external_sync_id_idx" ON "email_raw_body_retention"("external_sync_id");
CREATE INDEX "email_raw_body_retention_communication_id_idx" ON "email_raw_body_retention"("communication_id");
CREATE INDEX "email_raw_body_retention_run_id_chunk_id_idx" ON "email_raw_body_retention"("run_id", "chunk_id");

CREATE TABLE "email_graph_cursor_state" (
  "id" TEXT NOT NULL,
  "mailbox_id" TEXT NOT NULL,
  "folder" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "delta_link" TEXT,
  "next_link" TEXT,
  "cursor_version" INTEGER NOT NULL DEFAULT 1,
  "last_committed_run_id" TEXT,
  "last_committed_chunk_id" TEXT,
  "cursor_status" TEXT NOT NULL DEFAULT 'active',
  "last_successful_sync_at" TIMESTAMP(3),
  "last_error_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_graph_cursor_state_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_graph_cursor_state_mailbox_id_folder_mode_key" ON "email_graph_cursor_state"("mailbox_id", "folder", "mode");
CREATE INDEX "email_graph_cursor_state_cursor_status_idx" ON "email_graph_cursor_state"("cursor_status");
