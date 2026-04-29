-- Normalize ContactProfileFact.category to the RALPLAN Phase 5 taxonomy.
-- The column stays plain TEXT (no Postgres enum or CHECK constraint) so
-- this migration is a pure data back-fill. Runtime enforcement of the
-- closed vocabulary lives in scrub-types.ts / scrub-validator.ts.
--
-- Mapping rules (per RALPLAN):
--   constraint    -> schedule_constraint
--   schedule      -> schedule_constraint
--   personal      -> preference, status='retired'
--   relationship  -> preference, status='retired'
--   other         -> preference, status='retired'
--
-- Retired rows are preserved (not deleted) so the audit trail stays
-- intact and operators can review them via the existing review surface.

UPDATE "contact_profile_facts"
SET "category" = 'schedule_constraint'
WHERE "category" IN ('constraint', 'schedule');

UPDATE "contact_profile_facts"
SET "category" = 'preference',
    "status" = 'retired'
WHERE "category" IN ('personal', 'relationship', 'other');
