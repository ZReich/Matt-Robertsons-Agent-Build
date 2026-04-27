ALTER TABLE "agent_actions"
  ADD COLUMN "source_communication_id" TEXT,
  ADD COLUMN "prompt_version" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "duplicate_of_action_id" TEXT,
  ADD COLUMN "deduped_to_todo_id" TEXT;

ALTER TABLE "todos"
  ADD COLUMN "dedupe_key" TEXT;

ALTER TABLE "agent_actions"
  ADD CONSTRAINT "agent_actions_source_communication_id_fkey"
  FOREIGN KEY ("source_communication_id")
  REFERENCES "communications"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "agent_actions"
  ADD CONSTRAINT "agent_actions_duplicate_of_action_id_fkey"
  FOREIGN KEY ("duplicate_of_action_id")
  REFERENCES "agent_actions"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "agent_actions"
  ADD CONSTRAINT "agent_actions_deduped_to_todo_id_fkey"
  FOREIGN KEY ("deduped_to_todo_id")
  REFERENCES "todos"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "agent_actions_source_communication_id_idx"
  ON "agent_actions"("source_communication_id");

CREATE INDEX "agent_actions_duplicate_of_action_id_idx"
  ON "agent_actions"("duplicate_of_action_id");

CREATE INDEX "agent_actions_deduped_to_todo_id_idx"
  ON "agent_actions"("deduped_to_todo_id");

CREATE INDEX "todos_dedupe_key_idx"
  ON "todos"("dedupe_key");

CREATE UNIQUE INDEX "todos_open_ai_dedupe_key_unique"
  ON "todos"("dedupe_key")
  WHERE "dedupe_key" IS NOT NULL
    AND "agent_action_id" IS NOT NULL
    AND "archived_at" IS NULL
    AND "status" <> 'done';

UPDATE "agent_actions" AS aa
SET
  "source_communication_id" = substring(aa."target_entity" from '^communication:(.+)$'),
  "prompt_version" = COALESCE(
    c."metadata" #>> '{scrub,promptVersion}',
    aa."prompt_version"
  ),
  "target_entity" = NULL
FROM "communications" AS c
WHERE aa."target_entity" ~ '^communication:.+$'
  AND c."id" = substring(aa."target_entity" from '^communication:(.+)$');
