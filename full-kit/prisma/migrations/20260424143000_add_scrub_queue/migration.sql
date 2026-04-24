-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('pending', 'in_flight', 'done', 'failed');

-- AlterTable
ALTER TABLE "agent_memory" ADD COLUMN "agent_action_id" TEXT;

-- CreateTable
CREATE TABLE "scrub_queue" (
    "id" TEXT NOT NULL,
    "communication_id" TEXT NOT NULL,
    "enqueued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "QueueStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "lease_token" TEXT,
    "last_error" TEXT,
    "prompt_version" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrub_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrub_api_calls" (
    "id" TEXT NOT NULL,
    "scrub_queue_id" TEXT,
    "communication_id" TEXT,
    "prompt_version" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "tokens_in" INTEGER NOT NULL,
    "tokens_out" INTEGER NOT NULL,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT NOT NULL,
    "estimated_usd" DECIMAL(10,6) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrub_api_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_state" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_state_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_memory_agent_action_id_key" ON "agent_memory"("agent_action_id");

-- CreateIndex
CREATE UNIQUE INDEX "scrub_queue_communication_id_key" ON "scrub_queue"("communication_id");

-- CreateIndex
CREATE INDEX "scrub_queue_status_enqueued_at_idx" ON "scrub_queue"("status", "enqueued_at");

-- CreateIndex
CREATE INDEX "scrub_queue_locked_until_idx" ON "scrub_queue"("locked_until");

-- CreateIndex
CREATE INDEX "scrub_api_calls_at_idx" ON "scrub_api_calls"("at");

-- CreateIndex
CREATE INDEX "scrub_api_calls_communication_id_idx" ON "scrub_api_calls"("communication_id");

-- AddForeignKey
ALTER TABLE "agent_memory" ADD CONSTRAINT "agent_memory_agent_action_id_fkey" FOREIGN KEY ("agent_action_id") REFERENCES "agent_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrub_queue" ADD CONSTRAINT "scrub_queue_communication_id_fkey" FOREIGN KEY ("communication_id") REFERENCES "communications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrub_api_calls" ADD CONSTRAINT "scrub_api_calls_scrub_queue_id_fkey" FOREIGN KEY ("scrub_queue_id") REFERENCES "scrub_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
