"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronRight } from "lucide-react"

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
      <div className="grid grid-cols-[16px_minmax(0,1.6fr)_minmax(0,1fr)_auto_auto_auto_16px] items-center gap-3">
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
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {lead.email}
        </div>
        <SourceBadge source={lead.leadSource} />
        <StatusChip status={lead.leadStatus} />
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {lead.leadAt ? formatDate(lead.leadAt) : ""}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
      {lead.snippet ? (
        <p className="ms-7 mt-1 line-clamp-1 text-xs text-muted-foreground">
          &quot;{lead.snippet}&quot;
        </p>
      ) : null}
    </Link>
  )
}
