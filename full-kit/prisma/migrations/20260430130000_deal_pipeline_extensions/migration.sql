-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('seller_rep', 'buyer_rep', 'tenant_rep');

-- CreateEnum
CREATE TYPE "DealOutcome" AS ENUM ('won', 'lost', 'withdrawn', 'expired');

-- CreateEnum
CREATE TYPE "DealSource" AS ENUM ('manual', 'lead_derived', 'buildout_event', 'buyer_rep_inferred', 'ai_suggestion');

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "deal_source" "DealSource" NOT NULL DEFAULT 'manual',
ADD COLUMN     "deal_type" "DealType" NOT NULL DEFAULT 'seller_rep',
ADD COLUMN     "outcome" "DealOutcome",
ADD COLUMN     "property_aliases" JSONB DEFAULT '[]',
ADD COLUMN     "property_key" TEXT,
ADD COLUMN     "search_criteria" JSONB,
ADD COLUMN     "unit" TEXT,
ALTER COLUMN "property_address" DROP NOT NULL,
ALTER COLUMN "property_type" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "deals_property_key_idx" ON "deals"("property_key");

-- CreateIndex
CREATE INDEX "deals_deal_type_idx" ON "deals"("deal_type");

-- CreateIndex
CREATE INDEX "deals_deal_source_idx" ON "deals"("deal_source");

-- CreateIndex
CREATE INDEX "deals_closed_at_idx" ON "deals"("closed_at");
