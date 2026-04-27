CREATE UNIQUE INDEX IF NOT EXISTS "todo_reminder_policies_one_active_agent_snooze"
ON "todo_reminder_policies" ("agent_action_id")
WHERE "agent_action_id" IS NOT NULL AND "state" = 'snoozed';
