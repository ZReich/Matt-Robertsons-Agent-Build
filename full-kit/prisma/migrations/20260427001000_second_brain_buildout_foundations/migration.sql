-- Second-brain Buildout foundations: candidate-first identity,
-- Buildout event registry, reminder policies, AI feedback, and indexed threads.

CREATE TYPE "CanonicalDealStage" AS ENUM ('unknown','prospect','sourcing','evaluating','touring','listing','marketing','loi_offer','transacting','under_contract','due_diligence','contingent','closing','closed','dead','nurture','commission_realized');
CREATE TYPE "ContactPromotionCandidateStatus" AS ENUM ('pending','needs_more_evidence','snoozed','approved','merged','rejected','not_a_contact','superseded');
CREATE TYPE "BuildoutEventKind" AS ENUM ('new_lead','information_requested','deal_stage_update','task_assigned','critical_date','ca_executed','document_view','voucher_approved','voucher_deposit','commission_payment','listing_expiration','payment_event','unknown_signal');
CREATE TYPE "BuildoutEventStatus" AS ENUM ('parsed','matched','needs_review','proposed','applied','ignored','superseded','dead_letter');
CREATE TYPE "IntakeDispositionStatus" AS ENUM ('received','normalized','suppressed_noise','filed_activity','needs_human_gate','queued_attention','review_backlog','dead_letter','superseded');
CREATE TYPE "TodoReminderState" AS ENUM ('proposed','active','waiting_on_other','snoozed','due','overdue','done','rejected','superseded');
CREATE TYPE "AiFeedbackStatus" AS ENUM ('captured','proposed_rule','approved_rule','rejected_rule');

ALTER TABLE "communications" ADD COLUMN "conversation_id" TEXT;
CREATE INDEX "communications_conversation_id_idx" ON "communications"("conversation_id");

