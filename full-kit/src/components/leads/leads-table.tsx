"use client"

import { useMemo, useState } from "react"

import type { LeadSource, LeadStatus } from "@prisma/client"
import type { LeadRowData } from "./lead-row"

import { cn } from "@/lib/utils"

import { Input } from "@/components/ui/input"
import { LeadRow } from "./lead-row"

const STATUS_PILLS: Array<{ label: string; value: LeadStatus | "all" }> = [
  { label: "All active", value: "all" },
  { label: "New", value: "new" },
  { label: "Vetted", value: "vetted" },
  { label: "Contacted", value: "contacted" },
]

const SOURCE_PILLS: Array<{ label: string; value: LeadSource | "all" }> = [
  { label: "All sources", value: "all" },
  { label: "Crexi", value: "crexi" },
  { label: "LoopNet", value: "loopnet" },
  { label: "Buildout", value: "buildout" },
  { label: "Email", value: "email_cold" },
  { label: "Referral", value: "referral" },
]

interface LeadsTableProps {
  leads: LeadRowData[]
}

function Pill({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}

export function LeadsTable({ leads }: LeadsTableProps) {
  const [status, setStatus] = useState<LeadStatus | "all">("all")
  const [source, setSource] = useState<LeadSource | "all">("all")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...leads]
      .filter((lead) => (status === "all" ? true : lead.leadStatus === status))
      .filter((lead) => (source === "all" ? true : lead.leadSource === source))
      .filter((lead) => {
        if (!query) return true
        return (
          lead.name.toLowerCase().includes(query) ||
          (lead.company?.toLowerCase().includes(query) ?? false) ||
          (lead.email?.toLowerCase().includes(query) ?? false)
        )
      })
      .sort((a, b) => {
        if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1
        const aTime = a.leadAt ? new Date(a.leadAt).getTime() : 0
        const bTime = b.leadAt ? new Date(b.leadAt).getTime() : 0
        return bTime - aTime
      })
  }, [leads, search, source, status])

  return (
    <div className="flex flex-col rounded-md border">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_PILLS.map((pill) => (
            <Pill
              key={pill.value}
              active={status === pill.value}
              label={pill.label}
              onClick={() => setStatus(pill.value)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {SOURCE_PILLS.map((pill) => (
            <Pill
              key={pill.value}
              active={source === pill.value}
              label={pill.label}
              onClick={() => setSource(pill.value)}
            />
          ))}
        </div>
      </div>
      <div className="border-b border-border px-4 py-2">
        <Input
          placeholder="Search name, company, or email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          {leads.length === 0
            ? "No leads yet. They will show up here as emails arrive from Crexi, LoopNet, or Buildout."
            : "No leads match these filters."}
        </div>
      ) : (
        <div>
          {filtered.map((lead) => (
            <LeadRow key={lead.id} lead={lead} />
          ))}
        </div>
      )}
      <p className="px-4 py-2 text-xs text-muted-foreground">
        {filtered.length} of {leads.length} leads
      </p>
    </div>
  )
}
