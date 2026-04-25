import { notFound } from "next/navigation"

import type { LeadActivityItem } from "@/components/leads/lead-activity-timeline"
import type { Metadata } from "next"

import { cleanLeadMessageText } from "@/lib/leads/message-text"
import { db } from "@/lib/prisma"

import { ContactCard } from "@/components/leads/contact-card"
import { InquiryQuote } from "@/components/leads/inquiry-quote"
import { LeadActivityTimeline } from "@/components/leads/lead-activity-timeline"
import { LeadAISuggestions } from "@/components/leads/lead-ai-suggestions"
import { LeadDetailHeader } from "@/components/leads/lead-detail-header"
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
    select: { name: true },
  })

  return { title: contact?.name ?? "Lead" }
}

export const dynamic = "force-dynamic"

function extractInquiryMessage(
  metadata: unknown,
  fallback: string | null
): string | null {
  if (
    metadata &&
    typeof metadata === "object" &&
    "extracted" in metadata &&
    (metadata as { extracted?: unknown }).extracted &&
    typeof (metadata as { extracted: unknown }).extracted === "object"
  ) {
    const extracted = (metadata as { extracted: Record<string, unknown> })
      .extracted
    const inquirer = extracted.inquirer
    if (
      inquirer &&
      typeof inquirer === "object" &&
      "message" in inquirer &&
      typeof (inquirer as { message?: unknown }).message === "string"
    ) {
      return cleanLeadMessageText((inquirer as { message: string }).message)
    }
  }

  return cleanLeadMessageText(fallback)
}

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
  const { id } = await params

  const [contact, communications] = await Promise.all([
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
      },
    }),
  ])

  if (!contact || contact.leadSource === null) notFound()

  const firstInbound = communications.find(
    (communication) => communication.direction === "inbound"
  )
  const inquiryMessage = extractInquiryMessage(
    firstInbound?.metadata ?? null,
    firstInbound?.body ?? firstInbound?.subject ?? null
  )
  const activityItems: LeadActivityItem[] = communications.map(
    (communication) => ({
      id: communication.id,
      channel: communication.channel,
      subject: communication.subject,
      body: cleanLeadMessageText(communication.body),
      date: communication.date,
      direction: communication.direction,
    })
  )

  return (
    <div className="flex flex-col">
      <MarkViewedOnMount leadId={contact.id} />
      <LeadDetailHeader
        leadId={contact.id}
        name={contact.name}
        company={contact.company}
        metaLine={formatLeadAt(contact.leadAt)}
        leadSource={contact.leadSource}
        leadStatus={contact.leadStatus ?? "new"}
      />
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-r border-border px-6 py-4">
          <div className="mb-3 text-[11px] font-semibold uppercase text-muted-foreground">
            Inquiry
          </div>
          <InquiryQuote source={contact.leadSource} message={inquiryMessage} />
          <div className="mb-3 mt-6 text-[11px] font-semibold uppercase text-muted-foreground">
            Activity
          </div>
          <LeadActivityTimeline communications={activityItems} />
        </div>
        <aside className="flex flex-col gap-4 bg-muted/10 px-6 py-4">
          <ContactCard contact={contact} />
          <LeadAISuggestions contactId={contact.id} />
          <NotesCard notes={contact.notes} />
        </aside>
      </div>
    </div>
  )
}
