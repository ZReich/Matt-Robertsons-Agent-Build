CREATE TABLE "contact_profile_facts" (
  "id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "fact" TEXT NOT NULL,
  "normalized_key" TEXT NOT NULL,
  "confidence" DECIMAL(5,4) NOT NULL,
  "wording_class" TEXT NOT NULL,
  "source_communication_id" TEXT NOT NULL,
  "source_agent_action_id" TEXT,
  "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contact_profile_facts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_profile_facts_contact_id_normalized_key_key"
  ON "contact_profile_facts"("contact_id", "normalized_key");

CREATE INDEX "contact_profile_facts_contact_id_category_idx"
  ON "contact_profile_facts"("contact_id", "category");

CREATE INDEX "contact_profile_facts_source_communication_id_idx"
  ON "contact_profile_facts"("source_communication_id");

CREATE INDEX "contact_profile_facts_status_idx"
  ON "contact_profile_facts"("status");

ALTER TABLE "contact_profile_facts"
  ADD CONSTRAINT "contact_profile_facts_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
