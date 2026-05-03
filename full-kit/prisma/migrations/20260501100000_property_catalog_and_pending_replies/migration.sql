-- Phase A + Phase E migration:
--   - Property catalog (transcript follow-up: Genevieve's spreadsheet seed)
--   - PendingReply queue (transcript follow-up: auto-reply on lead inquiries)
--   - Contact.searchCriteria (transcript follow-up: buyer/tenant criteria)
--   - Deal.propertyId FK (denormalized link to catalog)

-- New enums
CREATE TYPE "PropertyStatus" AS ENUM ('active', 'under_contract', 'closed', 'archived');
CREATE TYPE "PendingReplyStatus" AS ENUM ('pending', 'approved', 'dismissed');

-- Contact.searchCriteria
ALTER TABLE "contacts" ADD COLUMN "search_criteria" JSONB;

-- Deal.propertyId
ALTER TABLE "deals" ADD COLUMN "property_id" TEXT;
CREATE INDEX "deals_property_id_idx" ON "deals" ("property_id");

-- Property catalog
CREATE TABLE "properties" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "address" TEXT NOT NULL,
  "unit" TEXT,
  "city" TEXT,
  "state" TEXT,
  "zip" TEXT,
  "property_key" TEXT NOT NULL,
  "property_type" "PropertyType",
  "status" "PropertyStatus" NOT NULL DEFAULT 'active',
  "square_feet" INTEGER,
  "occupied_square_feet" INTEGER,
  "list_price" DECIMAL(14,2),
  "cap_rate" DECIMAL(7,4),
  "listing_url" TEXT,
  "flyer_url" TEXT,
  "description" TEXT,
  "highlights" JSONB DEFAULT '[]',
  "tags" JSONB DEFAULT '[]',
  "source" TEXT,
  "external_id" TEXT,
  "notes" TEXT,
  "created_by" TEXT,
  "archived_at" TIMESTAMP(3),
  "listed_at" TIMESTAMP(3),
  "under_contract_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- Postgres treats NULL as distinct in unique indexes, so two rows with the
-- same property_key but unit IS NULL coexist. That's acceptable: a unit-less
-- duplicate row is very rare and the UI surfaces them. If duplicate-guarding
-- becomes a problem, replace with a partial unique index where unit IS NOT NULL
-- plus a separate (property_key) WHERE unit IS NULL unique index.
CREATE UNIQUE INDEX "properties_property_key_unit_key"
  ON "properties" ("property_key", "unit");
CREATE INDEX "properties_status_idx" ON "properties" ("status");
CREATE INDEX "properties_property_type_idx" ON "properties" ("property_type");
CREATE INDEX "properties_property_key_idx" ON "properties" ("property_key");
CREATE INDEX "properties_archived_at_idx" ON "properties" ("archived_at");

-- Deal → Property FK
ALTER TABLE "deals"
  ADD CONSTRAINT "deals_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- PendingReply queue
CREATE TABLE "pending_replies" (
  "id" TEXT NOT NULL,
  "trigger_communication_id" TEXT,
  "contact_id" TEXT,
  "property_id" TEXT,
  "draft_subject" TEXT NOT NULL,
  "draft_body" TEXT NOT NULL,
  "reasoning" TEXT,
  "suggested_properties" JSONB DEFAULT '[]',
  "model_used" TEXT,
  "status" "PendingReplyStatus" NOT NULL DEFAULT 'pending',
  "approved_at" TIMESTAMP(3),
  "approved_by" TEXT,
  "dismissed_at" TIMESTAMP(3),
  "dismiss_reason" TEXT,
  "approved_communication_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pending_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pending_replies_status_created_at_idx" ON "pending_replies" ("status", "created_at");
CREATE INDEX "pending_replies_contact_id_idx" ON "pending_replies" ("contact_id");
CREATE INDEX "pending_replies_property_id_idx" ON "pending_replies" ("property_id");
CREATE INDEX "pending_replies_trigger_communication_id_idx" ON "pending_replies" ("trigger_communication_id");

ALTER TABLE "pending_replies"
  ADD CONSTRAINT "pending_replies_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
