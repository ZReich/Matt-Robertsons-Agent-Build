-- Concurrency safety net for the per-contact email backfill.
-- The rate-guard `findFirst` in the route handler is a UX layer (returns 429
-- inside the 10-min cooldown) but TOCTOU-races between two simultaneous
-- clicks. This partial unique index makes a true concurrent run impossible
-- at the DB tier: only one row per contact_id may be in the "running" state
-- at a time. The orchestrator catches the resulting P2002 and rethrows as
-- BackfillAlreadyRunningError so the route can return 429.

CREATE UNIQUE INDEX IF NOT EXISTS backfill_runs_one_running_per_contact
  ON backfill_runs (contact_id)
  WHERE status = 'running' AND contact_id IS NOT NULL;
