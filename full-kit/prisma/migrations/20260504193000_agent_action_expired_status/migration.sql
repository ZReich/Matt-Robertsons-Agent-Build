-- Add the `expired` value to the AgentActionStatus enum + a `metadata`
-- JSON column to `todos`, both required by the agent-action auto-promotion
-- sweep introduced in the IA redesign.
--
-- Why:
--   * `expired` lets the auto-promotion sweep retire stale `pending`
--     AgentAction rows after the freshness window (default 30 days)
--     without losing the audit trail. Distinct from `rejected` (which
--     implies a deliberate operator dismissal) so dashboards can still
--     count "actually rejected" vs "aged out."
--   * `todos.metadata` carries `{ actionType, agentActionId, payload,
--     matchScore, matchSignals }` for approvable Todos that were created
--     from agent actions. The Todos UI uses `metadata.actionType` to
--     decide whether to render inline action buttons (Send draft / Edit
--     draft / Reject draft, Confirm delete / Cancel, etc.).
--
-- DO NOT APPLY automatically — per CLAUDE.md the operator runs:
--   pnpm prisma db execute --file prisma/migrations/20260504193000_agent_action_expired_status/migration.sql --schema prisma/schema.prisma
--   pnpm prisma migrate resolve --applied 20260504193000_agent_action_expired_status
--
-- Note: ALTER TYPE ... ADD VALUE is non-transactional in Postgres < 12 and
-- must be committed before the new value is usable. PG 12+ allows it inside
-- a transaction provided no other statement in the same tx references the
-- new value. The metadata column add is independent and safe to bundle.

ALTER TYPE "AgentActionStatus" ADD VALUE IF NOT EXISTS 'expired';

ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';
