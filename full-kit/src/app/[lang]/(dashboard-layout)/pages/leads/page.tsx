import { Target } from "lucide-react"

import type { LeadRowData } from "@/components/leads/lead-row"
import type { Metadata } from "next"

import { isUnread } from "@/lib/leads/unread"
import {
  extractLeadInquiryMessage,
  parsePipelineFilters,
  serializeLeadBoard,
} from "@/lib/pipeline/server/board"
import { getLeadContactsForPipeline } from "@/lib/pipeline/server/leads-query"
import { toURLSearchParams } from "@/lib/pipeline/server/search-params"

import { LeadsKanban } from "./_components/leads-kanban"
import { LeadRow } from "@/components/leads/lead-row"
import { PipelineFiltersBar } from "@/components/pipeline/pipeline-filters-bar"

export const metadata: Metadata = {
  title: "Leads",
}

export const dynamic = "force-dynamic"

interface LeadsListPageProps {
  params: Promise<{ lang: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}
export default async function LeadsListPage({
  params,
  searchParams,
}: LeadsListPageProps) {
  const { lang } = await params
  const resolvedSearchParams = toURLSearchParams(await searchParams)
  const view = resolvedSearchParams.get("view") === "kanban" ? "kanban" : "list"
  const filters = parsePipelineFilters(resolvedSearchParams)

  const contacts = await getLeadContactsForPipeline(filters)

  const board = serializeLeadBoard(contacts, filters)
  const rows: LeadRowData[] = contacts.map((contact) => {
    const firstInbound = contact.communications.find(
      (communication) => communication.direction === "inbound"
    )
    const snippet = extractLeadInquiryMessage(
      firstInbound?.metadata ?? null,
      firstInbound?.subject ?? firstInbound?.body ?? null
    )

    return {
      id: contact.id,
      name: contact.name,
      company: contact.company,
      email: contact.email,
      leadSource: contact.leadSource!,
      leadStatus: contact.leadStatus ?? "new",
      leadAt: contact.leadAt?.toISOString() ?? null,
      snippet,
      isUnread: isUnread({
        leadStatus: contact.leadStatus,
        leadAt: contact.leadAt,
        leadLastViewedAt: contact.leadLastViewedAt,
        communications: contact.communications.map((communication) => ({
          direction: communication.direction,
          date: communication.date,
        })),
      }),
    }
  })

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Target className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {board.aggregates.count} inbound lead
            {board.aggregates.count !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <PipelineFiltersBar
        basePath={`/${lang}/pages/leads`}
        view={view}
        filters={filters}
      />

      {view === "kanban" ? (
        <LeadsKanban columns={board.columns} />
      ) : rows.length === 0 ? (
        <div className="rounded-md border px-4 py-10 text-center text-sm text-muted-foreground">
          No leads match these filters.
        </div>
      ) : (
        <div className="rounded-md border">
          {rows.map((lead) => (
            <LeadRow key={lead.id} lead={lead} />
          ))}
          <p className="px-4 py-2 text-xs text-muted-foreground">
            {rows.length} leads
          </p>
        </div>
      )}
    </section>
  )
}
