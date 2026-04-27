ALTER TABLE "contact_promotion_candidates"
ADD COLUMN "snoozed_until" TIMESTAMP(3);

CREATE INDEX "contact_promotion_candidates_snoozed_until_idx"
ON "contact_promotion_candidates"("snoozed_until");
