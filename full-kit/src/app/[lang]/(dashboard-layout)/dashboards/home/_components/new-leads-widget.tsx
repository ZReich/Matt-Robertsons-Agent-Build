import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ArrowRight, Target } from "lucide-react"

import type { NewLeadsSummary } from "@/lib/dashboard/queries"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const LEAD_SOURCE_LABELS: Record<string, string> = {
  crexi: "Crexi",
  loopnet: "LoopNet",
  buildout: "Buildout",
  email_cold: "Cold email",
  referral: "Referral",
}

interface NewLeadsWidgetProps {
  data: NewLeadsSummary
  lang: string
}

export function NewLeadsWidget({ data, lang }: NewLeadsWidgetProps) {
  const hasLeads = data.total > 0

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Target className="size-3.5" /> New Leads
          </span>
          {hasLeads && <span className="size-2 rounded-full bg-red-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="flex items-baseline justify-between">
          <span
            className={`text-3xl font-bold ${hasLeads ? "text-red-500" : ""}`}
          >
            {data.total}
          </span>
          <span className="text-sm text-muted-foreground">
            new leads to review
          </span>
        </div>
        {data.top.length > 0 && (
          <div className="space-y-2.5 pt-1">
            {data.top.map((lead) => (
              <div key={lead.id} className="min-w-0">
                <p className="truncate text-sm font-medium leading-tight">
                  {lead.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {lead.leadSource
                    ? (LEAD_SOURCE_LABELS[lead.leadSource] ?? lead.leadSource)
                    : "Unknown source"}{" "}
                  {" • "}
                  {formatDistanceToNow(lead.createdAt, { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <div className="px-6 pb-4">
        <Link
          href={`/${lang}/pages/leads`}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View all {data.total} <ArrowRight className="size-3" />
        </Link>
      </div>
    </Card>
  )
}