CREATE TABLE "intake_dispositions" (
  "id" TEXT NOT NULL,
  "source_system" TEXT NOT NULL,
  "source_external_id" TEXT NOT NULL,
  "communication_id" TEXT,
  "status" "IntakeDispositionStatus" NOT NULL,
  "reason_code" TEXT NOT NULL,
  "confidence" DECIMAL(5,4),
  "processor" TEXT NOT NULL,
  "processor_version" TEXT NOT NULL,
  "child_refs" JSONB DEFAULT '[]',
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "intake_dispositions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "intake_dispositions_source_system_source_external_id_key" ON "intake_dispositions"("source_system", "source_external_id");
CREATE INDEX "intake_dispositions_communication_id_idx" ON "intake_dispositions"("communication_id");
CREATE INDEX "intake_dispositions_status_idx" ON "intake_dispositions"("status");

CREATE TABLE "identity_candidate_groups" (
  "id" TEXT NOT NULL,
  "status" "ContactPromotionCandidateStatus" NOT NULL DEFAULT 'pending',
  "display_name" TEXT,
  "normalized_emails" JSONB DEFAULT '[]',
  "normalized_phones" JSONB DEFAULT '[]',
  "aliases" JSONB DEFAULT '[]',
  "companies" JSONB DEFAULT '[]',
  "evidence" JSONB DEFAULT '[]',
  "possible_contact_id" TEXT,
  "approved_contact_id" TEXT,
  "confidence_score" DECIMAL(5,4),
  "snoozed_until" TIMESTAMP(3),
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "identity_candidate_groups_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "identity_candidate_groups_status_idx" ON "identity_candidate_groups"("status");
CREATE INDEX "identity_candidate_groups_possible_contact_id_idx" ON "identity_candidate_groups"("possible_contact_id");
CREATE INDEX "identity_candidate_groups_approved_contact_id_idx" ON "identity_candidate_groups"("approved_contact_id");

CREATE TABLE "contact_promotion_candidates" (
  "id" TEXT NOT NULL,
  "identity_candidate_group_id" TEXT,
  "normalized_email" TEXT,
  "display_name" TEXT,
  "company" TEXT,
  "phone" TEXT,
  "message" TEXT,
  "source" TEXT NOT NULL,
  "source_platform" TEXT,
  "source_kind" TEXT,
  "status" "ContactPromotionCandidateStatus" NOT NULL DEFAULT 'pending',
  "confidence_score" DECIMAL(5,4),
  "evidence_count" INTEGER NOT NULL DEFAULT 1,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "suggested_contact_id" TEXT,
  "approved_contact_id" TEXT,
  "communication_id" TEXT,
  "agent_action_id" TEXT,
  "dedupe_key" TEXT NOT NULL,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contact_promotion_candidates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contact_promotion_candidates_dedupe_key_key" ON "contact_promotion_candidates"("dedupe_key");
CREATE INDEX "contact_promotion_candidates_identity_candidate_group_id_idx" ON "contact_promotion_candidates"("identity_candidate_group_id");
CREATE INDEX "contact_promotion_candidates_normalized_email_idx" ON "contact_promotion_candidates"("normalized_email");
CREATE INDEX "contact_promotion_candidates_status_idx" ON "contact_promotion_candidates"("status");
CREATE INDEX "contact_promotion_candidates_communication_id_idx" ON "contact_promotion_candidates"("communication_id");

CREATE TABLE "buildout_properties" (
  "id" TEXT NOT NULL,
  "buildout_property_id" TEXT,
  "buildout_deal_id" TEXT,
  "property_name_raw" TEXT,
  "property_address_raw" TEXT,
  "normalized_property_key" TEXT NOT NULL,
  "aliases" JSONB DEFAULT '[]',
  "unit_or_suite" TEXT NOT NULL DEFAULT '',
  "current_stage" "CanonicalDealStage",
  "status" TEXT NOT NULL DEFAULT 'unknown',
  "source" TEXT NOT NULL DEFAULT 'email_event',
  "assigned_to_matt" BOOLEAN NOT NULL DEFAULT false,
  "team_members" JSONB DEFAULT '[]',
  "source_recipients" JSONB DEFAULT '[]',
  "last_buildout_event_at" TIMESTAMP(3),
  "matched_deal_id" TEXT,
  "match_confidence" DECIMAL(5,4),
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "buildout_properties_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "buildout_properties_buildout_property_id_key" ON "buildout_properties"("buildout_property_id");
CREATE UNIQUE INDEX "buildout_properties_buildout_deal_id_key" ON "buildout_properties"("buildout_deal_id");
CREATE UNIQUE INDEX "buildout_properties_normalized_property_key_unit_or_suite_key" ON "buildout_properties"("normalized_property_key", "unit_or_suite");
CREATE INDEX "buildout_properties_matched_deal_id_idx" ON "buildout_properties"("matched_deal_id");

CREATE TABLE "buildout_events" (
  "id" TEXT NOT NULL,
  "communication_id" TEXT,
  "source_external_id" TEXT,
  "event_kind" "BuildoutEventKind" NOT NULL,
  "status" "BuildoutEventStatus" NOT NULL DEFAULT 'parsed',
  "property_name_raw" TEXT,
  "property_address_raw" TEXT,
  "normalized_property_key" TEXT,
  "buildout_property_id" TEXT,
  "buildout_deal_id" TEXT,
  "inquirer_name" TEXT,
  "inquirer_email" TEXT,
  "inquirer_phone" TEXT,
  "inquirer_message" TEXT,
  "viewer_name" TEXT,
  "viewer_email" TEXT,
  "viewer_company" TEXT,
  "task_title" TEXT,
  "task_due_date" TIMESTAMP(3),
  "task_assignee" TEXT,
  "critical_date" TIMESTAMP(3),
  "deadline_type" TEXT,
  "source_stage_raw" TEXT,
  "previous_stage_raw" TEXT,
  "new_stage_raw" TEXT,
  "canonical_stage" "CanonicalDealStage",
  "document_name" TEXT,
  "document_url" TEXT,
  "amount" DECIMAL(14,2),
  "payment_status" TEXT,
  "voucher_id" TEXT,
  "voucher_name" TEXT,
  "invoice_id" TEXT,
  "payer_name" TEXT,
  "matched_deal_id" TEXT,
  "matched_contact_id" TEXT,
  "match_confidence" DECIMAL(5,4),
  "dedupe_key" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "event_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "buildout_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "buildout_events_communication_id_idx" ON "buildout_events"("communication_id");
CREATE INDEX "buildout_events_event_kind_idx" ON "buildout_events"("event_kind");
CREATE INDEX "buildout_events_status_idx" ON "buildout_events"("status");
CREATE INDEX "buildout_events_normalized_property_key_idx" ON "buildout_events"("normalized_property_key");
CREATE INDEX "buildout_events_matched_deal_id_idx" ON "buildout_events"("matched_deal_id");
CREATE UNIQUE INDEX "buildout_events_dedupe_key_key" ON "buildout_events"("dedupe_key");

CREATE TABLE "todo_reminder_policies" (
  "id" TEXT NOT NULL,
  "todo_id" TEXT,
  "agent_action_id" TEXT,
  "communication_id" TEXT,
  "dedupe_key" TEXT,
  "state" "TodoReminderState" NOT NULL DEFAULT 'proposed',
  "cadence" TEXT NOT NULL DEFAULT 'once',
  "next_reminder_at" TIMESTAMP(3),
  "last_reminder_at" TIMESTAMP(3),
  "snoozed_until" TIMESTAMP(3),
  "last_evidence_at" TIMESTAMP(3),
  "source_policy" TEXT,
  "policy_reason" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "todo_reminder_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "todo_reminder_policies_todo_id_idx" ON "todo_reminder_policies"("todo_id");
CREATE INDEX "todo_reminder_policies_agent_action_id_idx" ON "todo_reminder_policies"("agent_action_id");
CREATE INDEX "todo_reminder_policies_communication_id_idx" ON "todo_reminder_policies"("communication_id");
CREATE INDEX "todo_reminder_policies_state_idx" ON "todo_reminder_policies"("state");
CREATE INDEX "todo_reminder_policies_next_reminder_at_idx" ON "todo_reminder_policies"("next_reminder_at");

CREATE TABLE "ai_feedback" (
  "id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "model_used" TEXT,
  "prompt_version" TEXT,
  "predicted_label" TEXT,
  "predicted_action" TEXT,
  "corrected_label" TEXT,
  "corrected_action" TEXT,
  "reason" TEXT,
  "status" "AiFeedbackStatus" NOT NULL DEFAULT 'captured',
  "created_by" TEXT,
  "promoted_to_rule_at" TIMESTAMP(3),
  "regression_test_id" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_feedback_source_type_source_id_idx" ON "ai_feedback"("source_type", "source_id");
CREATE INDEX "ai_feedback_status_idx" ON "ai_feedback"("status");
