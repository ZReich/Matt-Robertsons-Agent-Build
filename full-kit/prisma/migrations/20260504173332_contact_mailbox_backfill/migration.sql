-- CreateTable
CREATE TABLE "backfill_runs" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT,
    "parent_id" TEXT,
    "trigger" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "result" JSONB,
    "error_message" TEXT,

    CONSTRAINT "backfill_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backfill_runs_contact_id_started_at_idx" ON "backfill_runs"("contact_id", "started_at");

-- CreateIndex
CREATE INDEX "backfill_runs_parent_id_idx" ON "backfill_runs"("parent_id");

-- CreateIndex
CREATE INDEX "backfill_runs_status_started_at_idx" ON "backfill_runs"("status", "started_at");

-- AddForeignKey
ALTER TABLE "backfill_runs" ADD CONSTRAINT "backfill_runs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backfill_runs" ADD CONSTRAINT "backfill_runs_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "backfill_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique on Communication.external_message_id (allows multiple NULLs, prevents duplicate non-null)
CREATE UNIQUE INDEX IF NOT EXISTS communications_external_message_id_unique
  ON communications (external_message_id)
  WHERE external_message_id IS NOT NULL;
