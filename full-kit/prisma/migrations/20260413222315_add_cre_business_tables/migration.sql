-- CreateEnum
CREATE TYPE "Category" AS ENUM ('business', 'personal');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('prospecting', 'listing', 'marketing', 'showings', 'offer', 'under_contract', 'due_diligence', 'closing', 'closed');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('office', 'retail', 'industrial', 'multifamily', 'land', 'mixed_use', 'hospitality', 'medical', 'other');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('email', 'call', 'text', 'whatsapp', 'meeting');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "TodoStatus" AS ENUM ('pending', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "AgentTier" AS ENUM ('auto', 'log_only', 'approve', 'blocked');

-- CreateEnum
CREATE TYPE "AgentActionStatus" AS ENUM ('pending', 'approved', 'rejected', 'executed');

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('rule', 'preference', 'playbook', 'client_note', 'style_guide');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('synced', 'failed', 'pending');

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,
    "preferred_contact" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "category" "Category" NOT NULL DEFAULT 'business',
    "tags" JSONB DEFAULT '[]',
    "created_by" TEXT,
    "archived_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "property_address" TEXT NOT NULL,
    "property_type" "PropertyType" NOT NULL,
    "square_feet" INTEGER,
    "stage" "DealStage" NOT NULL DEFAULT 'prospecting',
    "value" DECIMAL(14,2),
    "listed_date" TIMESTAMP(3),
    "closing_date" TIMESTAMP(3),
    "key_contacts" JSONB DEFAULT '{}',
    "category" "Category" NOT NULL DEFAULT 'business',
    "tags" JSONB DEFAULT '[]',
    "notes" TEXT,
    "created_by" TEXT,
    "archived_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_documents" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "date_added" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "direction" "Direction",
    "category" "Category" NOT NULL DEFAULT 'business',
    "tags" JSONB DEFAULT '[]',
    "metadata" JSONB DEFAULT '{}',
    "duration_seconds" INTEGER,
    "external_message_id" TEXT,
    "created_by" TEXT,
    "archived_at" TIMESTAMP(3),
    "contact_id" TEXT,
    "deal_id" TEXT,
    "agent_action_id" TEXT,
    "external_sync_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "location" TEXT,
    "notes" TEXT,
    "category" "Category" NOT NULL DEFAULT 'business',
    "tags" JSONB DEFAULT '[]',
    "metadata" JSONB DEFAULT '{}',
    "created_by" TEXT,
    "archived_at" TIMESTAMP(3),
    "deal_id" TEXT,
    "agent_action_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendees" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "role" TEXT,

    CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" "TodoStatus" NOT NULL DEFAULT 'pending',
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "due_date" TIMESTAMP(3),
    "category" "Category" NOT NULL DEFAULT 'business',
    "tags" JSONB DEFAULT '[]',
    "created_by" TEXT,
    "archived_at" TIMESTAMP(3),
    "contact_id" TEXT,
    "deal_id" TEXT,
    "agent_action_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommunicationChannel",
    "subject" TEXT,
    "use_case" TEXT,
    "body" TEXT NOT NULL,
    "tags" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "tier" "AgentTier" NOT NULL,
    "status" "AgentActionStatus" NOT NULL DEFAULT 'pending',
    "summary" TEXT NOT NULL,
    "target_entity" TEXT,
    "payload" JSONB DEFAULT '{}',
    "feedback" TEXT,
    "executed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_memory" (
    "id" TEXT NOT NULL,
    "memory_type" "MemoryType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "Priority",
    "tags" JSONB DEFAULT '[]',
    "contact_id" TEXT,
    "deal_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "agent_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_sync" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_data" JSONB,
    "status" "SyncStatus" NOT NULL DEFAULT 'synced',
    "error_msg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "encrypted_at" TIMESTAMP(3),
    "last_refreshed" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_name_idx" ON "contacts"("name");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_company_idx" ON "contacts"("company");

-- CreateIndex
CREATE INDEX "contacts_category_idx" ON "contacts"("category");

-- CreateIndex
CREATE INDEX "deals_contact_id_idx" ON "deals"("contact_id");

-- CreateIndex
CREATE INDEX "deals_stage_idx" ON "deals"("stage");

-- CreateIndex
CREATE INDEX "deals_property_type_idx" ON "deals"("property_type");

-- CreateIndex
CREATE INDEX "deals_property_address_idx" ON "deals"("property_address");

-- CreateIndex
CREATE INDEX "deals_listed_date_idx" ON "deals"("listed_date");

-- CreateIndex
CREATE INDEX "deals_closing_date_idx" ON "deals"("closing_date");

-- CreateIndex
CREATE INDEX "deal_documents_deal_id_idx" ON "deal_documents"("deal_id");

-- CreateIndex
CREATE INDEX "deal_documents_doc_type_idx" ON "deal_documents"("doc_type");

-- CreateIndex
CREATE UNIQUE INDEX "communications_agent_action_id_key" ON "communications"("agent_action_id");

-- CreateIndex
CREATE UNIQUE INDEX "communications_external_sync_id_key" ON "communications"("external_sync_id");

-- CreateIndex
CREATE INDEX "communications_channel_idx" ON "communications"("channel");

-- CreateIndex
CREATE INDEX "communications_date_idx" ON "communications"("date");

-- CreateIndex
CREATE INDEX "communications_contact_id_idx" ON "communications"("contact_id");

-- CreateIndex
CREATE INDEX "communications_deal_id_idx" ON "communications"("deal_id");

-- CreateIndex
CREATE INDEX "communications_direction_idx" ON "communications"("direction");

-- CreateIndex
CREATE INDEX "communications_category_idx" ON "communications"("category");

-- CreateIndex
CREATE INDEX "communications_external_message_id_idx" ON "communications"("external_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_agent_action_id_key" ON "meetings"("agent_action_id");

-- CreateIndex
CREATE INDEX "meetings_date_idx" ON "meetings"("date");

-- CreateIndex
CREATE INDEX "meetings_deal_id_idx" ON "meetings"("deal_id");

-- CreateIndex
CREATE INDEX "meetings_category_idx" ON "meetings"("category");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendees_meeting_id_contact_id_key" ON "meeting_attendees"("meeting_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "todos_agent_action_id_key" ON "todos"("agent_action_id");

-- CreateIndex
CREATE INDEX "todos_status_idx" ON "todos"("status");

-- CreateIndex
CREATE INDEX "todos_priority_idx" ON "todos"("priority");

-- CreateIndex
CREATE INDEX "todos_due_date_idx" ON "todos"("due_date");

-- CreateIndex
CREATE INDEX "todos_contact_id_idx" ON "todos"("contact_id");

-- CreateIndex
CREATE INDEX "todos_deal_id_idx" ON "todos"("deal_id");

-- CreateIndex
CREATE INDEX "todos_category_idx" ON "todos"("category");

-- CreateIndex
CREATE UNIQUE INDEX "templates_name_key" ON "templates"("name");

-- CreateIndex
CREATE INDEX "templates_use_case_idx" ON "templates"("use_case");

-- CreateIndex
CREATE INDEX "templates_channel_idx" ON "templates"("channel");

-- CreateIndex
CREATE INDEX "agent_actions_status_idx" ON "agent_actions"("status");

-- CreateIndex
CREATE INDEX "agent_actions_tier_idx" ON "agent_actions"("tier");

-- CreateIndex
CREATE INDEX "agent_actions_action_type_idx" ON "agent_actions"("action_type");

-- CreateIndex
CREATE INDEX "agent_actions_createdAt_idx" ON "agent_actions"("createdAt");

-- CreateIndex
CREATE INDEX "agent_memory_memory_type_idx" ON "agent_memory"("memory_type");

-- CreateIndex
CREATE INDEX "agent_memory_priority_idx" ON "agent_memory"("priority");

-- CreateIndex
CREATE INDEX "agent_memory_contact_id_idx" ON "agent_memory"("contact_id");

-- CreateIndex
CREATE INDEX "agent_memory_deal_id_idx" ON "agent_memory"("deal_id");

-- CreateIndex
CREATE INDEX "external_sync_source_idx" ON "external_sync"("source");

-- CreateIndex
CREATE INDEX "external_sync_synced_at_idx" ON "external_sync"("synced_at");

-- CreateIndex
CREATE INDEX "external_sync_status_idx" ON "external_sync"("status");

-- CreateIndex
CREATE INDEX "external_sync_entity_type_entity_id_idx" ON "external_sync"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_sync_source_external_id_key" ON "external_sync"("source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_service_key" ON "integration_credentials"("service");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_agent_action_id_fkey" FOREIGN KEY ("agent_action_id") REFERENCES "agent_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_external_sync_id_fkey" FOREIGN KEY ("external_sync_id") REFERENCES "external_sync"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_agent_action_id_fkey" FOREIGN KEY ("agent_action_id") REFERENCES "agent_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_agent_action_id_fkey" FOREIGN KEY ("agent_action_id") REFERENCES "agent_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memory" ADD CONSTRAINT "agent_memory_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memory" ADD CONSTRAINT "agent_memory_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
