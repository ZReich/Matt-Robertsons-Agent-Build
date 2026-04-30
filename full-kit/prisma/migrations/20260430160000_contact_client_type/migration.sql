-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('prospect', 'active_listing_client', 'active_buyer_rep_client', 'past_client', 'cooperating_broker', 'service_provider', 'other');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "client_type" "ClientType";

-- CreateIndex
CREATE INDEX "contacts_client_type_idx" ON "contacts"("client_type");
