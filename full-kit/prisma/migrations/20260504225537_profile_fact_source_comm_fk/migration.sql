-- Add a real Postgres FK from contact_profile_facts.source_communication_id
-- to communications.id, with ON DELETE SET NULL.
--
-- Why now: the Personal tab on the contact detail page wants to fetch
-- profile facts WITH their source communication in a single Prisma query
-- via `include: { sourceCommunication: ... }`. That requires the relation
-- to be declared in `schema.prisma`, which in turn generates this FK.
--
-- ON DELETE SET NULL (not CASCADE) so a comm being purged doesn't drop
-- the extracted profile fact — the UI tolerates `sourceCommunication == null`.
--
-- DO NOT APPLY automatically: per CLAUDE.md the operator runs the
-- `pnpm prisma db execute` + `prisma migrate resolve --applied` workflow
-- by hand against Supabase. The IF NOT EXISTS-style guard isn't supported
-- for ADD CONSTRAINT in older Postgres, so the operator must take care
-- not to apply this twice (or wrap in a DO $$ block locally).

ALTER TABLE "contact_profile_facts"
  ADD CONSTRAINT "contact_profile_facts_source_communication_id_fkey"
  FOREIGN KEY ("source_communication_id")
  REFERENCES "communications"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
