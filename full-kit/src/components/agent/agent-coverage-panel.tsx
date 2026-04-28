"use client"

import { CircleAlert, Contact, ListChecks, MailCheck } from "lucide-react"

import type { ScrubCoverageStats } from "@/lib/ai/scrub-queue"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface Props {
  coverage: ScrubCoverageStats
}

export function AgentCoveragePanel({ coverage }: Props) {
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
        />
        <MetricCard
          icon={<CircleAlert className="h-4 w-4" />}
          label="Missed eligible"
          value={formatNumber(coverage.neverQueued.missedEligible)}
          detail={`${formatNumber(coverage.neverQueued.intentionallySkipped)} skipped noise`}
        />
        <MetricCard
          icon={<Contact className="h-4 w-4" />}
          label="Contact linked"
          value={`${linkedPercent}%`}
          detail={`${formatNumber(coverage.communications.orphaned)} orphaned`}
        />
        <MetricCard
          icon={<ListChecks className="h-4 w-4" />}
          label="Open todos"
          value={formatNumber(coverage.todos.open)}
          detail={`${formatNumber(coverage.todos.pendingMarkDoneActions)} close proposals`}
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
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
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
