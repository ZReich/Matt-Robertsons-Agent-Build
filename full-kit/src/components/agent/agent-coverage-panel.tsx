"use client"

import { useState } from "react"
import { CircleAlert, Contact, ListChecks, MailCheck } from "lucide-react"

import type {
  CoverageFilter,
  CoverageFilterMeta,
} from "@/components/agent/agent-coverage-drilldown"
import type { ScrubCoverageStats } from "@/lib/ai/scrub-queue"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AgentCoverageDrilldown } from "@/components/agent/agent-coverage-drilldown"

interface Props {
  coverage: ScrubCoverageStats
}

export function AgentCoveragePanel({ coverage }: Props) {
  const [activeFilter, setActiveFilter] = useState<CoverageFilterMeta | null>(
    null
  )
  const scrubbedPercent = percent(
    coverage.communications.scrubbed,
    coverage.communications.total
  )
  const linkedPercent = percent(
    coverage.communications.linkedToContact,
    coverage.communications.total
  )

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-5">
        <MetricCard
          icon={<MailCheck className="h-4 w-4" />}
          label="Communications"
          value={formatNumber(coverage.communications.total)}
          detail={`${scrubbedPercent}% scrubbed`}
        />
        <MetricCard
          icon={<CircleAlert className="h-4 w-4" />}
          label="Never queued"
          value={formatNumber(coverage.neverQueued.total)}
          detail="No scrub queue row"
          filter={filterMeta.never_queued}
          onOpenFilter={setActiveFilter}
        />
        <MetricCard
          icon={<CircleAlert className="h-4 w-4" />}
          label="Missed eligible"
          value={formatNumber(coverage.neverQueued.missedEligible)}
          detail={`${formatNumber(coverage.neverQueued.intentionallySkipped)} skipped noise`}
          filter={filterMeta.missed_eligible}
          onOpenFilter={setActiveFilter}
        />
        <MetricCard
          icon={<Contact className="h-4 w-4" />}
          label="Contact linked"
          value={`${linkedPercent}%`}
          detail={`${formatNumber(coverage.communications.orphaned)} orphaned`}
          filter={filterMeta.orphaned_context}
          onOpenFilter={setActiveFilter}
        />
        <MetricCard
          icon={<ListChecks className="h-4 w-4" />}
          label="Open todos"
          value={formatNumber(coverage.todos.open)}
          detail={`${formatNumber(coverage.todos.pendingMarkDoneActions)} close proposals`}
          filter={filterMeta.pending_mark_done}
          onOpenFilter={setActiveFilter}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
        <span className="text-sm font-medium">Operational drilldowns</span>
        <FilterButton
          meta={filterMeta.suspicious_noise}
          onOpenFilter={setActiveFilter}
        />
        <FilterButton
          meta={filterMeta.failed_scrub}
          onOpenFilter={setActiveFilter}
        />
        <FilterButton
          meta={filterMeta.stale_queue}
          onOpenFilter={setActiveFilter}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <BreakdownCard
          title="Queue"
          description="Scrub queue status"
          rows={coverage.queue}
        />
        <BreakdownCard
          title="Never Queued"
          description="Classification of unqueued emails"
          rows={coverage.neverQueued.byClassification}
        />
        <BreakdownCard
          title="Contact Candidates"
          description="Promotion review status"
          rows={coverage.contactCandidates.byStatus}
        />
      </div>

      <AgentCoverageDrilldown
        open={Boolean(activeFilter)}
        filter={activeFilter}
        onOpenChange={(open) => {
          if (!open) setActiveFilter(null)
        }}
      />
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  filter,
  onOpenFilter,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
  filter?: CoverageFilterMeta
  onOpenFilter?: (filter: CoverageFilterMeta) => void
}) {
  const body = (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="text-xs text-muted-foreground">{detail}</p>
        {filter ? (
          <p className="mt-2 text-xs font-medium text-primary">
            Open {filter.label}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Summary only</p>
        )}
      </CardContent>
    </>
  )

  if (filter && onOpenFilter) {
    return (
      <Card
        role="button"
        tabIndex={0}
        className="group h-full cursor-pointer transition-colors hover:border-primary/60 hover:bg-muted/20 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
        aria-label={`Open ${filter.label} coverage drilldown`}
        onClick={() => onOpenFilter(filter)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onOpenFilter(filter)
          }
        }}
      >
        {body}
      </Card>
    )
  }

  return <Card className="h-full">{body}</Card>
}

function FilterButton({
  meta,
  onOpenFilter,
}: {
  meta: CoverageFilterMeta
  onOpenFilter: (filter: CoverageFilterMeta) => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => onOpenFilter(meta)}
    >
      {meta.label}
    </Button>
  )
}

function BreakdownCard({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: Record<string, number>
}) {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rows</p>
        ) : (
          entries.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between gap-3">
              <Badge variant="secondary" className="truncate">
                {name}
              </Badge>
              <span className="text-sm font-medium">{formatNumber(count)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function percent(part: number, total: number) {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

const filterMeta: Record<CoverageFilter, CoverageFilterMeta> = {
  never_queued: {
    filter: "never_queued",
    label: "Never queued",
    description:
      "Communications with no scrub queue row, grouped by coverage reason codes.",
  },
  missed_eligible: {
    filter: "missed_eligible",
    label: "Missed eligible",
    description:
      "Signal, uncertain, or unclassified communications that look eligible but were not queued.",
  },
  suspicious_noise: {
    filter: "suspicious_noise",
    label: "Suspicious noise",
    description:
      "Noise-classified communications with contact, inbound, active-thread, or CRE-term signals.",
  },
  orphaned_context: {
    filter: "orphaned_context",
    label: "Orphaned context",
    description:
      "Signal-bearing communications that are not linked to a contact.",
  },
  failed_scrub: {
    filter: "failed_scrub",
    label: "Failed scrub",
    description: "Scrub queue rows that failed and need review or requeue.",
  },
  stale_queue: {
    filter: "stale_queue",
    label: "Stale queue",
    description:
      "Pending or in-flight scrub queue rows older than the queue freshness threshold.",
  },
  pending_mark_done: {
    filter: "pending_mark_done",
    label: "Pending mark-done",
    description:
      "Open todo closure proposals backed by source communications and pending agent actions.",
  },
}
