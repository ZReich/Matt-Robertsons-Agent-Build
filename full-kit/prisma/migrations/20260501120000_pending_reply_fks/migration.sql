-- Add FKs to PendingReply for contactId, triggerCommunicationId,
-- approvedCommunicationId. Without these the rows could dangle when their
-- referenced row is deleted, corrupting the timeline. ON DELETE SET NULL so
-- a deleted Communication or Contact doesn't cascade-kill the audit trail.

ALTER TABLE "pending_replies"
  ADD CONSTRAINT "pending_replies_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pending_replies"
  ADD CONSTRAINT "pending_replies_trigger_communication_id_fkey"
  FOREIGN KEY ("trigger_communication_id") REFERENCES "communications"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pending_replies"
  ADD CONSTRAINT "pending_replies_approved_communication_id_fkey"
  FOREIGN KEY ("approved_communication_id") REFERENCES "communications"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "pending_replies_approved_communication_id_idx"
  ON "pending_replies" ("approved_communication_id");
