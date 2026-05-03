-- Audit I1: convert full-column unique indexes to PARTIAL unique indexes
-- so Postgres' NULL-distinct behavior doesn't let duplicate rows slip
-- through when the date dimension (lease_start_date / close_date) is
-- null. Also restrict the constraint to NON-archived rows so an archived
-- LeaseRecord no longer blocks recreating the same key.
--
-- Prisma's @@unique declarations don't support WHERE clauses, so we keep
-- the @@unique entries in schema.prisma (Prisma's upsert continues to
-- recognize them) and replace the actual indexes here.

DROP INDEX IF EXISTS "lease_record_dedupe_lease";
DROP INDEX IF EXISTS "lease_record_dedupe_sale";
DROP INDEX IF EXISTS "calendar_event_dedupe_kind";

CREATE UNIQUE INDEX "lease_record_dedupe_lease"
  ON "lease_records" ("contact_id", "property_id", "lease_start_date")
  WHERE archived_at IS NULL AND lease_start_date IS NOT NULL;

CREATE UNIQUE INDEX "lease_record_dedupe_sale"
  ON "lease_records" ("contact_id", "property_id", "close_date")
  WHERE archived_at IS NULL AND close_date IS NOT NULL;

CREATE UNIQUE INDEX "calendar_event_dedupe_kind"
  ON "calendar_events" ("lease_record_id", "event_kind")
  WHERE lease_record_id IS NOT NULL;
