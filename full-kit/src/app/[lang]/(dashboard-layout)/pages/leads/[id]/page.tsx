import { notFound } from "next/navigation"

import type { LeadActivityItem } from "@/components/leads/lead-activity-timeline"
import type { Metadata } from "next"

import { getAiSuggestionState } from "@/lib/ai/suggestions"
import { getAttachmentSummary } from "@/lib/communications/attachment-types"
import { extractLeadInquiryFacts } from "@/lib/leads/inquiry-facts"
import { cleanLeadMessageText } from "@/lib/leads/message-text"
import { db } from "@/lib/prisma"

import { ContactCard } from "@/components/leads/contact-card"
import { GenerateAutoReply } from "@/components/leads/generate-auto-reply"
import { LeadActivityTimeline } from "@/components/leads/lead-activity-timeline"
import { LeadAISuggestions } from "@/components/leads/lead-ai-suggestions"
import { LeadDetailHeader } from "@/components/leads/lead-detail-header"
import { LeadInquiryBrief } from "@/components/leads/lead-inquiry-brief"
import { MarkViewedOnMount } from "@/components/leads/mark-viewed-on-mount"
import { NotesCard } from "@/components/leads/notes-card"

interface LeadDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export async function generateMetadata({
  params,
}: LeadDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const contact = await db.contact.findUnique({
    where: { id },
    select: {
      name: true,
      communications: {
        where: { direction: "inbound" },
        orderBy: { date: "desc" },
        take: 1,
        select: { body: true, subject: true, metadata: true },
      },
    },
  })
  const firstInbound = contact?.communications[0]
  const facts = extractLeadInquiryFacts(
    firstInbound?.metadata ?? null,
    firstInbound?.body ?? null,
    firstInbound?.subject ?? null
  )
  const displayName =
    contact?.name.includes("@") && facts.inquirerName
      ? facts.inquirerName
      : contact?.name

  return { title: displayName ?? "Lead" }
}

export const dynamic = "force-dynamic"

function formatLeadAt(date: Date | null): string {
  if (!date) return "new lead"

  return `new lead - ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id, lang } = await params

  const [
    contact,
    communications,
    aiSuggestions,
    catalogProperties,
    pendingReplies,
  ] = await Promise.all([
    db.contact.findUnique({ where: { id } }),
    db.communication.findMany({
      where: { contactId: id },
      orderBy: { date: "desc" },
      select: {
        id: true,
        channel: true,
        subject: true,
        body: true,
        date: true,
        direction: true,
        metadata: true,
        externalMessageId: true,
      },
    }),
    getAiSuggestionState({
      entityType: "contact",
      entityId: id,
      surface: "lead",
    }),
    db.property.findMany({
      where: { archivedAt: null, status: { in: ["active", "under_contract"] } },
      select: { id: true, name: true, address: true, status: true },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    db.pendingReply.findMany({
      where: { contactId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        draftSubject: true,
        createdAt: true,
      },
      take: 10,
    }),
  ])

  if (!contact || contact.leadSource === null) notFound()

  const firstInbound = communications.find(
    (communication) => communication.direction === "inbound"
  )
  const inquiryFacts = extractLeadInquiryFacts(
    firstInbound?.metadata ?? null,
    firstInbound?.body ?? null,
    firstInbound?.subject ?? null
  )
  const displayName =
    contact.name.includes("@") && inquiryFacts.inquirerName
      ? inquiryFacts.inquirerName
      : contact.name
  const communicationDates = communications.map(
    (communication) => communication.date
  )
  const firstSeenAt =
    communicationDates.length > 0
      ? new Date(Math.min(...communicationDates.map((date) => date.getTime())))
      : contact.leadAt
  const lastSeenAt =
    communicationDates.length > 0
      ? new Date(Math.max(...communicationDates.map((date) => date.getTime())))
      : contact.leadAt
  const activityItems: LeadActivityItem[] = communications.map(
    (communication) => ({
      id: communication.id,
      channel: communication.channel,
      subject: communication.subject,
      body: cleanLeadMessageText(communication.body),
      date: communication.date,
      direction: communication.direction,
      outlookUrl: communication.externalMessageId
        ? `https://outlook.office.com/mail/deeplink/read/${encodeURIComponent(
            communication.externalMessageId
          )}`
        : null,
      attachments: getAttachmentSummary(communication.metadata),
    })
  )

  return (
    <div className="flex flex-col">
      <MarkViewedOnMount leadId={contact.id} />
      <LeadDetailHeader
        leadId={contact.id}
        name={displayName}
        company={contact.company}
        metaLine={formatLeadAt(contact.leadAt)}
        leadSource={contact.leadSource}
        leadStatus={contact.leadStatus ?? "new"}
      />
      <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5 border-r border-border px-6 py-5">
          <LeadInquiryBrief
            source={contact.leadSource}
            facts={inquiryFacts}
            communicationCount={communications.length}
            firstSeenAt={firstSeenAt}
            lastSeenAt={lastSeenAt}
          />
          <section className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Activity</h2>
              </div>
            </div>
            <LeadActivityTimeline communications={activityItems} />
          </section>
        </div>
        <aside className="flex flex-col gap-4 bg-muted/10 px-6 py-5">
          <ContactCard
            contact={contact}
            displayName={displayName}
            displayEmail={inquiryFacts.contactEmail}
            displayPhone={inquiryFacts.contactPhone}
          />
          <LeadAISuggestions state={aiSuggestions} lang={lang} />
          <GenerateAutoReply
            contactId={contact.id}
            contactEmail={contact.email}
            lang={lang}
            triggerCommunicationId={firstInbound?.id}
            properties={catalogProperties}
            existingReplies={pendingReplies.map((r) => ({
              id: r.id,
              status: r.status,
              draftSubject: r.draftSubject,
              createdAt: r.createdAt.toISOString(),
            }))}
          />
          <NotesCard notes={contact.notes} />
        </aside>
      </div>
    </div>
  )
}
