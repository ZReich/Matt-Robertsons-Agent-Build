-- AlterTable
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "estimated_value" DECIMAL(14,2);
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "lead_last_viewed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "commission_rate" DECIMAL(5,4) DEFAULT 0.03;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "probability" INTEGER;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stage_changed_at" TIMESTAMP(3);

-- Backfill stage age from the most reliable existing timestamp for historical deals.
UPDATE "deals"
SET "stage_changed_at" = COALESCE("updatedAt", "listed_date", "createdAt")
WHERE "stage_changed_at" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_lead_status_idx" ON "contacts"("lead_status");
CREATE INDEX IF NOT EXISTS "contacts_lead_status_updated_at_idx" ON "contacts"("lead_status", "updatedAt");
CREATE INDEX IF NOT EXISTS "contacts_lead_source_lead_status_lead_last_viewed_at_idx" ON "contacts"("lead_source", "lead_status", "lead_last_viewed_at");
CREATE INDEX IF NOT EXISTS "deals_stage_changed_at_idx" ON "deals"("stage_changed_at");
