-- Add skipped_sensitive to QueueStatus enum.
-- Used by the sensitive-content filter (Phase F) to mark scrub_queue rows
-- that were deliberately bypassed from AI processing.

ALTER TYPE "QueueStatus" ADD VALUE IF NOT EXISTS 'skipped_sensitive';
