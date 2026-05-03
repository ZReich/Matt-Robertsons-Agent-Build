-- Lease lifecycle tracking + calendar events.
-- Plan: docs/superpowers/plans/2026-05-02-lease-lifecycle.md

-- LeaseRecord — closed deals (lease or sale) extracted from email history.
CREATE TABLE "lease_records" (
  "id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "property_id" TEXT,
  "deal_id" TEXT,
  "source_communication_id" TEXT,
  "close_date" TIMESTAMP(3),
  "lease_start_date" TIMESTAMP(3),
  "lease_end_date" TIMESTAMP(3),
  "lease_term_months" INTEGER,
  "rent_amount" DECIMAL(14,2),
  "rent_period" TEXT,
  "matt_represented" TEXT,
  "deal_kind" TEXT NOT NULL DEFAULT 'lease',
  "extraction_confidence" DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "notes" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "created_by" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lease_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lease_records_contact_id_idx" ON "lease_records" ("contact_id");
CREATE INDEX "lease_records_lease_end_date_idx" ON "lease_records" ("lease_end_date");
CREATE INDEX "lease_records_status_idx" ON "lease_records" ("status");
CREATE INDEX "lease_records_close_date_idx" ON "lease_records" ("close_date");
CREATE INDEX "lease_records_property_id_idx" ON "lease_records" ("property_id");
CREATE INDEX "lease_records_deal_id_idx" ON "lease_records" ("deal_id");

ALTER TABLE "lease_records"
  ADD CONSTRAINT "lease_records_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lease_records"
  ADD CONSTRAINT "lease_records_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lease_records"
  ADD CONSTRAINT "lease_records_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lease_records"
  ADD CONSTRAINT "lease_records_source_communication_id_fkey"
  FOREIGN KEY ("source_communication_id") REFERENCES "communications"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- CalendarEvent — system-generated calendar entries (lease renewals, follow-ups).
CREATE TABLE "calendar_events" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3),
  "all_day" BOOLEAN NOT NULL DEFAULT true,
  "event_kind" TEXT NOT NULL,
  "contact_id" TEXT,
  "deal_id" TEXT,
  "property_id" TEXT,
  "lease_record_id" TEXT,
  "source" TEXT NOT NULL DEFAULT 'system',
  "status" TEXT NOT NULL DEFAULT 'upcoming',
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calendar_events_start_date_idx" ON "calendar_events" ("start_date");
CREATE INDEX "calendar_events_event_kind_idx" ON "calendar_events" ("event_kind");
CREATE INDEX "calendar_events_lease_record_id_idx" ON "calendar_events" ("lease_record_id");
CREATE INDEX "calendar_events_contact_id_idx" ON "calendar_events" ("contact_id");
CREATE INDEX "calendar_events_deal_id_idx" ON "calendar_events" ("deal_id");

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_lease_record_id_fkey"
  FOREIGN KEY ("lease_record_id") REFERENCES "lease_records"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- PendingReply.lease_record_id — links a re-engagement draft to its source lease.
ALTER TABLE "pending_replies"
  ADD COLUMN "lease_record_id" TEXT;

ALTER TABLE "pending_replies"
  ADD CONSTRAINT "pending_replies_lease_record_id_fkey"
  FOREIGN KEY ("lease_record_id") REFERENCES "lease_records"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "pending_replies_lease_record_id_idx" ON "pending_replies" ("lease_record_id");
