"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronRight, MessagesSquare } from "lucide-react"

import type { LeadSource, LeadStatus } from "@prisma/client"

import { SourceBadge } from "./source-badge"
import { StatusChip } from "./status-chip"

export interface LeadRowData {
  id: string
  name: string
  company: string | null
  email: string | null
  leadSource: LeadSource
  leadStatus: LeadStatus
  leadAt: string | null
  snippet: string | null
  propertyName: string | null
  market: string | null
  signal: string | null
  activityCount: number
  latestTouchAt: string | null
  isUnread: boolean
}

interface LeadRowProps {
  lead: LeadRowData
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function LeadRow({ lead }: LeadRowProps) {
  const params = useParams()
  const lang = (params?.lang as string) ?? "en"

  return (
    <Link
      href={`/${lang}/pages/leads/${lead.id}`}
      className="block border-b border-border px-4 py-3 transition-colors hover:bg-muted/30"
    >
      <div className="grid grid-cols-[16px_minmax(0,1.1fr)_minmax(220px,1fr)_minmax(150px,auto)_16px] items-start gap-3">
        <span>
          {lead.isUnread ? (
            <span
              className="block size-2 rounded-full bg-red-500"
              aria-label="unread"
            />
          ) : null}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {lead.name}
            {lead.company ? (
              <span className="text-muted-foreground"> - {lead.company}</span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{lead.email}</span>
            {lead.activityCount > 0 ? (
              <span className="flex items-center gap-1">
                <MessagesSquare className="size-3" />
                {lead.activityCount}
              </span>
            ) : null}
          </div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {lead.propertyName ?? "No property identified"}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {lead.market ? <span>{lead.market}</span> : null}
            {lead.signal ? (
              <span className="capitalize">
                {lead.signal.replace(/_/g, " ")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex min-w-[150px] flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <SourceBadge source={lead.leadSource} />
            <StatusChip status={lead.leadStatus} />
          </div>
          <span className="whitespace-nowrap text-right text-xs text-muted-foreground">
            {lead.latestTouchAt
              ? formatDate(lead.latestTouchAt)
              : lead.leadAt
                ? formatDate(lead.leadAt)
                : ""}
          </span>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
      {lead.snippet ? (
        <p className="ms-7 mt-2 line-clamp-2 max-w-4xl text-xs leading-relaxed text-muted-foreground">
          {lead.snippet}
        </p>
      ) : null}
    </Link>
  )
}
