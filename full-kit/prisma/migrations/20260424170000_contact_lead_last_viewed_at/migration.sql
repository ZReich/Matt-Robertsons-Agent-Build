-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "lead_last_viewed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "contacts_lead_source_lead_status_lead_last_viewed_at_idx" ON "contacts"("lead_source", "lead_status", "lead_last_viewed_at");
