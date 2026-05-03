-- Phase C role-lifecycle + Phase E PendingReply dedupe constraint.
--
-- Two changes batched together (per user direction):
--   1. Add ClientType enum values `past_listing_client` and `past_buyer_client`
--      so role-lifecycle can split closed-deal contacts by deal type.
--   2. Add a partial UNIQUE index on
--      pending_replies (trigger_communication_id, contact_id, property_id)
--      where all three are non-null, to prevent duplicate auto-drafts for the
--      same inquiry. (Phase E deferred follow-up.)
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot run inside a transaction in
-- Postgres < 12. Prisma's `db execute` does NOT wrap statements in BEGIN/COMMIT
-- by default — it sends each ; -terminated statement separately, which is what
-- we need here. Do not re-wrap this file in a transaction.

-- ---------------------------------------------------------------------------
-- 1. ClientType: split past_client into listing/buyer variants.
-- ---------------------------------------------------------------------------
-- Existing `past_client` value is preserved. Backfill (run separately, see
-- scripts/backfill-contact-client-type.mjs) migrates legacy rows to the new
-- variants based on each contact's most-recent-closed deal type.
ALTER TYPE "ClientType" ADD VALUE IF NOT EXISTS 'past_listing_client';
ALTER TYPE "ClientType" ADD VALUE IF NOT EXISTS 'past_buyer_client';

-- ---------------------------------------------------------------------------
-- 2. Pre-flight: dedupe one known duplicate pair before creating the unique
--    index. Without this the CREATE UNIQUE INDEX would fail.
-- ---------------------------------------------------------------------------
-- Inspected on 2026-05-02: exactly one duplicate group exists in production
-- (two pending_replies rows for the same trigger/contact/property). Both are
-- unapproved; one is `pending`, the other `dismissed`. Drop the terminal
-- `dismissed` row — it has no downstream consumers (no
-- approved_communication_id) and is older-by-decision than the kept row.
DELETE FROM pending_replies
WHERE id = '2503a682-68a2-4963-9eb1-605bdb802ac9';

-- ---------------------------------------------------------------------------
-- 3. Partial unique index for PendingReply dedupe.
-- ---------------------------------------------------------------------------
-- Prisma's schema DSL can't express partial unique indexes; a doc comment on
-- @@index([triggerCommunicationId]) in schema.prisma records the constraint
-- for future maintainers (matches the pattern used by
-- deals_property_key_seller_rep_active_uidx).
CREATE UNIQUE INDEX IF NOT EXISTS pending_replies_dedupe_uidx
  ON pending_replies (trigger_communication_id, contact_id, property_id)
  WHERE trigger_communication_id IS NOT NULL
    AND contact_id IS NOT NULL
    AND property_id IS NOT NULL;
