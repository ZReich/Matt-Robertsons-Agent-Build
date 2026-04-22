-- AlterEnum
-- Adds the "removed" value to the SyncStatus enum so that Graph-origin
-- archive tombstones can be distinguished from other sync states.
-- Used by src/lib/msgraph/contacts.ts (archiveContact / upsertContact).
ALTER TYPE "SyncStatus" ADD VALUE 'removed';
