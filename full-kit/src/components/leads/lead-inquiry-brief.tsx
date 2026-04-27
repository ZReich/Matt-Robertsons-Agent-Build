import {
  Building2,
  Clock3,
  MapPin,
  MessageSquareText,
  Signal,
} from "lucide-react"

import type { LeadInquiryFacts } from "@/lib/leads/inquiry-facts"
import type { LeadSource } from "@prisma/client"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { SourceBadge } from "./source-badge"

interface LeadInquiryBriefProps {
  source: LeadSource
  facts: LeadInquiryFacts
  communicationCount: number
  firstSeenAt: Date | null
  lastSeenAt: Date | null
}

function formatDate(value: Date | null): string | null {
  if (!value) return null
  return value.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string | null
}) {
  return (
    <div className="min-w-0 rounded-md border bg-background px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="truncate text-sm font-medium text-foreground">
        {value || "-"}
      </div>
    </div>
  )
}

export function LeadInquiryBrief({
  source,
  facts,
  communicationCount,
  firstSeenAt,
  lastSeenAt,
}: LeadInquiryBriefProps) {
  const messageParagraphs =
    facts.message
      ?.split(/\n{2,}/)
      .filter(Boolean)
      .slice(0, 4) ?? []
  const propertyLabel = facts.propertyName ?? facts.address ?? facts.listingLine
  const latestSeen = formatDate(lastSeenAt)
  const firstSeen = formatDate(firstSeenAt)

  return (
    <section className="grid gap-4 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <SourceBadge source={source} />
            {facts.kind ? (
              <Badge variant="outline" className="capitalize">
                {facts.kind.replace(/_/g, " ")}
              </Badge>
            ) : null}
          </div>
          <h2 className="text-lg font-semibold leading-tight">
            {propertyLabel || "Inbound lead"}
          </h2>
          {facts.market ? (
            <p className="mt-1 text-sm text-muted-foreground">{facts.market}</p>
          ) : null}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>
            {communicationCount} touchpoint{communicationCount === 1 ? "" : "s"}
          </div>
          {latestSeen ? <div>Latest {latestSeen}</div> : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Detail
          icon={<Building2 className="size-3.5" />}
          label="Property"
          value={facts.propertyName ?? facts.address ?? facts.listingLine}
        />
        {facts.market ? (
          <Detail
            icon={<MapPin className="size-3.5" />}
            label="Market"
            value={facts.market}
          />
        ) : null}
        <Detail
          icon={<Signal className="size-3.5" />}
          label="Signal"
          value={facts.kind?.replace(/_/g, " ") ?? null}
        />
        <Detail
          icon={<Clock3 className="size-3.5" />}
          label="First seen"
          value={firstSeen}
        />
      </div>

      <div className="rounded-md border bg-muted/20 p-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase text-muted-foreground">
          <MessageSquareText className="size-3.5" />
          Request
        </div>
        <p className="text-base font-medium leading-relaxed text-foreground">
          {facts.request || "No request text extracted."}
        </p>
        {facts.address ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Address: {facts.address}
          </p>
        ) : facts.listingLine && facts.propertyName ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Listing: {facts.listingLine}
          </p>
        ) : null}
      </div>

      {messageParagraphs.length > 0 ? (
        <div className="rounded-md border-l-4 border-primary/70 bg-background px-4 py-3 text-sm leading-relaxed text-foreground/90">
          {messageParagraphs.map((paragraph, index) => (
            <p
              key={`${paragraph.slice(0, 24)}-${index}`}
              className={index > 0 ? "mt-3" : undefined}
            >
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  )
}
