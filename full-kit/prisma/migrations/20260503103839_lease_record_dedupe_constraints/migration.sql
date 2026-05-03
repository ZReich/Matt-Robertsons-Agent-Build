-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_dedupe_kind" ON "calendar_events"("lease_record_id", "event_kind");

-- CreateIndex
CREATE UNIQUE INDEX "lease_record_dedupe_lease" ON "lease_records"("contact_id", "property_id", "lease_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "lease_record_dedupe_sale" ON "lease_records"("contact_id", "property_id", "close_date");

