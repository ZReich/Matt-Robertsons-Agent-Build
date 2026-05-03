-- Buildout deal ID for CSV ingest dedupe.
ALTER TABLE "deals" ADD COLUMN "buildout_deal_id" TEXT;
CREATE UNIQUE INDEX "deals_buildout_deal_id_key" ON "deals" ("buildout_deal_id");
