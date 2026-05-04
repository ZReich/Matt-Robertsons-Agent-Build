-- Performance indexes for hot query paths on the contact detail page,
-- the deal pipeline / Kanban list, and the renewal-alert sweep.
--
-- Generated via `prisma migrate diff --from-url DIRECT_URL --to-schema-datamodel`
-- and then HAND-FILTERED to remove three CreateIndex statements that the
-- diff emitted as drift — see "Intentional drift" comment block below.
--
-- DO NOT APPLY automatically: per CLAUDE.md the operator runs the
-- `pnpm prisma db execute` + `prisma migrate resolve --applied` workflow
-- by hand against Supabase. CREATE INDEX IF NOT EXISTS guards against the
-- re-run case so applying twice is a no-op.

-- =============================================================================
-- Intentional drift OMITTED from this migration:
--
-- 1. `calendar_events.calendar_event_dedupe_kind`
-- 2. `lease_records.lease_record_dedupe_lease`
-- 3. `lease_records.lease_record_dedupe_sale`
--
-- All three already exist in Postgres as PARTIAL unique indexes (with
-- WHERE clauses Prisma's schema DSL cannot express). They were created by
-- migration `20260503150000_lease_record_partial_dedupe`. `migrate diff`
-- doesn't see the WHERE clause on the existing index and so re-emits a
-- full unique index — applying that would fail because the name already
-- exists. The schema comments on `LeaseRecord` and `CalendarEvent` document
-- this intentional drift.
-- =============================================================================

-- Hot path: contact detail Activity tab orders by date desc and filters by
-- archivedAt. Two complementary indexes — one for the ordered fetch, one
-- for the count/non-archived filter.
CREATE INDEX IF NOT EXISTS "communications_contact_id_date_idx"
  ON "communications" ("contact_id", "date" DESC);
CREATE INDEX IF NOT EXISTS "communications_contact_id_archived_at_idx"
  ON "communications" ("contact_id", "archived_at");

-- Hot path: deal detail Activity tab — same shape, deal-scoped.
CREATE INDEX IF NOT EXISTS "communications_deal_id_date_idx"
  ON "communications" ("deal_id", "date" DESC);

-- Hot path: contact detail Personal tab fetches active facts by contact.
CREATE INDEX IF NOT EXISTS "contact_profile_facts_contact_id_status_idx"
  ON "contact_profile_facts" ("contact_id", "status");

-- Hot path: contact detail Deals card filters by contact + non-archived.
CREATE INDEX IF NOT EXISTS "deals_contact_id_archived_at_idx"
  ON "deals" ("contact_id", "archived_at");

-- Hot path: pipeline / Kanban list filters by stage + non-archived.
CREATE INDEX IF NOT EXISTS "deals_stage_archived_at_idx"
  ON "deals" ("stage", "archived_at");

-- Hot path: contact upcoming meetings card joins meeting_attendees by
-- contact. The existing UNIQUE on (meeting_id, contact_id) is leading on
-- meeting_id so it doesn't help contactId-first lookups.
CREATE INDEX IF NOT EXISTS "meeting_attendees_contact_id_idx"
  ON "meeting_attendees" ("contact_id");
