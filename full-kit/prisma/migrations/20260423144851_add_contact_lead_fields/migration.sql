-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('crexi', 'loopnet', 'buildout', 'email_cold', 'referral');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'vetted', 'contacted', 'converted', 'dropped');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "lead_source" "LeadSource",
ADD COLUMN "lead_status" "LeadStatus",
ADD COLUMN "lead_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "contacts_lead_source_idx" ON "contacts"("lead_source");
