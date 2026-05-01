import { Target } from "lucide-react"

import type { LeadRowData } from "@/components/leads/lead-row"
import type { Metadata } from "next"

import { extractLeadInquiryFacts } from "@/lib/leads/inquiry-facts"
import { isUnread } from "@/lib/leads/unread"
import {
  parsePipelineFilters,
  serializeLeadBoard,
} from "@/lib/pipeline/server/board"
import { getLeadContactsForPipeline } from "@/lib/pipeline/server/leads-query"
import {
  getPendingLeadCandidatesForPipeline,
  platformToLeadSource,
} from "@/lib/pipeline/server/pending-leads-query"
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

  const [contacts, pendingCandidates] = await Promise.all([
    getLeadContactsForPipeline(filters),
    getPendingLeadCandidatesForPipeline(filters),
  ])

  const board = serializeLeadBoard(contacts, filters)
  const promotedRows: LeadRowData[] = contacts.map((contact) => {
    const firstInbound = contact.communications.find(
      (communication) => communication.direction === "inbound"
    )
    const facts = extractLeadInquiryFacts(
      firstInbound?.metadata ?? null,
      firstInbound?.body ?? null,
      firstInbound?.subject ?? null
    )
    const latestCommunication = contact.communications[0]
    const displayName =
      contact.name.includes("@") && facts.inquirerName
        ? facts.inquirerName
        : contact.name

    return {
      id: contact.id,
      name: displayName,
      company: contact.company,
      email: contact.email,
      leadSource: contact.leadSource!,
      leadStatus: contact.leadStatus ?? "new",
      leadAt: contact.leadAt?.toISOString() ?? null,
      snippet: facts.request ?? facts.message,
      propertyName: facts.propertyName ?? facts.address ?? facts.listingLine,
      market: facts.market,
      signal: facts.kind,
      activityCount: contact.communications.length,
      latestTouchAt: latestCommunication?.date.toISOString() ?? null,
      kind: "lead" as const,
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

  // Pending candidates (LoopNet/Crexi inquiries that haven't been promoted to
  // Contact rows yet) get rendered alongside promoted leads so the Leads tab
  // shows everyone who has reached out, with a "Pending review" badge for the
  // unreviewed ones.
  const candidateRows: LeadRowData[] = pendingCandidates
    .map((candidate): LeadRowData | null => {
      const leadSource = platformToLeadSource(candidate.sourcePlatform)
      if (!leadSource) return null
      const facts = extractLeadInquiryFacts(
        candidate.evidence?.metadata ?? null,
        candidate.evidence?.body ?? candidate.message ?? null,
        candidate.evidence?.subject ?? null
      )
      const displayName =
        candidate.displayName?.trim() ||
        facts.inquirerName ||
        candidate.normalizedEmail ||
        "Unknown inquirer"
      return {
        id: candidate.id,
        name: displayName,
        company: candidate.company,
        email: candidate.normalizedEmail,
        leadSource,
        leadStatus: "new",
        leadAt: candidate.firstSeenAt.toISOString(),
        snippet: facts.request ?? facts.message ?? candidate.message,
        propertyName: facts.propertyName ?? facts.address ?? facts.listingLine,
        market: facts.market,
        signal: facts.kind ?? candidate.sourceKind,
        activityCount: candidate.evidenceCount,
        latestTouchAt: candidate.lastSeenAt.toISOString(),
        kind: "candidate",
        // Unreviewed candidates are inherently "unread" from the user's
        // perspective — they haven't been triaged yet.
        isUnread: true,
      }
    })
    .filter((row): row is LeadRowData => row !== null)

  const rows: LeadRowData[] = [...promotedRows, ...candidateRows].sort(
    (a, b) => {
      // Treat missing dates as -Infinity so they sort to the bottom in a
      // descending feed, instead of relying on lexical comparison of
      // empty strings (which would float them to the top).
      const aTime = parseTouchTime(a)
      const bTime = parseTouchTime(b)
      return bTime - aTime
    }
  )

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Target className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} inbound lead{rows.length !== 1 ? "s" : ""}
            {candidateRows.length > 0
              ? ` (${candidateRows.length} pending review)`
              : ""}
          </p>
        </div>
      </div>

      <PipelineFiltersBar
        basePath={`/${lang}/pages/leads`}
        view={view}
        filters={filters}
      />

      {view === "kanban" ? (
        <>
          {candidateRows.length > 0 ? (
            <p className="rounded-md border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
              {candidateRows.length} pending-review candidate
              {candidateRows.length === 1 ? "" : "s"} not shown — Kanban only
              displays promoted leads. Switch to List view or visit Contact
              Candidates to review them.
            </p>
          ) : null}
          <LeadsKanban columns={board.columns} />
        </>
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

function parseTouchTime(row: LeadRowData): number {
  const raw = row.latestTouchAt ?? row.leadAt
  if (!raw) return Number.NEGATIVE_INFINITY
  const t = Date.parse(raw)
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY
}
